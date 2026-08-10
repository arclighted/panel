import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, LoaderCircle, Mail, Server, Shield, User } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/users/view/$id')({
  component: AdminViewUserPage,
})

interface ViewUserData {
  dataUser: {
    id: number
    username: string | null
    email: string | null
    avatar: string | null
    isAdmin: boolean
    role: string | null
    description: string
    createdAt: string
    serverCount: number
    totpEnabled: boolean
    serverLimit: number | null
    maxMemory: number | null
    maxCpu: number | null
    maxStorage: number | null
  }
}

function AdminViewUserPage() {
  const { id } = Route.useParams()
  const page = useAdminPage<ViewUserData>('users-view', Number(id))

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading user...
      </div>
    )
  }

  const u = page.data.dataUser

  const rows = [
    { label: 'Username', value: u.username ?? '—', icon: User },
    { label: 'Email', value: u.email ?? '—', icon: Mail },
    { label: 'Servers', value: String(u.serverCount), icon: Server },
    { label: '2FA', value: u.totpEnabled ? 'Enabled' : 'Disabled', icon: Shield },
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/users" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">{u.username}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>
            Joined {new Date(u.createdAt).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {u.avatar ? (
            <img src={u.avatar} alt="" className="size-16 rounded-full border object-cover" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            {u.isAdmin ? <Badge variant="secondary">Admin</Badge> : null}
            {u.role ? <Badge variant="outline">{u.role}</Badge> : null}
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <li
                key={row.label}
                className="flex items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2.5"
              >
                <row.icon className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{row.label}</p>
                  <p className="truncate text-sm font-medium">{row.value}</p>
                </div>
              </li>
            ))}
          </ul>
          {u.description ? (
            <p className="rounded-xl bg-muted/40 px-3 py-2 text-sm">{u.description}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
