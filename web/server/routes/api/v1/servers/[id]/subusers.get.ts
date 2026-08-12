/**
 * GET /api/v1/servers/:id/subusers — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): subuser list with parsed
 * permission arrays.
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

    const subUsers = await nitroPrisma.subUser.findMany({
      where: { serverId: server.UUID },
      include: { user: { select: { id: true, username: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    })

    return {
      data: subUsers.map((s) => {
        let permissions: string[] = []
        try {
          const parsed = JSON.parse(s.permissions)
          if (Array.isArray(parsed)) permissions = parsed
        } catch {
          // ignore malformed permission payloads
        }
        return {
          id: s.id,
          user: s.user,
          permissions,
          createdAt: s.createdAt,
        }
      }),
    }
  } catch (error) {
    console.error('Error fetching subusers:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to fetch subusers' }
  }
})
