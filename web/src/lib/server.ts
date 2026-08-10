import { useQuery, useQueryClient } from '@tanstack/react-query'

/**
 * Server page data layer. Reads the additive `/api/server/:id/context`
 * payload and the existing Express endpoints (`/server/:id/status`,
 * `/server/:id/power/:action`, `/server/:id/feature/eula`) with the session
 * CSRF header, exactly like the EJS pages do.
 */

export interface ServerContextServer {
  UUID: string
  id: number
  name: string
  description: string
  suspended: boolean
  installing: boolean
  queued: boolean
  running: boolean
  image: string
  node: { name: string; address: string }
  primaryAddress: string
  limits: { memory: number; cpu: number; storage: number; swap: number }
}

export interface ServerNavItem {
  id: string
  label: string
  icon: string
  url: string
  group: string
}

export interface ServerContextPayload {
  server: ServerContextServer
  features: string[]
  installed: { installed: boolean; state: string; failed: boolean }
  status: {
    online: boolean
    starting: boolean
    stopping: boolean
    uptime: number | null
    startedAt: string | null
    error?: string
    daemonOffline?: boolean
  }
  isAdmin: boolean
  isOwner: boolean
  isSubUser: boolean
  subUserPermissions: string[]
  nav: ServerNavItem[]
}

/** Subuser permission check (mirrors subUserHasPermission in serverAuthUtil). */
export function hasServerPermission(perms: string[], permission: string): boolean {
  const parent = permission.includes('.')
    ? permission.slice(0, permission.lastIndexOf('.'))
    : null
  return perms.some((p) => {
    if (p === permission) return true
    if (p.endsWith('.*') && (permission === p.slice(0, -2) || permission.startsWith(p.slice(0, -1)))) {
      return true
    }
    return parent != null && p === parent
  })
}

export type PowerAction = 'start' | 'stop' | 'restart'

export interface PowerResult {
  queued?: boolean
  position?: number
  total?: number
  message?: string
  success?: boolean
}

function csrfHeaders(token: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'CSRF-Token': token } : {}),
  }
}

export async function fetchServerContext(uuid: string): Promise<ServerContextPayload> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/context`, {
    credentials: 'same-origin',
  })
  if (!res.ok) {
    throw new Error('Failed to load server')
  }
  return (await res.json()) as ServerContextPayload
}

export function useServerContext(uuid: string) {
  return useQuery({
    queryKey: ['server-context', uuid],
    queryFn: () => fetchServerContext(uuid),
    enabled: typeof window !== 'undefined',
    staleTime: 30_000,
  })
}

async function post(path: string, csrfToken: string | null): Promise<unknown> {
  const res = await fetch(path, {
    method: 'POST',
    headers: csrfHeaders(csrfToken),
    credentials: 'same-origin',
  })
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed')
  }
  return data
}

/** Start/stop/restart via the existing power endpoints (CSRF-guarded). */
export async function powerAction(
  uuid: string,
  action: PowerAction,
  csrfToken: string | null,
): Promise<PowerResult> {
  return (await post(
    `/server/${encodeURIComponent(uuid)}/power/${action}`,
    csrfToken,
  )) as PowerResult
}

export function usePowerAction(uuid: string) {
  const queryClient = useQueryClient()
  const mutate = async (
    action: PowerAction,
    csrfToken: string | null,
  ): Promise<PowerResult> => {
    const data = await powerAction(uuid, action, csrfToken)
    // A granted action resolves through the realtime bus; a queued one is
    // surfaced immediately by the response. Refresh the dashboard so the
    // server list reflects the new state either way.
    void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    return data
  }
  return { mutate }
}

export async function cancelQueuedStart(
  uuid: string,
  csrfToken: string | null,
): Promise<void> {
  await post(`/server/${encodeURIComponent(uuid)}/power/queue/cancel`, csrfToken)
}

export async function acceptEula(uuid: string, csrfToken: string | null): Promise<void> {
  await post(`/server/${encodeURIComponent(uuid)}/feature/eula`, csrfToken)
}

/* ── Formatters (mirror the EJS helpers) ───────────────────────────────── */

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

export function formatRam(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 MB'
  const mb = bytes / (1024 * 1024)
  if (mb < 1024) return `${mb.toFixed(decimals)} MB`
  return `${(mb / 1024).toFixed(decimals)} GB`
}

export function formatUptime(seconds: number | null | undefined): string {
  if (typeof seconds !== 'number' || Number.isNaN(seconds)) return 'Unknown'
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}
