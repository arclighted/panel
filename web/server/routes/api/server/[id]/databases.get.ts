/**
 * GET /api/server/:id/databases — Nitro twin of the Express handler in
 * src/modules/user/server/tabs.ts (databases tab). Byte-identical payload
 * (D3): databases with host info, the hosts available to this node, the
 * user's DB limit/count and the auth meta block.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadTabContext, authMeta } from '../../../../utils/server-tabs'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadTabContext(event, session, serverId, 'settings')
  if (!ctx.ok) {
    return ctx.response
  }
  const { user, subUser, server } = ctx.value

  try {
    const [databases, hosts] = await Promise.all([
      nitroPrisma.serverDatabase.findMany({
        where: { serverId: server.UUID },
        include: { host: true },
        orderBy: { createdAt: 'desc' },
      }),
      nitroPrisma.databaseHost.findMany({
        where: {
          OR: [{ nodeId: null }, { nodeId: server.nodeId ?? -1 }],
        },
        orderBy: { id: 'asc' },
      }),
    ])

    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    const owner = await nitroPrisma.users.findUnique({
      where: { id: server.ownerId },
    })
    const userDbLimit =
      owner?.maxDatabases !== null && owner?.maxDatabases !== undefined
        ? (owner.maxDatabases ?? 0)
        : (settings?.defaultMaxDatabases ?? 0)
    const userDbCount = await nitroPrisma.serverDatabase.count({
      where: { server: { ownerId: server.ownerId } },
    })

    return {
      success: true,
      databases: databases.map((db) => ({
        id: db.id,
        databaseName: db.databaseName,
        databaseUser: db.databaseUser,
        databasePassword: db.databasePassword,
        createdAt: db.createdAt,
        host: {
          name: db.host?.name ?? 'Unknown',
          host: db.host?.host ?? '',
          port: db.host?.port ?? 3306,
        },
      })),
      hosts: hosts.map((host) => ({
        id: host.id,
        name: host.name,
        host: host.host,
        port: host.port,
      })),
      userDbLimit,
      userDbCount,
      ...authMeta(user, server.ownerId, subUser),
    }
  } catch (error) {
    console.error('Error loading databases tab data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load databases.' }
  }
})
