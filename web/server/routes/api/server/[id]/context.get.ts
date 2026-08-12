/**
 * GET /api/server/:id/context — Nitro twin of the Express handler in
 * src/modules/user/server/context.ts. Byte-identical payload (D3): server
 * identity, image features after EULA resolution, install state, initial
 * daemon status, the server nav from the shared UI store, and subuser
 * permission gating. Access control mirrors isAuthenticatedForServer('id').
 *
 * Deviation (documented in docs/tanstack-migration-plan.md): nav comes from
 * the Nitro-side default UI store — addon v2 runtime menu items live in the
 * Express process only until the addon runtime moves into Nitro.
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
import {
  requireServerAccess,
  subUserHasPermission,
} from '../../../../utils/auth'
import { uiComponentStore } from '../../../../utils/ui-store'
import { checkEulaStatus } from '../../../../../../src/handlers/features'
import { checkForServerInstallation } from '../../../../../../src/handlers/checkForServerInstallation'
import { getServerStatus } from '../../../../../../src/handlers/utils/server/serverStatus'
import { getPrimaryExternalPort } from '../../../../../../src/handlers/utils/server/ports'

/** Mirror of getImageFeatures() in src/modules/user/server/shared.ts. */
function getImageFeatures(
  image: { info?: string | null } | null | undefined,
): string[] {
  if (!image) {
    return []
  }
  try {
    const info =
      typeof image.info === 'string' ? JSON.parse(image.info) : image.info
    return Array.isArray(info?.features) ? info.features : []
  } catch {
    return []
  }
}

/** Mirror of getServerStatusInput() in src/modules/user/server/shared.ts. */
function getServerStatusInput(server: {
  UUID: string
  node: { address: string; port: number; key: string }
}) {
  return {
    nodeAddress: server.node.address,
    nodePort: server.node.port,
    serverUUID: server.UUID,
    nodeKey: server.node.key,
  }
}

/** Mirror of resolveNavUrl() in src/modules/user/server/context.ts. */
function resolveNavUrl(
  url: string,
  server: { UUID: string; id: number },
): string {
  return url.replace(':uuid', server.UUID).replace(':id', String(server.id))
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''
  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const { user, subUser } = access.value

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true, image: true, owner: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { success: false, error: 'Server not found.' }
    }

    let features = getImageFeatures(server.image)
    if (features.includes('eula')) {
      const eulaStatus = await checkEulaStatus(server.UUID)
      if (eulaStatus.accepted || eulaStatus.error) {
        features = features.filter((feature) => feature !== 'eula')
      }
    }

    const isSubUser = !!subUser
    const isAdmin = user.isAdmin === true
    const isOwner = server.ownerId === user.id
    let subUserPermissions: string[] = []
    if (subUser?.permissions) {
      try {
        const parsed = JSON.parse(subUser.permissions)
        if (Array.isArray(parsed)) {
          subUserPermissions = parsed.filter(
            (p): p is string => typeof p === 'string',
          )
        }
      } catch {
        subUserPermissions = []
      }
    }

    const nav = uiComponentStore
      .getServerMenuItems()
      .filter((item) => {
        if (item.isAdminItem && !isAdmin) {
          return false
        }
        if (item.ownerOnly && isSubUser) {
          return false
        }
        if (item.feature && !features.includes(item.feature)) {
          return false
        }
        if (
          isSubUser &&
          subUser &&
          Array.isArray(item.permissions) &&
          item.permissions.length > 0 &&
          !item.permissions.some((p) => subUserHasPermission(subUser, p))
        ) {
          return false
        }
        return true
      })
      .sort((a, b) => b.priority - a.priority)
      .map((item) => ({
        id: item.id,
        label: item.label,
        icon: item.icon,
        url: resolveNavUrl(item.url, server),
        group: item.group ?? 'manage',
      }))

    const primaryPort = getPrimaryExternalPort(server.Ports)

    return {
      success: true,
      server: {
        UUID: server.UUID,
        id: server.id,
        name: server.name,
        description: server.description ?? '',
        suspended: server.Suspended,
        installing: server.Installing,
        queued: server.Queued,
        running: server.Running,
        image: server.image?.name ?? 'Unknown',
        node: {
          name: server.node?.name ?? '',
          address: server.node?.address ?? '',
        },
        primaryAddress:
          server.node?.address && primaryPort
            ? `${server.node.address}:${primaryPort}`
            : `${server.node?.address ?? ''}:?`,
        limits: {
          memory: server.Memory,
          cpu: server.Cpu,
          storage: server.Storage,
          swap: server.Swap,
        },
      },
      features,
      installed: await checkForServerInstallation(server.UUID),
      status: await getServerStatus(getServerStatusInput(server)),
      isAdmin,
      isOwner,
      isSubUser,
      subUserPermissions,
      nav,
    }
  } catch (error) {
    console.error('Error loading server context API data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load server.' }
  }
})
