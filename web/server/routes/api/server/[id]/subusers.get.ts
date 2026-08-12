/**
 * GET /api/server/:id/subusers — Nitro twin of the Express handler in
 * src/modules/user/server/tabs.ts (subusers tab). Byte-identical payload
 * (D3): subusers with parsed permissions and user identity, the permission
 * labels + groups the React permission UI renders, and owner/admin flags.
 *
 * Owner-only like Express: the owner check replaces the subuser permission
 * gate (non-owners get 403 'Only the server owner can manage subusers.').
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
import { requireServerAccess } from '../../../../utils/auth'
import {
  PERMISSION_GROUPS,
  PERMISSION_LABELS,
  serverPageInclude,
  subUserPermissionsOf,
} from '../../../../utils/server-tabs'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const { user } = access.value

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: serverPageInclude,
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { success: false, error: 'Server not found' }
    }
    if (server.ownerId !== user.id) {
      setResponseStatus(event, 403)
      return { success: false, error: 'Only the server owner can manage subusers.' }
    }

    const subUsers = await nitroPrisma.subUser.findMany({
      where: { serverId: server.UUID },
      include: {
        user: { select: { id: true, username: true, email: true, avatar: true } },
      },
      orderBy: { createdAt: 'asc' },
    })

    return {
      success: true,
      subUsers: subUsers.map((subUser) => ({
        id: subUser.id,
        permissions: subUserPermissionsOf(subUser),
        user: {
          id: subUser.user?.id ?? null,
          username: subUser.user?.username ?? '',
          email: subUser.user?.email ?? '',
          avatar: subUser.user?.avatar ?? null,
        },
      })),
      permissionLabels: PERMISSION_LABELS,
      permissionGroups: PERMISSION_GROUPS,
      isOwner: true,
      isAdmin: user.isAdmin === true,
    }
  } catch (error) {
    console.error('Error loading subusers tab data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load subusers.' }
  }
})
