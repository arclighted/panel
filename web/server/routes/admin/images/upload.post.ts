/**
 * POST /admin/images/upload — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): validates and saves a
 * full egg payload (create-or-update by name).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'
import { validateEggData } from '../../../../../src/handlers/utils/egg/eggParser'
import { normalizeImageData } from '../../../utils/images-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const raw = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, raw)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    if (!raw || Object.keys(raw).length === 0) {
      setResponseStatus(event, 400)
      return { success: false, error: 'No image data provided' }
    }

    const { valid, errors } = validateEggData(raw)
    if (!valid) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid egg configuration', details: errors }
    }

    const data = normalizeImageData(raw)
    const existing = await nitroPrisma.images.findFirst({
      where: { name: data.name },
    })

    if (existing) {
      await nitroPrisma.images.update({ where: { id: existing.id }, data })
      await logActivity(event, session, 'image:update', {
        metadata: { imageId: existing.id, name: data.name },
      })
      return { success: true, message: 'Image updated successfully', id: existing.id }
    }
    const created = await nitroPrisma.images.create({ data })
    await logActivity(event, session, 'image:create', {
      metadata: { imageId: created.id, name: data.name },
    })
    return { success: true, message: 'Image created successfully', id: created.id }
  } catch (error) {
    console.error('Error processing image upload:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to process the uploaded file' }
  }
})
