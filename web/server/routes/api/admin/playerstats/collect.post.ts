/**
 * POST /api/admin/playerstats/collect — Nitro twin of the Express handler
 * in src/modules/admin/playerStats.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { collectPlayerStats } from '../../../../../../src/handlers/playerStatsCollector'

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
    await collectPlayerStats()
    return { success: true, message: 'Player statistics collected successfully' }
  } catch (error) {
    console.error('Failed to collect player statistics:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to collect player statistics' }
  }
})
