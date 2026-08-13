/**
 * Phase 5 smoke: Express is DELETED — one Nitro process, addons in-process.
 *
 * Boots the PRODUCTION launcher (web/server/index.mjs). There is no Express
 * child to proxy to; the launcher imports the Nitro entry directly and the
 * addon runtime (web/server/utils/addon-runtime.ts + middleware/03.addons.ts)
 * runs the express-SDK addons inside Nitro via the in-process bridge.
 * Verifies:
 *   - boot                        : launcher = the whole server (no proxy seam)
 *   - addon bridge (async mains)  : /modrinth/api/config answers anonymously
 *                                   (401 JSON — addon middleware, not the shell)
 *   - bridged session             : /modrinth/api/config + /progress with an
 *                                   admin session → 200 JSON
 *   - v3 UI manifest              : /api/addons/ui lists modrinth (D3 shape)
 *   - admin addons API            : /admin/addons/list 302 anon / 200 admin,
 *                                   toggle off → bridge unmounts → toggle on
 *   - legacy redirects            : /user/server/* → /server/:uuid
 *   - static regression           : /favicon.ico still served by Nitro
 *
 * Run: node web/arclight-smoke-phase5.mjs   (from the repo root)
 */
import { spawn } from 'node:child_process'
import { createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import net from 'node:net'
import path from 'node:path'
import Database from 'better-sqlite3'
import { sign } from 'cookie-signature'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-smoke-phase5-'))
const dbPath = path.join(tmpDir, 'smoke.db')
const SECRET = 's'.repeat(64)

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

  CREATE TABLE IF NOT EXISTS "Addon" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT,
    version TEXT NOT NULL, author TEXT, enabled BOOLEAN NOT NULL DEFAULT true,
    mainFile TEXT NOT NULL DEFAULT 'index.ts',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "ActivityLog" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    actorId INTEGER, serverId TEXT, event TEXT NOT NULL, metadata TEXT,
    ip TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)
db.prepare(`INSERT OR IGNORE INTO "settings" (id) VALUES (1)`).run()
db.prepare(
  `INSERT OR IGNORE INTO "Users" (id, email, username, password, isAdmin, role, description)
   VALUES (1, 'admin@x.io', 'admin', 'x', 1, 'admin', '')`,
).run()

// ── Admin session + CSRF minted directly (same contract as auth-session.ts) ──
const sid = randomBytes(16).toString('hex')
const csrfSessionId = randomBytes(16).toString('hex')
const rnd = randomBytes(32).toString('hex')
const token = `${createHmac('sha256', SECRET)
  .update([csrfSessionId.length, csrfSessionId, rnd.length, rnd].join('!'))
  .digest('hex')}.${rnd}`
db.prepare(
  `INSERT INTO "Session" (id, session_id, data, expires, createdAt, updatedAt)
   VALUES (?, ?, ?, datetime('now', '+1 day'), datetime('now'), datetime('now'))`,
).run(
  randomBytes(8).toString('hex'),
  sid,
  JSON.stringify({
    user: { id: 1, email: 'admin@x.io', isAdmin: true, username: 'admin' },
    csrfSessionId,
    cookie: { httpOnly: true, path: '/' },
  }),
)
// Production cookie name (NODE_ENV=production below): __Host-psifi.x-csrf-token.
const AUTH_COOKIE = `connect.sid=s:${sign(sid, SECRET)}; __Host-psifi.x-csrf-token=${token}`

