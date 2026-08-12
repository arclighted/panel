/**
 * Nitro-side WebSocket console proxy — twin of the Express handlers in
 * src/modules/user/serverConsole.ts (Phase 3 migration).
 *
 * The three panel console surfaces — /console/:id (interactive), /status/:id
 * and /events/:id (read-only) — each open a proxied WebSocket to the node's
 * daemon. Binary frames are preserved end-to-end for TUI pass-through
 * (daemon → panel → browser → xterm.js): nothing in this file converts the
 * Buffer to a string.
 *
 * Auth contract (mirrors serverConsole.ts exactly):
 *  - Session cookie via the 01.session middleware (the full h3 chain runs
 *    before crossws builds the hooks, so event.context.session is loaded).
 *  - The server-access gate mirrors isAuthenticatedForServerWS('id'): admin,
 *    owner, or subuser membership; suspended servers close the socket.
 *  - The interactive route additionally requires the subuser `console`
 *    permission (mirrors the inline gate in the /console handler).
 *  - The short-lived connect token (verifyWsToken) must match the session
 *    user + server id; the daemon connection is authed with a minted
 *    capability token instead of the raw node key.
 *
 * `peer.websocket` is the raw `ws` socket (crossws' Node adapter proxies it),
 * so the original proxy logic — ws.on('message'/'close'), readyState guards,
 * pending-message queue — ports 1:1.
 */
import { defineWebSocketHandler } from 'h3'
import { WebSocket } from 'ws'
import { nitroPrisma, type SessionPayload } from './auth-session'
import { sessionUserId, subUserHasPermission } from './auth'
import { verifyWsToken } from '../../../src/handlers/utils/security/wsToken'
import { mintCapabilityToken } from '../../../src/handlers/utils/security/capabilityToken'
import { daemonRequest, daemonScheme } from '../../../src/handlers/utils/core/daemonRequest'
import logger from '../../../src/handlers/logger'

async function wsScheme(): Promise<'ws' | 'wss'> {
  return (await daemonScheme()) === 'https' ? 'wss' : 'ws'
}

type ProxiedMessage = string | Buffer
type WsMessage = string | Buffer | ArrayBuffer | Buffer[]
type ConsoleProxyMode = 'interactive' | 'readonly'

const CONSOLE_COMMAND_EVENTS = new Set([
  'cmd',
  'command',
  'input',
  'stdin',
  'sendcommand',
])
const MAX_PENDING_CLIENT_MESSAGES = 50

function isOpen(socket: WebSocket): boolean {
  return socket.readyState === WebSocket.OPEN
}

function sendIfOpen(socket: WebSocket, data: string | Buffer): void {
  if (isOpen(socket)) {
    socket.send(data)
  }
}

function sendSocketError(socket: WebSocket, message: string): void {
  sendIfOpen(socket, JSON.stringify({ error: message }))
  socket.close()
}

function normalizeWsMessage(data: WsMessage): ProxiedMessage {
  if (typeof data === 'string') {return data;}
  if (Buffer.isBuffer(data)) {return data;}
  if (Array.isArray(data)) {return Buffer.concat(data);}
  return Buffer.from(data);
}

function extractConsoleCommand(data: WsMessage): string | null {
  const raw = normalizeWsMessage(data).toString('utf8').trim()
  if (!raw) {return null;}

  try {
    const payload = JSON.parse(raw) as {
      event?: string;
      command?: unknown;
      data?: unknown;
      value?: unknown;
      payload?: unknown;
      args?: unknown[];
    }

    const event =
      typeof payload.event === 'string' ? payload.event.toLowerCase() : 'cmd'
    if (!CONSOLE_COMMAND_EVENTS.has(event)) {
      return null
    }

    const candidates = [
      payload.command,
      payload.data,
      payload.value,
      payload.payload,
      payload.args?.[0],
    ]
    for (const candidate of candidates) {
      if (typeof candidate === 'string') {
        const command = candidate.replace(/\r\n?/g, '\n').trim()
        if (command) {return command;}
      }
    }
  } catch {
    return raw
  }

  return null
}

interface ConsoleContext {
  userId: number
  serverId: string
  token: string | null
}

