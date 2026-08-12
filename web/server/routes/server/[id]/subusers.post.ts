/**
 * POST /server/:id/subusers — Nitro twin of the Express handler in
 * src/modules/user/server/subusers.ts. Byte-identical (D3): owner-only, adds
 * a subuser by email with a validated permission set, sends the invite mail.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { logActivity } from '../../../utils/server-api'
import { requireServerAccess } from '../../../utils/auth'
import { SUBUSER_PERMISSIONS } from '../../../utils/server-tabs'
import { sendSubUserInvite } from '../../../../../src/handlers/utils/core/mailer'
import { emitRealtime, serverEvent } from '../../../../../src/handlers/realtime/events'

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
    email?: unknown
    permissions?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const { email, permissions } = body

  if (!email || typeof email !== 'string' || email.trim() === '') {
    setResponseStatus(event, 400)
    return { error: 'Email is required' }
  }

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

    // Owner-only: the Express handler checks ownerId AFTER
    // isAuthenticatedForServer, so admins who don't own the server get 403.
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { image: true },
    })
    if (!server || server.ownerId !== user.id) {
      setResponseStatus(event, 403)
      return { error: 'Only the server owner can manage subusers.' }
    }

    const target = await nitroPrisma.users.findUnique({
      where: { email: email.trim().toLowerCase() },
    })
    if (!target) {
      setResponseStatus(event, 404)
      return { error: 'No user found with that email.' }
    }
    if (target.id === user.id) {
      setResponseStatus(event, 400)
      return { error: 'You cannot add yourself as a subuser.' }
    }
    if (server.ownerId === target.id) {
      setResponseStatus(event, 400)
      return { error: 'The server owner is already in full control.' }
    }

    const existing = await nitroPrisma.subUser.findUnique({
      where: { serverId_userId: { serverId: server.UUID, userId: target.id } },
    })
    if (existing) {
      setResponseStatus(event, 409)
      return { error: 'That user is already a subuser of this server.' }
    }

    await nitroPrisma.subUser.create({
      data: {
        serverId: server.UUID,
        userId: target.id,
        permissions: JSON.stringify(permissions),
      },
    })

    await logActivity(event, session, 'subuser:create', {
      serverId: String(server.UUID),
      metadata: { targetUserId: target.id },
    })
    emitRealtime(
      serverEvent('subuser.created', String(server.UUID), {
        state: { userId: target.id, username: target.username },
      }),
    )

    if (target.email) {
      await sendSubUserInvite({
        to: target.email,
        panelName: 'Arclight',
        serverName: server.name,
        inviteUrl: `${process.env.PANEL_URL ?? ''}/server/${server.UUID}`,
      })
    }

    return { success: true, message: `${target.username || target.email} added as a subuser.` }
  } catch (error) {
    console.error('Error adding subuser:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to add subuser' }
  }
})
