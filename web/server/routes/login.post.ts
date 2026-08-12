/**
 * POST /login — Nitro-owned twin of the Express handler in
 * src/modules/auth/authService.ts. Byte-identical behavior and redirect
 * contract (D3): every outcome is a 302 to the same location Express used,
 * and the rate-limit response is the same JSON 429 the React layer parses.
 *
 * CSRF is enforced here (requireCsrf) because Express's global
 * doubleCsrfProtection no longer sees this request — the frontend's
 * `CSRF-Token` header (minted by GET /api/auth-config) is validated by
 * double-submit against the shared session, so a token issued by Nitro or
 * Express both work.
 */
import { defineEventHandler, readBody, sendRedirect, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import { loginSchema } from '../../../src/modules/auth/schemas'
import {
  loadSession,
  nitroPrisma,
  regenerateSession,
  requireCsrf,
  saveSession,
  type SessionPayload,
} from '../utils/auth-session'
import {
  getSecuritySettings,
  loginSessionUser,
  recordLoginHistory,
} from '../utils/auth'
import { isAuthRateLimited } from '../utils/rate-limit'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const session =
      (event.context.session as SessionPayload | undefined) ??
      (await loadSession(event))

    // Express runs global doubleCsrfProtection before any route middleware —
    // CSRF failure is a 403 before the rate limit is consulted.
    if (!requireCsrf(event, session, body)) {
      setResponseStatus(event, 403)
      return { error: 'Invalid CSRF token' }
    }
    if (isAuthRateLimited(event)) {
      setResponseStatus(event, 429)
      return { error: 'Too many attempts. Try again in a minute.' }
    }

    const parsed = loginSchema.safeParse(body)
    if (!parsed.success) {
      return sendRedirect(event, '/login?err=invalid_credentials', 302)
    }

    const { identifier, password } = parsed.data
    const { maxAttempts, lockoutMinutes } = await getSecuritySettings()

    const user = await nitroPrisma.users.findFirst({
      where: { OR: [{ email: identifier }, { username: identifier }] },
    })

    // Always run bcrypt to prevent timing-based user enumeration.
    const hash = user?.password ?? '$2b$10$' + 'x'.repeat(53)
    const isPasswordValid = await bcrypt.compare(password, hash)

    // Lockout only matters when the account exists.
    if (user && user.lockedUntil && user.lockedUntil > new Date()) {
      const minutesLeft = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000,
      )
      return sendRedirect(
        event,
        `/login?err=account_locked&wait=${minutesLeft}`,
        302,
      )
    }

    if (!user || !isPasswordValid) {
      // Increment the failed-attempt counter on the matching account.
      if (user) {
        const newAttempts = (user.loginAttempts ?? 0) + 1
        const shouldLock = newAttempts >= maxAttempts
        await nitroPrisma.users.update({
          where: { id: user.id },
          data: {
            loginAttempts: newAttempts,
            lockedUntil: shouldLock
              ? new Date(Date.now() + lockoutMinutes * 60 * 1000)
              : null,
          },
        })
      }
      // Single generic error — never reveal whether the username exists.
      return sendRedirect(event, '/login?err=invalid_credentials', 302)
    }

    // Successful login: reset counters, regenerate the session (fresh sid +
    // empty payload — the old row is destroyed), exactly like Express.
    await nitroPrisma.users.update({
      where: { id: user.id },
      data: { loginAttempts: 0, lockedUntil: null },
    })

    const freshSession = await regenerateSession(event)

    // Two-factor step: hold the login in a pending state until the user
    // verifies their TOTP code on /2fa.
    if (user.totpEnabled) {
      freshSession.pendingUserId = user.id
      await saveSession(event, freshSession)
      return sendRedirect(event, '/2fa', 302)
    }

    freshSession.user = loginSessionUser(user)
    await saveSession(event, freshSession)
    // Mirrors Express ordering (authService.ts): the session is committed
    // before history is written, so a history-write failure still leaves the
    // user signed in (the catch below only changes the redirect target).
    await recordLoginHistory(event, user.id)

    return sendRedirect(event, '/', 302)
  } catch (error) {
    console.error('[login] failed:', error)
    return sendRedirect(event, '/login?err=invalid_credentials', 302)
  }
})
