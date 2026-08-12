/**
 * Phase 3 smoke: WebSockets now owned by Nitro.
 *
 * Boots the PRODUCTION launcher (web/server/index.mjs) — Express is
 * intentionally NOT running — so every WS upgrade flows through the launcher's
 * upgrade seam into the Nitro child (crossws, features.websocket). Real `ws`
 * clients verify:
 *   - /ws/realtime   : realtime.ready + sync handshake with a session cookie,
 *                      close 4401 without one
 *   - /online-check  : { online: true } presence
 *   - /console/:id   : bad token → Express error JSON; valid token → daemon
 *                      unreachable message (node port 1 refused)
 *
 * Run: node web/arclight-smoke-phase3.mjs   (from the repo root)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { randomBytes } from 'node:crypto'
import net from 'node:net'
import path from 'node:path'
import Database from 'better-sqlite3'
import { sign } from 'cookie-signature'
import { WebSocket } from 'ws'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-smoke-phase3-'))
const dbPath = path.join(tmpDir, 'smoke.db')
const SECRET = 's'.repeat(64)

// Pick a free port so a stale process can never block the smoke.
function freePort() {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}
const PORT = await freePort()

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
    email TEXT NOT NULL, username TEXT, password TEXT NOT NULL,
    isAdmin BOOLEAN NOT NULL DEFAULT false, description TEXT DEFAULT 'No About Me',
    avatar TEXT, permissions TEXT DEFAULT '[]',
    serverLimit INTEGER DEFAULT 0, maxMemory INTEGER DEFAULT 0, maxCpu INTEGER DEFAULT 0,
    maxStorage INTEGER DEFAULT 0, maxDatabases INTEGER DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user', onboardingCompleted BOOLEAN NOT NULL DEFAULT false,
    onboardingSkipped BOOLEAN NOT NULL DEFAULT false, preferredNodeId INTEGER,
    loginAttempts INTEGER NOT NULL DEFAULT 0, lockedUntil DATETIME,
    totpSecret TEXT, totpEnabled BOOLEAN NOT NULL DEFAULT false, totpRecoveryCodes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users"("email");
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_key" ON "Users"("username");

  CREATE TABLE IF NOT EXISTS "settings" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Arclight', description TEXT NOT NULL DEFAULT '',
    logo TEXT NOT NULL DEFAULT '', favicon TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'default', lightTheme TEXT NOT NULL DEFAULT 'default',
    darkTheme TEXT NOT NULL DEFAULT 'default', language TEXT NOT NULL DEFAULT 'en',
    allowRegistration BOOLEAN NOT NULL DEFAULT false, uploadLimit INTEGER NOT NULL DEFAULT 100,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sftpPort INTEGER NOT NULL DEFAULT 3003, virusTotalApiKey TEXT,
    rateLimitEnabled BOOLEAN NOT NULL DEFAULT true, rateLimitRpm INTEGER NOT NULL DEFAULT 100,
    bannedIps TEXT NOT NULL DEFAULT '[]',
    allowUserCreateServer BOOLEAN NOT NULL DEFAULT false,
    allowUserDeleteServer BOOLEAN NOT NULL DEFAULT false,
    defaultServerLimit INTEGER NOT NULL DEFAULT 0, defaultMaxMemory INTEGER NOT NULL DEFAULT 512,
    defaultMaxCpu INTEGER NOT NULL DEFAULT 100, defaultMaxStorage INTEGER NOT NULL DEFAULT 5120,
    defaultMaxDatabases INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateMemory INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateDisk INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateCpu INTEGER NOT NULL DEFAULT 0,
    loginWallpaper TEXT, registerWallpaper TEXT, panelWallpaper TEXT,
    loginMaxAttempts INTEGER NOT NULL DEFAULT 5, loginLockoutMinutes INTEGER NOT NULL DEFAULT 15,
    enforceDaemonHttps BOOLEAN NOT NULL DEFAULT false,
    require2faForAdmins BOOLEAN NOT NULL DEFAULT false,
    behindReverseProxy BOOLEAN NOT NULL DEFAULT false,
    hashApiKeys BOOLEAN NOT NULL DEFAULT false,
    arclightCloudApiKey TEXT, arclightCloudBackupEnabled BOOLEAN NOT NULL DEFAULT false,
    smtpHost TEXT, smtpPort INTEGER DEFAULT 587, smtpUser TEXT, smtpPassword TEXT,
    smtpFrom TEXT, smtpSecure BOOLEAN NOT NULL DEFAULT false,
    s3Enabled BOOLEAN NOT NULL DEFAULT false, s3Endpoint TEXT, s3Region TEXT, s3Bucket TEXT,
    s3AccessKey TEXT, s3SecretKey TEXT, s3PathStyle BOOLEAN NOT NULL DEFAULT false,
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
    name TEXT NOT NULL, ram INTEGER NOT NULL DEFAULT 0, cpu INTEGER NOT NULL DEFAULT 0,
    disk INTEGER NOT NULL DEFAULT 0,
    overallocateMemory INTEGER NOT NULL DEFAULT 0,
    overallocateDisk INTEGER NOT NULL DEFAULT 0,
    overallocateCpu INTEGER NOT NULL DEFAULT 0,
    locationId INTEGER, address TEXT NOT NULL DEFAULT '127.0.0.1',
    port INTEGER NOT NULL DEFAULT 1, key TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    allocatedPorts TEXT DEFAULT '[]', sftpPort INTEGER NOT NULL DEFAULT 3003,
    maintenanceMode BOOLEAN NOT NULL DEFAULT false
  );

  CREATE TABLE IF NOT EXISTS "Server" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UUID TEXT NOT NULL, name TEXT NOT NULL, description TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    Ports TEXT NOT NULL, Memory INTEGER NOT NULL, Swap INTEGER NOT NULL DEFAULT 0,
    Cpu INTEGER NOT NULL, Storage INTEGER NOT NULL, Variables TEXT, StartCommand TEXT,
    dockerImage TEXT, allowStartupEdit BOOLEAN NOT NULL DEFAULT false,
    Installing BOOLEAN NOT NULL DEFAULT true, Queued BOOLEAN NOT NULL DEFAULT true,
    Suspended BOOLEAN NOT NULL DEFAULT false, Running BOOLEAN NOT NULL DEFAULT false,
    backupLimit INTEGER NOT NULL DEFAULT 5, backupIgnoreList TEXT NOT NULL DEFAULT '',
    databaseLimit INTEGER NOT NULL DEFAULT 0,
    ownerId INTEGER NOT NULL, nodeId INTEGER NOT NULL, imageId INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Server_UUID_key" ON "Server"("UUID");
`)

// Seed: admin + a server on an unreachable node (port 1).
db.prepare(
  `INSERT INTO "Users" (email, username, password, isAdmin, role) VALUES ('admin@x.io', 'admin', 'x', 1, 'admin')`,
).run()
db.prepare(`INSERT OR IGNORE INTO "settings" (id) VALUES (1)`).run()
const nodeId = Number(db.prepare(
  `INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'node-key')`,
).run().lastInsertRowid)
db.prepare(
  `INSERT INTO "Server" (UUID, name, description, Ports, Memory, Swap, Cpu, Storage,
     Variables, StartCommand, dockerImage, Installing, Queued, ownerId, nodeId, imageId)
   VALUES ('srv-smoke', 'Smoke', 'desc', '[]', 1024, 0, 100, 8192, '[]', 'cmd', 'img', 0, 0, 1, ?, 1)`,
).run(nodeId)

// Authenticated session cookie (inserted directly — no login dance needed).
const sid = randomBytes(16).toString('hex')
db.prepare(
  `INSERT INTO "Session" (id, session_id, data, expires, createdAt, updatedAt)
   VALUES (?, ?, ?, datetime('now', '+1 day'), datetime('now'), datetime('now'))`,
).run(
  randomBytes(8).toString('hex'),
  sid,
  JSON.stringify({
    user: { id: 1, email: 'admin@x.io', isAdmin: true, username: 'admin' },
    cookie: { httpOnly: true, path: '/' },
  }),
)
const AUTH_COOKIE = `connect.sid=s:${sign(sid, SECRET)}`

// Boot the PRODUCTION LAUNCHER — Express is NOT running.
const child = spawn(process.execPath, ['web/server/index.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    APP_INTERNAL_PORT: String(PORT + 1),
    PANEL_INTERNAL_PORT: String(PORT + 2),
    DATABASE_URL: `file:${dbPath}`,
    SESSION_SECRET: SECRET,
    NODE_ENV: 'production',
    URL: `http://127.0.0.1:${PORT}`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})

let childLog = ''
child.stdout.on('data', (d) => { childLog += String(d) })
child.stderr.on('data', (d) => { childLog += String(d) })

const BASE = `http://127.0.0.1:${PORT}`
const WS_BASE = `ws://127.0.0.1:${PORT}`
let pass = 0
let fail = 0

function check(name, cond, extra = '') {
  if (cond) {
    pass++
    console.log(`  ✓ ${name}`)
  } else {
    fail++
    console.log(`  ✗ ${name} ${extra}`)
  }
}

async function waitForBoot() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/api/auth-config`)
      if (res.status === 200) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

/**
 * Opens a WS connection, collects messages until close or timeout.
 * Resolves { messages, closed, socket }.
 */
