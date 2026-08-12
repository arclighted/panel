/**
 * DELETE /server/:id/schedules/:scheduleId — Nitro twin of the Express
 * handler in src/modules/user/server/schedules.ts. Byte-identical (D3):
 * deletes the schedule (cascade removes its tasks).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadMutationServer } from '../../../../utils/server-api'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const scheduleId = parseInt(getRouterParam(event, 'scheduleId') ?? '', 10)

  if (isNaN(scheduleId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid schedule id' }
  }

  try {
    const ctx = await loadMutationServer(event, session, serverId, 'schedule.delete')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const schedule = await nitroPrisma.schedule.findFirst({
      where: { id: scheduleId, serverId: server.UUID },
    })
    if (!schedule) {
      setResponseStatus(event, 404)
      return { error: 'Schedule not found' }
    }

    await nitroPrisma.schedule.delete({ where: { id: schedule.id } })
    emitRealtime(
      serverEvent('schedule.deleted', String(server.UUID), {
        state: { id: schedule.id, name: schedule.name },
      }),
    )
    return { success: true, message: 'Schedule deleted.' }
  } catch (error) {
    console.error('Error deleting schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete schedule' }
  }
})
