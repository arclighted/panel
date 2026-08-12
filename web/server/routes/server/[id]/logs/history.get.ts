/**
 * GET /server/:id/logs/history — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical (D3): returns the
 * daemon's recent console output lines.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

const LOG_HISTORY_TIMEOUT_MS = 8_000

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadApiServer(event, session, serverId, 'console')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    const { node } = server
    const response = await daemonRequest<{ logs?: string[] }>({
      method: 'GET',
      path: `/container/logs/history?id=${server.UUID}`,
      nodeAddress: node.address,
      nodePort: node.port,
      nodeKey: node.key,
      timeout: LOG_HISTORY_TIMEOUT_MS,
    })
    return { logs: response.data?.logs ?? [] }
  } catch (error) {
    console.error('Error fetching server log history:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to fetch server log history' }
  }
})
