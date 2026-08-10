import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FolderOpen, LoaderCircle, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthConfig } from '@/lib/auth-config'
import { createMount, deleteMount, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/mounts')({
  component: AdminMountsPage,
})

interface MountRow {
  id: number
  name: string
  source: string
  target: string
  readOnly: boolean
  _count: { servers: number }
}

interface MountsData {
  mounts: MountRow[]
}

function AdminMountsPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<MountsData>('mounts')
  const [name, setName] = useState('')
  const [source, setSource] = useState('')
  const [target, setTarget] = useState('')
  const [readOnly, setReadOnly] = useState(false)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const mounts = page.data?.mounts ?? []

  async function submit(): Promise<void> {
    if (!csrf) return
    setCreating(true)
    try {
      await createMount({ name, source, target, readOnly }, csrf)
      toast.success('Mount created.')
      setName(''); setSource(''); setTarget(''); setReadOnly(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-page', 'mounts'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create mount.')
    } finally {
      setCreating(false)
    }
  }

  async function removeMount(mount: MountRow): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete mount "${mount.name}"?`)) return
    setBusy(mount.id)
    try {
      await deleteMount(mount.id, csrf)
      toast.success('Mount deleted.')
      void queryClient.invalidateQueries({ queryKey: ['admin-page', 'mounts'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete mount.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Mounts</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Host directories that can be mounted into servers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="size-4" />
            New mount
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="mo-name">Name *</Label>
            <Input id="mo-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mo-source">Host source *</Label>
            <Input id="mo-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="/var/arclight/mounts/data" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mo-target">Container target *</Label>
            <Input id="mo-target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="/data" />
          </div>
          <div className="flex items-end gap-3">
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input
                type="checkbox"
                checked={readOnly}
                onChange={(e) => setReadOnly(e.target.checked)}
                className="size-4"
              />
              Read-only
            </label>
            <Button disabled={creating} onClick={() => void submit()}>
              {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All mounts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading mounts...
            </div>
          ) : mounts.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No mounts configured.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {mounts.map((mount) => (
                <li key={mount.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {mount.name}
                      {mount.readOnly ? <span className="ml-2 text-xs text-muted-foreground">read-only</span> : null}
                    </p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {mount.source} → {mount.target}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {mount._count.servers} servers
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy === mount.id}
                    onClick={() => void removeMount(mount)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
