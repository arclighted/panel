/**
 * POST /api/v1/users — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): validator checks, bcrypt
 * hash, duplicate guards, 201 with the public user shape.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import validator from 'validator'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, apiAudit } from '../../../utils/external-api'

const BCRYPT_SALT_ROUNDS = 10

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.users.create')
  if (!guard.ok) return guard.response

  try {
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const { email, username, password, isAdmin, description } = body

    if (!email || !username || !password) {
      setResponseStatus(event, 422)
      return { error: 'email, username, and password are required' }
    }

    if (!validator.isEmail(String(email))) {
      setResponseStatus(event, 422)
      return { error: 'Invalid email' }
    }

    if (!validator.isLength(String(username), { min: 3, max: 32 })) {
      setResponseStatus(event, 422)
      return { error: 'Username 3–32 chars' }
    }

    if (!validator.isLength(String(password), { min: 8, max: 128 })) {
      setResponseStatus(event, 422)
      return { error: 'Password 8–128 chars' }
    }

    const existingEmail = await nitroPrisma.users.findUnique({
      where: { email: String(email) },
    })
    if (existingEmail) {
      setResponseStatus(event, 409)
      return { error: 'Email already in use' }
    }

    const existingUsername = await nitroPrisma.users.findUnique({
      where: { username: String(username) },
    })
    if (existingUsername) {
      setResponseStatus(event, 409)
      return { error: 'Username already in use' }
    }

    const hashedPassword = await bcrypt.hash(String(password), BCRYPT_SALT_ROUNDS)

    const user = await nitroPrisma.users.create({
      data: {
        email: String(email),
        username: String(username),
        password: hashedPassword,
        isAdmin: isAdmin === true || isAdmin === 'true' || isAdmin === 1,
        description: (description as string | null | undefined) ?? null,
      },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        description: true,
      },
    })

    await apiAudit(event, 'user:create', undefined, {
      metadata: { targetEmail: String(email) },
    })
    setResponseStatus(event, 201)
    return { data: user }
  } catch (error) {
    console.error('Error creating user:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
