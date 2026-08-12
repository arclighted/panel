/**
 * POST /server/:id/schedules/:scheduleId/tasks — Nitro twin of the Express
 * handler in src/modules/user/server/schedules.ts. Byte-identical (D3):
 * validates action/payload and appends a task to the schedule.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import { loadMutationServer } from '../../../../../utils/server-api'

const POWER_ACTIONS = ['start', 'stop', 'restart', 'kill'] as const
const TASK_ACTIONS = ['command', 'power', 'backup'] as const

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    action?: unknown
    payload?: unknown
    timeOffset?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const scheduleId = parseInt(getRouterParam(event, 'scheduleId') ?? '', 10)
  const { action, payload, timeOffset = 0 } = body

  if (isNaN(scheduleId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid schedule id' }
  }
  if (!action || !(TASK_ACTIONS as readonly string[]).includes(String(action))) {
    setResponseStatus(event, 400)
    return { error: 'Task action must be one of: command, power, backup.' }
  }
  if (!payload || typeof payload !== 'object') {
    setResponseStatus(event, 400)
    return { error: 'Task payload is required.' }
  }
  const taskPayload = payload as Record<string, unknown>
  if (action === 'command' && !String(taskPayload.command ?? '').trim()) {
    setResponseStatus(event, 400)
    return { error: 'Command is required.' }
  }
  if (
    action === 'power' &&
    !(POWER_ACTIONS as readonly string[]).includes(
      String(taskPayload.action ?? ''),
    )
  ) {
    setResponseStatus(event, 400)
    return { error: 'Power action must be one of: start, stop, restart, kill.' }
  }
  if (action === 'backup' && !String(taskPayload.name ?? '').trim()) {
    setResponseStatus(event, 400)
    return { error: 'Backup name is required.' }
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

    const taskCount = await nitroPrisma.scheduleTask.count({
      where: { scheduleId: schedule.id },
    })

    const task = await nitroPrisma.scheduleTask.create({
      data: {
        scheduleId: schedule.id,
        order: taskCount,
        action: String(action),
        payload: JSON.stringify(taskPayload),
        timeOffset: Math.max(0, parseInt(String(timeOffset), 10) || 0),
      },
    })

    return { success: true, message: 'Task added.', task }
  } catch (error) {
    console.error('Error adding schedule task:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to add task' }
  }
})
