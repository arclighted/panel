/**
 * GET /server/:id/players/data — Nitro twin of the Express handler in
 * src/modules/user/server/players.ts. Byte-identical (D3): daemon
 * Minecraft player query via the external primary port, with the
 * unreachable / no-primary-port shapes.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer, getPrimaryPort } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { daemonPlayerListSchema, parseDaemonResponse } from '../../../../../../src/platform/daemon/dtos'

async function fetchPlayerData(
  server: { UUID: string; Ports: string; node: { address: string; port: number; key: string } },
  primaryPort: number,
): Promise<{
  players: { name: string; uuid: string }[]
  serverInfo: { maxPlayers: number; onlinePlayers: number; version: string }
  serverIsOnline: boolean
  hadFetchError: boolean
}> {
  let players: { name: string; uuid: string }[] = []
  let serverInfo = { maxPlayers: 0, onlinePlayers: 0, version: 'Unknown' }
  let hadFetchError = false
  let serverIsOnline = false

  try {
    const playersResponse = await daemonRequest<unknown>({
      method: 'GET',
      path: '/minecraft/players',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      params: {
        id: server.UUID,
        host: server.node.address,
        port: primaryPort,
      },
      timeout: 8000,
    })

    const playersData = parseDaemonResponse(
      daemonPlayerListSchema,
      playersResponse.data,
    )

    if (playersData) {
      serverIsOnline =
        typeof playersData.online === 'boolean'
          ? playersData.online
          : !!playersData.version
      if (Array.isArray(playersData.players)) {
        players = playersData.players
      }
      serverInfo = {
        maxPlayers: playersData.maxPlayers || 0,
        onlinePlayers: playersData.onlinePlayers || 0,
        version: playersData.version || 'Unknown',
      }
    } else {
      hadFetchError = true
    }
  } catch (error: unknown) {
    const errCode =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code: unknown }).code)
        : undefined
    if (
      errCode !== 'ECONNREFUSED' &&
      errCode !== 'ETIMEDOUT' &&
      errCode !== 'ENOTFOUND'
    ) {
      console.error(
        `Error fetching players from daemon for server ${server.UUID}:`,
        error,
      )
    }
    hadFetchError = true
  }

  return { players, serverInfo, serverIsOnline, hadFetchError }
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadApiServer(event, session, serverId, 'console')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    const primaryPort = getPrimaryPort(server.Ports)
    if (!primaryPort) {
      return {
        serverInfo: null,
        players: [],
        serverIsOnline: false,
        error: 'No primary port found',
      }
    }

    const { players, serverInfo, serverIsOnline, hadFetchError } =
      await fetchPlayerData(server, primaryPort)

    return {
      players,
      serverInfo,
      serverIsOnline,
      error: hadFetchError && !serverIsOnline ? 'unreachable' : null,
    }
  } catch (error) {
    console.error('Error fetching players data:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to get players data' }
  }
})
