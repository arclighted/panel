import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import { queryClient } from './query-client'

/**
 * Realtime client for the panel's `/ws/realtime` bus.
 *
 * A TS reimplementation of `public/javascript/shared/realtime.js` for the
 * React app: ONE authenticated socket, `sync` cursor handshake, ping/pong
 * heartbeat, and per-server `watch` / `watchEvents` subscriptions. The panel's
 * daemon watchers fan `server.status.changed`, `server.stats.changed`,
 * `server.lifecycle.changed` and queue events onto the bus; this client maps
 * them into the TanStack Query cache (`['server-live', uuid]`) so React
 * components render the last-known live state, and re-issues watch commands
 * after every reconnect.
 *
 * The transport is `reconnecting-websocket` (same as the EJS client); both
 * the WebSocket ctor and storage are injectable for Node tests.
 */

export interface RealtimeStatusState {
  running?: boolean
  starting?: boolean
  stopping?: boolean
  daemonOffline?: boolean
  uptime?: number | null
  startedAt?: string | null
  status?: string
  online?: boolean
  error?: string
}

export interface RealtimeStatsState {
  cpu?: number
  memory?: { usage?: number; percentage?: number; limit?: number }
  disk?: { usage?: number; percentage?: number; limit?: number }
}

export interface RealtimeQueueState {
  queued?: boolean
  position?: number | null
  total?: number
}

export interface RealtimeLifecycleState {
  type?: string
  message?: string
}

export interface ServerLiveState {
  status?: RealtimeStatusState
  stats?: RealtimeStatsState
  queue?: RealtimeQueueState
  lifecycle?: RealtimeLifecycleState
  lastEventAt?: number
}

export interface RealtimeEvent {
  type: string
  resource?: { type: string; id: string | number }
  state?: unknown
  error?: { message?: string } | null
  timestamp?: number
  seq?: number
}

type EventHandler = (event: RealtimeEvent) => void
type StatusHandler = (status: string, prev: string) => void

const DEFAULT_PATH = '/ws/realtime'
const SEQ_KEY = '__al_realtime_seq'
const MAX_RETRY_MS = 15_000
const MAX_ATTEMPTS = 12

