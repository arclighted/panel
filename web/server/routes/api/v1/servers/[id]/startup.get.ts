/**
 * GET /api/v1/servers/:id/startup — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, getParamAsString } from '../../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.read')
  if (!guard.ok) return guard.response

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: getParamAsString(getRouterParam(event, 'id') ?? '') },
      include: { image: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    let variables: unknown[] = []
    try {
      const parsed = JSON.parse(server.Variables || '[]')
      if (Array.isArray(parsed)) variables = parsed
    } catch {
      // ignore malformed variables
    }

    return {
      data: {
        startCommand: server.StartCommand,
        dockerImage: (() => {
          try {
            const d = JSON.parse(server.dockerImage || '{}')
            return Object.values(d)[0] ?? null
          } catch {
            return null
          }
        })(),
        variables,
      },
    }
  } catch (error) {
    console.error('Error fetching startup:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
