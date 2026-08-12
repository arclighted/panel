/**
 * GET /admin/radar/virustotal-enabled — Nitro twin of the Express handler
 * in src/modules/admin/radar.ts. Byte-identical (D3).
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  if (!requireCsrf(event, session, {})) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    return { enabled: !!settings?.virusTotalApiKey }
  } catch {
    return { enabled: false }
  }
})
