// @vitest-environment node
/**
 * Integration tests for the Phase 2 group 3b/3c/3d Nitro-owned /server/:id/*
 * surface: console/power/status/logs/ws-token/players/eula (3b), files
 * (3c), and the tab CRUD mutations (3d).
 *
 * Runs the real handlers against a real temporary SQLite database through an
 * h3 app with the 01.session middleware — the same composition Nitro builds.
 * Daemon-dependent helpers hit a closed port on 127.0.0.1 and deterministically
 * report the node as offline; DB-only mutations (settings, startup, schedules,
 * subusers, backups lock) exercise the full byte-identical contract offline.
 * Mutations send the double-submit CSRF cookie + header minted for the
 * session, exactly like the React layer does.
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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-serverapi-'))
const dbPath = path.join(tmpDir, 'test.db')

// Env must be in place before the route modules are imported (the Prisma
// clients + SQLite files are constructed at module load).
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

  CREATE TABLE IF NOT EXISTS "ActivityLog" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    actorId INTEGER,
    serverId TEXT,
    event TEXT NOT NULL,
    metadata TEXT,
    ip TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO "settings" (id) VALUES (1);
`)

const { default: sessionMiddleware } = await import('../../server/middleware/01.session')
const auth = await import('../../server/utils/auth-session')

// ── 3b: console surface ───────────────────────────────────────────────────
const statusHandler = (await import('../../server/routes/server/[id]/status.get')).default
const wsTokenHandler = (await import('../../server/routes/server/[id]/ws-token.get')).default
const logsHistoryHandler = (await import('../../server/routes/server/[id]/logs/history.get')).default
const playersDataHandler = (await import('../../server/routes/server/[id]/players/data.get')).default
const eulaHandler = (await import('../../server/routes/server/[id]/feature/eula.post')).default
const powerHandler = (await import('../../server/routes/server/[id]/power/[poweraction].post')).default
const queueCancelHandler = (await import('../../server/routes/server/[id]/power/queue/cancel.post')).default

// ── 3c: files surface ─────────────────────────────────────────────────────
const filesListHandler = (await import('../../server/routes/server/[id]/files/list.get')).default
const filesMkdirHandler = (await import('../../server/routes/server/[id]/files/mkdir.post')).default
const filesRmHandler = (await import('../../server/routes/server/[id]/files/rm/[...path].delete')).default

// ── 3d: CRUD mutations ────────────────────────────────────────────────────
const settingsPostHandler = (await import('../../server/routes/server/[id]/settings.post')).default
const startupCommandHandler = (await import('../../server/routes/server/[id]/startup/command.post')).default
const startupVariablesHandler = (await import('../../server/routes/server/[id]/startup/variables.post')).default
const schedulesPostHandler = (await import('../../server/routes/server/[id]/schedules.post')).default
const schedulePatchHandler = (await import('../../server/routes/server/[id]/schedules/[scheduleId].patch')).default
const scheduleDeleteHandler = (await import('../../server/routes/server/[id]/schedules/[scheduleId].delete')).default
const scheduleTasksHandler = (await import('../../server/routes/server/[id]/schedules/[scheduleId]/tasks.post')).default
const scheduleTasksDeleteHandler = (await import('../../server/routes/server/[id]/schedules/[scheduleId]/tasks/[taskId].delete')).default
const subusersPostHandler = (await import('../../server/routes/server/[id]/subusers.post')).default
const subusersPutHandler = (await import('../../server/routes/server/[id]/subusers/[subUserId].put')).default
const subusersDeleteHandler = (await import('../../server/routes/server/[id]/subusers/[subUserId].delete')).default
const databasesPostHandler = (await import('../../server/routes/server/[id]/databases.post')).default
const databaseDeleteHandler = (await import('../../server/routes/server/[id]/databases/[dbId].delete')).default
const databaseRotateHandler = (await import('../../server/routes/server/[id]/databases/[dbId]/rotate-password.post')).default
const backupsCreateHandler = (await import('../../server/routes/server/[id]/backups/create.post')).default
const backupLockHandler = (await import('../../server/routes/server/[id]/backups/[backupId]/lock.patch')).default
const backupDeleteHandler = (await import('../../server/routes/server/[id]/backups/[backupId].delete')).default

// h3's app.all registers a single handler for every method and the FIRST
// match wins, so overlapping paths (PATCH vs DELETE /schedules/:scheduleId,
// PUT vs DELETE /subusers/:subUserId) must be registered method-specifically
// — the same routing the Nitro file-scan produces (.patch.ts vs .delete.ts).
function makeApp(): (req: unknown, res: unknown) => void {
  const app = createApp()
  app.use(sessionMiddleware)
  // 3b
  app.get('/server/:id/status', statusHandler)
  app.get('/server/:id/ws-token', wsTokenHandler)
  app.get('/server/:id/logs/history', logsHistoryHandler)
  app.get('/server/:id/players/data', playersDataHandler)
  app.post('/server/:id/feature/eula', eulaHandler)
  app.post('/server/:id/power/:poweraction', powerHandler)
  app.post('/server/:id/power/queue/cancel', queueCancelHandler)
  // 3c
  app.get('/server/:id/files/list', filesListHandler)
  app.post('/server/:id/files/mkdir', filesMkdirHandler)
  app.delete('/server/:id/files/rm/:path*', filesRmHandler)
  // 3d
  app.post('/server/:id/settings', settingsPostHandler)
  app.post('/server/:id/startup/command', startupCommandHandler)
  app.post('/server/:id/startup/variables', startupVariablesHandler)
  app.post('/server/:id/schedules', schedulesPostHandler)
  app.patch('/server/:id/schedules/:scheduleId', schedulePatchHandler)
  app.delete('/server/:id/schedules/:scheduleId', scheduleDeleteHandler)
  app.post('/server/:id/schedules/:scheduleId/tasks', scheduleTasksHandler)
  app.delete('/server/:id/schedules/:scheduleId/tasks/:taskId', scheduleTasksDeleteHandler)
  app.post('/server/:id/subusers', subusersPostHandler)
  app.put('/server/:id/subusers/:subUserId', subusersPutHandler)
  app.delete('/server/:id/subusers/:subUserId', subusersDeleteHandler)
  app.post('/server/:id/databases', databasesPostHandler)
  app.delete('/server/:id/databases/:dbId', databaseDeleteHandler)
  app.post('/server/:id/databases/:dbId/rotate-password', databaseRotateHandler)
  app.post('/server/:id/backups/create', backupsCreateHandler)
  app.patch('/server/:id/backups/:backupId/lock', backupLockHandler)
  app.delete('/server/:id/backups/:backupId', backupDeleteHandler)
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

/**
 * Inserts a session row for the user AND mints the double-submit CSRF pair
 * for that session (csrfSessionId in the payload + matching cookie/header),
 * exactly like GET /api/auth-config produces for the browser. Returns the
 * full Cookie header value (connect.sid + CSRF cookie) plus the header token.
 */
