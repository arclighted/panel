import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react'

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
import { useAuthConfig } from '@/lib/auth-config'
import { updateNode, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/node/$id')({
  component: AdminEditNodePage,
})

interface EditNodeData {
  node: {
    id: number
    name: string
    address: string
    port: number
    ram: number
    cpu: number
    disk: number
    overallocateMemory: number
    overallocateCpu: number
    overallocateDisk: number
    locationId: number | null
  }
  locations: { id: number; name: string }[]
}

function AdminEditNodePage() {
  const { id } = Route.useParams()
  const nodeId = Number(id)
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<EditNodeData>('nodes-edit', nodeId)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('')
  const [ram, setRam] = useState('')
  const [cpu, setCpu] = useState('')
  const [disk, setDisk] = useState('')
  const [locationId, setLocationId] = useState('')
  const [overMemory, setOverMemory] = useState('')
  const [overCpu, setOverCpu] = useState('')
  const [overDisk, setOverDisk] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!page.data) return
    const n = page.data.node
    setName(n.name)
    setAddress(n.address)
    setPort(String(n.port))
    setRam(String(n.ram))
    setCpu(String(n.cpu))
    setDisk(String(n.disk))
    setLocationId(n.locationId != null ? String(n.locationId) : '')
    setOverMemory(String(n.overallocateMemory))
    setOverCpu(String(n.overallocateCpu))
    setOverDisk(String(n.overallocateDisk))
  }, [page.data])

  async function submit(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await updateNode(
        nodeId,
        {
          name,
          address,
          port,
          ram,
          cpu,
          disk,
          locationId,
          overallocateMemory: overMemory,
          overallocateCpu: overCpu,
          overallocateDisk: overDisk,
        },
        csrf,
      )
      toast.success('Node updated.')
      void navigate({ to: '/admin/nodes' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update node.')
    } finally {
      setSaving(false)
    }
  }

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading node...
      </div>
    )
  }

  const locations = page.data.locations

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<a href="/admin/nodes" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Edit {name}</h1>
        </div>
        <Button disabled={saving} onClick={() => void submit()}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Node details</CardTitle>
          <CardDescription>Update daemon connection and capacity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="en-name">Name</Label>
              <Input id="en-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en-address">Address</Label>
              <Input id="en-address" value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="en-port">Port</Label>
              <Input id="en-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en-ram">RAM (MB)</Label>
              <Input id="en-ram" type="number" value={ram} onChange={(e) => setRam(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en-cpu">CPU (%)</Label>
              <Input id="en-cpu" type="number" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="en-disk">Disk (MB)</Label>
              <Input id="en-disk" type="number" value={disk} onChange={(e) => setDisk(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en-over-mem">RAM overalloc (%)</Label>
              <Input id="en-over-mem" type="number" value={overMemory} onChange={(e) => setOverMemory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en-over-cpu">CPU overalloc (%)</Label>
              <Input id="en-over-cpu" type="number" value={overCpu} onChange={(e) => setOverCpu(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="en-over-disk">Disk overalloc (%)</Label>
              <Input id="en-over-disk" type="number" value={overDisk} onChange={(e) => setOverDisk(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="en-location">Location</Label>
              <select
                id="en-location"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
              >
                <option value="">None</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
