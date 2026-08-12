/**
 * DELETE /api/v1/images/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): refuses images in use (409).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.images.delete')
  if (!guard.ok) return guard.response

  try {
    const imageId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
    const serverCount = await nitroPrisma.server.count({ where: { imageId } })
    if (serverCount > 0) {
      setResponseStatus(event, 409)
      return { error: 'This image is in use by one or more servers.' }
    }

    const existing = await nitroPrisma.images.findUnique({
      where: { id: imageId },
      select: { name: true },
    })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Image not found' }
    }

    await nitroPrisma.images.delete({ where: { id: imageId } })
    await apiAudit(event, 'image:delete', undefined, {
      metadata: { imageId, name: existing.name },
    })
    return { data: { success: true } }
  } catch (error) {
    console.error('Error deleting image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete image' }
  }
})
