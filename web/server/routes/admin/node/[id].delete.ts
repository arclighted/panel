/**
 * DELETE /admin/node/:id — Nitro twin of the Express handler in
 * src/modules/admin/nodes.ts. Byte-identical (D3): refuses when the node
 * hosts servers unless ?deleteInstance=true, deletes daemon containers
 * best-effort, removes the node + allocations, audits + realtime.
 */
import { defineEventHandler, getQuery, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { emitRealtime } from '../../../../../src/handlers/realtime/events'

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

  const nodeId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(nodeId)) {
    setResponseStatus(event, 400)
    return { message: 'Invalid node ID.' }
  }
  const query = getQuery(event)
  const deleteInstances = query.deleteInstance === 'true'

  try {
    const nodeExists = await nitroPrisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true },
    })
    if (!nodeExists) {
      setResponseStatus(event, 404)
      return { message: 'Node not found.' }
    }

    const serverCount = await nitroPrisma.server.count({ where: { nodeId } })
    if (serverCount > 0 && !deleteInstances) {
      setResponseStatus(event, 400)
      return {
        message: `Node has ${serverCount} server(s) associated. Set ?deleteInstance=true to delete them as well, or delete the servers first.`,
      }
    }

    if (deleteInstances) {
      const node = await nitroPrisma.node.findUnique({
        where: { id: nodeId },
        include: { servers: true },
      })
      if (node) {
        await Promise.allSettled(
          node.servers.map((server) =>
            daemonRequest({
              nodeAddress: node.address,
              nodePort: node.port,
              nodeKey: node.key,
              method: 'DELETE',
              path: '/container',
              body: { id: server.UUID },
              timeout: 8000,
            }),
          ),
        )
      }
      await nitroPrisma.server.deleteMany({ where: { nodeId } })
    }

    await nitroPrisma.node.delete({ where: { id: nodeId } })

    await logActivity(event, session, 'node:delete', { metadata: { nodeId } })
    emitRealtime({
      type: 'node.deleted',
      scope: { admin: true },
      resource: { type: 'node', id: nodeId },
      state: { id: nodeId },
    })

    return {
      message: deleteInstances
        ? 'Node and associated instances deleted successfully.'
        : 'Node deleted successfully.',
    }
  } catch (error) {
    console.error('Error when deleting the node:', error)
    setResponseStatus(event, 500)
    return { message: 'Error when deleting the node.' }
  }
})

