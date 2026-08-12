/**
 * POST /api/v1/servers/:id/schedules — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../../utils/external-api'
import { nextRunFromCron, isValidCron } from '../../../../../../../src/utils/cron'

const MIN_TIME_OFFSET = -1440
const MAX_TIME_OFFSET = 1440

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const body = (await readBody(event).catch(() => ({}))) as {
    name?: string
    cron?: string
    timeOffset?: unknown
  }

  if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
    setResponseStatus(event, 400)
    return { error: 'Schedule name is required' }
  }
  if (!body.cron || typeof body.cron !== 'string' || !isValidCron(body.cron.trim())) {
    setResponseStatus(event, 400)
    return { error: 'Invalid cron expression.' }
  }
  const parsedOffset = parseInt(String(body.timeOffset ?? '0'), 10)
  const offset = Number.isNaN(parsedOffset)
    ? 0
    : Math.min(Math.max(parsedOffset, MIN_TIME_OFFSET), MAX_TIME_OFFSET)

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const schedule = await nitroPrisma.schedule.create({
      data: {
        serverId: server.UUID,
        name: body.name.trim(),
        cron: body.cron.trim(),
        enabled: true,
        timeOffset: offset,
        nextRunAt: nextRunFromCron(body.cron.trim()),
      },
    })

    setResponseStatus(event, 201)
    return { data: schedule }
  } catch (error) {
    console.error('Error creating schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create schedule' }
  }
})
