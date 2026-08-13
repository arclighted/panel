/**
 * GET /api/account/2fa/setup — Nitro twin of the Express JSON handler in
 * src/modules/user/twoFactor.ts. Generates a fresh TOTP secret, stashes it in
 * the session (`pendingTotpSecret`) exactly like Express, and returns the QR
 * data URL for the React setup page. Byte-identical contract (D3):
 * { success, qrDataUrl, secretBase32, required } | { success: false,
 * alreadyEnabled: true } | { error }.
 */
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import QRCode from 'qrcode'
import * as OTPAuth from 'otpauth'
import {
  loadSession,
  saveSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { requireAuthenticated } from '../../../../utils/auth'
import { createTotp } from '../../../../utils/two-factor'

export default defineEventHandler(async (event) => {
  try {
    const session =
      (event.context.session as SessionPayload | undefined) ??
      (await loadSession(event))

    const guard = await requireAuthenticated(event, session)
    if (!guard.ok) return guard.response
    const user = guard.value

    if (user.totpEnabled) {
      return { success: false, alreadyEnabled: true }
    }

    const secret = new OTPAuth.Secret({ size: 20 })
    const secretBase32 = secret.base32
    session.pendingTotpSecret = secretBase32
    await saveSession(event, session)

    const totp = createTotp(secretBase32, user.email)
    const qrDataUrl = await QRCode.toDataURL(totp.toString(), {
      width: 220,
      margin: 1,
    })

    const query = getQuery(event)
    return {
      success: true,
      qrDataUrl,
      secretBase32: secretBase32.match(/.{1,4}/g)?.join(' ') ?? secretBase32,
      required: query.required === '1',
    }
  } catch (error) {
    console.error('[2fa] setup error:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to start 2FA setup.' }
  }
})
