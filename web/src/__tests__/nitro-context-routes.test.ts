// @vitest-environment node
/**
 * Integration tests for the Phase 2 group 2 Nitro-owned context endpoints:
 * GET /api/account/context, /api/folders, /api/create-server/context,
 * /api/system/status, /api/admin/context, /api/admin/page/:page and
 * /api/server/:id/context.
 *
 * Runs the real handlers against a real temporary SQLite database through an
 * h3 app with the 01.session middleware — the same composition Nitro builds.
 * Pins the Express contract (D3): payload shapes, auth redirects, admin 403s,
 * per-user limit gates, sidebar groups, server nav filtering and subuser
 * permission gating. Daemon-dependent helpers (checkNodeStatus, getServerStatus,
 * EULA/install checks) hit a closed port on 127.0.0.1 and deterministically
 * report the node as offline.
 */
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest'
import { createServer } from 'node:http'
import { randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createApp } from 'h3'
import { toNodeListener } from 'h3/node'
import { sign } from 'cookie-signature'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-context-'))
const dbPath = path.join(tmpDir, 'test.db')

// Env must be in place before the route modules are imported (the Prisma
// clients + SQLite files are constructed at module load — both the shared
// nitroPrisma and the root db.ts client the daemon helpers pull in).
process.env.DATABASE_URL = `file:${dbPath}`
process.env.SESSION_SECRET = 'a'.repeat(64)
process.env.NODE_ENV = 'test'
process.env.URL = 'http://localhost'

