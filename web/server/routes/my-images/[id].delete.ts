/**
 * DELETE /my-images/:id — Nitro twin of the Express handler in
 * src/modules/user/images.ts. Byte-identical (D3): owner-only delete with
 * in-use guard against servers referencing the image.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../utils/auth-session'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const userId = (session as { user?: { id?: unknown } }).user?.id
  if (typeof userId !== 'number') {
    setResponseStatus(event, 401)
    return { error: 'Unauthorized' }
  }

  const id = Number(getRouterParam(event, 'id'))

  try {
    const image = await nitroPrisma.images.findUnique({ where: { id } })
    if (!image) {
      setResponseStatus(event, 404)
      return { error: 'Image not found.' }
    }
    if (image.createdById !== userId) {
      setResponseStatus(event, 403)
      return { error: 'You can only delete images you submitted.' }
    }

    const inUse = await nitroPrisma.server.count({ where: { imageId: image.id } })
    if (inUse > 0) {
      setResponseStatus(event, 400)
      return {
        error: 'This image is in use by a server and cannot be deleted.',
      }
    }

    await nitroPrisma.images.delete({ where: { id: image.id } })
    return { success: true, message: 'Image deleted.' }
  } catch (error) {
    console.error('Failed to delete image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete image.' }
  }
})
