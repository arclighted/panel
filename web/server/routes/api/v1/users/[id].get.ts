/**
 * GET /api/v1/users/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.users.read')
  if (!guard.ok) return guard.response

  try {
    const userId = getParamAsNumber(getRouterParam(event, 'id') ?? '')

    const user = await nitroPrisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        isAdmin: true,
        description: true,
      },
    })

    if (!user) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    return { data: user }
  } catch (error) {
    console.error('Error fetching user:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
