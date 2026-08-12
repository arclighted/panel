/**
 * GET /api/v1/nodes — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, paginate } from '../../../utils/external-api'

const DEFAULT_PAGE_SIZE = 25

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.read')
  if (!guard.ok) return guard.response

  try {
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const perPage = Number(query.per_page) || DEFAULT_PAGE_SIZE

    const nodes = await nitroPrisma.node.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        port: true,
        ram: true,
        cpu: true,
        disk: true,
        createdAt: true,
        _count: { select: { servers: true } },
      },
    })

    return paginate(nodes, page, perPage)
  } catch (error) {
    console.error('Error fetching nodes:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
