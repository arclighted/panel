/**
 * DELETE /api/v1/servers/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): removes the daemon
 * container (tolerating 404/"not exist") then deletes the row.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../utils/external-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.delete')
  if (!guard.ok) return guard.response

  try {
    const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')

    const existing = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true },
    })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    if (existing.node) {
      try {
        await daemonRequest({
          nodeAddress: existing.node.address,
          nodePort: existing.node.port,
          nodeKey: existing.node.key,
          method: 'DELETE',
          path: '/container',
          body: { id: existing.UUID },
        })
      } catch (err: unknown) {
        const daemonErr = err as { status?: number; body?: { error?: string } }
        const isGone =
          daemonErr.status === 404 ||
          daemonErr.body?.error?.includes('not exist')
        if (!isGone) {
          console.warn(`Could not delete container on daemon: ${err}`)
        }
      }
    }

    await nitroPrisma.server.delete({ where: { UUID: serverId } })

    await apiAudit(event, 'server:delete', serverId, {})
    return { data: { success: true } }
  } catch (error) {
    console.error('Error deleting server:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