// Boot the PRODUCTION LAUNCHER — the whole server, no Express anywhere.
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
  for (let i = 0; i < 120; i++) {
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
  check('launcher = whole server (no Express child) boots', booted)
  if (!booted) {
    console.log(childLog.slice(-2000))
    cleanup()
    process.exit(1)
  }

  // 1. Addon bridge — the express-SDK addons run inside Nitro. Anonymous calls
  //    are answered by the ADDON's own middleware (the modrinth admin guard
  //    sees req.path '/' inside its sub-router and redirects — its pre-existing
  //    behavior, D3 parity), never by the TanStack SSR shell.
  {
    const anon = await fetch(`${BASE}/modrinth/api/config`, { redirect: 'manual' })
    check('bridge: /modrinth/api/config anonymous → addon 302 /login',
      anon.status === 302 && (anon.headers.get('location') || '').startsWith('/login'),
      `got ${anon.status} ${anon.headers.get('location')}`)
    await anon.arrayBuffer()

    const admin = await fetch(`${BASE}/modrinth/api/config`, {
      headers: { cookie: AUTH_COOKIE },
    })
    const body = await admin.json()
    check('bridge: /modrinth/api/config with admin session → 200 JSON',
      admin.status === 200 && body.success === true,
      `got ${admin.status} ${JSON.stringify(body).slice(0, 80)}`)

    const progress = await fetch(`${BASE}/modrinth/api/progress`, {
      headers: { cookie: AUTH_COOKIE },
    })
    const pBody = await progress.json()
    check('bridge: /modrinth/api/progress with admin session → 200 JSON',
      progress.status === 200 && pBody.success === true,
      `got ${progress.status} ${JSON.stringify(pBody).slice(0, 80)}`)
  }

  // 2. v3 UI manifest (byte-identical shape — what registry.tsx consumes).
  {
    const res = await fetch(`${BASE}/api/addons/ui`)
    const { addons } = await res.json()
    const modrinth = addons.find((a) => a.slug === 'modrinth')
    check('ui manifest: /api/addons/ui → 200 with modrinth entry',
      res.status === 200 && !!modrinth,
      `got ${res.status} addons=${addons.map((a) => a.slug).join(',')}`)
    check('ui manifest: modrinth bundles + apiPaths + routes (D3 shape)',
      !!modrinth &&
        modrinth.bundles.includes('/addon-assets/modrinth/ui/bundle.mjs') &&
        modrinth.apiPaths.includes('/modrinth/api/') &&
        modrinth.routes.some((r) => r.path === '/modrinth'),
      JSON.stringify(modrinth).slice(0, 120))
  }

  // 3. Admin addons API — guard + list + toggle (reload unmounts the bridge).
  {
    const anon = await fetch(`${BASE}/admin/addons/list`, { redirect: 'manual' })
    check('admin: /admin/addons/list anonymous → 302 /login',
      anon.status === 302 && (anon.headers.get('location') || '').startsWith('/login'),
      `got ${anon.status} ${anon.headers.get('location')}`)
    await anon.arrayBuffer()

    const list = await fetch(`${BASE}/admin/addons/list`, {
      headers: { cookie: AUTH_COOKIE },
    })
    const data = await list.json()
    check('admin: /admin/addons/list with admin → addons rows',
      list.status === 200 && data.success === true &&
        data.addons.some((a) => a.slug === 'modrinth'),
      `got ${list.status} ${JSON.stringify(data).slice(0, 100)}`)

    const off = await fetch(`${BASE}/admin/addons/toggle/modrinth`, {
      method: 'POST',
      headers: {
        cookie: AUTH_COOKIE,
        'content-type': 'application/json',
        'x-csrf-token': token,
      },
      body: JSON.stringify({ enabled: false }),
    })
    const offBody = await off.json()
    check('admin: toggle modrinth off → success', off.status === 200 && offBody.success === true,
      `got ${off.status} ${JSON.stringify(offBody)}`)

    const unmounted = await fetch(`${BASE}/modrinth/api/config`, {
      headers: { cookie: AUTH_COOKIE },
    })
    const unmountedHtml = await unmounted.text()
    check('admin: disabled modrinth unmounted → SSR shell (not the bridge)',
      unmounted.status === 200 && unmountedHtml.includes('<html'),
      `got ${unmounted.status} ${unmountedHtml.slice(0, 60)}`)

    const on = await fetch(`${BASE}/admin/addons/toggle/modrinth`, {
      method: 'POST',
      headers: {
        cookie: AUTH_COOKIE,
        'content-type': 'application/json',
        'x-csrf-token': token,
      },
      body: JSON.stringify({ enabled: true }),
    })
    const onBody = await on.json()
    check('admin: toggle modrinth back on → success', on.status === 200 && onBody.success === true,
      `got ${on.status} ${JSON.stringify(onBody)}`)

    const remounted = await fetch(`${BASE}/modrinth/api/config`, {
      headers: { cookie: AUTH_COOKIE },
    })
    const remountedBody = await remounted.json()
    check('admin: re-enabled modrinth serves through the bridge again',
      remounted.status === 200 && remountedBody.success === true,
      `got ${remounted.status} ${JSON.stringify(remountedBody).slice(0, 80)}`)
  }

  // 4. Legacy redirects — /user/server/* is gone; bookmarks land on /server/:uuid.
  {
    const index = await fetch(`${BASE}/user/server`, { redirect: 'manual' })
    check('legacy: GET /user/server → 302 /', index.status === 302 && (index.headers.get('location') || '').startsWith('/'),
      `got ${index.status} ${index.headers.get('location')}`)
    await index.arrayBuffer()

    const server = await fetch(`${BASE}/user/server/abcd-1234?tab=console`, { redirect: 'manual' })
    check('legacy: GET /user/server/:uuid → 302 /server/:uuid (query kept)',
      server.status === 302 &&
        (server.headers.get('location') || '') === '/server/abcd-1234?tab=console',
      `got ${server.status} ${server.headers.get('location')}`)
    await server.arrayBuffer()
  }

  // 5. Static regression — Phase 4 surface still Nitro-owned.
  {
    const favicon = await fetch(`${BASE}/favicon.ico`)
    check('static: /favicon.ico → 200', favicon.status === 200, `got ${favicon.status}`)
    await favicon.arrayBuffer()
  }

  console.log(`\nPhase 5 smoke (Express deleted): ${pass} passed, ${fail} failed`)
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
