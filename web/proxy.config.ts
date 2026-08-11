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
 * API and real-time paths proxied to Express unchanged.
 *
 * `/console` is the panel's WebSocket proxy for container terminal output
 * (browser → panel → daemon). It needs ws: true like `/ws`.
 *
 * Addon v3 API prefixes (the addon manifest's `ui.apiPaths`) must be listed
 * here so addon React UIs can call their own Express routers — the Nitro splat
 * route owns every other path. Kept in sync with web/server/index.mjs.
 */
export const API_PROXY_PATHS = [
  '/api',
  '/ws',
  '/console',
  '/addon-assets',
  '/avatar',
  '/admin/images/export',
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
 */
export const LEGACY_PAGE_PREFIXES = [
  '/logout',
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
] as const

export function isNitroOwnedPath(p: string): boolean {
  return NITRO_OWNED_PATHS.some(prefix => p === prefix || p.startsWith(prefix + '/'))
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
  const excluded = NITRO_OWNED_PATHS
    .filter((p) => p.startsWith('/api/'))
    .map((p) => p.slice('/api/'.length).replace(/\//g, '\\/'))
  return `^\\/api(?!\\/${excluded.join('|')})`
}

export function createProxyConfig(): Record<string, string | { target: string; changeOrigin: boolean; ws: boolean }> {
  const config: Record<string, string | { target: string; changeOrigin: boolean; ws: boolean }> = {}

  // API and WS paths need ws: true for WebSocket upgrade forwarding
  for (const path of API_PROXY_PATHS) {
    const key = path === '/api' ? nitroApiProxyKey() : path
    config[key] = {
      target: PANEL_INTERNAL_URL,
      changeOrigin: true,
      ws: path === '/ws',
    }
  }

  // Static and legacy page paths use simple target string
  for (const path of [...STATIC_PROXY_PATHS, ...LEGACY_PAGE_PREFIXES]) {
    config[path] = PANEL_INTERNAL_URL
  }

  return config
}