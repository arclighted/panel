/**
 * POST /server/:id/feature/eula — Nitro twin of the Express handler in
 * src/modules/user/server/fileDetail.ts. Byte-identical (D3): writes
 * eula=true into eula.txt on the daemon.
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

  const ctx = await loadApiServer(event, session, serverId, 'files')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    await daemonRequest({
      method: 'POST',
      path: '/fs/file/content',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: server.UUID,
        path: 'eula.txt',
        content: 'eula=true',
      },
    })
    setResponseStatus(event, 200)
    return { success: true }
  } catch (error) {
    console.error('Error accepting EULA:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to accept EULA' }
  }
})
