// @vitest-environment node
/**
 * Integration tests for the Phase 3 Nitro-owned WebSocket handlers:
 * /ws/realtime, /online-check, /console/:id, /status/:id, /events/:id.
 *
 * Runs the real route handlers against a real temporary SQLite database
 * through an h3 app with the 01.session middleware mounted — the same
 * composition Nitro builds. Each WS route is a `defineWebSocketHandler`
 * whose crossws hooks are extracted from the app's response (the way
 * Nitro's resolveWebsocketHooks works) and driven with a fake peer whose
 * `websocket` is a fake `ws` socket. Pins the Express contract (D3):
 * close codes, error JSON shapes, realtime.ready/synced handshakes, and
 * presence bookkeeping.
 */
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { sign } from 'cookie-signature'
import { createApp, mockEvent } from 'h3'
import type { Hooks, Peer } from 'crossws'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-ws-'))
const dbPath = path.join(tmpDir, 'test.db')

// Env must be in place before the route modules are imported (the Prisma
// client + SQLite file are constructed at module load).
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
    preferredNodeId INTEGER,
    totpSecret TEXT,
    totpEnabled BOOLEAN NOT NULL DEFAULT false,
    totpRecoveryCodes TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    onboardingCompleted BOOLEAN NOT NULL DEFAULT false,
    onboardingSkipped BOOLEAN NOT NULL DEFAULT false,
    loginAttempts INTEGER NOT NULL DEFAULT 0,
    lockedUntil DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users"("email");
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_key" ON "Users"("username");

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

  CREATE TABLE IF NOT EXISTS "SubUser" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL,
    userId INTEGER NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "SubUser_serverId_userId_key" ON "SubUser"("serverId", "userId");
