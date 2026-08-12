/**
 * PATCH /api/v1/users/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import validator from 'validator'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../utils/external-api'

const BCRYPT_SALT_ROUNDS = 10

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.users.update')
  if (!guard.ok) return guard.response

  try {
    const userId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const { email, username, password, isAdmin, description } = body

    const existing = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    if (email !== undefined) {
      if (!validator.isEmail(String(email))) {
        setResponseStatus(event, 422)
        return { error: 'Invalid email' }
      }
      if (email !== existing.email) {
        const dup = await nitroPrisma.users.findUnique({
          where: { email: String(email) },
        })
        if (dup) {
          setResponseStatus(event, 409)
          return { error: 'Email already in use' }
        }
      }
    }

    if (username !== undefined) {
      if (!validator.isLength(String(username), { min: 3, max: 32 })) {
        setResponseStatus(event, 422)
        return { error: 'Username 3–32 chars' }
      }
      if (username !== existing.username) {
        const dup = await nitroPrisma.users.findUnique({
          where: { username: String(username) },
        })
        if (dup) {
          setResponseStatus(event, 409)
          return { error: 'Username already in use' }
        }
      }
    }

    if (password !== undefined) {
      if (!validator.isLength(String(password), { min: 8, max: 128 })) {
        setResponseStatus(event, 422)
        return { error: 'Password 8–128 chars' }
      }
    }

    const data: Record<string, unknown> = {}
    if (email !== undefined) data.email = email
    if (username !== undefined) data.username = username
    if (isAdmin !== undefined) data.isAdmin = isAdmin
    if (description !== undefined) data.description = description
    if (password !== undefined) {
      data.password = await bcrypt.hash(String(password), BCRYPT_SALT_ROUNDS)
    }

    const user = await nitroPrisma.users.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        description: true,
      },
    })

    await apiAudit(event, 'user:update', undefined, {
      metadata: { targetEmail: user.email },
    })
    return { data: user }
  } catch (error) {
    console.error('Error updating user:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
