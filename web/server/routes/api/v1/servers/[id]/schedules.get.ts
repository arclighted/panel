/**
 * GET /api/v1/servers/:id/schedules — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): schedules with parsed task
 * payloads.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.read')
  if (!guard.ok) return guard.response

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: getParamAsString(getRouterParam(event, 'id') ?? '') },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const schedules = await nitroPrisma.schedule.findMany({
      where: { serverId: server.UUID },
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: schedules.map((s) => ({
        ...s,
        tasks: s.tasks.map((t) => {
          let payload: unknown = {}
          try {
            payload = JSON.parse(t.payload || '{}')
          } catch {
            payload = {}
          }
          return { ...t, payload }
        }),
      })),
    }
  } catch (error) {
    console.error('Error fetching schedules:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
