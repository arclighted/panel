/**
 * POST /server/:id/databases/:dbId/rotate-password — Nitro twin of the
 * Express handler in src/modules/user/server/databases.ts. Byte-identical
 * (D3): rotates the DB password on the host and persists it.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import { loadMutationServer } from '../../../../../utils/server-api'
import { rotateDatabasePassword } from '../../../../../../../src/handlers/utils/core/mysqlProvisioner'
import { safeClientMessage } from '../../../../../../../src/utils/errors'
import { emitRealtime, serverEvent } from '../../../../../../../src/handlers/realtime/events'

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
    const ctx = await loadMutationServer(event, session, serverId, 'database.update')
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
      const newPassword = await rotateDatabasePassword(db.host, db)
      await nitroPrisma.serverDatabase.update({
        where: { id: db.id },
        data: { databasePassword: newPassword },
      })
      emitRealtime(
        serverEvent('database.updated', String(server.UUID), {
          state: { id: db.id, name: db.databaseName },
        }),
      )
      return { success: true, password: newPassword }
    } catch (error) {
      console.error('Failed to rotate database password:', error)
      setResponseStatus(event, 502)
      return {
        error: safeClientMessage(error, 'Failed to rotate the password on the host.'),
      }
    }
  } catch (error) {
    console.error('Error rotating database password:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to rotate database password' }
  }
})
