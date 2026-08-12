/**
 * Prod smoke test — Phase 2 group 3a (server tab reads).
 *
 * Boots ONLY the Nitro child (web/.output/server/index.mjs) with Express NOT
 * running, on an isolated port with a fresh temp SQLite DB. Proves Nitro
 * ownership of the 7 tab read endpoints: every 200 comes from Nitro, and the
 * seam keeps the tab mutations Express-owned (502 = Express not running).
 */
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import Database from 'better-sqlite3'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-smoke-g3a-'))
const dbPath = path.join(tmpDir, 'smoke.db')
const PORT = 3993
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
  INSERT OR IGNORE INTO "settings" (id) VALUES (1);
`)

// Boot the PRODUCTION PROXY (web/server/index.mjs) — Express is
// intentionally NOT running, so Nitro-owned paths proxy through to the
// Nitro child (200) while every non-owned path 502s. This is the definitive
// Nitro-ownership proof.
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
  const setCookies = acRes.headers.getSetCookie?.() ?? []
  for (const c of setCookies) {
    const [kv] = c.split(';')
    const [k] = kv.split('=')
    jar[k] = kv
  }
  const csrfToken = acBody.csrfToken
  check('auth-config serves CSRF token', typeof csrfToken === 'string' && csrfToken.length > 10)

  const cookieHeader = Object.values(jar).join('; ')

  // 2. Register the first user (owner/admin).
  const regRes = await fetch(`${BASE}/register`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrfToken, cookie: cookieHeader },
    body: JSON.stringify({ email: 'smoke@x.io', username: 'smoke', password: 'password123' }),
  })
  check('register → 302 /login', regRes.status === 302 && regRes.headers.get('location') === '/login', `got ${regRes.status}`)
  const userRow = db.prepare('SELECT id, email, username, role, isAdmin FROM "Users"').get()
  check('user row persisted (owner/admin)', !!userRow && userRow.email === 'smoke@x.io' && userRow.role === 'owner' && userRow.isAdmin === 1, JSON.stringify(userRow))

  // 3. Login → fresh session (cookie + CSRF change).
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': csrfToken, cookie: cookieHeader },
    body: JSON.stringify({ identifier: 'smoke@x.io', password: 'password123' }),
  })
  const loginLocation = loginRes.headers.get('location')
  check('login → 302 /', loginRes.status === 302 && loginLocation === '/', `got ${loginRes.status} ${loginLocation}`)
  // Debug: is the login POST reaching Nitro at all? A 502 would mean Express.
  check('login did NOT hit Express (not 502)', loginRes.status !== 502, `got ${loginRes.status}`)

  // Login regenerated the session — capture the fresh connect.sid cookie
  // from the login response (the old cookie is dead).
  for (const c of loginRes.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const [k] = kv.split('=')
    jar[k] = kv
  }
  const authCookie = Object.values(jar).join('; ')

  // Re-mint the CSRF token for the authenticated session (double-submit
  // needs the fresh csrfSessionId).
  const acRes2 = await fetch(`${BASE}/api/auth-config`, {
    redirect: 'manual',
    headers: { cookie: authCookie },
  })
  const acBody2 = await acRes2.json()
  for (const c of acRes2.headers.getSetCookie?.() ?? []) {
    const [kv] = c.split(';')
    const [k] = kv.split('=')
    jar[k] = kv
  }
  const authCookie2 = Object.values(jar).join('; ')
  check('auth-config shows the logged-in user', acBody2.user?.email === 'smoke@x.io', `got ${JSON.stringify(acBody2.user)}`)

  // Use the final cookie jar for the authenticated tab reads.
  const authHeaders = { cookie: authCookie2 }

  // 4. Seed a server owned by the (admin) user id 1.
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

  // 5. The 7 tab reads — all from Nitro.
  const tabs = [
    ['settings', (d) => d.server?.name === 'Smoke Server' && d.server?.nodeName === 'n1' && d.isOwner === true],
    ['startup', (d) => d.server?.startCommand === 'java -jar server.jar' && d.currentDockerImage === 'latest' && d.availableDockerImages?.includes('latest')],
    ['databases', (d) => Array.isArray(d.databases) && Array.isArray(d.hosts) && typeof d.userDbLimit === 'number'],
    ['schedules', (d) => Array.isArray(d.schedules)],
    ['backups', (d) => Array.isArray(d.backups)],
    ['subusers', (d) => Array.isArray(d.subUsers) && d.permissionLabels?.console === 'Full console' && d.permissionGroups?.length > 0],
    ['worlds', (d) => Array.isArray(d.worlds) && d.serverStatus?.daemonOffline === true],
  ]
  for (const [tab, shapeCheck] of tabs) {
    const res = await fetch(`${BASE}/api/server/srv-smoke/${tab}`, { redirect: 'manual', headers: authHeaders })
    let body = {}
    try { body = await res.json() } catch { /* no body */ }
    check(`GET /api/server/srv-smoke/${tab} → 200 + shape`, res.status === 200 && shapeCheck(body), `got ${res.status} ${JSON.stringify(body).slice(0, 120)}`)
  }

  // 6. Context endpoint still owned by Nitro (regression, group 2).
  const ctxRes = await fetch(`${BASE}/api/server/srv-smoke/context`, { redirect: 'manual', headers: authHeaders })
  check('GET /api/server/srv-smoke/context → 200 (group-2 regression)', ctxRes.status === 200)

  // 7. The seam keeps the tab MUTATIONS Express-owned — Express is not
  // running, so the mutation must 502 (proves it is NOT Nitro-owned).
  const mutRes = await fetch(`${BASE}/server/srv-smoke/settings`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'CSRF-Token': acBody2.csrfToken, cookie: authHeaders.cookie },
    body: JSON.stringify({ name: 'x', description: 'y' }),
  })
  check('POST /server/:id/settings still routes to Express → 502', mutRes.status === 502, `got ${mutRes.status}`)

  // 8. Non-owned GET path still proxies to Express → 502.
  const stray = await fetch(`${BASE}/api/server/srv-smoke/files`, { redirect: 'manual', headers: authHeaders })
  check('GET /api/server/:id/files (not yet migrated) → 502 to Express', stray.status === 502, `got ${stray.status}`)

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
