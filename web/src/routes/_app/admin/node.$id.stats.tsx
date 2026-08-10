import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  Gauge,
  LoaderCircle,
  MemoryStick,
  HardDrive,
  Cpu,
  Terminal,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/node/$id/stats')({
  component: AdminNodeStatsPage,
})

interface NodeStatsData {
  node: { id: number; name: string; address: string; port: number }
  stats: Record<string, unknown> & { error?: string }
}

interface NodeConfigureData {
  command: string
}

function formatBytes(value: unknown): string {
  const bytes = Number(value)
  if (!Number.isFinite(bytes) || bytes <= 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = bytes
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toFixed(1)} ${units[i]}`
}

function AdminNodeStatsPage() {
  const { id } = Route.useParams()
  const page = useAdminPage<NodeStatsData>('nodes-stats', Number(id))
  const configure = useAdminPage<NodeConfigureData>('nodes-configure', Number(id))
  const [showConfigure, setShowConfigure] = useState(false)

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Fetching node stats...
      </div>
    )
  }

  const { node, stats } = page.data

  if (stats.error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<a href="/admin/nodes" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">{node.name}</h1>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="text-sm">{String(stats.error)}</p>
        </div>
      </div>
    )
  }

  const cards = [
    { label: 'CPU usage', value: `${String(stats.cpu ?? stats.cpu_usage ?? '—')}%`, icon: Cpu },
    { label: 'Memory used', value: formatBytes(stats.memory_used ?? stats.ram_used), icon: MemoryStick },
    { label: 'Memory total', value: formatBytes(stats.memory_total ?? stats.ram_total), icon: MemoryStick },
    { label: 'Disk used', value: formatBytes(stats.disk_used), icon: HardDrive },
    { label: 'Disk total', value: formatBytes(stats.disk_total), icon: HardDrive },
    { label: 'Load', value: String(stats.load ?? '—'), icon: Gauge },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<a href="/admin/nodes" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{node.name} — Stats</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {node.address}:{node.port}
            </p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setShowConfigure(true)}>
          <Terminal className="size-4" />
          Configure
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <card.icon className="size-3.5" />
                {card.label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-xl font-semibold tracking-tight">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showConfigure ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Configure daemon</CardTitle>
              <CardDescription>
                Run this command on the node's server to connect its daemon to the panel.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {configure.isLoading || !configure.data ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <LoaderCircle className="size-4 animate-spin" />
                  Loading configure command...
                </div>
              ) : (
                <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-3 font-mono text-xs">
                  {configure.data.command}
                </pre>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!configure.data}
                  onClick={() => {
                    if (configure.data) {
                      void navigator.clipboard?.writeText(configure.data.command)
                    }
                  }}
                >
                  <Copy className="size-3.5" />
                  Copy
                </Button>
                <Button size="sm" onClick={() => setShowConfigure(false)}>
                  Close
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
