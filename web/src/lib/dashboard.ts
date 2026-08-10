import { useQuery } from '@tanstack/react-query'

export interface DashboardServer {
  UUID: string
  name: string
  description: string | null
  Storage: number
  Suspended: boolean
  shared?: boolean
  status: string
  dockerStatus: string | null
  ramUsage: string
  cpuUsage: string
  ramUsed: string
  nodeOffline?: boolean
  node: { name: string; address: string } | null
  owner: { username: string; avatar: string | null } | null
}

export interface DashboardFolder {
  id: number
  name: string
  /** Server UUIDs that belong to this folder. */
  members: string[]
}

export interface NavItem {
  id: string
  label: string
  url: string
  iconName: string | null
  icon?: string
  matchPrefix: string | null
}

export interface AdminNavGroup {
  section: string
  label: string
  items: NavItem[]
}

export interface DashboardPayload {
  servers: DashboardServer[]
  allServers: DashboardServer[]
  folders: DashboardFolder[]
  canCreateServer: boolean
  currentPage: number
  totalPages: number
  daemonOffline: boolean
  offlineNodes: { name: string; reason: string }[]
  needsOnboarding: boolean
  canCreateServerForOnboarding: boolean
  nav: {
    regular: NavItem[]
    admin: NavItem[]
    adminGroups: AdminNavGroup[]
  }
}

const EMPTY_PAYLOAD: DashboardPayload = {
  servers: [],
  allServers: [],
  folders: [],
  canCreateServer: false,
  currentPage: 1,
  totalPages: 1,
  daemonOffline: false,
  offlineNodes: [],
  needsOnboarding: false,
  canCreateServerForOnboarding: false,
  nav: { regular: [], admin: [], adminGroups: [] },
}

export async function fetchDashboard(page = 1): Promise<DashboardPayload> {
  const res = await fetch(`/api/dashboard?page=${page}`, {
    credentials: 'same-origin',
  })
  if (!res.ok) {
    throw new Error('Failed to load dashboard')
  }
  const data = (await res.json()) as Partial<DashboardPayload>
  // Merge defensively so a partial/legacy-shaped response still renders.
  return { ...EMPTY_PAYLOAD, ...data, nav: { ...EMPTY_PAYLOAD.nav, ...data.nav } }
}

/**
 * Dashboard data query. The Express endpoint reuses the same stale-while-
 * revalidate daemon caches as the EJS page (8–15s TTLs), so a modest client
 * refetch keeps statuses fresh without hammering nodes.
 */
export function useDashboard(page: number, enabled: boolean) {
  // Background refresh keeps daemon stats fresh. Disabled under vitest so
  // the interval never keeps the test process alive.
  const isTest =
    typeof process !== 'undefined' && !!process.env.VITEST
  return useQuery({
    queryKey: ['dashboard', page],
    queryFn: () => fetchDashboard(page),
    enabled,
    staleTime: 10_000,
    refetchInterval: !isTest && enabled ? 15_000 : false,
  })
}

export type ServerStatus =
  | 'online'
  | 'offline'
  | 'starting'
  | 'stopping'
  | 'installing'
  | 'suspended'

/** Mirrors the EJS statusForBadge logic in views/user/dashboard.ejs. */
export function serverStatus(server: DashboardServer): ServerStatus {
  if (server.Suspended) return 'suspended'
  if (server.status === 'running') return 'online'
  if (server.dockerStatus === 'restarting') return 'starting'
  return 'offline'
}

/** Mirrors the EJS storage formatting in views/user/dashboard.ejs. */
export function formatStorage(storage: number): string {
  if (storage === 0) return 'Unlimited'
  return storage >= 1024 ? `${(storage / 1024).toFixed(1)} GB` : `${storage} MB`
}

export function serverInFolder(
  folders: DashboardFolder[],
  uuid: string,
): boolean {
  return folders.some((f) => f.members.includes(uuid))
}
