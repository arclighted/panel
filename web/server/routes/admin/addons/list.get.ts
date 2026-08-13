/**
 * GET /admin/addons/list — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Byte-identical (D3): `{ success, addons }`
 * with the DB addon rows, admin-guarded.
 */
import { defineEventHandler } from 'h3'
import { loadSession, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { getAllAddons } from '../../../utils/addon-runtime'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const addons = await getAllAddons()
    return { success: true, addons }
  } catch (error) {
    console.error('Error fetching addon list:', error)
    return {
      success: false,
      message: 'Failed to fetch addons',
    }
  }
})
