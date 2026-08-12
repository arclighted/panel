/**
 * GET /api/server/:id/backups — Nitro twin of the Express handler in
 * src/modules/user/server/tabs.ts (backups tab). Byte-identical payload
 * (D3): backup rows with size as a string, plus the auth meta block.
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

  const ctx = await loadTabContext(event, session, serverId, 'backups')
  if (!ctx.ok) {
    return ctx.response
  }
  const { user, subUser, server } = ctx.value

  try {
    const backups = await nitroPrisma.backup.findMany({
      where: { serverId: server.UUID },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      backups: backups.map((backup) => ({
        UUID: backup.UUID,
        name: backup.name,
        size: backup.size?.toString() ?? '0',
        checksum: backup.checksum,
        locked: backup.locked,
        createdAt: backup.createdAt,
      })),
      ...authMeta(user, server.ownerId, subUser),
    }
  } catch (error) {
    console.error('Error loading backups tab data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load backups.' }
  }
})
