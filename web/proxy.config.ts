/**
 * Shared proxy configuration for the Arclight panel frontend.
 *
 * During development (Vite) and production (custom Node server), requests to
 * these paths are forwarded to the Express panel running on PANEL_INTERNAL_PORT.
 *
 * The URL-seam: unmigrated legacy page prefixes are listed here and proxied to
 * Express, which renders them as EJS. As pages migrate (§MIGRATION_PLAN.md 5.2),
 * their prefix is removed from PANEL_PROXY_PATHS and added as a TanStack route.
 */

export const PANEL_INTERNAL_PORT = Number(
  process.env.PANEL_INTERNAL_PORT ?? 3001,
)
export const PANEL_INTERNAL_HOST =
  process.env.PANEL_INTERNAL_HOST ?? '127.0.0.1'
export const PANEL_INTERNAL_URL = `http://${PANEL_INTERNAL_HOST}:${PANEL_INTERNAL_PORT}`

/**
 * Legacy static paths that Express serves from `public/` — proxy these for any
 * passthrough page that references them.
 */
export const STATIC_PROXY_PATHS = [
  '/favicon.ico',
  '/javascript',
  '/js',
  '/fonts',
  '/styles',
  '/styles.css',
  '/themes',
  '/uploads',
  '/assets',
  '/addons',
  '/monaco',
  '/tw.css',
  '/layout-animations.css',
  // NOTE: NOT a bare `/vendor` — only the specific subpaths Express serves
  // from node_modules for legacy EJS pages. The broad `/vendor` would
  // intercept the TanStack app's vendor runtime files (`/vendor/*.mjs`)
  // which Express has no copy of. New runtime files live in web/public/vendor/
  // and are served by Vite (dev) / Nitro (prod).
  '/vendor/xterm',
  '/vendor/marked',
  '/vendor/xterm-addon-fit',
  '/vendor/xterm-addon-web-links',
  '/vendor/chartjs',
  '/monaco-editor',
  '/xterm',
  '/marked',
  '/chart.js',
] as const

/**
 * API paths proxied to Express unchanged.
 *
 * Phase 3: `/ws`, `/console`, `/status`, `/events` and `/online-check` are
 * intentionally NOT here — Nitro owns every WebSocket now (the realtime bus,
 * online-check presence, and the console/status/events proxies). Removing
 * `/ws` and `/console` from this list lets WS upgrades fall through to the
 * Nitro dev server's crossws upgrade handler (`features.websocket`), the
 * same path every other migrated endpoint takes.
 *
 * Addon v3 API prefixes (the addon manifest's `ui.apiPaths`) must be listed
 * here so addon React UIs can call their own Express routers — the Nitro splat
 * route owns every other path. Kept in sync with web/server/index.mjs.
 */
export const API_PROXY_PATHS = [
  '/api',
  '/addon-assets',
  '/avatar',
  // Addon v3 apiPaths:
  '/arclight-cloud/api',
  '/modrinth/api',
] as const

/**
 * True when a GET under `/server/` is served by the TanStack app instead of
 * Express. Migrated server pages: `/server/:uuid` (console), `/files`, the
 * seven tab pages, `/worlds`, `/players`, and the file editor
 * `/files/edit/{*path}` (any query string). Every other `/server/:uuid/*`
 * path — tab sub-APIs, ws-token, and the file APIs — still belongs to
 * Express. Kept in sync with web/server/index.mjs.
 */
const MIGRATED_SERVER_TABS = new Set([
  'files',
  'settings',
  'startup',
  'logs',
  'databases',
  'schedules',
  'backups',
  'subusers',
  'worlds',
  'players',
])

export function isMigratedServerPage(url: string): boolean {
  if (!url.startsWith('/server/')) return false
  const rest = url.slice('/server/'.length).split('?')[0]
  const afterUuid = rest.split('/').slice(1).join('/')
  if (afterUuid === '' || MIGRATED_SERVER_TABS.has(afterUuid)) return true
  // The file editor lives at /server/:uuid/files/edit/{*path} (splat).
  return afterUuid.startsWith('files/edit')
}

/**
 * Unmigrated legacy page prefixes (URL seam). These paths are served by Express
 * as full EJS pages on GET. Remove each prefix from this list when its
 * TanStack route is ready (the route then owns GETs; non-GETs always go to
 * Express regardless of this list — see createProxyConfig / server/index.mjs).
 * (logout migrated to Nitro in Phase 2 — see NITRO_OWNED_PATHS below.)
 */
export const LEGACY_PAGE_PREFIXES = [
  '/user/server',
] as const

/** All proxy paths combined. */
export const ALL_PROXY_PATHS = [
  ...API_PROXY_PATHS,
  ...STATIC_PROXY_PATHS,
  ...LEGACY_PAGE_PREFIXES,
] as const

/**
 * Vite-compatible proxy configuration object (for server.proxy).
 *
 * Note: Vite's path-based proxy only covers GET-style passthrough. Non-GET
 * requests (POST/PUT/DELETE/PATCH) are always forwarded to Express by the
 * `proxyMutationsToExpress` plugin in vite.config.ts, because Express is the
 * mutation authority (CSRF + session) for every endpoint, including those that
 * share a path with a migrated TanStack route (e.g. POST /login).
 */
