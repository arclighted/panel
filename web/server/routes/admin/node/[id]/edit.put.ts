/**
 * PUT /admin/node/:id/edit — Nitro twin of the Express handler in
 * src/modules/admin/nodes.ts. Byte-identical (D3): the same validation
 * ladder as create, then updates the node, syncs allocations, audits.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { syncNodeAllocations } from '../../../../../../src/handlers/utils/server/allocations'
import { emitRealtime } from '../../../../../../src/handlers/realtime/events'

const UNLIMITED_RESOURCE = 'all'
const MIN_PORT_NUMBER = 1024
const MAX_PORT_NUMBER = 65535
const MIN_NODE_PORT = 1025
const NAME_MIN_LENGTH = 3
const NAME_MAX_LENGTH = 50

const NODE_ADDRESS_REGEX =
  /^(localhost|(?:\d{1,3}\.){3}\d{1,3}|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})$/

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const nodeId = parseInt(getRouterParam(event, 'id') ?? '', 10)

  const parseEditLimit = (v: unknown): number =>
    v === UNLIMITED_RESOURCE || v === 'all'
      ? 0
      : parseFloat(String(v ?? ''))

  const name = body.name
  const ram = parseEditLimit(body.ram)
  const cpu = parseEditLimit(body.cpu)
  const disk = parseEditLimit(body.disk)
  const address = body.address
  const port = parseInt(String(body.port), 10)
  const allocatedPorts = body.allocatedPorts || '[]'
  const overallocateMemory = parseInt(String(body.overallocateMemory), 10)
  const overallocateDisk = parseInt(String(body.overallocateDisk), 10)
  const overallocateCpu = parseInt(String(body.overallocateCpu), 10)
  const locationIdRaw = body.locationId
  const locationId = locationIdRaw ? parseInt(String(locationIdRaw), 10) : null
  let parsedPorts: number[] = []

  if ([overallocateMemory, overallocateDisk, overallocateCpu].some((v) => isNaN(v) || v < 0)) {
    setResponseStatus(event, 400)
    return { message: 'Overallocation percentages must be >= 0.' }
  }

  if (locationId !== null) {
    if (isNaN(locationId)) {
      setResponseStatus(event, 400)
      return { message: 'Selected location is invalid.' }
    }
    const location = await nitroPrisma.location.findUnique({
      where: { id: locationId },
    })
    if (!location) {
      setResponseStatus(event, 400)
      return { message: 'Selected location not found.' }
    }
  }

  if (
    !name ||
    (ram !== 0 && (isNaN(ram) || ram <= 0 || !Number.isInteger(ram))) ||
    (cpu !== 0 && (isNaN(cpu) || cpu <= 0 || !Number.isInteger(cpu))) ||
    (disk !== 0 && (isNaN(disk) || disk <= 0 || !Number.isInteger(disk))) ||
    !address ||
    !port
  ) {
    setResponseStatus(event, 400)
    return {
      message:
        'All fields are required and numeric values must be valid positive numbers (or "all" for unlimited).',
    }
  }

  if (typeof name === 'string' && (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH)) {
    setResponseStatus(event, 400)
    return {
      message: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters long.`,
    }
  }

  if (typeof address !== 'string' || !NODE_ADDRESS_REGEX.test(address)) {
    setResponseStatus(event, 400)
    return { message: 'Address must be a valid IPv4, domain, or localhost.' }
  }

  if (isNaN(port) || port <= MIN_PORT_NUMBER || port > MAX_PORT_NUMBER) {
    setResponseStatus(event, 400)
    return {
      message: `Port must be a number between ${MIN_NODE_PORT} and ${MAX_PORT_NUMBER}.`,
    }
  }

  const existingNode = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
  if (!existingNode) {
    setResponseStatus(event, 404)
    return { message: 'Node not found.' }
  }

  try {
    parsedPorts = JSON.parse(String(allocatedPorts))
    if (!Array.isArray(parsedPorts)) throw new Error('Allocated ports must be an array')
    for (const p of parsedPorts) {
      if (typeof p !== 'number' || p < MIN_PORT_NUMBER || p > MAX_PORT_NUMBER) {
        throw new Error(
          `Each port must be a number between ${MIN_PORT_NUMBER} and ${MAX_PORT_NUMBER}`,
        )
      }
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    setResponseStatus(event, 400)
    return { message: `Invalid allocated ports format: ${message}` }
  }

  try {
    const node = await nitroPrisma.node.update({
      where: { id: nodeId },
      data: {
        name: String(name),
        ram,
        cpu,
        disk,
        overallocateMemory,
        overallocateDisk,
        overallocateCpu,
        locationId,
        address: String(address),
        port,
        allocatedPorts: String(allocatedPorts),
      },
    })

    await syncNodeAllocations(nodeId, parsedPorts).catch(() => {})

    await logActivity(event, session, 'node:update', {
      metadata: { nodeId, name: String(name) },
    })
    emitRealtime({
      type: 'node.updated',
      scope: { admin: true },
      resource: { type: 'node', id: nodeId },
      state: { id: nodeId, name: String(name) },
    })

    return { message: 'Node updated successfully.', node }
  } catch (error) {
    console.error('Error when updating the node:', error)
    setResponseStatus(event, 500)
    return { message: 'Error when updating the node.' }
  }
})
