/**
 * POST /api/v1/servers/:id/backups — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): creates a backup on the
 * daemon, optionally redirecting to Arclight Cloud or S3 when enabled.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../utils/external-api'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'
import { ArclightCloudClient } from '../../../../../../../src/handlers/utils/core/arclightCloud'
import {
  uploadStreamToS3,
  S3_KEY_PREFIX,
} from '../../../../../../../src/handlers/utils/core/s3Client'
import { safeClientMessage } from '../../../../../../../src/utils/errors'

const BACKUP_TIMEOUT_MS = 300_000

function s3KeyFor(serverId: string, uuid: string): string {
  return `backups/${serverId}/${uuid}.tar.gz`
}

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const body = (await readBody(event).catch(() => ({}))) as { name?: string }

  if (!body.name || body.name.trim() === '') {
    setResponseStatus(event, 422)
    return { error: 'Backup name is required' }
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    const isCloudBackupEnabled =
      settings?.arclightCloudBackupEnabled && settings?.arclightCloudApiKey

    const backupCount = await nitroPrisma.backup.count({ where: { serverId } })
    if (server.backupLimit > 0 && backupCount >= server.backupLimit) {
      setResponseStatus(event, 400)
      return { error: `Backup limit reached (${server.backupLimit}).` }
    }

    const response = await daemonRequest<{
      success: boolean
      backup?: { filePath: string; uuid: string; size: number; checksum?: string }
    }>({
      method: 'POST',
      path: '/container/backup',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: serverId,
        name: body.name.trim(),
      },
      timeout: BACKUP_TIMEOUT_MS,
    })

    if (!response.data.success || !response.data.backup) {
      setResponseStatus(event, 502)
      return { error: 'Failed to create backup on daemon' }
    }

    let arclightCloudId: string | null = null
    let filePath = response.data.backup.filePath

    if (isCloudBackupEnabled) {
      try {
        const cloudClient = new ArclightCloudClient(settings!.arclightCloudApiKey!)
        const downloadResponse = await daemonRequest<import('stream').Readable>({
          method: 'GET',
          path: '/container/backup/download',
          nodeAddress: server.node.address,
          nodePort: server.node.port,
          nodeKey: server.node.key,
          params: { backupPath: filePath },
          responseType: 'stream',
        })

        const uniqueCloudFileName = `${serverId}_${response.data.backup.uuid}_${Date.now()}.tar.gz`
        const uploadResult = await cloudClient.uploadFile(
          downloadResponse.data,
          uniqueCloudFileName,
        )

        if (uploadResult && (uploadResult as Record<string, unknown>).id) {
          arclightCloudId = (uploadResult as Record<string, unknown>).id as string
          await daemonRequest({
            method: 'DELETE',
            path: '/container/backup',
            nodeAddress: server.node.address,
            nodePort: server.node.port,
            nodeKey: server.node.key,
            body: { backupPath: filePath },
          }).catch((e) =>
            console.warn(`Failed to delete temporary local backup: ${e}`),
          )
          filePath = 'arclight-cloud'
        }
      } catch (cloudError) {
        console.error('Failed to redirect backup to Arclight Cloud:', cloudError)
      }
    } else if (settings?.s3Enabled) {
      try {
        const downloadResponse = await daemonRequest<import('stream').Readable>({
          method: 'GET',
          path: '/container/backup/download',
          nodeAddress: server.node.address,
          nodePort: server.node.port,
          nodeKey: server.node.key,
          params: { backupPath: filePath },
          responseType: 'stream',
        })
        const s3Key = s3KeyFor(serverId, response.data.backup.uuid)
        await uploadStreamToS3(downloadResponse.data, s3Key)
        await daemonRequest({
          method: 'DELETE',
          path: '/container/backup',
          nodeAddress: server.node.address,
          nodePort: server.node.port,
          nodeKey: server.node.key,
          body: { backupPath: filePath },
        }).catch((e) =>
          console.warn(`Failed to delete temporary local backup: ${e}`),
        )
        filePath = `${S3_KEY_PREFIX}${s3Key}`
      } catch (s3Error) {
        console.error('Failed to redirect backup to S3:', s3Error)
      }
    }

    const backup = await nitroPrisma.backup.create({
      data: {
        UUID: response.data.backup.uuid,
        name: body.name.trim(),
        serverId,
        filePath,
        size: BigInt(response.data.backup.size),
        checksum:
          typeof response.data.backup.checksum === 'string'
            ? response.data.backup.checksum
            : null,
        arclightCloudId,
      },
      select: {
        UUID: true,
        name: true,
        size: true,
        checksum: true,
        locked: true,
        createdAt: true,
      },
    })

    await apiAudit(event, 'backup:create', serverId, {
      metadata: { name: body.name.trim(), uuid: backup.UUID },
    })
    setResponseStatus(event, 201)
    return {
      data: { ...backup, size: backup.size ? backup.size.toString() : '0' },
    }
  } catch (error: unknown) {
    console.error('Error creating backup:', error)
    setResponseStatus(event, 500)
    return { error: safeClientMessage(error, 'Failed to create backup') }
  }
})
