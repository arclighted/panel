/**
 * Arclight panel production server.
 *
 * Spawns the TanStack Start (Nitro) server on `APP_INTERNAL_PORT` and proxies
 * API/legacy paths to the Express panel on `PANEL_INTERNAL_PORT`. Since Phase
 * 3, every WebSocket upgrade is forwarded to the Nitro child (crossws) too.
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
import { loadEnvFile, normalizeDatabaseUrl } from './env-loader.mjs'

// Load .env (repo root) so SESSION_SECRET / DATABASE_URL are available to the
// Nitro child — the same values the Express panel reads (--env-file=.env).
// DATABASE_URL is normalized to an absolute path so root modules bundled into
// the Nitro server (src/db.ts via daemonRequest) resolve the same SQLite file
// from web/ that Express resolves from the repo root.
loadEnvFile()
normalizeDatabaseUrl()

// Production entrypoint: always serve production React builds.
// The repo .env ships NODE_ENV="development"; if that leaks into the Nitro
// child, the SSR bundle resolves react/jsx-runtime to the dev build, whose
// getOwner() calls against the production react-server dispatcher crash every
// page render ("dispatcher.getOwner is not a function").
process.env.NODE_ENV = 'production'

// ── Ports ──────────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3000)
const PANEL_PORT = Number(process.env.PANEL_INTERNAL_PORT ?? 3001)
const PANEL_HOST = process.env.PANEL_INTERNAL_HOST ?? '127.0.0.1'
const APP_PORT = Number(process.env.APP_INTERNAL_PORT ?? 3002)
const APP_HOST = process.env.APP_INTERNAL_HOST ?? '127.0.0.1'

// ── Proxy path prefixes (must match proxy.config.ts) ───────────────────────

// Phase 3: '/ws' and '/console' were removed — Nitro owns every WebSocket
// (realtime bus, online-check, console/status/events proxies). WS upgrades
// are routed to the Nitro child below; no Express HTTP surface remains under
// those prefixes.
const API_PREFIXES = [
  '/api',
  '/addon-assets',
  '/avatar',
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
  // full EJS pages (legacy server management). Auth pages and logout are
  // owned by the TanStack app / Nitro and must NOT be proxied.
  '/user/server',
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

// Phase 2: Nitro owns the auth mutations (POST /login, /register, /2fa) and
// GET /logout — the query string is stripped so ?err=… never breaks matching.
// Kept in sync with web/proxy.config.ts NITRO_OWNED_PATHS.
const NITRO_OWNED_PREFIXES = [
  '/api/auth-config',
  '/login',
  '/register',
  '/2fa',
  '/logout',
  // Phase 2 group 4: ported admin mutation + read surfaces (ALL methods).
  // /admin/addons/* stays Express-owned (addon runtime needs the Express app
  // instance). Kept in sync with web/proxy.config.ts NITRO_OWNED_PATHS.
  '/admin/users',
  '/admin/nodes',
  '/admin/node',
  '/admin/servers',
  '/admin/server',
  '/admin/apikeys',
  '/admin/databases',
  '/admin/mounts',
  '/admin/locations',
  '/admin/location',
  '/admin/settings',
  '/admin/radar',
  '/admin/images',
  '/admin/check-update',
  '/admin/perform-update',
  '/api/admin/playerstats',
  '/api/admin/analytics',
  // Phase 2 group 5: Nitro owns the ported external APIs (api/v1 + client)
  // for ALL methods — Bearer/api-key auth via the apiValidator twin, no
  // session needed. Kept in sync with web/proxy.config.ts.
  '/api/v1',
  '/api/client',
  // Phase 2 group 6: Nitro owns the user-facing create-server, my-images and
  // avatar surfaces for ALL methods. GET /create-server and GET /my-images are
  // TanStack pages (Nitro renders them); POST/DELETE hit the Nitro twins. The
  // /api/my-images GET (edit payload) is a Nitro read.
  '/create-server',
  '/my-images',
  '/api/my-images',
  '/upload-avatar',
  '/remove-avatar',
]

// Phase 2 group 2: read/context endpoints Nitro owns for GET only. Sibling
// mutations under the same prefixes stay Express-owned. Kept in sync with
// web/proxy.config.ts NITRO_OWNED_GET_PATHS.
const NITRO_OWNED_GET_PREFIXES = [
  '/api/account/context',
  '/api/folders',
  '/api/create-server/context',
  '/api/system/status',
  '/api/admin/context',
  '/api/admin/page',
]

// /api/server/:id/{context,settings,startup,databases,schedules,backups,
// subusers,worlds} are dynamic — matched structurally so the sibling
// /api/server/:id/* mutations stay Express-owned. All of these are GET reads;
// the tab mutations live under /server/:id/* (no /api prefix).
const NITRO_OWNED_SERVER_GET_RE =
  /^\/api\/server\/[^/]+\/(?:context|settings|startup|databases|schedules|backups|subusers|worlds)$/

function isNitroOwnedPath(url, method) {
  const path = (url ?? '').split('?')[0]
  // Phase 2 group 3: the ENTIRE /server/:id/* namespace is Nitro-owned now
  // (TanStack pages + Nitro API twins for console/files/tab CRUD). Kept in
  // sync with web/proxy.config.ts isNitroOwnedPath.
  if (path === '/server' || path.startsWith('/server/')) {
    return true
  }
  if (NITRO_OWNED_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    return true
  }
  const m = (method ?? 'GET').toUpperCase()
  // Phase 2 group 6: user self-delete of a server is Nitro-owned (DELETE
  // only — GET /user/server/* pages are still legacy EJS on Express). Kept in
  // sync with web/proxy.config.ts isNitroOwnedPath.
  if (m === 'DELETE' && /^\/user\/server\/[^/]+$/.test(path)) {
    return true
  }
  const isGet = m === 'GET' || m === 'HEAD' || m === 'OPTIONS'
  if (!isGet) return false
  if (NITRO_OWNED_GET_PREFIXES.some(p => path === p || path.startsWith(p + '/'))) {
    return true
  }
  return NITRO_OWNED_SERVER_GET_RE.test(path)
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
process.on('SIGTERM', () => {
  child.kill()
  // Default SIGTERM behavior is overridden by the handler above; exit
  // explicitly so systemd / process managers see a clean stop instead of a
  // launcher that outlives its child and keeps the port bound.
  process.exit(0)
})
process.on('SIGINT', () => {
  child.kill()
  process.exit(0)
})

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
  // Nitro-owned paths (Phase 1 + 2 + 2 group 2) are handled by the TanStack
  // app: GET /api/auth-config (session+CSRF), GET /logout, the auth mutations
  // POST /login, /register, /2fa, and the GET-only context endpoints
  // (/api/account/context, /api/folders, /api/create-server/context,
  // /api/system/status, /api/admin/context, /api/admin/page/*,
  // /api/server/:id/context). Everything else follows the legacy seam:
  // Express stays the mutation authority for non-GET requests (session + CSRF
  // state only it can validate) and owns the proxy paths.
  if (isNitroOwnedPath(req.url, req.method)) {
    proxyHttp(req, res, APP_HOST, APP_PORT) // TanStack / Nitro app
    return
  }

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
// Phase 3: Nitro owns every panel WebSocket (realtime bus, online-check
// presence, and the console/status/events proxies), so ALL panel WS upgrades
// are forwarded to the TanStack (Nitro) child, which runs crossws when
// features.websocket is enabled. Express WS is retired. Kept in sync with
// web/proxy.config.ts (no WS entries there anymore) and the route files under
// server/routes (ws/realtime.ts, online-check.ts, console/[id].ts,
// status/[id].ts, events/[id].ts).

const WS_UPGRADE_PREFIXES = [
  '/ws',
  '/console',
  '/status',
  '/events',
  '/online-check',
]

server.on('upgrade', (req, socket, head) => {
  const path = (req.url ?? '').split('?')[0]
  if (!WS_UPGRADE_PREFIXES.some((p) => path === p || path.startsWith(p + '/'))) {
    socket.destroy()
    return
  }

  const proxy = net.connect(APP_PORT, APP_HOST, () => {
    // Reconstruct the upgrade request and forward it to the Nitro child
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