function sessionFor(userId: number, extra: Record<string, unknown> = {}): {
  cookie: string
  csrfHeader: string
} {
  const sid = randomBytes(16).toString('hex')
  const csrfSessionId = randomBytes(16).toString('hex')
  const data = JSON.stringify({
    user: { id: userId, email: 'u@x.io', isAdmin: false, ...extra },
    csrfSessionId,
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
  const csrfRandom = randomBytes(32).toString('hex')
  const token = auth.csrfTokenValue(SESSION_SECRET, csrfSessionId, csrfRandom)
  const connectSid = `s:${sign(sid, SESSION_SECRET)}`
  return {
    cookie: `connect.sid=${connectSid}; ${auth.getCsrfCookieName()}=${token}`,
    csrfHeader: token,
  }
}

function getJson(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>
}

async function get(
  base: string,
  pathname: string,
  session?: { cookie: string; csrfHeader: string },
): Promise<Response> {
  return fetch(`${base}${pathname}`, {
    redirect: 'manual',
    headers: session ? { cookie: session.cookie } : {},
  })
}

async function mutation(
  base: string,
  method: string,
  pathname: string,
  session: { cookie: string; csrfHeader: string },
  body?: unknown,
): Promise<Response> {
  return fetch(`${base}${pathname}`, {
    method,
    redirect: 'manual',
    headers: {
      cookie: session.cookie,
      'CSRF-Token': session.csrfHeader,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    allowStartupEdit: 0,
    ...overrides,
  }
  db.prepare(
    `INSERT INTO "Server" (UUID, name, description, Ports, Memory, Swap, Cpu, Storage,
       Variables, StartCommand, dockerImage, Installing, Queued, allowStartupEdit, ownerId, nodeId, imageId)
     VALUES (@UUID, @name, @description, @Ports, @Memory, @Swap, @Cpu, @Storage,
       @Variables, @StartCommand, @dockerImage, @Installing, @Queued, @allowStartupEdit, ?, ?, ?)`,
  ).run(row, ownerId, nodeId, imageId)
  return String(row.UUID)
}

afterEach(() => {
  db.exec(
    'DELETE FROM "Server"; DELETE FROM "Node"; DELETE FROM "Images"; DELETE FROM "SubUser"; ' +
      'DELETE FROM "ServerDatabase"; DELETE FROM "DatabaseHost"; DELETE FROM "Schedule"; ' +
      'DELETE FROM "ScheduleTask"; DELETE FROM "Backup"; DELETE FROM "ActivityLog"; ' +
      'DELETE FROM "Session"; DELETE FROM "Users";',
  )
  db.prepare(
    'UPDATE "settings" SET allowUserDeleteServer = 0, defaultMaxDatabases = 0, smtpHost = NULL WHERE id = 1',
  ).run()
})

// ── 3b: console surface ───────────────────────────────────────────────────

describe('GET /server/:id/status (Nitro, 3b)', () => {
  it('returns the daemon-offline server status with a queue state', async () => {
    const ownerId = insertUser({ email: 'st@x.io', username: 'st' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/status', sessionFor(ownerId))
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.daemonOffline).toBe(true)
      expect(typeof data.online).toBe('boolean')
      expect(data.queue).toBeDefined()
    })
  })

  it('redirects to /login when unauthenticated', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/status')
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })
  })

  it('403s a subuser without the console permission', async () => {
    const ownerId = insertUser({ email: 'st2@x.io', username: 'st2' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub1@x.io', username: 'sub1' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["files"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/status', sessionFor(subUserId))
      expect(res.status).toBe(403)
    })
  })
})

