/**
 * PATCH /api/v1/nodes/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.update')
  if (!guard.ok) return guard.response

  try {
    const nodeId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const { name, address, port, ram, cpu, disk, key, sftpPort } = body

    const existing = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (address !== undefined) data.address = address
    if (port !== undefined) data.port = port
    if (ram !== undefined) data.ram = ram
    if (cpu !== undefined) data.cpu = cpu
    if (disk !== undefined) data.disk = disk
    if (key !== undefined) data.key = key
    if (sftpPort !== undefined) data.sftpPort = sftpPort

    const node = await nitroPrisma.node.update({
      where: { id: nodeId },
      data,
      select: {
        id: true,
        name: true,
        address: true,
        port: true,
        ram: true,
        cpu: true,
        disk: true,
        createdAt: true,
      },
    })

    await apiAudit(event, 'node:update', undefined, { metadata: { name: node.name } })
    return { data: node }
  } catch (error) {
    console.error('Error updating node:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
