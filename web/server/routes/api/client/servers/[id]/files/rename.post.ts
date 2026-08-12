/**
 * POST /api/client/servers/:id/files/rename — Nitro twin of the Express
 * handler in src/modules/api/client/clientApi.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../../utils/external-api'
import { renameFileBodySchema, type RenameFileBody } from '../../../../../../../../src/modules/api/client/dto'
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

    const rawBody = (await readBody(event).catch(() => ({}))) as unknown
    const parsed = renameFileBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      setResponseStatus(event, 400)
      return clientError(event, 'file and newname are required').response
    }
    const { file, newname } = parsed.data as RenameFileBody

    await daemonRequest({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'POST',
      path: '/fs/rename',
      body: { id: server.UUID, path: file, newName: newname },
      timeout: 15000,
    })

    await apiAudit(event, 'file:rename', server.UUID, {
      metadata: { path: file, newName: newname, source: 'client-api' },
    })

    return { message: 'File renamed' }
  } catch (err) {
    console.error('Client API: rename file error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to rename file', 500).response
  }
})
