/**
 * DELETE /admin/users/delete/:id/ — Nitro twin of the Express handler in
 * src/modules/admin/users.ts. Byte-identical (D3): self-delete, owner,
 * last-admin and owned-server guards, session + login-history cleanup.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'

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
  const userId = guard.value.id

  const targetId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(targetId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid user ID' }
  }

  try {
    const dataUser = await nitroPrisma.users.findUnique({
      where: { id: targetId },
    })
    if (!dataUser) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    if (userId === targetId) {
      setResponseStatus(event, 400)
      return { error: 'Cannot delete your own account' }
    }

    if (dataUser.role === 'owner') {
      setResponseStatus(event, 403)
      return {
        error: 'The owner cannot be deleted. Transfer ownership first.',
      }
    }

    const adminCount = await nitroPrisma.users.count({
      where: { isAdmin: true },
    })
    if (dataUser.isAdmin && adminCount <= 1) {
      setResponseStatus(event, 400)
      return { error: 'Cannot delete the last admin account' }
    }

    const serverCount = await nitroPrisma.server.count({
      where: { ownerId: targetId },
    })
    if (serverCount > 0) {
      setResponseStatus(event, 409)
      return {
        error:
          'Cannot delete user: they own servers. Delete or reassign those servers first.',
      }
    }

    await nitroPrisma.session.deleteMany({
      where: { data: { contains: `"id":${targetId}` } },
    })
    await nitroPrisma.loginHistory.deleteMany({ where: { userId: targetId } })
    await nitroPrisma.users.delete({ where: { id: targetId } })

    return { message: 'User deleted successfully.' }
  } catch (error) {
    console.error('Error deleting user:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error' }
  }
})