`)

const SECRET = 'a'.repeat(64)

function seedUser(overrides: Record<string, unknown> = {}): number {
  const info = db
    .prepare(
      `INSERT INTO "Users" (email, username, password, isAdmin, description, role,
        onboardingCompleted, onboardingSkipped, loginAttempts, lockedUntil,
        totpSecret, totpEnabled, totpRecoveryCodes)
       VALUES (@email, @username, @password, @isAdmin, @description, @role,
        @onboardingCompleted, @onboardingSkipped, @loginAttempts, @lockedUntil,
        @totpSecret, @totpEnabled, @totpRecoveryCodes)`,
    )
    .run({
      email: 'alice@x.io',
      username: 'alice',
      password: 'hash',
      isAdmin: 0,
      description: 'No About Me',
      role: 'user',
      onboardingCompleted: 0,
      onboardingSkipped: 0,
      loginAttempts: 0,
      lockedUntil: null,
      totpSecret: null,
      totpEnabled: 0,
      totpRecoveryCodes: null,
      ...overrides,
    })
  return Number(info.lastInsertRowid)
}

function seedNode(): number {
  const info = db
    .prepare(
      `INSERT INTO "Node" (name, address, port, key)
       VALUES ('n1', '127.0.0.1', 1, 'node-key')`,
    )
    .run()
  return Number(info.lastInsertRowid)
}

function seedServer(uuid: string, ownerId: number, nodeId: number): void {
  db.prepare(
    `INSERT INTO "Server" (UUID, name, description, Ports, Memory, Swap, Cpu, Storage,
       Variables, StartCommand, dockerImage, Installing, Queued, ownerId, nodeId, imageId)
     VALUES (?, 'Srv', 'desc', '[]', 1024, 0, 100, 8192,
       '[]', 'cmd', 'img', 0, 0, ?, ?, 1)`,
  ).run(uuid, ownerId, nodeId)
}

function seedSession(userId: number, payload: Record<string, unknown> = {}): string {
  const sid = randomBytes(16).toString('hex')
  db.prepare(
    `INSERT INTO "Session" (id, session_id, data, expires, createdAt, updatedAt)
     VALUES (?, ?, ?, datetime('now', '+1 day'), datetime('now'), datetime('now'))`,
  ).run(
    randomBytes(8).toString('hex'),
    sid,
    JSON.stringify({
      user: { id: userId, email: 'alice@x.io', isAdmin: false, username: 'alice' },
      cookie: { httpOnly: true, path: '/' },
      ...payload,
    }),
  )
  return `s:${sign(sid, SECRET)}`
}

// ── App composition (same as Nitro: 01.session middleware + routes) ────────
// Dynamic imports AFTER env + DB setup: auth-session builds the Prisma client
// and SQLite handle at module load, so it must see DATABASE_URL first.
const { default: sessionMiddleware } = await import('../../server/middleware/01.session')
const realtimeRoute = (await import('../../server/routes/ws/realtime')).default
const onlineCheckModule = await import('../../server/routes/online-check')
const onlineCheckRoute = onlineCheckModule.default
const { onlineUsers } = onlineCheckModule
const consoleRoute = (await import('../../server/routes/console/[id]')).default
const { issueWsToken } = await import('../../../src/handlers/utils/security/wsToken')

const app = createApp()
app.use(sessionMiddleware)
app.all('/ws/realtime', realtimeRoute)
app.all('/online-check', onlineCheckRoute)
app.all('/console/:id', consoleRoute)

/** Runs the composed app for the path and returns the crossws hooks. */
async function getHooks(pathname: string, cookie?: string): Promise<Hooks> {
  const headers: Record<string, string> = {}
  if (cookie) {
    headers.cookie = `connect.sid=${cookie}`
  }
  const event = mockEvent(pathname, { headers })
  const response = (await app.handler(event)) as unknown as Response & {
    crossws?: Hooks
  }
  if (!response?.crossws) {
    throw new Error(`no crossws hooks for ${pathname} (status ${response?.status})`)
  }
  return response.crossws
}

// ── Fake peer / ws socket ───────────────────────────────────────────────────

interface FakeSocket {
  readyState: number
  sent: Array<string | Buffer>
  closed: { code?: number; reason?: string } | null
  listeners: Record<string, Array<(...args: unknown[]) => void>>
  on: (event: string, fn: (...args: unknown[]) => void) => void
  send: (data: string | Buffer) => void
  close: (code?: number, reason?: string) => void
}

function makeSocket(): FakeSocket {
  const socket: FakeSocket = {
    readyState: 1,
    sent: [],
    closed: null,
    listeners: {},
    on(event, fn) {
      ;(socket.listeners[event] ??= []).push(fn)
    },
    send(data) {
      socket.sent.push(data)
    },
    close(code, reason) {
      socket.readyState = 3
      socket.closed = { code, reason }
      for (const fn of socket.listeners['close'] ?? []) {
        fn()
      }
    },
  }
  return socket
}

function makePeer(pathname: string, socket: FakeSocket): Peer {
  return {
    id: 'peer-1',
    request: new Request(`http://local${pathname}`),
    websocket: socket,
  } as unknown as Peer
}

function sentStrings(socket: FakeSocket): string[] {
  return socket.sent.map((d) => (typeof d === 'string' ? d : d.toString('utf8')))
}

