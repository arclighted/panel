import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AlertTriangle, LoaderCircle, RefreshCw, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthConfig } from '@/lib/auth-config'
import { deleteFile } from '@/lib/files'
import { useWorlds, worldIcon } from '@/lib/server-pages'

export const Route = createFileRoute('/_app/server/$uuid/worlds')({
  component: ServerWorldsPage,
})

function ServerWorldsPage() {
  const { uuid } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const queryClient = useQueryClient()
  const worlds = useWorlds(uuid)

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const data = worlds.data
  const list = data?.worlds ?? []
  const daemonOffline = data?.serverStatus?.daemonOffline === true || !!data?.daemonError

  async function confirmDelete(): Promise<void> {
    if (!deleteTarget || !csrf) return
    setDeleting(true)
    try {
      await deleteFile(uuid, deleteTarget, csrf)
      toast.success(`World "${deleteTarget}" deleted.`)
      setDeleteTarget(null)
      void queryClient.invalidateQueries({ queryKey: ['server-worlds', uuid] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete world.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Worlds</CardTitle>
              <CardDescription>Save folders detected on this server</CardDescription>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void worlds.refetch()}
              disabled={worlds.isFetching}
            >
              {worlds.isFetching ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {daemonOffline ? (
            <div className="flex items-center gap-3 border-t px-4 py-6 text-destructive">
              <AlertTriangle className="size-5 shrink-0" />
              <p className="text-sm">
                Failed to fetch worlds. The server may be offline or not responding.
              </p>
            </div>
          ) : worlds.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading worlds...
            </div>
          ) : list.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No worlds found yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {list.map((world) => (
                <li
                  key={world.name}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                >
                  <img
                    src={worldIcon(world.name)}
                    alt=""
                    loading="lazy"
                    className="size-10 shrink-0 rounded-full border"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{world.name}</p>
                    <p className="text-xs text-muted-foreground">Minecraft World</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteTarget(world.name)}
                  >
                    <Trash2 className="size-3" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove world?</DialogTitle>
            <DialogDescription>
              This permanently deletes the world folder "{deleteTarget}" and cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleting}
              onClick={() => void confirmDelete()}
            >
              {deleting ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Trash2 className="size-4" />
              )}
              Delete World
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
