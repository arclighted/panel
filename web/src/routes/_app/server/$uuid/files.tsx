import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Archive,
  Copy,
  Download,
  File,
  FileCode2,
  FilePlus,
  Folder,
  FolderPlus,
  Image,
  LoaderCircle,
  Move,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuthConfig } from '@/lib/auth-config'
import { hasServerPermission, useServerContext } from '@/lib/server'
import {
  archiveFiles,
  copyFile,
  createFile,
  createFolder,
  deleteFile,
  fetchFileContent,
  isImageFile,
  joinPath,
  renameFile,
  saveFile,
  unzipFile,
  uploadFile,
  useFiles,
  useFileActions,
  pullFile,
  type FileEntry,
} from '@/lib/files'
import { formatBytes } from '@/lib/server'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/server/$uuid/files')({
  validateSearch: (search: Record<string, unknown>): { path?: string } => ({
    path: typeof search.path === 'string' ? search.path : undefined,
  }),
  component: FilesPage,
})

const PAGE_SIZE = 50

function FilesPage() {
  const { uuid } = Route.useParams()
  const { path } = Route.useSearch()
  const navigate = Route.useNavigate()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const context = useServerContext(uuid)
  const filesQuery = useFiles(uuid, path ?? '/')
  const { invalidate } = useFileActions(uuid)

  const dir = path && path !== '/' ? path.replace(/^\/+|\/+$/g, '') : '/'
  const perms = context.data?.subUserPermissions ?? []
  const canWrite = !context.data?.isSubUser || hasServerPermission(perms, 'files.write')
  const canDelete = !context.data?.isSubUser || hasServerPermission(perms, 'files.delete')
  const canCreate = !context.data?.isSubUser || hasServerPermission(perms, 'files.create')
  const canArchive = !context.data?.isSubUser || hasServerPermission(perms, 'files.archive')
  const canPull = !context.data?.isSubUser || hasServerPermission(perms, 'files.pull')

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<FileEntry | null>(null)
  const [previewImage, setPreviewImage] = useState<FileEntry | null>(null)
  const [createOpen, setCreateOpen] = useState<'file' | 'folder' | null>(null)
  const [createName, setCreateName] = useState('')
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveDest, setMoveDest] = useState('')
  const [deleteTargets, setDeleteTargets] = useState<{ name: string; path: string }[] | null>(null)
  const [pullOpen, setPullOpen] = useState(false)
  const [pullUrl, setPullUrl] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [uploadPct, setUploadPct] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const files = useMemo(() => {
    const list = filesQuery.data ?? []
    if (!filter.trim()) return list
    const needle = filter.trim().toLowerCase()
    return list.filter((f) => f.name.toLowerCase().includes(needle))
  }, [filesQuery.data, filter])

  const pageCount = Math.max(1, Math.ceil(files.length / PAGE_SIZE))
  const visible = files.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Reset selection/pagination when the directory changes.
  useEffect(() => {
    setSelected(new Set())
    setPage(1)
    setFilter('')
  }, [dir])

  function goToDir(nextPath: string) {
    void navigate({ search: { path: nextPath } })
  }

  function refresh() {
    invalidate()
  }

  const fullPath = (name: string) => joinPath(dir, name)

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  async function handleCreate() {
    if (!createName.trim() || !canCreate) return
    const name = createName.trim()
    setCreateOpen(null)
    setCreateName('')
    await run('create', async () => {
      if (createOpen === 'folder') {
        await createFolder(uuid, dir, name, csrf)
      } else {
        await createFile(uuid, joinPath(dir, name), csrf)
      }
      toast.success(`${name} created.`)
      refresh()
    })
  }

  async function handleUpload(file: File) {
    if (!canWrite) return
    setUploadPct(0)
    try {
      await uploadFile(uuid, dir, file, csrf, setUploadPct)
      toast.success(`File ${file.name} uploaded.`)
      setUploadPct(null)
      refresh()
    } catch (e) {
      setUploadPct(null)
      toast.error(e instanceof Error ? e.message : 'Upload failed.')
    }
  }

  async function handleMove() {
    if (!moveDest.trim() || selected.size === 0) return
    const dest = moveDest.trim()
    setMoveOpen(false)
    setMoveDest('')
    await run('move', async () => {
      for (const name of selected) {
        await renameFile(uuid, fullPath(name), joinPath(dest, name), csrf)
      }
      toast.success('Moved.')
      setSelected(new Set())
      refresh()
    })
  }

  async function handleDelete() {
    if (!deleteTargets || deleteTargets.length === 0) return
    const targets = deleteTargets
    setDeleteTargets(null)
    await run('delete', async () => {
      for (const target of targets) {
        await deleteFile(uuid, target.path, csrf)
      }
      toast.success('Deleted.')
      setSelected(new Set())
      refresh()
    })
  }

  async function handleArchive() {
    const names = selected.size > 0 ? [...selected] : null
    if (!names || names.length === 0) return
    await run('archive', async () => {
      await archiveFiles(uuid, names.map((n) => fullPath(n)), 'archive', csrf)
      toast.success('Archive created.')
      refresh()
    })
  }

  async function handleUnzip(entry: FileEntry) {
    await run('unzip', async () => {
      await unzipFile(uuid, fullPath(entry.name), csrf)
      toast.success('Extracted.')
      refresh()
    })
  }

  async function handlePull() {
    if (!pullUrl.trim()) return
    const url = pullUrl.trim()
    setPullOpen(false)
    setPullUrl('')
    await run('pull', async () => {
      await pullFile(uuid, dir, url, csrf)
      toast.success('File pulled.')
      refresh()
    })
  }

  function onRowClick(entry: FileEntry) {
    if (entry.type === 'directory') {
      goToDir(fullPath(entry.name))
      return
    }
    if (isImageFile(entry.name)) {
      setPreviewImage(entry)
      return
    }
    setEditing(entry)
  }

  // Editor is a full-page replacement while active.
  if (editing) {
    return (
      <FileEditor
        uuid={uuid}
        path={fullPath(editing.name)}
        name={editing.name}
        csrf={csrf}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          refresh()
        }}
      />
    )
  }

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleAll = () => {
    setSelected((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((f) => f.name)),
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value)
            setPage(1)
          }}
          placeholder="Filter files…"
          aria-label="Filter files"
          className="h-8 w-48"
        />
        <span className="flex-1" />
        {canCreate ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setCreateOpen('file')}>
              <FilePlus className="size-3.5" />
              New file
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCreateOpen('folder')}>
              <FolderPlus className="size-3.5" />
              New folder
            </Button>
          </>
        ) : null}
        {canWrite ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-3.5" />
              Upload
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-label="Upload file"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) void handleUpload(file)
                e.target.value = ''
              }}
            />
          </>
        ) : null}
        {canPull ? (
          <Button size="sm" variant="secondary" onClick={() => setPullOpen(true)}>
            <Download className="size-3.5" />
            Pull from URL
          </Button>
        ) : null}
      </div>

      {uploadPct !== null ? (
        <div className="flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm">
          <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          <span>Uploading… {uploadPct}%</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${uploadPct}%` }}
            />
          </div>
        </div>
      ) : null}

      {/* Selection actions */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-2.5 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <span className="flex-1" />
          {canDelete ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={() =>
                setDeleteTargets([...selected].map((name) => ({ name, path: fullPath(name) })))
              }
            >
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          ) : null}
          {canWrite ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => setMoveOpen(true)}>
                <Move className="size-3.5" />
                Move
              </Button>
              {selected.size === 1 ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const name = [...selected][0]
                    void run('copy', async () => {
                      await copyFile(uuid, fullPath(name), csrf)
                      toast.success(`Duplicated ${name}.`)
                      refresh()
                    })
                  }}
                >
                  <Copy className="size-3.5" />
                  Duplicate
                </Button>
              ) : null}
            </>
          ) : null}
          {canArchive ? (
            <Button size="sm" variant="secondary" onClick={() => void handleArchive()}>
              <Archive className="size-3.5" />
              Archive
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Breadcrumb */}
      <Breadcrumbs uuid={uuid} dir={dir} />

      {/* Table */}
      <div className="overflow-hidden rounded-xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all files"
                  checked={visible.length > 0 && selected.size === visible.length}
                  onChange={toggleAll}
                  className="accent-primary"
                />
              </th>
              <th className="px-4 py-2.5 font-medium">Name</th>
              <th className="px-4 py-2.5 font-medium">Size</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Modified</th>
              <th className="w-24 px-4 py-2.5 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filesQuery.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  <LoaderCircle className="mx-auto size-5 animate-spin" />
                </td>
              </tr>
            ) : visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  {filter ? 'No files match your filter.' : 'This folder is empty.'}
                </td>
              </tr>
            ) : (
              visible.map((entry) => {
                const path = fullPath(entry.name)
                const isSelected = selected.has(entry.name)
                return (
                  <tr
                    key={entry.name}
                    className={cn(
                      'cursor-pointer border-b last:border-0 transition-colors',
                      isSelected ? 'bg-accent/50' : 'hover:bg-accent/40',
                    )}
                    onClick={() => onRowClick(entry)}
                  >
                    <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        aria-label={`Select ${entry.name}`}
                        checked={isSelected}
                        onChange={() => toggle(entry.name)}
                        className="accent-primary"
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5 font-medium">
                        <FileIcon entry={entry} />
                        <span className="truncate">{entry.name}</span>
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                      {entry.type === 'directory' ? '—' : formatBytes(entry.size)}
                    </td>
                    <td className="hidden whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground md:table-cell">
                      {entry.modifiedAt
                        ? new Date(entry.modifiedAt).toLocaleDateString()
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {entry.type === 'directory' ? null : (
                          <IconButton
                            label={`Download ${entry.name}`}
                            onClick={() => {
                              const a = document.createElement('a')
                              a.href = `/server/${uuid}/files/download/${encodeURIComponent(path)}`
                              a.rel = 'noopener'
                              a.download = entry.name
                              document.body.appendChild(a)
                              a.click()
                              a.remove()
                            }}
                          >
                            <Download className="size-3.5" />
                          </IconButton>
                        )}
                        {entry.name.endsWith('.zip') ? (
                          <IconButton label={`Extract ${entry.name}`} onClick={() => void handleUnzip(entry)}>
                            <Archive className="size-3.5" />
                          </IconButton>
                        ) : null}
                        {canDelete ? (
                          <IconButton
                            label={`Delete ${entry.name}`}
                            onClick={() => setDeleteTargets([{ name: entry.name, path }])}
                          >
                            <Trash2 className="size-3.5" />
                          </IconButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 ? (
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground">
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span>
            {page} / {pageCount}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      {/* Create dialog */}
      <Dialog open={createOpen !== null} onOpenChange={(v) => !v && setCreateOpen(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{createOpen === 'folder' ? 'New folder' : 'New file'}</DialogTitle>
            <DialogDescription>
              {createOpen === 'folder'
                ? 'Create a directory in the current folder.'
                : 'Create an empty file in the current folder.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="create-name" className="sr-only">
              Name
            </Label>
            <Input
              id="create-name"
              placeholder={createOpen === 'folder' ? 'folder-name' : 'file.txt'}
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleCreate()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={!createName.trim()}>
              <Plus className="size-4" />
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={moveOpen} onOpenChange={(v) => !v && setMoveOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move to folder</DialogTitle>
            <DialogDescription>
              Destination directory (e.g. <code className="rounded bg-muted px-1">/world</code>).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="move-dest" className="sr-only">
              Destination
            </Label>
            <Input
              id="move-dest"
              placeholder="/"
              value={moveDest}
              onChange={(e) => setMoveDest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleMove()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setMoveOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleMove()} disabled={!moveDest.trim()}>
              <Move className="size-4" />
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pull dialog */}
      <Dialog open={pullOpen} onOpenChange={(v) => !v && setPullOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pull from URL</DialogTitle>
            <DialogDescription>Download a file from a remote URL into this folder.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pull-url" className="sr-only">
              URL
            </Label>
            <Input
              id="pull-url"
              placeholder="https://example.com/file.jar"
              value={pullUrl}
              onChange={(e) => setPullUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handlePull()
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPullOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handlePull()} disabled={!pullUrl.trim()}>
              <Download className="size-4" />
              Pull
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={deleteTargets !== null} onOpenChange={(v) => !v && setDeleteTargets(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteTargets?.length === 1 ? 'file' : `${deleteTargets?.length ?? 0} files`}?</DialogTitle>
            <DialogDescription>
              {deleteTargets?.map((t) => t.name).join(', ')} — this cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleteTargets(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image preview */}
      <Dialog open={previewImage !== null} onOpenChange={(v) => !v && setPreviewImage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{previewImage?.name}</DialogTitle>
          </DialogHeader>
          {previewImage ? (
            <img
              src={`/server/${uuid}/files/download/${encodeURIComponent(fullPath(previewImage.name))}`}
              alt={previewImage.name}
              className="max-h-[60vh] w-full rounded-xl object-contain"
            />
          ) : null}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setPreviewImage(null)}>
              <X className="size-4" />
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Breadcrumbs({ uuid, dir }: { uuid: string; dir: string }) {
  const segments = dir === '/' ? [] : dir.split('/')
  const crumbs = [{ label: 'Files', path: '/' }]
  let acc = ''
  for (const segment of segments) {
    acc = acc ? `${acc}/${segment}` : segment
    crumbs.push({ label: segment, path: acc })
  }
  return (
    <nav aria-label="File breadcrumbs" className="flex flex-wrap items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <span key={crumb.path} className="flex items-center gap-1">
          {i > 0 ? <span className="text-muted-foreground/50">/</span> : null}
          <Link
            to="/server/$uuid/files"
            params={{ uuid }}
            search={{ path: crumb.path }}
            className={cn(
              'rounded px-1 py-0.5 transition-colors',
              i === crumbs.length - 1
                ? 'font-medium text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {crumb.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}

function FileIcon({ entry }: { entry: FileEntry }) {
  if (entry.type === 'directory') {
    return <Folder className="size-4 shrink-0 text-amber-500" />
  }
  if (isImageFile(entry.name)) {
    return <Image className="size-4 shrink-0 text-muted-foreground" />
  }
  if (['txt', 'yml', 'yaml', 'json', 'toml', 'properties', 'cfg', 'conf', 'sh', 'log'].includes(entry.name.split('.').pop() ?? '')) {
    return <FileCode2 className="size-4 shrink-0 text-sky-500" />
  }
  return <File className="size-4 shrink-0 text-muted-foreground" />
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  )
}

/* ── Inline editor ───────────────────────────────────────────────────────── */

function FileEditor({
  uuid,
  path,
  name,
  csrf,
  onClose,
  onSaved,
}: {
  uuid: string
  path: string
  name: string
  csrf: string | null
  onClose: () => void
  onSaved: () => void
}) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchFileContent(uuid, path)
      .then((data) => {
        if (cancelled) return
        if (data.tooLarge || data.invalidUtf8) {
          setError(
            data.tooLarge
              ? 'This file is too large (> 1 MiB) for the in-browser editor. Download or edit it locally instead.'
              : 'This file contains non-UTF-8 binary content and cannot be edited safely in the browser.',
          )
          return
        }
        setContent(data.content)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load file content.')
      })
    return () => {
      cancelled = true
    }
  }, [uuid, path])

  async function handleSave() {
    if (content == null || !csrf) return
    setSaving(true)
    try {
      await saveFile(uuid, path, content, csrf)
      toast.success('Saved.')
      setDirty(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save file.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={onClose}>
          <X className="size-3.5" />
          Back
        </Button>
        <span className="truncate font-mono text-sm">{path}</span>
        <span className="flex-1" />
        <Button size="sm" onClick={() => void handleSave()} disabled={!dirty || saving || content == null}>
          {saving ? <LoaderCircle className="size-3.5 animate-spin" /> : <Pencil className="size-3.5" />}
          Save
        </Button>
      </div>
      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
          {error}
        </div>
      ) : content === null ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border bg-card p-10 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            setDirty(true)
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
              e.preventDefault()
              void handleSave()
            }
          }}
          aria-label={`Edit ${name}`}
          spellCheck={false}
          className="h-[60vh] w-full resize-none rounded-xl border bg-card p-4 font-mono text-xs leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
      )}
    </div>
  )
}
