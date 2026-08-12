/**
 * DELETE /api/v1/servers/:id/databases/:dbId — Nitro twin of the Express
 * handler in src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../../utils/external-api'
import { deprovisionDatabase } from '../../../../../../../../src/handlers/utils/core/mysqlProvisioner'
import { safeClientMessage } from '../../../../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const dbId = parseInt(getParamAsString(getRouterParam(event, 'dbId') ?? ''), 10)

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const db = await nitroPrisma.serverDatabase.findUnique({
      where: { id: dbId },
      include: { host: true },
    })
    if (!db || db.serverId !== server.UUID) {
      setResponseStatus(event, 404)
      return { error: 'Database not found.' }
    }

    try {
      await deprovisionDatabase(db.host, db)
      await nitroPrisma.serverDatabase.delete({ where: { id: db.id } })
      await apiAudit(event, 'database:delete', serverId, {
        metadata: { databaseId: db.id },
      })
      return { data: { success: true } }
    } catch (error) {
      console.error('Failed to deprovision database:', error)
      setResponseStatus(event, 502)
      return {
        error: safeClientMessage(
          error,
          'Failed to remove the database from the host.',
        ),
      }
    }
  } catch (error) {
    console.error('Error deleting database:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete database' }
  }
})
