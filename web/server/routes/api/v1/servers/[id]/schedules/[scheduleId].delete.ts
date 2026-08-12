/**
 * DELETE /api/v1/servers/:id/schedules/:scheduleId — Nitro twin of the
 * Express handler in src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const scheduleId = parseInt(
    getParamAsString(getRouterParam(event, 'scheduleId') ?? ''),
    10,
  )

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

    await nitroPrisma.schedule.delete({ where: { id: schedule.id } })
    return { data: { success: true } }
  } catch (error) {
    console.error('Error deleting schedule:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete schedule' }
  }
})
