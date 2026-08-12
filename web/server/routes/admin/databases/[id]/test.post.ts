/**
 * POST /admin/databases/:id/test — Nitro twin of the Express handler in
 * src/modules/admin/databases.ts. Byte-identical (D3): runs a live
 * connection test against the host and reports latency/errors.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { testDatabaseHost } from '../../../../../../src/handlers/utils/core/mysqlProvisioner'
import { safeClientMessage } from '../../../../../../src/utils/errors'

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

  const id = parseInt(getRouterParam(event, 'id') ?? '', 10)
  try {
    const host = await nitroPrisma.databaseHost.findUnique({ where: { id } })
    if (!host) {
      setResponseStatus(event, 404)
      return { success: false, error: 'Database host not found.' }
    }
    const result = await testDatabaseHost(host)
    return {
      ...result,
      error: result.error
        ? safeClientMessage(result.error, 'The database host could not be reached.')
        : undefined,
    }
  } catch (error) {
    console.error('Error testing database host:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to test database host.' }
  }
})
