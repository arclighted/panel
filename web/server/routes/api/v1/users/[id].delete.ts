/**
 * DELETE /api/v1/users/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.users.delete')
  if (!guard.ok) return guard.response

  try {
    const userId = getParamAsNumber(getRouterParam(event, 'id') ?? '')

    const existing = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    await nitroPrisma.users.delete({ where: { id: userId } })

    await apiAudit(event, 'user:delete', undefined, {
      metadata: { targetEmail: existing.email },
    })
    return { data: { success: true } }
  } catch (error) {
    console.error('Error deleting user:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
