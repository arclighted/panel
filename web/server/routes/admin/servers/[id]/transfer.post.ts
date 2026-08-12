/**
 * POST /admin/servers/:id/transfer — Nitro twin of the Express handler in
 * src/modules/admin/servers.ts. Byte-identical (D3): starts a node-to-node
 * server transfer via the shared transfer engine.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { startTransfer } from '../../../../../../src/handlers/utils/server/serverTransfer'
import { safeClientMessage } from '../../../../../../src/utils/errors'

const DEFAULT_SERVER_PORT = 25565

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const serverId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(serverId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid server ID' }
  }

  try {
    const { targetNodeId, ports } = body as {
      targetNodeId?: unknown
      ports?: unknown
    }
    if (!targetNodeId || !Array.isArray(ports) || ports.length === 0) {
      setResponseStatus(event, 400)
      return { error: 'Missing targetNodeId or ports' }
    }

    const targetNodeIdNum = parseInt(String(targetNodeId), 10)
    if (isNaN(targetNodeIdNum)) {
      setResponseStatus(event, 400)
      return { error: 'Invalid target node ID' }
    }

    const normalizedPorts = ports.map((p: Record<string, unknown>) => ({
      name: String(p.name || `Port ${p.externalPort}`),
      internalPort:
        parseInt(String(p.internalPort)) ||
        parseInt(String(p.externalPort)) ||
        DEFAULT_SERVER_PORT,
      externalPort: parseInt(String(p.externalPort)) || DEFAULT_SERVER_PORT,
      primary: p.primary === true,
    }))

    const state = await startTransfer(serverId, targetNodeIdNum, normalizedPorts)

    await logActivity(event, session, 'server:transfer', {
      serverId: String(state.serverUUID),
      metadata: {
        name: state.serverName,
        fromNodeId: state.sourceNodeId,
        toNodeId: state.targetNodeId,
      },
    })

    return { success: true, transferId: serverId }
  } catch (error) {
    console.error('Error starting transfer:', error)
    setResponseStatus(event, 400)
    return { error: safeClientMessage(error, 'Failed to start transfer') }
  }
})
