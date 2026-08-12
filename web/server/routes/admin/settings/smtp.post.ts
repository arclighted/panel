/**
 * POST /admin/settings/smtp — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, saveSettings } from '../../../utils/admin-api'

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
    const smtpPort = parseInt(String(body.smtpPort), 10)
    if (isNaN(smtpPort) || smtpPort < 1 || smtpPort > 65535) {
      setResponseStatus(event, 400)
      return { success: false, error: 'SMTP port must be between 1 and 65535.' }
    }

    const smtpData: Record<string, unknown> = {
      smtpHost: typeof body.smtpHost === 'string' ? body.smtpHost.trim() || null : null,
      smtpPort,
      smtpUser: typeof body.smtpUser === 'string' ? body.smtpUser.trim() || null : null,
      smtpPassword: typeof body.smtpPassword === 'string' ? body.smtpPassword || null : null,
      smtpFrom: typeof body.smtpFrom === 'string' ? body.smtpFrom.trim() || null : null,
      smtpSecure: body.smtpSecure === true || body.smtpSecure === 'true',
    }
    await saveSettings(smtpData)
    return { success: true }
  } catch (error) {
    console.error('Error saving SMTP settings:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to save SMTP settings.' }
  }
})