describe('GET /server/:id/ws-token (Nitro, 3b)', () => {
  it('issues a ws token for the session user', async () => {
    const ownerId = insertUser({ email: 'ws@x.io', username: 'ws' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/ws-token', sessionFor(ownerId))
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(typeof data.token).toBe('string')
      expect(String(data.token).length).toBeGreaterThan(20)
    })
  })
})

describe('GET /server/:id/logs/history (Nitro, 3b)', () => {
  it('500s with the byte-identical error when the node is offline', async () => {
    const ownerId = insertUser({ email: 'lg@x.io', username: 'lg' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/logs/history', sessionFor(ownerId))
      expect(res.status).toBe(500)
      const data = await getJson(res)
      expect(data).toEqual({ error: 'Failed to fetch server log history' })
    })
  })
})

describe('GET /server/:id/players/data (Nitro, 3b)', () => {
  it('reports no primary port when the fixture has none', async () => {
    const ownerId = insertUser({ email: 'pl@x.io', username: 'pl' })
    insertServerFixture(ownerId, { Ports: '[]' })

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/players/data', sessionFor(ownerId))
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(data.serverInfo).toBeNull()
      expect(data.players).toEqual([])
      expect(data.serverIsOnline).toBe(false)
      expect(data.error).toBe('No primary port found')
    })
  })

  it('reports unreachable when the node is offline and a port exists', async () => {
    const ownerId = insertUser({ email: 'pl2@x.io', username: 'pl2' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/players/data', sessionFor(ownerId))
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(data.error).toBe('unreachable')
      expect(data.serverIsOnline).toBe(false)
      expect(data.players).toEqual([])
    })
  })
})

