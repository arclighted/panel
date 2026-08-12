/**
 * DELETE /api/client/servers/:id/schedules/:scheduleId — Nitro twin of the
 * Express handler in src/modules/api/client/clientApi.ts. Byte-identical
 * (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../utils/auth-session'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../../utils/external-api'

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

    const scheduleId = parseInt(
      getParamAsString(getRouterParam(event, 'scheduleId') ?? ''),
      10,
    )
    if (isNaN(scheduleId)) {
      setResponseStatus(event, 400)
      return clientError(event, 'Invalid schedule ID').response
    }

    const schedule = await nitroPrisma.schedule.findFirst({
      where: { id: scheduleId, serverId: server.UUID },
    })
    if (!schedule) {
      setResponseStatus(event, 404)
      return clientError(event, 'Schedule not found', 404).response
    }

    await nitroPrisma.schedule.delete({ where: { id: scheduleId } })

    await apiAudit(event, 'schedule:run', server.UUID, {
      metadata: { name: schedule.name, source: 'client-api' },
    })

    return { message: 'Schedule deleted' }
  } catch (err) {
    console.error('Client API: delete schedule error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to delete schedule', 500).response
  }
})
