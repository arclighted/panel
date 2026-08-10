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
import { updateUser, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/users/edit/$id')({
  component: AdminEditUserPage,
})

interface EditUserData {
  dataUser: {
    id: number
    username: string | null
    email: string | null
    role: string | null
    isAdmin: boolean
    description: string
    serverLimit: number | null
    maxMemory: number | null
    maxCpu: number | null
    maxStorage: number | null
    maxDatabases: number | null
  }
  canTransferOwner: boolean
}

function AdminEditUserPage() {
  const { id } = Route.useParams()
  const userId = Number(id)
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<EditUserData>('users-edit', userId)

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [description, setDescription] = useState('')
  const [role, setRole] = useState('member')
  const [isAdmin, setIsAdmin] = useState(false)
  const [password, setPassword] = useState('')
  const [serverLimit, setServerLimit] = useState('')
  const [maxMemory, setMaxMemory] = useState('')
  const [maxCpu, setMaxCpu] = useState('')
  const [maxStorage, setMaxStorage] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!page.data) return
    const u = page.data.dataUser
    setUsername(u.username ?? '')
    setEmail(u.email ?? '')
    setDescription(u.description ?? '')
    setRole(u.role ?? 'member')
    setIsAdmin(u.isAdmin)
    setServerLimit(u.serverLimit != null ? String(u.serverLimit) : '')
    setMaxMemory(u.maxMemory != null ? String(u.maxMemory) : '')
    setMaxCpu(u.maxCpu != null ? String(u.maxCpu) : '')
    setMaxStorage(u.maxStorage != null ? String(u.maxStorage) : '')
  }, [page.data])

  const nullable = (value: string) => (value === '' ? null : Number(value))

  async function submit(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await updateUser(
        userId,
        {
          username,
          email,
          description,
          role,
          isAdmin,
          ...(password ? { password } : {}),
          serverLimit: nullable(serverLimit),
          maxMemory: nullable(maxMemory),
          maxCpu: nullable(maxCpu),
          maxStorage: nullable(maxStorage),
        },
        csrf,
      )
      toast.success('User updated.')
      void navigate({ to: '/admin/users' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update user.')
    } finally {
      setSaving(false)
    }
  }

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading user...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<a href="/admin/users" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Edit {username}</h1>
        </div>
        <Button disabled={saving} onClick={() => void submit()}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account details</CardTitle>
          <CardDescription>Update profile, role, and limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eu-username">Username</Label>
              <Input id="eu-username" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-email">Email</Label>
              <Input id="eu-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-desc">Description</Label>
            <Input id="eu-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="eu-password">New password (leave blank to keep)</Label>
            <Input
              id="eu-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="eu-role">Role</Label>
              <select
                id="eu-role"
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
                value={role}
                onChange={(e) => {
                  setRole(e.target.value)
                  setIsAdmin(e.target.value === 'admin' || e.target.value === 'owner')
                }}
              >
                {['member', 'privileged', 'admin', 'owner'].map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-server-limit">Server limit</Label>
              <Input
                id="eu-server-limit"
                type="number"
                value={serverLimit}
                onChange={(e) => setServerLimit(e.target.value)}
                placeholder="Default"
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="eu-memory">Max memory (MB)</Label>
              <Input id="eu-memory" type="number" value={maxMemory} onChange={(e) => setMaxMemory(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-cpu">Max CPU (%)</Label>
              <Input id="eu-cpu" type="number" value={maxCpu} onChange={(e) => setMaxCpu(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eu-storage">Max storage (MB)</Label>
              <Input id="eu-storage" type="number" value={maxStorage} onChange={(e) => setMaxStorage(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
