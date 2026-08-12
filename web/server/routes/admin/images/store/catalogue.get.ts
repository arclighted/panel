/**
 * GET /admin/images/store/catalogue — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): serves the in-memory
 * egg catalogue built by eggCatalogueService (no GitHub calls at request
 * time), with the same Cache-Control header.
 */
import { defineEventHandler, setResponseHeaders, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { getCatalogue } from '../../../../../../src/handlers/eggCatalogueService'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  if (!requireCsrf(event, session, {})) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const data = getCatalogue()
    setResponseHeaders(event, { 'Cache-Control': 'private, max-age=300' })
    return data
  } catch (error) {
    console.error('Error serving store catalogue:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to load store catalogue.' }
  }
})
