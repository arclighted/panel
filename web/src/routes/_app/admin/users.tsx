import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Eye, LoaderCircle, Pencil, Plus, Trash2, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { deleteUser, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/users')({
  component: AdminUsersPage,
})

interface UserRow {
  id: number
  username: string | null
  email: string | null
  avatar: string | null
  isAdmin: boolean
  role: string | null
  createdAt: string
  serverCount: number
  totpEnabled: boolean
}

interface UsersData {
  users: UserRow[]
}

function AdminUsersPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<UsersData>('users')
  const [busy, setBusy] = useState<number | null>(null)

  const users = page.data?.users ?? []

  async function removeUser(id: number, username: string): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete user "${username}"? This cannot be undone.`)) return
    setBusy(id)
    try {
      await deleteUser(id, csrf)
      toast.success('User deleted.')
      void queryClient.invalidateQueries({ queryKey: ['admin-page', 'users'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Users</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {users.length} registered {users.length === 1 ? 'account' : 'accounts'}
          </p>
        </div>
        <Button
          variant="secondary"
          render={<Link to="/admin/users/create" />}
        >
          <Plus className="size-4" />
          New user
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All users</CardTitle>
          <CardDescription>Manage accounts, roles, and server limits</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No users yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {users.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                >
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="size-9 rounded-full border object-cover" />
                  ) : (
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <User className="size-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-medium">
                      {user.username ?? 'Unknown'}
                      {user.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
                      {user.role ? <Badge variant="outline">{user.role}</Badge> : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email ?? '—'} · {user.serverCount} servers
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<Link to="/admin/users/view/$id" params={{ id: String(user.id) }} />}
                    >
                      <Eye className="size-3" />
                      View
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<Link to="/admin/users/edit/$id" params={{ id: String(user.id) }} />}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === user.id}
                      onClick={() => void removeUser(user.id, user.username ?? 'user')}
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
