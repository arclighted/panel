/**
 * GET /server/:id/logs/archives/download — Nitro twin of the Express handler
 * in src/modules/user/server/console.ts. Byte-identical (D3): mints a
 * one-time daemon download token and 302-redirects the browser to the
 * daemon (the panel never proxies the file bytes).
 */
import {
  defineEventHandler,
  getQuery,
  getRouterParam,
  sendRedirect,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import { loadApiServer } from '../../../../../utils/server-api'
import { daemonRequest, daemonBaseUrl } from '../../../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''
  const query = getQuery(event)
  const file = query?.file

  try {
    if (typeof file !== 'string' || !file || !/^[A-Za-z0-9._-]+$/.test(file)) {
      setResponseStatus(event, 400)
      return { error: 'Invalid file name' }
    }

    const ctx = await loadApiServer(event, session, serverId, 'console')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const { node } = server
    const response = await daemonRequest<{ token?: string; url?: string }>({
      method: 'POST',
      path: '/container/logs/archives/download-token',
      nodeAddress: node.address,
      nodePort: node.port,
      nodeKey: node.key,
      body: { id: server.UUID, file },
      timeout: 15000,
    })

    if (response.status !== 200 || !response.data?.token || !response.data?.url) {
      setResponseStatus(event, response.status || 500)
      return { error: 'Failed to start download' }
    }

    const base = await daemonBaseUrl(node.address, node.port)
    return await sendRedirect(event, `${base}${response.data.url}`, 302)
  } catch (error) {
    console.error('Error downloading server log archive:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to download server log archive' }
  }
})
