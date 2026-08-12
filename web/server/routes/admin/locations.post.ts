/**
 * POST /admin/locations — Nitro twin of the Express handler in
 * src/modules/admin/locations.ts. Byte-identical (D3): validates the name
 * length and short-code pattern, rejects duplicates, returns the created
 * location with its node count.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../utils/auth-session'
import { requireAdminGuard } from '../../utils/admin-api'
import { logActivity } from '../../utils/server-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const shortCode =
      typeof body.shortCode === 'string' ? body.shortCode.trim().toLowerCase() : ''

    if (name.length < 2 || name.length > 50) {
      setResponseStatus(event, 400)
      return { message: 'Name must be between 2 and 50 characters.' }
    }
    if (!/^[a-z0-9-]{2,32}$/.test(shortCode)) {
      setResponseStatus(event, 400)
      return {
        message: 'Short code must be 2-32 chars: lowercase letters, numbers, dashes.',
      }
    }

    const existing = await nitroPrisma.location.findUnique({ where: { shortCode } })
    if (existing) {
      setResponseStatus(event, 400)
      return { message: 'A location with this short code already exists.' }
    }

    const location = await nitroPrisma.location.create({
      data: { name, shortCode },
      include: { _count: { select: { nodes: true } } },
    })

    await logActivity(event, session, 'location:create', {
      metadata: { locationId: location.id, name },
    })

    return { message: 'Location created successfully.', location }
  } catch (error) {
    console.error('Error creating location:', error)
    setResponseStatus(event, 500)
    return { message: 'Error creating location.' }
  }
})
