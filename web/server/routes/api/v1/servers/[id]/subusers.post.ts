/**
 * POST /api/v1/servers/:id/subusers — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const body = (await readBody(event).catch(() => ({}))) as {
    email?: string
    permissions?: unknown
  }

  if (!body.email || typeof body.email !== 'string' || body.email.trim() === '') {
    setResponseStatus(event, 400)
    return { error: 'Email is required' }
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

    const target = await nitroPrisma.users.findUnique({
      where: { email: body.email.trim().toLowerCase() },
    })
    if (!target) {
      setResponseStatus(event, 404)
      return { error: 'No user found with that email.' }
    }

    const existing = await nitroPrisma.subUser.findUnique({
      where: {
        serverId_userId: { serverId: server.UUID, userId: target.id },
      },
    })
    if (existing) {
      setResponseStatus(event, 409)
      return { error: 'That user is already a subuser of this server.' }
    }

    const subUser = await nitroPrisma.subUser.create({
      data: {
        serverId: server.UUID,
        userId: target.id,
        permissions: JSON.stringify(body.permissions),
      },
    })

    await apiAudit(event, 'subuser:create', serverId, {
      metadata: { targetUserId: target.id },
    })
    setResponseStatus(event, 201)
    return {
      data: {
        id: subUser.id,
        user: {
          id: target.id,
          username: target.username,
          email: target.email,
        },
        permissions: body.permissions,
        createdAt: subUser.createdAt,
      },
    }
  } catch (error) {
    console.error('Error adding subuser:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to add subuser' }
  }
})
