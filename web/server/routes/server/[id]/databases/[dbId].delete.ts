/**
 * DELETE /server/:id/databases/:dbId — Nitro twin of the Express handler in
 * src/modules/user/server/databases.ts. Byte-identical (D3): deprovisions
 * the database on the host, then deletes the record.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadMutationServer, logActivity } from '../../../../utils/server-api'
import { deprovisionDatabase } from '../../../../../../src/handlers/utils/core/mysqlProvisioner'
import { safeClientMessage } from '../../../../../../src/utils/errors'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const dbId = parseInt(getRouterParam(event, 'dbId') ?? '', 10)

  try {
    const ctx = await loadMutationServer(event, session, serverId, 'database.delete')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

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
      await logActivity(event, session, 'database:delete', {
        serverId: String(server.UUID),
        metadata: { databaseId: db.id },
      })
      emitRealtime(
        serverEvent('database.deleted', String(server.UUID), {
          state: { id: db.id, name: db.databaseName },
        }),
      )
      return { success: true }
    } catch (error) {
      console.error('Failed to deprovision database:', error)
      setResponseStatus(event, 502)
      return {
        error: safeClientMessage(error, 'Failed to remove the database from the host.'),
      }
    }
  } catch (error) {
    console.error('Error deleting database:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete database' }
  }
})
