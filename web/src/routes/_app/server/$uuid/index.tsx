import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import { ServerAddressCard, Sparkline } from '@/components/server/server-shell'
import { TerminalConsole, type TerminalHandle } from '@/components/server/terminal'
import { useServerContext, formatRam } from '@/lib/server'
import { useServerLive, type ServerLiveState } from '@/lib/realtime'
import { queryClient } from '@/lib/query-client'

export const Route = createFileRoute('/_app/server/$uuid/')({
  component: ConsolePage,
})

function ConsolePage() {
  const { uuid } = Route.useParams()
  const context = useServerContext(uuid)
  const live = useServerLive(uuid)
  const terminalRef = useRef<TerminalHandle | null>(null)

  const server = context.data?.server
  const online = live.data?.status?.running === true
  const stats = live.data?.stats

  // Rolling sparkline history (last 30 samples per metric).
  const spark = useRef<{ ram: number[]; cpu: number[]; disk: number[] }>({
    ram: [],
    cpu: [],
    disk: [],
  })
  useEffect(() => {
    if (!stats) return
    const push = (arr: number[], value: number | undefined | null) => {
      if (value == null || Number.isNaN(value)) return
      arr.push(value)
      if (arr.length > 30) arr.shift()
    }
    push(spark.current.ram, stats.memory?.percentage)
    push(spark.current.cpu, stats.cpu)
    push(spark.current.disk, stats.disk?.percentage)
  }, [stats])

  const ramText =
    stats?.memory?.percentage != null
      ? `${Math.round(stats.memory.percentage)}% (${formatRam(stats.memory.usage ?? 0)} / ${formatRam(stats.memory.limit ?? 0)})`
      : '0% (0 MB / 0 MB)'
  const cpuText = stats?.cpu != null ? `${Math.round(stats.cpu)}%` : '0%'
  const diskText = stats?.disk?.percentage != null ? `${Math.round(stats.disk.percentage)}%` : '—'

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      {/* Console */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-card lg:w-2/3">
        <TerminalConsole
          ref={terminalRef}
          serverId={uuid}
          online={online}
          onDaemonOffline={(offline) => {
            // The daemon watchers go quiet when the node dies (no explicit
            // offline event), so the console socket's failure signal is the
            // banner trigger — mirror the EJS manage page. Writing into the
            // server-live cache makes the shell's banner react.
            queryClient.setQueryData<ServerLiveState>(['server-live', uuid], (old) => ({
              ...(old ?? {}),
              status: { ...(old?.status ?? {}), daemonOffline: offline },
            }))
          }}
        />
      </div>

      {/* Stats column */}
      <div className="flex w-full flex-col gap-4 lg:w-1/3">
        {server ? <ServerAddressCard address={server.primaryAddress} /> : null}

        <UsageCard
          label="Status"
          value={online ? 'Online' : 'Offline'}
          tone={online ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'}
        />

        <UsageCard label="RAM Usage" value={ramText}>
          <Sparkline
            points={spark.current.ram}
            className="text-muted-foreground/50"
          />
        </UsageCard>

        <UsageCard label="CPU Usage" value={cpuText}>
          <Sparkline
            points={spark.current.cpu}
            className="text-muted-foreground/50"
          />
        </UsageCard>

        <UsageCard label="Disk Usage" value={diskText}>
          <Sparkline
            points={spark.current.disk}
            className="text-muted-foreground/50"
          />
        </UsageCard>
      </div>
    </div>
  )
}

function UsageCard({
  label,
  value,
  tone,
  children,
}: {
  label: string
  value: string
  tone?: string
  children?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4">
      {children ? <div className="absolute inset-0 opacity-40">{children}</div> : null}
      <div className="relative z-10">
        <h2 className="text-sm font-medium text-muted-foreground">{label}:</h2>
        <p className={`mt-1 text-lg font-medium leading-tight tracking-tight ${tone ?? ''}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
