import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Activity, Gauge, HardDrive, LoaderCircle, MemoryStick, Network, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { deleteNode, useAdminPage } from '@/lib/admin'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/nodes')({
  component: AdminNodesPage,
})

interface NodeRow {
  id: number
  name: string
  address: string
  port: number
  ram: number
  cpu: number
  disk: number
  location: { id: number; name: string } | null
  instanceCount: number
  usage: { memory: number; cpu: number; disk: number }
  allocationCount: number
  allocationsInUse: number
}

interface NodesData {
  nodes: NodeRow[]
  locations: { id: number; name: string }[]
}

function AdminNodesPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<NodesData>('nodes')
  const [busy, setBusy] = useState<number | null>(null)

  const nodes = page.data?.nodes ?? []

  async function removeNode(node: NodeRow): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete node "${node.name}"? This cannot be undone.`)) return
    setBusy(node.id)
    try {
      await deleteNode(node.id, csrf)
      toast.success('Node deleted.')
      void queryClient.invalidateQueries({ queryKey: ['admin-page', 'nodes'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete node.')
    } finally {
      setBusy(null)
    }
  }

  const barColor = (pct: number) =>
    pct > 90 ? 'bg-destructive' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Nodes</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {nodes.length} connected {nodes.length === 1 ? 'node' : 'nodes'}
          </p>
        </div>
        <Button variant="secondary" render={<a href="/admin/nodes/create" />}>
          <Plus className="size-4" />
          New node
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {page.isLoading ? (
          <div className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Loading nodes...
          </div>
        ) : nodes.length === 0 ? (
          <p className="col-span-full rounded-xl border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
            No nodes configured yet.
          </p>
        ) : (
          nodes.map((node) => (
            <Card key={node.id}>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Network className="size-4 text-muted-foreground" />
                      {node.name}
                    </CardTitle>
                    <CardDescription className="font-mono">
                      {node.address}:{node.port}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<a href={`/admin/node/${node.id}/stats`} />}
                    >
                      <Activity className="size-3" />
                      Stats
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<a href={`/admin/node/${node.id}`} />}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === node.id}
                      onClick={() => void removeNode(node)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>{node.location?.name ?? 'No location'}</span>
                  <span>{node.instanceCount} servers</span>
                  <span>
                    {node.allocationsInUse}/{node.allocationCount} ports
                  </span>
                </div>
                {[
                  { label: 'Memory', pct: node.usage.memory, icon: MemoryStick },
                  { label: 'CPU', pct: node.usage.cpu, icon: Gauge },
                  { label: 'Disk', pct: node.usage.disk, icon: HardDrive },
                ].map((bar) => (
                  <div key={bar.label} className="flex items-center gap-3">
                    <bar.icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn('h-full rounded-full transition-all', barColor(bar.pct))}
                        style={{ width: `${Math.min(100, bar.pct)}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-xs text-muted-foreground">
                      {bar.pct}%
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
