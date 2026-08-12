/**
 * POST /admin/mounts — Nitro twin of the Express handler in
 * src/modules/admin/mounts.ts. Byte-identical (D3): validates name /
 * source / target presence then creates the host bind-mount.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../utils/auth-session'
import { requireAdminGuard } from '../../utils/admin-api'
import { logActivity } from '../../utils/server-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const { name, source, target, readOnly } = body as Record<string, unknown>
  if (!name || typeof name !== 'string' || !name.trim()) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Mount name is required.' }
  }
  if (!source || typeof source !== 'string' || !source.trim()) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Host source path is required.' }
  }
  if (!target || typeof target !== 'string' || !target.trim()) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Container target path is required.' }
  }

  try {
    const mount = await nitroPrisma.mount.create({
      data: {
        name: name.trim(),
        source: source.trim(),
        target: target.trim(),
        readOnly: readOnly === true || readOnly === 'true',
      },
    })
    await logActivity(event, session, 'mount:create', {
      metadata: { mountId: mount.id, name: mount.name },
    })
    return { success: true }
  } catch (error) {
    console.error('Error creating mount:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to create mount.' }
  }
})
