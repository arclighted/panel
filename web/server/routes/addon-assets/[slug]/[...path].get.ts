/**
 * GET /addon-assets/:slug/{*path} — Nitro twin of the Express mounts in
 * src/app.ts (`/addon-assets/:slug` → express.static) and the addonHandler's
 * setupStaticAssetServing. Serves the addon's `public/` dir from
 * storage/addons/<slug>/public with the same two guards Express applied:
 *
 *   1. slug must match /^[a-z0-9][a-z0-9-]{0,47}$/ (invalid → 404, not 500)
 *   2. the realpath of the addon's public dir must stay INSIDE the addon dir
 *      (defence against symlink escapes — mirrors setupStaticAssetServing)
 *
 * The mount is dynamic in Express (added per addon at load); this route
 * resolves the dir per-request, so it works whether or not the addon module
 * is currently loaded — matching the live filesystem.
 */
import { defineEventHandler, getRouterParam, serveStatic } from 'h3'
import { realpathSync, existsSync } from 'node:fs'
import path from 'node:path'
import { projectRoot } from '../../../utils/paths'
import { createFsStatic } from '../../../utils/static-fs'
import { isValidAddonSlug } from '../../../../../src/handlers/addonViewResolver'

const ADDONS_DIR = path.join(projectRoot(), 'storage', 'addons')

const notFound = () =>
  new Response(null, { status: 404, headers: { 'content-type': 'text/plain' } })

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!isValidAddonSlug(slug)) {
    return notFound()
  }

  const addonPath = path.join(ADDONS_DIR, slug)
  const publicPath = path.join(addonPath, 'public')
  if (!existsSync(publicPath)) {
    return notFound()
  }

  // Realpath containment guard (same as setupStaticAssetServing): the public
  // dir must be the addon dir itself or a child — never a symlink escape.
  try {
    const realAddon = realpathSync(addonPath)
    const realPublic = realpathSync(publicPath)
    if (realPublic !== realAddon && !realPublic.startsWith(realAddon + path.sep)) {
      return notFound()
    }
  } catch {
    return notFound()
  }

  // h3's serveStatic resolves the asset id from the FULL request pathname
  // (/addon-assets/<slug>/<path>), so the mount strips that prefix back to
  // the on-disk layout (public/<path>). Same namespace-shift as the /themes
  // and /uploads mounts in 02.static.
  const mount = createFsStatic(publicPath, {
    stripPrefix: `/addon-assets/${slug}`,
  })
  const res = await serveStatic(event, {
    getMeta: mount.getMeta,
    getContents: mount.getContents,
    fallthrough: true,
    indexNames: [],
    // express.static parity: revalidation via ETag/Last-Modified, not long
    // caching (addon assets change on updates).
    headers: { 'cache-control': 'public, max-age=0' },
  })
  if (res) return res

  return notFound()
})
