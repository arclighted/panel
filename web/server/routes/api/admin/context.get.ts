/**
 * GET /api/admin/context — Nitro twin of the Express handler in
 * src/modules/admin/context.ts (admin-only). Byte-identical payload: the
 * safe admin user shape, the admin sidebar groups from the shared UI store,
 * and the 2FA-required-for-admins flag.
 *
 * Deviation (documented in docs/tanstack-migration-plan.md): sidebarGroups
 * comes from the Nitro-side default UI store — addon v2 runtime items live in
 * the Express process only until the addon runtime moves into Nitro.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireAdmin, safeUser } from '../../../utils/auth'
import { uiComponentStore } from '../../../utils/ui-store'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const auth = await requireAdmin(event, session)
  if (!auth.ok) {
    return auth.response
  }
  const admin = auth.value

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: admin.id } })
    if (!user) {
      setResponseStatus(event, 404)
      return { success: false, error: 'User not found.' }
    }
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    return {
      success: true,
      user: safeUser(user),
      sidebarGroups: uiComponentStore.getAdminSidebarGroups(),
      require2faForAdmins: settings?.require2faForAdmins === true,
    }
  } catch (error) {
    console.error('Error loading admin context:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load admin context.' }
  }
})
