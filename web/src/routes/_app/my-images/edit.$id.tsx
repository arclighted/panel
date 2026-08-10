import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { ArrowLeft, LoaderCircle, Save } from 'lucide-react'

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
import { fetchImage, updateImage, type ImageDetail } from '@/lib/images-user'

export const Route = createFileRoute('/_app/my-images/edit/$id')({
  component: MyImagesEditPage,
})

function MyImagesEditPage() {
  const { id } = Route.useParams()
  const imageId = Number(id)
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null

  const [image, setImage] = useState<ImageDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [name, setName] = useState('')
  const [startup, setStartup] = useState('')
  const [description, setDescription] = useState('')
  const [author, setAuthor] = useState('')
  const [authorName, setAuthorName] = useState('')
  const [stop, setStop] = useState('')
  const [dockerImages, setDockerImages] = useState('')
  const [variables, setVariables] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchImage(imageId)
      .then((img) => {
        if (cancelled) return
        setImage(img)
        setName(img.name)
        setStartup(img.startup)
        setDescription(img.description ?? '')
        setAuthor(img.author ?? '')
        setAuthorName(img.authorName ?? '')
        setStop(img.stop ?? '')
        setDockerImages(JSON.stringify(img.dockerImages, null, 2))
        setVariables(JSON.stringify(img.variables, null, 2))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load image.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [imageId])

  async function save(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await updateImage(
        imageId,
        'published',
        {
          name,
          startup,
          description,
          author,
          authorName,
          stop,
          docker_images: dockerImages,
          variables,
        },
        csrf,
      )
      toast.success('Image updated. Changes are pending admin review.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update image.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading image...
      </div>
    )
  }

  if (error || !image) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error ?? 'Image not found.'}</p>
        <Button variant="secondary" render={<Link to="/my-images" />}>
          <ArrowLeft className="size-4" />
          Back to my images
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link to="/my-images" />}>
            <ArrowLeft className="size-4" />
            Back
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Edit {image.name}</h1>
        </div>
        <Button disabled={saving} onClick={() => void save()}>
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save changes
        </Button>
      </div>

      {image.status === 'rejected' && image.rejectionReason ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          Rejection reason: {image.rejectionReason}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Image configuration</CardTitle>
          <CardDescription>Edit and resubmit for admin review</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Name *</Label>
              <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-author">Author</Label>
              <Input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-startup">Startup command *</Label>
            <Input id="edit-startup" value={startup} onChange={(e) => setStartup(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-author-name">Author name</Label>
              <Input id="edit-author-name" value={authorName} onChange={(e) => setAuthorName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-stop">Stop command</Label>
              <Input id="edit-stop" value={stop} onChange={(e) => setStop(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-desc">Description</Label>
            <Input id="edit-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-docker">Docker images (JSON)</Label>
            <textarea
              id="edit-docker"
              className="min-h-24 w-full rounded-lg border bg-background p-3 font-mono text-xs focus:outline-none"
              value={dockerImages}
              onChange={(e) => setDockerImages(e.target.value)}
              spellCheck={false}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-vars">Variables (JSON)</Label>
            <textarea
              id="edit-vars"
              className="min-h-32 w-full rounded-lg border bg-background p-3 font-mono text-xs focus:outline-none"
              value={variables}
              onChange={(e) => setVariables(e.target.value)}
              spellCheck={false}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
