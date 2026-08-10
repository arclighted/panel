import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  Database,
  Download,
  LoaderCircle,
  Lock,
  LockOpen,
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
import {
  useBackupsTab,
  useBackupActions,
  createBackup,
  restoreBackup,
  toggleBackupLock,
  deleteBackup,
  formatBackupSize,
  type BackupRecord,
} from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/backups')({
  component: ServerBackupsPage,
})

function ServerBackupsPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const actions = useBackupActions(uuid)
  const { data, isLoading, error } = useBackupsTab(uuid)

  const [createOpen, setCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [creating, setCreating] = useState(false)
  const [confirmRestore, setConfirmRestore] = useState<BackupRecord | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<BackupRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [lockBusy, setLockBusy] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!csrf || !name.trim()) return
    setCreating(true)
    try {
      await createBackup(uuid, name.trim(), csrf)
      toast.success('Backup created.')
      setCreateOpen(false)
      setName('')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create backup.')
    } finally {
      setCreating(false)
    }
  }

  const handleRestore = async () => {
    if (!csrf || !confirmRestore) return
    setBusy(true)
    try {
      await restoreBackup(uuid, confirmRestore.UUID, csrf)
      toast.success('Backup restored.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to restore backup.')
    } finally {
      setBusy(false)
      setConfirmRestore(null)
    }
  }

  const handleDelete = async () => {
    if (!csrf || !confirmDelete) return
    setBusy(true)
    try {
      await deleteBackup(uuid, confirmDelete.UUID, csrf)
      toast.success('Backup deleted.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete backup.')
    } finally {
      setBusy(false)
      setConfirmDelete(null)
    }
  }

  const handleLock = async (backup: BackupRecord) => {
    if (!csrf) return
    setLockBusy(backup.UUID)
    try {
      await toggleBackupLock(uuid, backup.UUID, !backup.locked, csrf)
      toast.success(backup.locked ? 'Backup unlocked.' : 'Backup locked.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update backup lock.')
    } finally {
      setLockBusy(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading backups...
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load backups.'}
      </p>
    )
  }

  const { backups } = data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Server Backups</CardTitle>
            <CardDescription>Manage your server backups.</CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            Create Backup
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {backups.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <Database className="size-12 text-muted-foreground" />
            <h3 className="mt-2 text-sm font-medium">No backups</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Backups protect your server's world and files. Create one to get started.
            </p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              Create backup
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Name</th>
                  <th className="px-6 py-3 font-medium">Size</th>
                  <th className="px-6 py-3 font-medium">Created</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {backups.map((backup) => (
                  <tr key={backup.UUID} className="transition-colors hover:bg-muted/30">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="text-sm font-medium">
                        <span className="inline-block max-w-[16rem] truncate align-bottom" title={backup.name}>
                          {backup.name}
                        </span>
                        {backup.locked ? (
                          <Badge variant="secondary" className="ml-1.5 align-middle">
                            <Lock className="size-2.5" />
                            locked
                          </Badge>
                        ) : null}
                      </div>
                      {backup.checksum ? (
                        <div
                          className="mt-0.5 font-mono text-[10px] text-muted-foreground"
                          title={`sha256: ${backup.checksum}`}
                        >
                          sha256 {backup.checksum.slice(0, 12)}…
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                      {formatBackupSize(backup.size)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">
                      {new Date(backup.createdAt).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          render={
                            <a href={`/server/${encodeURIComponent(uuid)}/backups/${encodeURIComponent(backup.UUID)}/download`} />
                          }
                        >
                          <Download className="size-3" />
                          Download
                        </Button>
                        <Button variant="success" size="sm" onClick={() => setConfirmRestore(backup)}>
                          <RefreshCw className="size-3" />
                          Restore
                        </Button>
                        <Button
                          variant={backup.locked ? 'outline' : 'secondary'}
                          size="sm"
                          disabled={lockBusy === backup.UUID}
                          onClick={() => void handleLock(backup)}
                        >
                          {lockBusy === backup.UUID ? (
                            <LoaderCircle className="size-3 animate-spin" />
                          ) : backup.locked ? (
                            <LockOpen className="size-3" />
                          ) : (
                            <Lock className="size-3" />
                          )}
                          {backup.locked ? 'Unlock' : 'Lock'}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={backup.locked}
                          title={backup.locked ? 'Locked backups cannot be deleted until unlocked' : undefined}
                          onClick={() => setConfirmDelete(backup)}
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Create modal */}
      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Backup</DialogTitle>
            <DialogDescription>Choose a name for this backup.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="backupName">Enter backup name</Label>
            <input
              id="backupName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              placeholder="Enter backup name"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button disabled={creating || !name.trim()} onClick={() => void handleCreate()}>
              {creating ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restore confirm */}
      <Dialog open={confirmRestore !== null} onOpenChange={(v) => !v && setConfirmRestore(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restore Backup</DialogTitle>
            <DialogDescription>
              Are you sure you want to restore the backup "{confirmRestore?.name}"? This will replace
              all current server files and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void handleRestore()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={confirmDelete !== null} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Backup</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the backup "{confirmDelete?.name}"? This action cannot be undone.
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
    </Card>
  )
}
