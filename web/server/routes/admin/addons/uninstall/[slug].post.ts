/**
 * POST /admin/addons/uninstall/:slug — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Requires `{ confirm: true }`, then runs the
 * uninstall flow (hooks, migration rollback, DB rows, dir removal) + reload
 * (D3). Note: the current v3 UI sends an empty body, so uninstall needs a
 * body with confirm:true — same as Express.
 */
import fs from 'node:fs'
import path from 'node:path'
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { reloadAddons, uninstallAddon } from '../../../../utils/addon-runtime'
import { containPath } from '../../../../../../src/utils/pathSecurity'
import { projectRoot } from '../../../../utils/paths'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const slug = getRouterParam(event, 'slug') ?? ''

  if (!body.confirm) {
    setResponseStatus(event, 400)
    return {
      success: false,
      message:
        'Confirmation required. Pass { "confirm": true } to proceed with uninstallation.',
    }
  }

  const addonsDir = path.join(projectRoot(), 'storage', 'addons')
  const targetDir = path.join(addonsDir, slug)
  if (!containPath(addonsDir, targetDir) || !fs.existsSync(targetDir)) {
    setResponseStatus(event, 404)
    return { success: false, message: 'Addon not found' }
  }

  try {
    await uninstallAddon(slug)
    await reloadAddons()
    await logActivity(event, session, 'addon:uninstall', { metadata: { slug } })
    return { success: true, message: `Addon "${slug}" uninstalled` }
  } catch (error) {
    console.error('Error uninstalling addon:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to uninstall addon' }
  }
})
