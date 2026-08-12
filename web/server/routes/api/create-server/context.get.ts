/**
 * GET /api/create-server/context — Nitro twin of the Express handler in
 * src/modules/user/createServer.ts. Byte-identical payload (D3): the same
 * gates (feature disabled, not allowed, limit reached) and data (per-user
 * limits, nodes, approved images, node headroom, recommended node) the EJS
 * render computes, from the shared SQLite store.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireAuthenticated } from '../../../utils/auth'

const DEFAULT_MAX_MEMORY_MB = 512
const DEFAULT_MAX_CPU_PERCENT = 100
const DEFAULT_MAX_STORAGE_MB = 5120

/** Mirror of resolveUserServerLimit() in createServer.ts. */
async function resolveUserServerLimit(
  userId: number,
  settings: {
    defaultServerLimit?: number | null
    allowPrivilegedServerLimit?: number | null
  } | null,
): Promise<number> {
  const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
  if (!user) {
    return 0
  }
  // Owner and admins are not subject to per-user server limits.
  if (user.role === 'owner' || user.role === 'admin') {
    return Number.MAX_SAFE_INTEGER
  }
  if (user.serverLimit !== null && user.serverLimit !== undefined) {
    return user.serverLimit
  }
  if (user.role === 'privileged') {
    return settings?.allowPrivilegedServerLimit ?? 5
  }
  return settings?.defaultServerLimit ?? 0
}

/** Mirror of resolveUserResourceLimits() in createServer.ts. */
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
  const auth = await requireAuthenticated(event, session)
  if (!auth.ok) {
    return auth.response
  }
  const user = auth.value

  try {
    const userId = user.id
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    if (!settings?.allowUserCreateServer) {
      return { success: false, disabled: true }
    }

    const serverLimit = await resolveUserServerLimit(userId, settings)
    if (serverLimit === 0) {
      return { success: false, notAllowed: true }
    }

    const currentCount = await nitroPrisma.server.count({
      where: { ownerId: userId },
    })
    if (currentCount >= serverLimit) {
      return {
        success: false,
        limitReached: true,
        serverLimit,
        currentCount,
      }
    }

    const resourceLimits = await resolveUserResourceLimits(userId, settings)
    const nodes = await nitroPrisma.node.findMany()
    const images = await nitroPrisma.images.findMany({
      where: { status: 'approved' },
    })

    const nodeHeadroom: Record<string, unknown> = {}
    let recommendedNodeId: number | null = null
    let bestRatio = Infinity
    for (const n of nodes) {
      const agg = await nitroPrisma.server.aggregate({
        where: { nodeId: n.id },
        _sum: { Memory: true, Cpu: true, Storage: true },
      })
      const usedMemory = agg._sum.Memory ?? 0
      const usedCpu = agg._sum.Cpu ?? 0
      const usedStorage = agg._sum.Storage ?? 0
      nodeHeadroom[String(n.id)] = {
        ram: n.ram,
        cpu: n.cpu,
        disk: n.disk,
        overMemory: n.overallocateMemory,
        overCpu: n.overallocateCpu,
        overDisk: n.overallocateDisk,
        usedMemory,
        usedCpu,
        usedStorage,
      }

      const ratios: number[] = []
      if (n.ram > 0) {
        ratios.push(usedMemory / (n.ram * 1024))
      }
      if (n.cpu > 0) {
        ratios.push(usedCpu / n.cpu)
      }
      if (n.disk > 0) {
        ratios.push(usedStorage / (n.disk * 1024))
      }
      const ratio =
        ratios.length > 0
          ? ratios.reduce((sum, r) => sum + r, 0) / ratios.length
          : 0
      if (ratio < bestRatio) {
        bestRatio = ratio
        recommendedNodeId = n.id
      }
    }

    if (
      user.preferredNodeId &&
      nodes.some((n) => n.id === user.preferredNodeId)
    ) {
      recommendedNodeId = user.preferredNodeId
    }

    return {
      success: true,
      serverLimit,
      currentCount,
      resourceLimits,
      recommendedNodeId,
      nodeHeadroom,
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        address: n.address,
      })),
      images: images.map((img) => {
        let dockerImages: Record<string, string>[] = []
        try {
          const parsed: unknown = JSON.parse(img.dockerImages || '[]')
          if (Array.isArray(parsed)) {
            dockerImages = parsed as Record<string, string>[]
          }
        } catch {
          dockerImages = []
        }
        let portRequirements: { name: string; internalPort: number }[] = []
        try {
          const parsed: unknown = JSON.parse(img.portRequirements || '[]')
          if (Array.isArray(parsed)) {
            portRequirements = parsed as { name: string; internalPort: number }[]
          }
        } catch {
          portRequirements = []
        }
        return {
          id: img.id,
          name: img.name,
          description: img.description,
          startup: img.startup,
          dockerImages,
          portRequirements,
        }
      }),
    }
  } catch (error) {
    console.error('Error loading create-server context:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to load server creation data.' }
  }
})
