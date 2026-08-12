/**
 * POST /server/:id/schedules/:scheduleId/run — Nitro twin of the Express
 * handler in src/modules/user/server/schedules.ts. Byte-identical (D3): runs
 * the schedule's tasks now via the shared scheduler worker, updates lastRunAt
 * / nextRunAt on success.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import {
  loadMutationServer,
  nextRunFromCron,
} from '../../../../../utils/server-api'
import { runSchedule } from '../../../../../../../src/handlers/schedulerWorker'

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
    const ctx = await loadMutationServer(event, session, serverId, 'schedule.update')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const schedule = await nitroPrisma.schedule.findFirst({
      where: { id: scheduleId, serverId: server.UUID },
      include: {
        tasks: { orderBy: { order: 'asc' as const } },
        server: { include: { node: true, image: true } },
      },
    })
    if (!schedule) {
      setResponseStatus(event, 404)
      return { error: 'Schedule not found' }
    }

    if (schedule.tasks.length === 0) {
      setResponseStatus(event, 400)
      return { error: 'This schedule has no tasks. Add a task first.' }
    }

    const result = await runSchedule(schedule)
    if (!result.ok) {
      setResponseStatus(event, 500)
      return {
        error: 'One or more schedule tasks failed.',
        errors: result.errors,
      }
    }
    const now = new Date()
    await nitroPrisma.schedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        nextRunAt: nextRunFromCron(schedule.cron, schedule.timeOffset || 0),
      },
    })

    return { success: true, message: 'Schedule run triggered.' }
  } catch (error) {
    console.error('Error running schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to run schedule' }
  }
})
