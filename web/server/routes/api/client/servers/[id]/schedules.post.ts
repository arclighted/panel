/**
 * POST /api/client/servers/:id/schedules — Nitro twin of the Express handler
 * in src/modules/api/client/clientApi.ts. Byte-identical (D3): creates a
 * schedule with its first task via the shared createScheduleBodySchema.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../utils/external-api'
import { createScheduleBodySchema, type CreateScheduleBody } from '../../../../../../../src/modules/api/client/dto'
import { nextRunFromCron } from '../../../../../../../src/utils/cron'

export default defineEventHandler(async (event) => {
  const guard = await requireClientApiKey(event)
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
    const server = await resolveServerForUser(serverId, guard.userId)
    if (!server) {
      setResponseStatus(event, 404)
      return clientError(event, 'Server not found', 404).response
    }

    const rawBody = (await readBody(event).catch(() => ({}))) as unknown
    const parsed = createScheduleBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? 'Invalid schedule payload'
      setResponseStatus(event, 400)
      return clientError(event, message).response
    }
    const { name, cron, action, payload } = parsed.data as CreateScheduleBody

    const schedule = await nitroPrisma.schedule.create({
      data: {
        name,
        cron,
        enabled: true,
        nextRunAt: nextRunFromCron(cron.trim()),
        serverId: server.UUID,
        tasks: {
          create: {
            order: 0,
            action,
            payload: payload ?? '{}',
          },
        },
      },
      include: { tasks: { orderBy: { order: 'asc' } } },
    })

    await apiAudit(event, 'schedule:run', server.UUID, {
      metadata: { name, cron, action, source: 'client-api' },
    })

    return { data: schedule }
  } catch (err) {
    console.error('Client API: create schedule error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to create schedule', 500).response
  }
})