function connectWs(wsPath, cookie, timeoutMs = 3500) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`${WS_BASE}${wsPath}`, {
      headers: cookie ? { cookie } : {},
    })
    const messages = []
    let closed = null
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closed */ }
      resolve(value)
    }
    const timer = setTimeout(() => finish({ messages, closed }), timeoutMs)
    ws.on('message', (data) => {
      messages.push(String(data))
      // Realtime ready / online-check / console errors arrive as the first
      // message — resolve early for responsiveness.
      if (messages.length >= 1) finish({ messages, closed })
    })
    ws.on('close', (code, reason) => {
      closed = { code, reason: String(reason) }
      finish({ messages, closed })
    })
    ws.on('error', () => { /* close follows */ })
  })
}

async function main() {
  const booted = await waitForBoot()
  check('launcher + Nitro child boot', booted)
  if (!booted) {
    console.log(childLog.slice(-2000))
    cleanup()
    process.exit(1)
  }

  // 1. /ws/realtime — authenticated handshake.
  {
    const conn = await connectWs('/ws/realtime', AUTH_COOKIE)
    const first = conn.messages[0] ? JSON.parse(conn.messages[0]) : {}
    check('realtime: realtime.ready with session cookie', first.type === 'realtime.ready', JSON.stringify(first).slice(0, 80))
    const syncSocket = new WebSocket(`${WS_BASE}/ws/realtime`, { headers: { cookie: AUTH_COOKIE } })
    const syncMessages = []
    syncSocket.on('message', (d) => syncMessages.push(String(d)))
    await new Promise((r) => {
      syncSocket.on('open', () => {
        syncSocket.send(JSON.stringify({ type: 'sync', sinceSeq: null }))
        setTimeout(r, 400)
      })
      setTimeout(r, 2500)
    })
    const synced = syncMessages.map((s) => JSON.parse(s).type).includes('realtime.synced')
    check('realtime: sync → realtime.synced', synced, syncMessages.slice(0, 2).join(' | '))
    try { syncSocket.close() } catch { /* noop */ }
  }

  // 2. /ws/realtime — unauthenticated close 4401.
  {
    const conn = await connectWs('/ws/realtime', null, 2000)
    check('realtime: no cookie → close 4401', conn.closed?.code === 4401, `closed=${JSON.stringify(conn.closed)}`)
  }

  // 3. /online-check — presence.
  {
    const conn = await connectWs('/online-check', AUTH_COOKIE)
    check('online-check: { online: true }', conn.messages[0] === JSON.stringify({ online: true }), conn.messages[0])
  }

  // 4. /console/:id — bad token error JSON.
  {
    const conn = await connectWs('/console/srv-smoke?token=bad-token', AUTH_COOKIE)
    const msg = conn.messages[0] ? JSON.parse(conn.messages[0]) : {}
    check('console: bad token → Express error JSON', typeof msg.error === 'string' && msg.error.includes('Invalid or expired connect token'), conn.messages[0]?.slice(0, 80))
  }

  // 5. /console/:id — valid ws-token → daemon unreachable message.
  {
    const tokenRes = await fetch(`${BASE}/server/srv-smoke/ws-token`, {
      redirect: 'manual',
      headers: { cookie: AUTH_COOKIE },
    })
    const tokenBody = await tokenRes.json().catch(() => ({}))
    check('console: ws-token issued (Nitro)', tokenRes.status === 200 && typeof tokenBody.token === 'string', `got ${tokenRes.status}`)
    if (typeof tokenBody.token === 'string') {
      const conn = await connectWs(`/console/srv-smoke?token=${encodeURIComponent(tokenBody.token)}`, AUTH_COOKIE, 3000)
      const gotUnavailable = conn.messages.some((m) => m.includes('This instance is unavailable'))
      check('console: valid token, daemon down → unavailable message', gotUnavailable, conn.messages[0]?.slice(0, 60))
    }
  }

  console.log(`\nPhase 3 WS smoke: ${pass} passed, ${fail} failed`)
  cleanup()
  process.exit(fail === 0 ? 0 : 1)
}

function cleanup() {
  try { child.kill() } catch { /* noop */ }
  try { db.close() } catch { /* noop */ }
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* noop */ }
}

process.on('SIGINT', () => { cleanup(); process.exit(130) })

await main()
