import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'

/**
 * Live container console, ported from views/user/server/manage.ejs.
 *
 * Output streams through the panel's WebSocket proxy (`/console/:id`), which
 * requires a short-lived ws-token from `GET /server/:id/ws-token`. Commands
 * are sent over the same socket as `{ event: 'CMD', command }` — the proxy
 * forwards them to the daemon as REST calls. Binary frames pass through
 * untouched (TUI escape sequences).
 */

export interface TerminalHandle {
  /** Write a formatted line (system/error/info/success/normal). */
  writeLine(message: string, kind?: 'system' | 'error' | 'info' | 'success' | 'normal'): void
  /** Clear the buffer (install flow). */
  clear(): void
}

interface TerminalProps {
  serverId: string
  /** Container is running — disables "Load recent logs" while live. */
  online: boolean
  onDaemonOffline?: (offline: boolean) => void
}

/* ── ANSI-aware prompt masking (ported from manage.ejs) ──────────────────── */

const ANSI_RE =
  /\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[@-Z\\-_]|[\u0080-\u009F])/g
const PROMPT_RE = /(?:[a-zA-Z0-9_-]+)@[^\s:#\])\r\n]+(?:[^$#\r\n]*?)[$#]\s*/g

/** Replaces internal container prompts (container@host:~$) with "arclightd~ ". */
export function maskPrompts(raw: string): string {
  const plain = raw.replace(ANSI_RE, '')
  if (!PROMPT_RE.test(plain)) {
    PROMPT_RE.lastIndex = 0
    return raw
  }
  PROMPT_RE.lastIndex = 0

  const stripped = plain.replace(/[\r\n]/g, '').trim()
  const isOnlyPrompt = PROMPT_RE.test(stripped) && stripped.replace(PROMPT_RE, '').trim() === ''
  PROMPT_RE.lastIndex = 0

  if (isOnlyPrompt) {
    return '\r\narclightd~ '
  }
  return plain.replace(PROMPT_RE, 'arclightd~ ')
}

const DAEMON_INFRA_ERRORS = [
  'Failed to attach to container',
  'no such container',
  'No such container',
  'container not available',
  'Attach failed',
  'HTTP code 404',
  'HTTP code 500',
]

function isDaemonInfraError(text: string): boolean {
  return DAEMON_INFRA_ERRORS.some((needle) => text.includes(needle))
}

function themeColors(): { background: string; foreground: string } {
  if (typeof document === 'undefined') {
    return { background: '#141414', foreground: '#c5c9d1' }
  }
  const styles = getComputedStyle(document.documentElement)
  const read = (name: string, fallback: string) =>
    styles.getPropertyValue(name).trim() || fallback
  return {
    background: read('--background', '#141414'),
    foreground: read('--foreground', '#c5c9d1'),
  }
}

/* ── ws-token cache (45s TTL, mirrors manage.ejs) ────────────────────────── */

const tokenCache: { serverId: string | null; promise: Promise<string> | null; fetchedAt: number } = {
  serverId: null,
  promise: null,
  fetchedAt: 0,
}

function getWsConnectToken(serverId: string): Promise<string> {
  const fresh =
    Date.now() - tokenCache.fetchedAt < 45_000 && tokenCache.serverId === serverId
  if (!fresh) {
    tokenCache.serverId = serverId
    tokenCache.fetchedAt = Date.now()
    tokenCache.promise = fetch(`/server/${encodeURIComponent(serverId)}/ws-token`, {
      credentials: 'same-origin',
    })
      .then((res) => {
        if (!res.ok) throw new Error('ws-token')
        return res.json()
      })
      .then((data: { token?: string }) => data.token ?? '')
  }
  return tokenCache.promise ?? Promise.reject(new Error('ws-token'))
}

export const TerminalConsole = forwardRef<TerminalHandle, TerminalProps>(
  function TerminalConsole({ serverId, online, onDaemonOffline }, ref) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const termRef = useRef<Terminal | null>(null)
    const socketRef = useRef<WebSocket | null>(null)
    const releaseLockRef = useRef<(() => void) | null>(null)
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [readOnly, setReadOnly] = useState(false)
    const [connected, setConnected] = useState(false)
    const onlineRef = useRef(online)
    onlineRef.current = online

    // Ref-stable helpers so effects can close over them.
    const stateRef = useRef({
      reconnectAttempts: 0,
      reconnectInterval: 2000,
      wsErrorCount: 0,
      historyLoaded: false,
      history: [] as string[],
      historyIndex: -1,
      isReconnecting: false,
      pageHidden: false,
      teardown: false,
      ownership: true,
    })

    // Keep the mounted flag for async callbacks.
    const mountedRef = useRef(true)

    useEffect(() => {
      mountedRef.current = true
      return () => {
        mountedRef.current = false
      }
    }, [])

    function writeToTerm(text: string): void {
      const term = termRef.current
      if (term && mountedRef.current) term.write(text)
    }

    function writeLineToTerm(message: string, kind: string): void {
      const ansi: Record<string, string> = {
        system: '\x1b[33m',
        error: '\x1b[31m',
        info: '\x1b[34m',
        success: '\x1b[32m',
        normal: '\x1b[0m',
      }
      const color = ansi[kind.toLowerCase()] ?? '\x1b[0m'
      const prefix = kind !== 'normal' ? `[${kind}] ` : ''
      writeToTerm(`${color}${prefix}\x1b[37m${message}\x1b[0m\r\n`)
    }

    useImperativeHandle(ref, () => ({
      writeLine(message, kind = 'normal') {
        writeLineToTerm(message, kind)
      },
      clear() {
        termRef.current?.clear()
      },
    }))

    /* ── Socket lifecycle ─────────────────────────────────────────────── */

    function scheduleReconnect(): void {
      const s = stateRef.current
      if (s.teardown || s.pageHidden || s.reconnectAttempts > 10) return
      s.isReconnecting = true
      s.reconnectAttempts += 1
      const backoff = Math.min(30_000, s.reconnectInterval * Math.pow(1.5, s.reconnectAttempts - 1))
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        void openSocket()
      }, backoff)
    }

    async function loadLogHistory(withMarkers: boolean): Promise<void> {
      const term = termRef.current
      if (!term || !mountedRef.current) return
      try {
        const res = await fetch(`/server/${encodeURIComponent(serverId)}/logs/history`, {
          credentials: 'same-origin',
        })
        const data = (await res.json()) as { logs?: string[] }
        if (!res.ok) throw new Error('Failed to load logs')
        const lines = data.logs ?? []
        if (lines.length === 0) return
        if (withMarkers) {
          term.writeln('')
          term.writeln(`\x1b[90m— ${lines.length} lines from disk —\x1b[0m`)
        }
        for (const line of lines) term.writeln(maskPrompts(String(line)))
        if (withMarkers) term.writeln('\x1b[90m— end of saved log —\x1b[0m')
        term.scrollToBottom()
      } catch {
        term.writeln('\x1b[31mFailed to load log history\x1b[0m')
      }
    }

    async function openSocket(): Promise<void> {
      const s = stateRef.current
      if (!mountedRef.current || s.teardown || s.pageHidden) return
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.CONNECTING ||
          socketRef.current.readyState === WebSocket.OPEN)
      ) {
        return
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }

      try {
        const token = await getWsConnectToken(serverId)
        if (!mountedRef.current) return
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
        const socket = new WebSocket(
          `${protocol}//${window.location.host}/console/${encodeURIComponent(serverId)}?token=${encodeURIComponent(token)}`,
        )
        socketRef.current = socket

        socket.onopen = () => {
          if (!mountedRef.current) return
          s.reconnectAttempts = 0
          s.reconnectInterval = 2000
          s.wsErrorCount = 0
          setConnected(true)
          onDaemonOffline?.(false)
          if (!s.historyLoaded) {
            s.historyLoaded = true
            void loadLogHistory(false)
          }
        }

        socket.onmessage = (evt) => {
          if (!mountedRef.current) return
          const raw = evt.data
          if (raw instanceof Blob) {
            void raw.arrayBuffer().then((buf) => {
              const text = new TextDecoder().decode(buf)
              handleTerminalText(text)
            })
            return
          }
          handleTerminalText(typeof raw === 'string' ? raw : String(raw))
        }

        socket.onerror = () => {
          s.wsErrorCount += 1
          if (s.wsErrorCount >= 3) {
            onDaemonOffline?.(true)
          }
        }

        socket.onclose = () => {
          if (socketRef.current === socket) socketRef.current = null
          setConnected(false)
          if (mountedRef.current && !s.teardown) scheduleReconnect()
        }
      } catch {
        if (mountedRef.current) scheduleReconnect()
      }
    }

    function handleTerminalText(text: string): void {
      if (isDaemonInfraError(text)) return
      if (text.includes('arclightd server appears to be down')) {
        socketRef.current?.close()
        onDaemonOffline?.(true)
        return
      }
      if (text.includes('Working on')) {
        termRef.current?.clear()
        socketRef.current?.close()
        return
      }
      try {
        const parsed = JSON.parse(text) as { event?: string; data?: { message?: string } }
        if (parsed?.event === 'error') {
          writeLineToTerm(parsed.data?.message ?? text, 'error')
          return
        }
      } catch {
        /* plain terminal output */
      }
      writeToTerm(maskPrompts(text))
    }

    /* ── Terminal setup ───────────────────────────────────────────────── */

    useEffect(() => {
      const el = containerRef.current
      if (!el) return

      // Fresh per-mount state: a previous mount (or a server switch) must not
      // leave the socket teardown flags behind.
      const s = stateRef.current
      s.teardown = false
      s.historyLoaded = false
      s.reconnectAttempts = 0
      s.reconnectInterval = 2000
      s.wsErrorCount = 0

      const colors = themeColors()
      const term = new Terminal({
        disableStdin: true,
        lineHeight: 1.35,
        fontFamily: 'Menlo, Monaco, Consolas, monospace',
        fontSize: 12,
        scrollback: 1000,
        convertEol: true,
        theme: {
          background: colors.background,
          foreground: colors.foreground,
          cursor: colors.foreground,
          cursorAccent: colors.background,
        },
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.loadAddon(new WebLinksAddon())
      term.open(el)
      fit.fit()
      termRef.current = term

      const onResize = () => fit.fit()
      window.addEventListener('resize', onResize)

      // Web Locks two-tab ownership — exactly one tab owns console input. The
      // lock is held by a promise we resolve on cleanup, so SPA navigation
      // releases it (a never-resolving promise would deadlock revisits: the
      // second visit's request would queue forever behind the first).
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        let releaseLock: (() => void) | null = null
        const held = new Promise<void>((resolve) => {
          releaseLock = resolve
        })
        releaseLockRef.current = releaseLock
        void navigator.locks
          .request(`al-console-input:${serverId}`, () => {
            s.ownership = true
            setReadOnly(false)
            return held
          })
          .catch(() => {
            s.ownership = true
            setReadOnly(false)
          })
      } else {
        s.ownership = true
      }

      const onVisibility = () => {
        s.pageHidden = document.visibilityState === 'hidden'
        if (s.pageHidden) {
          s.isReconnecting = false
          if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current)
            reconnectTimerRef.current = null
          }
          socketRef.current?.close(1000, 'page hidden')
          socketRef.current = null
          setConnected(false)
        } else {
          void openSocket()
        }
      }
      document.addEventListener('visibilitychange', onVisibility)

      // Wheel/touch scroll the terminal buffer instead of the page.
      const onWheel = (e: WheelEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const lines = e.deltaMode === 1 ? e.deltaY : Math.round(e.deltaY / 20)
        term.scrollLines(lines)
      }
      el.addEventListener('wheel', onWheel, { passive: false })

      void openSocket()

      return () => {
        document.removeEventListener('visibilitychange', onVisibility)
        window.removeEventListener('resize', onResize)
        el.removeEventListener('wheel', onWheel)
        // Release the console-input lock so a revisit can re-acquire it.
        releaseLockRef.current?.()
        releaseLockRef.current = null
        s.teardown = true
        if (reconnectTimerRef.current) {
          clearTimeout(reconnectTimerRef.current)
          reconnectTimerRef.current = null
        }
        socketRef.current?.close(1000, 'page navigating')
        socketRef.current = null
        termRef.current = null
        setTimeout(() => term.dispose(), 0)
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [serverId])

    /* ── Command input ────────────────────────────────────────────────── */

    const [command, setCommand] = useState('')
    const inputRef = useRef<HTMLInputElement | null>(null)

    function sendCommand(): void {
      const s = stateRef.current
      const trimmed = command.trim()
      if (!trimmed || !socketRef.current || !s.ownership) return
      writeToTerm(`\u001b[1m\u001b[33m~ \u001b[0m${trimmed}\r\n`)
      socketRef.current.send(JSON.stringify({ event: 'CMD', command: trimmed }))
      s.history = [...s.history.slice(-9), trimmed]
      s.historyIndex = s.history.length
      setCommand('')
      inputRef.current?.focus()
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
      const s = stateRef.current
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (s.historyIndex > 0) {
          s.historyIndex -= 1
          setCommand(s.history[s.historyIndex] ?? '')
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (s.historyIndex < s.history.length - 1) {
          s.historyIndex += 1
          setCommand(s.history[s.historyIndex] ?? '')
        } else {
          s.historyIndex = s.history.length
          setCommand('')
        }
      } else if (e.key === 'Enter') {
        sendCommand()
      }
    }

    return (
      <div className="flex flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="text-[11px] font-medium tracking-wide text-muted-foreground">
            console
          </span>
          <span className="flex-1" />
          {readOnly ? (
            <span className="text-[11px] font-medium text-muted-foreground">
              View-only — console input is active in another tab
            </span>
          ) : null}
          <button
            type="button"
            disabled={online || !mountedRef.current}
            onClick={() => void loadLogHistory(true)}
            className="rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent disabled:pointer-events-none disabled:opacity-45"
            title={online ? 'Live console is streaming' : 'Load recent logs'}
          >
            Load recent logs
          </button>
        </div>
        <div ref={containerRef} className="h-[420px] w-full" />
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!connected || readOnly}
          placeholder={
            !connected
              ? 'Waiting for container...'
              : readOnly
                ? 'Console input is active in another tab'
                : 'Type a command...'
          }
          aria-label="Console input"
          className="w-full border-t bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground/60"
        />
      </div>
    )
  },
)
