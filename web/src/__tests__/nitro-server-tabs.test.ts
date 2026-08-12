// @vitest-environment node
/**
 * Integration tests for the Phase 2 group 3a Nitro-owned server tab reads:
 * GET /api/server/:id/{settings,startup,databases,schedules,backups,subusers,
 * worlds}.
 *
 * Runs the real handlers against a real temporary SQLite database through an
 * h3 app with the 01.session middleware — the same composition Nitro builds.
 * Pins the Express contract (D3): payload shapes, auth meta blocks, subuser
 * permission 403s, owner-only subusers, and the daemon-offline worlds shape.
 * Daemon-dependent helpers (isWorld, getServerStatus) hit a closed port on
 * 127.0.0.1 and deterministically report the node as offline.
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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-tabs-'))
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

  CREATE TABLE IF NOT EXISTS "DatabaseHost" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    host TEXT NOT NULL,
    port INTEGER NOT NULL DEFAULT 3306,
    username TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT '',
    nodeId INTEGER,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "ServerDatabase" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL,
    hostId INTEGER NOT NULL,
    databaseName TEXT NOT NULL,
    databaseUser TEXT NOT NULL,
    databasePassword TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "Schedule" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL,
    name TEXT NOT NULL,
    cron TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false,
    timeOffset INTEGER NOT NULL DEFAULT 0,
    lastRunAt DATETIME,
    nextRunAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "ScheduleTask" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    scheduleId INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL,
    payload TEXT NOT NULL,
    timeOffset INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS "Backup" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UUID TEXT NOT NULL,
    name TEXT NOT NULL,
    serverId TEXT NOT NULL,
    filePath TEXT NOT NULL DEFAULT '',
    size BIGINT,
    checksum TEXT,
    locked BOOLEAN NOT NULL DEFAULT false,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    arclightCloudId TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Backup_UUID_key" ON "Backup"("UUID");

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
const settingsHandler = (await import('../../server/routes/api/server/[id]/settings.get')).default
const startupHandler = (await import('../../server/routes/api/server/[id]/startup.get')).default
const databasesHandler = (await import('../../server/routes/api/server/[id]/databases.get')).default
const schedulesHandler = (await import('../../server/routes/api/server/[id]/schedules.get')).default
const backupsHandler = (await import('../../server/routes/api/server/[id]/backups.get')).default
const subusersHandler = (await import('../../server/routes/api/server/[id]/subusers.get')).default
const worldsHandler = (await import('../../server/routes/api/server/[id]/worlds.get')).default
const auth = await import('../../server/utils/auth-session')

function makeApp(): (req: unknown, res: unknown) => void {
  const app = createApp()
  app.use(sessionMiddleware)
  app.all('/api/server/:id/settings', settingsHandler)
  app.all('/api/server/:id/startup', startupHandler)
  app.all('/api/server/:id/databases', databasesHandler)
  app.all('/api/server/:id/schedules', schedulesHandler)
  app.all('/api/server/:id/backups', backupsHandler)
  app.all('/api/server/:id/subusers', subusersHandler)
  app.all('/api/server/:id/worlds', worldsHandler)
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
    maxDatabases: 0,
    totpEnabled: 0,
    ...overrides,
  }
  const info = db
    .prepare(
      `INSERT INTO "Users" (email, username, password, isAdmin, description, role,
        onboardingCompleted, onboardingSkipped, serverLimit, maxMemory, maxCpu, maxStorage,
        maxDatabases, totpEnabled)
       VALUES (@email, @username, @password, @isAdmin, @description, @role,
        @onboardingCompleted, @onboardingSkipped, @serverLimit, @maxMemory, @maxCpu, @maxStorage,
        @maxDatabases, @totpEnabled)`,
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

/** Server fixture: node + image + server row, returns the UUID. */
function insertServerFixture(
  ownerId: number,
  overrides: Record<string, unknown> = {},
): string {
  const nodeId = Number(
    db.prepare(`INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`).run().lastInsertRowid,
  )
  const imageId = Number(
    db.prepare(
      `INSERT INTO "Images" (UUID, name, info, dockerImages, status)
       VALUES ('img-1', 'mcr', '{"features":["players","worlds"]}', '[{"latest":"mcr:latest"},{"java17":"mcr:java17"}]', 'approved')`,
    ).run().lastInsertRowid,
  )
  const row = {
    UUID: 'srv-abc',
    name: 'My Server',
    description: 'A test server',
    Ports: '[{"name":"HTTP","internalPort":80,"externalPort":8080,"primary":true}]',
    Memory: 1024,
    Swap: 0,
    Cpu: 100,
    Storage: 8192,
    Variables: '[{"name":"Version","env":"VERSION","type":"text","value":"1.20"}]',
    StartCommand: 'java -jar server.jar',
    dockerImage: '{"latest":"mcr:latest"}',
    Installing: 0,
    Queued: 0,
    ...overrides,
  }
  db.prepare(
    `INSERT INTO "Server" (UUID, name, description, Ports, Memory, Swap, Cpu, Storage,
       Variables, StartCommand, dockerImage, Installing, Queued, ownerId, nodeId, imageId)
     VALUES (@UUID, @name, @description, @Ports, @Memory, @Swap, @Cpu, @Storage,
       @Variables, @StartCommand, @dockerImage, @Installing, @Queued, ?, ?, ?)`,
  ).run(row, ownerId, nodeId, imageId)
  return String(row.UUID)
}

