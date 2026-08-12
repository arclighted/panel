/**
 * POST /admin/users/create-user — Nitro twin of the Express handler in
 * src/modules/admin/users.ts. Byte-identical (D3): validates via the same
 * zod schema (imported from root), bcrypt-hashes with 12 rounds, checks the
 * duplicate email/username, and answers the same JSON shapes.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, roleFields } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'
import {
  createUserSchema,
  type CreateUserInput,
} from '../../../../../src/modules/admin/schemas'
import { isRoleInput as isRoleValue } from '../../../../../src/handlers/utils/auth/roles'

const BCRYPT_SALT_ROUNDS = 12

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    setResponseStatus(event, 400)
    return { message: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }
  const {
    email,
    username,
    password,
    isAdmin,
    role,
    serverLimit,
    maxMemory,
    maxCpu,
    maxStorage,
    maxDatabases,
  } = parsed.data as CreateUserInput

  const isAdminBool =
    typeof isAdmin === 'boolean' ? isAdmin : isAdmin === 'true'
  const requestedRole = isRoleValue(role)
    ? role
    : isAdminBool
      ? 'admin'
      : 'user'
  const roleData = roleFields(requestedRole)

  const requestedOrNull = (value: unknown): number | null =>
    value === '' || value === null || value === undefined
      ? null
      : parseInt(String(value), 10)

  try {
    const existingUser = await nitroPrisma.users.findFirst({
      where: { OR: [{ email }, { username }] },
    })
    if (existingUser) {
      setResponseStatus(event, 400)
      return { message: 'Email or username already exists.' }
    }

    await nitroPrisma.users.create({
      data: {
        email,
        username,
        password: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
        role: roleData.role,
        isAdmin: roleData.isAdmin,
        serverLimit: requestedOrNull(serverLimit),
        maxMemory: requestedOrNull(maxMemory),
        maxCpu: requestedOrNull(maxCpu),
        maxStorage: requestedOrNull(maxStorage),
        maxDatabases: requestedOrNull(maxDatabases),
      },
    })

    await logActivity(event, session, 'user:create', {
      metadata: { username, email },
    })
    return { message: 'User created successfully.' }
  } catch (error) {
    console.error('Error creating user:', error)
    setResponseStatus(event, 500)
    return { message: 'Error creating user. Please try again later.' }
  }
})
