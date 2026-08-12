/**
 * POST /admin/servers/:id/unsuspend — Nitro twin of the Express handler in
 * src/modules/admin/servers.ts. Byte-identical (D3): sets Suspended=false,
 * realtime events.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { emitRealtime, serverEvent, userEvent } from '../../../../../../src/handlers/realtime/events'

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

  const serverId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(serverId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid server ID' }
  }

  try {
    const server = await nitroPrisma.server.findUnique({ where: { id: serverId } })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    await nitroPrisma.server.update({
      where: { id: serverId },
      data: { Suspended: false },
    })

    await logActivity(event, session, 'server:unsuspend', {
      serverId: String(server.UUID),
      metadata: { name: server.name },
    })
    emitRealtime(
      serverEvent('server.updated', server.UUID, {
        state: { name: server.name, suspended: false },
      }),
    )
    if (server.ownerId) {
      emitRealtime(
        userEvent('account.suspended', Number(server.ownerId), {
          state: { suspended: false },
        }),
      )
    }
    return { success: true, message: 'Server unsuspended' }
  } catch (error) {
    console.error('Error unsuspending server:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to unsuspend server' }
  }
})
