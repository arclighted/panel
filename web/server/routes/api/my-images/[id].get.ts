/**
 * GET /api/my-images/:id — Nitro twin of the additive JSON payload in
 * src/modules/user/images.ts consumed by the React my-images edit page.
 * Byte-identical (D3): owner-only, JSON fields parsed from stored strings.
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../utils/auth-session'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
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
      return { error: 'You can only edit images you submitted.' }
    }

    const parseJson = (value: string | null): unknown => {
      if (!value) return []
      try {
        return JSON.parse(value)
      } catch {
        return []
      }
    }

    return {
      success: true,
      image: {
        id: image.id,
        name: image.name,
        description: image.description,
        author: image.author,
        authorName: image.authorName,
        startup: image.startup,
        stop: image.stop,
        status: image.status,
        rejectionReason: image.rejectionReason,
        dockerImages: parseJson(image.dockerImages),
        variables: parseJson(image.variables),
      },
    }
  } catch (error) {
    console.error('Failed to load image for edit:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to load image.' }
  }
})
