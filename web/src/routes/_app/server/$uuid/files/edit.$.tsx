import { useEffect, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { AlertTriangle, ArrowLeft, FileText, LoaderCircle, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { fetchFileContent, saveFile } from '@/lib/files'

export const Route = createFileRoute('/_app/server/$uuid/files/edit/$')({
  component: ServerFileEditorPage,
})

function ServerFileEditorPage() {
  const { uuid, _splat } = Route.useParams()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const filePath = _splat ?? ''

  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [name, setName] = useState(filePath.split('/').pop() || filePath)
  const [extension, setExtension] = useState('')
  const [tooLarge, setTooLarge] = useState(false)
  const [invalidUtf8, setInvalidUtf8] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    fetchFileContent(uuid, filePath)
      .then((file) => {
        if (cancelled) return
        setName(file.name)
        setExtension(file.extension)
        setTooLarge(file.tooLarge)
        setInvalidUtf8(file.invalidUtf8)
        setContent(file.content)
        setDirty(false)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setLoadError(e instanceof Error ? e.message : 'Failed to load file content.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [uuid, filePath])

  const parentDir = filePath.includes('/')
    ? filePath.slice(0, filePath.lastIndexOf('/'))
    : '/'

  async function handleSave(): Promise<void> {
    if (!csrf) return
    setSaving(true)
    try {
      await saveFile(uuid, filePath, content, csrf)
      setDirty(false)
      toast.success('File saved.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save file.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="sm" render={<Link to="/server/$uuid/files" params={{ uuid }} search={{ path: parentDir }} />}>
            <ArrowLeft className="size-4" />
            Back to files
          </Button>
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 truncate font-medium">
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{name}</span>
              {extension ? (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {extension}
                </span>
              ) : null}
            </h2>
          </div>
        </div>
        <Button
          size="sm"
          disabled={saving || !dirty || tooLarge || invalidUtf8 || !!loadError}
          onClick={() => void handleSave()}
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Save
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Editing {filePath}</CardTitle>
          <CardDescription>
            Plain-text editor. Binary files and files over 1 MiB are read-only here.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loadError ? (
            <div className="flex items-start gap-3 border-t px-4 py-6 text-destructive">
              <AlertTriangle className="size-5 shrink-0" />
              <p className="text-sm">{loadError}</p>
            </div>
          ) : tooLarge || invalidUtf8 ? (
            <div className="flex items-start gap-3 border-t px-4 py-6 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-5 shrink-0" />
              <p className="text-sm">
                {tooLarge
                  ? 'This file is too large (> 1 MiB) for the in-browser editor. Download it and edit locally instead.'
                  : 'This file does not appear to be valid UTF-8 text, so it cannot be edited here.'}
              </p>
            </div>
          ) : (
            <textarea
              className="h-[70vh] w-full resize-none border-t bg-muted/40 p-3 font-mono text-xs leading-relaxed focus:outline-none"
              spellCheck={false}
              value={loading ? '' : content}
              disabled={loading}
              placeholder="Loading file content…"
              onChange={(e) => {
                setContent(e.target.value)
                setDirty(true)
              }}
              aria-label="File content"
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
