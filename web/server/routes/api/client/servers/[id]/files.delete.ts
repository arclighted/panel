/**
 * DELETE /api/client/servers/:id/files — Nitro twin of the Express handler
 * in src/modules/api/client/clientApi.ts. Byte-identical (D3): validates via
 * deleteFileBodySchema then removes the file on the daemon.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../utils/external-api'
import { deleteFileBodySchema, type DeleteFileBody } from '../../../../../../../src/modules/api/client/dto'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'

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
    const parsed = deleteFileBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      setResponseStatus(event, 400)
      return clientError(event, 'file is required').response
    }
    const { file } = parsed.data as DeleteFileBody

    await daemonRequest({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'DELETE',
      path: '/fs/rm',
      body: { id: server.UUID, path: file },
      timeout: 15000,
    })

    await apiAudit(event, 'file:delete', server.UUID, {
      metadata: { path: file, source: 'client-api' },
    })

    return { message: 'File deleted' }
  } catch (err) {
    console.error('Client API: delete file error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to delete file', 500).response
  }
})
