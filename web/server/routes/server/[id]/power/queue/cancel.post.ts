/**
 * POST /server/:id/power/queue/cancel — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical (D3): only the owning
 * user or an admin may pull a server off the start queue.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import { requireServerAccess } from '../../../../../utils/auth'
import { runtimeStartQueue } from '../../../../../../../src/handlers/runtimeQueue'

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

  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const userId = (session as { user?: { id?: number } }).user?.id

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      select: { UUID: true, ownerId: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    // Only the owning user or an admin may pull a server off the queue.
    if (server.ownerId !== user.id && !user.isAdmin) {
      setResponseStatus(event, 403)
      return { error: 'You do not own this server.' }
    }

    const removed = await runtimeStartQueue.cancelQueuedStart(server.UUID)
    return { success: true, wasQueued: removed }
  } catch (error) {
    console.error('Error cancelling queued start:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to cancel queued start.' }
  }
})
