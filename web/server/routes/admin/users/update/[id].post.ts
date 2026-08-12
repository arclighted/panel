/**
 * POST /admin/users/update/:id/ — Nitro twin of the Express handler in
 * src/modules/admin/users.ts. Byte-identical (D3): duplicate email/username
 * checks, owner-edit restrictions, role/isAdmin sync, optional password
 * reset, resource limits, realtime user.updated, activity audit.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard, roleFields } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { emitRealtime, userEvent } from '../../../../../../src/handlers/realtime/events'
import {
  updateUserSchema,
  type UpdateUserInput,
} from '../../../../../../src/modules/admin/schemas'
import { isRoleInput as isRoleValue } from '../../../../../../src/handlers/utils/auth/roles'

const BCRYPT_SALT_ROUNDS = 12

async function countAdmins(): Promise<number> {
  return nitroPrisma.users.count({ where: { isAdmin: true } })
}

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

  const targetUserId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(targetUserId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid user ID' }
  }

  try {
    const targetUser = await nitroPrisma.users.findUnique({
      where: { id: targetUserId },
    })
    if (!targetUser) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    const parsed = updateUserSchema.safeParse(body)
    if (!parsed.success) {
      setResponseStatus(event, 400)
      return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }
    }
    const {
      email,
      username,
      description,
      isAdmin,
      role,
      password,
      serverLimit,
      maxMemory,
      maxCpu,
      maxStorage,
      maxDatabases,
    } = parsed.data as UpdateUserInput

    if (email && email !== targetUser.email) {
      const existing = await nitroPrisma.users.findFirst({
        where: { email, id: { not: targetUserId } },
      })
      if (existing) {
        setResponseStatus(event, 400)
        return { error: 'Email already in use' }
      }
    }
    if (username && username !== targetUser.username) {
      const existing = await nitroPrisma.users.findFirst({
        where: { username, id: { not: targetUserId } },
      })
      if (existing) {
        setResponseStatus(event, 400)
        return { error: 'Username already in use' }
      }
    }

    const newIsAdmin = isAdmin === true || isAdmin === 'true'
    if (
      isAdmin !== undefined &&
      isAdmin !== null &&
      targetUser.isAdmin &&
      !newIsAdmin
    ) {
      const isSelf = targetUserId === userId
      const adminCount = await countAdmins()
      if (isSelf) {
        setResponseStatus(event, 400)
        return { error: 'You cannot remove your own admin role' }
      }
      if (adminCount <= 1) {
        setResponseStatus(event, 400)
        return { error: 'Cannot demote the last admin account' }
      }
    }

    const updateData: Record<string, unknown> = {}
    if (email) updateData.email = email
    if (username) updateData.username = username
    if (description) updateData.description = description

    if (targetUser.role === 'owner' && userId !== targetUserId) {
      setResponseStatus(event, 403)
      return {
        error: 'The owner cannot be edited by anyone but the owner.',
      }
    }

    if (isAdmin !== undefined) {
      updateData.isAdmin = isAdmin === true || isAdmin === 'true'
    }

    const nextRole =
      role !== undefined
        ? isRoleValue(role)
          ? role
          : undefined
        : isAdmin !== undefined
          ? isAdmin === true || isAdmin === 'true'
            ? 'admin'
            : 'user'
          : undefined
    if (nextRole !== undefined) {
      if (nextRole === 'owner') {
        setResponseStatus(event, 403)
        return {
          error: 'Only the owner-transfer flow can assign the owner role.',
        }
      }
      const { role: updatedRole, isAdmin: updatedIsAdmin } = roleFields(nextRole)
      updateData.role = updatedRole
      updateData.isAdmin = updatedIsAdmin
    }

    const toLimitOrNull = (
      value: number | string | null | undefined,
    ): number | null => {
      if (value === '' || value === null) return null
      return parseInt(String(value), 10)
    }
    if (serverLimit !== undefined) updateData.serverLimit = toLimitOrNull(serverLimit)
    if (maxMemory !== undefined) updateData.maxMemory = toLimitOrNull(maxMemory)
    if (maxCpu !== undefined) updateData.maxCpu = toLimitOrNull(maxCpu)
    if (maxStorage !== undefined) updateData.maxStorage = toLimitOrNull(maxStorage)
    if (maxDatabases !== undefined) updateData.maxDatabases = toLimitOrNull(maxDatabases)

    if (password && password.trim() !== '') {
      updateData.password = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS)
    }

    await nitroPrisma.users.update({
      where: { id: targetUserId },
      data: updateData,
    })

    await logActivity(event, session, 'user:update', {
      metadata: { targetUserId, username: targetUser.username },
    })
    emitRealtime(
      userEvent('user.updated', targetUserId, {
        state: { username: targetUser.username },
      }),
    )

    return { message: 'User updated successfully' }
  } catch (error) {
    console.error('Error updating user:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal server error' }
  }
})
