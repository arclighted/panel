/**
 * POST /api/v1/locations — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, apiAudit } from '../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.locations.create')
  if (!guard.ok) return guard.response

  try {
    const body = (await readBody(event).catch(() => ({}))) as {
      name?: string
      shortCode?: string
    }
    const cleanName = typeof body.name === 'string' ? body.name.trim() : ''
    const cleanShortCode =
      typeof body.shortCode === 'string'
        ? body.shortCode.trim().toLowerCase()
        : ''

    if (cleanName.length < 2 || cleanName.length > 50) {
      setResponseStatus(event, 422)
      return { error: 'Name must be between 2 and 50 characters.' }
    }
    if (!/^[a-z0-9-]{2,32}$/.test(cleanShortCode)) {
      setResponseStatus(event, 422)
      return {
        error: 'Short code must be 2-32 chars: lowercase letters, numbers, dashes.',
      }
    }

    const existing = await nitroPrisma.location.findUnique({
      where: { shortCode: cleanShortCode },
    })
    if (existing) {
      setResponseStatus(event, 409)
      return { error: 'A location with this short code already exists.' }
    }

    const location = await nitroPrisma.location.create({
      data: { name: cleanName, shortCode: cleanShortCode },
    })
    await apiAudit(event, 'location:create', undefined, {
      metadata: { locationId: location.id, name: location.name },
    })
    setResponseStatus(event, 201)
    return { data: location }
  } catch (error) {
    console.error('Error creating location:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create location' }
  }
})
