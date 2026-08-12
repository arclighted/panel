/**
 * POST /admin/images/store/install — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): installs an egg from the
 * store (409 on duplicate name).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'
import { validateEggData } from '../../../../../../src/handlers/utils/egg/eggParser'
import { normalizeImageData } from '../../../../utils/images-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const raw = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, raw)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    if (!raw || typeof raw !== 'object') {
      setResponseStatus(event, 400)
      return { error: 'Invalid egg data.' }
    }

    const validated = validateEggData(raw)
    if (!validated.valid) {
      setResponseStatus(event, 400)
      return { error: 'Egg validation failed.', details: validated.errors }
    }

    const normalized = normalizeImageData(raw)

    const existing = await nitroPrisma.images.findFirst({
      where: { name: normalized.name },
    })
    if (existing) {
      setResponseStatus(event, 409)
      return { error: `An image named "${normalized.name}" already exists.` }
    }

    const image = await nitroPrisma.images.create({ data: normalized })
    await logActivity(event, session, 'image:create', {
      metadata: { imageId: image.id, name: image.name },
    })
    return { message: `"${image.name}" installed successfully.`, id: image.id }
  } catch (error) {
    console.error('Error installing image from store:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to install image.' }
  }
})
