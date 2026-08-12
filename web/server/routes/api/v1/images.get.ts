/**
 * GET /api/v1/images — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, paginate } from '../../../utils/external-api'

const DEFAULT_PAGE_SIZE = 25

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.images.read')
  if (!guard.ok) return guard.response

  try {
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const perPage = Number(query.per_page) || DEFAULT_PAGE_SIZE

    const images = await nitroPrisma.images.findMany({
      select: {
        id: true,
        UUID: true,
        name: true,
        description: true,
        author: true,
        authorName: true,
        startup: true,
        stop: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return paginate(images, page, perPage)
  } catch (error) {
    console.error('Error fetching images:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
