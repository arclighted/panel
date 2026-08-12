/**
 * GET /api/admin/playerstats — Nitro twin of the Express handler in
 * src/modules/admin/playerStats.ts. Byte-identical (D3): gathers live
 * player counts from every server's node daemon plus 48h of history.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import {
  daemonPlayerListSchema,
  parseDaemonResponse,
} from '../../../../../src/platform/daemon/dtos'
import { getPrimaryExternalPort } from '../../../../../src/handlers/utils/server/ports'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  if (!requireCsrf(event, session, {})) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const servers = await nitroPrisma.server.findMany({
      include: { node: true },
    })

    const playerData = await Promise.all(
      servers.map(async (server) => {
        try {
          const primaryPort = getPrimaryExternalPort(server.Ports)
          if (!primaryPort) {
            return {
              serverId: server.UUID,
              serverName: server.name,
              playerCount: 0,
              maxPlayers: 0,
              online: false,
              error: 'No primary port found',
            }
          }
          const response = await daemonRequest<unknown>({
            nodeAddress: server.node.address,
            nodePort: server.node.port,
            nodeKey: server.node.key,
            method: 'GET',
            path: '/minecraft/players',
            params: {
              id: server.UUID,
              host: server.node.address,
              port: primaryPort,
            },
            timeout: 5000,
          })
          const playersData =
            parseDaemonResponse(daemonPlayerListSchema, response.data) ?? {}
          return {
            serverId: server.UUID,
            serverName: server.name,
            playerCount: playersData.onlinePlayers || 0,
            maxPlayers: playersData.maxPlayers || 0,
            online: playersData.online || false,
            version: playersData.version || 'Unknown',
          }
        } catch {
          return {
            serverId: server.UUID,
            serverName: server.name,
            playerCount: 0,
            maxPlayers: 0,
            online: false,
            error: 'Failed to fetch player data',
          }
        }
      }),
    )

    const totalPlayers = playerData.reduce((sum, s) => sum + s.playerCount, 0)
    const totalMaxPlayers = playerData.reduce((sum, s) => sum + s.maxPlayers, 0)
    const onlineServers = playerData.filter((s) => s.online).length

    const historicalData = await nitroPrisma.playerStats.findMany({
      orderBy: { timestamp: 'asc' },
      take: 576,
    })

    return {
      servers: playerData,
      totalPlayers,
      totalMaxPlayers,
      onlineServers,
      totalServers: servers.length,
      historicalData,
    }
  } catch (error) {
    console.error('Failed to fetch player statistics:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to fetch player statistics' }
  }
})
