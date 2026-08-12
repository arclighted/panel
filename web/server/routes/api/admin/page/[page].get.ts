/**
 * GET /api/admin/page/:page — Nitro twin of the Express handler in
 * src/modules/admin/context.ts (admin-only). Delegates to the shared
 * loadAdminPageData() port (web/server/utils/admin-pages.ts) which mirrors
 * the EJS `res.render` payloads case-by-case; unknown pages keep the 404
 * `{ success: false, error }` shape.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { requireAdmin } from '../../../../utils/auth'
import { loadAdminPageData } from '../../../../utils/admin-pages'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const auth = await requireAdmin(event, session)
  if (!auth.ok) {
    return auth.response
  }
  const admin = auth.value

  const page = getRouterParam(event, 'page') ?? ''
  try {
    const data = await loadAdminPageData(page, event, admin)
    if (data && 'error' in data) {
      setResponseStatus(event, 404)
      return { success: false, error: data.error }
    }
    return { success: true, page, data }
  } catch (error) {
    console.error(`Error loading admin page data (${page}):`, error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load page data.' }
  }
})
