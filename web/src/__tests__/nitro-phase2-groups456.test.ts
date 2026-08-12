// @vitest-environment node
/**
 * Integration tests for the Phase 2 Nitro-owned group 4/5/6 routes:
 *   group 4 (admin): POST /admin/mounts (admin gate + audit)
 *   group 5 (external API): GET /api/v1/ping, GET /api/v1/users (Bearer key)
 *   group 6 (user): POST /my-images/create, GET /api/my-images/:id,
 *   DELETE /my-images/:id, POST /upload-avatar, POST /remove-avatar
 *
 * Runs the real handlers against a real temporary SQLite database through an
 * h3 app with the 01.session middleware — the same composition Nitro builds.
 * Pins the Express contract (D3): status codes, error JSON shapes, owner-only
 * guards, admin gates, API-key permission checks and audit rows.
 */
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest'
import { createServer } from 'node:http'
import { randomBytes, createHash, createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createApp } from 'h3'
import { toNodeListener } from 'h3/node'
import { sign } from 'cookie-signature'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-g456-'))
const dbPath = path.join(tmpDir, 'test.db')

// Env must be in place before the route modules are imported (the Prisma
// clients + SQLite files are constructed at module load).
process.env.DATABASE_URL = `file:${dbPath}`
process.env.SESSION_SECRET = 'a'.repeat(64)
process.env.NODE_ENV = 'test'
process.env.URL = 'http://localhost'
process.env.APP_INTERNAL_PORT = '0'
process.env.PANEL_INTERNAL_PORT = '0'

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
    Ports TEXT NOT NULL DEFAULT '[]',
    Memory INTEGER NOT NULL DEFAULT 0,
    Swap INTEGER NOT NULL DEFAULT 0,
    Cpu INTEGER NOT NULL DEFAULT 0,
    Storage INTEGER NOT NULL DEFAULT 0,
    ownerId INTEGER NOT NULL,
    nodeId INTEGER NOT NULL,
    imageId INTEGER,
    backupLimit INTEGER NOT NULL DEFAULT 5,
    databaseLimit INTEGER NOT NULL DEFAULT 5,
    Variables TEXT DEFAULT '[]',
    StartCommand TEXT,
    dockerImage TEXT,
    installed INTEGER NOT NULL DEFAULT 0
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Server_UUID_key" ON "Server"("UUID");

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

  CREATE TABLE IF NOT EXISTS "Mount" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    source TEXT NOT NULL,
    target TEXT NOT NULL,
    readOnly BOOLEAN NOT NULL DEFAULT false,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "ApiKey" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    key TEXT NOT NULL,
    description TEXT,
    permissions TEXT NOT NULL DEFAULT '[]',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN NOT NULL DEFAULT true,
    userId INTEGER
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_key_key" ON "ApiKey"("key");

  CREATE TABLE IF NOT EXISTS "ActivityLog" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    actorId INTEGER,
    serverId TEXT,
    event TEXT NOT NULL,
    metadata TEXT,
    ip TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  INSERT INTO "settings" (id, allowUserCreateImages) VALUES (1, 1);
