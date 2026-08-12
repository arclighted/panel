/**
 * GET /api/v1/images/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.images.read')
  if (!guard.ok) return guard.response

  try {
    const image = await nitroPrisma.images.findUnique({
      where: { id: getParamAsNumber(getRouterParam(event, 'id') ?? '') },
    })
    if (!image) {
      setResponseStatus(event, 404)
      return { error: 'Image not found' }
    }
    return { data: image }
  } catch (error) {
    console.error('Error fetching image:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
