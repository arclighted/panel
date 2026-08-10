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
import { createUser } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/users/create')({
  component: AdminCreateUserPage,
})

const ROLES = ['member', 'privileged', 'admin', 'owner']

function AdminCreateUserPage() {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('member')
  const [isAdmin, setIsAdmin] = useState(false)
  const [serverLimit, setServerLimit] = useState('')
  const [maxMemory, setMaxMemory] = useState('')
  const [maxCpu, setMaxCpu] = useState('')
  const [maxStorage, setMaxStorage] = useState('')
  const [saving, setSaving] = useState(false)

  const nullable = (value: string) => (value === '' ? null : Number(value))

  async function submit(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await createUser(
        {
          email,
          username,
          password,
          isAdmin,
          role,
          serverLimit: nullable(serverLimit),
          maxMemory: nullable(maxMemory),
          maxCpu: nullable(maxCpu),
          maxStorage: nullable(maxStorage),
        },
        csrf,
      )
      toast.success('User created.')
      void navigate({ to: '/admin/users' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create user.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/users" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Create user</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Create a new user on the panel</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cu-username">Username *</Label>
              <Input
                id="cu-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="3–20 letters and numbers"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-email">Email *</Label>
              <Input
                id="cu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cu-password">Password *</Label>
            <Input
              id="cu-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 chars, one letter and one number"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cu-role">Role</Label>
              <select
                id="cu-role"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value)
                  setIsAdmin(e.target.value === 'admin' || e.target.value === 'owner')
                }}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-server-limit">Server limit</Label>
              <Input
                id="cu-server-limit"
                type="number"
                min={0}
                value={serverLimit}
                onChange={(e) => setServerLimit(e.target.value)}
                placeholder="Default"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="cu-memory">Max memory (MB)</Label>
              <Input id="cu-memory" type="number" value={maxMemory} onChange={(e) => setMaxMemory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-cpu">Max CPU (%)</Label>
              <Input id="cu-cpu" type="number" value={maxCpu} onChange={(e) => setMaxCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cu-storage">Max storage (MB)</Label>
              <Input id="cu-storage" type="number" value={maxStorage} onChange={(e) => setMaxStorage(e.target.value)} />
            </div>
          </div>
          <Button className="w-full" disabled={saving} onClick={() => void submit()}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create user
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
