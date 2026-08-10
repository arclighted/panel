import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Calendar,
  Copy,
  Database,
  Eye,
  EyeOff,
  LoaderCircle,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthConfig } from '@/lib/auth-config'
import { hasServerPermission } from '@/lib/server'
import {
  useDatabasesTab,
  useDatabaseActions,
  createDatabase,
  deleteDatabase,
  rotateDatabasePassword,
  type DatabaseRecord,
} from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/databases')({
  component: ServerDatabasesPage,
})

function ServerDatabasesPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const actions = useDatabaseActions(uuid)
  const { data, isLoading, error } = useDatabasesTab(uuid)

  const [createOpen, setCreateOpen] = useState(false)
  const [hostId, setHostId] = useState<string>('')
  const [creating, setCreating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<DatabaseRecord | null>(null)
  const [confirmRotate, setConfirmRotate] = useState<DatabaseRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [revealed, setRevealed] = useState<Record<number, boolean>>({})

  const hasPerm = (p: string) =>
    !data?.isSubUser || hasServerPermission(data?.subUserPermissions ?? [], p)

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`Copied ${label} to clipboard.`)
    } catch {
      toast.error('Could not copy.')
    }
  }

  const handleCreate = async () => {
    if (!csrf || !hostId) return
    setCreating(true)
    try {
      await createDatabase(uuid, Number(hostId), csrf)
      toast.success('Database created.')
      setCreateOpen(false)
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create database.')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!csrf || !confirmDelete) return
    setBusy(true)
    try {
      await deleteDatabase(uuid, confirmDelete.id, csrf)
      toast.success('Database deleted.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete database.')
    } finally {
      setBusy(false)
      setConfirmDelete(null)
    }
  }

  const handleRotate = async () => {
    if (!csrf || !confirmRotate) return
    setBusy(true)
    try {
      await rotateDatabasePassword(uuid, confirmRotate.id, csrf)
      toast.success('Password rotated.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to rotate password.')
    } finally {
      setBusy(false)
      setConfirmRotate(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading databases...
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load databases.'}
      </p>
    )
  }

  const { databases, hosts } = data
  const limitLabel = data.userDbLimit > 0 ? String(data.userDbLimit) : '∞'

  if (hosts.length === 0) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
        <Database className="mt-0.5 size-4 shrink-0" />
        <div>
          <p className="font-medium">No database hosts configured</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            An administrator must add a database host before you can create databases.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {databases.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-10 text-center">
            <div className="flex size-16 items-center justify-center rounded-full bg-muted">
              <Database className="size-6 text-muted-foreground" />
            </div>
            <h2 className="mt-4 text-sm font-semibold">No databases yet</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Create a database to use with your server.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create Database
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>Databases</CardTitle>
                <CardDescription>
                  {data.userDbCount}/{limitLabel} databases
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" />
                New Database
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="w-48 px-6 py-3 font-medium">Name</th>
                    <th className="w-44 px-6 py-3 font-medium">Host</th>
                    <th className="px-6 py-3 font-medium">Connection string</th>
                    <th className="w-40 px-6 py-3 font-medium">Username</th>
                    <th className="w-44 px-6 py-3 font-medium">Password</th>
                    <th className="w-36 px-6 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {databases.map((db) => {
                    const dsn = `mysql://${db.databaseUser}:${db.databasePassword}@${db.host.host}:${db.host.port}/${db.databaseName}`
                    const show = revealed[db.id]
                    return (
                      <tr key={db.id} className="transition-colors hover:bg-muted/30">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span
                              className="max-w-[10rem] truncate font-mono text-sm font-medium"
                              title={db.databaseName}
                            >
                              {db.databaseName}
                            </span>
                            <Badge variant="secondary">MySQL</Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Calendar className="size-3" />
                            Created: {new Date(db.createdAt).toLocaleString()}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium">{db.host.name}</div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {db.host.host}:{db.host.port}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{dsn}</span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void copy(dsn, 'connection string')}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-xs">{db.databaseUser}</span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void copy(db.databaseUser, 'username')}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 px-2.5 py-1.5">
                            <span className="min-w-0 flex-1 truncate font-mono text-xs">
                              {show ? db.databasePassword : '••••••••••••••••'}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setRevealed({ ...revealed, [db.id]: !show })}
                            >
                              {show ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => void copy(db.databasePassword, 'password')}
                            >
                              <Copy className="size-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                            {hasPerm('database.update') ? (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setConfirmRotate(db)}
                              >
                                <RefreshCw className="size-3" />
                                Rotate
                              </Button>
                            ) : null}
                            {hasPerm('database.delete') ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => setConfirmDelete(db)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Database</DialogTitle>
            <DialogDescription>
              A database, user and password will be provisioned on this host.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dbHostSelect">Database host</Label>
            <select
              id="dbHostSelect"
              value={hostId}
              onChange={(e) => setHostId(e.target.value)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="" disabled>Select a host</option>
              {hosts.map((host) => (
                <option key={host.id} value={host.id}>
                  {host.name} ({host.host}:{host.port})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button disabled={creating || !hostId} onClick={() => void handleCreate()}>
              {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create database
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rotate confirm */}
      <Dialog open={confirmRotate !== null} onOpenChange={(v) => !v && setConfirmRotate(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Rotate password</DialogTitle>
            <DialogDescription>
              Generate a new password for this database user? Existing connections will be dropped.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmRotate(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void handleRotate()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Rotate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete database</DialogTitle>
            <DialogDescription>
              This will permanently delete the database and its user from the host. This cannot be
              undone. {confirmDelete ? `(${confirmDelete.databaseName})` : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void handleDelete()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
