/**
 * POST /my-images/create — Nitro twin of the Express handler in
 * src/modules/user/images.ts. Byte-identical (D3): submission permission
 * gate, egg validation, name uniqueness, then pending image creation with
 * audit log.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../utils/auth-session'
import { logActivity } from '../../utils/server-api'
import { normalizeImageData } from '../../utils/images-api'
import { validateEggData } from '../../../../src/handlers/utils/egg/eggParser'

async function canSubmitImages(user: {
  id: number
  isAdmin: boolean
}): Promise<boolean> {
  if (user.isAdmin) return true
  const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
  return settings?.allowUserCreateImages === true
}

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

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 401)
      return { error: 'Unauthorized' }
    }
    const allowed = await canSubmitImages(user)
    if (!allowed) {
      setResponseStatus(event, 403)
      return { error: 'Image submissions are not enabled.' }
    }

    const { name, startup, description, author, authorName, dockerImages, variables } =
      body as Record<string, unknown>

    if (!name || !startup) {
      setResponseStatus(event, 400)
      return { error: 'Name and startup command are required.' }
    }

    let parsedDockerImages: unknown = dockerImages
    if (typeof dockerImages === 'string' && dockerImages.trim()) {
      try {
        parsedDockerImages = JSON.parse(dockerImages)
      } catch {
        setResponseStatus(event, 400)
        return { error: 'Docker images must be valid JSON.' }
      }
    }

    let parsedVariables: unknown = variables
    if (typeof variables === 'string' && variables.trim()) {
      try {
        parsedVariables = JSON.parse(variables)
      } catch {
        setResponseStatus(event, 400)
        return { error: 'Variables must be valid JSON.' }
      }
    }

    const raw = {
      name,
      startup,
      description: description || '',
      author: author || '',
      authorName: authorName || '',
      docker_images: parsedDockerImages,
      variables: parsedVariables || [],
    }

    const { valid, errors } = validateEggData(raw)
    if (!valid) {
      setResponseStatus(event, 400)
      return { error: 'Invalid image configuration', details: errors }
    }

    const data = normalizeImageData(raw)

    const existing = await nitroPrisma.images.findFirst({
      where: { name: data.name },
    })
    if (existing) {
      setResponseStatus(event, 409)
      return { error: 'An image with that name already exists.' }
    }

    const image = await nitroPrisma.images.create({
      data: {
        ...data,
        status: 'pending',
        createdById: user.id,
      },
    })
    await logActivity(event, session, 'image:submit', {
      metadata: { imageId: image.id, name: image.name },
    })
    return {
      success: true,
      message: 'Image submitted for review.',
      id: image.id,
    }
  } catch (error) {
    console.error('Error submitting image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to submit image.' }
  }
})
