/**
 * POST /register — Nitro-owned twin of the Express handler in
 * src/modules/auth/authService.ts. Same validation order, same redirect
 * error codes, same first-user / allowRegistration rules and same
 * bcrypt(12) user creation.
 */
import { defineEventHandler, readBody, sendRedirect, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import {
  authValidationErrorCode,
  registerSchema,
} from '../../../src/modules/auth/schemas'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../utils/auth-session'
import { isAuthRateLimited } from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const session =
      (event.context.session as SessionPayload | undefined) ??
      (await loadSession(event))

    if (!requireCsrf(event, session, body)) {
      setResponseStatus(event, 403)
      return { error: 'Invalid CSRF token' }
    }
    if (isAuthRateLimited(event)) {
      setResponseStatus(event, 429)
      return { error: 'Too many attempts. Try again in a minute.' }
    }

    const parsed = registerSchema.safeParse(body)
    if (!parsed.success) {
      const code = authValidationErrorCode(parsed.error.issues)
      if (code === 'missing') {
        return sendRedirect(event, '/register?err=missing_credentials', 302)
      }
      if (code === 'invalid_username') {
        return sendRedirect(event, '/register?err=invalid_username', 302)
      }
      return sendRedirect(event, '/register?err=invalid_input', 302)
    }

    const { email, username, password } = parsed.data

    const userCount = await nitroPrisma.users.count()
    const isFirstUser = userCount === 0

    // Registration is only restricted once a user exists — the first user
    // to register always may, regardless of the settings flag.
    if (!isFirstUser) {
      const settings = await nitroPrisma.settings.findUnique({
        where: { id: 1 },
        select: { allowRegistration: true },
      })
      if (!settings?.allowRegistration) {
        return sendRedirect(event, '/login?err=registration_disabled', 302)
      }
    }

    const existing = await nitroPrisma.users.findFirst({
      where: { OR: [{ email }, { username }] },
    })
    if (existing) {
      return sendRedirect(event, '/register?err=user_already_exists', 302)
    }

    await nitroPrisma.users.create({
      data: {
        email,
        username,
        password: await bcrypt.hash(password, 12),
        description: 'No About Me',
        // The first user to register owns the panel; everyone else starts
        // as a normal user.
        role: isFirstUser ? 'owner' : 'user',
        isAdmin: isFirstUser,
      },
    })

    return sendRedirect(event, '/login', 302)
  } catch (error) {
    console.error('[register] failed:', error)
    return sendRedirect(event, '/register?err=missing_credentials', 302)
  }
})
