import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Box, Check, Download, LoaderCircle, Pencil, RefreshCw, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
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
  adminPost,
  approveImage,
  rejectImage,
  useAdminPage,
} from '@/lib/admin'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/admin/images')({
  component: AdminImagesPage,
})

interface ImageRow {
  id: number
  name: string
  status: string
  createdAt: string
  rejectionReason: string | null
  author: string | null
}

interface PendingImage {
  id: number
  name: string
  createdAt: string
  creator: { id: number; username: string | null; email: string | null } | null
}

interface ImagesData {
  images: ImageRow[]
  pending: PendingImage[]
}

interface StoreImage {
  name: string
  description?: string
  author?: string
  group?: string
  [key: string]: unknown
}

interface ImagesStoreData {
  catalogue: { images: StoreImage[]; builtAt: number }
}

function AdminImagesPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<ImagesData>('images')
  const storePage = useAdminPage<ImagesStoreData>('images-store')
  const [rejectTarget, setRejectTarget] = useState<PendingImage | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  const images = page.data?.images ?? []
  const pending = page.data?.pending ?? []
  const storeImages = storePage.data?.catalogue.images ?? []

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin-page', 'images'] })
    void storePage.refetch()
  }

  async function doApprove(id: number): Promise<void> {
    if (!csrf) return
    setBusy(id)
    try {
      await approveImage(id, csrf)
      toast.success('Image approved.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve image.')
    } finally {
      setBusy(null)
    }
  }

  async function doReject(): Promise<void> {
    if (!csrf || !rejectTarget) return
    setBusy(rejectTarget.id)
    try {
      await rejectImage(rejectTarget.id, { reason: rejectReason || 'Not approved' }, csrf)
      toast.success('Image rejected.')
      setRejectTarget(null)
      setRejectReason('')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject image.')
    } finally {
      setBusy(null)
    }
  }

  async function installStoreImage(image: StoreImage): Promise<void> {
    if (!csrf) return
    setBusy(-1)
    try {
      await adminPost('/admin/images/store/install', image, csrf)
      toast.success(`Installed "${image.name}".`)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to install image.')
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
    return <Badge className={cn('font-medium', s.cls)} variant="outline">{s.label}</Badge>
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Images</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {pending.length} pending {pending.length === 1 ? 'submission' : 'submissions'}
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh}>
          <RefreshCw className="size-4" />
          Refresh
        </Button>
      </div>

      {/* Pending approvals */}
      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Pending approval</CardTitle>
            <CardDescription>User-submitted images waiting for review</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {pending.map((img) => (
                <li key={img.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{img.name}</p>
                    <p className="text-xs text-muted-foreground">
                      by {img.creator?.username ?? img.creator?.email ?? 'unknown'} ·{' '}
                      {new Date(img.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={busy === img.id}
                    onClick={() => void doApprove(img.id)}
                  >
                    <Check className="size-3" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setRejectTarget(img)}
                  >
                    <X className="size-3" />
                    Reject
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Egg store */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="size-4" />
            Egg store
          </CardTitle>
          <CardDescription>Install community images straight into the panel</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {storePage.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading catalogue...
            </div>
          ) : storeImages.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No store images available right now.
            </p>
          ) : (
            <div className="grid gap-3 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
              {storeImages.map((img) => (
                <div key={String(img.name)} className="rounded-xl border bg-muted/30 p-3">
                  <p className="truncate text-sm font-medium">{String(img.name)}</p>
                  {img.group ? (
                    <p className="text-xs text-muted-foreground">{String(img.group)}</p>
                  ) : null}
                  {img.description ? (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {String(img.description)}
                    </p>
                  ) : null}
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-2"
                    disabled={busy === -1}
                    onClick={() => void installStoreImage(img)}
                  >
                    <Download className="size-3" />
                    Install
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* All images */}
      <Card>
        <CardHeader>
          <CardTitle>All images</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading images...
            </div>
          ) : images.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No images yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {images.map((img) => (
                <li key={img.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <Box className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{img.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {img.author ?? 'Arclight'} · {new Date(img.createdAt).toLocaleDateString()}
                    </p>
                    {img.status === 'rejected' && img.rejectionReason ? (
                      <p className="mt-0.5 text-xs text-destructive">{img.rejectionReason}</p>
                    ) : null}
                  </div>
                  {statusBadge(img.status)}
                  <Button
                    variant="secondary"
                    size="sm"
                    render={<a href={`/admin/images/edit/${img.id}`} />}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    render={
                      <a
                        href={`/admin/images/export/${img.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <Download className="size-3" />
                    Export
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Reject dialog */}
      {rejectTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Reject "{rejectTarget.name}"?</CardTitle>
              <CardDescription>The submitter will see the reason.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="rej-reason">Reason</Label>
                <Input
                  id="rej-reason"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Why was this rejected?"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setRejectTarget(null)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={() => void doReject()}>
                  <X className="size-4" />
                  Reject image
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
