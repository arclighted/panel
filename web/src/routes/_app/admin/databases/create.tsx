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
import { createDatabaseHost, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/databases/create')({
  component: AdminCreateDatabasePage,
})

function AdminCreateDatabasePage() {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<{ nodes: { id: number; name: string; address: string }[] }>(
    'databases-create',
  )

  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('3306')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nodeId, setNodeId] = useState('')
  const [saving, setSaving] = useState(false)

  const nodes = page.data?.nodes ?? []

  async function submit(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await createDatabaseHost(
        { name, host, port, username, password, nodeId },
        csrf,
      )
      toast.success('Database host created.')
      void navigate({ to: '/admin/databases' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create database host.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/databases" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Create database host</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Host details</CardTitle>
          <CardDescription>MySQL / MariaDB server for the panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dbh-name">Name *</Label>
              <Input id="dbh-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dbh-host">Host *</Label>
              <Input id="dbh-host" value={host} onChange={(e) => setHost(e.target.value)} placeholder="db.example.com" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dbh-port">Port</Label>
              <Input id="dbh-port" type="number" value={port} onChange={(e) => setPort(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dbh-node">Node</Label>
              <select
                id="dbh-node"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
              >
                <option value="">None</option>
                {nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="dbh-user">Username *</Label>
              <Input id="dbh-user" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dbh-pass">Password *</Label>
              <Input
                id="dbh-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <Button className="w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create host
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
