/**
 * POST /admin/images/approve/:id — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'

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

  try {
    const id = Number(getRouterParam(event, 'id'))
    const image = await nitroPrisma.images.findUnique({ where: { id } })
    if (!image) {
      setResponseStatus(event, 404)
      return { error: 'Image not found.' }
    }

    await nitroPrisma.images.update({
      where: { id },
      data: { status: 'approved', rejectionReason: null },
    })
    await logActivity(event, session, 'image:approve', {
      metadata: { imageId: image.id, name: image.name },
    })
    return { success: true, message: `Approved "${image.name}".` }
  } catch (error) {
    console.error('Error approving image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to approve image.' }
  }
})
