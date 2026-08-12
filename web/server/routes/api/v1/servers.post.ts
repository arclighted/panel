/**
 * POST /api/v1/servers — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import crypto from 'crypto'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, apiAudit } from '../../../utils/external-api'

const DEFAULT_MEMORY_MB = 512
const DEFAULT_SWAP_MB = 0
const DEFAULT_CPU_PERCENT = 100
const DEFAULT_STORAGE_MB = 5120

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.create')
  if (!guard.ok) return guard.response

  try {
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const {
      name,
      description,
      ownerId,
      nodeId,
      imageId,
      Ports,
      Memory,
      Swap,
      Cpu,
      Storage,
      Variables,
      StartCommand,
      dockerImage,
    } = body

    if (!name || !ownerId || !nodeId || !imageId) {
      setResponseStatus(event, 422)
      return { error: 'name, ownerId, nodeId, and imageId are required' }
    }

    const owner = await nitroPrisma.users.findUnique({
      where: { id: Number(ownerId) },
    })
    if (!owner) {
      setResponseStatus(event, 404)
      return { error: 'Owner not found' }
    }

    const node = await nitroPrisma.node.findUnique({ where: { id: Number(nodeId) } })
    if (!node) {
      setResponseStatus(event, 404)
      return { error: 'Node not found' }
    }

    const image = await nitroPrisma.images.findUnique({
      where: { id: Number(imageId) },
    })
    if (!image) {
      setResponseStatus(event, 404)
      return { error: 'Image not found' }
    }

    const UUID = crypto.randomUUID()

    const server = await nitroPrisma.server.create({
      data: {
        UUID,
        name: String(name),
        description: (description as string | null | undefined) ?? null,
        ownerId: Number(ownerId),
        nodeId: Number(nodeId),
        imageId: Number(imageId),
        Ports: (Ports as string | undefined) ?? '[]',
        Memory: (Memory as number | undefined) ?? DEFAULT_MEMORY_MB,
        Swap: (Swap as number | undefined) ?? DEFAULT_SWAP_MB,
        Cpu: (Cpu as number | undefined) ?? DEFAULT_CPU_PERCENT,
        Storage: (Storage as number | undefined) ?? DEFAULT_STORAGE_MB,
        Variables: (Variables as string | null | undefined) ?? null,
        StartCommand: (StartCommand as string | undefined) ?? image.startup,
        dockerImage: (dockerImage as string | null | undefined) ?? null,
        Installing: false,
        Queued: false,
      },
      include: {
        owner: { select: { id: true, username: true, email: true } },
        node: { select: { id: true, name: true, address: true } },
      },
    })

    await apiAudit(event, 'server:create', UUID, { metadata: { name: String(name) } })
    setResponseStatus(event, 201)
    return { data: server }
  } catch (error) {
    console.error('Error creating server:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