`)

const { default: sessionMiddleware } = await import('../../server/middleware/01.session')
const mountsHandler = (await import('../../server/routes/admin/mounts.post')).default
const v1PingHandler = (await import('../../server/routes/api/v1/ping.get')).default
const v1UsersHandler = (await import('../../server/routes/api/v1/users.get')).default
const myImagesCreateHandler = (await import('../../server/routes/my-images/create.post')).default
const myImagesGetHandler = (await import('../../server/routes/api/my-images/[id].get')).default
const myImagesDeleteHandler = (await import('../../server/routes/my-images/[id].delete')).default
const uploadAvatarHandler = (await import('../../server/routes/upload-avatar.post')).default
const removeAvatarHandler = (await import('../../server/routes/remove-avatar.post')).default

function makeApp(): (req: unknown, res: unknown) => void {
  const app = createApp()
  app.use(sessionMiddleware)
  app.all('/admin/mounts', mountsHandler)
  app.all('/api/v1/ping', v1PingHandler)
  app.all('/api/v1/users', v1UsersHandler)
  app.all('/my-images/create', myImagesCreateHandler)
  app.all('/api/my-images/:id', myImagesGetHandler)
  app.all('/my-images/:id', myImagesDeleteHandler)
  app.all('/upload-avatar', uploadAvatarHandler)
  app.all('/remove-avatar', removeAvatarHandler)
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

const bcrypt = await import('bcryptjs')
const SESSION_SECRET = 'a'.repeat(64)

function insertUser(overrides: Record<string, unknown> = {}): number {
  const row = {
    email: `u${randomBytes(4).toString('hex')}@x.io`,
    username: `u${randomBytes(4).toString('hex')}`,
    password: bcrypt.hashSync('password123', 4),
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

/**
 * Creates a session row (with a stable csrfSessionId) and returns the signed
 * connect.sid cookie plus a CSRF token valid against that session. CSRF
 * validation requires the token in the `psifi.x-csrf-token` cookie AND the
 * request header — both sent by the frontend.
 */
function csrfBundle(
  userId: number,
  extra: Record<string, unknown> = {},
): { cookie: string; token: string } {
  const sid = randomBytes(16).toString('hex')
  const csrfSessionId = randomBytes(16).toString('hex')
  const randomValue = randomBytes(32).toString('hex')
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
  const message = [
    csrfSessionId.length,
    csrfSessionId,
    randomValue.length,
    randomValue,
  ].join('!')
  const token = `${createHmac('sha256', SESSION_SECRET).update(message).digest('hex')}.${randomValue}`
  return { cookie: `s:${sign(sid, SESSION_SECRET)}`, token }
}

async function request(
  base: string,
  pathname: string,
  opts: {
    method?: string
    cookie?: string
    csrf?: string
    json?: unknown
    form?: FormData
    body?: BodyInit
    headers?: Record<string, string>
  } = {},
): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers ?? {}) }
  const cookies: string[] = []
  if (opts.cookie) cookies.push(`connect.sid=${opts.cookie}`)
  if (opts.csrf) {
    cookies.push(`psifi.x-csrf-token=${opts.csrf}`)
    headers['CSRF-Token'] = opts.csrf
  }
  if (cookies.length) headers['cookie'] = cookies.join('; ')
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['content-type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form
  } else if (opts.body !== undefined) {
    body = opts.body
  }
  return fetch(`${base}${pathname}`, {
    method: opts.method ?? 'GET',
    redirect: 'manual',
    headers,
    body,
  })
}

async function getJson(res: Response): Promise<Record<string, unknown>> {
  return res.json() as Promise<Record<string, unknown>>
}

afterEach(() => {
  db.prepare(`DELETE FROM "Mount"`).run()
  db.prepare(`DELETE FROM "Images"`).run()
  db.prepare(`DELETE FROM "Server"`).run()
  db.prepare(`DELETE FROM "ActivityLog"`).run()
  db.prepare(`UPDATE "settings" SET allowUserCreateImages = 1`).run()
})

afterAll(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── Group 5: external API ──────────────────────────────────────────────────

describe('group 5: /api/v1', () => {
  it('GET /api/v1/ping returns pong with API version info (no auth)', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/api/v1/ping')
      expect(res.status).toBe(200)
      const body = await getJson(res)
      expect(body).toHaveProperty('status', 'ok')
      expect(typeof body.timestamp).toBe('string')
    })
  })

  it('GET /api/v1/users rejects missing Bearer key', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/api/v1/users')
      expect(res.status).toBe(401)
      const body = await getJson(res)
      expect(body.error).toContain('Unauthorized')
    })
  })

  it('GET /api/v1/users rejects a key without the users.read permission', async () => {
    const keyName = `k-${randomBytes(4).toString('hex')}`
    const keyValue = `arclight_${randomBytes(24).toString('hex')}`
    db.prepare(
      `INSERT INTO "ApiKey" (name, key, permissions) VALUES (?, ?, ?)`,
    ).run(keyName, keyValue, '["arclight.api.servers.read"]')

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/api/v1/users', {
        headers: { authorization: `Bearer ${keyValue}` },
      })
      expect(res.status).toBe(403)
      const body = await getJson(res)
      expect(body.error).toContain('Forbidden')
    })
  })

  it('GET /api/v1/users returns the user list with a valid key', async () => {
    insertUser({ username: 'alice', email: 'alice@x.io' })
    insertUser({ username: 'bob', email: 'bob@x.io' })
    const keyValue = `arclight_${randomBytes(24).toString('hex')}`
    db.prepare(
      `INSERT INTO "ApiKey" (name, key, permissions) VALUES (?, ?, ?)`,
    ).run('full', keyValue, '["arclight.api.users.read"]')

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/api/v1/users', {
        headers: { authorization: `Bearer ${keyValue}` },
      })
      expect(res.status).toBe(200)
      const body = await getJson(res)
      const data = body.data as { username: string }[]
      expect(data.some((u) => u.username === 'alice')).toBe(true)
      expect(data.some((u) => u.username === 'bob')).toBe(true)
    })
  })
})

// ── Group 4: admin ─────────────────────────────────────────────────────────

describe('group 4: POST /admin/mounts', () => {
  it('403 for a non-admin session', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)
    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/admin/mounts', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: { name: 'cache', source: '/data/cache', target: '/var/cache' },
      })
      expect(res.status).toBe(403)
    })
  })

  it('creates a mount for an admin session and writes an audit row', async () => {
    const userId = insertUser({ isAdmin: 1 })
    const sess = csrfBundle(userId, { isAdmin: true })

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/admin/mounts', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: { name: 'cache', source: '/data/cache', target: '/var/cache' },
      })
      expect(res.status).toBe(200)
      const body = await getJson(res)
      expect(body.success).toBe(true)

      const mount = db
        .prepare(`SELECT * FROM "Mount" WHERE name = 'cache'`)
        .get() as { source: string; target: string }
      expect(mount.source).toBe('/data/cache')
      expect(mount.target).toBe('/var/cache')

      const audit = db
        .prepare(`SELECT * FROM "ActivityLog" WHERE event = 'mount:create'`)
        .get() as { actorId: number } | undefined
      expect(audit).toBeDefined()
      expect(audit.actorId).toBe(userId)
    })
  })

  it('rejects a mount without a source path', async () => {
    const userId = insertUser({ isAdmin: 1 })
    const sess = csrfBundle(userId, { isAdmin: true })

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/admin/mounts', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: { name: 'cache', target: '/var/cache' },
      })
      expect(res.status).toBe(400)
      const body = await getJson(res)
      expect(body.error).toContain('source path')
    })
  })
})

// ── Group 6: my-images + avatar ────────────────────────────────────────────

describe('group 6: my-images', () => {
  it('POST /my-images/create submits a pending image for an allowed user', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/my-images/create', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: {
          name: 'Paper MC',
          startup: 'java -jar server.jar',
          description: 'Minecraft server',
          author: 'me',
          authorName: 'Me',
          dockerImages: [{ 'ghcr.io/paper': 'latest' }],
          variables: [],
        },
      })
      expect(res.status).toBe(200)
      const body = await getJson(res)
      expect(body.success).toBe(true)

      const image = db
        .prepare(`SELECT * FROM "Images" WHERE name = 'Paper MC'`)
        .get() as { status: string; createdById: number }
      expect(image.status).toBe('pending')
      expect(image.createdById).toBe(userId)

      const audit = db
        .prepare(`SELECT * FROM "ActivityLog" WHERE event = 'image:submit'`)
        .get() as { actorId: number } | undefined
      expect(audit).toBeDefined()
      expect(audit.actorId).toBe(userId)
    })
  })

  it('POST /my-images/create blocks when submissions are disabled', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)
    db.prepare(`UPDATE "settings" SET allowUserCreateImages = 0`).run()

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/my-images/create', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: { name: 'X', startup: 'echo hi' },
      })
      expect(res.status).toBe(403)
      const body = await getJson(res)
      expect(body.error).toContain('not enabled')
    })
  })

  it('POST /my-images/create rejects a duplicate name with 409', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)

    await withServer(makeApp(), async (base) => {
      const payload = {
        name: 'Dup',
        startup: 'echo hi',
        dockerImages: [{ 'ghcr.io/dup': 'latest' }],
      }
      const first = await request(base, '/my-images/create', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: payload,
      })
      expect(first.status).toBe(200)

      const second = await request(base, '/my-images/create', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: payload,
      })
      expect(second.status).toBe(409)
    })
  })

  it('GET /api/my-images/:id returns the parsed image payload for its owner', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)
    const info = db
      .prepare(
        `INSERT INTO "Images" (UUID, name, startup, dockerImages, variables, status, createdById)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      )
      .run('uuid-1', 'MyImage', 'run', JSON.stringify([{ img: 'x' }]), JSON.stringify([{ name: 'A' }]), userId)
    const imageId = Number(info.lastInsertRowid)

    await withServer(makeApp(), async (base) => {
      const res = await request(base, `/api/my-images/${imageId}`, { cookie: sess.cookie })
      expect(res.status).toBe(200)
      const body = await getJson(res)
      const image = body.image as { name: string; dockerImages: unknown; variables: unknown }
      expect(image.name).toBe('MyImage')
      expect(Array.isArray(image.dockerImages)).toBe(true)
      expect(Array.isArray(image.variables)).toBe(true)
    })
  })

  it('GET /api/my-images/:id 403s for an image owned by someone else', async () => {
    const owner = insertUser()
    const stranger = insertUser()
    const info = db
      .prepare(
        `INSERT INTO "Images" (UUID, name, startup, status, createdById)
         VALUES (?, ?, 'run', 'pending', ?)`,
      )
      .run('uuid-2', 'Private', owner)
    const imageId = Number(info.lastInsertRowid)

    const sess = csrfBundle(stranger)
    await withServer(makeApp(), async (base) => {
      const res = await request(base, `/api/my-images/${imageId}`, { cookie: sess.cookie })
      expect(res.status).toBe(403)
    })
  })

  it('DELETE /my-images/:id blocks deletion of an in-use image', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)
    const info = db
      .prepare(
        `INSERT INTO "Images" (UUID, name, startup, status, createdById)
         VALUES (?, ?, 'run', 'pending', ?)`,
      )
      .run('uuid-3', 'InUse', userId)
    const imageId = Number(info.lastInsertRowid)
    db.prepare(
      `INSERT INTO "Server" (UUID, name, Ports, ownerId, nodeId, imageId)
       VALUES (?, 's1', '[]', ?, ?, ?)`,
    ).run('server-1', userId, 1, imageId)

    await withServer(makeApp(), async (base) => {
      const res = await request(base, `/my-images/${imageId}`, {
        method: 'DELETE',
        cookie: sess.cookie,
        csrf: sess.token,
        json: {},
      })
      expect(res.status).toBe(400)
      const body = await getJson(res)
      expect(body.error).toContain('in use')
    })
  })

  it('DELETE /my-images/:id deletes an unused owned image', async () => {
    const userId = insertUser()
    const sess = csrfBundle(userId)
    const info = db
      .prepare(
        `INSERT INTO "Images" (UUID, name, startup, status, createdById)
         VALUES (?, ?, 'run', 'pending', ?)`,
      )
      .run('uuid-4', 'Free', userId)
    const imageId = Number(info.lastInsertRowid)

    await withServer(makeApp(), async (base) => {
      const res = await request(base, `/my-images/${imageId}`, {
        method: 'DELETE',
        cookie: sess.cookie,
        csrf: sess.token,
        json: {},
      })
      expect(res.status).toBe(200)
      const row = db
        .prepare(`SELECT * FROM "Images" WHERE id = ?`)
        .get(imageId)
      expect(row).toBeUndefined()
    })
  })
})

