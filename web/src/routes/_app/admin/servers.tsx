import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LoaderCircle, Pencil, Plus, Server, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { deleteServerAdmin, suspendServer, unsuspendServer, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/servers')({
  component: AdminServersPage,
})

interface ServerRow {
  id: number
  UUID: string
  name: string
  description: string | null
  Memory: number
  Cpu: number
  Storage: number
  Suspended: boolean
  Installing: boolean
  image: string | null
  node: { id: number; name: string; address: string } | null
  owner: { id: number; username: string | null; email: string | null } | null
  primaryAddress: string | null
  createdAt: string
}

interface ServersData {
  servers: ServerRow[]
}

function AdminServersPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<ServersData>('servers')
  const [busy, setBusy] = useState<number | null>(null)

  const servers = page.data?.servers ?? []

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-page', 'servers'] })

  async function toggleSuspend(server: ServerRow): Promise<void> {
    if (!csrf) return
    setBusy(server.id)
    try {
      if (server.Suspended) await unsuspendServer(server.id, csrf)
      else await suspendServer(server.id, csrf)
      toast.success(server.Suspended ? 'Server unsuspended.' : 'Server suspended.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update server.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(server: ServerRow): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete server "${server.name}"? This cannot be undone.`)) return
    setBusy(server.id)
    try {
      await deleteServerAdmin(server.id, csrf)
      toast.success('Server deleted.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete server.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Servers</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {servers.length} total
          </p>
        </div>
        <Button variant="secondary" render={<a href="/admin/servers/create" />}>
          <Plus className="size-4" />
          New server
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All servers</CardTitle>
          <CardDescription>Manage every server on the panel</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading servers...
            </div>
          ) : servers.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No servers yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {servers.map((server) => (
                <li key={server.UUID} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Server className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {server.name}
                      {server.Suspended ? <Badge variant="destructive">Suspended</Badge> : null}
                      {server.Installing ? <Badge variant="secondary">Installing</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {server.image ?? 'Unknown image'} · {server.owner?.username ?? '—'} ·{' '}
                      {server.node?.name ?? '—'}
                      {server.primaryAddress ? ` · ${server.primaryAddress}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === server.id}
                      onClick={() => void toggleSuspend(server)}
                    >
                      {server.Suspended ? 'Unsuspend' : 'Suspend'}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<a href={`/admin/servers/edit/${server.id}`} />}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === server.id}
                      onClick={() => void remove(server)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
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
