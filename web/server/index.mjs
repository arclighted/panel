/**
 * Arclight panel production server.
 *
 * Spawns the TanStack Start (Nitro) server on `APP_INTERNAL_PORT` and proxies
 * API/WS/legacy paths to the Express panel on `PANEL_INTERNAL_PORT`.
 * Listens on `PORT` (default 3000).
 *
 * Used via: node web/server/index.mjs
 * (wired to `pnpm run start:web` / `arclight-web.service`)
 *
 * Proxy paths are kept in sync with web/proxy.config.ts — update both files
 * when adding / removing a legacy proxy prefix.
 */

import http from 'node:http'
import net from 'node:net'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { loadEnvFile } from './env-loader.mjs'

// Load .env (repo root) so SESSION_SECRET / DATABASE_URL are available to the
// Nitro child — the same values the Express panel reads (--env-file=.env).
loadEnvFile()

// ── Ports ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000)
const PANEL_PORT = Number(process.env.PANEL_INTERNAL_PORT ?? 3001)
const PANEL_HOST = process.env.PANEL_INTERNAL_HOST ?? '127.0.0.1'
const APP_PORT = Number(process.env.APP_INTERNAL_PORT ?? 3002)
const APP_HOST = process.env.APP_INTERNAL_HOST ?? '127.0.0.1'

// ── Proxy path prefixes (must match proxy.config.ts) ───────────────────────

const API_PREFIXES = [
  '/api',
  '/ws',
  '/console',
  '/addon-assets',
  '/avatar',
  '/admin/images/export',
  // Addon v3 apiPaths (kept in sync with web/proxy.config.ts):
  '/arclight-cloud/api',
  '/modrinth/api',
]

const STATIC_PREFIXES = [
  '/favicon.ico', '/javascript', '/js', '/fonts', '/styles',
  '/styles.css', '/themes', '/uploads', '/assets', '/addons',
  '/monaco', '/tw.css', '/layout-animations.css',
  // NOT a bare /vendor — see proxy.config.ts for the reasoning. Express
  // serves these node_modules subpaths for legacy EJS pages; the TanStack
  // app serves the new v3 runtime files from /vendor/*.mjs (Nitro public).
  '/vendor/xterm', '/vendor/marked', '/vendor/xterm-addon-fit',
  '/vendor/xterm-addon-web-links', '/vendor/chartjs',
  '/monaco-editor', '/xterm', '/marked', '/chart.js',
]

const LEGACY_PAGE_PREFIXES = [
  // Kept in sync with proxy.config.ts: only paths Express still renders as
  // full EJS pages (logout redirect + legacy server management). Auth pages
  // (login/register/2fa/…) are TanStack routes and must NOT be proxied.
  '/logout', '/user/server',
]

const ALL_PROXY_PREFIXES = [...API_PREFIXES, ...STATIC_PREFIXES, ...LEGACY_PAGE_PREFIXES]

// Migrated server pages served by the TanStack app: `/server/:uuid` (console),
// `/server/:uuid/files` (file manager), the seven tab pages, worlds, players,
// and the file editor splat. Everything else under `/server/` (tab sub-APIs,
// ws-token, file APIs) belongs to Express. Kept in sync with
// web/proxy.config.ts isMigratedServerPage.
const MIGRATED_SERVER_TABS = new Set([
  'files', 'settings', 'startup', 'logs',
  'databases', 'schedules', 'backups', 'subusers',
  'worlds', 'players',
])

function isMigratedServerPage(url) {
  if (!url.startsWith('/server/')) return false
  const rest = url.slice('/server/'.length).split('?')[0]
  const afterUuid = rest.split('/').slice(1).join('/')
  if (afterUuid === '' || MIGRATED_SERVER_TABS.has(afterUuid)) return true
  // The file editor lives at /server/:uuid/files/edit/{*path} (splat).
  return afterUuid.startsWith('files/edit')
}

const NITRO_OWNED_PREFIXES = ['/api/auth-config']

function isNitroOwnedPath(url) {
  return NITRO_OWNED_PREFIXES.some(p => url === p || url.startsWith(p + '/'))
}

function isProxyPath(url) {
  if (isNitroOwnedPath(url)) return false
  if (ALL_PROXY_PREFIXES.some((p) => url.startsWith(p))) return true
  return url.startsWith('/server/') && !isMigratedServerPage(url)
}

// ── Start Nitro (TanStack Start) server as child ───────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url))
const nitroEntry = join(__dirname, '..', '.output', 'server', 'index.mjs')

const child = spawn(process.execPath, [nitroEntry], {
  env: { ...process.env, PORT: String(APP_PORT), NITRO_PORT: String(APP_PORT) },
  stdio: 'inherit',
  cwd: join(__dirname, '..'),
})

process.on('exit', () => child.kill())
process.on('SIGTERM', () => child.kill())
process.on('SIGINT', () => child.kill())

// ── Shared HTTP proxy helper ───────────────────────────────────────────────

function proxyHttp(req, res, targetHost, targetPort) {
  const proxyReq = http.request(
    {
      host: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: { ...req.headers },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
      proxyRes.pipe(res)
    },
  )
  proxyReq.on('error', () => {
    res.writeHead(502)
    res.end('Proxy Error')
  })
  req.pipe(proxyReq)
}

// ── HTTP server ────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  // Express is the mutation authority: non-GET requests always go to Express
  // (they carry session + CSRF state only Express can validate), even when the
  // path is a migrated TanStack GET route (e.g. POST /login).
  const method = (req.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
    proxyHttp(req, res, PANEL_HOST, PANEL_PORT)
    return
  }

  if (isProxyPath(req.url)) {
    proxyHttp(req, res, PANEL_HOST, PANEL_PORT) // Express panel
  } else {
    proxyHttp(req, res, APP_HOST, APP_PORT) // TanStack / Nitro app
  }
})

// ── WebSocket upgrade forwarding ───────────────────────────────────────────

server.on('upgrade', (req, socket, head) => {
  // Only forward upgrades for panel WS paths (e.g. /ws, /console or /api WS
  // endpoints). The console socket lives at /console/:id?token=...
  if (
    !(req.url.startsWith('/ws') || req.url.startsWith('/api') || req.url.startsWith('/console'))
  ) {
    socket.destroy()
    return
  }

  const proxy = net.connect(PANEL_PORT, PANEL_HOST, () => {
    // Reconstruct the upgrade request and forward it to Express
    const requestHead = [
      `${req.method} ${req.url} HTTP/${req.httpVersion}`,
      ...Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`),
      '',
      '',
    ].join('\r\n')

    proxy.write(requestHead)
    if (head.length) proxy.write(head)

    // Transparent bidirectional pipe once the upgrade completes
    proxy.pipe(socket)
    socket.pipe(proxy)
  })

  proxy.on('error', () => socket.destroy())
  socket.on('error', () => proxy.destroy())
})

// ── Listen ─────────────────────────────────────────────────────────────────

server.listen(PORT, () => {
  console.log(`[arclight-web] Listening on :${PORT}`)
  console.log(`  Express panel → http://${PANEL_HOST}:${PANEL_PORT}`)
  console.log(`  TanStack app  → http://${APP_HOST}:${APP_PORT}`)
})