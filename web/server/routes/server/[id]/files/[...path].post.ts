/**
 * POST /server/:id/files/{*path} — Nitro twin of the Express handler in
 * src/modules/user/server/fileDetail.ts. Byte-identical (D3): saves file
 * content to the daemon (a trailing /save segment is stripped, matching the
 * legacy EJS editor path).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  let filePath = getRouterParam(event, 'path') ?? ''
  if (filePath.endsWith('/save')) {
    filePath = filePath.slice(0, -5)
  }
  const { content } = body as { content?: unknown }

  if (typeof content !== 'string') {
    setResponseStatus(event, 400)
    return { error: 'Content is required' }
  }

  try {
    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    await daemonRequest({
      method: 'POST',
      path: '/fs/file/content',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: server.UUID,
        path: filePath,
        content,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error saving file:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to save file' }
  }
})
