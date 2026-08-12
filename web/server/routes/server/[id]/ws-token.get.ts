/**
 * GET /server/:id/ws-token — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical (D3): mints the
 * signed one-time WebSocket token for the authenticated user.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../utils/auth-session'
import { sessionUserId } from '../../../utils/auth'
import { requireServerAccess } from '../../../utils/auth'
import { requireTabPermission } from '../../../utils/server-tabs'
import { issueWsToken } from '../../../../../src/handlers/utils/security/wsToken'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const { subUser } = access.value
  const gate = requireTabPermission(event, subUser, 'console')
  if (!gate.ok) {
    return gate.response
  }

  try {
    const userId = sessionUserId(session)
    if (!userId || !serverId) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }
    const target = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      select: { UUID: true },
    })
    if (!target) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }
    return { token: issueWsToken(serverId, userId) }
  } catch (error) {
    console.error('Error issuing WS token:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to issue WS token' }
  }
})
