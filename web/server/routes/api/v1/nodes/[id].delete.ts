/**
 * DELETE /api/v1/nodes/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): refuses nodes that still
 * have servers assigned (409).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.delete')
  if (!guard.ok) return guard.response

  try {
    const nodeId = getParamAsNumber(getRouterParam(event, 'id') ?? '')

    const existing = await nitroPrisma.node.findUnique({
      where: { id: nodeId },
      select: { id: true, name: true, _count: { select: { servers: true } } },
    })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    if (existing._count.servers > 0) {
      setResponseStatus(event, 409)
      return { error: 'Cannot delete node with assigned servers' }
    }

    await nitroPrisma.node.delete({ where: { id: nodeId } })

    await apiAudit(event, 'node:delete', undefined, {
      metadata: { name: existing.name },
    })
    return { data: { success: true } }
  } catch (error) {
    console.error('Error deleting node:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
