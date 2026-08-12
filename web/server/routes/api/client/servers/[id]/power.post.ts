/**
 * POST /api/client/servers/:id/power — Nitro twin of the Express handler in
 * src/modules/api/client/clientApi.ts. Byte-identical (D3): validates the
 * action via the shared zod schema, enqueues starts on the runtime queue,
 * or sends the power signal to the daemon.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../utils/external-api'
import { powerBodySchema, type PowerBody } from '../../../../../../../src/modules/api/client/dto'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'
import { runtimeStartQueue } from '../../../../../../../src/handlers/runtimeQueue'
import { NodeCapacityExceededError } from '../../../../../../../src/handlers/utils/server/resourceCheck'

export default defineEventHandler(async (event) => {
  const guard = await requireClientApiKey(event)
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
    const server = await resolveServerForUser(serverId, guard.userId)
    if (!server) {
      setResponseStatus(event, 404)
      return clientError(event, 'Server not found', 404).response
    }

    const rawBody = (await readBody(event).catch(() => ({}))) as unknown
    const parsed = powerBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ??
        'action must be start, stop, restart, or kill'
      setResponseStatus(event, 400)
      return clientError(event, message).response
    }
    const { action } = parsed.data as PowerBody

    if (server.Suspended) {
      setResponseStatus(event, 403)
      return clientError(event, 'Server is suspended', 403).response
    }

    if (action === 'start') {
      const apiUser = await nitroPrisma.users.findUnique({
        where: { id: guard.userId },
        select: { isAdmin: true, role: true },
      })
      const priority =
        apiUser?.isAdmin === true ||
        server.ownerId === guard.userId ||
        apiUser?.role === 'privileged'
      const queued = await runtimeStartQueue.enqueueStart({
        serverId: server.UUID,
        userId: guard.userId,
        priority,
      })
      if (queued.queued) {
        await apiAudit(event, 'server:start', server.UUID, {
          metadata: {
            source: 'client-api',
            queued: true,
            position: queued.position,
          },
        })
        setResponseStatus(event, 202)
        return {
          message: `Server queued to start (position ${queued.position})`,
        }
      }
    } else {
      const method = action === 'kill' ? 'DELETE' : 'POST'
      const path = action === 'kill' ? '/container/kill' : `/container/${action}`

      await daemonRequest({
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        method,
        path,
        body: { id: server.UUID },
        timeout: 30000,
      })

      if (action === 'stop' || action === 'kill') {
        await nitroPrisma.server
          .update({
            where: { UUID: server.UUID },
            data: { Running: false },
          })
          .catch(() => {})
        runtimeStartQueue.cleanCapacityFreed().catch(() => undefined)
      }
    }

    await apiAudit(event, `server:${action}`, server.UUID, {
      metadata: { source: 'client-api' },
    })

    return { message: `${action} signal sent` }
  } catch (err) {
    if (err instanceof NodeCapacityExceededError) {
      console.warn('Client API: power action blocked by node capacity', {
        error: (err as Error).message,
      })
      setResponseStatus(event, 409)
      return clientError(event, (err as Error).message, 409).response
    }
    console.error('Client API: power action error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to execute power action', 500).response
  }
})
