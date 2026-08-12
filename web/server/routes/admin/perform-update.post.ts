/**
 * POST /admin/perform-update — Nitro twin of the Express handler in
 * src/modules/admin/overview.ts. Byte-identical (D3): pulls the upstream
 * update and applies it.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../utils/auth-session'
import { requireAdminGuard } from '../../utils/admin-api'
import { performUpdate } from '../../../../src/handlers/updater'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const success = await performUpdate()
    if (success) {
      return { message: 'Update completed successfully' }
    }
    setResponseStatus(event, 500)
    return { error: 'Error performing update' }
  } catch (error) {
    console.error('Error performing update:', error)
    setResponseStatus(event, 500)
    return { error: 'Error performing update' }
  }
})
