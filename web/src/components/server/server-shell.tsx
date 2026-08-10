import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Copy,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCw,
  Square,
  X,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shell/status-badge'
import { useAuthConfig } from '@/lib/auth-config'
import {
  useServerContext,
  usePowerAction,
  cancelQueuedStart,
  acceptEula,
  formatUptime,
  type PowerAction,
  type ServerNavItem,
} from '@/lib/server'
import {
  getRealtimeClient,
  useRealtimeEvents,
  useServerLive,
  type RealtimeEvent,
} from '@/lib/realtime'
import { cn } from '@/lib/utils'

const GROUP_ORDER = ['run', 'data', 'manage', 'settings'] as const
const GROUP_LABELS: Record<string, string> = {
  run: 'Run',
  data: 'Data',
  manage: 'Manage',
  settings: 'Settings',
}

export function ServerShell({
  serverId,
  children,
}: {
  serverId: string
  children: ReactNode
}) {
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const context = useServerContext(serverId)
  const live = useServerLive(serverId)
  const power = usePowerAction(serverId)
  const location = useLocation()

  const [busy, setBusy] = useState<PowerAction | null>(null)
  const [confirmAction, setConfirmAction] = useState<'restart' | 'stop' | null>(null)
  const [eulaOpen, setEulaOpen] = useState(false)
  const [statusLog, setStatusLog] = useState<string | null>(null)
  const [localQueue, setLocalQueue] = useState<{
    queued: boolean
    position: number | null
    total: number
  } | null>(null)

  const server = context.data?.server
  const features = context.data?.features ?? []
  const installed = context.data?.installed
  const needsEula = features.includes('eula')

  // Live status resolution (context.status is the SSR-time snapshot; the
  // realtime bus owns it from here on).
  const status = useMemo(() => {
    if (server?.suspended) return 'suspended' as const
    const s = live.data?.status
    if (s?.running === true || s?.online === true) return 'online' as const
    if (s?.starting || s?.status === 'starting' || s?.status === 'restarting') {
      return 'starting' as const
    }
    if (s?.stopping || s?.status === 'stopping') return 'stopping' as const
    return 'offline' as const
  }, [server?.suspended, live.data?.status])

  // EULA gate — opened once per mount while the feature is pending.
  useEffect(() => {
    if (needsEula) setEulaOpen(true)
  }, [needsEula])

  async function handleAcceptEula(): Promise<void> {
    if (!csrf) return
    try {
      await acceptEula(serverId, csrf)
      toast.success('EULA accepted.')
      setEulaOpen(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not accept the EULA.')
    }
  }

  async function runPower(action: PowerAction): Promise<void> {
    if (!csrf) return
    setBusy(action)
    setLocalQueue(null)
    setStatusLog(action === 'start' ? 'Sending start request...' : 'Sending request...')
    try {
      const result = await power.mutate(action, csrf)
      if (result.queued) {
        setLocalQueue({
          queued: true,
          position: result.position ?? 0,
          total: result.total ?? 0,
        })
        setStatusLog('Waiting for capacity...')
        toast.info(`Server queued to ${action} (position ${result.position ?? '?'}).`)
      } else {
        setStatusLog(action === 'start' ? 'Starting container...' : `${action[0].toUpperCase()}${action.slice(1)}ing...`)
        toast.success(result.message ?? 'Request sent.')
      }
    } catch (e) {
      setStatusLog(null)
      toast.error(e instanceof Error ? e.message : `Failed to ${action} the server.`)
    } finally {
      setBusy(null)
    }
  }

  async function handleCancelQueue(): Promise<void> {
    if (!csrf) return
    try {
      await cancelQueuedStart(serverId, csrf)
      setLocalQueue(null)
      setStatusLog(null)
      toast.success('Queued start cancelled.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel the queued start.')
    }
  }

  // Realtime power/lifecycle events drive the status log and surface failures.
  const handleEvent = useRef<(event: RealtimeEvent) => void>(() => undefined)
  handleEvent.current = (event) => {
    if (event.type === 'server.power.start.failed' || event.type === 'server.start.failed') {
      const msg =
        (event.error?.message as string | undefined) ??
        (event.state as { message?: string } | undefined)?.message
      setStatusLog(null)
      toast.error(msg || "The server couldn't start.")
      return
    }
    if (event.type === 'server.power.stop.failed') {
      setStatusLog(null)
      toast.error((event.error?.message as string | undefined) || "Couldn't stop the server.")
      return
    }
    if (event.type === 'server.lifecycle.changed') {
      const state = (event.state ?? {}) as { type?: string; message?: string }
      if (state.type === 'started') {
        setStatusLog(null)
      } else if (state.type === 'stopped' || state.type === 'killed') {
        setStatusLog(null)
      } else if (state.type === 'error') {
        setStatusLog(null)
        toast.error(state.message || 'Something went wrong.')
      } else if (state.message) {
        setStatusLog(state.message)
      }
    }
  }
  useRealtimeEvents(handleEvent.current)

  // Queue box: prefer the live bus, fall back to the local POST response.
  const queue =
    live.data?.queue?.queued === true
      ? {
          queued: true,
          position: live.data.queue.position ?? null,
          total: live.data.queue.total ?? 0,
        }
      : localQueue

  // When the bus reports the queue cleared (external cancel / grant), drop
  // the local POST-response copy so the box can't resurrect.
  useEffect(() => {
    if (live.data?.queue && live.data.queue.queued !== true) {
      setLocalQueue(null)
    }
  }, [live.data?.queue])

  if (!server) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading server...
        </div>
        {children}
      </div>
    )
  }

  const suspended = server.suspended
  const daemonOffline = status === 'offline' && !!context.data?.status.daemonOffline

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-xl font-semibold tracking-tight">
              {server.name.charAt(0).toUpperCase() + server.name.slice(1)}
            </h1>
            <StatusBadge status={status} className="shrink-0" />
          </div>
          {server.description ? (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {server.description}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">{server.image}</span>
            </span>
            <span className="flex items-center gap-1">{server.node.name}</span>
            <span className="font-mono">{server.UUID.split('-')[0]}</span>
            {status === 'online' && context.data?.status.uptime != null ? (
              <span className="flex items-center gap-1">
                Up {formatUptime(context.data.status.uptime)}
              </span>
            ) : null}
          </div>
        </div>

        {/* Power controls */}
        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            variant="success"
            disabled={suspended || busy !== null}
            onClick={() => void runPower('start')}
          >
            {busy === 'start' ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            Start
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={suspended || busy !== null}
            onClick={() => setConfirmAction('restart')}
          >
            <RotateCw className="size-4" />
            Restart
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={suspended || busy !== null}
            onClick={() => setConfirmAction('stop')}
          >
            <Square className="size-4" />
            Stop
          </Button>
        </div>
      </div>

      {/* Suspended banner */}
      {suspended ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              This server's been grounded. Reach out to your admin if you think
              that's a mistake.
            </p>
            <p className="text-xs text-destructive/80">
              This server has been suspended by an administrator.
            </p>
          </div>
        </div>
      ) : null}

      {/* Install state */}
      {installed?.failed ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border bg-muted/40 px-4 py-3"
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10">
            <X className="size-4 text-destructive" />
          </div>
          <div>
            <p className="text-sm font-medium">Installation failed</p>
            <p className="mt-0.5 break-words text-xs text-muted-foreground">
              Check the server logs or contact an administrator.
            </p>
          </div>
        </div>
      ) : !installed?.installed ? (
        <div className="flex items-center gap-3 rounded-xl border bg-muted/40 px-4 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-background">
            <LoaderCircle className="size-4 animate-spin text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Installing server</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground" aria-live="polite">
              {statusLog ?? 'Waiting for daemon…'}
            </p>
          </div>
        </div>
      ) : null}

      {/* Daemon offline banner */}
      {daemonOffline || live.data?.status?.daemonOffline ? (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Connection Error</p>
            <p className="text-xs text-destructive/80">
              This node isn't talking to us right now. Check the daemon — it
              might just need a nudge.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => {
              // Reconnect the realtime bus (re-issues watch guards on ready).
              getRealtimeClient()?.reconnect()
            }}
          >
            <RefreshCw className="size-3" />
            Retry Connection
          </Button>
        </div>
      ) : null}

      {/* Queue status */}
      {queue?.queued ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
          <LoaderCircle className="size-4 shrink-0 animate-spin text-amber-600" />
          <div className="text-sm">
            <p className="font-medium text-amber-700 dark:text-amber-400">
              Queued to start{typeof queue.position === 'number' ? ` (position ${queue.position})` : ''}
            </p>
            <p className="text-xs text-muted-foreground">Waiting for capacity...</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void handleCancelQueue()}>
            Cancel start
          </Button>
        </div>
      ) : null}

      {/* Status log */}
      {statusLog && !queue?.queued ? (
        <p className="text-xs font-medium text-muted-foreground">{statusLog}</p>
      ) : null}

      {/* Server nav (addon-driven) */}
      <ServerNav serverId={serverId} items={context.data?.nav ?? []} pathname={location.pathname} />

      {children}

      {/* Confirm dialogs */}
      <Dialog open={confirmAction === 'restart'} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Restart server?</DialogTitle>
            <DialogDescription>Everyone gets disconnected. You sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setConfirmAction(null)
                void runPower('restart')
              }}
            >
              <RotateCw className="size-4" />
              Restart Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={confirmAction === 'stop'} onOpenChange={(v) => !v && setConfirmAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Stop server?</DialogTitle>
            <DialogDescription>Everyone gets disconnected. You sure?</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmAction(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmAction(null)
                void runPower('stop')
              }}
            >
              <Square className="size-4" />
              Stop Server
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* EULA gate — mandatory, mirrors serverFeatures.ejs (no dismiss). */}
      <Dialog open={eulaOpen} onOpenChange={() => undefined}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Accept Minecraft's EULA</DialogTitle>
            <DialogDescription>
              By clicking Accept you agree to the Mojang End User License
              Agreement (EULA). The server will not start until you accept.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => void handleAcceptEula()}>
              <Copy className="size-4" />
              Accept EULA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Copyable server address card used on the console page. */
