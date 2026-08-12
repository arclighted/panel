/**
 * POST /api/client/servers/:id/backups — Nitro twin of the Express handler
 * in src/modules/api/client/clientApi.ts. Byte-identical (D3): enforces the
 * per-server backup limit, then creates the backup on the daemon.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireClientApiKey, clientError, resolveServerForUser } from '../../../../../utils/client-api'
import { getParamAsString, apiAudit } from '../../../../../utils/external-api'
import { createBackupBodySchema, type CreateBackupBody } from '../../../../../../../src/modules/api/client/dto'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const guard = await requireClientApiKey(event)
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
    const server = await resolveServerForUser(serverId, guard.userId)
    if (!server) {
      setResponseStatus(event, 404)
      return clientError(event, 'Server not found', 404).response
    }

    const existingBackups = await nitroPrisma.backup.count({
      where: { serverId: server.UUID },
    })
    if (existingBackups >= server.backupLimit) {
      setResponseStatus(event, 400)
      return clientError(event, 'Backup limit reached', 400).response
    }

    const rawBody = (await readBody(event).catch(() => ({}))) as unknown
    const parsed = createBackupBodySchema.safeParse(rawBody)
    if (!parsed.success) {
      setResponseStatus(event, 400)
      return clientError(event, 'name is required').response
    }
    const { name } = parsed.data as CreateBackupBody

    const response = await daemonRequest<{
      success: boolean
      backup: {
        uuid: string
        filePath: string
        size: number
        checksum?: string
      }
    }>({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'POST',
      path: '/container/backup',
      body: { id: server.UUID, name },
      timeout: 120000,
    })

    if (!response.data?.success || !response.data?.backup) {
      setResponseStatus(event, 502)
      return clientError(event, 'Failed to create backup on daemon', 502).response
    }

    const backup = await nitroPrisma.backup.create({
      data: {
        UUID: response.data.backup.uuid,
        name,
        serverId: server.UUID,
        filePath: response.data.backup.filePath,
        size: BigInt(response.data.backup.size),
        checksum: response.data.backup.checksum ?? null,
      },
    })

    await apiAudit(event, 'backup:create', server.UUID, {
      metadata: { name, uuid: backup.UUID, source: 'client-api' },
    })

    return { data: { UUID: backup.UUID, name: backup.name } }
  } catch (err) {
    console.error('Client API: create backup error', err)
    setResponseStatus(event, 500)
    return clientError(event, 'Failed to create backup', 500).response
  }
})
