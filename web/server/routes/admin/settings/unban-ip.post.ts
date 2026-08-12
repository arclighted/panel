/**
 * POST /admin/settings/unban-ip — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
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
    const { ip } = body
    if (!ip || typeof ip !== 'string') {
      setResponseStatus(event, 400)
      return { success: false, error: 'IP is required.' }
    }
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    let banned: string[] = []
    try {
      banned = JSON.parse(settings?.bannedIps || '[]')
    } catch {
      banned = []
    }
    const updated = banned.filter((b) => b !== ip)
    await saveSettings({ bannedIps: JSON.stringify(updated) })
    return { success: true, banned: updated }
  } catch (error) {
    console.error('Error unbanning IP:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to unban IP.' }
  }
})
