import { useQuery } from '@tanstack/react-query'

/**
 * Create-server data layer. The context payload (`GET /api/create-server/context`,
 * additive) mirrors the EJS render's gates (feature disabled, no permission,
 * limit reached) and data (nodes, approved images, per-user limits, node
 * headroom, recommended node). Creation posts to the existing `/create-server`.
 */

export interface CreateServerContext {
  success: boolean
  disabled?: boolean
  notAllowed?: boolean
  limitReached?: boolean
  serverLimit?: number
  currentCount?: number
  resourceLimits?: {
    maxMemory: number
    maxCpu: number
    maxStorage: number
  }
  recommendedNodeId?: number | null
  nodeHeadroom?: Record<
    string,
    {
      ram: number
      cpu: number
      disk: number
      overMemory: number
      overCpu: number
      overDisk: number
      usedMemory: number
      usedCpu: number
      usedStorage: number
    }
  >
  nodes?: { id: number; name: string; address: string }[]
  images?: {
    id: number
    name: string
    description: string | null
    startup: string
    dockerImages: { [key: string]: string }[]
    portRequirements: { name: string; internalPort: number }[]
  }[]
}

export async function fetchCreateServerContext(): Promise<CreateServerContext> {
  const res = await fetch('/api/create-server/context', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load server creation data')
  return (await res.json()) as CreateServerContext
}

export function useCreateServerContext() {
  return useQuery({
    queryKey: ['create-server-context'],
    queryFn: fetchCreateServerContext,
  })
}

export interface CreateServerPayload {
  name: string
  description?: string
  nodeId: number
  imageId: number
  dockerImage: string
  Memory: number
  Swap: number
  Cpu: number
  Storage: number
  ports?: { name: string; internalPort: number }[]
}

/** Create a server; resolves with the new server's UUID. */
export async function createServer(
  payload: CreateServerPayload,
  csrf: string | null,
): Promise<string> {
  const res = await fetch('/create-server', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(csrf ? { 'CSRF-Token': csrf } : {}),
    },
    body: JSON.stringify(payload),
    credentials: 'same-origin',
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    let message = 'Failed to create server.'
    try {
      const data = JSON.parse(text) as { error?: string }
      if (data.error) message = data.error
    } catch {
      if (text) message = text
    }
    throw new Error(message)
  }
  const data = (await res.json()) as { serverUUID?: string }
  return data.serverUUID ?? ''
}
