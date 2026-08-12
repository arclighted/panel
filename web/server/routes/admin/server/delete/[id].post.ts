/**
 * POST /admin/server/delete/:id — Nitro twin of the Express handler in
 * src/modules/admin/servers.ts. Byte-identical (D3): deletes the daemon
 * container (unless ?force=true), then removes all related rows in a
 * transaction and releases allocations.
 */
import { defineEventHandler, getQuery, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { releaseServerAllocations } from '../../../../../../src/handlers/utils/server/allocations'
import { safeClientMessage } from '../../../../../../src/utils/errors'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

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

  const serverId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(serverId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid server ID' }
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { id: serverId },
      include: { node: true, image: true, owner: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const query = getQuery(event)
    const force = query.force === 'true'

    try {
      if (!force) {
        try {
          const response = await daemonRequest({
            nodeAddress: server.node.address,
            nodePort: server.node.port,
            nodeKey: server.node.key,
            method: 'DELETE',
            path: '/container',
            body: { id: server.UUID },
          })

          if (response.status !== 200) {
            const responseData = response.data as Record<string, unknown> | undefined
            const isNotFound =
              response.status === 404 ||
              (responseData &&
                typeof responseData === 'object' &&
                'error' in responseData &&
                typeof responseData.error === 'string' &&
                responseData.error.includes('not exist'))

            if (isNotFound) {
              // Container already gone — proceed with DB cleanup
            } else {
              throw new Error(
                `Daemon returned an unexpected response (status ${response.status})`,
              )
            }
          }
        } catch (error: unknown) {
          console.error('Error deleting container on daemon:', error)
          throw new Error(
            `${safeClientMessage(error, 'The daemon is unreachable')} Use ?force=true to remove from panel only.`,
            { cause: error },
          )
        }
      }

      await nitroPrisma.$transaction(async (tx) => {
        await tx.sftpCredential.deleteMany({ where: { serverId: server.UUID } })
        await tx.backup.deleteMany({ where: { serverId: server.UUID } })
        await tx.serverFolderMember.deleteMany({ where: { serverUUID: server.UUID } })
        await tx.activityLog.deleteMany({ where: { serverId: server.UUID } })
        await tx.server.delete({ where: { id: serverId } })
      })
      await releaseServerAllocations(server.UUID).catch(() => {})

      emitRealtime(
        serverEvent('server.deleted', server.UUID, {
          state: { id: server.id, name: server.name },
        }),
      )
      emitRealtime({
        type: 'admin.servers.updated',
        scope: { admin: true },
        state: {},
      })

      await logActivity(event, session, 'server:delete', {
        metadata: {
          name: server.name,
          nodeId: server.nodeId,
          serverUUID: server.UUID,
        },
      })
      return { success: true }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      setResponseStatus(event, 500)
      return { error: `Failed to delete server: ${errorMessage}` }
    }
  } catch (error) {
    console.error('Error in delete server route:', error)
    setResponseStatus(event, 500)
    return { error: 'Error deleting server' }
  }
})
