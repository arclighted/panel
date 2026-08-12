/**
 * GET /api/v1/servers — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): paginated server list with
 * owner + node joins.
 */
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, paginate } from '../../../utils/external-api'

const DEFAULT_PAGE_SIZE = 25

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.read')
  if (!guard.ok) return guard.response

  try {
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const perPage = Number(query.per_page) || DEFAULT_PAGE_SIZE

    const servers = await nitroPrisma.server.findMany({
      include: {
        owner: { select: { id: true, username: true, email: true } },
        node: { select: { id: true, name: true, address: true } },
      },
    })

    return paginate(servers, page, perPage)
  } catch (error) {
    console.error('Error fetching servers:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
