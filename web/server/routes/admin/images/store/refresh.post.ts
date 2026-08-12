/**
 * POST /admin/images/store/refresh — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): kicks off a background
 * git pull + catalogue rebuild and returns immediately.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { forceRefresh } from '../../../../../../src/handlers/eggCatalogueService'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    // Don't await — let it run in background and return immediately
    forceRefresh().catch((err) =>
      console.warn(`Store force refresh failed: ${err?.message || err}`),
    )
    return {
      message: 'Refresh started. The catalogue will update in the background.',
    }
  } catch (error) {
    console.error('Failed to start image store refresh:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to start refresh.' }
  }
})
