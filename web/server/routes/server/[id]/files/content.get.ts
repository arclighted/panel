/**
 * GET /server/:id/files/content — Nitro twin of the additive Express handler
 * in src/modules/user/server/fileDetail.ts. Byte-identical payload (D3):
 * file content with the 1 MiB / non-UTF-8 guards for the React inline editor.
 */
import {
  defineEventHandler,
  getQuery,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadApiServer(event, session, serverId, 'files')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    const query = getQuery(event)
    const filePath =
      typeof query?.path === 'string' ? query.path : String(query?.path ?? '')
    if (!filePath) {
      setResponseStatus(event, 400)
      return { error: 'Missing path.' }
    }

    const response = await daemonRequest<string>({
      method: 'GET',
      path: '/fs/file/content',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      params: { id: server.UUID, path: filePath },
    })

    const raw = response.data ?? ''
    const bytes = Buffer.byteLength(raw, 'utf8')
    const tooLarge = bytes > 1024 * 1024
    const invalidUtf8 = Buffer.from(raw, 'utf8').toString('utf8').includes('\uFFFD')

    return {
      success: true,
      name: filePath.split('/').pop() || filePath,
      path: filePath,
      extension: filePath.split('.').pop()?.toLowerCase() || '',
      content: tooLarge || invalidUtf8 ? '' : raw,
      tooLarge,
      invalidUtf8,
      size: bytes,
    }
  } catch (error) {
    console.error('Error fetching file content:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to fetch file content.' }
  }
})
