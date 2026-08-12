/**
 * DELETE /server/:id/subusers/:subUserId — Nitro twin of the Express handler
 * in src/modules/user/server/subusers.ts. Byte-identical (D3): owner-only,
 * removes a subuser.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { logActivity } from '../../../../utils/server-api'
import { requireServerAccess } from '../../../../utils/auth'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

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
  const subUserId = getRouterParam(event, 'subUserId') ?? ''

  try {
    const access = await requireServerAccess(event, session, serverId)
    if (!access.ok) {
      return access.response
    }
    const { user } = access.value

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
    })
    if (!server || server.ownerId !== user.id) {
      setResponseStatus(event, 403)
      return { error: 'Only the server owner can manage subusers.' }
    }

    const subUser = await nitroPrisma.subUser.findFirst({
      where: { id: parseInt(subUserId, 10), serverId: server.UUID },
    })
    if (!subUser) {
      setResponseStatus(event, 404)
      return { error: 'Subuser not found' }
    }

    await nitroPrisma.subUser.delete({ where: { id: subUser.id } })

    await logActivity(event, session, 'subuser:delete', {
      serverId: String(server.UUID),
      metadata: { subUserId: String(subUserId) },
    })
    emitRealtime(
      serverEvent('subuser.deleted', String(server.UUID), {
        state: { subUserId: subUser.id, userId: subUser.userId },
      }),
    )
    return { success: true, message: 'Subuser removed.' }
  } catch (error) {
    console.error('Error removing subuser:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to remove subuser' }
  }
})