describe('POST /server/:id/feature/eula (Nitro, 3b)', () => {
  it('rejects a mutation without a valid CSRF pair with 403', async () => {
    const ownerId = insertUser({ email: 'eu@x.io', username: 'eu' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/server/srv-abc/feature/eula`, {
        method: 'POST',
        redirect: 'manual',
        headers: { cookie: session.cookie, 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })
      expect(res.status).toBe(403)
    })
  })

  it('500s with the byte-identical error when the node is offline', async () => {
    const ownerId = insertUser({ email: 'eu2@x.io', username: 'eu2' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/feature/eula', session, {})
      expect(res.status).toBe(500)
      const data = await getJson(res)
      expect(data).toEqual({ error: 'Failed to accept EULA' })
    })
  })
})

describe('POST /server/:id/power/:poweraction (Nitro, 3b)', () => {
  it('stop returns the optimistic stopping state immediately', async () => {
    const ownerId = insertUser({ email: 'pw@x.io', username: 'pw' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/power/stop', session, {})
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Server is stopping...')
      expect(data.status).toEqual({
        online: true,
        starting: false,
        stopping: true,
        uptime: null,
        startedAt: null,
      })
    })
  })

  it('rejects an invalid power action with 400', async () => {
    const ownerId = insertUser({ email: 'pw2@x.io', username: 'pw2' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/power/bogus', session, {})
      expect(res.status).toBe(400)
      const data = await getJson(res)
      expect(data.error).toBe('Invalid power action: bogus')
    })
  })
})

describe('POST /server/:id/power/queue/cancel (Nitro, 3b)', () => {
  it('owner can cancel a queued start (wasQueued false when idle)', async () => {
    const ownerId = insertUser({ email: 'qc@x.io', username: 'qc' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/power/queue/cancel', session, {})
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(data).toEqual({ success: true, wasQueued: false })
    })
  })
})

// ── 3c: files surface ─────────────────────────────────────────────────────

describe('GET /server/:id/files/list (Nitro, 3c)', () => {
  it('500s with the byte-identical error when the node is offline', async () => {
    const ownerId = insertUser({ email: 'fl@x.io', username: 'fl' })
    insertServerFixture(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await get(base, '/server/srv-abc/files/list?path=/', sessionFor(ownerId))
      expect(res.status).toBe(500)
      const data = await getJson(res)
      expect(data.error).toBe('Failed to list files.')
    })
  })
})

describe('POST /server/:id/files/mkdir (Nitro, 3c)', () => {
  it('500s when the node is offline (the daemon owns the fs)', async () => {
    const ownerId = insertUser({ email: 'mk@x.io', username: 'mk' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/files/mkdir', session, {
        path: '/', name: 'newdir',
      })
      // Express wraps daemon failures in a 502 ('Failed to create folder').
      expect(res.status).toBe(502)
    })
  })
})

describe('DELETE /server/:id/files/rm/:path (Nitro, 3c)', () => {
  it('500s when the node is offline (the daemon owns the fs)', async () => {
    const ownerId = insertUser({ email: 'rm@x.io', username: 'rm' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', '/server/srv-abc/files/rm/world/level.dat', session, {})
      expect(res.status).toBe(500)
    })
  })
})

// ── 3d: CRUD mutations (DB-only, run fully offline) ───────────────────────

describe('POST /server/:id/settings (Nitro, 3d)', () => {
  it('updates the server name and description', async () => {
    const ownerId = insertUser({ email: 'se@x.io', username: 'se' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/settings', session, {
        name: 'Renamed', description: 'New desc',
      })
      expect(res.status).toBe(200)
      expect(await getJson(res)).toEqual({ success: true })
      const row = db.prepare(`SELECT name, description FROM "Server" WHERE UUID = 'srv-abc'`).get() as Record<string, unknown>
      expect(row.name).toBe('Renamed')
      expect(row.description).toBe('New desc')
    })
  })

  it('403s a subuser without the settings permission', async () => {
    const ownerId = insertUser({ email: 'se2@x.io', username: 'se2' })
    insertServerFixture(ownerId)
    const subUserId = insertUser({ email: 'sub2@x.io', username: 'sub2' })
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console"]')`,
    ).run(subUserId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/settings', sessionFor(subUserId), {
        name: 'X', description: 'Y',
      })
      expect(res.status).toBe(403)
    })
  })
})

