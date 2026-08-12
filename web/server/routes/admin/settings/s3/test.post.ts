/**
 * POST /admin/settings/s3/test — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): probes the S3
 * connection and surfaces the latency via the safe client message helper.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { testS3Connection } from '../../../../../../src/handlers/utils/core/s3Client'
import { safeClientMessage } from '../../../../../../src/utils/errors'

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
    const result = await testS3Connection()
    if (result.success) {
      return { success: true, message: `S3 connection verified (${result.latency}ms).` }
    }
    setResponseStatus(event, 500)
    return {
      success: false,
      error: result.error ? safeClientMessage(result.error, 'S3 connection failed.') : 'S3 connection failed.',
    }
  } catch (error) {
    console.error('S3 test failed:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'S3 connection failed.' }
  }
})
