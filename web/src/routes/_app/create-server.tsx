import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Box,
  Gauge,
  HardDrive,
  LoaderCircle,
  MemoryStick,
  Plus,
  Server,
  Trash2,
  Zap,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { useAuthConfig } from '@/lib/auth-config'
import {
  createServer,
  useCreateServerContext,
  type CreateServerPayload,
} from '@/lib/create-server'

export const Route = createFileRoute('/_app/create-server')({
  component: CreateServerPage,
})

interface PortRow {
  key: number
  name: string
  internalPort: string
}

function CreateServerPage() {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const ctx = useCreateServerContext()

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [nodeId, setNodeId] = useState<number | null>(null)
  const [imageId, setImageId] = useState<number | null>(null)
  const [dockerImage, setDockerImage] = useState<string>('')
  const [memory, setMemory] = useState('512')
  const [cpu, setCpu] = useState('100')
  const [swap, setSwap] = useState('0')
  const [storage, setStorage] = useState('5')
  const [memoryUnit, setMemoryUnit] = useState<'MB' | 'GB'>('MB')
  const [storageUnit, setStorageUnit] = useState<'MB' | 'GB'>('MB')
  const [ports, setPorts] = useState<PortRow[]>([])
  const [creating, setCreating] = useState(false)

  const data = ctx.data
  const images = data?.images ?? []
  const nodes = data?.nodes ?? []

  // Default the node to the recommended one.
  useEffect(() => {
    if (data?.recommendedNodeId != null && nodeId === null) {
      setNodeId(data.recommendedNodeId)
    }
    if (data?.recommendedNodeId == null && nodeId === null && nodes.length > 0) {
      setNodeId(nodes[0].id)
    }
  }, [data, nodeId, nodes])

  const selectedImage = images.find((img) => img.id === imageId)

  // Seed port rows from the image's required ports when it changes.
  useEffect(() => {
    if (!selectedImage) return
    setPorts(
      (selectedImage.portRequirements ?? []).map((p, i) => ({
        key: i,
        name: p.name,
        internalPort: String(p.internalPort),
      })),
    )
    const firstKey = (selectedImage.dockerImages?.[0] ? Object.keys(selectedImage.dockerImages[0])[0] : '') ?? ''
    setDockerImage(firstKey)
  }, [imageId]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextPortKey = useMemo(() => Math.max(0, ...ports.map((p) => p.key + 1)), [ports])

  const limits = data?.resourceLimits ?? { maxMemory: 512, maxCpu: 100, maxStorage: 5120 }
  const maxMemoryMb = limits.maxMemory
  const maxStorageMb = limits.maxStorage

  async function submit(): Promise<void> {
    if (!csrf) return
    if (!name.trim()) {
      toast.error('Give your server a name.')
      return
    }
    if (nodeId == null || imageId == null || !dockerImage) {
      toast.error('Pick a node, an image, and a Docker image variant.')
      return
    }
    const memoryMb = memoryUnit === 'GB' ? Math.round(Number(memory) * 1024) : Number(memory)
    const storageMb = storageUnit === 'GB' ? Math.round(Number(storage) * 1024) : Number(storage)
    if (!Number.isFinite(memoryMb) || memoryMb < 1 || memoryMb > maxMemoryMb) {
      toast.error(`Memory must be between 1 and ${maxMemoryMb} MB.`)
      return
    }
    if (!Number.isFinite(storageMb) || storageMb < 1 || storageMb > maxStorageMb) {
      toast.error(`Storage must be between 1 and ${maxStorageMb} MB.`)
      return
    }
    const cpuNum = Number(cpu)
    if (!Number.isFinite(cpuNum) || cpuNum < 50 || cpuNum > limits.maxCpu) {
      toast.error(`CPU must be between 50 and ${limits.maxCpu}%.`)
      return
    }

    const payload: CreateServerPayload = {
      name: name.trim(),
      description: description.trim() || undefined,
      nodeId,
      imageId,
      dockerImage,
      Memory: memoryMb,
      Swap: swap === '' ? 0 : Number(swap),
      Cpu: cpuNum,
      Storage: storageMb,
      ports: ports
        .filter((p) => p.name.trim() && p.internalPort.trim())
        .map((p) => ({ name: p.name.trim(), internalPort: Number(p.internalPort) })),
    }

    setCreating(true)
    try {
      const serverUUID = await createServer(payload, csrf)
      toast.success('Server created — installing now.')
      void navigate({ to: '/server/$uuid', params: { uuid: serverUUID } })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create server.')
    } finally {
      setCreating(false)
    }
  }

  if (ctx.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading server creation...
      </div>
    )
  }

  if (!data?.success) {
    const reason = data?.disabled
      ? 'Server creation is not enabled on this panel.'
      : data?.notAllowed
        ? 'You are not allowed to create servers.'
        : data?.limitReached
          ? `You have reached your server limit of ${data.serverLimit ?? '?'}.`
          : 'Server creation is unavailable.'
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>Create a server</CardTitle>
            <CardDescription>{reason}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" render={<a href="/" />}>
              Back to dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Create a server</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          You've used {data.currentCount ?? 0} of {data.serverLimit} server slots.
        </p>
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs-name">Name *</Label>
            <Input
              id="cs-name"
              maxLength={64}
              placeholder="My server"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-desc">Description</Label>
            <Input
              id="cs-desc"
              maxLength={128}
              placeholder="What is this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Node & image */}
      <Card>
        <CardHeader>
          <CardTitle>Node & image</CardTitle>
          <CardDescription>
            The recommended node is the least-loaded one
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Node</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {nodes.map((n) => {
                const headroom = data.nodeHeadroom?.[String(n.id)]
                const selected = nodeId === n.id
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => setNodeId(n.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      selected
                        ? 'border-primary bg-accent/50'
                        : 'border-border hover:bg-accent/30',
                    )}
                  >
                    <Server className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{n.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{n.address}</p>
                      {headroom ? (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {Math.round(
                            (headroom.usedMemory / Math.max(1, headroom.ram * 1024)) * 100,
                          )}
                          % RAM used
                        </p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <Label>Image</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {images.map((img) => {
                const selected = imageId === img.id
                return (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setImageId(img.id)}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
                      selected
                        ? 'border-primary bg-accent/50'
                        : 'border-border hover:bg-accent/30',
                    )}
                  >
                    <Box className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{img.name}</p>
                      {img.description ? (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {img.description}
                        </p>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-docker">Docker image</Label>
            <select
              id="cs-docker"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={dockerImage}
              onChange={(e) => setDockerImage(e.target.value)}
            >
              <option value="">Select a variant</option>
              {(selectedImage?.dockerImages ?? []).flatMap((entry) =>
                Object.entries(entry).map(([key, url]) => (
                  <option key={key} value={key}>
                    {key} — {url}
                  </option>
                )),
              )}
            </select>
          </div>

          {/* Ports */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>Ports</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setPorts((prev) => [...prev, { key: nextPortKey, name: '', internalPort: '' }])
                }
              >
                <Plus className="size-3" />
                Add port
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              External ports are assigned automatically from the node pool. Edit the name and
              internal container port.
            </p>
            {ports.length === 0 ? (
              <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                No ports configured — the image's required ports will be used.
              </p>
            ) : (
              <div className="space-y-2">
                {ports.map((port) => (
                  <div key={port.key} className="flex gap-2">
                    <Input
                      placeholder="Name (e.g. Game Port)"
                      value={port.name}
                      onChange={(e) =>
                        setPorts((prev) =>
                          prev.map((p) => (p.key === port.key ? { ...p, name: e.target.value } : p)),
                        )
                      }
                    />
                    <Input
                      type="number"
                      min={1}
                      max={65535}
                      placeholder="25565"
                      className="w-28"
                      value={port.internalPort}
                      onChange={(e) =>
                        setPorts((prev) =>
                          prev.map((p) =>
                            p.key === port.key ? { ...p, internalPort: e.target.value } : p,
                          ),
                        )
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        setPorts((prev) => prev.filter((p) => p.key !== port.key))
                      }
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>
            Max {maxMemoryMb} MB RAM · {limits.maxCpu}% CPU · {maxStorageMb} MB storage
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs-memory" className="flex items-center gap-1.5">
              <MemoryStick className="size-3.5" /> Memory
            </Label>
            <div className="flex gap-2">
              <Input
                id="cs-memory"
                type="number"
                min={1}
                value={memory}
                onChange={(e) => setMemory(e.target.value)}
              />
              <Button
                variant="secondary"
                className="w-16"
                onClick={() => setMemoryUnit((u) => (u === 'MB' ? 'GB' : 'MB'))}
              >
                {memoryUnit}
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-cpu" className="flex items-center gap-1.5">
              <Gauge className="size-3.5" /> CPU (%)
            </Label>
            <Input
              id="cs-cpu"
              type="number"
              min={50}
              max={limits.maxCpu}
              value={cpu}
              onChange={(e) => setCpu(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">50% = half a core</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-swap" className="flex items-center gap-1.5">
              <Zap className="size-3.5" /> Swap (MB)
            </Label>
            <Input
              id="cs-swap"
              type="number"
              min={-1}
              value={swap}
              onChange={(e) => setSwap(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">-1 = unlimited, 0 = disabled</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cs-storage" className="flex items-center gap-1.5">
              <HardDrive className="size-3.5" /> Storage
            </Label>
            <div className="flex gap-2">
              <Input
                id="cs-storage"
                type="number"
                min={1}
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
              />
              <Button
                variant="secondary"
                className="w-16"
                onClick={() => setStorageUnit((u) => (u === 'MB' ? 'GB' : 'MB'))}
              >
                {storageUnit}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button className="w-full" size="lg" disabled={creating} onClick={() => void submit()}>
        {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Create server
      </Button>
    </div>
  )
}
