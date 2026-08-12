/**
 * POST /admin/settings/s3 — Nitro twin of the Express handler in
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
    const s3Data: Record<string, unknown> = {
      s3Enabled: body.s3Enabled === true || body.s3Enabled === 'true',
      s3Endpoint: typeof body.s3Endpoint === 'string' ? body.s3Endpoint.trim() || null : null,
      s3Region: typeof body.s3Region === 'string' ? body.s3Region.trim() || null : null,
      s3Bucket: typeof body.s3Bucket === 'string' ? body.s3Bucket.trim() || null : null,
      s3AccessKey: typeof body.s3AccessKey === 'string' ? body.s3AccessKey.trim() || null : null,
      s3SecretKey: typeof body.s3SecretKey === 'string' ? body.s3SecretKey || null : null,
      s3PathStyle: body.s3PathStyle === true || body.s3PathStyle === 'true',
    }
    await saveSettings(s3Data)
    return { success: true }
  } catch (error) {
    console.error('Error saving S3 settings:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to save S3 settings.' }
  }
})
