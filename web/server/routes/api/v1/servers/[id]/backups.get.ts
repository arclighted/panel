/**
 * GET /api/v1/servers/:id/backups — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): lists backups with BigInt
 * size serialized as string.
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

    const backups = await nitroPrisma.backup.findMany({
      where: { serverId: server.UUID },
      orderBy: { createdAt: 'desc' },
      select: {
        UUID: true,
        name: true,
        size: true,
        checksum: true,
        locked: true,
        createdAt: true,
      },
    })

    return {
      data: backups.map((b) => ({
        ...b,
        size: b.size ? b.size.toString() : '0',
      })),
    }
  } catch (error) {
    console.error('Error fetching backups:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
