/**
 * DELETE /admin/mounts/:id — Nitro twin of the Express handler in
 * src/modules/admin/mounts.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'

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

  const id = parseInt(String(getRouterParam(event, 'id') ?? ''), 10)
  if (!id) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Invalid mount id.' }
  }
  try {
    await nitroPrisma.mount.delete({ where: { id } })
    await logActivity(event, session, 'mount:delete', { metadata: { mountId: id } })
    return { success: true }
  } catch (error) {
    console.error('Error deleting mount:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to delete mount.' }
  }
})
