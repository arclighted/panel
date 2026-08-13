/**
 * POST /account/2fa/enable — Nitro twin of the Express handler in
 * src/modules/user/twoFactor.ts. Validates the setup code against the session's
 * `pendingTotpSecret`, persists the secret + recovery codes, and clears the
 * pending secret. Byte-identical contract (D3):
 * { success, message, recoveryCodes } | { error }.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  saveSession,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireAuthenticated } from '../../../utils/auth'
import {
  createTotp,
  formatRecoveryCode,
  generateRecoveryCodes,
  hashRecoveryCode,
  normalizeToken,
} from '../../../utils/two-factor'

export default defineEventHandler(async (event) => {
  try {
    const session =
      (event.context.session as SessionPayload | undefined) ??
      (await loadSession(event))

    const body = await readBody(event).catch(() => ({}))
    if (!requireCsrf(event, session, body)) {
      setResponseStatus(event, 403)
      return { error: 'Invalid CSRF token' }
    }

    const guard = await requireAuthenticated(event, session)
    if (!guard.ok) return guard.response
    const user = guard.value

    const { token } = body as { token?: unknown }
    const pendingSecret = session.pendingTotpSecret as string | undefined

    if (!pendingSecret) {
      setResponseStatus(event, 400)
      return { error: 'No pending 2FA secret. Start setup again.' }
    }

    const cleanToken = normalizeToken(token)
    if (!cleanToken) {
      setResponseStatus(event, 400)
      return { error: 'Enter a valid 6-digit code.' }
    }

    if (user.totpEnabled) {
      setResponseStatus(event, 400)
      return { error: 'Two-factor authentication is already enabled.' }
    }

    const totp = createTotp(pendingSecret, user.email)
    if (totp.validate({ token: cleanToken, window: 1 }) === null) {
      setResponseStatus(event, 400)
      return { error: 'Invalid code. Try again.' }
    }

    const codes = generateRecoveryCodes()

    await nitroPrisma.users.update({
      where: { id: user.id },
      data: {
        totpSecret: pendingSecret,
        totpEnabled: true,
        totpRecoveryCodes: JSON.stringify(codes.map(hashRecoveryCode)),
      },
    })

    delete session.pendingTotpSecret
    await saveSession(event, session)

    return {
      success: true,
      message: 'Two-factor authentication enabled.',
      recoveryCodes: codes.map(formatRecoveryCode),
    }
  } catch (error) {
    console.error('[2fa] enable error:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
