/**
 * POST /server/:id/schedules — Nitro twin of the Express handler in
 * src/modules/user/server/schedules.ts. Byte-identical (D3): validates the
 * name + cron, creates the schedule with its next-run time.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import {
  isValidCron,
  loadMutationServer,
  nextRunFromCron,
} from '../../../utils/server-api'
import { emitRealtime, serverEvent } from '../../../../../src/handlers/realtime/events'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    name?: unknown
    cron?: unknown
    timeOffset?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const { name, cron, timeOffset } = body

  if (!name || typeof name !== 'string' || name.trim() === '') {
    setResponseStatus(event, 400)
    return { error: 'Schedule name is required' }
  }
  if (name.trim().length > 60) {
    setResponseStatus(event, 400)
    return { error: 'Schedule name must be 60 characters or less.' }
  }
  if (!cron || typeof cron !== 'string' || !isValidCron(cron.trim())) {
    setResponseStatus(event, 400)
    return { error: 'Invalid cron expression.' }
  }
  const parsedOffset = parseInt(String(timeOffset ?? '0'), 10)
  const offset = Number.isNaN(parsedOffset)
    ? 0
    : Math.min(Math.max(parsedOffset, -1440), 1440)

  try {
    const ctx = await loadMutationServer(event, session, serverId, 'schedule.create')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const schedule = await nitroPrisma.schedule.create({
      data: {
        serverId: server.UUID,
        name: name.trim(),
        cron: cron.trim(),
        enabled: true,
        timeOffset: offset,
        nextRunAt: nextRunFromCron(cron.trim()),
      },
    })
    emitRealtime(
      serverEvent('schedule.created', String(server.UUID), {
        state: { id: schedule.id, name: schedule.name },
      }),
    )

    return { success: true, message: 'Schedule created.', schedule }
  } catch (error) {
    console.error('Error creating schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create schedule' }
  }
})
