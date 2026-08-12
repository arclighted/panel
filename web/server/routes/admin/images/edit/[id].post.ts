/**
 * POST /admin/images/edit/:id — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): validates, normalizes,
 * and updates the image. The TanStack UI always sends JSON, so the JSON
 * success body is returned unconditionally.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
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

  const id = Number(getRouterParam(event, 'id'))

  try {
    const { valid, errors } = validateEggData(raw)
    if (!valid) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid image configuration', details: errors }
    }

    const data = normalizeImageData(raw)
    await nitroPrisma.images.update({ where: { id }, data })

    await logActivity(event, session, 'image:update', {
      metadata: { imageId: id, name: data.name },
    })
    return { success: true }
  } catch (error) {
    console.error('Error updating image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update image' }
  }
})
