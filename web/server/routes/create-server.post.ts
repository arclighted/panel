/**
 * POST /create-server — Nitro twin of the Express handler in
 * src/modules/user/createServer.ts. Byte-identical (D3): per-user limit +
 * resource-limit ladder, node capacity assert, port auto-assignment under
 * the node port lock, and install-queue kick.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../utils/auth-session'
import { queueer } from '../../../src/handlers/queueer'
import { processQueuedServerInstalls } from '../../../src/handlers/installQueue'
import { assertNodeCapacity } from '../../../src/handlers/utils/server/resourceCheck'
import {
  claimNodePorts,
  getNodePortPool,
  withNodePortLock,
} from '../../../src/handlers/utils/server/allocations'
import {
  getUsedExternalPorts,
  isValidPort,
  parseImagePortRequirements,
  pickRandomFreePorts,
  serializeServerPorts,
} from '../../../src/handlers/utils/server/ports'
import type { ServerVariable } from '../../../src/modules/user/server/shared'

interface ClientPort {
  name: string
  internalPort: number
}

// Users choose internal ports (and names) themselves; external ports are always
// auto-assigned from the node pool. Returns null when `raw` is invalid so the
// request is rejected; the create flow falls back to the image's requirements
// when no ports are supplied at all.
function parseClientPorts(raw: unknown): ClientPort[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: ClientPort[] = []
  for (const item of raw) {
    const obj =
      item && typeof item === 'object'
        ? (item as Record<string, unknown>)
        : {}
    const internalPort = Number(obj.internalPort ?? obj.port)
    const name = typeof obj.name === 'string' ? obj.name.trim() : ''
    if (!Number.isInteger(internalPort) || !isValidPort(internalPort) || !name) {
      return null
    }
    out.push({ name, internalPort })
  }
  return out
}

const DEFAULT_MAX_MEMORY_MB = 512
const DEFAULT_MAX_CPU_PERCENT = 100
const DEFAULT_MAX_STORAGE_MB = 5120
const MIN_MEMORY_MB = 128
const MIN_CPU_PERCENT = 50
const MIN_STORAGE_MB = 128
const DEFAULT_BACKUP_LIMIT = 5
const DEFAULT_DATABASE_LIMIT = 5

async function resolveUserServerLimit(
  userId: number,
  settings: {
    defaultServerLimit?: number | null
    allowPrivilegedServerLimit?: number | null
  } | null,
): Promise<number> {
  const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
  if (!user) return 0
  // Owner and admins are not subject to per-user server limits.
  if (user.role === 'owner' || user.role === 'admin') return Number.MAX_SAFE_INTEGER
  if (user.serverLimit !== null && user.serverLimit !== undefined) {
    return user.serverLimit
  }
  if (user.role === 'privileged') return settings?.allowPrivilegedServerLimit ?? 5
  return settings?.defaultServerLimit ?? 0
}

async function resolveUserResourceLimits(
  userId: number,
  settings: {
    defaultMaxMemory?: number | null
    defaultMaxCpu?: number | null
    defaultMaxStorage?: number | null
    allowPrivilegedMaxMemory?: number | null
    allowPrivilegedMaxCpu?: number | null
    allowPrivilegedMaxStorage?: number | null
  } | null,
) {
  const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
  const isPrivilegedRole = user?.role === 'privileged'
  return {
    maxMemory:
      user?.maxMemory ??
      settings?.[isPrivilegedRole ? 'allowPrivilegedMaxMemory' : 'defaultMaxMemory'] ??
      DEFAULT_MAX_MEMORY_MB,
    maxCpu:
      user?.maxCpu ??
      settings?.[isPrivilegedRole ? 'allowPrivilegedMaxCpu' : 'defaultMaxCpu'] ??
      DEFAULT_MAX_CPU_PERCENT,
    maxStorage:
      user?.maxStorage ??
      settings?.[isPrivilegedRole ? 'allowPrivilegedMaxStorage' : 'defaultMaxStorage'] ??
      DEFAULT_MAX_STORAGE_MB,
  }
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const userId = (session as { user?: { id?: unknown } }).user?.id
  if (typeof userId !== 'number') {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }

    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })

    if (!settings?.allowUserCreateServer) {
      setResponseStatus(event, 403)
      return { error: 'Server creation is not enabled.' }
    }

    const serverLimit = await resolveUserServerLimit(userId, settings)
    if (serverLimit === 0) {
      setResponseStatus(event, 403)
      return { error: 'You are not allowed to create servers.' }
    }

    const currentCount = await nitroPrisma.server.count({
      where: { ownerId: userId },
    })
    if (currentCount >= serverLimit) {
      setResponseStatus(event, 403)
      return {
        error: `You have reached your server limit of ${serverLimit}.`,
      }
    }

    const resourceLimits = await resolveUserResourceLimits(userId, settings)

    const { name, description, nodeId, imageId, dockerImage, Memory, Swap, Cpu, Storage } = body

    if (!name || !nodeId || !imageId || !dockerImage || !Memory || !Cpu || !Storage) {
      setResponseStatus(event, 400)
      return { error: 'Missing required fields.' }
    }

    const memory = parseInt(String(Memory), 10)
    const cpu = parseInt(String(Cpu), 10)
    const storage = parseInt(String(Storage), 10)
    const swap = Swap !== undefined && Swap !== '' ? parseInt(String(Swap), 10) : 0

    if (isNaN(memory) || memory < MIN_MEMORY_MB || memory > resourceLimits.maxMemory) {
      setResponseStatus(event, 400)
      return {
        error: `Memory must be between ${MIN_MEMORY_MB} and ${resourceLimits.maxMemory} MB.`,
      }
    }
    if (isNaN(cpu) || cpu < MIN_CPU_PERCENT || cpu > resourceLimits.maxCpu) {
      setResponseStatus(event, 400)
      return {
        error: `CPU must be between ${MIN_CPU_PERCENT} and ${resourceLimits.maxCpu}% (${MIN_CPU_PERCENT}% = half a core).`,
      }
    }
    if (isNaN(storage) || storage < MIN_STORAGE_MB || storage > resourceLimits.maxStorage) {
      setResponseStatus(event, 400)
      return {
        error: `Storage must be between ${MIN_STORAGE_MB} and ${resourceLimits.maxStorage} MB.`,
      }
    }

    const used = await nitroPrisma.server.aggregate({
      where: { ownerId: userId },
      _sum: { Memory: true, Cpu: true, Storage: true },
    })
    const usedMemory = used._sum.Memory ?? 0
    const usedCpu = used._sum.Cpu ?? 0
    const usedStorage = used._sum.Storage ?? 0

    if (usedMemory + memory > resourceLimits.maxMemory) {
      setResponseStatus(event, 400)
      return {
        error: `Memory allocation would exceed your limit of ${resourceLimits.maxMemory} MB (${usedMemory} MB already in use).`,
      }
    }
    if (usedCpu + cpu > resourceLimits.maxCpu) {
      setResponseStatus(event, 400)
      return {
        error: `CPU allocation would exceed your limit of ${resourceLimits.maxCpu}% (${usedCpu}% already in use).`,
      }
    }
    if (usedStorage + storage > resourceLimits.maxStorage) {
      setResponseStatus(event, 400)
      return {
        error: `Storage allocation would exceed your limit of ${resourceLimits.maxStorage} MB (${usedStorage} MB already in use).`,
      }
    }
    if (isNaN(swap) || swap < -1) {
      setResponseStatus(event, 400)
      return {
        error: 'Swap must be -1 (unlimited), 0 (disabled), or a positive MB value.',
      }
    }

    const node = await nitroPrisma.node.findUnique({
      where: { id: parseInt(String(nodeId), 10) },
    })
    if (!node) {
      setResponseStatus(event, 400)
      return { error: 'Node not found.' }
    }

    try {
      await assertNodeCapacity(node, memory, cpu, storage)
    } catch (error) {
      setResponseStatus(event, 400)
      return {
        error: error instanceof Error ? error.message : 'Node capacity exceeded.',
      }
    }

    const image = await nitroPrisma.images.findUnique({
      where: { id: parseInt(String(imageId), 10) },
    })
    if (!image) {
      setResponseStatus(event, 400)
      return { error: 'Image not found.' }
    }
    if (image.status !== 'approved') {
      setResponseStatus(event, 400)
      return { error: 'This image is not approved yet.' }
    }

    const portRequirements = parseImagePortRequirements(image.portRequirements)
    // Port specs the client may supply (the multi-port flow). When omitted,
    // fall back to the image's required ports. External ports are always
    // auto-assigned from the node pool below.
    const hasClientPorts =
      Array.isArray(body.ports) && (body.ports as unknown[]).length > 0
    let portSpecs: ClientPort[] = portRequirements.map((r) => ({
      name: r.name,
      internalPort: r.internalPort,
    }))
    if (hasClientPorts) {
      const parsed = parseClientPorts(body.ports)
      if (!parsed) {
        setResponseStatus(event, 400)
        return { error: 'Invalid port configuration.' }
      }
      if (parsed.length > 20) {
        setResponseStatus(event, 400)
        return { error: 'Too many ports (max 20).' }
      }
      portSpecs = parsed
    }
    const requiredPortCount = Math.max(1, portSpecs.length)

    let dockerImages: Record<string, string>[] = []
    try {
      const parsed: unknown = JSON.parse(image.dockerImages || '[]')
      if (Array.isArray(parsed)) {
        dockerImages = parsed as Record<string, string>[]
      }
    } catch {
      setResponseStatus(event, 500)
      return { error: 'Image docker configuration is invalid.' }
    }

    const imageDocker = dockerImages.find((img) =>
      Object.keys(img).includes(String(dockerImage)),
    )
    if (!imageDocker) {
      setResponseStatus(event, 400)
      return { error: 'Docker image variant not found.' }
    }

    const startCommand = image.startup
    if (!startCommand) {
      setResponseStatus(event, 500)
      return { error: 'Image has no startup command.' }
    }

    let imageVariables: ServerVariable[] = []
    try {
      const parsed: unknown = JSON.parse(image.variables || '[]')
      if (Array.isArray(parsed)) {
        imageVariables = parsed as ServerVariable[]
      }
    } catch {
      imageVariables = []
    }

    let createdServer: { UUID: string; id: number }
    try {
      const result = await withNodePortLock(node.id, async () => {
        const pool = await getNodePortPool(node.id)
        const existingServers = await nitroPrisma.server.findMany({
          where: { nodeId: node.id },
        })
        const picked = pickRandomFreePorts(
          pool,
          getUsedExternalPorts(existingServers),
          requiredPortCount,
        )
        if (picked.length < requiredPortCount) {
          throw new Error(
            `No available ports on the selected node. ${requiredPortCount} port(s) required.`,
          )
        }

        const portsJson = serializeServerPorts(
          picked.map((externalPort, index) => {
            const spec = portSpecs[index]
            return {
              name: spec?.name ?? `Port ${index + 1}`,
              internalPort: spec?.internalPort ?? externalPort,
              externalPort,
              primary: index === 0,
            }
          }),
        )

        const created = await nitroPrisma.server.create({
          data: {
            name: String(name).trim(),
            description: (description as string | undefined)?.trim() || null,
            ownerId: userId,
            nodeId: node.id,
            imageId: image.id,
            Ports: portsJson,
            Memory: memory,
            Swap: swap,
            Cpu: cpu,
            Storage: storage,
            backupLimit: DEFAULT_BACKUP_LIMIT,
            databaseLimit: DEFAULT_DATABASE_LIMIT,
            Variables: JSON.stringify(imageVariables),
            StartCommand: startCommand,
            dockerImage: JSON.stringify(imageDocker),
          },
        })

        await claimNodePorts(node.id, picked, created.UUID).catch(() => {})

        return { assignedPorts: picked, createdServer: created }
      })
      createdServer = result.createdServer
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('No available ports on the selected node.')) {
        setResponseStatus(event, 503)
        return { error: error.message }
      }
      throw error
    }

    queueer.addTask(processQueuedServerInstalls)

    return { success: true, serverUUID: createdServer.UUID }
  } catch (error) {
    console.error('Error creating user server:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create server.' }
  }
})
