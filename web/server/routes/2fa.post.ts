/**
 * POST /2fa — Nitro-owned twin of the Express JSON handler in
 * src/modules/user/twoFactor.ts. Verifies the TOTP code or a recovery code
 * for the pending login, regenerates the session, and returns the same JSON
 * contract ({ success, redirect } | { error }) with the same status codes.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  regenerateSession,
  requireCsrf,
  saveSession,
  type SessionPayload,
} from '../utils/auth-session'
import { recordLoginHistory, twoFactorSessionUser } from '../utils/auth'
import {
  consumeRecoveryCode,
  createTotp,
  normalizeRecoveryCode,
  normalizeToken,
} from '../utils/two-factor'

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event).catch(() => ({}))
    const session =
      (event.context.session as SessionPayload | undefined) ??
      (await loadSession(event))

    // Express runs global doubleCsrfProtection before this route — keep the
    // same 403 for missing/invalid tokens.
    if (!requireCsrf(event, session, body)) {
      setResponseStatus(event, 403)
      return { error: 'Invalid CSRF token' }
    }

    const { token } = body as { token?: unknown }
    const pendingUserId = session.pendingUserId

    if (!pendingUserId) {
      setResponseStatus(event, 400)
      return { error: 'No login in progress. Sign in again.' }
    }

    const cleanToken = normalizeToken(token)
    const recoveryCode = normalizeRecoveryCode(token)
    if (!cleanToken && !recoveryCode) {
      setResponseStatus(event, 400)
      return { error: 'Enter a valid 6-digit code or recovery code.' }
    }

    const user = await nitroPrisma.users.findUnique({
      where: { id: pendingUserId },
    })
    if (!user || !user.totpEnabled || !user.totpSecret) {
      setResponseStatus(event, 400)
      return { error: 'No login in progress. Sign in again.' }
    }

    const totp = createTotp(user.totpSecret, user.email)
    const totpValid =
      cleanToken && totp.validate({ token: cleanToken, window: 1 }) !== null
    const recoveryValid =
      recoveryCode && (await consumeRecoveryCode(user.id, recoveryCode))

    if (!totpValid && !recoveryValid) {
      setResponseStatus(event, 400)
      return { error: 'Invalid code. Try again.' }
    }

    // Regenerate (fresh sid, empty payload) then commit the authenticated
    // user — mirrors req.session.regenerate + req.session.user in Express.
    const freshSession = await regenerateSession(event)
    freshSession.user = twoFactorSessionUser(user)
    await saveSession(event, freshSession)
    await recordLoginHistory(event, user.id)

    return { success: true, redirect: '/' }
  } catch (error) {
    console.error('[2fa] verify error:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
