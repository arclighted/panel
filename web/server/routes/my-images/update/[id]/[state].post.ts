/**
 * POST /my-images/update/:id/:state — Nitro twin of the Express handler in
 * src/modules/user/images.ts. Byte-identical (D3): owner-only update; the
 * edit form posts dockerImages/variables as JSON strings which are parsed
 * before normalization; `published` state resets to pending.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { normalizeImageData } from '../../../../utils/images-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
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
  const state = getRouterParam(event, 'state') ?? ''

  try {
    const targetImage = await nitroPrisma.images.findUnique({ where: { id } })
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }
    if (!targetImage) {
      setResponseStatus(event, 404)
      return { error: 'Image not found.' }
    }
    if (targetImage.createdById !== user.id) {
      setResponseStatus(event, 403)
      return { error: 'You can only edit images you submitted.' }
    }

    // The edit form posts dockerImages/variables as JSON strings.
    const raw: Record<string, unknown> = { ...body }
    for (const key of ['docker_images', 'dockerImages', 'variables']) {
      if (typeof raw[key] === 'string' && (raw[key] as string).trim()) {
        try {
          raw[key] = JSON.parse(raw[key] as string)
        } catch {
          setResponseStatus(event, 400)
          return { error: `${key} must be valid JSON.` }
        }
      }
    }

    const normalized = normalizeImageData(raw)

    const data: Record<string, unknown> = { ...normalized }
    if (state === 'published') {
      data.status = 'pending'
      data.rejectionReason = null
    }

    await nitroPrisma.images.update({
      where: { id: targetImage.id },
      data: data as never,
    })

    return { success: true, message: 'Image updated.' }
  } catch (error) {
    console.error('Failed to update image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update image.' }
  }
})
