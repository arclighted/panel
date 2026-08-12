/**
 * POST /api/v1/servers/:id/databases — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): host validation + per-node
 * + per-user limits, then MySQL provisioning.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../utils/external-api'
import { provisionDatabase } from '../../../../../../../src/handlers/utils/core/mysqlProvisioner'
import { safeClientMessage } from '../../../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const body = (await readBody(event).catch(() => ({}))) as {
    hostId?: string | number
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const host = await nitroPrisma.databaseHost.findUnique({
      where: { id: parseInt(String(body.hostId), 10) },
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
        return { error: `Database limit reached (${databaseLimit}).` }
      }
    }

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
          error: `You have reached your database limit of ${userMaxDatabases} across all servers.`,
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
        include: { host: { select: { id: true, name: true } } },
      })
      await apiAudit(event, 'database:create', server.UUID, {
        metadata: { databaseId: db.id, hostId: host.id },
      })
      setResponseStatus(event, 201)
      return { data: db }
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
