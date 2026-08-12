/**
 * DELETE /admin/location/:id — Nitro twin of the Express handler in
 * src/modules/admin/locations.ts. Byte-identical (D3): refuses to delete a
 * location that still has nodes assigned.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, getParamAsNumber } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const locationId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
    if (isNaN(locationId)) {
      setResponseStatus(event, 400)
      return { message: 'Invalid location ID.' }
    }

    const nodeCount = await nitroPrisma.node.count({ where: { locationId } })
    if (nodeCount > 0) {
      setResponseStatus(event, 400)
      return {
        message: `Location has ${nodeCount} node(s) assigned. Remove them from the location first.`,
      }
    }

    await nitroPrisma.location.delete({ where: { id: locationId } })
    await logActivity(event, session, 'location:delete', {
      metadata: { locationId },
    })
    return { message: 'Location deleted successfully.' }
  } catch (error) {
    console.error('Error deleting location:', error)
    setResponseStatus(event, 500)
    return { message: 'Error deleting location.' }
  }
})
