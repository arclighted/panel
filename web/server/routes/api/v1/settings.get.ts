/**
 * GET /api/v1/settings — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey } from '../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.settings.read')
  if (!guard.ok) return guard.response

  try {
    const settings = await nitroPrisma.settings.findFirst()

    if (!settings) {
      setResponseStatus(event, 404)
      return { error: 'Settings not found' }
    }

    return { data: settings }
  } catch (error) {
    console.error('Error fetching settings:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
