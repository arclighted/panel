/**
 * Nitro twin of the TOTP / recovery-code helpers in
 * src/modules/user/twoFactor.ts (createTotp, normalizeToken,
 * normalizeRecoveryCode, hashRecoveryCode, consumeRecoveryCode). Kept as a
 * faithful copy so POST /2fa verifies codes exactly like the Express route —
 * same issuer, same window, same recovery-code hashing (sha256 hex in
 * `totpRecoveryCodes`).
 */
import { createHash, randomBytes } from 'node:crypto'
import * as OTPAuth from 'otpauth'
import { nitroPrisma } from './auth-session'

const TOTP_ISSUER = 'Arclight'
const RECOVERY_CODE_COUNT = 10

export function createTotp(secretBase32: string, label: string): OTPAuth.TOTP {
  return new OTPAuth.TOTP({
    issuer: TOTP_ISSUER,
    label,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
}

/** Accepts "123 456", "123456" — the 6-digit code only (mirrors twoFactor.ts). */
export function normalizeToken(token: unknown): string | null {
  if (typeof token !== 'string') {
    return null
  }
  const clean = token.replace(/[\s-]/g, '')
  return /^\d{6}$/.test(clean) ? clean : null
}

/** Accepts "XXXX-XXXX-XXXX" or "XXXXXXXXXXXX" — uppercased hex only. */
export function normalizeRecoveryCode(token: unknown): string | null {
  if (typeof token !== 'string') {
    return null
  }
  const clean = token.replace(/[\s-]/g, '').toUpperCase()
  return /^[A-F0-9]{12}$/.test(clean) ? clean : null
}

export function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/** "ABCDEF123456" → "ABCD-EF12-3456" (mirrors twoFactor.ts). */
export function formatRecoveryCode(raw: string): string {
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`
}

/**
 * Generates `count` fresh recovery codes (12 hex chars each) — mirrors
 * generateRecoveryCodes in twoFactor.ts.
 */
export function generateRecoveryCodes(
  count = RECOVERY_CODE_COUNT,
): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(6).toString('hex').toUpperCase(),
  )
}

/**
 * Consumes one recovery code if it matches a stored sha256 hash — mirrors
 * consumeRecoveryCode in twoFactor.ts (splices it out of the JSON array and
 * persists the remainder, or null when the list is exhausted).
 */
export async function consumeRecoveryCode(
  userId: number,
  code: string,
): Promise<boolean> {
  const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
  if (!user?.totpRecoveryCodes) {
    return false
  }

  const stored = JSON.parse(user.totpRecoveryCodes) as string[]
  const hashed = hashRecoveryCode(code)
  const idx = stored.indexOf(hashed)
  if (idx === -1) {
    return false
  }

  stored.splice(idx, 1)
  await nitroPrisma.users.update({
    where: { id: userId },
    data: { totpRecoveryCodes: stored.length ? JSON.stringify(stored) : null },
  })
  return true
}
