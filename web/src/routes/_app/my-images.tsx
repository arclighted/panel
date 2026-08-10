import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Image as ImageIcon, LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { useAccountContext } from '@/lib/account'
import { deleteImage } from '@/lib/images-user'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/my-images')({
  component: MyImagesPage,
})

function MyImagesPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const context = useAccountContext()

  const images = context.data?.images ?? []
  const allowed = context.data?.allowed ?? false
  const [busy, setBusy] = useState<number | null>(null)

  async function removeImage(id: number, name: string): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return
    setBusy(id)
    try {
      await deleteImage(id, csrf)
      toast.success('Image deleted.')
      void queryClient.invalidateQueries({ queryKey: ['account-context'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete image.')
    } finally {
      setBusy(null)
    }
  }

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; cls: string }> = {
      approved: { label: 'Approved', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
      pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
      rejected: { label: 'Rejected', cls: 'bg-destructive/10 text-destructive' },
    }
    const s = map[status] ?? { label: status, cls: 'bg-muted text-muted-foreground' }
    return (
      <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', s.cls)}>{s.label}</span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Images</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Custom images you've submitted for the server-creation list.
          </p>
        </div>
        {allowed ? (
          <Button
            variant="secondary"
            render={<Link to="/account" search={{ tab: 'images' }} />}
          >
            <Plus className="size-4" />
            Submit new image
          </Button>
        ) : null}
      </div>

      {!allowed ? (
        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          Image submissions are not enabled on this panel.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="size-4" />
            Submissions
          </CardTitle>
          <CardDescription>Reviewed by an administrator before approval</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {context.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading images...
            </div>
          ) : images.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              You haven't submitted any images yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {images.map((img) => (
                <li key={img.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{img.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Submitted {new Date(img.createdAt).toLocaleDateString()}
                    </p>
                    {img.status === 'rejected' && img.rejectionReason ? (
                      <p className="mt-0.5 text-xs text-destructive">{img.rejectionReason}</p>
                    ) : null}
                  </div>
                  {statusBadge(img.status)}
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      render={<Link to="/my-images/edit/$id" params={{ id: String(img.id) }} />}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={busy === img.id}
                      onClick={() => void removeImage(img.id, img.name)}
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