export function ServerAddressCard({ address }: { address: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-start justify-between gap-2 rounded-xl border bg-card p-4">
      <div className="min-w-0">
        <h2 className="text-sm font-medium text-muted-foreground">IP Address:</h2>
        <p className="mt-1 break-all font-mono text-sm font-medium tracking-tight">
          {address}
        </p>
      </div>
      <button
        type="button"
        title="Copy"
        onClick={() => {
          void navigator.clipboard.writeText(address).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
          })
        }}
        className="mt-1 shrink-0 rounded-lg bg-muted p-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        {copied ? (
          <span className="text-emerald-500">✓</span>
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </div>
  )
}

/** Tiny SVG sparkline for live usage history. */
export function Sparkline({ points, className }: { points: number[]; className?: string }) {
  if (points.length < 2) return null
  const max = Math.max(100, ...points)
  const min = Math.min(0, ...points)
  const range = max - min || 1
  const width = 100
  const height = 24
  const step = width / (points.length - 1)
  const coords = points.map((p, i) => {
    const x = i * step
    const y = height - ((p - min) / range) * (height - 2) - 1
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-6 w-full', className)}
      aria-hidden="true"
    >
      <polyline
        points={coords.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
}

function ServerNav({
  serverId,
  items,
  pathname,
}: {
  serverId: string
  items: ServerNavItem[]
  pathname: string
}) {
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: items.filter((item) => (item.group || 'manage') === group),
  })).filter((g) => g.items.length > 0)

  if (grouped.length === 0) return null

  const isActive = (url: string) =>
    pathname === url || (url !== '/' && pathname.startsWith(`${url}/`))

  return (
    <nav aria-label="Server sections" className="flex flex-wrap gap-1">
      {grouped.map(({ group, items: groupItems }) => (
        <div key={group} className="flex flex-wrap items-center gap-1">
          {grouped.length > 1 ? (
            <span className="mr-1 px-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {GROUP_LABELS[group]}
            </span>
          ) : null}
          {groupItems.map((item) => {
            const active = isActive(item.url)
            const classes = cn(
              'flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-sm transition-colors',
              active
                ? 'border-transparent bg-accent font-medium text-accent-foreground'
                : 'border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )
            const isConsole = item.url === `/server/${serverId}`
            const migratedTab = MIGRATED_TAB_ROUTES[item.url]
            if (isConsole) {
              return (
                <Link
                  key={item.id}
                  to="/server/$uuid"
                  params={{ uuid: serverId }}
                  className={classes}
                >
                  <NavIcon svg={item.icon} />
                  {item.label}
                </Link>
              )
            }
            if (migratedTab) {
              return (
                <Link
                  key={item.id}
                  to={migratedTab}
                  params={{ uuid: serverId }}
                  className={classes}
                >
                  <NavIcon svg={item.icon} />
                  {item.label}
                </Link>
              )
            }
            return (
              <a key={item.id} href={item.url} className={classes}>
                <NavIcon svg={item.icon} />
                {item.label}
              </a>
            )
          })}
        </div>
      ))}
    </nav>
  )
}

/** Tabs now served by the TanStack app — SPA Links instead of anchor reloads. */
const MIGRATED_TAB_ROUTES: Record<string, string> = {
  '/files': '/server/$uuid/files',
  '/settings': '/server/$uuid/settings',
  '/startup': '/server/$uuid/startup',
  '/logs': '/server/$uuid/logs',
  '/databases': '/server/$uuid/databases',
  '/schedules': '/server/$uuid/schedules',
  '/backups': '/server/$uuid/backups',
  '/subusers': '/server/$uuid/subusers',
}

/** Addon-supplied icons are raw SVG strings (same trust model as EJS). */
function NavIcon({ svg }: { svg: string }) {
  if (!svg) return null
  return (
    <span
      className="size-4 shrink-0 [&>svg]:size-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
