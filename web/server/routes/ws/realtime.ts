/**
 * /ws/realtime — Nitro (crossws) twin of the Express realtime bus in
 * src/modules/realtime/index.ts (Phase 3 migration).
 *
 * The single browser real-time channel. Authenticated via the session cookie
 * (no per-socket token): the 01.session middleware runs before the WS hooks
 * (Nitro's resolveWebsocketHooks executes the full h3 chain), so
 * event.context.session is loaded for every upgrade. The server, not the
 * client, decides which events each socket may receive (see hub.ts).
 *
 * `peer.websocket` is the raw `ws` socket (crossws' Node adapter proxies the
 * instance), so the original heartbeat / watch / resync protocol — readyState
 * guards, send, on('message'|'close'|'error'), close codes — ports 1:1.
 *
 * Process topology note: the realtime bus now lives in the Nitro process.
 * The daemon watchers started here and every React-app mutation (Nitro-owned
 * since Phase 2) emit into the SAME bus instance, so React sockets receive
 * the full event stream. Events emitted by legacy Express-process mutations
 * are not delivered to this socket — the documented split-brain of the
 * migration (the EJS client never connects to this endpoint).
 */
import { defineWebSocketHandler } from 'h3'
import { randomUUID } from 'node:crypto'
import type { WebSocket } from 'ws'
import { nitroPrisma, type SessionPayload } from '../../utils/auth-session'
import { sessionUserId } from '../../utils/auth'
import logger from '../../../../src/handlers/logger'
import { getUserServerIds } from '../../../../src/handlers/realtime/access'
import {
  dropRealtimeSession,
  realtimeSessions,
  registerRealtimeSession,
  resynchronizeSession,
  type RealtimeSession,
} from '../../../../src/handlers/realtime/hub'
import {
  watchServerStatus,
  type WatchHandle,
} from '../../../../src/handlers/realtime/serverStatusWatcher'
import {
  watchServerEvents,
  type WatchHandle as EventWatchHandle,
} from '../../../../src/handlers/realtime/serverEventWatcher'

const HEARTBEAT_INTERVAL_MS = 20_000
const HEARTBEAT_TIMEOUT_MS = 12_000

/** Realtime socket with the pending heartbeat timeout attached. */
interface RealtimeWS extends WebSocket {
  __pongTimer?: NodeJS.Timeout
}

// ── Watch registry ────────────────────────────────────────────────────────────
// Sessions may ask the server to stream a server's daemon status/stats and/or
// lifecycle events onto the bus. The daemon connections are shared (watchers
// refcount by serverId); these maps track which session watches what so
// closing a socket releases only its own watch.

const sessionWatches = new Map<string, Map<string, WatchHandle>>()
const sessionEventWatches = new Map<string, Map<string, EventWatchHandle>>()

function releaseSessionWatches(sessionId: string): void {
  const handles = sessionWatches.get(sessionId)
  if (handles) {
    for (const handle of handles.values()) {
      try {
        handle.release()
      } catch {
        /* already released */
      }
    }
    sessionWatches.delete(sessionId)
  }
  const eventHandles = sessionEventWatches.get(sessionId)
  if (eventHandles) {
    for (const handle of eventHandles.values()) {
      try {
        handle.release()
      } catch {
        /* already released */
      }
    }
    sessionEventWatches.delete(sessionId)
  }
}

async function getNode(serverId: string): Promise<{ address: string; port: number; key: string } | null> {
  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      select: { node: { select: { address: true, port: true, key: true } } },
    })
    return server?.node ?? null
  } catch (error) {
    logger.warn(`Failed to resolve node for ${serverId}:`, { error: String(error) })
    return null
  }
}

function sessionCanSee(session: RealtimeSession | undefined, serverId: string): boolean {
  if (!session) {return false;}
  if (session.serverIds === 'all') {return true;}
  return session.serverIds.has(serverId);
}

async function beginWatch(session: RealtimeSession, serverId: string): Promise<void> {
  let handles = sessionWatches.get(session.id)
  if (!handles) {
    handles = new Map()
    sessionWatches.set(session.id, handles)
  }
  if (handles.has(serverId)) {return;}

  const node = await getNode(serverId)
  if (!node) {return;}
  const handle = watchServerStatus(serverId, node)
  handles.set(serverId, handle)
}

async function endWatch(session: RealtimeSession, serverId: string): Promise<void> {
  const handles = sessionWatches.get(session.id)
  const handle = handles?.get(serverId)
  if (!handle) {return;}
  try {
    handle.release()
  } catch {
    /* already released */
  }
  handles?.delete(serverId)
}

async function beginEventWatch(session: RealtimeSession, serverId: string): Promise<void> {
  let handles = sessionEventWatches.get(session.id)
  if (!handles) {
    handles = new Map()
    sessionEventWatches.set(session.id, handles)
  }
  if (handles.has(serverId)) {return;}

  const node = await getNode(serverId)
  if (!node) {return;}
  const handle = watchServerEvents(serverId, node)
  handles.set(serverId, handle)
}

