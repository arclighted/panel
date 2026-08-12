/**
 * GET /api/v1/nodes/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.read')
  if (!guard.ok) return guard.response

  try {
    const nodeId = getParamAsNumber(getRouterParam(event, 'id') ?? '')

    const node = await nitroPrisma.node.findUnique({
      where: { id: nodeId },
      select: {
        id: true,
        name: true,
        address: true,
        port: true,
        ram: true,
        cpu: true,
        disk: true,
        createdAt: true,
        servers: {
          select: {
            id: true,
            UUID: true,
            name: true,
            Memory: true,
            Cpu: true,
            Storage: true,
          },
        },
      },
    })

    if (!node) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    return { data: node }
  } catch (error) {
    console.error('Error fetching node:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
