/**
 * POST /server/:id/settings — Nitro twin of the Express handler in
 * src/modules/user/server/settings.ts. Byte-identical (D3): updates the
 * server name + description.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { loadMutationServer } from '../../../utils/server-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    name?: unknown
    description?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const { name, description } = body

  const ctx = await loadMutationServer(event, session, serverId, 'settings')
  if (!ctx.ok) {
    return ctx.response
  }

  try {
    await nitroPrisma.server.update({
      where: { UUID: serverId },
      data: {
        name: name as string,
        description: description as string,
      },
    })
    setResponseStatus(event, 200)
    return { success: true }
  } catch (error) {
    console.error('Error updating server settings:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update server settings' }
  }
})
