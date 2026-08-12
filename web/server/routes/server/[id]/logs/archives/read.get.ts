/**
 * GET /server/:id/logs/archives/read — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical (D3): reads the lines
 * of a saved log archive (file name validated against [A-Za-z0-9._-]).
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
} from '../../../../../utils/auth-session'
import { loadApiServer } from '../../../../../utils/server-api'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'

const LOG_HISTORY_TIMEOUT_MS = 8_000

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
    const response = await daemonRequest<{ lines?: string[] }>({
      method: 'GET',
      path: `/container/logs/archives/read?id=${server.UUID}&file=${encodeURIComponent(file)}`,
      nodeAddress: node.address,
      nodePort: node.port,
      nodeKey: node.key,
      timeout: LOG_HISTORY_TIMEOUT_MS,
    })
    return { lines: response.data?.lines ?? [] }
  } catch (error) {
    console.error('Error reading server log archive:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to read server log archive' }
  }
})
