/**
 * GET /api/v1/servers/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.read')
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: {
        owner: { select: { id: true, username: true, email: true } },
        node: { select: { id: true, name: true, address: true } },
      },
    })

    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    return { data: server }
  } catch (error) {
    console.error('Error fetching server:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
