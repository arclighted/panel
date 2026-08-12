/**
 * POST /admin/settings/security — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): validates RPM /
 * attempts / lockout ranges, saves, then refreshes the security cache.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, saveSettings } from '../../../utils/admin-api'
import { refreshSecurityCache } from '../../../../../src/handlers/securityCache'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const rateLimitEnabled = body.rateLimitEnabled === true || body.rateLimitEnabled === 'true'
    const rateLimitRpm = parseInt(String(body.rateLimitRpm), 10)
    const loginMaxAttempts = parseInt(String(body.loginMaxAttempts), 10)
    const loginLockoutMinutes = parseInt(String(body.loginLockoutMinutes), 10)
    const enforceDaemonHttps = body.enforceDaemonHttps === true
    const require2faForAdmins = body.require2faForAdmins === true
    const behindReverseProxy = body.behindReverseProxy === true
    const hashApiKeys = body.hashApiKeys === true

    if (isNaN(rateLimitRpm) || rateLimitRpm < 1 || rateLimitRpm > 10000) {
      setResponseStatus(event, 400)
      return { success: false, error: 'RPM must be between 1 and 10000.' }
    }
    if (isNaN(loginMaxAttempts) || loginMaxAttempts < 1 || loginMaxAttempts > 100) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Max attempts must be between 1 and 100.' }
    }
    if (isNaN(loginLockoutMinutes) || loginLockoutMinutes < 1 || loginLockoutMinutes > 1440) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Lockout must be between 1 and 1440 minutes.' }
    }

    const securityData: Record<string, unknown> = {
      rateLimitEnabled,
      rateLimitRpm,
      loginMaxAttempts,
      loginLockoutMinutes,
      enforceDaemonHttps,
      require2faForAdmins,
      behindReverseProxy,
      hashApiKeys,
    }
    if (typeof body.virusTotalApiKey === 'string') {
      securityData.virusTotalApiKey = body.virusTotalApiKey.trim() || null
    }
    await saveSettings(securityData)
    await refreshSecurityCache()
    return { success: true }
  } catch (error) {
    console.error('Error saving security settings:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to save settings.' }
  }
})
