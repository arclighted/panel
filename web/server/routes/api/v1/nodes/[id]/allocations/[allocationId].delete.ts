/**
 * DELETE /api/v1/nodes/:id/allocations/:allocationId — Nitro twin of the
 * Express handler in src/modules/api/v1/api.ts. Byte-identical (D3): refuses
 * in-use allocations (409), removes the row + port from the pool.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../../../utils/external-api'
import {
  withNodePortLock,
  getNodePortPool,
} from '../../../../../../../../src/handlers/utils/server/allocations'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.update')
  if (!guard.ok) return guard.response

  const nodeId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
  const allocationId = getParamAsNumber(
    getRouterParam(event, 'allocationId') ?? '',
  )

  try {
    const node = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
    if (!node) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    const allocation = await nitroPrisma.allocation.findUnique({
      where: { id: allocationId },
    })
    if (!allocation || allocation.nodeId !== nodeId) {
      setResponseStatus(event, 404)
      return { error: 'Allocation not found' }
    }
    if (allocation.serverId) {
      setResponseStatus(event, 409)
      return { error: 'Allocation is in use and cannot be deleted.' }
    }

    await withNodePortLock(nodeId, async () => {
      await nitroPrisma.allocation.delete({ where: { id: allocation.id } })
      const pool = await getNodePortPool(nodeId)
      await nitroPrisma.node.update({
        where: { id: nodeId },
        data: { allocatedPorts: JSON.stringify(pool) },
      })
    })

    await apiAudit(event, 'node:delete-allocation', undefined, {
      metadata: { nodeId, port: allocation.port },
    })
    return { data: { success: true } }
  } catch (error) {
    console.error('Error deleting allocation:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete allocation' }
  }
})