afterEach(() => {
  db.exec(
    'DELETE FROM "Server"; DELETE FROM "Node"; DELETE FROM "Images"; DELETE FROM "SubUser"; ' +
      'DELETE FROM "ServerDatabase"; DELETE FROM "DatabaseHost"; DELETE FROM "Schedule"; ' +
      'DELETE FROM "ScheduleTask"; DELETE FROM "Backup"; DELETE FROM "Session"; DELETE FROM "Users";',
  )
  db.prepare('UPDATE "settings" SET allowUserDeleteServer = 0, defaultMaxDatabases = 0 WHERE id = 1').run()
})

describe('GET /api/server/:id/settings (Nitro)', () => {
  it('returns the settings tab payload with auth meta', async () => {
    const ownerId = insertUser({ email: 'set@x.io', username: 'set' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/settings', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.server).toEqual({
        UUID: 'srv-abc',
        id: expect.any(Number),
        name: 'My Server',
        description: 'A test server',
        createdAt: expect.any(String),
        nodeName: 'n1',
        imageName: 'mcr',
        memory: 1024,
        cpu: 100,
        storage: 8192,
        suspended: false,
      })
      expect(data.allowUserDeleteServer).toBe(false)
      expect(data.isAdmin).toBe(false)
      expect(data.isOwner).toBe(true)
      expect(data.isSubUser).toBe(false)
      expect(data.subUserPermissions).toEqual([])
    })
  })

  it('reports allowUserDeleteServer from settings', async () => {
    const ownerId = insertUser({ email: 'set2@x.io', username: 'set2' })
    insertServerFixture(ownerId)
    db.prepare('UPDATE "settings" SET allowUserDeleteServer = 1 WHERE id = 1').run()

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/settings', sessionCookieFor(ownerId))
      const data = (await getJson(res)) as Record<string, any>
      expect(data.allowUserDeleteServer).toBe(true)
    })
  })

  it('403s a subuser without the settings permission', async () => {
    const ownerId = insertUser({ email: 'set3@x.io', username: 'set3' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub@x.io', username: 'sub' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["files"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/settings', sessionCookieFor(subUserId))
      expect(res.status).toBe(403)
    })
  })

  it('404s for an unknown server when an admin (non-admins are redirected)', async () => {
    // isAuthenticatedForServer redirects non-admins to '/' for a missing
    // server; only admins pass the guard and reach the handler's 404.
    const adminId = insertUser({ email: 'set4@x.io', username: 'set4', isAdmin: 1, role: 'owner' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/nope/settings', sessionCookieFor(adminId))
      expect(res.status).toBe(404)
      const data = await getJson(res)
      expect(data).toEqual({ success: false, error: 'Server not found' })
    })
  })

  it('redirects a non-admin to / for an unknown server', async () => {
    const userId = insertUser({ email: 'set5@x.io', username: 'set5' })
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/nope/settings', sessionCookieFor(userId))
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')
    })
  })

  it('redirects to /login when unauthenticated', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/settings')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })
  })
})

