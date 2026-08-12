/**
 * Phase 4 smoke: static surface now owned by Nitro.
 *
 * Boots the PRODUCTION launcher (web/server/index.mjs) — Express is
 * intentionally NOT running — so every static request flows through the
 * launcher's routing into the Nitro child (02.static middleware + the
 * /avatar/:seed and /addon-assets/:slug routes). Verifies:
 *   - root public/ : /favicon.ico, /tw.css, /styles.css, /assets/wallpapers/*,
 *                    /themes/* (builtin + user themes)
 *   - /avatar/:seed          : SVG avatar, 400 on an invalid seed
 *   - /addon-assets/:slug/*  : modrinth ui bundle + stylesheet, 404 on junk
 *   - fallthrough            : a missing file lands on the SSR shell (200),
 *                              never a 500 — and client chunks keep loading
 *
 * Run: node web/arclight-smoke-phase4.mjs   (from the repo root)
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import net from 'node:net'
import path from 'node:path'
import Database from 'better-sqlite3'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-smoke-phase4-'))
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
`)
db.prepare(`INSERT OR IGNORE INTO "settings" (id) VALUES (1)`).run()

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
  check('launcher + Nitro child boot', booted)
  if (!booted) {
    console.log(childLog.slice(-2000))
    cleanup()
    process.exit(1)
  }

  // 1. Root public/ surface (was express.static(public)).
  {
    for (const [p, ct] of [
      ['/favicon.ico', 'image/'],
      ['/tw.css', 'text/css'],
      ['/styles.css', 'text/css'],
      ['/assets/wallpapers/login.jpeg', 'image/jpeg'],
      ['/themes/default-dark.css', 'text/css'],
      ['/themes/default-light.css', 'text/css'],
    ]) {
      const res = await fetch(`${BASE}${p}`)
      check(`static ${p} → 200 ${ct}`, res.status === 200 && (res.headers.get('content-type') || '').includes(ct),
        `got ${res.status} ${res.headers.get('content-type')}`)
      await res.arrayBuffer()
    }
  }

  // 2. Conditional caching — ETag + 304.
  {
    const first = await fetch(`${BASE}/tw.css`)
    const etag = first.headers.get('etag')
    await first.arrayBuffer()
    const second = await fetch(`${BASE}/tw.css`, { headers: { 'if-none-match': etag || '' } })
    check('tw.css: ETag → 304 on If-None-Match', etag && second.status === 304,
      `etag=${etag} second=${second.status}`)
    await second.arrayBuffer()
  }

  // 3. /avatar/:seed — local dicebear SVG.
  {
    const res = await fetch(`${BASE}/avatar/radityra`)
    const body = await res.text()
    check('avatar: SVG for valid seed', res.status === 200 && body.includes('<svg'),
      `got ${res.status} ct=${res.headers.get('content-type')}`)
    const bad = await fetch(`${BASE}/avatar/a%00b`)
    check('avatar: NUL seed → 400', bad.status === 400, `got ${bad.status}`)
    await bad.arrayBuffer()
  }

  // 4. /addon-assets/:slug/* — addon public dirs (modrinth ships a ui/ dir).
  {
    const modrinthUi = path.join(process.cwd(), 'storage', 'addons', 'modrinth', 'public', 'ui')
    if (existsSync(modrinthUi)) {
      const bundle = await fetch(`${BASE}/addon-assets/modrinth/ui/bundle.mjs`)
      check('addon-assets: modrinth ui bundle → 200', bundle.status === 200,
        `got ${bundle.status}`)
      await bundle.arrayBuffer()
      const css = await fetch(`${BASE}/addon-assets/modrinth/ui/styles.css`)
      check('addon-assets: modrinth ui styles.css → 200', css.status === 200, `got ${css.status}`)
      await css.arrayBuffer()
    } else {
      check('addon-assets: modrinth ui dir present (fixture)', false, 'missing')
    }
    const junk = await fetch(`${BASE}/addon-assets/does-not-exist/ui/x.mjs`)
    check('addon-assets: unknown addon → 404', junk.status === 404, `got ${junk.status}`)
    await junk.arrayBuffer()
  }

  // 5. Fallthrough — missing files land on the SSR shell, never a 500; the
  //    baked client chunks (/assets/*.js) must still resolve to Nitro assets.
  {
    const missing = await fetch(`${BASE}/assets/definitely-not-a-file.js`)
    check('fallthrough: missing /assets file → 200 SSR shell', missing.status === 200,
      `got ${missing.status}`)
    await missing.arrayBuffer()

    const index = await fetch(`${BASE}/`)
    const html = await index.text()
    // The TanStack shell (RootDocument) renders children directly — no
    // <div id="root"> mount element. Assert on the SSR markers instead.
    check('fallthrough: app root renders',
      index.status === 200 && html.includes('<html lang="en"') && html.includes('importmap'),
      `got ${index.status} ${html.slice(0, 60)}`)
  }

  console.log(`\nPhase 4 static smoke: ${pass} passed, ${fail} failed`)
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
