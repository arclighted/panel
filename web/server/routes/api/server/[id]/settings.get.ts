/**
 * GET /api/server/:id/settings — Nitro twin of the Express handler in
 * src/modules/user/server/tabs.ts (settings tab). Byte-identical payload
 * (D3): server identity + limits, node/image names, the
 * allowUserDeleteServer setting and the auth meta block.
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
    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })

    return {
      success: true,
      server: {
        UUID: server.UUID,
        id: server.id,
        name: server.name,
        description: server.description ?? '',
        createdAt: server.createdAt,
        nodeName: server.node?.name ?? 'Unknown',
        imageName: server.image?.name ?? 'Unknown',
        memory: server.Memory,
        cpu: server.Cpu,
        storage: server.Storage,
        suspended: server.Suspended,
      },
      allowUserDeleteServer: settings?.allowUserDeleteServer === true,
      ...authMeta(user, server.ownerId, subUser),
    }
  } catch (error) {
    console.error('Error loading settings tab data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load settings.' }
  }
})
