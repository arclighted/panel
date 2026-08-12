/**
 * POST /api/v1/servers/:id/suspend — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')

    const existing = await nitroPrisma.server.findUnique({ where: { UUID: serverId } })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    if (existing.Suspended) {
      setResponseStatus(event, 409)
      return { error: 'Server is already suspended' }
    }

    const server = await nitroPrisma.server.update({
      where: { UUID: serverId },
      data: { Suspended: true },
    })

    await apiAudit(event, 'server:suspend', serverId, {})
    return { data: server }
  } catch (error) {
    console.error('Error suspending server:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