function readSeq(storage: Storage | null): number | null {
  if (!storage) return null
  try {
    const n = parseInt(storage.getItem(SEQ_KEY) ?? '', 10)
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function writeSeq(storage: Storage | null, seq: number | null): void {
  if (!storage || seq == null) return
  try {
    storage.setItem(SEQ_KEY, String(seq))
  } catch {
    /* storage unavailable */
  }
}

function buildUrl(secure?: boolean): string {
  const scheme =
    typeof window !== 'undefined' && (secure || window.location.protocol === 'https:')
      ? 'wss:'
      : 'ws:'
  const host = typeof window !== 'undefined' ? window.location.host : 'localhost'
  return `${scheme}//${host}${DEFAULT_PATH}`
}

export interface RealtimeClient {
  /** Register a raw event subscriber; returns an unsubscribe fn. */
  subscribe(fn: EventHandler): () => void
  onStatusChange(fn: StatusHandler): () => void
  watch(serverId: string): void
  unwatch(serverId: string): void
  watchEvents(serverId: string): void
  unwatchEvents(serverId: string): void
  status(): string
  /** Force a reconnect (used by the daemon-offline retry button). */
  reconnect(): void
  disconnect(): void
}

interface RwsInstance {
  addEventListener(type: string, fn: (evt: { data?: unknown }) => void): void
  send(data: string): void
  close(code?: number, reason?: string): void
  reconnect?(): void
}

type RwsCtor = new (
  url: string,
  protocols?: string | string[],
  options?: Record<string, unknown>,
) => RwsInstance

export interface CreateRealtimeOptions {
  secure?: boolean
  url?: string
  storage?: Storage | null
  WebSocket?: typeof WebSocket
  ReconnectingWebSocket?: RwsCtor
  autostart?: boolean
}

/**
 * Writes one realtime event into the `['server-live', uuid]` cache the way
 * `public/javascript/shared/eventrouting.js` maps events into the EJS state
 * cache — status/stats/queue are last-value writes; power/lifecycle events
 * additionally invalidate the REST snapshot and dashboard queries.
 */
function routeEventToCache(event: RealtimeEvent): void {
  const resource = event.resource
  const serverId =
    resource && resource.type === 'server' ? String(resource.id) : null
  if (!serverId) return

  const merge = (patch: Partial<ServerLiveState>) => {
    queryClient.setQueryData<ServerLiveState>(
      ['server-live', serverId],
      (old) => ({ ...old, ...patch, lastEventAt: Date.now() }),
    )
  }

  switch (event.type) {
    case 'server.status.changed':
      merge({ status: (event.state ?? {}) as RealtimeStatusState })
      break
    case 'server.stats.changed':
      merge({ stats: (event.state ?? {}) as RealtimeStatsState })
      break
    case 'server.lifecycle.changed':
      merge({ lifecycle: (event.state ?? {}) as RealtimeLifecycleState })
      break
    case 'server.start.queued':
    case 'server.start.queue.changed':
      merge({ queue: (event.state ?? {}) as RealtimeQueueState })
      break
    case 'server.start.cancelled':
    case 'server.start.failed':
      merge({ queue: { queued: false, position: null, total: 0 } })
      break
    case 'server.power.started':
    case 'server.power.stopped': {
      const state = (event.state ?? {}) as RealtimeStatusState
      merge({ status: { running: state.running === true, ...state } })
      void queryClient.invalidateQueries({ queryKey: ['server-status', serverId] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      break
    }
    default:
      break
  }
}

let singleton: RealtimeClient | null = null

/**
 * Creates a realtime client. In the browser this is called once (module
 * singleton) and keeps one socket across navigation, exactly like the EJS
 * client. Tests call it directly with injected WebSocket implementations.
 */
export function createRealtimeClient(opts: CreateRealtimeOptions = {}): RealtimeClient {
  const RWS =
    opts.ReconnectingWebSocket ??
    (typeof window !== 'undefined' ? (window as unknown as { ReconnectingWebSocket?: CreateRealtimeOptions['ReconnectingWebSocket'] }).ReconnectingWebSocket : undefined)
  const WS = opts.WebSocket ?? (typeof window !== 'undefined' ? window.WebSocket : undefined)

  if (!RWS || !WS) {
    return {
      subscribe: () => () => undefined,
      onStatusChange: () => () => undefined,
      watch: () => undefined,
      unwatch: () => undefined,
      watchEvents: () => undefined,
      unwatchEvents: () => undefined,
      status: () => 'unsupported',
      reconnect: () => undefined,
      disconnect: () => undefined,
    }
  }

  // Non-optional bindings so closures don't have to re-narrow the union.
  const rwsCtor: RwsCtor = RWS
  const wsCtor: typeof WebSocket = WS

  const storage = opts.storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
  const url = opts.url ?? buildUrl(opts.secure)

  let status = 'disconnected'
  let socket: RwsInstance | null = null
  let stopped = false
  let lastSeq = readSeq(storage)
  const handlers = new Set<EventHandler>()
  const statusListeners = new Set<StatusHandler>()
  const watched = new Set<string>()
  const watchedEvents = new Set<string>()

  function setStatus(next: string): void {
    if (status === next) return
    const prev = status
    status = next
    for (const fn of statusListeners) {
      try {
        fn(status, prev)
      } catch {
        /* listener isolation */
      }
    }
  }

  function dispatch(event: RealtimeEvent): void {
    for (const fn of handlers) {
      try {
        fn(event)
      } catch {
        /* handler isolation */
      }
    }
    routeEventToCache(event)
  }

  function resubscribe(): void {
    for (const id of watched) {
      try {
        socket?.send(JSON.stringify({ type: 'watch', serverId: id }))
      } catch {
        /* transport not ready */
      }
    }
    for (const id of watchedEvents) {
      try {
        socket?.send(JSON.stringify({ type: 'watchEvents', serverId: id }))
      } catch {
        /* transport not ready */
      }
    }
  }

  function connectSocket(): void {
    if (stopped || socket) return

    const rws = new rwsCtor(url, [], {
      connectionTimeout: 4000,
      minReconnectionDelay: 1000,
      maxReconnectionDelay: MAX_RETRY_MS,
      maxRetries: MAX_ATTEMPTS,
      WebSocket: wsCtor,
    } as Record<string, unknown>)
    socket = rws
    setStatus('connecting')

    rws.addEventListener('open', () => {
      try {
        rws.send(JSON.stringify({ type: 'sync', sinceSeq: lastSeq }))
      } catch {
        /* transport not ready */
      }
    })

    rws.addEventListener('message', (evt) => {
      let parsed: RealtimeEvent | { type: 'ping' | 'pong' } | null
      try {
        parsed = JSON.parse(String(evt?.data))
      } catch {
        return
      }
      if (!parsed || typeof parsed !== 'object') return

      if ((parsed as { type: string }).type === 'ping') {
        try {
          rws.send(JSON.stringify({ type: 'pong' }))
        } catch {
          /* transport closed */
        }
        return
      }

      const type = (parsed as { type?: string }).type
      if (type === 'realtime.ready' || type === 'realtime.synced') {
        const seq = (parsed as { seq?: number }).seq
        if (typeof seq === 'number' && seq > (lastSeq ?? 0)) {
          lastSeq = seq
          writeSeq(storage, lastSeq)
        }
        setStatus('connected')
        // Re-issue every subscription after (re)connect so the panel's daemon
        // watchers restart for this session.
        resubscribe()
        return
      }

      const seq = (parsed as { seq?: number }).seq
      if (typeof seq === 'number' && seq > (lastSeq ?? 0)) {
        lastSeq = seq
        writeSeq(storage, lastSeq)
      }
      dispatch(parsed as RealtimeEvent)
    })

    rws.addEventListener('close', () => {
      if (stopped) {
        setStatus('disconnected')
        return
      }
      setStatus('reconnecting')
    })
  }

  // Browser wiring: reconnect on visibility/online transitions.
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('online', () => {
      stopped = false
      if (!socket) connectSocket()
      else {
        try {
          socket.reconnect?.()
        } catch {
          /* rws reconnects on its own */
        }
      }
    })
    window.addEventListener('offline', () => {
      if (!socket) setStatus('reconnecting')
    })
  }
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        // Keep the socket for state reads; close it to free the connection.
        stopped = true
        try {
          socket?.close(4001)
        } catch {
          /* already closed */
        }
      } else {
        stopped = false
        connectSocket()
      }
    })
  }

  const client: RealtimeClient = {
    subscribe(fn) {
      handlers.add(fn)
      return () => {
        handlers.delete(fn)
      }
    },
    onStatusChange(fn) {
      statusListeners.add(fn)
      return () => {
        statusListeners.delete(fn)
      }
    },
    watch(serverId) {
      watched.add(serverId)
      try {
        socket?.send(JSON.stringify({ type: 'watch', serverId }))
      } catch {
        /* will resubscribe on next ready */
      }
    },
    unwatch(serverId) {
      watched.delete(serverId)
      try {
        socket?.send(JSON.stringify({ type: 'unwatch', serverId }))
      } catch {
        /* transport closed */
      }
    },
    watchEvents(serverId) {
      watchedEvents.add(serverId)
      try {
        socket?.send(JSON.stringify({ type: 'watchEvents', serverId }))
      } catch {
        /* will resubscribe on next ready */
      }
    },
    unwatchEvents(serverId) {
      watchedEvents.delete(serverId)
      try {
        socket?.send(JSON.stringify({ type: 'unwatchEvents', serverId }))
      } catch {
        /* transport closed */
      }
    },
    status: () => status,
    reconnect() {
      stopped = false
      connectSocket()
    },
    disconnect() {
      stopped = true
      try {
        socket?.close(1000)
      } catch {
        /* already closed */
      }
      socket = null
      setStatus('disconnected')
    },
  }

  if (opts.autostart !== false) {
    connectSocket()
  }
  return client
}

