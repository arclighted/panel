/**
 * POST /api/client/servers/:id/files/content — Nitro twin of the Express
 * handler in src/modules/api/client/clientApi.ts. Byte-identical (D3):
 * validates via writeFileBodySchema then writes to the daemon.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../../utils/external-api'
import { writeFileBodySchema, type WriteFileBody } from '../../../../../../../../src/modules/api/client/dto'
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
    const parsed = writeFileBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      setResponseStatus(event, 400)
      return clientError(
        event,
        parsed.error.issues[0]?.message ?? 'file and content are required',
      ).response
    }
    const { file, content } = parsed.data as WriteFileBody

    await daemonRequest({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'POST',
      path: '/fs/file/content',
      body: { id: server.UUID, path: file, content },
      timeout: 15000,
    })

    await apiAudit(event, 'file:edit', server.UUID, {
      metadata: { path: file, source: 'client-api' },
    })

    return { message: 'File saved' }
  } catch (err) {
    console.error('Client API: write file error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to write file', 500).response
  }
})
