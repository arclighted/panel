/**
 * PATCH /api/v1/servers/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const {
      name,
      description,
      Ports,
      Memory,
      Swap,
      Cpu,
      Storage,
      Variables,
      StartCommand,
      dockerImage,
    } = body

    const existing = await nitroPrisma.server.findUnique({ where: { UUID: serverId } })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (Ports !== undefined) data.Ports = Ports
    if (Memory !== undefined) data.Memory = Memory
    if (Swap !== undefined) data.Swap = Swap
    if (Cpu !== undefined) data.Cpu = Cpu
    if (Storage !== undefined) data.Storage = Storage
    if (Variables !== undefined) data.Variables = Variables
    if (StartCommand !== undefined) data.StartCommand = StartCommand
    if (dockerImage !== undefined) data.dockerImage = dockerImage

    const server = await nitroPrisma.server.update({
      where: { UUID: serverId },
      data,
      include: {
        owner: { select: { id: true, username: true, email: true } },
        node: { select: { id: true, name: true, address: true } },
      },
    })

    await apiAudit(event, 'server:update', serverId, {})
    return { data: server }
  } catch (error) {
    console.error('Error updating server:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
