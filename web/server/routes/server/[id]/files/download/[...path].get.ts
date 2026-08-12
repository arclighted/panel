/**
 * GET /server/:id/files/download/{*path} — Nitro twin of the Express handler
 * in src/modules/user/server/files.ts. Byte-identical (D3): path-safety
 * check, then mint a short-lived single-use daemon download token and 302 the
 * browser straight at the daemon (the panel never proxies file bytes).
 */
import {
  defineEventHandler,
  getRouterParam,
  sendRedirect,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import { loadApiServer, logActivity } from '../../../../../utils/server-api'
import { daemonRequest, daemonBaseUrl } from '../../../../../../../src/handlers/utils/core/daemonRequest'
import { isPathSafe } from '../../../../../../../src/utils/pathSecurity'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''
  const filePath = getRouterParam(event, 'path') ?? ''

  if (!isPathSafe(filePath)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid file path.' }
  }

  const ctx = await loadApiServer(event, session, serverId, 'files')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    const response = await daemonRequest<{ token?: string; url?: string }>({
      method: 'POST',
      path: '/fs/download-token',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: { id: server.UUID, path: filePath },
      timeout: 15000,
    })

    if (
      response.status !== 200 ||
      !response.data?.token ||
      !response.data?.url
    ) {
      setResponseStatus(event, response.status || 500)
      return { error: 'Failed to start download' }
    }

    const base = await daemonBaseUrl(server.node.address, server.node.port)
    await logActivity(event, session, 'file:download', {
      serverId: String(server.UUID),
      metadata: { path: filePath },
    })
    return await sendRedirect(event, `${base}${response.data.url}`, 302)
  } catch (error) {
    console.error('Error downloading file:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to download file' }
  }
})
