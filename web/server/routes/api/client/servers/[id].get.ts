/**
 * GET /api/client/servers/:id — Nitro twin of the Express handler in
 * src/modules/api/client/clientApi.ts. Byte-identical (D3): owner-or-subuser
 * resolved server detail.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../utils/client-api'
import { getParamAsString } from '../../../../utils/external-api'

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

    return {
      data: {
        UUID: server.UUID,
        name: server.name,
        description: server.description,
        Installing: server.Installing,
        Queued: server.Queued,
        Suspended: server.Suspended,
        nodeId: server.nodeId,
        createdAt: server.createdAt,
      },
    }
  } catch (err) {
    console.error('Client API: get server error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Internal error', 500).response
  }
})