async function endEventWatch(session: RealtimeSession, serverId: string): Promise<void> {
  const handles = sessionEventWatches.get(session.id)
  const handle = handles?.get(serverId)
  if (!handle) {return;}
  try {
    handle.release()
  } catch {
    /* already released */
  }
  handles?.delete(serverId)
}

export default defineWebSocketHandler((event) => {
  // The 01.session middleware always runs before the WS hooks, so
  // event.context.session is populated for every upgrade.
  const session = (event.context.session as SessionPayload | undefined) ?? {}
  const userId = sessionUserId(session)

  return {
    async open(peer) {
      const ws = peer.websocket as unknown as RealtimeWS
      if (!userId) {
        ws.close(4401, 'unauthenticated')
        return
      }

      let user
      try {
        user = await nitroPrisma.users.findUnique({ where: { id: userId } })
      } catch {
        ws.close(1011, 'internal error')
        return
      }
      if (!user?.username) {
        ws.close(1008, 'invalid user')
        return
      }

      const isAdmin = Boolean(user.isAdmin)
      const sessionId = randomUUID()

      // Attach the cleanup handlers BEFORE the async registration below: a
      // client that disconnects during the DB round-trip would otherwise miss
      // the close event and leak a session in `realtimeSessions` (the Express
      // original had the same race; the heartbeat only starts after
      // registration, so nothing pings it back).
      let heartbeat: NodeJS.Timeout | undefined
      const cleanup = () => {
        if (heartbeat) {clearInterval(heartbeat);}
        const pending = ws.__pongTimer
        if (pending) {clearTimeout(pending);}
        releaseSessionWatches(sessionId)
        dropRealtimeSession(sessionId)
      }
      ws.on('close', cleanup)
      ws.on('error', cleanup)

      try {
        await registerRealtimeSession(sessionId, userId, isAdmin, getUserServerIds(userId, isAdmin), ws)
      } catch (error) {
        logger.error('Failed to register realtime session:', error)
        ws.close(1011, 'internal error')
        return
      }

      // Heartbeats detect half-open connections; a missed pong closes us.
      heartbeat = setInterval(() => {
        if (ws.readyState !== 1) {
          clearInterval(heartbeat)
          return
        }
        const timeout = setTimeout(() => {
          logger.debug(`realtime heartbeat timeout for session ${sessionId}`)
          dropRealtimeSession(sessionId)
          ws.close(4001, 'heartbeat timeout')
        }, HEARTBEAT_TIMEOUT_MS)
        ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
        // Remember the pending timeout on the socket for cancellation.
        ws.__pongTimer = timeout
      }, HEARTBEAT_INTERVAL_MS)

      ws.on('message', async (raw: Buffer | string) => {
        let msg: { type?: string; sinceSeq?: number | null; serverId?: string }
        try {
          msg = JSON.parse(String(raw))
        } catch {
          return
        }
        if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') {return;}

        if (msg.type === 'pong') {
          const pending = ws.__pongTimer
          if (pending) {
            clearTimeout(pending)
            ws.__pongTimer = undefined
          }
          return
        }

        if (msg.type === 'sync') {
          const sinceSeq =
            typeof msg.sinceSeq === 'number' && Number.isFinite(msg.sinceSeq) ? msg.sinceSeq : null
          resynchronizeSession(sessionId, sinceSeq).catch((err) =>
            logger.warn('realtime resync failed:', { error: String(err) }),
          )
          return
        }

        const session = realtimeSessions.get(sessionId)
        if (msg.type === 'watch' && typeof msg.serverId === 'string') {
          if (!session || !sessionCanSee(session, msg.serverId)) {return;}
          beginWatch(session, msg.serverId).catch((err) =>
            logger.warn(`realtime watch failed for ${msg.serverId}:`, { error: String(err) }),
          )
          return
        }

        if (msg.type === 'unwatch' && typeof msg.serverId === 'string') {
          if (session) {endWatch(session, msg.serverId).catch(() => undefined);}
          return
        }

        if (msg.type === 'watchEvents' && typeof msg.serverId === 'string') {
          if (!session || !sessionCanSee(session, msg.serverId)) {return;}
          beginEventWatch(session, msg.serverId).catch((err) =>
            logger.warn(`realtime watchEvents failed for ${msg.serverId}:`, { error: String(err) }),
          )
          return
        }

        if (msg.type === 'unwatchEvents' && typeof msg.serverId === 'string') {
          if (session) {endEventWatch(session, msg.serverId).catch(() => undefined);}
          return
        }

        if (msg.type === 'watchAll' && session && session.serverIds === 'all') {
          try {
            const servers = await nitroPrisma.server.findMany({ select: { UUID: true } })
            for (const s of servers) {await beginWatch(session, s.UUID);}
          } catch (error) {
            logger.warn('realtime watchAll failed:', { error: String(error) })
          }
        }
      })

    },
  }
})

export { randomUUID }
