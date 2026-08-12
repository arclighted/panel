/**
 * POST /admin/servers/edit/:id — Nitro twin of the Express handler in
 * src/modules/admin/servers.ts. Byte-identical (D3): validates required
 * fields + ports + node capacity, updates the server row, reconciles port
 * claims + mounts, stops the container on newly-suspended servers.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { assertNodeCapacity } from '../../../../../../src/handlers/utils/server/resourceCheck'
import {
  claimNodePorts,
  getNodePortPool,
  releaseServerAllocations,
} from '../../../../../../src/handlers/utils/server/allocations'
import {
  getUsedExternalPorts,
  normalizeServerPorts,
  parseImagePortRequirements,
  serializeServerPorts,
  validatePortAssignments,
} from '../../../../../../src/handlers/utils/server/ports'
import { emitRealtime, serverEvent } from '../../../../../../src/handlers/realtime/events'

const DEFAULT_STOP_COMMAND = 'stop'
const DEFAULT_DATABASE_LIMIT = 5
const DEFAULT_BACKUP_LIMIT = 5
const SUSPENDED_TRUE = 'true'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const serverId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  if (isNaN(serverId)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid server ID' }
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { id: serverId },
      include: { node: true, image: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const {
      name,
      description,
      nodeId,
      imageId,
      Memory,
      Swap,
      Cpu,
      Storage,
      ownerId,
      allowStartupEdit,
      Suspended,
      StartCommand,
      databaseLimit,
      backupLimit,
      backupIgnoreList,
      ports,
    } = body as Record<string, unknown>

    if (!name || !nodeId || !imageId || !Memory || !Cpu || !Storage || !ownerId) {
      setResponseStatus(event, 400)
      return { error: 'Missing required fields' }
    }

    const memInt = parseInt(String(Memory), 10)
    const cpuInt = parseInt(String(Cpu), 10)
    const storageInt = parseInt(String(Storage), 10)
    const swapInt =
      Swap !== undefined && Swap !== ''
        ? Math.max(0, parseInt(String(Swap), 10) || 0)
        : 0
    if (
      isNaN(memInt) ||
      memInt <= 0 ||
      isNaN(cpuInt) ||
      cpuInt <= 0 ||
      isNaN(storageInt) ||
      storageInt <= 0
    ) {
      setResponseStatus(event, 400)
      return { error: 'Memory, CPU, and Storage must be positive integers.' }
    }

    const owner = await nitroPrisma.users.findUnique({
      where: { id: parseInt(String(ownerId), 10) },
    })
    if (!owner) {
      setResponseStatus(event, 400)
      return { error: 'Owner not found' }
    }

    const currentSuspendedState = server.Suspended
    const newSuspendedState = Suspended === SUSPENDED_TRUE
    const suspensionChanged = currentSuspendedState !== newSuspendedState

    const selectedImage = await nitroPrisma.images.findUnique({
      where: { id: parseInt(String(imageId), 10) },
    })
    if (!selectedImage) {
      setResponseStatus(event, 400)
      return { error: 'Image not found' }
    }

    const submittedPorts = normalizeServerPorts(ports)
    const minPorts = parseImagePortRequirements(
      selectedImage.portRequirements,
    ).length
    const pool = await getNodePortPool(parseInt(String(nodeId), 10))
    const existingServers = await nitroPrisma.server.findMany({
      where: { nodeId: parseInt(String(nodeId), 10), NOT: { id: serverId } },
    })
    const portError = validatePortAssignments(
      submittedPorts,
      pool,
      getUsedExternalPorts(existingServers),
      minPorts,
    )
    if (portError) {
      setResponseStatus(event, 400)
      return { error: portError }
    }

    try {
      const capacityNode =
        server.nodeId === parseInt(String(nodeId), 10)
          ? server.node
          : await nitroPrisma.node.findUnique({
            where: { id: parseInt(String(nodeId), 10) },
          })
      if (!capacityNode) {
        setResponseStatus(event, 400)
        return { error: 'Target node not found.' }
      }
      await assertNodeCapacity(capacityNode, memInt, cpuInt, storageInt, server.UUID)
    } catch (error: unknown) {
      setResponseStatus(event, 400)
      return {
        error:
          error instanceof Error ? error.message : 'Node capacity exceeded.',
      }
    }

    await nitroPrisma.server.update({
      where: { id: serverId },
      data: {
        name: String(name),
        description: description as string | null | undefined,
        ownerId: parseInt(String(ownerId), 10),
        nodeId: parseInt(String(nodeId), 10),
        imageId: parseInt(String(imageId), 10),
        Memory: memInt,
        Swap: swapInt,
        Cpu: cpuInt,
        Storage: storageInt,
        StartCommand: StartCommand as string | null | undefined,
        databaseLimit:
          databaseLimit !== undefined && databaseLimit !== ''
            ? Math.max(0, parseInt(String(databaseLimit), 10) || 0)
            : DEFAULT_DATABASE_LIMIT,
        backupLimit:
          backupLimit !== undefined && backupLimit !== ''
            ? Math.max(0, parseInt(String(backupLimit), 10) || 0)
            : DEFAULT_BACKUP_LIMIT,
        backupIgnoreList:
          typeof backupIgnoreList === 'string' ? backupIgnoreList.trim() : '',
        Ports: serializeServerPorts(submittedPorts),
        Suspended: newSuspendedState,
      },
    })
    emitRealtime(
      serverEvent('server.updated', server.UUID, {
        state: { id: server.id, name: String(name), suspended: newSuspendedState },
      }),
    )
    emitRealtime({
      type: 'admin.servers.updated',
      scope: { admin: true },
      state: {},
    })

    await nitroPrisma.$executeRaw`UPDATE "Server" SET "allowStartupEdit" = ${allowStartupEdit === 'true'} WHERE "id" = ${serverId}`

    try {
      if (server.nodeId !== parseInt(String(nodeId), 10)) {
        await releaseServerAllocations(server.UUID)
      }
      await claimNodePorts(
        parseInt(String(nodeId), 10),
        submittedPorts.map((p) => p.externalPort),
        server.UUID,
      )
    } catch (err: unknown) {
      console.error('Error syncing allocation claims:', err)
    }

    if (suspensionChanged && newSuspendedState) {
      try {
        console.info(`Stopping server ${server.UUID} due to suspension`)
        await daemonRequest({
          nodeAddress: server.node.address,
          nodePort: server.node.port,
          nodeKey: server.node.key,
          method: 'POST',
          path: '/container/stop',
          body: {
            id: String(server.UUID),
            stopCmd: server.image?.stop || DEFAULT_STOP_COMMAND,
          },
        })
        await nitroPrisma.server
          .update({
            where: { UUID: String(server.UUID) },
            data: { Running: false },
          })
          .catch(() => {})
      } catch (stopError) {
        console.error(
          `Error stopping server ${server.UUID} during suspension:`,
          stopError,
        )
      }
    }

    await logActivity(event, session, 'server:update', {
      serverId: String(server.UUID),
      metadata: { name: String(name), suspended: newSuspendedState },
    })

    try {
      const rawMountIds = (body as Record<string, unknown>).mountIds
      const nextMountIds: number[] = Array.isArray(rawMountIds)
        ? rawMountIds
          .map((m: unknown) => Number(String(m)).valueOf())
          .filter((v) => Number.isInteger(v))
        : typeof rawMountIds === 'string'
          ? [Number(rawMountIds)].filter((v) => Number.isInteger(v))
          : []
      await nitroPrisma.serverMount.deleteMany({ where: { serverId: server.UUID } })
      if (nextMountIds.length > 0) {
        await nitroPrisma.serverMount.createMany({
          data: nextMountIds.map((mountId: number) => ({
            serverId: server.UUID,
            mountId,
          })),
        })
      }
    } catch (mountError) {
      console.error('Error syncing server mounts:', mountError)
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating server:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update server' }
  }
})
