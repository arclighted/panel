/**
 * PATCH /api/v1/servers/:id/startup — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): validates the docker image
 * against the image's available list and variables against stored rules.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsString } from '../../../../../utils/external-api'
import { validateVariableRules } from '../../../../../../../src/modules/user/server/startup'
import type { ServerVariable } from '../../../../../../../src/modules/user/server/shared'
import { safeClientMessage } from '../../../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.servers.update')
  if (!guard.ok) return guard.response

  const serverId = getParamAsString(getRouterParam(event, 'id') ?? '')
  const body = (await readBody(event).catch(() => ({}))) as {
    startCommand?: string
    dockerImage?: string
    variables?: unknown[]
  }

  try {
    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true, image: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    const data: Record<string, unknown> = {}

    if (body.startCommand !== undefined) {
      data.StartCommand = body.startCommand
    }

    if (body.dockerImage !== undefined) {
      let valid = false
      let imageObj: Record<string, string> = {}
      let available: string[] = []
      try {
        const arr = JSON.parse(server.image?.dockerImages || '[]')
        if (Array.isArray(arr)) {
          for (const obj of arr) {
            for (const key of Object.keys(obj)) {
              available.push(key)
              if (key === body.dockerImage) {
                valid = true
                imageObj = { [key]: obj[key] }
              }
            }
          }
        }
      } catch {
        available = []
      }
      if (!valid) {
        setResponseStatus(event, 400)
        return { error: 'Invalid Docker image selected' }
      }
      data.dockerImage = JSON.stringify(imageObj)
    }

    if (body.variables !== undefined) {
      if (!Array.isArray(body.variables)) {
        setResponseStatus(event, 400)
        return { error: 'Variables must be an array' }
      }
      // Validate against stored rules before persisting.
      let defs: { env?: string; rules?: string; rulesMessage?: string }[] = []
      try {
        defs = JSON.parse(server.Variables || '[]')
      } catch {
        defs = []
      }
      const defByEnv = new Map(defs.map((d) => [d.env, d]))
      for (const v of body.variables as Array<Record<string, unknown>>) {
        const def = defByEnv.get(String(v.env))
        const rulesSource = def
          ? { ...def, name: def.env, env: def.env, ...v }
          : v
        const err = validateVariableRules(
          rulesSource as unknown as ServerVariable,
          String(v.value ?? ''),
        )
        if (err) {
          setResponseStatus(event, 400)
          return {
            error: 'Variable validation failed.',
            fields: [{ key: v.env, error: err }],
          }
        }
      }
      data.Variables = JSON.stringify(body.variables)
    }

    if (Object.keys(data).length > 0) {
      await nitroPrisma.server.update({ where: { UUID: serverId }, data })
    }

    await apiAudit(event, 'server:update-startup', serverId)
    return { data: { success: true } }
  } catch (error: unknown) {
    console.error('Error updating startup:', error)
    setResponseStatus(event, 500)
    return { error: safeClientMessage(error, 'Failed to update startup') }
  }
})
