/**
 * GET /api/client/servers/:id/files — Nitro twin of the Express handler in
 * src/modules/api/client/clientApi.ts. Byte-identical (D3).
 */
import { defineEventHandler, getQuery, getRouterParam, setResponseStatus } from 'h3'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../utils/client-api'
import { getParamAsString } from '../../../../../utils/external-api'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'
import {
  fsListSchema,
  parseDaemonResponse,
} from '../../../../../../../src/platform/daemon/dtos'

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

    const query = getQuery(event)
    const dir = (query.dir as string) || '/'

    const response = await daemonRequest<unknown>({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'GET',
      path: '/fs/list',
      params: { id: server.UUID, path: dir },
      timeout: 15000,
    })

    return {
      data: parseDaemonResponse(fsListSchema, response.data) ?? [],
    }
  } catch (err) {
    console.error('Client API: list files error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to list files', 500).response
  }
})
