import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react'

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
import { updateServerAdmin, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/servers/edit/$id')({
  component: AdminEditServerPage,
})

interface EditServerData {
  server: {
    id: number
    UUID: string
    name: string
    description: string | null
    Memory: number
    Swap: number
    Cpu: number
    Storage: number
    Suspended: boolean
    Installing: boolean
    dockerImage: string | null
    StartCommand: string | null
    nodeId: number
    ownerId: number
    imageId: number
    backupLimit: number
    databaseLimit: number
    allowStartupEdit: boolean | null
    Ports: string | null
  }
  users: { id: number; username: string | null; email: string | null }[]
  nodes: { id: number; name: string; address: string }[]
  images: { id: number; name: string; startup: string; dockerImages: string }[]
  mounts: { id: number; name: string; source: string; target: string }[]
  serverMounts: { mountId: number }[]
}

function AdminEditServerPage() {
  const { id } = Route.useParams()
  const serverId = Number(id)
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<EditServerData>('servers-edit', serverId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [nodeId, setNodeId] = useState('')
  const [imageId, setImageId] = useState('')
  const [dockerImage, setDockerImage] = useState('')
  const [memory, setMemory] = useState('')
  const [swap, setSwap] = useState('')
  const [cpu, setCpu] = useState('')
  const [storage, setStorage] = useState('')
  const [suspended, setSuspended] = useState(false)
  const [allowStartupEdit, setAllowStartupEdit] = useState(false)
  const [backupLimit, setBackupLimit] = useState('')
  const [databaseLimit, setDatabaseLimit] = useState('')
  const [portsJson, setPortsJson] = useState('[]')
  const [mountIds, setMountIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!page.data) return
    const s = page.data.server
    setName(s.name)
    setDescription(s.description ?? '')
    setOwnerId(String(s.ownerId))
    setNodeId(String(s.nodeId))
    setImageId(String(s.imageId))
    setDockerImage(s.dockerImage ? (JSON.parse(s.dockerImage)[0] ? Object.keys(JSON.parse(s.dockerImage)[0])[0] : '') : '')
    setMemory(String(s.Memory))
    setSwap(String(s.Swap))
    setCpu(String(s.Cpu))
    setStorage(String(s.Storage))
    setSuspended(s.Suspended)
    setAllowStartupEdit(s.allowStartupEdit === true)
    setBackupLimit(String(s.backupLimit))
    setDatabaseLimit(String(s.databaseLimit))
    setPortsJson(s.Ports ?? '[]')
    setMountIds(page.data.serverMounts.map((sm) => sm.mountId))
  }, [page.data])

  async function submit(): Promise<void> {
    if (!csrf) return
    let ports: unknown
    try {
      ports = JSON.parse(portsJson)
    } catch {
      toast.error('Ports must be valid JSON.')
      return
    }
    setSaving(true)
    try {
      await updateServerAdmin(
        serverId,
        {
          name,
          description,
          nodeId,
          imageId,
          Memory: memory,
          Swap: swap,
          Cpu: cpu,
          Storage: storage,
          ownerId,
          allowStartupEdit,
          Suspended: suspended,
          databaseLimit,
          backupLimit,
          ports,
          mountIds,
        },
        csrf,
      )
      toast.success('Server updated.')
      void navigate({ to: '/admin/servers' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update server.')
    } finally {
      setSaving(false)
    }
  }

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading server...
      </div>
    )
  }

  const { users, nodes, images, mounts } = page.data

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<a href="/admin/servers" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{page.data.server.UUID}</p>
          </div>
        </div>
        <Button disabled={saving} onClick={() => void submit()}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="es-name">Name *</Label>
            <Input id="es-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-desc">Description</Label>
            <Input id="es-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-owner">Owner *</Label>
            <select id="es-owner" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username ?? u.email ?? u.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-node">Node *</Label>
            <select id="es-node" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none" value={nodeId} onChange={(e) => setNodeId(e.target.value)}>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-image">Image *</Label>
            <select id="es-image" className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none" value={imageId} onChange={(e) => setImageId(e.target.value)}>
              {images.map((img) => (
                <option key={img.id} value={img.id}>
                  {img.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-docker">Docker image</Label>
            <Input id="es-docker" value={dockerImage} onChange={(e) => setDockerImage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-memory">Memory (MB) *</Label>
            <Input id="es-memory" type="number" value={memory} onChange={(e) => setMemory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-swap">Swap (MB)</Label>
            <Input id="es-swap" type="number" value={swap} onChange={(e) => setSwap(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-cpu">CPU (%) *</Label>
            <Input id="es-cpu" type="number" value={cpu} onChange={(e) => setCpu(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-storage">Storage (MB) *</Label>
            <Input id="es-storage" type="number" value={storage} onChange={(e) => setStorage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-backup">Backup limit</Label>
            <Input id="es-backup" type="number" value={backupLimit} onChange={(e) => setBackupLimit(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="es-db">Database limit</Label>
            <Input id="es-db" type="number" value={databaseLimit} onChange={(e) => setDatabaseLimit(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ports (JSON)</CardTitle>
        </CardHeader>
        <CardContent>
          <textarea
            className="min-h-28 w-full rounded-lg border bg-background p-3 font-mono text-xs focus:outline-none"
            value={portsJson}
            onChange={(e) => setPortsJson(e.target.value)}
            spellCheck={false}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Options</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={suspended} onChange={(e) => setSuspended(e.target.checked)} className="size-4" />
            Suspended
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={allowStartupEdit} onChange={(e) => setAllowStartupEdit(e.target.checked)} className="size-4" />
            Allow the owner to edit the startup command
          </label>
          <div className="space-y-1.5 pt-2">
            <Label>Mounts</Label>
            <div className="grid gap-1 rounded-xl border p-3 sm:grid-cols-2">
              {mounts.map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={mountIds.includes(m.id)}
                    onChange={(e) =>
                      setMountIds((prev) =>
                        e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id),
                      )
                    }
                    className="size-4"
                  />
                  <span className="truncate">{m.name}</span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {m.source}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