describe('GET /api/server/:id/startup (Nitro)', () => {
  it('returns start command, docker images and variables', async () => {
    const ownerId = insertUser({ email: 'stu@x.io', username: 'stu' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/startup', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.server).toEqual({
        UUID: 'srv-abc',
        startCommand: 'java -jar server.jar',
        allowStartupEdit: false,
      })
      expect(data.currentDockerImage).toBe('latest')
      expect(data.availableDockerImages).toEqual(['latest', 'java17'])
      expect(data.variables).toEqual([
        expect.objectContaining({ name: 'Version', env: 'VERSION', type: 'text', value: '1.20' }),
      ])
      expect(data.isOwner).toBe(true)
    })
  })

  it('403s a subuser without the startup permission', async () => {
    const ownerId = insertUser({ email: 'stu2@x.io', username: 'stu2' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub2@x.io', username: 'sub2' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/startup', sessionCookieFor(subUserId))
      expect(res.status).toBe(403)
    })
  })

  it('lets a subuser with the full startup permission through', async () => {
    const ownerId = insertUser({ email: 'stu3@x.io', username: 'stu3' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub3@x.io', username: 'sub3' })
    // The additive endpoint mirrors requireSubUserPermission('startup') — the
    // nav is filtered the same way, so a subuser with only startup.read never
    // reaches the startup tab.
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["startup"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/startup', sessionCookieFor(subUserId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.isSubUser).toBe(true)
      expect(data.subUserPermissions).toEqual(['startup'])
    })
  })
})

describe('GET /api/server/:id/databases (Nitro)', () => {
  it('returns databases, hosts and the user db limit/count', async () => {
    const ownerId = insertUser({ email: 'db@x.io', username: 'db', maxDatabases: 3 })
    insertServerFixture(ownerId)
    const hostId = Number(
      db.prepare(`INSERT INTO "DatabaseHost" (name, host, port, username, password) VALUES ('db1', '10.0.0.5', 3306, 'u', 'p')`).run().lastInsertRowid,
    )
    db.prepare(
      `INSERT INTO "ServerDatabase" (serverId, hostId, databaseName, databaseUser, databasePassword)
       VALUES ('srv-abc', ?, 'srv-abc', 'user1', 'pw1')`,
    ).run(hostId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/databases', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.databases).toEqual([
        expect.objectContaining({
          databaseName: 'srv-abc',
          databaseUser: 'user1',
          databasePassword: 'pw1',
          host: { name: 'db1', host: '10.0.0.5', port: 3306 },
        }),
      ])
      expect(data.hosts).toEqual([{ id: hostId, name: 'db1', host: '10.0.0.5', port: 3306 }])
      expect(data.userDbLimit).toBe(3)
      expect(data.userDbCount).toBe(1)
      expect(data.isOwner).toBe(true)
    })
  })

  it('falls back to the default max databases when the owner has no limit', async () => {
    const ownerId = insertUser({ email: 'db2@x.io', username: 'db2', maxDatabases: null })
    insertServerFixture(ownerId)
    db.prepare('UPDATE "settings" SET defaultMaxDatabases = 5 WHERE id = 1').run()

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/databases', sessionCookieFor(ownerId))
      const data = (await getJson(res)) as Record<string, any>
      expect(data.userDbLimit).toBe(5)
    })
  })
})

describe('GET /api/server/:id/schedules (Nitro)', () => {
  it('returns schedules with parsed task payloads', async () => {
    const ownerId = insertUser({ email: 'sch@x.io', username: 'sch' })
    insertServerFixture(ownerId)
    const scheduleId = Number(
      db.prepare(
        `INSERT INTO "Schedule" (serverId, name, cron, enabled, timeOffset) VALUES ('srv-abc', 'Daily', '0 6 * * *', 1, 120)`,
      ).run().lastInsertRowid,
    )
    db.prepare(
      `INSERT INTO "ScheduleTask" (scheduleId, "order", action, payload, timeOffset) VALUES (?, 0, 'command', '{"command":"say hi"}', 0)`,
    ).run(scheduleId)
    db.prepare(
      `INSERT INTO "ScheduleTask" (scheduleId, "order", action, payload, timeOffset) VALUES (?, 1, 'power', '{"action":"restart"}', 0)`,
    ).run(scheduleId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/schedules', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.schedules).toHaveLength(1)
      const schedule = data.schedules[0]
      expect(schedule).toEqual(
        expect.objectContaining({
          name: 'Daily',
          cron: '0 6 * * *',
          enabled: true,
          timeOffset: 120,
        }),
      )
      expect(schedule.tasks).toEqual([
        expect.objectContaining({ action: 'command', payload: { command: 'say hi' } }),
        expect.objectContaining({ action: 'power', payload: { action: 'restart' } }),
      ])
    })
  })

  it('403s a subuser without schedule.read', async () => {
    const ownerId = insertUser({ email: 'sch2@x.io', username: 'sch2' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub4@x.io', username: 'sub4' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["files"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/schedules', sessionCookieFor(subUserId))
      expect(res.status).toBe(403)
    })
  })
})

