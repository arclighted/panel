/**
 * POST /admin/servers/:id/suspend — Nitro twin of the Express handler in
 * src/modules/admin/servers.ts. Byte-identical (D3): sets Suspended=true,
 * best-effort daemon stop, realtime events + suspension email.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { emitRealtime, serverEvent, userEvent } from '../../../../../../src/handlers/realtime/events'
import { sendServerSuspended } from '../../../../../../src/handlers/utils/core/mailer'

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
    const server = await nitroPrisma.server.findUnique({
      where: { id: serverId },
      include: { node: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    await nitroPrisma.server.update({
      where: { id: serverId },
      data: { Suspended: true },
    })

    try {
      await daemonRequest({
        method: 'POST',
        path: '/container/stop',
        nodeAddress: server.node?.address ?? '',
        nodePort: server.node?.port ?? 0,
        nodeKey: server.node?.key ?? '',
        body: { id: server.UUID },
      })
      await nitroPrisma.server
        .update({ where: { UUID: String(server.UUID) }, data: { Running: false } })
        .catch(() => {})
    } catch {
      // ignore if already stopped
    }

    await logActivity(event, session, 'server:suspend', {
      serverId: String(server.UUID),
      metadata: { name: server.name },
    })
    emitRealtime(
      serverEvent('server.updated', server.UUID, {
        state: { name: server.name, suspended: true },
      }),
    )
    if (server.ownerId) {
      emitRealtime(
        userEvent('account.suspended', Number(server.ownerId), {
          state: { suspended: true },
        }),
      )
    }

    const owner = server.ownerId
      ? await nitroPrisma.users.findUnique({
        where: { id: Number(server.ownerId) },
        select: { email: true },
      })
      : null
    if (owner?.email) {
      await sendServerSuspended({
        to: owner.email,
        panelName: 'Arclight',
        serverName: server.name,
        panelUrl: process.env.PANEL_URL ?? '',
      })
    }

    return { success: true, message: 'Server suspended' }
  } catch (error) {
    console.error('Error suspending server:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to suspend server' }
  }
})
