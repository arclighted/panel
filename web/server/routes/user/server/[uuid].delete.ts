/**
 * DELETE /user/server/:uuid — Nitro twin of the Express handler in
 * src/modules/user/createServer.ts. Byte-identical (D3): owner-only delete
 * with optional force (skip the daemon container removal), then allocation
 * release + row delete.
 */
import { defineEventHandler, getQuery, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { releaseServerAllocations } from '../../../../../src/handlers/utils/server/allocations'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const userId = (session as { user?: { id?: unknown } }).user?.id
  if (typeof userId !== 'number') {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }

    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    if (!settings?.allowUserDeleteServer) {
      setResponseStatus(event, 403)
      return { error: 'Server deletion is not enabled for users.' }
    }

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: String(getRouterParam(event, 'uuid') ?? '') },
      include: { node: true },
    })

    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found.' }
    }
    if (server.ownerId !== userId) {
      setResponseStatus(event, 403)
      return { error: 'This is not your server.' }
    }

    const query = getQuery(event)
    const force = query.force === 'true'

    if (!force) {
      try {
        await daemonRequest({
          nodeAddress: server.node.address,
          nodePort: server.node.port,
          nodeKey: server.node.key,
          method: 'DELETE',
          path: '/container',
          body: { id: server.UUID },
        })
      } catch (err: unknown) {
        const errObj =
          err && typeof err === 'object'
            ? (err as Record<string, unknown>)
            : {}
        const errBody =
          errObj.body && typeof errObj.body === 'object'
            ? (errObj.body as Record<string, unknown>)
            : undefined
        const isGone =
          errObj.status === 404 ||
          (errBody?.error as string | undefined)?.includes('not exist')

        if (!isGone) {
          console.error('Error deleting container from daemon:', err)
          setResponseStatus(event, 502)
          return {
            error:
              'Could not delete the server on the node. Try again, or use force delete to remove it from the panel only.',
          }
        }
      }
    }

    await releaseServerAllocations(server.UUID).catch(() => {})
    await nitroPrisma.server.delete({ where: { UUID: server.UUID } })
    return { success: true }
  } catch (error) {
    console.error('Error deleting user server:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete server.' }
  }
})
