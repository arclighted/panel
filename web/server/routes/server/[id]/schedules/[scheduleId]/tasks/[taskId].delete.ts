/**
 * DELETE /server/:id/schedules/:scheduleId/tasks/:taskId — Nitro twin of the
 * Express handler in src/modules/user/server/schedules.ts. Byte-identical
 * (D3): removes a task from the schedule.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../../../utils/auth-session'
import { loadMutationServer } from '../../../../../../utils/server-api'

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
  const taskId = parseInt(getRouterParam(event, 'taskId') ?? '', 10)

  if (isNaN(scheduleId) || isNaN(taskId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid ids' }
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

    const task = await nitroPrisma.scheduleTask.findFirst({
      where: { id: taskId, scheduleId: schedule.id },
    })
    if (!task) {
      setResponseStatus(event, 404)
      return { error: 'Task not found' }
    }

    await nitroPrisma.scheduleTask.delete({ where: { id: task.id } })
    return { success: true, message: 'Task removed.' }
  } catch (error) {
    console.error('Error removing schedule task:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to remove task' }
  }
})
