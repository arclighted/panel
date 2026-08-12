/**
 * GET /admin/images/list — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): JSON list for in-place
 * table updates.
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
    const images = await nitroPrisma.images.findMany({
      select: { id: true, name: true, author: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })
    return { success: true, images }
  } catch (error) {
    console.error('Error listing images:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to list images.' }
  }
})
