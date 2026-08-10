import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  CheckCheck,
  LoaderCircle,
  Pencil,
  Plus,
  Settings,
  Trash2,
  UserPlus,
  Users,
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
import { Input } from '@/components/ui/input'
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
  useSubusersTab,
  useSubUserActions,
  addSubUser,
  updateSubUserPermissions,
  removeSubUser,
  type SubUserRecord,
} from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/subusers')({
  component: ServerSubUsersPage,
})

function ServerSubUsersPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const actions = useSubUserActions(uuid)
  const { data, isLoading, error } = useSubusersTab(uuid)

  const [addOpen, setAddOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [addPerms, setAddPerms] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const [editTarget, setEditTarget] = useState<SubUserRecord | null>(null)
  const [editPerms, setEditPerms] = useState<Set<string>>(new Set())
  const [confirmRemove, setConfirmRemove] = useState<SubUserRecord | null>(null)

  const labels = data?.permissionLabels ?? {}
  const groups = data?.permissionGroups ?? []

  const openAdd = () => {
    setEmail('')
    // Default: base (non-scoped) permissions checked, mirroring the EJS.
    const defaults = new Set(
      groups.flatMap((g) => g.perms).filter((p) => p.indexOf('.') === -1),
    )
    setAddPerms(defaults)
    setAddOpen(true)
  }

  const openEdit = (sub: SubUserRecord) => {
    setEditTarget(sub)
    setEditPerms(new Set(sub.permissions))
  }

  const handleAdd = async () => {
    if (!csrf || !email.trim()) return
    setBusy(true)
    try {
      await addSubUser(uuid, email.trim(), [...addPerms], csrf)
      toast.success('Subuser added.')
      setAddOpen(false)
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add subuser.')
    } finally {
      setBusy(false)
    }
  }

  const handleEdit = async () => {
    if (!csrf || !editTarget) return
    setBusy(true)
    try {
      await updateSubUserPermissions(uuid, editTarget.id, [...editPerms], csrf)
      toast.success('Permissions updated.')
      setEditTarget(null)
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update permissions.')
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (!csrf || !confirmRemove) return
    setBusy(true)
    try {
      await removeSubUser(uuid, confirmRemove.id, csrf)
      toast.success('Subuser removed.')
      actions.invalidate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove subuser.')
    } finally {
      setBusy(false)
      setConfirmRemove(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading subusers...
      </div>
    )
  }

  if (error || !data) {
    return (
      <p className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load subusers.'}
      </p>
    )
  }

  const { subUsers } = data

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>Server Subusers</CardTitle>
            <CardDescription>Grant other users access to this server.</CardDescription>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus className="size-4" />
            Add Subuser
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {subUsers.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-10 text-center">
            <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-muted">
              <Users className="size-6 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-medium">No subusers</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Invite other users to help manage this server.
            </p>
            <Button className="mt-5" onClick={openAdd}>
              <UserPlus className="size-4" />
              Add subuser
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm">
              <thead className="border-y bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">User</th>
                  <th className="px-6 py-3 font-medium">Permissions</th>
                  <th className="px-6 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subUsers.map((sub) => {
                  const subName = sub.user.username || sub.user.email || 'Unknown'
                  const shown = sub.permissions.slice(0, 4)
                  const hidden = sub.permissions.length - shown.length
                  return (
                    <tr key={sub.id} className="transition-colors hover:bg-muted/30">
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11px] font-semibold text-accent">
                            {subName.slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{subName}</div>
                            <div className="max-w-[200px] truncate text-xs text-muted-foreground">
                              {sub.user.email}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-xs flex-wrap gap-1.5">
                          {shown.map((perm) =>
                            labels[perm] ? (
                              <Badge key={perm} variant="secondary">
                                {labels[perm]}
                              </Badge>
                            ) : null,
                          )}
                          {hidden > 0 ? (
                            <Badge
                              variant="outline"
                              title={sub.permissions.map((p) => labels[p] || p).join(', ')}
                            >
                              +{hidden} more
                            </Badge>
                          ) : null}
                          {sub.permissions.length === 0 ? (
                            <span className="text-xs italic text-muted-foreground">No permissions</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="secondary" size="sm" onClick={() => openEdit(sub)}>
                            <Settings className="size-3" />
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setConfirmRemove(sub)}
                          >
                            <Trash2 className="size-3" />
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Add modal */}
      <Dialog open={addOpen} onOpenChange={(v) => !v && setAddOpen(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add subuser</DialogTitle>
            <DialogDescription>Grant another user access to this server.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="addSubUserEmail">User email</Label>
              <Input
                id="addSubUserEmail"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAdd()
                }}
                placeholder="friend@example.com"
                autoComplete="off"
              />
            </div>
            <PermissionPicker
              groups={groups}
              labels={labels}
              perms={addPerms}
              onChange={setAddPerms}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button disabled={busy || !email.trim()} onClick={() => void handleAdd()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add subuser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={editTarget !== null} onOpenChange={(v) => !v && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit permissions</DialogTitle>
            <DialogDescription>
              {editTarget ? editTarget.user.username || editTarget.user.email : ''}
            </DialogDescription>
          </DialogHeader>
          <PermissionPicker
            groups={groups}
            labels={labels}
            perms={editPerms}
            onChange={setEditPerms}
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>
              <X className="size-4" />
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void handleEdit()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Pencil className="size-4" />}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirm */}
      <Dialog open={confirmRemove !== null} onOpenChange={(v) => !v && setConfirmRemove(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove subuser</DialogTitle>
            <DialogDescription>
              Remove{' '}
              {confirmRemove
                ? confirmRemove.user.username || confirmRemove.user.email || 'this user'
                : ''}{' '}
              from this server? They will lose access immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmRemove(null)}>Cancel</Button>
            <Button variant="destructive" disabled={busy} onClick={() => void handleRemove()}>
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PermissionPicker({
  groups,
  labels,
  perms,
  onChange,
}: {
  groups: { title: string; perms: string[] }[]
  labels: Record<string, string>
  perms: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const toggle = (perm: string) => {
    const next = new Set(perms)
    if (next.has(perm)) {
      next.delete(perm)
    } else {
      next.add(perm)
    }
    onChange(next)
  }

  const all = new Set(groups.flatMap((g) => g.perms))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Label>Permissions</Label>
        <div className="flex items-center gap-3 text-[11px] font-medium">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-accent"
            onClick={() => onChange(all)}
          >
            <CheckCheck className="size-3" />
            Select all
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-muted-foreground"
            onClick={() => onChange(new Set())}
          >
            <X className="size-3" />
            Clear
          </button>
        </div>
      </div>
      <div className="max-h-[44vh] space-y-3 overflow-y-auto pr-1">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-1.5">
              {group.perms.map((perm) => (
                <label
                  key={perm}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors ${
                    perms.has(perm)
                      ? 'border-accent bg-accent/10'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary"
                    checked={perms.has(perm)}
                    onChange={() => toggle(perm)}
                  />
                  <span className="shrink-0 font-medium">{labels[perm] || perm}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
