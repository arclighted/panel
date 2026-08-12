/**
 * GET /server/:id/status — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical payload (D3):
 * server status + install state + runtime-queue public state.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../utils/auth-session'
import { loadApiServer } from '../../../utils/server-api'
import { getServerStatus } from '../../../../../src/handlers/utils/server/serverStatus'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { safeClientMessage } from '../../../../../src/utils/errors'
import { runtimeStartQueue } from '../../../../../src/handlers/runtimeQueue'

const STATUS_TIMEOUT_MS = 4_000

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

    const [serverStatus, installResult] = await Promise.all([
      getServerStatus({
        nodeAddress: node.address,
        nodePort: node.port,
        serverUUID: server.UUID,
        nodeKey: node.key,
      }),
      daemonRequest<{ state?: string; error?: string }>({
        method: 'GET',
        path: `/container/status/${server.UUID}`,
        nodeAddress: node.address,
        nodePort: node.port,
        nodeKey: node.key,
        timeout: STATUS_TIMEOUT_MS,
      })
        .then((r) => ({ state: r.data?.state, error: r.data?.error }))
        .catch(() => null),
    ])

    return {
      ...serverStatus,
      state: installResult?.state,
      error: installResult?.error
        ? safeClientMessage(installResult.error, 'The server could not be installed.')
        : undefined,
      queue: await runtimeStartQueue.getPublicQueueState(server.UUID, node),
    }
  } catch (error) {
    console.error('Error fetching server status:', error)
    setResponseStatus(event, 500)
    return { status: 'error', message: 'Failed to fetch server status' }
  }
})
