import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, Check, LoaderCircle, Save, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { approveImage, rejectImage, updateAdminImage, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/images/edit/$id')({
  component: AdminEditImagePage,
})

interface EditImageData {
  image: Record<string, unknown>
  imageJson: string
}

function AdminEditImagePage() {
  const { id } = Route.useParams()
  const imageId = Number(id)
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const navigate = useNavigate()
  const page = useAdminPage<EditImageData>('images-edit', imageId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [startup, setStartup] = useState('')
  const [json, setJson] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    if (!page.data) return
    const img = page.data.image
    setName(String(img.name ?? ''))
    setDescription(String(img.description ?? ''))
    setAuthor(String(img.author ?? ''))
    setStartup(String(img.startup ?? ''))
    setJson(page.data.imageJson)
  }, [page.data])

  async function save(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await updateAdminImage(
        imageId,
        { name, description, author, startup, json },
        csrf,
      )
      toast.success('Image updated.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update image.')
    } finally {
      setSaving(false)
    }
  }

  async function act(kind: 'approve' | 'reject'): Promise<void> {
    if (!csrf) return
    setBusy(kind)
    try {
      if (kind === 'approve') await approveImage(imageId, csrf)
      else await rejectImage(imageId, { reason: 'Rejected by admin.' }, csrf)
      toast.success(kind === 'approve' ? 'Image approved.' : 'Image rejected.')
      void navigate({ to: '/admin/images' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed.')
    } finally {
      setBusy(null)
    }
  }

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading image...
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<a href="/admin/images" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">{name}</h1>
        </div>
        <div className="flex gap-2">
          <Button
            variant="success"
            size="sm"
            disabled={busy === 'approve'}
            onClick={() => void act('approve')}
          >
            <Check className="size-3" />
            Approve
          </Button>
          <Button
            variant="destructive"
            size="sm"
            disabled={busy === 'reject'}
            onClick={() => void act('reject')}
          >
            <X className="size-3" />
            Reject
          </Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Name</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Author</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Startup command</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 font-mono text-xs focus:outline-none"
              value={startup}
              onChange={(e) => setStartup(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-sm font-medium">Description</label>
            <input
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raw configuration</CardTitle>
          <CardDescription>
            Full egg JSON — edit with care.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <textarea
            className="h-96 w-full resize-none border-t bg-muted/40 p-3 font-mono text-xs leading-relaxed focus:outline-none"
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
          />
        </CardContent>
      </Card>
    </div>
  )
}
