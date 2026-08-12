/**
 * POST /admin/settings/general — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): allowRegistration,
 * uploadLimit, virusTotalApiKey.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, saveSettings } from '../../../utils/admin-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const data: Record<string, unknown> = {
      allowRegistration: (body as Record<string, unknown>).allowRegistration === true,
    }
    if ((body as Record<string, unknown>).uploadLimit) {
      data.uploadLimit = parseInt(String((body as Record<string, unknown>).uploadLimit), 10) || 100
    }
    if (typeof (body as Record<string, unknown>).virusTotalApiKey === 'string') {
      data.virusTotalApiKey = String((body as Record<string, unknown>).virusTotalApiKey).trim() || null
    }
    await saveSettings(data)
    return { success: true }
  } catch (error) {
    console.error('Error saving general settings:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to save settings.' }
  }
})
