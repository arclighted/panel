/**
 * POST /api/v1/nodes/:id/allocations — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): adds a port to the node
 * pool under the port lock and syncs allocations.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../../utils/external-api'
import {
  withNodePortLock,
  getNodePortPool,
  syncNodeAllocations,
} from '../../../../../../../src/handlers/utils/server/allocations'

const MIN_PORT_NUMBER = 1024
const MAX_PORT_NUMBER = 65535

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.update')
  if (!guard.ok) return guard.response

  const nodeId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
  const body = (await readBody(event).catch(() => ({}))) as {
    ip?: string
    port?: unknown
  }

  try {
    const node = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
    if (!node) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    const parsedPort = parseInt(String(body.port), 10)
    if (isNaN(parsedPort) || parsedPort < MIN_PORT_NUMBER || parsedPort > MAX_PORT_NUMBER) {
      setResponseStatus(event, 422)
      return {
        error: `Port must be a number between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER}`,
      }
    }

    await withNodePortLock(nodeId, async () => {
      const pool = await getNodePortPool(nodeId)
      const next = Array.from(new Set([...pool, parsedPort])).sort((a, b) => a - b)
      await syncNodeAllocations(nodeId, next, String(body.ip ?? ''))
      // Keep the admin-configured pool in sync with the new row.
      await nitroPrisma.node.update({
        where: { id: nodeId },
        data: { allocatedPorts: JSON.stringify(next) },
      })
    })

    const allocation = await nitroPrisma.allocation.findUnique({
      where: {
        nodeId_ip_port: {
          nodeId,
          ip: String(body.ip ?? ''),
          port: parsedPort,
        },
      },
    })

    await apiAudit(event, 'allocation:create', undefined, {
      metadata: { nodeId, port: parsedPort },
    })
    setResponseStatus(event, 201)
    return { data: allocation }
  } catch (error) {
    console.error('Error creating allocation:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create allocation' }
  }
})
