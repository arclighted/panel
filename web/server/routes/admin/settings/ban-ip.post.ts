/**
 * POST /admin/settings/ban-ip — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): appends the IP to the
 * banned list (deduped) and returns the full list.
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
    if (!ip || typeof ip !== 'string' || !/^[\d.:a-fA-F]+$/.test(ip)) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid IP address.' }
    }
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    let banned: string[] = []
    try {
      banned = JSON.parse(settings?.bannedIps || '[]')
    } catch {
      banned = []
    }
    if (!banned.includes(ip)) {
      banned.push(ip)
      await saveSettings({ bannedIps: JSON.stringify(banned) })
    }
    return { success: true, banned }
  } catch (error) {
    console.error('Error banning IP:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to ban IP.' }
  }
})
