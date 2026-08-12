/**
 * PATCH /api/v1/servers/:id/schedules/:scheduleId — Nitro twin of the Express
 * handler in src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../../../utils/external-api'
import { nextRunFromCron } from '../../../../../../../../src/utils/cron'

const MIN_TIME_OFFSET = -1440
const MAX_TIME_OFFSET = 1440

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const scheduleId = parseInt(
    getParamAsString(getRouterParam(event, 'scheduleId') ?? ''),
    10,
  )
  const body = (await readBody(event).catch(() => ({}))) as {
    enabled?: unknown
    timeOffset?: unknown
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

    let offset = schedule.timeOffset ?? 0
    if (body.timeOffset !== undefined) {
      const parsed = parseInt(String(body.timeOffset), 10)
      offset = Number.isNaN(parsed)
        ? 0
        : Math.min(Math.max(parsed, MIN_TIME_OFFSET), MAX_TIME_OFFSET)
    }

    const wantEnabled = body.enabled === true || body.enabled === 'true'
    const updated = await nitroPrisma.schedule.update({
      where: { id: schedule.id },
      data: {
        enabled: wantEnabled,
        timeOffset: offset,
        nextRunAt: wantEnabled ? nextRunFromCron(schedule.cron, offset) : null,
      },
    })

    return { data: updated }
  } catch (error) {
    console.error('Error toggling schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update schedule' }
  }
})
