import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { BookOpen, KeyRound, LoaderCircle, Plus, Power, Trash2 } from 'lucide-react'

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
import {
  createApiKey,
  deleteApiKey,
  toggleApiKey,
  useAdminPage,
} from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/apikeys')({
  component: AdminApiKeysPage,
})

interface ApiKeyRow {
  id: number
  name: string
  description: string | null
  enabled: boolean
  lastUsedAt: string | null
  createdAt: string
  user: { id: number; username: string | null; email: string | null } | null
}

interface ApiKeysData {
  apiKeys: ApiKeyRow[]
  allPermissions: { name: string; value: string }[]
  hashApiKeys: boolean
}

function AdminApiKeysPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<ApiKeysData>('apikeys')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const keys = page.data?.apiKeys ?? []
  const allPermissions = page.data?.allPermissions ?? []

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-page', 'apikeys'] })

  async function submit(): Promise<void> {
    if (!csrf) return
    setCreating(true)
    try {
      await createApiKey({ name, description, permissions }, csrf)
      toast.success(
        page.data?.hashApiKeys
          ? 'API key created. (Key hashing is enabled — the raw key is not stored.)'
          : 'API key created.',
      )
      setName(''); setDescription(''); setPermissions([])
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create API key.')
    } finally {
      setCreating(false)
    }
  }

  async function toggle(key: ApiKeyRow): Promise<void> {
    if (!csrf) return
    setBusy(key.id)
    try {
      await toggleApiKey(key.id, csrf)
      toast.success('API key updated.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle API key.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(key: ApiKeyRow): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete API key "${key.name}"?`)) return
    setBusy(key.id)
    try {
      await deleteApiKey(key.id, csrf)
      toast.success('API key deleted.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete API key.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">API Keys</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {keys.length} key{keys.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button variant="secondary" render={<a href="/admin/api/docs" />}>
          <BookOpen className="size-4" />
          API docs
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            New API key
          </CardTitle>
          <CardDescription>Scoped credentials for the client API</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ak-name">Name *</Label>
              <Input id="ak-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ak-desc">Description</Label>
              <Input id="ak-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Permissions</Label>
            <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-xl border p-3 sm:grid-cols-2">
              {allPermissions.map((perm) => (
                <label key={perm.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={permissions.includes(perm.value)}
                    onChange={(e) =>
                      setPermissions((prev) =>
                        e.target.checked
                          ? [...prev, perm.value]
                          : prev.filter((p) => p !== perm.value),
                      )
                    }
                    className="size-4"
                  />
                  <span className="truncate">{perm.name}</span>
                </label>
              ))}
            </div>
          </div>
          <Button disabled={creating} onClick={() => void submit()}>
            {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Create key
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading API keys...
            </div>
          ) : keys.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No API keys yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {keys.map((key) => (
                <li key={key.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${
                      key.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{key.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {key.user?.username ?? '—'} ·{' '}
                      {key.lastUsedAt
                        ? `last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                        : 'never used'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={busy === key.id}
                      onClick={() => void toggle(key)}
                    >
                      <Power className="size-3" />
                      {key.enabled ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === key.id}
                      onClick={() => void remove(key)}
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
