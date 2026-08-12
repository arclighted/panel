/**
 * POST /server/:id/databases — Nitro twin of the Express handler in
 * src/modules/user/server/databases.ts. Byte-identical (D3): host validity
 * + node-scope check, server + user-level database limits, then provision.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { loadMutationServer, logActivity } from '../../../utils/server-api'
import { provisionDatabase } from '../../../../../src/handlers/utils/core/mysqlProvisioner'
import { safeClientMessage } from '../../../../../src/utils/errors'
import { emitRealtime, serverEvent } from '../../../../../src/handlers/realtime/events'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    hostId?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const { hostId } = body

  try {
    const ctx = await loadMutationServer(event, session, serverId, 'database.create')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const host = await nitroPrisma.databaseHost.findUnique({
      where: { id: parseInt(String(hostId), 10) },
    })
    if (!host) {
      setResponseStatus(event, 400)
      return { error: 'Invalid database host.' }
    }
    if (host.nodeId !== null && host.nodeId !== server.nodeId) {
      setResponseStatus(event, 403)
      return {
        error: "This database host is not available for this server's node.",
      }
    }

    const databaseLimit = server.databaseLimit ?? 0
    if (databaseLimit > 0) {
      const existing = await nitroPrisma.serverDatabase.count({
        where: { serverId: server.UUID },
      })
      if (existing >= databaseLimit) {
        setResponseStatus(event, 400)
        return {
          error: `Database limit reached (${databaseLimit}). Delete an existing database first.`,
        }
      }
    }

    // User-level hard cap — the server owner's total across all their servers.
    const owner = await nitroPrisma.users.findUnique({
      where: { id: server.ownerId },
    })
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    const userMaxDatabases =
      owner?.maxDatabases !== null && owner?.maxDatabases !== undefined
        ? (owner.maxDatabases ?? 0)
        : (settings?.defaultMaxDatabases ?? 0)
    if (userMaxDatabases > 0) {
      const totalOwnerDatabases = await nitroPrisma.serverDatabase.count({
        where: { server: { ownerId: server.ownerId } },
      })
      if (totalOwnerDatabases >= userMaxDatabases) {
        setResponseStatus(event, 400)
        return {
          error: `You have reached your database limit of ${userMaxDatabases} across all servers. Delete an existing database first.`,
        }
      }
    }

    try {
      const credentials = await provisionDatabase(host, server.UUID)
      const db = await nitroPrisma.serverDatabase.create({
        data: {
          serverId: server.UUID,
          hostId: host.id,
          ...credentials,
        },
        include: { host: true },
      })
      await logActivity(event, session, 'database:create', {
        serverId: String(server.UUID),
        metadata: { databaseId: db.id, hostId: host.id },
      })
      emitRealtime(
        serverEvent('database.created', String(server.UUID), {
          state: { id: db.id, name: db.databaseName, hostId: host.id },
        }),
      )
      return { success: true, database: db }
    } catch (error) {
      console.error('Failed to provision database:', error)
      setResponseStatus(event, 502)
      return {
        error: safeClientMessage(error, 'Failed to connect to the database host.'),
      }
    }
  } catch (error) {
    console.error('Error creating database:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create database' }
  }
})
