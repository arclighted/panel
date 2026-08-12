/**
 * POST /admin/node/:id/maintenance — Nitro twin of the Express handler in
 * src/modules/admin/nodes.ts. Byte-identical (D3): toggles maintenance mode.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const nodeId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  const node = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
  if (!node) {
    setResponseStatus(event, 404)
    return { message: 'Node not found.' }
  }

  try {
    const maintenanceMode =
      body.maintenanceMode === true || body.maintenanceMode === 'true'
    const updated = await nitroPrisma.node.update({
      where: { id: nodeId },
      data: { maintenanceMode },
    })
    return { message: 'Node maintenance mode updated.', node: updated }
  } catch (error) {
    console.error('Error toggling node maintenance mode:', error)
    setResponseStatus(event, 500)
    return { message: 'Error toggling node maintenance mode.' }
  }
})
