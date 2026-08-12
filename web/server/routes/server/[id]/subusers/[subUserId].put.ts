/**
 * PUT /server/:id/subusers/:subUserId — Nitro twin of the Express handler in
 * src/modules/user/server/subusers.ts. Byte-identical (D3): owner-only,
 * updates a subuser's permission set.
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
import { SUBUSER_PERMISSIONS } from '../../../../utils/server-tabs'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

function isValidPermissionSet(permissions: unknown): permissions is string[] {
  if (!Array.isArray(permissions)) {
    return false
  }
  return permissions.every((p) =>
    (SUBUSER_PERMISSIONS as readonly string[]).includes(String(p)),
  )
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    permissions?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const subUserId = getRouterParam(event, 'subUserId') ?? ''
  const { permissions } = body

  if (!isValidPermissionSet(permissions)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid permissions' }
  }

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

    await nitroPrisma.subUser.update({
      where: { id: subUser.id },
      data: { permissions: JSON.stringify(permissions) },
    })

    await logActivity(event, session, 'subuser:update', {
      serverId: String(server.UUID),
      metadata: { subUserId: String(subUserId) },
    })
    emitRealtime(
      serverEvent('subuser.updated', String(server.UUID), {
        state: { subUserId: subUser.id, userId: subUser.userId },
      }),
    )
    return { success: true, message: 'Subuser permissions updated.' }
  } catch (error) {
    console.error('Error updating subuser permissions:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update subuser permissions' }
  }
})