const db = new Database(dbPath)
db.exec(`
  CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL,
    expires DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Session_session_id_key" ON "Session"("session_id");

  CREATE TABLE IF NOT EXISTS "Users" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    username TEXT,
    password TEXT NOT NULL,
    isAdmin BOOLEAN NOT NULL DEFAULT false,
    description TEXT DEFAULT 'No About Me',
    avatar TEXT,
    permissions TEXT DEFAULT '[]',
    serverLimit INTEGER DEFAULT 0,
    maxMemory INTEGER DEFAULT 0,
    maxCpu INTEGER DEFAULT 0,
    maxStorage INTEGER DEFAULT 0,
    maxDatabases INTEGER DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    onboardingCompleted BOOLEAN NOT NULL DEFAULT false,
    onboardingSkipped BOOLEAN NOT NULL DEFAULT false,
    preferredNodeId INTEGER,
    loginAttempts INTEGER NOT NULL DEFAULT 0,
    lockedUntil DATETIME,
    totpSecret TEXT,
    totpEnabled BOOLEAN NOT NULL DEFAULT false,
    totpRecoveryCodes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users"("email");
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_key" ON "Users"("username");

  CREATE TABLE IF NOT EXISTS "settings" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Arclight',
    description TEXT NOT NULL DEFAULT '',
    logo TEXT NOT NULL DEFAULT '',
    favicon TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'default',
    lightTheme TEXT NOT NULL DEFAULT 'default',
    darkTheme TEXT NOT NULL DEFAULT 'default',
    language TEXT NOT NULL DEFAULT 'en',
    allowRegistration BOOLEAN NOT NULL DEFAULT false,
    uploadLimit INTEGER NOT NULL DEFAULT 100,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sftpPort INTEGER NOT NULL DEFAULT 3003,
    virusTotalApiKey TEXT,
    rateLimitEnabled BOOLEAN NOT NULL DEFAULT true,
    rateLimitRpm INTEGER NOT NULL DEFAULT 100,
    bannedIps TEXT NOT NULL DEFAULT '[]',
    allowUserCreateServer BOOLEAN NOT NULL DEFAULT false,
    allowUserDeleteServer BOOLEAN NOT NULL DEFAULT false,
    defaultServerLimit INTEGER NOT NULL DEFAULT 0,
    defaultMaxMemory INTEGER NOT NULL DEFAULT 512,
    defaultMaxCpu INTEGER NOT NULL DEFAULT 100,
    defaultMaxStorage INTEGER NOT NULL DEFAULT 5120,
    defaultMaxDatabases INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateMemory INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateDisk INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateCpu INTEGER NOT NULL DEFAULT 0,
    loginWallpaper TEXT,
    registerWallpaper TEXT,
    panelWallpaper TEXT,
    loginMaxAttempts INTEGER NOT NULL DEFAULT 5,
    loginLockoutMinutes INTEGER NOT NULL DEFAULT 15,
    enforceDaemonHttps BOOLEAN NOT NULL DEFAULT false,
    require2faForAdmins BOOLEAN NOT NULL DEFAULT false,
    behindReverseProxy BOOLEAN NOT NULL DEFAULT false,
    hashApiKeys BOOLEAN NOT NULL DEFAULT false,
    arclightCloudApiKey TEXT,
    arclightCloudBackupEnabled BOOLEAN NOT NULL DEFAULT false,
    smtpHost TEXT,
    smtpPort INTEGER DEFAULT 587,
    smtpUser TEXT,
    smtpPassword TEXT,
    smtpFrom TEXT,
    smtpSecure BOOLEAN NOT NULL DEFAULT false,
    s3Enabled BOOLEAN NOT NULL DEFAULT false,
    s3Endpoint TEXT,
    s3Region TEXT,
    s3Bucket TEXT,
    s3AccessKey TEXT,
    s3SecretKey TEXT,
    s3PathStyle BOOLEAN NOT NULL DEFAULT false,
    allowPrivilegedServerLimit INTEGER NOT NULL DEFAULT 5,
    allowPrivilegedMaxMemory INTEGER NOT NULL DEFAULT 2048,
    allowPrivilegedMaxCpu INTEGER NOT NULL DEFAULT 200,
    allowPrivilegedMaxStorage INTEGER NOT NULL DEFAULT 61440,
    allowPrivilegedMaxDatabases INTEGER NOT NULL DEFAULT 10,
    allowUserCreateImages BOOLEAN NOT NULL DEFAULT false,
    onboardingEnabled BOOLEAN NOT NULL DEFAULT true,
    onboardingSteps TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS "LoginHistory" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "Node" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ram INTEGER NOT NULL DEFAULT 0,
    cpu INTEGER NOT NULL DEFAULT 0,
    disk INTEGER NOT NULL DEFAULT 0,
    overallocateMemory INTEGER NOT NULL DEFAULT 0,
    overallocateDisk INTEGER NOT NULL DEFAULT 0,
    overallocateCpu INTEGER NOT NULL DEFAULT 0,
    locationId INTEGER,
    address TEXT NOT NULL DEFAULT '127.0.0.1',
    port INTEGER NOT NULL DEFAULT 1,
    key TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    allocatedPorts TEXT DEFAULT '[]',
    sftpPort INTEGER NOT NULL DEFAULT 3003,
    maintenanceMode BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS "Images" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UUID TEXT NOT NULL,
    name TEXT,
    description TEXT,
    author TEXT,
    authorName TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meta TEXT,
    dockerImages TEXT,
    startup TEXT,
    stop TEXT,
    startup_done TEXT,
    config_files TEXT,
    info TEXT,
    scripts TEXT,
    variables TEXT,
    portRequirements TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'approved',
    createdById INTEGER,
    rejectionReason TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Images_UUID_key" ON "Images"("UUID");

  CREATE TABLE IF NOT EXISTS "Server" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UUID TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Ports TEXT NOT NULL,
    Memory INTEGER NOT NULL,
    Swap INTEGER NOT NULL DEFAULT 0,
    Cpu INTEGER NOT NULL,
    Storage INTEGER NOT NULL,
    Variables TEXT,
    StartCommand TEXT,
    dockerImage TEXT,
    allowStartupEdit BOOLEAN NOT NULL DEFAULT false,
    Installing BOOLEAN NOT NULL DEFAULT true,
    Queued BOOLEAN NOT NULL DEFAULT true,
    Suspended BOOLEAN NOT NULL DEFAULT false,
    Running BOOLEAN NOT NULL DEFAULT false,
    backupLimit INTEGER NOT NULL DEFAULT 5,
    backupIgnoreList TEXT NOT NULL DEFAULT '',
    databaseLimit INTEGER NOT NULL DEFAULT 0,
    ownerId INTEGER NOT NULL,
    nodeId INTEGER NOT NULL,
    imageId INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Server_UUID_key" ON "Server"("UUID");

  CREATE TABLE IF NOT EXISTS "ServerFolder" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    ownerId INTEGER NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "ServerFolderMember" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    folderId INTEGER NOT NULL,
    serverUUID TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "ServerFolderMember_serverUUID_key" ON "ServerFolderMember"("serverUUID");

  CREATE TABLE IF NOT EXISTS "SubUser" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL,
    userId INTEGER NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "SubUser_serverId_userId_key" ON "SubUser"("serverId", "userId");

  INSERT OR IGNORE INTO "settings" (id) VALUES (1);
`)

