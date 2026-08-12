/**
 * GET /admin/check-update — Nitro twin of the Express handler in
 * src/modules/admin/overview.ts. Byte-identical (D3): checks the upstream
 * release channel for a newer version and returns the update info JSON.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../utils/auth-session'
import { requireAdminGuard } from '../../utils/admin-api'
import { checkForUpdates } from '../../../../src/handlers/updater'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  if (!requireCsrf(event, session, {})) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const updateInfo = await checkForUpdates()
    return updateInfo
  } catch (error) {
    console.error('Error checking for updates:', error)
    setResponseStatus(event, 500)
    return { error: 'Error checking for updates' }
  }
})
