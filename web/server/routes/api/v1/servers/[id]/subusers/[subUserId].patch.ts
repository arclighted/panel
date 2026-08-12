/**
 * PATCH /api/v1/servers/:id/subusers/:subUserId — Nitro twin of the Express
 * handler in src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const subUserId = parseInt(
    getParamAsString(getRouterParam(event, 'subUserId') ?? ''),
    10,
  )
  const body = (await readBody(event).catch(() => ({}))) as {
    permissions?: unknown
  }

  if (!Array.isArray(body.permissions)) {
    setResponseStatus(event, 400)
    return { error: 'Permissions must be an array' }
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const subUser = await nitroPrisma.subUser.findFirst({
      where: { id: subUserId, serverId: server.UUID },
    })
    if (!subUser) {
      setResponseStatus(event, 404)
      return { error: 'Subuser not found' }
    }

    await nitroPrisma.subUser.update({
      where: { id: subUser.id },
      data: { permissions: JSON.stringify(body.permissions) },
    })

    await apiAudit(event, 'subuser:update', serverId, {
      metadata: { subUserId },
    })
    return { data: { success: true, permissions: body.permissions } }
  } catch (error) {
    console.error('Error updating subuser permissions:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update subuser permissions' }
  }
})
