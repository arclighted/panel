/**
 * POST /api/v1/servers/:id/schedules/:scheduleId/tasks — Nitro twin of the
 * Express handler in src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../../../../utils/external-api'

const POWER_ACTIONS = ['start', 'stop', 'restart', 'kill'] as const
const TASK_ACTIONS = ['command', 'power', 'backup'] as const

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const scheduleId = parseInt(
    getParamAsString(getRouterParam(event, 'scheduleId') ?? ''),
    10,
  )
  const body = (await readBody(event).catch(() => ({}))) as {
    action?: string
    payload?: Record<string, unknown>
    timeOffset?: unknown
  }

  if (!body.action || !(TASK_ACTIONS as readonly string[]).includes(body.action)) {
    setResponseStatus(event, 400)
    return { error: 'Task action must be one of: command, power, backup.' }
  }
  if (!body.payload || typeof body.payload !== 'object') {
    setResponseStatus(event, 400)
    return { error: 'Task payload is required.' }
  }
  if (body.action === 'command' && !String(body.payload.command ?? '').trim()) {
    setResponseStatus(event, 400)
    return { error: 'Command is required.' }
  }
  if (
    body.action === 'power' &&
    !(POWER_ACTIONS as readonly string[]).includes(String(body.payload.action ?? ''))
  ) {
    setResponseStatus(event, 400)
    return { error: 'Power action must be one of: start, stop, restart, kill.' }
  }
  if (body.action === 'backup' && !String(body.payload.name ?? '').trim()) {
    setResponseStatus(event, 400)
    return { error: 'Backup name is required.' }
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

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
        action: body.action,
        payload: JSON.stringify(body.payload),
        timeOffset: Math.max(0, parseInt(String(body.timeOffset), 10) || 0),
      },
    })

    setResponseStatus(event, 201)
    return { data: { ...task, payload: body.payload } }
  } catch (error) {
    console.error('Error adding schedule task:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to add task' }
  }
})
