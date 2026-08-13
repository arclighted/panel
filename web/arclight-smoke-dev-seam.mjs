/**
 * Phase 7 dev-seam smoke: the DEVELOPMENT topology end-to-end.
 *
 * Phase 3/4/5 smokes booted the production launcher (web/server/index.mjs).
 * The plan explicitly flagged the DEV seam as never verified: `pnpm dev` runs
 * the TanStack Start dev server (Vite + Nitro) on one port, and WebSockets
 * must flow through Vite's own upgrade wiring (nitro features.websocket).
 *
 * This smoke boots the REAL dev stack (`node scripts/dev.mjs`) on a free port
 * with a temp SQLite DB + fixed SESSION_SECRET, then with a real `ws` client:
 *   - GET / renders the app shell (dev SSR works)
 *   - /ws/realtime without a session cookie → close 4401
 *   - /ws/realtime with an admin session cookie → realtime.ready + sync
 *   - /api/auth-config with the cookie → 200 (dev API seam intact)
 *
 * Run: node web/arclight-smoke-dev-seam.mjs   (from the repo root)
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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-dev-seam-'))
const dbPath = path.join(tmpDir, 'dev.db')
const SECRET = 'd'.repeat(64)

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
// Vite's dev server binds to `localhost` (IPv6 ::1 on modern Node), so the
// smoke talks to localhost — 127.0.0.1 gets connection-refused.
const HOST = 'localhost'
const BASE = `http://${HOST}:${PORT}`
const WS_BASE = `ws://${HOST}:${PORT}`

let passed = 0
let failed = 0
function check(name, ok, extra = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${name}${extra ? ' — ' + extra : ''}`)
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer(url, timeoutMs = 120_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return true
    } catch {
      /* not up yet */
    }
    await sleep(1500)
  }
  return false
}

// Open the temp DB BEFORE boot so dev.mjs's `prisma migrate deploy` builds the
// real schema; the dev server then opens it too (WAL allows the second
// connection). Seed AFTER the schema exists and the server is up.
const db = new Database(dbPath)

// Boot the REAL dev stack: migrations → prisma generate → tailwind → vite.
const child = spawn(process.execPath, ['scripts/dev.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    DATABASE_URL: `file:${dbPath}`,
    SESSION_SECRET: SECRET,
    URL: BASE,
    NODE_ENV: 'development',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let bootLog = ''
child.stdout.on('data', (d) => {
  bootLog += d
})
child.stderr.on('data', (d) => {
  bootLog += d
})

const up = await waitForServer(`${BASE}/login`)
if (!up) {
  console.log('DEV SERVER NEVER CAME UP. Boot log tail:')
  console.log(bootLog.slice(-4000))
  cleanup()
  process.exit(1)
}
console.log('  (dev stack booted)')

try {
  // Seed now that prisma migrate deploy created the schema.
  db.prepare(
    `INSERT INTO "Users" (email, username, password, isAdmin, role, createdAt, updatedAt)
     VALUES ('admin@x.io', 'admin', 'x', 1, 'admin', datetime('now'), datetime('now'))`,
  ).run()
  db.prepare(`INSERT OR IGNORE INTO "settings" (id) VALUES (1)`).run()
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

  // 1. Page render through the dev server (SSR shell).
  try {
    const res = await fetch(`${BASE}/login`)
    const html = await res.text()
    check('GET /login renders the app shell (dev SSR)', res.status === 200 && html.length > 500)
  } catch (e) {
    check('GET /login renders the app shell (dev SSR)', false, String(e))
  }

  // 2. WS /ws/realtime without a cookie → rejected with 4401.
  await new Promise((resolve) => {
    const ws = new WebSocket(`${WS_BASE}/ws/realtime`)
    const timer = setTimeout(() => {
      check('realtime without cookie → 4401', false, 'timeout, socket stayed open')
      try {
        ws.close()
      } catch {}
      resolve()
    }, 8000)
    ws.on('close', (code) => {
      clearTimeout(timer)
      check('realtime without cookie → 4401', code === 4401, `close code ${code}`)
      resolve()
    })
    ws.on('error', (e) => {
      clearTimeout(timer)
      check('realtime without cookie → 4401', false, String(e))
      resolve()
    })
  })

// 3. WS /ws/realtime with the admin session cookie → realtime.ready on open,
// then realtime.synced after the client issues the sync cursor handshake
// (mirrors the browser client and the phase-3 smoke).
await new Promise((resolve) => {
  const ws = new WebSocket(`${WS_BASE}/ws/realtime`, {
    headers: { cookie: AUTH_COOKIE },
  })
  let ready = false
  let synced = false
  let reported = false
  let timer
  const report = (ok, extra) => {
    if (reported) return
    reported = true
    clearTimeout(timer)
    check('realtime handshake (ready + synced)', ok, extra)
    resolve()
  }
  timer = setTimeout(() => {
    report(ready && synced, `ready=${ready} synced=${synced}`)
    try {
      ws.close()
    } catch {}
  }, 10_000)
  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'sync', sinceSeq: null }))
  })
  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(String(data))
      if (msg.type === 'realtime.ready') ready = true
      if (msg.type === 'realtime.synced') synced = true
      if (ready && synced) report(true, `ready=${ready} synced=${synced}`)
    } catch {}
  })
  ws.on('error', (e) => report(false, String(e)))
  ws.on('close', () => report(ready && synced, `ready=${ready} synced=${synced}`))
})

  // 4. /api/auth-config through the dev seam with the cookie.
  try {
    const res = await fetch(`${BASE}/api/auth-config`, {
      headers: { cookie: AUTH_COOKIE },
    })
    const body = await res.json()
    check(
      'dev API seam: /api/auth-config 200 + session user',
      res.status === 200 && body.user?.email === 'admin@x.io',
      `status ${res.status}`,
    )
  } catch (e) {
    check('dev API seam: /api/auth-config 200 + session user', false, String(e))
  }
} finally {
  cleanup()
}

console.log(`\nPhase 7 dev-seam smoke: ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)

/** Kills the dev stack and removes the temp DB — always runs, even on crash. */
function cleanup() {
  try {
    child.kill('SIGTERM')
  } catch {
    /* already dead */
  }
  try {
    db.close()
  } catch {
    /* already closed */
  }
  setTimeout(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true })
    } catch {
      /* best-effort */
    }
  }, 2500).unref()
}