async function proxyConsole(
  ws: WebSocket,
  ctx: ConsoleContext,
  daemonPath: (
    nodeAddress: string,
    nodePort: number,
    serverId: string,
  ) => Promise<string> | string,
  mode: ConsoleProxyMode,
): Promise<void> {
  try {
    const tokenData = verifyWsToken(ctx.token)
    if (!tokenData) {
      sendSocketError(
        ws,
        'Invalid or expired connect token. Refresh the page and try again.',
      )
      return
    }

    const user = await nitroPrisma.users.findUnique({ where: { id: ctx.userId } })
    if (!user?.username) {
      sendSocketError(ws, 'User not found or username missing')
      return
    }

    const serverId = ctx.serverId
    if (!serverId) {
      sendSocketError(ws, 'Server ID is required')
      return
    }

    if (tokenData.serverId !== serverId || tokenData.userId !== ctx.userId) {
      sendSocketError(ws, 'Connect token does not match this session')
      return
    }

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true },
    })
    if (!server) {
      sendSocketError(ws, 'Server not found')
      return
    }

    const { node } = server
    const socket = new WebSocket(
      await daemonPath(node.address, node.port, serverId),
    )
    const pendingClientMessages: ProxiedMessage[] = []
    let clientClosed = false

    // Determine which daemon WS routes this connection needs.
    const daemonRoutes: ('container' | 'containerstatus' | 'containerevents')[] = []
    if (daemonPath.toString().includes('/container/'))
    {daemonRoutes.push('container');}
    if (daemonPath.toString().includes('/containerstatus'))
    {daemonRoutes.push('containerstatus');}
    if (daemonPath.toString().includes('/containerevents'))
    {daemonRoutes.push('containerevents');}
    // Fallback: if we can't determine the route from the function, grant all
    // routes that this panel module uses. The daemon will reject mismatches.
    if (daemonRoutes.length === 0)
    {daemonRoutes.push('container', 'containerstatus', 'containerevents');}

    // Mint a short-lived capability token instead of sending the raw node key.
    const capabilityToken = mintCapabilityToken({
      nodeKey: node.key,
      nodeId: node.id,
      serverId,
      routes: daemonRoutes,
    })

    function flushPendingClientMessages(): void {
      while (pendingClientMessages.length > 0 && isOpen(socket)) {
        const message = pendingClientMessages.shift()
        if (message) {socket.send(message);}
      }
    }

    async function forwardToDaemon(data: WsMessage): Promise<void> {
      if (mode === 'readonly') {return;}

      const command = extractConsoleCommand(data)
      if (command) {
        try {
          await daemonRequest({
            nodeAddress: node.address,
            nodePort: node.port,
            nodeKey: node.key,
            method: 'POST',
            path: '/container/command',
            body: { id: serverId, command },
            timeout: 10_000,
          })
        } catch (error) {
          logger.error(`Failed to send console command to ${serverId}:`, error)
          sendIfOpen(
            ws,
            '\x1b[31;1mCommand failed to reach the daemon. Check panel logs for details.\x1b[0m\r\n',
          )
        }
        return
      }

      const message = normalizeWsMessage(data)
      if (isOpen(socket)) {
        socket.send(message)
        return
      }

      if (socket.readyState === WebSocket.CONNECTING) {
        pendingClientMessages.push(message)
        if (pendingClientMessages.length > MAX_PENDING_CLIENT_MESSAGES) {
          pendingClientMessages.shift()
        }
      }
    }

    socket.onopen = () => {
      socket.send(JSON.stringify({ event: 'auth', args: [capabilityToken] }))
      flushPendingClientMessages()
    }

    socket.onmessage = (msg) => sendIfOpen(ws, normalizeWsMessage(msg.data as WsMessage))

    socket.onerror = () => {
      sendIfOpen(ws, '\x1b[31;1mThis instance is unavailable!\x1b[0m')
    }

    socket.onclose = () => {
      pendingClientMessages.length = 0
      if (!clientClosed && isOpen(ws)) {ws.close();}
    }

    ws.on('message', forwardToDaemon)
    ws.on('close', () => {
      clientClosed = true
      pendingClientMessages.length = 0
      if (socket.readyState === WebSocket.CONNECTING || isOpen(socket)) {
        socket.close()
      }
    })
  } catch (error) {
    logger.error('Error in console proxy:', error)
    sendSocketError(ws, 'Internal server error')
  }
}

/**
 * Builds the crossws handler for one console surface.
 *
 * `gate` is the subuser permission required for interactive use ('console');
 * the read-only surfaces (/status, /events) apply no permission gate —
 * exactly like the Express handlers.
 */
export function defineConsoleSocket(
  daemonPath: (
    nodeAddress: string,
    nodePort: number,
    serverId: string,
  ) => Promise<string> | string,
  mode: ConsoleProxyMode,
  gate: 'console' | null = mode === 'interactive' ? 'console' : null,
) {
  return defineWebSocketHandler((event) => {
    // The 01.session middleware always runs before the WS hooks (the full h3
    // chain executes first), so event.context.session is populated.
    const session = (event.context.session as SessionPayload | undefined) ?? {}
    const userId = session ? sessionUserId(session) : null

    return {
      async open(peer) {
        const ws = peer.websocket as unknown as WebSocket
        const requestUrl = new URL(peer.request.url, 'http://local')
        const serverId = requestUrl.pathname.split('/')[2] ?? ''
        const token = requestUrl.searchParams.get('token')

        // isAuthenticatedForServerWS('id') mirror (serverAuthUtil.ts).
        if (!userId) {
          ws.close()
          return
        }

        try {
          const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
          if (!user) {
            ws.close()
            return
          }

          let subUser: { permissions: string | null } | null = null
          if (!user.isAdmin) {
            const server = await nitroPrisma.server.findUnique({
              where: { UUID: serverId },
              select: { ownerId: true, Suspended: true },
            })

            if (server && server.ownerId === userId) {
              if (server.Suspended) {
                ws.close()
                return
              }
            } else {
              subUser = await nitroPrisma.subUser.findUnique({
                where: { serverId_userId: { serverId, userId } },
              })
              if (!subUser) {
                ws.close()
                return
              }
              if (server?.Suspended) {
                ws.close()
                return
              }
            }
          }

          if (gate && subUser && !subUserHasPermission(subUser, gate)) {
            ws.send(
              JSON.stringify({
                error: 'You do not have permission to access the console.',
              }),
            )
            ws.close()
            return
          }

          await proxyConsole(ws, { userId, serverId, token }, daemonPath, mode)
        } catch (error) {
          logger.error('Error in console access check:', error)
          ws.close()
        }
      },
    }
  })
}

export { wsScheme }
