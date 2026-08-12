/**
 * GET /api/client/servers — Nitro twin of the Express handler in
 * src/modules/api/client/clientApi.ts. Byte-identical (D3): lists the API
 * key user's own servers.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireClientApiKey, clientError } from '../../../utils/client-api'

export default defineEventHandler(async (event) => {
  const guard = await requireClientApiKey(event)
  if (!guard.ok) return guard.response

  try {
    const servers = await nitroPrisma.server.findMany({
      where: { ownerId: guard.userId },
      select: {
        UUID: true,
        name: true,
        description: true,
        Installing: true,
        Queued: true,
        Suspended: true,
        nodeId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return { data: servers }
  } catch (err) {
    console.error('Client API: list servers error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Internal error', 500).response
  }
})
