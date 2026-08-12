/**
 * GET /api/v1/nodes/:id/allocations — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, getParamAsNumber } from '../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.read')
  if (!guard.ok) return guard.response

  try {
    const nodeId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
    const node = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
    if (!node) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    const allocations = await nitroPrisma.allocation.findMany({
      where: { nodeId },
      include: { server: { select: { UUID: true, name: true } } },
      orderBy: { port: 'asc' },
    })

    return { data: allocations }
  } catch (error) {
    console.error('Error fetching allocations:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
