// Prod smoke for Phase 2 group 2 — boots web/server/index.mjs with Express NOT
// running. Any 200/expected-status on the 7 context endpoints proves Nitro
// ownership; a non-nitro path must 502 (proxy to dead Express).
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-smoke-g2-'))
const dbPath = path.join(tmpDir, 'smoke.db')
const db = new Database(dbPath)
db.exec(`
  CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT NOT NULL PRIMARY KEY, session_id TEXT NOT NULL, data TEXT NOT NULL,
    expires DATETIME NOT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Session_session_id_key" ON "Session"("session_id");
  CREATE TABLE IF NOT EXISTS "Users" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL,
    username TEXT, password TEXT NOT NULL, isAdmin BOOLEAN NOT NULL DEFAULT false,
    description TEXT DEFAULT 'No About Me', avatar TEXT, permissions TEXT DEFAULT '[]',
    serverLimit INTEGER DEFAULT 0, maxMemory INTEGER DEFAULT 0, maxCpu INTEGER DEFAULT 0,
    maxStorage INTEGER DEFAULT 0, maxDatabases INTEGER DEFAULT 0, role TEXT NOT NULL DEFAULT 'user',
    onboardingCompleted BOOLEAN NOT NULL DEFAULT false, onboardingSkipped BOOLEAN NOT NULL DEFAULT false,
    preferredNodeId INTEGER, loginAttempts INTEGER NOT NULL DEFAULT 0, lockedUntil DATETIME,
    totpSecret TEXT, totpEnabled BOOLEAN NOT NULL DEFAULT false, totpRecoveryCodes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users"("email");
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_key" ON "Users"("username");
  CREATE TABLE IF NOT EXISTS "settings" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL DEFAULT 'Arclight',
    description TEXT NOT NULL DEFAULT '', logo TEXT NOT NULL DEFAULT '', favicon TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'default', lightTheme TEXT NOT NULL DEFAULT 'default',
    darkTheme TEXT NOT NULL DEFAULT 'default', language TEXT NOT NULL DEFAULT 'en',
    allowRegistration BOOLEAN NOT NULL DEFAULT false, uploadLimit INTEGER NOT NULL DEFAULT 100,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sftpPort INTEGER NOT NULL DEFAULT 3003, virusTotalApiKey TEXT,
    rateLimitEnabled BOOLEAN NOT NULL DEFAULT true, rateLimitRpm INTEGER NOT NULL DEFAULT 100,
    bannedIps TEXT NOT NULL DEFAULT '[]', allowUserCreateServer BOOLEAN NOT NULL DEFAULT false,
    allowUserDeleteServer BOOLEAN NOT NULL DEFAULT false, defaultServerLimit INTEGER NOT NULL DEFAULT 0,
    defaultMaxMemory INTEGER NOT NULL DEFAULT 512, defaultMaxCpu INTEGER NOT NULL DEFAULT 100,
    defaultMaxStorage INTEGER NOT NULL DEFAULT 5120, defaultMaxDatabases INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateMemory INTEGER NOT NULL DEFAULT 0, defaultOverallocateDisk INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateCpu INTEGER NOT NULL DEFAULT 0, loginWallpaper TEXT, registerWallpaper TEXT,
    panelWallpaper TEXT, loginMaxAttempts INTEGER NOT NULL DEFAULT 5,
    loginLockoutMinutes INTEGER NOT NULL DEFAULT 15, enforceDaemonHttps BOOLEAN NOT NULL DEFAULT false,
    require2faForAdmins BOOLEAN NOT NULL DEFAULT false, behindReverseProxy BOOLEAN NOT NULL DEFAULT false,
    hashApiKeys BOOLEAN NOT NULL DEFAULT false, arclightCloudApiKey TEXT,
    arclightCloudBackupEnabled BOOLEAN NOT NULL DEFAULT false,
    smtpHost TEXT, smtpPort INTEGER DEFAULT 587, smtpUser TEXT, smtpPassword TEXT, smtpFrom TEXT,
    smtpSecure BOOLEAN NOT NULL DEFAULT false, s3Enabled BOOLEAN NOT NULL DEFAULT false,
    s3Endpoint TEXT, s3Region TEXT, s3Bucket TEXT, s3AccessKey TEXT, s3SecretKey TEXT,
    s3PathStyle BOOLEAN NOT NULL DEFAULT false, allowPrivilegedServerLimit INTEGER NOT NULL DEFAULT 5,
    allowPrivilegedMaxMemory INTEGER NOT NULL DEFAULT 2048, allowPrivilegedMaxCpu INTEGER NOT NULL DEFAULT 200,
    allowPrivilegedMaxStorage INTEGER NOT NULL DEFAULT 61440, allowPrivilegedMaxDatabases INTEGER NOT NULL DEFAULT 10,
    allowUserCreateImages BOOLEAN NOT NULL DEFAULT false, onboardingEnabled BOOLEAN NOT NULL DEFAULT true,
    onboardingSteps TEXT NOT NULL DEFAULT '[]'
  );
  CREATE TABLE IF NOT EXISTS "LoginHistory" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL,
    ipAddress TEXT, userAgent TEXT, timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "Node" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    ram INTEGER NOT NULL DEFAULT 0, cpu INTEGER NOT NULL DEFAULT 0, disk INTEGER NOT NULL DEFAULT 0,
    overallocateMemory INTEGER NOT NULL DEFAULT 0, overallocateDisk INTEGER NOT NULL DEFAULT 0,
    overallocateCpu INTEGER NOT NULL DEFAULT 0, locationId INTEGER, address TEXT NOT NULL DEFAULT '127.0.0.1',
    port INTEGER NOT NULL DEFAULT 1, key TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, allocatedPorts TEXT DEFAULT '[]',
    sftpPort INTEGER NOT NULL DEFAULT 3003, maintenanceMode BOOLEAN NOT NULL DEFAULT false
  );
  CREATE TABLE IF NOT EXISTS "Images" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, UUID TEXT NOT NULL, name TEXT,
    description TEXT, author TEXT, authorName TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    meta TEXT, dockerImages TEXT, startup TEXT, stop TEXT, startup_done TEXT,
    config_files TEXT, info TEXT, scripts TEXT, variables TEXT,
    portRequirements TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'approved',
    createdById INTEGER, rejectionReason TEXT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Images_UUID_key" ON "Images"("UUID");
  CREATE TABLE IF NOT EXISTS "Server" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, UUID TEXT NOT NULL, name TEXT NOT NULL,
    description TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, Ports TEXT NOT NULL,
    Memory INTEGER NOT NULL, Swap INTEGER NOT NULL DEFAULT 0, Cpu INTEGER NOT NULL,
    Storage INTEGER NOT NULL, Variables TEXT, StartCommand TEXT, dockerImage TEXT,
    allowStartupEdit BOOLEAN NOT NULL DEFAULT false, Installing BOOLEAN NOT NULL DEFAULT true,
    Queued BOOLEAN NOT NULL DEFAULT true, Suspended BOOLEAN NOT NULL DEFAULT false,
    Running BOOLEAN NOT NULL DEFAULT false, backupLimit INTEGER NOT NULL DEFAULT 5,
    backupIgnoreList TEXT NOT NULL DEFAULT '', databaseLimit INTEGER NOT NULL DEFAULT 0,
    ownerId INTEGER NOT NULL, nodeId INTEGER NOT NULL, imageId INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Server_UUID_key" ON "Server"("UUID");
  CREATE TABLE IF NOT EXISTS "ServerFolder" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, ownerId INTEGER NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS "ServerFolderMember" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, folderId INTEGER NOT NULL, serverUUID TEXT NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "ServerFolderMember_serverUUID_key" ON "ServerFolderMember"("serverUUID");
  CREATE TABLE IF NOT EXISTS "SubUser" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, serverId TEXT NOT NULL, userId INTEGER NOT NULL,
    permissions TEXT NOT NULL DEFAULT '[]', createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "SubUser_serverId_userId_key" ON "SubUser"("serverId", "userId");
  INSERT OR IGNORE INTO "settings" (id) VALUES (1);
`)
db.close()

