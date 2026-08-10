import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Plus } from 'lucide-react'

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
import { createNode, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/nodes/create')({
  component: AdminCreateNodePage,
})

function AdminCreateNodePage() {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<{ locations: { id: number; name: string }[] }>('nodes-create')

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [port, setPort] = useState('3000')
  const [ram, setRam] = useState('')
  const [cpu, setCpu] = useState('')
  const [disk, setDisk] = useState('')
  const [locationId, setLocationId] = useState('')
  const [overMemory, setOverMemory] = useState('0')
  const [overCpu, setOverCpu] = useState('0')
  const [overDisk, setOverDisk] = useState('0')
  const [saving, setSaving] = useState(false)

  async function submit(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await createNode(
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
      toast.success('Node created.')
      void navigate({ to: '/admin/nodes' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create node.')
    } finally {
      setSaving(false)
    }
  }

  const locations = page.data?.locations ?? []

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/nodes" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Create node</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Node details</CardTitle>
          <CardDescription>Point the panel at a new daemon</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cn-name">Name *</Label>
              <Input id="cn-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-address">Address *</Label>
              <Input id="cn-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="192.168.1.10" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-port">Daemon port</Label>
            <Input id="cn-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cn-ram">RAM (MB) *</Label>
              <Input id="cn-ram" type="number" value={ram} onChange={(e) => setRam(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-cpu">CPU (%) *</Label>
              <Input id="cn-cpu" type="number" value={cpu} onChange={(e) => setCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-disk">Disk (MB) *</Label>
              <Input id="cn-disk" type="number" value={disk} onChange={(e) => setDisk(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cn-location">Location</Label>
            <select
              id="cn-location"
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cn-over-mem">RAM overalloc (%)</Label>
              <Input id="cn-over-mem" type="number" value={overMemory} onChange={(e) => setOverMemory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-over-cpu">CPU overalloc (%)</Label>
              <Input id="cn-over-cpu" type="number" value={overCpu} onChange={(e) => setOverCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cn-over-disk">Disk overalloc (%)</Label>
              <Input id="cn-over-disk" type="number" value={overDisk} onChange={(e) => setOverDisk(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create node
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
