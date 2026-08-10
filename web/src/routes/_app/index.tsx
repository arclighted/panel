import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Folder,
  FolderPlus,
  Grid2X2,
  List as ListIcon,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Server as ServerIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StatusBadge } from '@/components/shell/status-badge'
import { useAuthConfig } from '@/lib/auth-config'
import {
  formatStorage,
  serverInFolder,
  serverStatus,
  useDashboard,
  type DashboardFolder,
  type DashboardServer,
} from '@/lib/dashboard'
import {
  addServerToFolder,
  createFolder,
  deleteFolder,
  removeServerFromFolder,
} from '@/lib/folders'
import { completeOnboarding, skipOnboarding } from '@/lib/onboarding'
import { queryClient } from '@/lib/query-client'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/_app/')({
  // Optional keys so navigating to "/" never requires search params.
  validateSearch: (
    search: Record<string, unknown>,
  ): { err?: string; page?: number } => ({
    err: typeof search.err === 'string' ? search.err : undefined,
    page:
      typeof search.page === 'string' && !Number.isNaN(Number(search.page))
        ? Math.max(1, Number(search.page))
        : undefined,
  }),
  component: DashboardPage,
})

type View = 'grid' | 'list'

function DashboardPage() {
  const { err, page } = Route.useSearch()
  const navigate = Route.useNavigate()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const dashboard = useDashboard(page ?? 1, true)

  const [view, setView] = useState<View>('grid')
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [folderDialog, setFolderDialog] = useState<DashboardFolder | null>(null)
  const [folderPickerFor, setFolderPickerFor] = useState<string | null>(null)
  const [onboardingDismissed, setOnboardingDismissed] = useState(false)

  const data = dashboard.data
  const isAdmin = auth.data?.user?.isAdmin ?? false
  const folders = data?.folders ?? []
  const servers = data?.servers ?? []
  const allServers = data?.allServers ?? []
  const visibleServers = servers.filter((s) => !serverInFolder(folders, s.UUID))
  const currentPage = data?.currentPage ?? 1
  const totalPages = data?.totalPages ?? 1

  function goToPage(p: number) {
    void navigate({ search: { page: p, err: undefined } })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Manage all your servers in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data?.canCreateServer ? (
            <a href="/create-server">
              <Button size="sm">
                <Plus className="size-4" />
                New server
              </Button>
            </a>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setNewFolderOpen(true)}
          >
            <FolderPlus className="size-4" />
            New folder
          </Button>
          {servers.length > 0 ? (
            <div className="flex items-center gap-1 rounded-xl border bg-background p-1">
              <button
                type="button"
                onClick={() => setView('grid')}
                aria-pressed={view === 'grid'}
                className={cn(
                  'flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  view === 'grid'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Grid2X2 className="size-4" />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                aria-pressed={view === 'list'}
                className={cn(
                  'flex min-h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors',
                  view === 'list'
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <ListIcon className="size-4" />
                List
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {/* Alerts */}
      {err === 'NOTACTIVEYET' ? (
        <AlertBanner
          variant="warning"
          title="Server is installing"
          detail="This server is not ready yet. It will be available once installation completes."
        />
      ) : null}
      {err === 'SERVER_LIMIT_REACHED' ? (
        <AlertBanner
          variant="warning"
          title="Server limit reached"
          detail="You have reached the maximum number of servers allowed. Contact your admin to increase your limit."
        />
      ) : null}
      {data?.daemonOffline ? (
        <DaemonOfflineBanner
          nodes={data.offlineNodes}
          onRetry={() => void dashboard.refetch()}
        />
      ) : null}

      {/* Empty state */}
      {servers.length === 0 && folders.length === 0 ? (
        <EmptyState
          canCreate={isAdmin || !!data?.canCreateServer}
          createHref={isAdmin ? '/admin/servers/create' : '/create-server'}
          isAdmin={isAdmin}
        />
      ) : (
        <div className="space-y-6">
          {/* Folders */}
          {folders.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Folders
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {folders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    onOpen={() => setFolderDialog(folder)}
                    onAddServer={async (uuid) => {
                      try {
                        await addServerToFolder(folder.id, uuid, csrf)
                        toast.success(`Added to ${folder.name}.`)
                      } catch (e) {
                        toast.error(
                          e instanceof Error ? e.message : 'Something went wrong.',
                        )
                      }
                    }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {/* Servers */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Servers
            </p>
            {visibleServers.length === 0 ? (
              <div className="rounded-xl border bg-muted/30 p-8 text-center text-sm text-muted-foreground">
                All servers are tucked into folders.
              </div>
            ) : view === 'grid' ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleServers.map((server) => (
                  <ServerCard
                    key={server.UUID}
                    server={server}
                    folders={folders}
                    csrf={csrf}
                    onPickFolder={() => setFolderPickerFor(server.UUID)}
                  />
                ))}
              </div>
            ) : (
              <ServerTable servers={visibleServers} />
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="flex items-center justify-center gap-3">
              {currentPage > 1 ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goToPage(currentPage - 1)}
                >
                  <ArrowLeft className="size-4" />
                  Previous
                </Button>
              ) : null}
              <span className="text-sm text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              {currentPage < totalPages ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goToPage(currentPage + 1)}
                >
                  Next
                  <ArrowRight className="size-4" />
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {/* Dialogs */}
      <NewFolderDialog
        open={newFolderOpen}
        onOpenChange={setNewFolderOpen}
        csrf={csrf}
      />
      <FolderDialog
        folder={folderDialog}
        allServers={allServers}
        csrf={csrf}
        onClose={() => setFolderDialog(null)}
      />
      <FolderPickerDialog
        serverUUID={folderPickerFor}
        folders={folders}
        csrf={csrf}
        onClose={() => setFolderPickerFor(null)}
      />
      <OnboardingDialog
        open={!!data?.needsOnboarding && !onboardingDismissed}
        canCreateServer={data?.canCreateServerForOnboarding ?? false}
        csrf={csrf}
        onDismiss={() => {
          setOnboardingDismissed(true)
          // Refetch so the payload reflects the new onboarding state.
          void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
        }}
      />
    </div>
  )
}

/* ── Small building blocks ─────────────────────────────────────────────── */

function AlertBanner({
  variant,
  title,
  detail,
}: {
  variant: 'warning' | 'danger'
  title: string
  detail: string
}) {
  const danger = variant === 'danger'
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border px-4 py-3',
        danger
          ? 'border-destructive/30 bg-destructive/5 text-destructive'
          : 'border-amber-500/30 bg-amber-500/5 text-amber-700 dark:text-amber-400',
      )}
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p
          className={cn(
            'mt-0.5 text-xs',
            danger ? 'text-destructive/80' : 'text-muted-foreground',
          )}
        >
          {detail}
        </p>
      </div>
    </div>
  )
}

function DaemonOfflineBanner({
  nodes,
  onRetry,
}: {
  nodes: { name: string; reason: string }[]
  onRetry: () => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Connection Error</p>
        <p className="mt-0.5 text-xs text-destructive/80">
          One or more nodes are offline.
        </p>
        {nodes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs opacity-80">
            {nodes.map((node) => (
              <li key={node.name} className="flex items-center gap-1.5">
                <ServerIcon className="size-3 shrink-0" />
                <span className="font-medium">{node.name}</span>
                <span>—</span>
                <span>{node.reason}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <p className="mt-2 text-xs text-destructive/70">
          The daemon on these nodes isn't responding. Servers on them stay
          offline until it comes back.
        </p>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onRetry}
        className="shrink-0"
      >
        <RefreshCw className="size-3" />
        Retry
      </Button>
    </div>
  )
}

function EmptyState({
  canCreate,
  createHref,
  isAdmin,
}: {
  canCreate: boolean
  createHref: string
  isAdmin: boolean
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-xl bg-muted">
        <ServerIcon className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">No servers yet</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isAdmin
            ? 'Create your first server to get started.'
            : canCreate
              ? 'Create your first server or ask an admin to assign one.'
              : 'An admin will assign one to you.'}
        </p>
      </div>
      {canCreate ? (
        <a href={createHref}>
          <Button size="sm">
            <Plus className="size-4" />
            Create server
          </Button>
        </a>
      ) : null}
    </div>
  )
}

function FolderCard({
  folder,
  onOpen,
  onAddServer,
}: {
  folder: DashboardFolder
  onOpen: () => void
  onAddServer: (uuid: string) => Promise<void>
}) {
  const [over, setOver] = useState(false)
  return (
    <button
      type="button"
      role="button"
      aria-label={`Open folder ${folder.name}`}
      onClick={onOpen}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const uuid = e.dataTransfer.getData('text/server-uuid')
        if (uuid) void onAddServer(uuid)
      }}
      className={cn(
        'flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all hover:shadow-md',
        over
          ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_0_2px_var(--amber-500/10)]'
          : 'hover:border-border-accent',
      )}
    >
      <Folder className="size-5 shrink-0 text-amber-500" fill="currentColor" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{folder.name}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {folder.members.length} server
          {folder.members.length !== 1 ? 's' : ''}
        </p>
      </div>
    </button>
  )
}

function ServerCard({
  server,
  folders,
  csrf,
  onPickFolder,
}: {
  server: DashboardServer
  folders: DashboardFolder[]
  csrf: string | null
  onPickFolder: () => void
}) {
  const [dragging, setDragging] = useState(false)
  const inFolder = serverInFolder(folders, server.UUID)
  const status = serverStatus(server)
  const owner = server.owner

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/server-uuid', server.UUID)
        setDragging(true)
      }}
      onDragEnd={() => setDragging(false)}
      className={cn(
        'group relative rounded-xl border bg-card transition-all hover:border-border-accent hover:shadow-md',
        dragging && 'opacity-40',
      )}
    >
      <a href={`/server/${server.UUID}`} className="block p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="flex items-center gap-1.5 truncate text-sm font-medium">
              <span className="truncate">{server.name}</span>
              {server.shared ? (
                <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                  <Users className="size-2.5" />
                  Shared
                </Badge>
              ) : null}
            </h3>
            {server.description ? (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {server.description}
              </p>
            ) : (
              <p className="mt-0.5 truncate text-xs italic text-muted-foreground/60">
                No description
              </p>
            )}
          </div>
          <StatusBadge status={status} className="shrink-0" />
        </div>

        <div className="mb-3 flex gap-3">
          <StatTile label="RAM" value={`${Math.round(Number(server.ramUsage))}%`} />
          <StatTile label="CPU" value={`${Math.round(Number(server.cpuUsage))}%`} />
          <StatTile label="Storage" value={formatStorage(server.Storage)} />
        </div>

        <div className="flex items-center justify-between border-t pt-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {owner ? (
              <>
                <img
                  loading="lazy"
                  decoding="async"
                  src={owner.avatar ?? `/avatar/${encodeURIComponent(owner.username)}`}
                  alt=""
                  className="size-4 shrink-0 rounded-full object-cover"
                />
                <span className="truncate text-xs text-muted-foreground">
                  {owner.username}
                </span>
              </>
            ) : (
              <span className="truncate text-xs text-muted-foreground">
                Unknown
              </span>
            )}
          </div>
          {server.node ? (
            <span className="ml-2 max-w-24 truncate text-xs text-muted-foreground/60">
              {server.node.name || server.node.address}
            </span>
          ) : null}
        </div>
      </a>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Actions for ${server.name}`}
              className="absolute right-2 top-2 z-10 flex size-8 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-colors hover:bg-accent sm:opacity-0 sm:group-hover:opacity-100"
            />
          }
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!inFolder ? (
            <DropdownMenuItem onClick={onPickFolder}>
              <FolderPlus className="size-4" />
              Add to folder
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              onClick={async () => {
                try {
                  await removeServerFromFolder(server.UUID, csrf)
                  toast.success('Removed from folder.')
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : 'Something went wrong.',
                  )
                }
              }}
            >
              <X className="size-4" />
              Remove from folder
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-lg bg-muted/60 px-3 py-2">
      <p className="mb-0.5 text-[10px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function ServerTable({ servers }: { servers: DashboardServer[] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Server</th>
            <th className="px-4 py-2.5 font-medium">Status</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Owner</th>
            <th className="px-4 py-2.5 font-medium">RAM</th>
            <th className="px-4 py-2.5 font-medium">CPU</th>
          </tr>
        </thead>
        <tbody>
          {servers.map((server) => (
            <tr
              key={server.UUID}
              className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
              onClick={() => {
                window.location.href = `/server/${server.UUID}`
              }}
            >
              <td className="px-4 py-2.5">
                <p className="flex items-center gap-1.5 font-medium">
                  <span className="truncate">{server.name}</span>
                  {server.shared ? (
                    <Badge variant="secondary" className="shrink-0 gap-1 text-[10px]">
                      <Users className="size-2.5" />
                      Shared
                    </Badge>
                  ) : null}
                </p>
                {server.description ? (
                  <p className="max-w-xs truncate text-xs text-muted-foreground">
                    {server.description}
                  </p>
                ) : null}
              </td>
              <td className="px-4 py-2.5">
                <StatusBadge status={serverStatus(server)} />
              </td>
              <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                {server.owner?.username ?? 'Unknown'}
              </td>
              <td className="px-4 py-2.5">{Math.round(Number(server.ramUsage))}%</td>
              <td className="px-4 py-2.5">{Math.round(Number(server.cpuUsage))}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Dialogs ───────────────────────────────────────────────────────────── */

function NewFolderDialog({
  open,
  onOpenChange,
  csrf,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  csrf: string | null
}) {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await createFolder(name.trim(), csrf)
      toast.success('Folder created.')
      setName('')
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create folder.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>
            Give your folder a name. Drag server cards onto it to add servers.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-folder-name" className="sr-only">
            Folder name
          </Label>
          <Input
            id="new-folder-name"
            placeholder="e.g. Game Servers"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void submit()
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            <X className="size-4" />
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            <Plus className="size-4" />
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FolderDialog({
  folder,
  allServers,
  csrf,
  onClose,
}: {
  folder: DashboardFolder | null
  allServers: DashboardServer[]
  csrf: string | null
  onClose: () => void
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const members = allServers.filter((s) => folder?.members.includes(s.UUID))

  return (
    <Dialog open={!!folder} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="size-4 text-amber-500" fill="currentColor" />
            {folder?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-1 overflow-y-auto">
          {members.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">
              No servers — drag a card here to add one.
            </p>
          ) : (
            members.map((server) => (
              <a
                key={server.UUID}
                href={`/server/${server.UUID}`}
                className="flex items-center justify-between rounded-xl border px-3 py-2 transition-colors hover:bg-accent/50"
              >
                <span className="truncate text-sm font-medium">{server.name}</span>
                <StatusBadge status={serverStatus(server)} className="shrink-0" />
              </a>
            ))
          )}
        </div>
        <DialogFooter className="justify-between">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Servers inside stay accessible.
              </span>
              <Button
                variant="destructive"
                size="sm"
                onClick={async () => {
                  if (!folder) return
                  try {
                    await deleteFolder(folder.id, csrf)
                    toast.success('Folder deleted.')
                    setConfirmingDelete(false)
                    onClose()
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : 'Failed to delete folder.',
                    )
                  }
                }}
              >
                <Trash2 className="size-3.5" />
                Confirm delete
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="size-3.5" />
              Delete folder
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function FolderPickerDialog({
  serverUUID,
  folders,
  csrf,
  onClose,
}: {
  serverUUID: string | null
  folders: DashboardFolder[]
  csrf: string | null
  onClose: () => void
}) {
  const [busyId, setBusyId] = useState<number | null>(null)

  if (!serverUUID) return null
  return (
    <Dialog open={!!serverUUID} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choose folder</DialogTitle>
          <DialogDescription>
            Pick where to move this server.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {folders.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Create a folder first.
            </p>
          ) : (
            folders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                disabled={busyId === folder.id}
                onClick={async () => {
                  setBusyId(folder.id)
                  try {
                    await addServerToFolder(folder.id, serverUUID, csrf)
                    toast.success(`Added to ${folder.name}.`)
                    onClose()
                  } catch (e) {
                    toast.error(
                      e instanceof Error ? e.message : 'Something went wrong.',
                    )
                  } finally {
                    setBusyId(null)
                  }
                }}
                className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors hover:bg-accent/50 disabled:opacity-60"
              >
                <Folder className="size-4 shrink-0 text-amber-500" fill="currentColor" />
                <span className="truncate text-sm">{folder.name}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/* ── Onboarding ────────────────────────────────────────────────────────── */

const ONBOARDING_STEPS = [
  {
    title: 'Your dashboard',
    text: 'This is where all your servers live. Start, stop, and manage them from the server view once you create an instance.',
  },
  {
    title: 'Create your first server',
    text: 'Pick an image, choose a node, and allocate resources. Your instance is ready to install in a couple of clicks.',
  },
  {
    title: 'Make it yours',
    text: 'Set your avatar and profile in Account settings so everyone on this panel recognises you.',
  },
]

function OnboardingDialog({
  open,
  canCreateServer,
  csrf,
  onDismiss,
}: {
  open: boolean
  canCreateServer: boolean
  csrf: string | null
  onDismiss: () => void
}) {
  const [step, setStep] = useState(0)

  // Restart the walkthrough each time the dialog opens again.
  useEffect(() => {
    if (open) setStep(0)
  }, [open])

  if (!open) return null
  const current = ONBOARDING_STEPS[step]
  return (
    <Dialog open={open} onOpenChange={() => undefined}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Welcome to the panel!</DialogTitle>
          <DialogDescription>
            A few quick tips to get you started.
          </DialogDescription>
        </DialogHeader>
        <div className="mb-4 flex gap-2">
          {ONBOARDING_STEPS.map((s, i) => (
            <div
              key={s.title}
              className={cn(
                'h-1 flex-1 rounded-full transition-colors',
                i <= step ? 'bg-primary' : 'bg-muted',
              )}
            />
          ))}
        </div>
        <h3 className="text-sm font-semibold">{current.title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {current.text}
        </p>
        <DialogFooter className="justify-between">
          <div className="flex items-center gap-2">
            {step > 0 ? (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
                <ArrowLeft className="size-4" />
                Back
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                void skipOnboarding(csrf).finally(onDismiss)
              }}
            >
              Skip
            </Button>
          </div>
          {step < ONBOARDING_STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep((s) => s + 1)}>
              Next
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <a href={canCreateServer ? '/create-server' : '/account'}>
              <Button
                size="sm"
                onClick={() => {
                  void completeOnboarding(csrf).finally(onDismiss)
                }}
              >
                {canCreateServer ? 'Create a server' : 'Get started'}
              </Button>
            </a>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
