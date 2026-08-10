import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Database, LoaderCircle, Plus, Trash2, Zap } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { deleteDatabaseHost, testDatabaseHost, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/databases')({
  component: AdminDatabasesPage,
})

interface DatabaseHostRow {
  id: number
  name: string
  host: string
  port: number
  username: string
  node: { id: number; name: string } | null
  _count: { databases: number }
}

interface DatabasesData {
  hosts: DatabaseHostRow[]
}

function AdminDatabasesPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<DatabasesData>('databases')
  const [busy, setBusy] = useState<number | null>(null)

  const hosts = page.data?.hosts ?? []

  async function test(host: DatabaseHostRow): Promise<void> {
    if (!csrf) return
    setBusy(host.id)
    try {
      await testDatabaseHost(host.id, csrf)
      toast.success(`${host.name}: connection OK.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Connection test failed.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(host: DatabaseHostRow): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete database host "${host.name}"?`)) return
    setBusy(host.id)
    try {
      await deleteDatabaseHost(host.id, csrf)
      toast.success('Database host deleted.')
      void queryClient.invalidateQueries({ queryKey: ['admin-page', 'databases'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete database host.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Databases</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Database hosts available to servers
          </p>
        </div>
        <Button variant="secondary" render={<a href="/admin/databases/create" />}>
          <Plus className="size-4" />
          New host
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="size-4" />
            Hosts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading hosts...
            </div>
          ) : hosts.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No database hosts configured.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {hosts.map((host) => (
                <li key={host.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{host.name}</p>
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {host.username}@{host.host}:{host.port}
                      {host.node ? ` · node: ${host.node.name}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {host._count.databases} databases
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={busy === host.id}
                    onClick={() => void test(host)}
                  >
                    <Zap className="size-3" />
                    Test
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={busy === host.id}
                    onClick={() => void remove(host)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
