/**
 * POST /admin/addons/reload — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Unloads + reloads every addon (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'
import { reloadAddons } from '../../../utils/addon-runtime'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const result = await reloadAddons()
    await logActivity(event, session, 'addon:reload', {
      metadata: { success: result.success },
    })
    return { success: result.success, message: result.message }
  } catch (error) {
    console.error('Error reloading addons:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to reload addons' }
  }
})