describe('POST /server/:id/startup/command (Nitro, 3d)', () => {
  it('403 JSON when allowStartupEdit is false (React always sends JSON Accept)', async () => {
    const ownerId = insertUser({ email: 'sc@x.io', username: 'sc' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/startup/command', session, {
        startCommand: 'java -Xmx1G -jar server.jar',
      })
      expect(res.status).toBe(403)
      const data = await getJson(res)
      expect(data.error).toBe('Startup command editing not allowed for this server')
    })
  })

  it('persists the command when allowStartupEdit is true', async () => {
    const ownerId = insertUser({ email: 'sc2@x.io', username: 'sc2' })
    insertServerFixture(ownerId, { allowStartupEdit: 1 })
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/startup/command', session, {
        startCommand: 'java -Xmx2G -jar server.jar',
      })
      expect(res.status).toBe(200)
      expect(await getJson(res)).toEqual({ success: true })
      const row = db.prepare(`SELECT StartCommand FROM "Server" WHERE UUID = 'srv-abc'`).get() as Record<string, unknown>
      expect(row.StartCommand).toBe('java -Xmx2G -jar server.jar')
    })
  })
})

describe('POST /server/:id/startup/variables (Nitro, 3d)', () => {
  it('rejects variables that fail the stored egg rules with 400', async () => {
    const ownerId = insertUser({ email: 'sv@x.io', username: 'sv' })
    // Stored rules: numeric between 1 and 4 — a string value must be rejected.
    insertServerFixture(ownerId, {
      Variables: '[{"name":"Rams","env":"RAM","type":"text","value":"1","rules":"numeric|between:1,4"}]',
    })
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/startup/variables', session, {
        variables: [{ name: 'Rams', env: 'RAM', type: 'text', value: '99' }],
      })
      expect(res.status).toBe(400)
      const data = await getJson(res)
      expect(data.error).toBe('Variable validation failed.')
      expect(Array.isArray(data.fields)).toBe(true)
    })
  })

  it('persists a valid variable set', async () => {
    const ownerId = insertUser({ email: 'sv2@x.io', username: 'sv2' })
    insertServerFixture(ownerId, {
      Variables: '[{"name":"Rams","env":"RAM","type":"text","value":"1","rules":"numeric"}]',
    })
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/startup/variables', session, {
        variables: [{ name: 'Rams', env: 'RAM', type: 'text', value: '2' }],
      })
      expect(res.status).toBe(200)
      expect(await getJson(res)).toEqual({ success: true })
    })
  })
})

describe('POST /server/:id/schedules (Nitro, 3d)', () => {
  it('creates a schedule with a valid cron', async () => {
    const ownerId = insertUser({ email: 'sc3@x.io', username: 'sc3' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/schedules', session, {
        name: 'Daily backup', cron: '0 6 * * *', timeOffset: 0,
      })
      expect(res.status).toBe(200)
      const data = (await getJson(res)) as Record<string, any>
      expect(data.success).toBe(true)
      expect(data.schedule.name).toBe('Daily backup')
      expect(data.schedule.enabled).toBe(true)
      expect(typeof data.schedule.nextRunAt).toBe('string')
    })
  })

  it('rejects an invalid cron expression with 400', async () => {
    const ownerId = insertUser({ email: 'sc4@x.io', username: 'sc4' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/schedules', session, {
        name: 'Bad', cron: 'not-a-cron',
      })
      expect(res.status).toBe(400)
      const data = await getJson(res)
      expect(data.error).toBe('Invalid cron expression.')
    })
  })
})

