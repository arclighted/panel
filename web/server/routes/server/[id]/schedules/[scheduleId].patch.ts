/**
 * PATCH /server/:id/schedules/:scheduleId — Nitro twin of the Express handler
 * in src/modules/user/server/schedules.ts. Byte-identical (D3): toggles
 * enabled and/or adjusts the time offset.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import {
  loadMutationServer,
  nextRunFromCron,
} from '../../../../utils/server-api'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    enabled?: unknown
    timeOffset?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const scheduleId = parseInt(getRouterParam(event, 'scheduleId') ?? '', 10)
  const { enabled, timeOffset } = body

  if (isNaN(scheduleId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid schedule id' }
  }

  try {
    const ctx = await loadMutationServer(event, session, serverId, 'schedule.update')
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

    let offset = schedule.timeOffset ?? 0
    if (timeOffset !== undefined) {
      const parsed = parseInt(String(timeOffset), 10)
      offset = Number.isNaN(parsed)
        ? 0
        : Math.min(Math.max(parsed, -1440), 1440)
    }

    const wantEnabled = enabled === true || enabled === 'true'
    await nitroPrisma.schedule.update({
      where: { id: schedule.id },
      data: {
        enabled: wantEnabled,
        timeOffset: offset,
        nextRunAt: wantEnabled
          ? nextRunFromCron(schedule.cron, offset)
          : null,
      },
    })
    emitRealtime(
      serverEvent('schedule.updated', String(server.UUID), {
        state: { id: schedule.id, enabled: wantEnabled },
      }),
    )

    return {
      success: true,
      message: wantEnabled ? 'Schedule enabled.' : 'Schedule disabled.',
    }
  } catch (error) {
    console.error('Error toggling schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update schedule' }
  }
})
