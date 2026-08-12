/**
 * GET /api/client/servers/:id/schedules — Nitro twin of the Express handler
 * in src/modules/api/client/clientApi.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../utils/client-api'
import { getParamAsString } from '../../../../../utils/external-api'

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

    const schedules = await nitroPrisma.schedule.findMany({
      where: { serverId: server.UUID },
      select: {
        id: true,
        name: true,
        cron: true,
        enabled: true,
        nextRunAt: true,
        lastRunAt: true,
        createdAt: true,
        tasks: {
          orderBy: { order: 'asc' },
          select: { id: true, action: true, payload: true, order: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return { data: schedules }
  } catch (err) {
    console.error('Client API: list schedules error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Internal error', 500).response
  }
})
