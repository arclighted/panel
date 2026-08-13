/**
 * POST /account/2fa/disable — Nitro twin of the Express handler in
 * src/modules/user/twoFactor.ts. Verifies the current password, then clears
 * the TOTP secret, enabled flag and recovery codes. Byte-identical contract
 * (D3): { success, message } | { error }.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import bcrypt from 'bcryptjs'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireAuthenticated } from '../../../utils/auth'

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

    const { password } = body as { password?: unknown }
    if (typeof password !== 'string' || !password) {
      setResponseStatus(event, 400)
      return { error: 'Current password is required.' }
    }

    const passwordMatch = await bcrypt.compare(password, user.password)
    if (!passwordMatch) {
      setResponseStatus(event, 401)
      return { error: 'Current password is incorrect.' }
    }

    await nitroPrisma.users.update({
      where: { id: user.id },
      data: {
        totpSecret: null,
        totpEnabled: false,
        totpRecoveryCodes: null,
      },
    })

    return {
      success: true,
      message: 'Two-factor authentication disabled.',
    }
  } catch (error) {
    console.error('[2fa] disable error:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
