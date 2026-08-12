/**
 * GET /api/client/servers/:id/files/content — Nitro twin of the Express
 * handler in src/modules/api/client/clientApi.ts. Byte-identical (D3).
 */
import { defineEventHandler, getQuery, getRouterParam, setResponseStatus } from 'h3'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../../utils/client-api'
import { getParamAsString } from '../../../../../../utils/external-api'
import { daemonRequest } from '../../../../../../../../src/handlers/utils/core/daemonRequest'

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
    const file = query.file as string | undefined
    if (!file) {
      setResponseStatus(event, 400)
      return clientError(event, 'file query parameter is required').response
    }

    const response = await daemonRequest({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'GET',
      path: '/fs/file/content',
      params: { id: server.UUID, path: file },
      timeout: 15000,
    })

    return { data: response.data }
  } catch (err) {
    console.error('Client API: read file error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to read file', 500).response
  }
})
