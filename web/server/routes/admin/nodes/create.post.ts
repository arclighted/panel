/**
 * POST /admin/nodes/create — Nitro twin of the Express handler in
 * src/modules/admin/nodes.ts. Byte-identical (D3): the full validation
 * ladder (overallocation >= 0, location, name length, RAM/CPU/disk positive,
 * address regex, port range, allocated ports) then creates the node with a
 * fresh 32-char key and syncs allocations.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, generateApiKey } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'
import { syncNodeAllocations } from '../../../../../src/handlers/utils/server/allocations'
import { emitRealtime } from '../../../../../src/handlers/realtime/events'

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
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const { name, ram, cpu, disk, address, port } = body as Record<string, unknown>
  const locationIdRaw = (body as Record<string, unknown>).locationId
  const locationId = locationIdRaw ? parseInt(String(locationIdRaw), 10) : null

  const parseLimit = (v: unknown): number =>
    v === UNLIMITED_RESOURCE ? 0 : parseFloat(String(v ?? ''))

  const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
  const defOvMem = settings?.defaultOverallocateMemory ?? 0
  const defOvDisk = settings?.defaultOverallocateDisk ?? 0
  const defOvCpu = settings?.defaultOverallocateCpu ?? 0
  const rawOv = (v: unknown, d: number): number =>
    v === undefined ||
    v === null ||
    String(v).trim() === '' ||
    String(v) === UNLIMITED_RESOURCE
      ? d
      : parseFloat(String(v))
  const overallocateMemory = rawOv((body as Record<string, unknown>).overallocateMemory, defOvMem)
  const overallocateDisk = rawOv((body as Record<string, unknown>).overallocateDisk, defOvDisk)
  const overallocateCpu = rawOv((body as Record<string, unknown>).overallocateCpu, defOvCpu)

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

  if (!name || typeof name !== 'string') {
    setResponseStatus(event, 400)
    return { message: 'Name must be a string.' }
  } else if (name.length < NAME_MIN_LENGTH || name.length > NAME_MAX_LENGTH) {
    setResponseStatus(event, 400)
    return {
      message: `Name must be between ${NAME_MIN_LENGTH} and ${NAME_MAX_LENGTH} characters long.`,
    }
  }

  if (
    ram !== 'all' &&
    (!ram || isNaN(parseFloat(String(ram))) || parseFloat(String(ram)) <= 0 || !Number.isInteger(parseFloat(String(ram))))
  ) {
    setResponseStatus(event, 400)
    return { message: 'RAM must be a positive number.' }
  }
  if (
    cpu !== 'all' &&
    (!cpu || isNaN(parseFloat(String(cpu))) || parseFloat(String(cpu)) <= 0 || !Number.isInteger(parseFloat(String(cpu))))
  ) {
    setResponseStatus(event, 400)
    return { message: 'CPU must be a positive number.' }
  }
  if (
    disk !== 'all' &&
    (!disk || isNaN(parseFloat(String(disk))) || parseFloat(String(disk)) <= 0 || !Number.isInteger(parseFloat(String(disk))))
  ) {
    setResponseStatus(event, 400)
    return { message: 'Disk must be a positive number.' }
  }

  if (!address || typeof address !== 'string' || !NODE_ADDRESS_REGEX.test(address)) {
    setResponseStatus(event, 400)
    return { message: 'Address must be a valid IPv4, domain, or localhost.' }
  }

  const portNum = parseInt(String(port), 10)
  if (!port || isNaN(portNum) || portNum <= MIN_PORT_NUMBER || portNum > MAX_PORT_NUMBER) {
    setResponseStatus(event, 400)
    return {
      message: `Port must be a number between ${MIN_NODE_PORT} and ${MAX_PORT_NUMBER}.`,
    }
  }

  const allocatedPorts = (body as Record<string, unknown>).allocatedPorts || '[]'
  let parsedPorts: number[] = []
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
    const key = generateApiKey(32)
    const node = await nitroPrisma.node.create({
      data: {
        name,
        ram: parseLimit(ram),
        cpu: parseLimit(cpu),
        disk: parseLimit(disk),
        overallocateMemory,
        overallocateDisk,
        overallocateCpu,
        locationId,
        address,
        port: portNum,
        key,
        allocatedPorts: String(allocatedPorts),
        createdAt: new Date(),
      },
    })

    await syncNodeAllocations(node.id, parsedPorts).catch(() => {})

    await logActivity(event, session, 'node:create', {
      metadata: { nodeId: node.id, name },
    })
    emitRealtime({
      type: 'node.created',
      scope: { admin: true },
      resource: { type: 'node', id: node.id },
      state: { id: node.id, name },
    })

    return { message: 'Node created successfully.', node }
  } catch (error) {
    console.error('Error when creating the node:', error)
    setResponseStatus(event, 500)
    return { message: 'Error when creating the node.' }
  }
})
