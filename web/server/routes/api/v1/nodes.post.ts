/**
 * POST /api/v1/nodes — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, apiAudit } from '../../../utils/external-api'

const DEFAULT_NODE_PORT = 3001
const DEFAULT_SFTP_PORT = 3003

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.nodes.create')
  if (!guard.ok) return guard.response

  try {
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const { name, address, port, ram, cpu, disk, key, sftpPort } = body

    if (!name || !key) {
      setResponseStatus(event, 422)
      return { error: 'name and key are required' }
    }

    const node = await nitroPrisma.node.create({
      data: {
        name: String(name),
        address: (address as string | undefined) ?? '127.0.0.1',
        port: (port as number | undefined) ?? DEFAULT_NODE_PORT,
        ram: (ram as number | undefined) ?? 0,
        cpu: (cpu as number | undefined) ?? 0,
        disk: (disk as number | undefined) ?? 0,
        key: String(key),
        sftpPort: (sftpPort as number | undefined) ?? DEFAULT_SFTP_PORT,
      },
      select: {
        id: true,
        name: true,
        address: true,
        port: true,
        ram: true,
        cpu: true,
        disk: true,
        createdAt: true,
      },
    })

    await apiAudit(event, 'node:create', undefined, {
      metadata: { name: String(name) },
    })
    setResponseStatus(event, 201)
    return { data: node }
  } catch (error) {
    console.error('Error creating node:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
