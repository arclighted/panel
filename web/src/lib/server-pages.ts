import { useQuery } from '@tanstack/react-query'

/**
 * Data layer for the remaining migrated server pages.
 *
 * - Worlds: the additive `GET /api/server/:id/worlds` endpoint (mirrors the
 *   EJS worlds render: daemon fs-list + isWorld filtering server-side).
 * - Players: the existing `GET /server/:id/players/data` endpoint.
 */

export interface WorldsData {
  worlds: { name: string }[]
  features: string[]
  installed: { installed: boolean; failed: boolean }
  serverStatus: { daemonOffline?: boolean; running?: boolean; online?: boolean }
  daemonError: string | null
}

export async function fetchWorlds(uuid: string): Promise<WorldsData> {
  const res = await fetch(`/api/server/${encodeURIComponent(uuid)}/worlds`, {
    credentials: 'same-origin',
  })
  if (!res.ok) throw new Error('Failed to load worlds')
  return (await res.json()) as WorldsData
}

export function useWorlds(uuid: string) {
  return useQuery({
    queryKey: ['server-worlds', uuid],
    queryFn: () => fetchWorlds(uuid),
    staleTime: 10_000,
  })
}

/** Existing /server/:id/players/data payload. */
export interface PlayersData {
  players: { name: string; uuid: string }[]
  serverInfo: { maxPlayers: number; onlinePlayers: number; version: string }
  serverIsOnline: boolean
  error: string | null
}

export async function fetchPlayersData(uuid: string): Promise<PlayersData> {
  const res = await fetch(`/server/${encodeURIComponent(uuid)}/players/data`, {
    credentials: 'same-origin',
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error('Failed to load players')
  return (await res.json()) as PlayersData
}

export function usePlayersData(uuid: string) {
  return useQuery({
    queryKey: ['server-players', uuid],
    queryFn: () => fetchPlayersData(uuid),
    // The EJS page auto-refreshes every 30s with a countdown; mirror it.
    refetchInterval: 30_000,
  })
}

/** World folder icon by name — matches the EJS worlds page exactly. */
export function worldIcon(name: string): string {
  if (name === 'world') return '/assets/world_icons/overworld.png'
  if (name === 'world_nether') return '/assets/world_icons/nether.png'
  if (name === 'world_the_end') return '/assets/world_icons/end.png'
  if (name.includes('nether')) return '/assets/world_icons/nether.png'
  if (name.includes('end')) return '/assets/world_icons/end.png'
  return '/assets/world_icons/overworld.png'
}
