import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Plus } from 'lucide-react'

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
import { createServerAdmin, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/servers/create')({
  component: AdminCreateServerPage,
})

interface CreateServerData {
  users: { id: number; username: string | null; email: string | null }[]
  nodes: { id: number; name: string; address: string }[]
  images: { id: number; name: string; startup: string; dockerImages: string }[]
}

function AdminCreateServerPage() {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<CreateServerData>('servers-create')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [ownerId, setOwnerId] = useState('')
  const [nodeId, setNodeId] = useState('')
  const [imageId, setImageId] = useState('')
  const [dockerImage, setDockerImage] = useState('')
  const [memory, setMemory] = useState('512')
  const [swap, setSwap] = useState('0')
  const [cpu, setCpu] = useState('100')
  const [storage, setStorage] = useState('5120')
  const [portsJson, setPortsJson] = useState('[]')
  const [saving, setSaving] = useState(false)

  const data = page.data
  const images = data?.images ?? []

  useEffect(() => {
    const image = images.find((img) => img.id === Number(imageId))
    if (!image) return
    try {
      const parsed = JSON.parse(image.dockerImages || '[]')
      const first = Array.isArray(parsed) && parsed[0] ? Object.keys(parsed[0])[0] : ''
      setDockerImage(first ?? '')
      const portReqs: { name: string; internalPort: number }[] = []
      setPortsJson(JSON.stringify(portReqs, null, 2))
    } catch {
      setDockerImage('')
    }
  }, [imageId, images])

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
      await createServerAdmin(
        {
          name,
          description,
          nodeId,
          imageId,
          ports,
          Memory: memory,
          Swap: swap,
          Cpu: cpu,
          Storage: storage,
          dockerImage,
          ownerId,
        },
        csrf,
      )
      toast.success('Server created.')
      void navigate({ to: '/admin/servers' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create server.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/servers" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Create server</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs2-name">Name *</Label>
            <Input id="cs2-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-desc">Description</Label>
            <Input id="cs2-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-owner">Owner *</Label>
            <select
              id="cs2-owner"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              <option value="">Select owner</option>
              {(data?.users ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username ?? u.email ?? u.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-node">Node *</Label>
            <select
              id="cs2-node"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
            >
              <option value="">Select node</option>
              {(data?.nodes ?? []).map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-image">Image *</Label>
            <select
              id="cs2-image"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={imageId}
              onChange={(e) => setImageId(e.target.value)}
            >
              <option value="">Select image</option>
              {images.map((img) => (
                <option key={img.id} value={img.id}>
                  {img.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-docker">Docker image *</Label>
            <Input
              id="cs2-docker"
              value={dockerImage}
              onChange={(e) => setDockerImage(e.target.value)}
              placeholder="Image variant key"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-memory">Memory (MB) *</Label>
            <Input id="cs2-memory" type="number" value={memory} onChange={(e) => setMemory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-swap">Swap (MB)</Label>
            <Input id="cs2-swap" type="number" value={swap} onChange={(e) => setSwap(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-cpu">CPU (%) *</Label>
            <Input id="cs2-cpu" type="number" value={cpu} onChange={(e) => setCpu(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs2-storage">Storage (MB) *</Label>
            <Input id="cs2-storage" type="number" value={storage} onChange={(e) => setStorage(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="cs2-ports">Ports (JSON)</Label>
            <textarea
              id="cs2-ports"
              className="min-h-24 w-full rounded-lg border bg-background p-3 font-mono text-xs focus:outline-none"
              value={portsJson}
              onChange={(e) => setPortsJson(e.target.value)}
              spellCheck={false}
              placeholder='[{"name": "Game Port", "internalPort": 25565}]'
            />
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" disabled={saving} onClick={() => void submit()}>
        {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Create server
      </Button>
    </div>
  )
}
