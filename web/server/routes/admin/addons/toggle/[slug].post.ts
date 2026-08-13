/**
 * POST /admin/addons/toggle/:slug — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Toggles the DB state, reloads addons, and
 * records an activity event (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { reloadAddons, toggleAddonStatus } from '../../../../utils/addon-runtime'

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
  const enabledBool =
    body.enabled === 'true' || body.enabled === true

  try {
    const result = await toggleAddonStatus(slug, enabledBool)
    if (!result.success) {
      setResponseStatus(event, 500)
      return {
        success: false,
        message: result.message || 'Failed to update addon status',
      }
    }
    const reload = await reloadAddons()
    if (!reload.success) {
      setResponseStatus(event, 500)
      return { success: false, message: reload.message }
    }
    await logActivity(event, session, 'addon:toggle', {
      metadata: { slug, enabled: enabledBool },
    })
    return { success: true, message: result.message }
  } catch (error) {
    console.error('Error toggling addon status:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to update addon status' }
  }
})
