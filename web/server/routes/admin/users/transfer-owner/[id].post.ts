/**
 * POST /admin/users/transfer-owner/:id/ — Nitro twin of the Express handler
 * in src/modules/admin/users.ts. Byte-identical (D3): only the current owner
 * may hand over ownership; target becomes owner, actor becomes admin.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard, roleFields } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'

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
  const actorId = guard.value.id
  const actor = guard.value

  try {
    if (actor.role !== 'owner') {
      setResponseStatus(event, 403)
      return {
        error: 'Only the current owner can transfer ownership.',
      }
    }

    const targetUserId = parseInt(getRouterParam(event, 'id') ?? '', 10)
    const targetUser = await nitroPrisma.users.findUnique({
      where: { id: targetUserId },
    })
    if (!targetUser) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    if (targetUser.role === 'owner') {
      setResponseStatus(event, 400)
      return { error: 'The target user is already the owner.' }
    }

    const ownerData = roleFields('owner')
    const adminData = roleFields('admin')

    await nitroPrisma.$transaction([
      nitroPrisma.users.update({
        where: { id: targetUserId },
        data: { role: ownerData.role, isAdmin: ownerData.isAdmin },
      }),
      nitroPrisma.users.update({
        where: { id: actorId },
        data: { role: adminData.role, isAdmin: adminData.isAdmin },
      }),
    ])

    await logActivity(event, session, 'user:update', {
      metadata: {
        event: 'owner.transfer',
        targetUserId,
        username: targetUser.username,
      },
    })

    return {
      message: `Ownership transferred to ${targetUser.username}.`,
    }
  } catch (error) {
    console.error('Error transferring owner role:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error' }
  }
})
