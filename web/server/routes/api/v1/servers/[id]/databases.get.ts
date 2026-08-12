/**
 * GET /api/v1/servers/:id/databases — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
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

    const databases = await nitroPrisma.serverDatabase.findMany({
      where: { serverId: server.UUID },
      include: { host: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    })

    return { data: databases }
  } catch (error) {
    console.error('Error fetching databases:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