/** Singleton used by the React app (browser only). */
export function getRealtimeClient(): RealtimeClient | null {
  if (typeof window === 'undefined') return null
  if (!singleton) {
    singleton = createRealtimeClient()
  }
  return singleton
}

const EMPTY_LIVE: ServerLiveState = {}

/**
 * Live status/stats/queue for one server, fed by the realtime bus. Mounting
 * this hook subscribes the shared socket to the server; the cache is written
 * by `routeEventToCache` and read here without any HTTP fetch.
 */
export function useServerLive(serverId: string) {
  useEffect(() => {
    const rt = getRealtimeClient()
    if (!rt) return
    rt.watch(serverId)
    rt.watchEvents(serverId)
    return () => {
      rt.unwatch(serverId)
      rt.unwatchEvents(serverId)
    }
  }, [serverId])

  return useQuery<ServerLiveState>({
    queryKey: ['server-live', serverId],
    queryFn: () => Promise.resolve(EMPTY_LIVE),
    enabled: false,
    initialData: EMPTY_LIVE,
  })
}

/**
 * Raw realtime event subscription for a mounted component (e.g. the console
 * writes lifecycle/power lines into the terminal). Re-subscribes when `fn`
 * changes identity.
 */
export function useRealtimeEvents(fn: (event: RealtimeEvent) => void) {
  // Subscribe once; always dispatch to the latest handler so a re-render never
  // churns the subscription set.
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => {
    const rt = getRealtimeClient()
    if (!rt) return
    return rt.subscribe((event) => fnRef.current(event))
  }, [])
}
