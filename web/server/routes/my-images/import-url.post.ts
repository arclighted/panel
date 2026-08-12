/**
 * POST /my-images/import-url — Nitro twin of the Express handler in
 * src/modules/user/images.ts. Byte-identical (D3): fetch egg from URL,
 * validate, uniqueness, then pending image creation with audit log.
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
import {
  fetchEggFromUrl,
  validateEggData,
} from '../../../../src/handlers/utils/egg/eggParser'

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

    const url = String((body as { url?: unknown }).url ?? '').trim()
    if (!url) {
      setResponseStatus(event, 400)
      return { error: 'URL is required.' }
    }

    const result = await fetchEggFromUrl(url)
    if (!result.ok) {
      setResponseStatus(event, 400)
      return { error: result.error }
    }

    const { valid, errors } = validateEggData(result.payload)
    if (!valid) {
      setResponseStatus(event, 400)
      return { error: 'Invalid egg configuration', details: errors }
    }

    const data = normalizeImageData(result.payload)
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
      metadata: { imageId: image.id, name: image.name, source: 'url' },
    })
    return {
      success: true,
      message: 'Image imported and submitted for review.',
      id: image.id,
    }
  } catch (error) {
    console.error('Failed to import image from URL:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to import image from URL.' }
  }
})