describe('group 6: avatar', () => {
  it('POST /upload-avatar rejects a non-image file', async () => {
    const userId = insertUser({ username: 'eviluser' })
    const sess = csrfBundle(userId, { username: 'eviluser' })
    const boundary = '----arclight-test-boundary'
    const body = Buffer.from(
      `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="avatar"; filename="evil.html"\r\n` +
        `Content-Type: text/html\r\n\r\n` +
        `<script>alert(1)</script>\r\n` +
        `--${boundary}--\r\n`,
    )

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/upload-avatar', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      })
      expect(res.status).toBe(400)
    })
  })

  it('POST /upload-avatar updates the avatar for a valid PNG', async () => {
    const userId = insertUser({ username: 'avataruser' })
    const sess = csrfBundle(userId, { username: 'avataruser' })
    const boundary = '----arclight-test-boundary'

    // PNG magic bytes + payload — the same shape the imageSecurity tests use.
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('idat'),
    ])
    const body = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="avatar"; filename="avatar.png"\r\n` +
          `Content-Type: image/png\r\n\r\n`,
      ),
      png,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/upload-avatar', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
        body,
      })
      if (res.status !== 200) {
        console.error('UPLOAD FAIL BODY:', await res.text())
      }
      expect(res.status).toBe(200)
      const data = await getJson(res)
      expect(typeof data.avatar).toBe('string')
      expect((data.avatar as string).startsWith('/uploads/avatars/avataruser/')).toBe(true)

      const user = db.prepare(`SELECT avatar FROM "Users" WHERE id = ?`).get(userId) as {
        avatar: string | null
      }
      expect(user.avatar).toBe(data.avatar)
    })
  })

  it('POST /remove-avatar clears the stored avatar path', async () => {
    const userId = insertUser({ username: 'rmuser' })
    const sess = csrfBundle(userId, { username: 'rmuser' })
    db.prepare(`UPDATE "Users" SET avatar = '/uploads/avatars/x/a.png' WHERE id = ?`).run(userId)

    await withServer(makeApp(), async (base) => {
      const res = await request(base, '/remove-avatar', {
        method: 'POST',
        cookie: sess.cookie,
        csrf: sess.token,
        json: {},
      })
      expect(res.status).toBe(200)
      const user = db.prepare(`SELECT avatar FROM "Users" WHERE id = ?`).get(userId) as {
        avatar: string | null
      }
      expect(user.avatar).toBeNull()
    })
  })
})