describe('PATCH /server/:id/schedules/:scheduleId (Nitro, 3d)', () => {
  it('toggles a schedule enabled/disabled', async () => {
    const ownerId = insertUser({ email: 'sp@x.io', username: 'sp' })
    insertServerFixture(ownerId)
    const scheduleId = Number(
      db.prepare(
        `INSERT INTO "Schedule" (serverId, name, cron, enabled, timeOffset) VALUES ('srv-abc', 'Daily', '0 6 * * *', 1, 0)`,
      ).run().lastInsertRowid,
    )
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'PATCH', `/server/srv-abc/schedules/${scheduleId}`, session, {
        enabled: false,
      })
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(data.message).toBe('Schedule disabled.')
      const row = db.prepare(`SELECT enabled FROM "Schedule" WHERE id = ?`).get(scheduleId) as Record<string, unknown>
      expect(row.enabled).toBe(0)
    })
  })

  it('404s for a schedule on another server', async () => {
    const ownerId = insertUser({ email: 'sp2@x.io', username: 'sp2' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'PATCH', '/server/srv-abc/schedules/9999', session, {
        enabled: false,
      })
      expect(res.status).toBe(404)
    })
  })
})

describe('DELETE /server/:id/schedules/:scheduleId (Nitro, 3d)', () => {
  it('deletes the schedule row', async () => {
    const ownerId = insertUser({ email: 'sd@x.io', username: 'sd' })
    insertServerFixture(ownerId)
    const scheduleId = Number(
      db.prepare(
        `INSERT INTO "Schedule" (serverId, name, cron, enabled, timeOffset) VALUES ('srv-abc', 'Daily', '0 6 * * *', 0, 0)`,
      ).run().lastInsertRowid,
    )
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', `/server/srv-abc/schedules/${scheduleId}`, session, {})
      expect(res.status).toBe(200)
      const row = db.prepare(`SELECT id FROM "Schedule" WHERE id = ?`).get(scheduleId)
      expect(row).toBeUndefined()
    })
  })
})

describe('POST /server/:id/schedules/:scheduleId/tasks (Nitro, 3d)', () => {
  it('adds a task to a schedule', async () => {
    const ownerId = insertUser({ email: 'st4@x.io', username: 'st4' })
    insertServerFixture(ownerId)
    const scheduleId = Number(
      db.prepare(
        `INSERT INTO "Schedule" (serverId, name, cron, enabled, timeOffset) VALUES ('srv-abc', 'Daily', '0 6 * * *', 0, 0)`,
      ).run().lastInsertRowid,
    )
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', `/server/srv-abc/schedules/${scheduleId}/tasks`, session, {
        action: 'command',
        payload: { command: 'say hi' },
        timeOffset: 0,
      })
      expect(res.status).toBe(200)
      const row = db.prepare(`SELECT action, payload FROM "ScheduleTask" WHERE scheduleId = ?`).get(scheduleId) as Record<string, unknown>
      expect(row.action).toBe('command')
      expect(row.payload).toBe('{"command":"say hi"}')
    })
  })
})

describe('DELETE /server/:id/schedules/:scheduleId/tasks/:taskId (Nitro, 3d)', () => {
  it('removes the task', async () => {
    const ownerId = insertUser({ email: 'st5@x.io', username: 'st5' })
    insertServerFixture(ownerId)
    const scheduleId = Number(
      db.prepare(
        `INSERT INTO "Schedule" (serverId, name, cron, enabled, timeOffset) VALUES ('srv-abc', 'Daily', '0 6 * * *', 0, 0)`,
      ).run().lastInsertRowid,
    )
    const taskId = Number(
      db.prepare(
        `INSERT INTO "ScheduleTask" (scheduleId, "order", action, payload, timeOffset) VALUES (?, 0, 'command', '{"command":"say hi"}', 0)`,
      ).run(scheduleId).lastInsertRowid,
    )
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', `/server/srv-abc/schedules/${scheduleId}/tasks/${taskId}`, session, {})
      expect(res.status).toBe(200)
      const row = db.prepare(`SELECT id FROM "ScheduleTask" WHERE id = ?`).get(taskId)
      expect(row).toBeUndefined()
    })
  })
})

