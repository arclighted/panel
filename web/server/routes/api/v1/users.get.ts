/**
 * GET /api/v1/users — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): paginated user list via
 * Bearer API key with the users.read permission.
 */
import { defineEventHandler, getQuery, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, paginate } from '../../../utils/external-api'

const DEFAULT_PAGE_SIZE = 25

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.users.read')
  if (!guard.ok) return guard.response

  try {
    const query = getQuery(event)
    const page = Number(query.page) || 1
    const perPage = Number(query.per_page) || DEFAULT_PAGE_SIZE

    const users = await nitroPrisma.users.findMany({
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        description: true,
      },
    })

    return paginate(users, page, perPage)
  } catch (error) {
    console.error('Error fetching users:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