describe('GET /api/server/:id/backups (Nitro)', () => {
  it('returns backups with string sizes', async () => {
    const ownerId = insertUser({ email: 'bak@x.io', username: 'bak' })
    insertServerFixture(ownerId)
    db.prepare(
      `INSERT INTO "Backup" (UUID, name, serverId, filePath, size, checksum, locked)
       VALUES ('bak-1', 'First backup', 'srv-abc', '/backups/bak-1.tar.gz', 1048576, 'abc123', 0)`,
    ).run()

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/backups', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.backups).toEqual([
        {
          UUID: 'bak-1',
          name: 'First backup',
          size: '1048576',
          checksum: 'abc123',
          locked: false,
          createdAt: expect.any(String),
        },
      ])
    })
  })
})

describe('GET /api/server/:id/subusers (Nitro)', () => {
  it('returns subusers with permissions, labels and groups for the owner', async () => {
    const ownerId = insertUser({ email: 'subo@x.io', username: 'subo' })
    insertServerFixture(ownerId)
    const targetId = insertUser({ email: 'subu@x.io', username: 'subu' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console","files.read"]')`,
    ).run(targetId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/subusers', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.subUsers).toEqual([
        expect.objectContaining({
          permissions: ['console', 'files.read'],
          user: expect.objectContaining({ id: targetId, username: 'subu', email: 'subu@x.io' }),
        }),
      ])
      expect(data.permissionLabels.console).toBe('Full console')
      expect(data.permissionGroups[0].title).toBe('Console control')
      expect(data.isOwner).toBe(true)
      expect(data.isAdmin).toBe(false)
    })
  })

  it('403s a subuser who is not the owner (subusers tab is owner-only)', async () => {
    const ownerId = insertUser({ email: 'subo2@x.io', username: 'subo2' })
    insertServerFixture(ownerId)
    // A subuser passes isAuthenticatedForServer, then the owner-only check
    // in the handler rejects them.
    const subUserId = insertUser({ email: 'subu2@x.io', username: 'subu2' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/subusers', sessionCookieFor(subUserId))
      expect(res.status).toBe(403)
      const data = await getJson(res)
      expect(data).toEqual({
        success: false,
        error: 'Only the server owner can manage subusers.',
      })
    })
  })

  it('redirects a non-owner stranger to /', async () => {
    const ownerId = insertUser({ email: 'subo3@x.io', username: 'subo3' })
    insertServerFixture(ownerId)
    const strangerId = insertUser({ email: 'str@x.io', username: 'str' })

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/subusers', sessionCookieFor(strangerId))
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')
    })
  })
})

describe('GET /api/server/:id/worlds (Nitro)', () => {
  it('returns an empty worlds list with a daemonError when the node is offline', async () => {
    const ownerId = insertUser({ email: 'wrld@x.io', username: 'wrld' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/worlds', sessionCookieFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.worlds).toEqual([])
      expect(data.daemonError).toMatch(/offline|not responding/i)
      expect(data.features).toEqual(['players', 'worlds'])
      expect(data.serverStatus.daemonOffline).toBe(true)
    })
  })

  it('403s a subuser without the files permission', async () => {
    const ownerId = insertUser({ email: 'wrld2@x.io', username: 'wrld2' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub5@x.io', username: 'sub5' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/api/server/srv-abc/worlds', sessionCookieFor(subUserId))
      expect(res.status).toBe(403)
    })
  })
})

afterAll(async () => {
  await auth.nitroPrisma.$disconnect().catch(() => {})
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})
