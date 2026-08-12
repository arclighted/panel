/**
 * Nitro middleware: serves the ROOT `public/` static surface (Phase 4),
 * replacing the Express `express.static(public/)` mount that the launcher
 * proxied. Runs after 01.session (alphabetical order) and BEFORE Nitro's own
 * baked-asset handler, so:
 *
 *   - /assets/wallpapers/*, /assets/world_icons/* (root public/assets) → here
 *   - /themes/* builtin themes (root public/themes) + user themes
 *     (storage/themes) → here
 *   - /uploads/favicons/* (root public/uploads) → here
 *   - /favicon.ico, /styles.css, /tw.css, /layout-animations.css, the legacy
 *     /javascript /js /styles /fonts /monaco /addons dirs → here (parity with
 *     the old express.static mount — nothing else references them)
 *   - everything NOT on disk (client chunks in .output/public/assets, /vendor,
 *     /arclight-ui, SSR pages) → falls through to Nitro's baked assets / the
 *     TanStack catch-all, exactly like today.
 *
 * Uploads written by the Nitro twins (upload-avatar → web/public/uploads,
 * admin settings → web/public/uploads) are served from the LIVE web/public
 * dir (stripPrefix /uploads) — not the baked .output copy — so runtime writes
 * are visible in production. Mirrors the Phase 2 upload layout.
 */
import { defineEventHandler, serveStatic } from 'h3'
import path from 'node:path'
import { projectRoot } from '../utils/paths'
import { createFsStatic } from '../utils/static-fs'

const root = projectRoot()

// Root public/ — the old express.static(public) surface, 1:1.
const rootMount = createFsStatic(path.join(root, 'public'))
// User-installed themes live in storage/themes but are exposed as /themes/*.
const userThemesMount = createFsStatic(path.join(root, 'storage', 'themes'), {
  stripPrefix: '/themes',
})
// Live uploads (avatars, favicons, wallpapers) are written by the Nitro twins
// into web/public/uploads (process.cwd() = web/ in dev AND prod).
const webUploadsMount = createFsStatic(
  path.join(process.cwd(), 'public', 'uploads'),
  { stripPrefix: '/uploads' },
)

function serveFrom(mount: ReturnType<typeof createFsStatic>) {
  return (event: Parameters<typeof serveStatic>[0]) =>
    serveStatic(event, {
      getMeta: mount.getMeta,
      getContents: mount.getContents,
      fallthrough: true,
      indexNames: [],
      // express.static parity: the old mount sent `Cache-Control: public,
      // max-age=0` — revalidate via ETag/Last-Modified, never serve stale.
      headers: { 'cache-control': 'public, max-age=0' },
    })
}

const serveRoot = serveFrom(rootMount)
const serveUserThemes = serveFrom(userThemesMount)
const serveWebUploads = serveFrom(webUploadsMount)

export default defineEventHandler(async (event) => {
  const pathname = event.url.pathname

  // Root public/ serves everything that exists there (parity with
  // express.static). Client build chunks under /assets/*.js are NOT in the
  // root public dir → fall through to Nitro's baked assets.
  if (pathname === '/assets' || pathname.startsWith('/assets/')) {
    return serveRoot(event)
  }

  // /themes/* → root public/themes (builtin) then storage/themes (user).
  if (pathname === '/themes' || pathname.startsWith('/themes/')) {
    const builtin = await serveRoot(event)
    if (builtin) return builtin
    return serveUserThemes(event)
  }

  // /uploads/* → root public/uploads (legacy favicons) first, then the live
  // web/public/uploads written by the Nitro upload twins.
  if (pathname === '/uploads' || pathname.startsWith('/uploads/')) {
    const legacy = await serveRoot(event)
    if (legacy) return legacy
    return serveWebUploads(event)
  }

  // Legacy dirs that only the old EJS pages referenced — serve them from the
  // root public dir for parity (cheap, and keeps any stale bookmark working).
  if (
    pathname === '/favicon.ico' ||
    pathname === '/styles.css' ||
    pathname === '/tw.css' ||
    pathname === '/layout-animations.css' ||
    pathname.startsWith('/javascript') ||
    pathname.startsWith('/js/') ||
    pathname.startsWith('/styles') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/monaco') ||
    pathname.startsWith('/addons')
  ) {
    return serveRoot(event)
  }

  // Not a static path — continue to routes / baked assets / SSR.
  return undefined
})
