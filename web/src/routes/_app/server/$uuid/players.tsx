import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LoaderCircle, RefreshCw, Users, Wifi, WifiOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { usePlayersData } from '@/lib/server-pages'

export const Route = createFileRoute('/_app/server/$uuid/players')({
  component: ServerPlayersPage,
})

function ServerPlayersPage() {
  const { uuid } = Route.useParams()
  const queryClient = useQueryClient()
  const players = usePlayersData(uuid)

  const info = players.data?.serverInfo
  const online = players.data?.serverIsOnline === true
  const list = players.data?.players ?? []

  return (
    <div className="space-y-6">
      {/* Server info strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Version</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="truncate text-lg font-semibold tracking-tight">
              {info?.version ?? '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Online Players</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tracking-tight">
              {info ? `${info.onlinePlayers} / ${info.maxPlayers}` : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Status</CardDescription>
          </CardHeader>
          <CardContent>
            <p
              className={`flex items-center gap-1.5 text-sm font-medium ${
                online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
              }`}
            >
              {online ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
              {online ? 'Online' : 'Offline'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Players</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold tracking-tight">{list.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Player list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Connected players</CardTitle>
              <CardDescription>
                Auto-refreshes every 30 seconds
              </CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['server-players', uuid] })}
              disabled={players.isFetching}
            >
              {players.isFetching ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {players.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading players...
            </div>
          ) : players.data?.error && !online ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              Unable to fetch players. The server may be offline or not responding.
            </p>
          ) : list.length === 0 ? (
            <p className="flex items-center justify-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <Users className="size-4" />
              No players online right now.
            </p>
          ) : (
            <ul className="grid grid-cols-1 gap-2 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((player) => (
                <li
                  key={player.uuid || player.name}
                  className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                    {player.name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{player.name}</p>
                    {player.uuid ? (
                      <p className="truncate font-mono text-[10px] text-muted-foreground">
                        {player.uuid}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