process.env.DATABASE_URL = `file:${dbPath}`
process.env.SESSION_SECRET = 's'.repeat(64)
process.env.NODE_ENV = 'production'
process.env.URL = 'http://localhost'
process.env.PORT = '3199'
process.env.APP_INTERNAL_PORT = '3198'
process.env.PANEL_INTERNAL_PORT = '3299' // nothing listens here → 502s

import { spawn } from 'node:child_process'
const child = spawn(process.execPath, ['web/server/index.mjs'], {
  cwd: '/home/radityra/projects/arclight/panel',
  env: process.env,
  stdio: ['ignore', 'pipe', 'pipe'],
})
let bootLog = ''
child.stdout.on('data', (d) => { bootLog += d })
child.stderr.on('data', (d) => { bootLog += d })

const BASE = 'http://127.0.0.1:3199'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function waitForBoot() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/api/auth-config`)
      if (r.status === 200 || r.status === 302 || r.status === 500) return
    } catch {}
    await sleep(500)
  }
  throw new Error('boot timeout\n' + bootLog)
}

let failures = []
function check(name, cond, extra = '') {
  const ok = !!cond
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ' — ' + extra : ''}`)
  if (!ok) failures.push(name)
}

async function main() {
  await waitForBoot()
  console.log('--- boot ok ---\n')

  // 1. auth-config (Nitro, Phase 1) — grab CSRF + session cookie
  const cfgRes = await fetch(`${BASE}/api/auth-config`)
  const cfg = await cfgRes.json()
  const csrf = cfg.csrfToken
  const setCookies = cfgRes.headers.getSetCookie?.() ?? (cfgRes.headers.get('set-cookie') ? [cfgRes.headers.get('set-cookie')] : [])
  const sidCookie = (setCookies.find((c) => c.startsWith('connect.sid=')) ?? '').split(';')[0]
  const csrfCookie = (setCookies.find((c) => c.includes('x-csrf-token=')) ?? '').split(';')[0]
  const jar = [sidCookie, csrfCookie].filter(Boolean).join('; ')
  check('auth-config 200 + csrfToken + cookie', cfgRes.status === 200 && !!csrf && !!sidCookie && !!csrfCookie)

  // 2. register first user (owner) via Nitro
  const regRes = await fetch(`${BASE}/register`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      cookie: jar,
      'content-type': 'application/json',
      'CSRF-Token': csrf,
    },
    body: JSON.stringify({ email: 'smoke@x.io', username: 'smoke', password: 'Password123!' }),
  })
  check('register 302 /login (Nitro)', regRes.status === 302, `status=${regRes.status} loc=${regRes.headers.get('location')}`)

  // 3. login via Nitro
  const loginRes = await fetch(`${BASE}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      cookie: jar,
      'content-type': 'application/json',
      'CSRF-Token': csrf,
    },
    body: JSON.stringify({ identifier: 'smoke@x.io', password: 'Password123!' }),
  })
  const loginCookies = loginRes.headers.getSetCookie?.() ?? (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')] : [])
  const loginSid = (loginCookies.find((c) => c.startsWith('connect.sid=')) ?? sidCookie).split(';')[0]
  const loginCsrf = (loginCookies.find((c) => c.includes('x-csrf-token=')) ?? '').split(';')[0]
  const loginJar = [loginSid, loginCsrf || csrfCookie].filter(Boolean).join('; ')
  check('login 302 / (Nitro)', loginRes.status === 302, `status=${loginRes.status} loc=${loginRes.headers.get('location')}`)

  const authHeaders = { cookie: loginJar, 'CSRF-Token': csrf }

  // 4. the seven context endpoints — all Nitro-owned GETs
  const acct = await fetch(`${BASE}/api/account/context`, { headers: authHeaders })
  const acctBody = await acct.json()
  check('account/context 200 (Nitro)', acct.status === 200 && acctBody.success === true && acctBody.user?.email === 'smoke@x.io')

  const folders = await fetch(`${BASE}/api/folders`, { headers: authHeaders })
  const foldersBody = await folders.json()
  check('folders 200 (Nitro)', folders.status === 200 && foldersBody.success === true && Array.isArray(foldersBody.folders))

  const cs = await fetch(`${BASE}/api/create-server/context`, { headers: authHeaders })
  const csBody = await cs.json()
  check('create-server/context 200 (Nitro)', cs.status === 200 && csBody.disabled === true)

  const sys = await fetch(`${BASE}/api/system/status`, { headers: authHeaders })
  const sysBody = await sys.json()
  check('system/status 200 + stats (Nitro)', sys.status === 200 && sysBody.stats?.users === 1 && sysBody.stats?.servers === 0)

  const adm = await fetch(`${BASE}/api/admin/context`, { headers: authHeaders })
  const admBody = await adm.json()
  check('admin/context 200 + sidebarGroups (Nitro)', adm.status === 200 && admBody.success === true && Array.isArray(admBody.sidebarGroups))

  const page = await fetch(`${BASE}/api/admin/page/overview`, { headers: authHeaders })
  check('admin/page/overview 200 (Nitro)', page.status === 200, `status=${page.status}`)

  // no server with that UUID → expect 404 (route exists in Nitro; a missing
  // route would fall through to the Express proxy → 502)
  const srv = await fetch(`${BASE}/api/server/does-not-exist/context`, { headers: authHeaders })
  check('server/:id/context 404 for unknown (Nitro)', srv.status === 404, `status=${srv.status}`)

  // 5. a non-nitro API path must still proxy → 502 (Express down)
  const legacy = await fetch(`${BASE}/api/account/settings`, { headers: authHeaders })
  check('non-nitro /api/account/settings 502 (Express down)', legacy.status === 502, `status=${legacy.status}`)

  // 6. unauthenticated guard on a context endpoint → 302 /login
  const unauth = await fetch(`${BASE}/api/account/context`, { redirect: 'manual' })
  check('account/context unauthenticated 302 /login', unauth.status === 302 && unauth.headers.get('location') === '/login', `status=${unauth.status}`)

  // 7. non-admin on admin/context → 403 (allow registration for user2)
  {
    const w = new Database(dbPath)
    w.prepare('UPDATE "settings" SET allowRegistration = 1 WHERE id = 1').run()
    w.close()
  }
  // Fresh anonymous session for user2 (the owner's session was regenerated
  // on login, so its CSRF token no longer validates).
  const cfg2Res = await fetch(`${BASE}/api/auth-config`)
  const cfg2 = await cfg2Res.json()
  const cfg2Cookies = cfg2Res.headers.getSetCookie?.() ?? (cfg2Res.headers.get('set-cookie') ? [cfg2Res.headers.get('set-cookie')] : [])
  const jar2 = [
    (cfg2Cookies.find((c) => c.startsWith('connect.sid=')) ?? '').split(';')[0],
    (cfg2Cookies.find((c) => c.includes('x-csrf-token=')) ?? '').split(';')[0],
  ].filter(Boolean).join('; ')
  const reg2 = await fetch(`${BASE}/register`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: jar2, 'content-type': 'application/json', 'CSRF-Token': cfg2.csrfToken },
    body: JSON.stringify({ email: 'user2@x.io', username: 'user2', password: 'Password123!' }),
  })
  const login2 = await fetch(`${BASE}/login`, {
    method: 'POST',
    redirect: 'manual',
    headers: { cookie: jar2, 'content-type': 'application/json', 'CSRF-Token': cfg2.csrfToken },
    body: JSON.stringify({ identifier: 'user2@x.io', password: 'Password123!' }),
  })
  const login2Cookies = login2.headers.getSetCookie?.() ?? (login2.headers.get('set-cookie') ? [login2.headers.get('set-cookie')] : [])
  const cookie2 = (login2Cookies.find((c) => c.startsWith('connect.sid=')) ?? '').split(';')[0]
  const nonAdmin = await fetch(`${BASE}/api/admin/context`, {
    headers: { cookie: cookie2, 'CSRF-Token': csrf }, redirect: 'manual',
  })
  check('admin/context non-admin 403', nonAdmin.status === 403, `status=${nonAdmin.status}`)

  console.log(`\n${failures.length === 0 ? 'ALL SMOKE CHECKS PASSED' : failures.length + ' FAILURES'}`)
  child.kill('SIGTERM')
  rmSync(tmpDir, { recursive: true, force: true })
  process.exit(failures.length === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error('SMOKE ERROR:', e.message)
  console.error(bootLog.slice(-3000))
  child.kill('SIGTERM')
  process.exit(1)
})
