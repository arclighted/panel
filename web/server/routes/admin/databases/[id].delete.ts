/**
 * DELETE /admin/databases/:id — Nitro twin of the Express handler in
 * src/modules/admin/databases.ts. Byte-identical (D3): refuses when the
 * host has active databases.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'

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

  const id = parseInt(getRouterParam(event, 'id') ?? '', 10)
  try {
    const count = await nitroPrisma.serverDatabase.count({ where: { hostId: id } })
    if (count > 0) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Cannot delete host with active databases.' }
    }
    await nitroPrisma.databaseHost.delete({ where: { id } })
    return { success: true }
  } catch (error) {
    console.error('Error deleting database host:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to delete database host.' }
  }
})