export const NITRO_OWNED_PATHS = [
  '/api/auth-config',
  // Phase 2: Nitro owns the auth mutations and logout for ALL methods
  // (dev proxyToExpress and prod server/index.mjs both route these to Nitro).
  '/login',
  '/register',
  '/2fa',
  '/logout',
  // Phase 2 group 4: Nitro owns the ported admin mutation + read surfaces
  // for ALL methods. /admin/addons/* is intentionally NOT here — the addon
  // runtime (toggle/uninstall/reload) needs the Express app instance, so it
  // stays Express-owned. Kept in sync with web/server/index.mjs.
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
  // session needed. Kept in sync with web/server/index.mjs.
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
] as const

/**
 * Phase 2 group 2: read/context endpoints Nitro owns for GET only. Sibling
 * mutations under the same prefixes (POST /api/folders, PATCH/DELETE
 * /api/folders/:id, POST /api/system/test-node-connection, and the
 * /api/server/:id tab sub-APIs) must still reach Express.
 */
export const NITRO_OWNED_GET_PATHS = [
  '/api/account/context',
  '/api/folders',
  '/api/create-server/context',
  '/api/system/status',
  '/api/admin/context',
  '/api/admin/page',
] as const

// /api/server/:id/{context,settings,startup,databases,schedules,backups,
// subusers,worlds} are dynamic — matched structurally (not by prefix) so
// sibling /api/server/:id/* mutations stay Express-owned. All of these are
// GET reads; the tab mutations live under /server/:id/* (no /api prefix) so
// GET-only ownership never shadows them.
const NITRO_OWNED_SERVER_GET_RE =
  /^\/api\/server\/[^/]+\/(?:context|settings|startup|databases|schedules|backups|subusers|worlds)$/

export function isNitroOwnedPath(p: string, method = 'GET'): boolean {
  // Phase 2 group 3: the ENTIRE /server/:id/* namespace is Nitro-owned now.
  // Pages (console, files, editor, all tab pages) are TanStack routes; every
  // API under /server/:id/* — console/power/status/logs/ws-token/players/
  // eula, the whole files surface, and all tab CRUD mutations — has a Nitro
  // twin (web/server/routes/server). Nothing under /server/ needs Express
  // anymore, so claim it for all methods (pages + GETs + mutations alike).
  if (p === '/server' || p.startsWith('/server/')) {
    return true
  }
  if (NITRO_OWNED_PATHS.some(prefix => p === prefix || p.startsWith(prefix + '/'))) {
    return true
  }
  // Phase 2 group 6: user self-delete of a server is Nitro-owned (DELETE
  // only — GET /user/server/* pages are still legacy EJS on Express).
  if (method === 'DELETE' && /^\/user\/server\/[^/]+$/.test(p)) {
    return true
  }
  const isGet = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
  if (!isGet) return false
  if (NITRO_OWNED_GET_PATHS.some(prefix => p === prefix || p.startsWith(prefix + '/'))) {
    return true
  }
  return NITRO_OWNED_SERVER_GET_RE.test(p)
}

/**
 * Vite treats proxy keys starting with `^` as regexes (first matching key in
 * insertion order wins). `/api` is a broad prefix that would also swallow the
 * Nitro-owned `/api/auth-config` route, so the `/api` entry is emitted as a
 * regex that excludes every Nitro-owned `/api/*` path — those GETs fall
 * through to the TanStack (Nitro) dev middleware instead of Express.
 */
function nitroApiProxyKey(): string {
  // The key MUST start with `^` for Vite's proxy to treat it as a regex
  // (first matching key wins in insertion order). Each excluded entry is the
  // path AFTER `/api/` (e.g. `auth-config`), escaped for the regex, so the
  // negative lookahead checks the text right after the consumed `/api`.
  // GET-only group-2 endpoints are excluded too, plus the dynamic
  // /api/server/:id/context shape, so those GETs fall through to Nitro.
  const excluded = [...NITRO_OWNED_PATHS, ...NITRO_OWNED_GET_PATHS]
    .filter((p) => p.startsWith('/api/'))
    .map((p) => p.slice('/api/'.length).replace(/\//g, '\\/'))
  excluded.push(
    'server/[^/]+/(?:context|settings|startup|databases|schedules|backups|subusers|worlds)'.replace(/\//g, '\\/'),
  )
  return `^\\/api(?!\\/${excluded.join('|')})`
}

export function createProxyConfig(): Record<string, string | { target: string; changeOrigin: boolean }> {
  const config: Record<string, string | { target: string; changeOrigin: boolean }> = {}

  // Phase 3: no Express-owned WebSocket paths remain (see API_PROXY_PATHS), so
  // no proxy entry needs the `ws: true` upgrade flag — WS upgrades fall
  // through to the Nitro dev server's crossws handler.
  for (const path of API_PROXY_PATHS) {
    const key = path === '/api' ? nitroApiProxyKey() : path
    config[key] = {
      target: PANEL_INTERNAL_URL,
      changeOrigin: true,
    }
  }

  // Static and legacy page paths use simple target string
  for (const path of [...STATIC_PROXY_PATHS, ...LEGACY_PAGE_PREFIXES]) {
    config[path] = PANEL_INTERNAL_URL
  }

  return config
}