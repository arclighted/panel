/**
 * GET /api/client/servers/:id/backups — Nitro twin of the Express handler in
 * src/modules/api/client/clientApi.ts. Byte-identical (D3).
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

    const backups = await nitroPrisma.backup.findMany({
      where: { serverId: server.UUID },
      select: {
        UUID: true,
        name: true,
        createdAt: true,
        locked: true,
        size: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return {
      data: backups.map((backup) => ({
        UUID: backup.UUID,
        name: backup.name,
        createdAt: backup.createdAt,
        locked: backup.locked,
        size: backup.size ? backup.size.toString() : null,
      })),
    }
  } catch (err) {
    console.error('Client API: list backups error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Internal error', 500).response
  }
})
