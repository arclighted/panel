import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { LoaderCircle, Users } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/_app/admin/playerstats')({
  component: AdminPlayerStatsPage,
})

interface ServerPlayerStat {
  serverId: string
  serverName: string
  players?: number
  maxPlayers?: number
  online?: boolean
  [key: string]: unknown
}

function AdminPlayerStatsPage() {
  const [servers, setServers] = useState<ServerPlayerStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/playerstats', { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('failed')
        return r.json() as Promise<{ servers?: ServerPlayerStat[] }>
      })
      .then((d) => {
        if (!cancelled) setServers(d.servers ?? [])
      })
      .catch(() => {
        if (!cancelled) setServers([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Player Stats</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Live player counts per server
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Querying servers...
        </div>
      ) : servers.length === 0 ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          No servers to report on.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {servers.map((s) => (
            <Card key={s.serverId}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="size-4 text-muted-foreground" />
                  <span className="truncate">{s.serverName}</span>
                </CardTitle>
                <CardDescription>{s.serverId}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tracking-tight">
                  {typeof s.players === 'number' ? s.players : '—'}
                  {typeof s.maxPlayers === 'number' ? ` / ${s.maxPlayers}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {s.online === true ? 'Online' : 'Offline'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
