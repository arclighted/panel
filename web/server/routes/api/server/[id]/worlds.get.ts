/**
 * GET /api/server/:id/worlds — Nitro twin of the additive Express handler in
 * src/modules/user/server/worlds.ts. Byte-identical payload (D3): daemon
 * fs-list filtered by isWorld, image features, install state, daemon status
 * and a daemonError message when the fs-list fails.
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
import { requireTabPermission } from '../../../../utils/server-tabs'
import { isWorld } from '../../../../../../src/handlers/features'
import { fsListSchema, parseDaemonResponse } from '../../../../../../src/platform/daemon/dtos'
import { checkForServerInstallation } from '../../../../../../src/handlers/checkForServerInstallation'
import { getServerStatus } from '../../../../../../src/handlers/utils/server/serverStatus'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

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

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const { subUser } = access.value
  const gate = requireTabPermission(event, subUser, 'files')
  if (!gate.ok) {
    return gate.response
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true, image: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const serverStatusInput = getServerStatusInput(server)
    const worlds: { name: string }[] = []
    let daemonError: string | null = null
    try {
      const response = await daemonRequest<unknown>({
        method: 'GET',
        path: '/fs/list',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        params: { id: server.UUID },
      })
      const folders = parseDaemonResponse(fsListSchema, response.data) ?? []
      for (const folder of folders) {
        if (
          folder.type === 'directory' &&
          (await isWorld(folder.name, serverStatusInput))
        ) {
          worlds.push({ name: folder.name })
        }
      }
    } catch {
      daemonError =
        'Failed to fetch worlds. The server may be offline or not responding.'
    }

    const features = getImageFeatures(server.image)
    const serverStatus = await getServerStatus(serverStatusInput)

    return {
      success: true,
      worlds,
      features,
      installed: await checkForServerInstallation(serverId),
      serverStatus,
      daemonError,
    }
  } catch (error) {
    console.error('Error getting worlds:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to load worlds.' }
  }
})