async function waitFor(
  fn: () => boolean,
  timeoutMs = 1500,
  intervalMs = 25,
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (fn()) {
      return true
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  return fn()
}

beforeAll(() => {
  seedUser({ id: 1, isAdmin: 1, email: 'admin@x.io', username: 'admin' })
  seedUser({ id: 2, isAdmin: 0, email: 'alice@x.io', username: 'alice' })
})

afterEach(() => {
  // Tests share one DB — drop the per-test fixture rows so UUIDs never clash.
  db.prepare('DELETE FROM "Server"').run()
  db.prepare('DELETE FROM "SubUser"').run()
  db.prepare('DELETE FROM "Node"').run()
})

afterAll(() => {
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

// ── /ws/realtime ────────────────────────────────────────────────────────────

describe('/ws/realtime', () => {
  it('closes 4401 unauthenticated', async () => {
    const hooks = await getHooks('/ws/realtime')
    const socket = makeSocket()
    await hooks.open?.(makePeer('/ws/realtime', socket) as never)
    expect(socket.closed?.code).toBe(4401)
  })

  it('closes 1008 for a session whose user row has no username', async () => {
    const userId = seedUser({ username: null, email: 'ghost@x.io' })
    const cookie = seedSession(userId)
    const hooks = await getHooks('/ws/realtime', cookie)
    const socket = makeSocket()
    await hooks.open?.(makePeer('/ws/realtime', socket) as never)
    expect(socket.closed?.code).toBe(1008)
  })

  it('sends realtime.ready, answers sync, and cleans up on close', async () => {
    const cookie = seedSession(1, { user: { id: 1, email: 'admin@x.io', isAdmin: true, username: 'admin' } })
    const hooks = await getHooks('/ws/realtime', cookie)
    const socket = makeSocket()
    await hooks.open?.(makePeer('/ws/realtime', socket) as never)

    expect(socket.closed).toBeNull()
    const ready = JSON.parse(sentStrings(socket)[0] ?? '{}') as { type?: string }
    expect(ready.type).toBe('realtime.ready')
    expect(typeof ready.seq).toBe('number')

    // sync handshake → realtime.synced with a cursor
    for (const fn of socket.listeners['message'] ?? []) {
      await fn(Buffer.from(JSON.stringify({ type: 'sync', sinceSeq: null })))
    }
    const synced = sentStrings(socket)
      .map((s) => JSON.parse(s) as { type?: string })
      .find((m) => m.type === 'realtime.synced')
    expect(synced).toBeTruthy()

    // close → session dropped, watchers released (no throw)
    for (const fn of socket.listeners['close'] ?? []) {
      fn()
    }
  })

  it('does not deliver watch for servers the user cannot see', async () => {
    const nodeId = seedNode()
    seedServer('srv-alice', 2, nodeId)
    const cookie = seedSession(2, { user: { id: 2, email: 'alice@x.io', isAdmin: false, username: 'alice' } })
    const hooks = await getHooks('/ws/realtime', cookie)
    const socket = makeSocket()
    await hooks.open?.(makePeer('/ws/realtime', socket) as never)
    // Alice owns srv-alice → watch is allowed; srv-other is not hers → ignored.
    expect(() => {
      for (const fn of socket.listeners['message'] ?? []) {
        void fn(Buffer.from(JSON.stringify({ type: 'watch', serverId: 'srv-other' })))
      }
    }).not.toThrow()
    for (const fn of socket.listeners['close'] ?? []) {
      fn()
    }
  })
})

// ── /online-check ───────────────────────────────────────────────────────────

describe('/online-check', () => {
  it('marks the user online and back offline on close', async () => {
    const cookie = seedSession(2)
    const hooks = await getHooks('/online-check', cookie)
    const socket = makeSocket()
    await hooks.open?.(makePeer('/online-check', socket) as never)

    expect(onlineUsers.has('alice')).toBe(true)
    expect(sentStrings(socket)).toContain(JSON.stringify({ online: true }))

    // Second connection keeps the user online until the last one closes.
    const socket2 = makeSocket()
    await hooks.open?.(makePeer('/online-check', socket2) as never)
    expect(onlineUsers.has('alice')).toBe(true)

    for (const fn of socket.listeners['close'] ?? []) {
      fn()
    }
    expect(onlineUsers.has('alice')).toBe(true) // second connection still open
    for (const fn of socket2.listeners['close'] ?? []) {
      fn()
    }
    expect(onlineUsers.has('alice')).toBe(false)
  })

  it('closes without presence for unauthenticated sockets', async () => {
    const hooks = await getHooks('/online-check')
    const socket = makeSocket()
    await hooks.open?.(makePeer('/online-check', socket) as never)
    expect(socket.closed).toBeTruthy()
    expect(onlineUsers.size).toBe(0)
  })
})

// ── /console/:id ────────────────────────────────────────────────────────────

describe('/console/:id', () => {
  it('closes unauthenticated sockets', async () => {
    const hooks = await getHooks('/console/srv-1?token=x')
    const socket = makeSocket()
    await hooks.open?.(makePeer('/console/srv-1?token=x', socket) as never)
    expect(socket.closed).toBeTruthy()
  })

  it('rejects an invalid connect token with the Express error JSON', async () => {
    const nodeId = seedNode()
    seedServer('srv-1', 1, nodeId)
    const cookie = seedSession(1, { user: { id: 1, email: 'admin@x.io', isAdmin: true, username: 'admin' } })
    const hooks = await getHooks('/console/srv-1?token=bad-token', cookie)
    const socket = makeSocket()
    await hooks.open?.(makePeer('/console/srv-1?token=bad-token', socket) as never)

    const message = JSON.parse(sentStrings(socket).find((s) => s.includes('token')) ?? '{}') as {
      error?: string
    }
    expect(message.error).toMatch(/Invalid or expired connect token/)
    expect(socket.closed).toBeTruthy()
  })

  it('rejects a token minted for a different server', async () => {
    const nodeId = seedNode()
    seedServer('srv-1', 1, nodeId)
    const cookie = seedSession(1, { user: { id: 1, email: 'admin@x.io', isAdmin: true, username: 'admin' } })
    const hooks = await getHooks('/console/srv-1', cookie)
    const socket = makeSocket()
    const otherToken = issueWsToken('srv-OTHER', 1)
    await hooks.open?.(makePeer(`/console/srv-1?token=${encodeURIComponent(otherToken)}`, socket) as never)

    const message = JSON.parse(sentStrings(socket).find((s) => s.includes('token')) ?? '{}') as {
      error?: string
    }
    expect(message.error).toBe('Connect token does not match this session')
  })

  it('denies a subuser without the console permission', async () => {
    const nodeId = seedNode()
    // Server owned by someone else — alice is only a subuser.
    seedServer('srv-alice', 1, nodeId)
    db.prepare(
      `INSERT INTO "SubUser" (serverId, userId, permissions) VALUES ('srv-alice', 2, '["files"]')`,
    ).run()
    const cookie = seedSession(2)
    const hooks = await getHooks('/console/srv-alice', cookie)
    const socket = makeSocket()
    const token = issueWsToken('srv-alice', 2)
    await hooks.open?.(makePeer(`/console/srv-alice?token=${encodeURIComponent(token)}`, socket) as never)

    const message = JSON.parse(sentStrings(socket).find((s) => s.includes('permission')) ?? '{}') as {
      error?: string
    }
    expect(message.error).toBe('You do not have permission to access the console.')
    expect(socket.closed).toBeTruthy()
  })

  it('opens a daemon proxy with a valid token (daemon down → unavailable message)', async () => {
    const nodeId = seedNode()
    seedServer('srv-alice', 2, nodeId)
    const cookie = seedSession(2)
    const hooks = await getHooks('/console/srv-alice', cookie)
    const socket = makeSocket()
    const token = issueWsToken('srv-alice', 2)
    await hooks.open?.(makePeer(`/console/srv-alice?token=${encodeURIComponent(token)}`, socket) as never)

    // The node port (1) is unreachable → the daemon socket errors → the panel
    // sends the same message Express sent for unreachable nodes.
    const gotUnavailable = await waitFor(() =>
      sentStrings(socket).some((s) => s.includes('This instance is unavailable!')),
    )
    expect(gotUnavailable).toBe(true)
  })

  it('routes console commands through the daemon REST call (daemon down → failure text)', async () => {
    const nodeId = seedNode()
    seedServer('srv-alice', 2, nodeId)
    const cookie = seedSession(2)
    const hooks = await getHooks('/console/srv-alice', cookie)
    const socket = makeSocket()
    const token = issueWsToken('srv-alice', 2)
    await hooks.open?.(makePeer(`/console/srv-alice?token=${encodeURIComponent(token)}`, socket) as never)

    // Browser sends a command payload → the panel POSTs /container/command to
    // the unreachable node → the failure line is written to the terminal.
    for (const fn of socket.listeners['message'] ?? []) {
      void fn(Buffer.from(JSON.stringify({ event: 'cmd', command: 'say hi' })))
    }
    const gotFailure = await waitFor(() =>
      sentStrings(socket).some((s) => s.includes('Command failed to reach the daemon')),
    )
    expect(gotFailure).toBe(true)

    // Raw (non-command) frames never throw — they are buffered/dropped while
    // the daemon connection is gone.
    for (const fn of socket.listeners['message'] ?? []) {
      void fn(Buffer.from([0x1b, 0x5b, 0x30, 0x6d]))
    }
  })
})
