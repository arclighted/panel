/**
 * POST /admin/images/delete/:id — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. The Express original registers DELETE, but
 * the TanStack UI's adminDelete→adminPost helper always sends POST (so the
 * React delete flow currently 404s against Express); this registers POST to
 * match the live frontend contract while keeping the same guard ladder
 * (in-use check → 400, missing → 404, else delete).
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

    const serverCount = await nitroPrisma.server.count({
      where: { imageId: id },
    })
    if (serverCount > 0) {
      setResponseStatus(event, 400)
      return { error: 'This image is in use by one or more servers.' }
    }

    const image = await nitroPrisma.images.findUnique({
      where: { id },
      select: { name: true },
    })
    if (!image) {
      setResponseStatus(event, 404)
      return { error: 'Image not found.' }
    }

    await nitroPrisma.images.delete({ where: { id } })
    await logActivity(event, session, 'image:delete', {
      metadata: { imageId: id, name: image.name },
    })
    return { success: true, message: 'Image deleted successfully.' }
  } catch (error) {
    console.error('Error deleting image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete image.' }
  }
})
