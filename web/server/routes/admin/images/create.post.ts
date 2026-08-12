/**
 * POST /admin/images/create — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. The Express version redirects (EJS-era); the
 * TanStack UI calls adminPost expecting JSON, so this returns the image id
 * (matches the shape the React create flow consumes).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const { name, description, author, authorName, startup } = body

    if (!name || !startup) {
      setResponseStatus(event, 400)
      return { error: 'Name and startup command are required' }
    }

    const data = {
      name: String(name),
      description: String(description || ''),
      author: String(author || ''),
      authorName: String(authorName || ''),
      startup: String(startup),
      stop: 'stop',
      startup_done: '',
      config_files: '',
      meta: JSON.stringify({ version: 'AL_V1' }),
      dockerImages: JSON.stringify([]),
      info: JSON.stringify({ features: [] }),
      scripts: JSON.stringify({}),
      variables: JSON.stringify([]),
      portRequirements: JSON.stringify([]),
    }

    const image = await nitroPrisma.images.create({ data })
    await logActivity(event, session, 'image:create', {
      metadata: { imageId: image.id, name: String(name) },
    })
    return { success: true, message: 'Image created successfully', id: image.id }
  } catch (error) {
    console.error('Error creating image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create image.' }
  }
})