describe('POST /server/:id/subusers (Nitro, 3d)', () => {
  it('adds a subuser by email with validated permissions', async () => {
    const ownerId = insertUser({ email: 'su@x.io', username: 'su' })
    insertServerFixture(ownerId)
    const targetId = insertUser({ email: 'sub@x.io', username: 'sub' })
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/subusers', session, {
        email: 'sub@x.io',
        permissions: ['console', 'files'],
      })
      expect(res.status).toBe(200)
      const row = db.prepare(`SELECT userId, permissions FROM "SubUser" WHERE serverId = 'srv-abc'`).get() as Record<string, unknown>
      expect(row.userId).toBe(targetId)
      expect(row.permissions).toBe('["console","files"]')
    })
  })

  it('rejects a non-owner with 403 (admins who do not own the server too)', async () => {
    const ownerId = insertUser({ email: 'su2@x.io', username: 'su2' })
    insertServerFixture(ownerId)
    const adminId = insertUser({ email: 'admin@x.io', username: 'admin', isAdmin: 1, role: 'owner' })
    const targetId = insertUser({ email: 'sub2@x.io', username: 'sub2' })
    const session = sessionFor(adminId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/subusers', session, {
        email: 'sub2@x.io',
        permissions: ['console'],
      })
      expect(res.status).toBe(403)
      const data = await getJson(res)
      expect(data.error).toBe('Only the server owner can manage subusers.')
      const row = db.prepare(`SELECT id FROM "SubUser" WHERE serverId = 'srv-abc' AND userId = ?`).get(targetId)
      expect(row).toBeUndefined()
    })
  })

  it('400s for a missing email', async () => {
    const ownerId = insertUser({ email: 'su3@x.io', username: 'su3' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/subusers', session, {
        permissions: ['console'],
      })
      expect(res.status).toBe(400)
      expect((await getJson(res)).error).toBe('Email is required')
    })
  })
})

describe('PUT /server/:id/subusers/:subUserId (Nitro, 3d)', () => {
  it('updates a subuser permission set', async () => {
    const ownerId = insertUser({ email: 'su4@x.io', username: 'su4' })
    insertServerFixture(ownerId)
    const targetId = insertUser({ email: 'sub4@x.io', username: 'sub4' })
    const subUserId = Number(
      db.prepare(
        `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console"]')`,
      ).run(targetId).lastInsertRowid,
    )
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'PUT', `/server/srv-abc/subusers/${subUserId}`, session, {
        permissions: ['console', 'files'],
      })
      expect(res.status).toBe(200)
      const row = db.prepare(`SELECT permissions FROM "SubUser" WHERE id = ?`).get(subUserId) as Record<string, unknown>
      expect(row.permissions).toBe('["console","files"]')
    })
  })
})

describe('DELETE /server/:id/subusers/:subUserId (Nitro, 3d)', () => {
  it('removes the subuser', async () => {
    const ownerId = insertUser({ email: 'su5@x.io', username: 'su5' })
    insertServerFixture(ownerId)
    const targetId = insertUser({ email: 'sub5@x.io', username: 'sub5' })
    const subUserId = Number(
      db.prepare(
        `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-abc', ?, '["console"]')`,
      ).run(targetId).lastInsertRowid,
    )
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', `/server/srv-abc/subusers/${subUserId}`, session, {})
      expect(res.status).toBe(200)
      const row = db.prepare(`SELECT id FROM "SubUser" WHERE id = ?`).get(subUserId)
      expect(row).toBeUndefined()
    })
  })
})

