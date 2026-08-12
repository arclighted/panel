/**
 * Prod smoke test — Phase 2 group 3b/3c/3d (console, files, tab CRUD).
 *
 * Boots ONLY the Nitro child (web/.output/server/index.mjs) with Express NOT
 * running, on an isolated port with a fresh temp SQLite DB. Proves Nitro now
 * owns the ENTIRE /server/:id/* namespace: the console/power/status/logs/
 * players GETs and the DB-only mutations (settings, schedules, subusers,
 * backups lock, power stop) all answer 200 from Nitro — the same paths the
 * group-3a smoke asserted were still 502 to Express. CSRF enforcement is
 * verified too (missing pair → 403, never a proxy error).
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import Database from 'better-sqlite3'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-smoke-g3bcd-'))
const dbPath = path.join(tmpDir, 'smoke.db')
const PORT = 3994
const SECRET = 's'.repeat(64)

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
  CREATE TABLE IF NOT EXISTS "LoginHistory" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "settings" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Arclight',
    description TEXT NOT NULL DEFAULT '',
    logo TEXT NOT NULL DEFAULT '', favicon TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'default', lightTheme TEXT NOT NULL DEFAULT 'default',
    darkTheme TEXT NOT NULL DEFAULT 'default', language TEXT NOT NULL DEFAULT 'en',
    allowRegistration BOOLEAN NOT NULL DEFAULT false,
    uploadLimit INTEGER NOT NULL DEFAULT 100,
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
  CREATE TABLE IF NOT EXISTS "Images" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UUID TEXT NOT NULL, name TEXT, description TEXT, author TEXT, authorName TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meta TEXT, dockerImages TEXT, startup TEXT, stop TEXT, startup_done TEXT,
    config_files TEXT, info TEXT, scripts TEXT, variables TEXT,
    portRequirements TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'approved',
    createdById INTEGER, rejectionReason TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Images_UUID_key" ON "Images"("UUID");
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
  CREATE TABLE IF NOT EXISTS "ServerDatabase" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL, hostId INTEGER NOT NULL,
    databaseName TEXT NOT NULL, databaseUser TEXT NOT NULL, databasePassword TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "DatabaseHost" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, host TEXT NOT NULL, port INTEGER NOT NULL DEFAULT 3306,
    username TEXT NOT NULL DEFAULT '', password TEXT NOT NULL DEFAULT '',
    nodeId INTEGER, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "Schedule" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL, name TEXT NOT NULL, cron TEXT NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT false, timeOffset INTEGER NOT NULL DEFAULT 0,
    lastRunAt DATETIME, nextRunAt DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "ScheduleTask" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    scheduleId INTEGER NOT NULL, "order" INTEGER NOT NULL DEFAULT 0,
    action TEXT NOT NULL, payload TEXT NOT NULL, timeOffset INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS "Backup" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    UUID TEXT NOT NULL, name TEXT NOT NULL, serverId TEXT NOT NULL,
    filePath TEXT NOT NULL DEFAULT '', size BIGINT, checksum TEXT,
    locked BOOLEAN NOT NULL DEFAULT false,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    arclightCloudId TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Backup_UUID_key" ON "Backup"("UUID");
  CREATE TABLE IF NOT EXISTS "SubUser" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    serverId TEXT NOT NULL, userId INTEGER NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "SubUser_serverId_userId_key" ON "SubUser"("serverId", "userId");
  CREATE TABLE IF NOT EXISTS "ActivityLog" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    actorId INTEGER, serverId TEXT, event TEXT NOT NULL, metadata TEXT, ip TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  INSERT OR IGNORE INTO "settings" (id) VALUES (1);
`)

// Boot the PRODUCTION PROXY (web/server/index.mjs) — Express is
// intentionally NOT running, so Nitro-owned paths proxy through to the
// Nitro child (200) while every non-owned path 502s.
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

async function main() {
  const booted = await waitForBoot()
  check('Nitro child boots', booted)
  if (!booted) {
    console.log(childLog.slice(-2000))
    cleanup()
    process.exit(1)
  }

  // 1. CSRF + session cookie from the shared auth-config.
  const jar = {}
  const acRes = await fetch(`${BASE}/api/auth-config`, { redirect: 'manual' })
  const acBody = await acRes.json()
  for (const c of acRes.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const [k] = kv.split('=')
    jar[k] = kv
  }
  const csrfToken = acBody.csrfToken
  check('auth-config serves CSRF token', typeof csrfToken === 'string' && csrfToken.length > 10)
  const cookieHeader = Object.values(jar).join('; ')

  // 2. Register + login (both Nitro-owned since Phase 2).
  const regRes = await fetch(`${BASE}/register`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrfToken, cookie: cookieHeader },
    body: JSON.stringify({ email: 'smoke@x.io', username: 'smoke', password: 'password123' }),
  })
  check('register → 302 /login', regRes.status === 302 && regRes.headers.get('location') === '/login', `got ${regRes.status}`)
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrfToken, cookie: cookieHeader },
    body: JSON.stringify({ identifier: 'smoke@x.io', password: 'password123' }),
  })
  check('login → 302 /', loginRes.status === 302 && loginRes.headers.get('location') === '/', `got ${loginRes.status} ${loginRes.headers.get('location')}`)
  for (const c of loginRes.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const [k] = kv.split('=')
    jar[k] = kv
  }
  const authCookie = Object.values(jar).join('; ')

  // Re-mint CSRF for the authenticated session.
  const acRes2 = await fetch(`${BASE}/api/auth-config`, { redirect: 'manual', headers: { cookie: authCookie } })
  const acBody2 = await acRes2.json()
  for (const c of acRes2.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const [k] = kv.split('=')
    jar[k] = kv
  }
  const authCookie2 = Object.values(jar).join('; ')
  const authHeaders = { cookie: authCookie2 }
  const csrf2 = acBody2.csrfToken
  check('auth-config shows the logged-in user', acBody2.user?.email === 'smoke@x.io')

  // 3. Seed a server owned by the (admin) user id 1.
  const nodeId = Number(db.prepare(`INSERT INTO "Node" (name, address, port, key) VALUES ('n1', '127.0.0.1', 1, 'k')`).run().lastInsertRowid)
  const imageId = Number(db.prepare(
    `INSERT INTO "Images" (UUID, name, dockerImages, info, status)
     VALUES ('img-1', 'mcr', '[{"latest":"mcr:latest"}]', '{"features":["players","worlds"]}', 'approved')`,
  ).run().lastInsertRowid)
  db.prepare(
    `INSERT INTO "Server" (UUID, name, description, Ports, Memory, Swap, Cpu, Storage,
       Variables, StartCommand, dockerImage, Installing, Queued, ownerId, nodeId, imageId)
     VALUES ('srv-smoke', 'Smoke Server', 'desc', '[{"name":"HTTP","internalPort":80,"externalPort":8080,"primary":true}]',
       1024, 0, 100, 8192, '[{"name":"Version","env":"VERSION","type":"text","value":"1.20"}]',
       'java -jar server.jar', '{"latest":"mcr:latest"}', 0, 0, 1, ?, ?)`,
  ).run(nodeId, imageId)
  db.prepare(
    `INSERT INTO "Backup" (UUID, name, serverId, filePath, size, locked)
     VALUES ('bak-1', 'Daily', 'srv-smoke', '/b/bak-1.tar.gz', 100, 0)`,
  ).run()
  db.prepare(
    `INSERT INTO "Schedule" (serverId, name, cron, enabled, timeOffset)
     VALUES ('srv-smoke', 'Existing', '0 6 * * *', 0, 0)`,
  ).run()

  // 4. 3b console GETs — all from Nitro now (were 502 to Express before).
  const st = await fetch(`${BASE}/server/srv-smoke/status`, { redirect: 'manual', headers: authHeaders })
  const stBody = await st.json().catch(() => ({}))
  check('GET /server/:id/status → 200 from Nitro + daemon-offline shape', st.status === 200 && stBody.daemonOffline === true && 'queue' in stBody, `got ${st.status} ${JSON.stringify(stBody).slice(0, 100)}`)

  const ws = await fetch(`${BASE}/server/srv-smoke/ws-token`, { redirect: 'manual', headers: authHeaders })
  const wsBody = await ws.json().catch(() => ({}))
  check('GET /server/:id/ws-token → 200 + token', ws.status === 200 && typeof wsBody.token === 'string' && wsBody.token.length > 20, `got ${ws.status}`)

  const pl = await fetch(`${BASE}/server/srv-smoke/players/data`, { redirect: 'manual', headers: authHeaders })
  const plBody = await pl.json().catch(() => ({}))
  check('GET /server/:id/players/data → 200 (offline node → unreachable)', pl.status === 200 && plBody.error === 'unreachable', `got ${pl.status} ${JSON.stringify(plBody).slice(0, 80)}`)

  // 5. 3b power — optimistic stop answers 200 immediately (no daemon round-trip).
  const pw = await fetch(`${BASE}/server/srv-smoke/power/stop`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrf2, cookie: authCookie2 },
    body: JSON.stringify({}),
  })
  const pwBody = await pw.json().catch(() => ({}))
  check('POST /server/:id/power/stop → 200 optimistic stopping state', pw.status === 200 && pwBody.message === 'Server is stopping...', `got ${pw.status} ${JSON.stringify(pwBody).slice(0, 80)}`)

  // 6. 3d mutations — DB-only, answer 200 from Nitro (were 502 before).
  const se = await fetch(`${BASE}/server/srv-smoke/settings`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrf2, cookie: authCookie2 },
    body: JSON.stringify({ name: 'Renamed', description: 'from nitro' }),
  })
  const seBody = await se.json().catch(() => ({}))
  const seRow = db.prepare(`SELECT name, description FROM "Server" WHERE UUID = 'srv-smoke'`).get()
  check('POST /server/:id/settings → 200 + persisted (was 502!)', se.status === 200 && seBody.success === true && seRow?.name === 'Renamed', `got ${se.status} ${JSON.stringify(seBody)}`)

  const sc = await fetch(`${BASE}/server/srv-smoke/schedules`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrf2, cookie: authCookie2 },
    body: JSON.stringify({ name: 'Daily backup', cron: '0 6 * * *', timeOffset: 0 }),
  })
  const scBody = await sc.json().catch(() => ({}))
  check('POST /server/:id/schedules → 200 + created', sc.status === 200 && scBody.schedule?.name === 'Daily backup', `got ${sc.status} ${JSON.stringify(scBody).slice(0, 80)}`)

  const su = await fetch(`${BASE}/server/srv-smoke/subusers`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrf2, cookie: authCookie2 },
    body: JSON.stringify({ email: 'smoke@x.io', permissions: ['console'] }),
  })
  const suBody = await su.json().catch(() => ({}))
  check('POST /server/:id/subusers → 400 (self-add rejected — Nitro owns the route)', su.status === 400 && suBody.error === 'You cannot add yourself as a subuser.', `got ${su.status} ${JSON.stringify(suBody)}`)

  const lk = await fetch(`${BASE}/server/srv-smoke/backups/bak-1/lock`, {
    method: 'PATCH', redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrf2, cookie: authCookie2 },
    body: JSON.stringify({ locked: true }),
  })
  const lkBody = await lk.json().catch(() => ({}))
  check('PATCH /server/:id/backups/:id/lock → 200 + locked', lk.status === 200 && lkBody.locked === true, `got ${lk.status} ${JSON.stringify(lkBody)}`)

  const scDel = await fetch(`${BASE}/server/srv-smoke/schedules/1`, {
    method: 'DELETE', redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrf2, cookie: authCookie2 },
    body: JSON.stringify({}),
  })
  check('DELETE /server/:id/schedules/:id → 200 from Nitro', scDel.status === 200, `got ${scDel.status}`)

  // 7. CSRF enforcement — a mutation without the token pair is a 403 from
  // Nitro, NOT a 502 proxy error.
  const noCsrf = await fetch(`${BASE}/server/srv-smoke/settings`, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/json', cookie: authCookie2 },
    body: JSON.stringify({ name: 'x' }),
  })
  check('POST without CSRF → 403 (Nitro enforces, not 502)', noCsrf.status === 403, `got ${noCsrf.status}`)

  // 7b. Multipart upload path — same CSRF gate before body parsing (proves
  // the seam claim on /upload, which is otherwise daemon-dependent).
  const boundary = `----smoke${Date.now()}`
  const upNoCsrf = await fetch(`${BASE}/server/srv-smoke/upload`, {
    method: 'POST', redirect: 'manual',
    headers: {
      'content-type': `multipart/form-data; boundary=${boundary}`,
      cookie: authCookie2,
    },
    body: `--${boundary}\r\ncontent-disposition: form-data; name=\"files\"; filename=\"x.txt\"\r\ncontent-type: text/plain\r\n\r\nhi\r\n--${boundary}--\r\n`,
  })
  check('POST /server/:id/upload without CSRF → 403 from Nitro (not 502)', upNoCsrf.status === 403, `got ${upNoCsrf.status}`)

  // 8. Un-migrated sibling paths still belong to Express → 502.
  const stray = await fetch(`${BASE}/api/server/srv-smoke/files`, { redirect: 'manual', headers: authHeaders })
  check('GET /api/server/:id/files (never existed in Nitro) → still 502 to Express', stray.status === 502, `got ${stray.status}`)

  // 9. Group 3a regression — tab reads still Nitro-owned.
  const read = await fetch(`${BASE}/api/server/srv-smoke/settings`, { redirect: 'manual', headers: authHeaders })
  check('GET /api/server/:id/settings → 200 (group-3a regression)', read.status === 200)

  console.log(`\nSmoke result: ${pass} passed, ${fail} failed`)
  cleanup()
  process.exit(fail > 0 ? 1 : 0)
}

function cleanup() {
  try { child.kill() } catch { /* already gone */ }
  try { db.close() } catch { /* already closed */ }
  try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* best effort */ }
}

main().catch((e) => {
  console.error('Smoke script error:', e)
  console.log(childLog.slice(-2000))
  cleanup()
  process.exit(1)
})
