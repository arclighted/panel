/**
 * /online-check — Nitro (crossws) twin of Express router.ws('/online-check')
 * in src/modules/user/wsUsers.ts (Phase 3 migration).
 *
 * Presence is tracked per connection, not per username: a user with several
 * open tabs/sockets stays online until the LAST connection closes. The set of
 * socket ids per username is updated immediately on connect/close, so there is
 * no stale 1-second window and no timeout bookkeeping.
 *
 * The presence sets now live in the Nitro process (only this process serves
 * the socket). Express's legacy admin users list (src/modules/admin/users.ts)
 * reads its own process-local copy, which is no longer populated — the admin
 * surface is fully migrated to the React app, which does not display it.
 */
import { defineWebSocketHandler } from 'h3'
import type { WebSocket } from 'ws'
import { nitroPrisma, type SessionPayload } from '../utils/auth-session'
import { sessionUserId } from '../utils/auth'
import logger from '../../../src/handlers/logger'

export const onlineUsers = new Set<string>()
export const onlineConnections = new Map<string, Set<string>>()

function connectionKey(): string {
  // Connection identity is what matters; the socket's own id is opaque.
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default defineWebSocketHandler((event) => {
  const session = (event.context.session as SessionPayload | undefined) ?? {}
  const userId = sessionUserId(session)

  return {
    async open(peer) {
      const ws = peer.websocket as unknown as WebSocket
      if (!userId) {
        ws.close()
        return
      }

      try {
        const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
        if (!user || !user.username) {
          ws.close()
          return
        }

        const username = user.username
        const connectionId = connectionKey()

        let connections = onlineConnections.get(username)
        if (!connections) {
          connections = new Set()
          onlineConnections.set(username, connections)
        }
        connections.add(connectionId)
        onlineUsers.add(username)

        ws.send(JSON.stringify({ online: true }))

        ws.on('close', () => {
          const conns = onlineConnections.get(username)
          if (!conns) {return;}
          conns.delete(connectionId)
          if (conns.size === 0) {
            onlineConnections.delete(username)
            onlineUsers.delete(username)
          }
        })
      } catch (error) {
        logger.error('Error fetching user:', error)
        ws.close()
      }
    },
  }
})