describe('POST /server/:id/databases (Nitro, 3d)', () => {
  it('400s for an invalid database host before any daemon work', async () => {
    const ownerId = insertUser({ email: 'db@x.io', username: 'db', maxDatabases: 5 })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/databases', session, {
        hostId: '999',
      })
      expect(res.status).toBe(400)
      expect((await getJson(res)).error).toBe('Invalid database host.')
    })
  })
})

describe('DELETE /server/:id/databases/:dbId (Nitro, 3d)', () => {
  it('404s for a database that does not exist', async () => {
    const ownerId = insertUser({ email: 'db2@x.io', username: 'db2' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', '/server/srv-abc/databases/9999', session, {})
      expect(res.status).toBe(404)
    })
  })
})

describe('POST /server/:id/databases/:dbId/rotate-password (Nitro, 3d)', () => {
  it('404s for a database that does not exist', async () => {
    const ownerId = insertUser({ email: 'db3@x.io', username: 'db3' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/databases/9999/rotate-password', session, {})
      expect(res.status).toBe(404)
    })
  })
})

describe('POST /server/:id/backups/create (Nitro, 3d)', () => {
  it('400s for an empty backup name', async () => {
    const ownerId = insertUser({ email: 'bc@x.io', username: 'bc' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/backups/create', session, { name: '  ' })
      expect(res.status).toBe(400)
      expect((await getJson(res)).error).toBe('Backup name is required')
    })
  })

  it('500s with the byte-identical error when the node is offline', async () => {
    const ownerId = insertUser({ email: 'bc2@x.io', username: 'bc2' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'POST', '/server/srv-abc/backups/create', session, { name: 'Daily' })
      expect(res.status).toBe(500)
      const data = await getJson(res)
      // An offline node makes daemonRequest THROW, landing in the catch which
      // mirrors Express's safeClientMessage(error, 'Failed to create backup').
      expect(data.error).toBe('Failed to create backup')
    })
  })
})

describe('PATCH /server/:id/backups/:backupId/lock (Nitro, 3d)', () => {
  it('locks and unlocks a backup (DB-only, offline-safe)', async () => {
    const ownerId = insertUser({ email: 'bl@x.io', username: 'bl' })
    insertServerFixture(ownerId)
    db.prepare(
      `INSERT INTO "Backup" (UUID, name, serverId, filePath, size, locked)
       VALUES ('bak-1', 'First', 'srv-abc', '/b/bak-1.tar.gz', 100, 0)`,
    ).run()
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'PATCH', '/server/srv-abc/backups/bak-1/lock', session, { locked: true })
      expect(res.status).toBe(200)
      expect(await getJson(res)).toEqual({ success: true, locked: true })

      const res2 = await mutation(base, 'PATCH', '/server/srv-abc/backups/bak-1/lock', session, { locked: false })
      expect(res2.status).toBe(200)
      expect(await getJson(res2)).toEqual({ success: true, locked: false })
    })
  })
})

describe('DELETE /server/:id/backups/:backupId (Nitro, 3d)', () => {
  it('403s for a locked backup before any daemon work', async () => {
    const ownerId = insertUser({ email: 'bd@x.io', username: 'bd' })
    insertServerFixture(ownerId)
    db.prepare(
      `INSERT INTO "Backup" (UUID, name, serverId, filePath, size, locked)
       VALUES ('bak-2', 'Locked', 'srv-abc', '/b/bak-2.tar.gz', 100, 1)`,
    ).run()
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', '/server/srv-abc/backups/bak-2', session, {})
      expect(res.status).toBe(403)
      expect((await getJson(res)).error).toBe('This backup is locked. Unlock it before deleting.')
    })
  })

  it('404s for a backup that does not exist', async () => {
    const ownerId = insertUser({ email: 'bd2@x.io', username: 'bd2' })
    insertServerFixture(ownerId)
    const session = sessionFor(ownerId)

    await withServer(makeApp(), async (base) => {
      const res = await mutation(base, 'DELETE', '/server/srv-abc/backups/nope', session, {})
      expect(res.status).toBe(404)
    })
  })
})

afterAll(async () => {
  await auth.nitroPrisma.$disconnect().catch(() => {})
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})