const { default: sessionMiddleware } = await import('../../server/middleware/01.session')
const accountContextHandler = (await import('../../server/routes/api/account/context.get')).default
const foldersHandler = (await import('../../server/routes/api/folders.get')).default
const createServerContextHandler = (await import('../../server/routes/api/create-server/context.get')).default
const systemStatusHandler = (await import('../../server/routes/api/system/status.get')).default
const adminContextHandler = (await import('../../server/routes/api/admin/context.get')).default
const adminPageHandler = (await import('../../server/routes/api/admin/page/[page].get')).default
const serverContextHandler = (await import('../../server/routes/api/server/[id]/context.get')).default
const auth = await import('../../server/utils/auth-session')

function makeApp(): (req: unknown, res: unknown) => void {
  const app = createApp()
  app.use(sessionMiddleware)
  app.all('/api/account/context', accountContextHandler)
  app.all('/api/folders', foldersHandler)
  app.all('/api/create-server/context', createServerContextHandler)
  app.all('/api/system/status', systemStatusHandler)
  app.all('/api/admin/context', adminContextHandler)
  app.all('/api/admin/page/:page', adminPageHandler)
  app.all('/api/server/:id/context', serverContextHandler)
  return toNodeListener(app)
}

async function withServer(
  listener: (req: unknown, res: unknown) => void,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer(listener as never)
  await new Promise((resolve) => server.listen(0, resolve))
  const address = server.address() as { port: number }
  try {
    await fn(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

const SESSION_SECRET = 'a'.repeat(64)

function insertUser(overrides: Record<string, unknown> = {}): number {
  const row = {
    email: 'default@x.io',
    username: 'defaultuser',
    password: 'x'.repeat(60),
    isAdmin: 0,
    description: 'No About Me',
    role: 'user',
    onboardingCompleted: 0,
    onboardingSkipped: 0,
    serverLimit: 0,
    maxMemory: 0,
    maxCpu: 0,
    maxStorage: 0,
    totpEnabled: 0,
    ...overrides,
  }
  const info = db
    .prepare(
      `INSERT INTO "Users" (email, username, password, isAdmin, description, role,
        onboardingCompleted, onboardingSkipped, serverLimit, maxMemory, maxCpu, maxStorage,
        totpEnabled)
       VALUES (@email, @username, @password, @isAdmin, @description, @role,
        @onboardingCompleted, @onboardingSkipped, @serverLimit, @maxMemory, @maxCpu, @maxStorage,
        @totpEnabled)`,
    )
    .run(row)
  return Number(info.lastInsertRowid)
}

/** Inserts a session row for the user and returns the signed connect.sid cookie. */
function sessionCookieFor(userId: number, extra: Record<string, unknown> = {}): string {
  const sid = randomBytes(16).toString('hex')
  const data = JSON.stringify({
    user: { id: userId, email: 'u@x.io', isAdmin: false, ...extra },
    cookie: {
      originalMaxAge: 604800000,
      expires: new Date(Date.now() + 604800000).toISOString(),
      httpOnly: true,
      path: '/',
      sameSite: 'strict',
      secure: false,
    },
  })
  db.prepare(
    `INSERT INTO "Session" (id, session_id, data, expires, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(
    randomBytes(16).toString('hex'),
    sid,
    data,
    new Date(Date.now() + 604800000).toISOString(),
    new Date().toISOString(),
    new Date().toISOString(),
  )
  return `s:${sign(sid, SESSION_SECRET)}`
}

function getJson(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>
}

async function get(
  base: string,
  pathname: string,
  cookie?: string,
): Promise<Response> {
  return fetch(`${base}${pathname}`, {
    redirect: 'manual',
    headers: cookie ? { cookie: `connect.sid=${cookie}` } : {},
  })
}

// Tests mutate the shared settings row to exercise create-server gates.
// Reset the policy fields after each so tests stay order-independent.
afterEach(() => {
  db.prepare(
    `UPDATE "settings" SET allowUserCreateServer = 0, defaultServerLimit = 0,
      defaultMaxMemory = 512, defaultMaxCpu = 100, defaultMaxStorage = 5120,
      allowPrivilegedServerLimit = 5, allowPrivilegedMaxMemory = 2048,
      allowPrivilegedMaxCpu = 200, allowPrivilegedMaxStorage = 61440,
      require2faForAdmins = 0, allowUserCreateImages = 0 WHERE id = 1`,
  ).run()
  db.exec(
    'DELETE FROM "Server"; DELETE FROM "ServerFolder"; DELETE FROM "ServerFolderMember"; ' +
      'DELETE FROM "LoginHistory"; DELETE FROM "Node"; DELETE FROM "Images"; DELETE FROM "SubUser"; ' +
      'DELETE FROM "Session"; DELETE FROM "Users";',
  )
})

describe('GET /api/account/context (Nitro)', () => {
  it('returns the account payload with history, nodes and images', async () => {
    const userId = insertUser({ email: 'acct@x.io', username: 'acct' })
    const nodeId = db.prepare(
      `INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`,
    ).run().lastInsertRowid
    db.prepare(
      `INSERT INTO "Images" (UUID, name, status, createdById) VALUES ('img-1', 'mcr', 'approved', ?)`,
    ).run(userId)
    db.prepare(
      `INSERT INTO "LoginHistory" (userId, ipAddress, userAgent) VALUES (?, '10.1.1.1', 'test-agent')`,
    ).run(userId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/account/context', sessionCookieFor(userId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.user).toEqual(
        expect.objectContaining({
          id: userId,
          username: 'acct',
          email: 'acct@x.io',
          isAdmin: false,
          description: 'No About Me',
          preferredNodeId: null,
          totpEnabled: false,
        }),
      )
      expect(data.loginHistory).toHaveLength(1)
      expect(data.loginHistory[0]).toEqual(
        expect.objectContaining({ ipAddress: '10.1.1.1', userAgent: 'test-agent' }),
      )
      expect(data.nodes).toEqual(
        expect.arrayContaining([{ id: Number(nodeId), name: 'n1', address: '127.0.0.1' }]),
      )
      expect(data.images).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'mcr', status: 'approved' }),
        ]),
      )
      expect(data.allowed).toBe(false)
      expect(data.settings).toEqual({ allowUserCreateImages: false })
    })
  })

  it('allows image submissions for admins even when the setting is off', async () => {
    const userId = insertUser({ email: 'adm@x.io', username: 'adm', isAdmin: 1, role: 'owner' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/account/context', sessionCookieFor(userId))
      const data = (await getJson(res)) as Record<string, any>
      expect(data.allowed).toBe(true)
    })
  })

  it('redirects to /login when unauthenticated', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/account/context')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })
  })
})

describe('GET /api/folders (Nitro)', () => {
  it('lists the user folders with members', async () => {
    const userId = insertUser({ email: 'fold@x.io', username: 'fold' })
    const folderId = db.prepare(
      `INSERT INTO "ServerFolder" (name, ownerId) VALUES ('mine', ?)`,
    ).run(userId).lastInsertRowid
    db.prepare(
      `INSERT INTO "ServerFolderMember" (folderId, serverUUID) VALUES (?, 'srv-1')`,
    ).run(folderId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/folders', sessionCookieFor(userId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.folders).toHaveLength(1)
      expect(data.folders[0]).toEqual(
        expect.objectContaining({ name: 'mine', members: [expect.objectContaining({ serverUUID: 'srv-1' })] }),
      )
    })
  })

  it('redirects to /login when unauthenticated', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/folders')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })
  })
})

describe('GET /api/create-server/context (Nitro)', () => {
  it('returns disabled when allowUserCreateServer is off', async () => {
    const userId = insertUser({ email: 'cs@x.io', username: 'cs' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/create-server/context', sessionCookieFor(userId))
      const data = await getJson(res)
      expect(data).toEqual({ success: false, disabled: true })
    })
  })

  it('returns notAllowed when the user has no server limit', async () => {
    const userId = insertUser({ email: 'cs2@x.io', username: 'cs2', serverLimit: 0 })
    db.prepare('UPDATE "settings" SET allowUserCreateServer = 1 WHERE id = 1').run()
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/create-server/context', sessionCookieFor(userId))
      const data = await getJson(res)
      expect(data).toEqual({ success: false, notAllowed: true })
    })
  })

  it('returns limitReached when the user hit their server count', async () => {
    const userId = insertUser({ email: 'cs3@x.io', username: 'cs3', serverLimit: 1, maxMemory: 512, maxCpu: 100, maxStorage: 5120 })
    db.prepare('UPDATE "settings" SET allowUserCreateServer = 1 WHERE id = 1').run()
    const nodeId = Number(
      db.prepare(`INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`).run().lastInsertRowid,
    )
    const imageId = Number(
      db.prepare(`INSERT INTO "Images" (UUID, name, status) VALUES ('img-1', 'mcr', 'approved')`).run().lastInsertRowid,
    )
    db.prepare(
      `INSERT INTO "Server" (UUID, name, Ports, Memory, Cpu, Storage, ownerId, nodeId, imageId)
       VALUES ('srv-1', 'one', '[]', 512, 100, 5120, ?, ?, ?)`,
    ).run(userId, nodeId, imageId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/create-server/context', sessionCookieFor(userId))
      const data = await getJson(res)
      expect(data).toEqual({
        success: false,
        limitReached: true,
        serverLimit: 1,
        currentCount: 1,
      })
    })
  })

  it('returns the full creation payload with limits, nodes, images and recommended node', async () => {
    const userId = insertUser({
      email: 'cs4@x.io',
      username: 'cs4',
      serverLimit: 2,
      maxMemory: 1024,
      maxCpu: 150,
      maxStorage: 8192,
      preferredNodeId: 1,
    })
    db.prepare('UPDATE "settings" SET allowUserCreateServer = 1 WHERE id = 1').run()
    db.prepare(
      `INSERT INTO "Node" (id, name, address, port, key, ram, cpu, disk)
       VALUES (1, 'n1', '127.0.0.1', 1, 'k', 4096, 8, 102400)`,
    ).run()
    db.prepare(
      `INSERT INTO "Images" (UUID, name, description, startup, dockerImages, portRequirements, status)
       VALUES ('img-1', 'mcr', 'desc', 'java -jar', '[{"latest":"mcr:latest"}]', '[{"name":"HTTP","internalPort":80}]', 'approved')`,
    ).run()

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/create-server/context', sessionCookieFor(userId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.serverLimit).toBe(2)
      expect(data.currentCount).toBe(0)
      expect(data.resourceLimits).toEqual({ maxMemory: 1024, maxCpu: 150, maxStorage: 8192 })
      // preferredNodeId is honored as the recommended node.
      expect(data.recommendedNodeId).toBe(1)
      expect(data.nodeHeadroom['1']).toEqual(
        expect.objectContaining({ ram: 4096, cpu: 8, disk: 102400, usedMemory: 0 }),
      )
      expect(data.nodes).toEqual([{ id: 1, name: 'n1', address: '127.0.0.1' }])
      expect(data.images[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          name: 'mcr',
          startup: 'java -jar',
          dockerImages: [{ latest: 'mcr:latest' }],
          portRequirements: [{ name: 'HTTP', internalPort: 80 }],
        }),
      )
    })
  })
})

describe('GET /api/system/status (Nitro)', () => {
  it('returns system stats with offline node statuses for an admin', async () => {
    const adminId = insertUser({ email: 'sys@x.io', username: 'sys', isAdmin: 1, role: 'owner' })
    db.prepare(
      `INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`,
    ).run()

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/system/status', sessionCookieFor(adminId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.system).toEqual(
        expect.objectContaining({
          hostname: expect.any(String),
          platform: expect.any(String),
          arch: expect.any(String),
          cpus: expect.any(Number),
          memory: expect.objectContaining({ total: expect.any(Number) }),
          uptime: expect.any(Number),
        }),
      )
      // Port 1 on 127.0.0.1 is closed → node reports Offline.
      expect(data.nodes).toHaveLength(1)
      expect(data.nodes[0]).toEqual(expect.objectContaining({ name: 'n1', status: 'Offline' }))
      expect(data.stats).toEqual({ servers: 0, users: 1, nodes: 1 })
    })
  })

  it('returns 403 for a non-admin', async () => {
    const userId = insertUser({ email: 'sys2@x.io', username: 'sys2' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/system/status', sessionCookieFor(userId))
      expect(res.status).toBe(403)
    })
  })
})

describe('GET /api/admin/context (Nitro)', () => {
  it('returns the admin user, sidebar groups and 2FA flag', async () => {
    const adminId = insertUser({ email: 'adm@x.io', username: 'adm', isAdmin: 1, role: 'owner' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/context', sessionCookieFor(adminId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.user).toEqual(
        expect.objectContaining({ id: adminId, username: 'adm', isAdmin: true, role: 'owner' }),
      )
      expect(Array.isArray(data.sidebarGroups)).toBe(true)
      expect(data.sidebarGroups.length).toBeGreaterThan(0)
      const allItems = data.sidebarGroups.flatMap((g: any) => g.items)
      expect(allItems.some((i: any) => i.id === 'admin-overview')).toBe(true)
      expect(data.require2faForAdmins).toBe(false)
    })
  })

  it('returns 403 for a non-admin', async () => {
    const userId = insertUser({ email: 'adm2@x.io', username: 'adm2' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/context', sessionCookieFor(userId))
      expect(res.status).toBe(403)
    })
  })

  it('redirects an admin to 2FA setup when require2faForAdmins is on', async () => {
    const adminId = insertUser({
      email: 'adm3@x.io',
      username: 'adm3',
      isAdmin: 1,
      role: 'owner',
    })
    db.prepare('UPDATE "settings" SET require2faForAdmins = 1 WHERE id = 1').run()
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/context', sessionCookieFor(adminId))
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/account/2fa/setup?required=1')
    })
  })

  it('lets a TOTP-enabled admin through when require2faForAdmins is on', async () => {
    const adminId = insertUser({
      email: 'adm4@x.io',
      username: 'adm4',
      isAdmin: 1,
      role: 'owner',
      totpEnabled: 1,
    })
    db.prepare('UPDATE "settings" SET require2faForAdmins = 1 WHERE id = 1').run()
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/context', sessionCookieFor(adminId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
    })
  })
})

describe('GET /api/admin/page/:page (Nitro)', () => {
  const adminId = () => insertUser({ email: 'ap@x.io', username: 'ap', isAdmin: 1, role: 'owner' })

  it('returns the menu page with sidebar groups', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/page/menu', sessionCookieFor(adminId()))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.page).toBe('menu')
      expect(Array.isArray(data.data.sidebarGroups)).toBe(true)
    })
  })

  it('returns the users page with safe-user rows', async () => {
    const aId = adminId()
    insertUser({ email: 'u1@x.io', username: 'u1' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/page/users', sessionCookieFor(aId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.data.users.length).toBeGreaterThanOrEqual(2)
      expect(data.data.users[0]).toEqual(
        expect.objectContaining({
          id: expect.any(Number),
          username: expect.any(String),
          isAdmin: expect.any(Boolean),
          serverCount: 0,
        }),
      )
    })
  })

  it('sets canTransferOwner for an owner viewing a non-owner', async () => {
    const aId = adminId()
    const targetId = insertUser({ email: 'u2@x.io', username: 'u2' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, `/api/admin/page/users-view?id=${targetId}`, sessionCookieFor(aId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.data.canTransferOwner).toBe(true)
      expect(data.data.dataUser.id).toBe(targetId)
    })
  })

  it('returns 404 for an unknown page', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/page/nope', sessionCookieFor(adminId()))
      expect(res.status).toBe(404)
      const data = await getJson(res)
      expect(data).toEqual({ success: false, error: 'Unknown admin page.' })
    })
  })

  it('returns 403 for a non-admin', async () => {
    const userId = insertUser({ email: 'ap2@x.io', username: 'ap2' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/admin/page/menu', sessionCookieFor(userId))
      expect(res.status).toBe(403)
    })
  })
})

describe('GET /api/server/:id/context (Nitro)', () => {
  function insertServerFixture(ownerId: number, overrides: Record<string, unknown> = {}) {
    const nodeId = Number(
      db.prepare(`INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`).run().lastInsertRowid,
    )
    const imageId = Number(
      db.prepare(
        `INSERT INTO "Images" (UUID, name, info, status)
         VALUES ('img-1', 'mcr', '{"features":["players","worlds"]}', 'approved')`,
      ).run().lastInsertRowid,
    )
    const row = {
      UUID: 'srv-abc',
      name: 'My Server',
      Ports: '[{"name":"HTTP","internalPort":80,"externalPort":8080,"primary":true}]',
      Memory: 1024,
      Swap: 0,
      Cpu: 100,
      Storage: 8192,
      Installing: 0,
      Queued: 0,
      ...overrides,
    }
    db.prepare(
      `INSERT INTO "Server" (UUID, name, Ports, Memory, Swap, Cpu, Storage, Installing, Queued, ownerId, nodeId, imageId)
       VALUES (@UUID, @name, @Ports, @Memory, @Swap, @Cpu, @Storage, @Installing, @Queued, ?, ?, ?)`,
    ).run(row, ownerId, nodeId, imageId)
    return { nodeId, imageId }
  }

  it('returns the server payload with features, nav and status for the owner', async () => {
    const ownerId = insertUser({ email: 'srv@x.io', username: 'srv', serverLimit: 1 })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/context', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.server).toEqual(
        expect.objectContaining({
          UUID: 'srv-abc',
          name: 'My Server',
          description: '',
          suspended: false,
          installing: false,
          queued: false,
          running: false,
          image: 'mcr',
          node: { name: 'n1', address: '127.0.0.1' },
          primaryAddress: '127.0.0.1:8080',
          limits: { memory: 1024, cpu: 100, storage: 8192, swap: 0 },
        }),
      )
      // Image features (no eula → no daemon EULA check).
      expect(data.features).toEqual(['players', 'worlds'])
      // Installing=false + Queued=false → fast path, no daemon call.
      expect(data.installed).toEqual({ installed: true, state: 'installed' })
      // Node port 1 closed → daemon offline status.
      expect(data.status.online).toBe(false)
      expect(data.status.daemonOffline).toBe(true)
      expect(data.isAdmin).toBe(false)
      expect(data.isOwner).toBe(true)
      expect(data.isSubUser).toBe(false)
      expect(data.subUserPermissions).toEqual([])

      // Nav: owner sees console, files, schedules, startup, backups,
      // databases, settings, worlds + players (feature-gated) — but not the
      // admin-only item. UUIDs resolved from :uuid placeholders.
      const navIds = data.nav.map((n: any) => n.id)
      expect(navIds).toContain('console')
      expect(navIds).toContain('files')
      expect(navIds).toContain('players')
      expect(navIds).toContain('worlds')
      expect(navIds).not.toContain('admin')
      const consoleItem = data.nav.find((n: any) => n.id === 'console')
      expect(consoleItem.url).toBe('/server/srv-abc')
    })
  })

  it('filters the nav by subuser permissions', async () => {
    const ownerId = insertUser({ email: 'srv2@x.io', username: 'srv2', serverLimit: 1 })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub@x.io', username: 'sub' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console","files.read"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/context', sessionCookieFor(subUserId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.isSubUser).toBe(true)
      expect(data.isOwner).toBe(false)
      expect(data.subUserPermissions).toEqual(['console', 'files.read'])
      const navIds = data.nav.map((n: any) => n.id)
      expect(navIds).toContain('console')
      // subusers (ownerOnly) is hidden for subusers.
      expect(navIds).not.toContain('subusers')
    })
  })

  it('drops the eula feature when the daemon is offline (accepted fast-path)', async () => {
    const ownerId = insertUser({ email: 'srv-eula@x.io', username: 'srveula', serverLimit: 1 })
    // Image features include eula; the node port is closed → node Offline →
    // checkEulaStatus returns accepted:true without a daemon call → eula is
    // filtered out of the surfaced features.
    const nodeId = Number(
      db.prepare(`INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`).run().lastInsertRowid,
    )
    const imageId = Number(
      db.prepare(
        `INSERT INTO "Images" (UUID, name, info, status)
         VALUES ('img-eula', 'mcr', '{"features":["eula","players"]}', 'approved')`,
      ).run().lastInsertRowid,
    )
    db.prepare(
      `INSERT INTO "Server" (UUID, name, Ports, Memory, Cpu, Storage, Installing, Queued, ownerId, nodeId, imageId)
       VALUES ('srv-eula', 'Eula', '[]', 1024, 100, 8192, 0, 0, ?, ?, ?)`,
    ).run(ownerId, nodeId, imageId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-eula/context', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.features).toEqual(['players'])
    })
  })

  it('redirects to / for a user with no access', async () => {
    const ownerId = insertUser({ email: 'srv3@x.io', username: 'srv3', serverLimit: 1 })
    insertServerFixture(ownerId)
    const strangerId = insertUser({ email: 'str@x.io', username: 'str' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/context', sessionCookieFor(strangerId))
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')
    })
  })

  it('redirects to /login when unauthenticated', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/context')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })
  })
})

afterAll(async () => {
  await auth.nitroPrisma.$disconnect().catch(() => {})
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})
