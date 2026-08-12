/**
 * POST /server/:id/startup/variables — Nitro twin of the Express handler in
 * src/modules/user/server/startup.ts. Byte-identical (D3): JSON variables
 * payload validated against the egg's stored rules (never trust the client),
 * persisted, and a container restart when running.
 */
import { defineEventHandler, getRouterParam, readBody, sendRedirect, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer, acceptsJson } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { containerStatusSchema, parseDaemonResponse } from '../../../../../../src/platform/daemon/dtos'
import { restartServerContainer } from '../../../../../../src/modules/user/server/shared'
import { validateVariableRules } from '../../../../../../src/modules/user/server/startup'

interface StartupVariable {
  name: string
  env: string
  type: 'boolean' | 'text' | 'number'
  default: string | number | boolean
  value: string | number | boolean
  rules?: string
  rules_field?: string
  rulesField?: string
  rulesMessage?: string
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    variables?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  // The React layer always sends JSON { variables }; the legacy form-data
  // branch (var_* fields) was consumed only by the EJS pages.
  const variables: StartupVariable[] = Array.isArray(body.variables) ? body.variables : []

  console.info(
    `Updating variables for server ${serverId}: ${JSON.stringify(variables)}`,
  )

  // Validate against the egg's stored rules (never trust the client payload).
  const storedServer = await nitroPrisma.server.findUnique({
    where: { UUID: serverId },
    select: { Variables: true },
  })
  let definitions: StartupVariable[] = []
  if (storedServer?.Variables) {
    try {
      const parsed: unknown = JSON.parse(storedServer.Variables)
      if (Array.isArray(parsed)) {
        definitions = parsed as StartupVariable[]
      }
    } catch {
      console.error('Error parsing stored variables for validation')
    }
  }
  const definitionByEnv = new Map(definitions.map((def) => [def.env, def]))

  const validationErrors = variables
    .map((variable) => {
      const definition = definitionByEnv.get(variable.env)
      const rulesSource =
        definition && typeof definition === 'object'
          ? {
              ...definition,
              rules: definition.rules,
              rulesMessage: definition.rulesMessage,
            }
          : variable
      const error = validateVariableRules(
        rulesSource as StartupVariable,
        String(variable.value ?? ''),
      )
      return error ? { key: variable.env, error } : null
    })
    .filter((entry): entry is { key: string; error: string } => entry !== null)

  if (validationErrors.length > 0) {
    console.warn(
      `Variable validation failed for server ${serverId}: ${JSON.stringify(validationErrors)}`,
    )
    setResponseStatus(event, 400)
    return {
      error: 'Variable validation failed.',
      fields: validationErrors,
    }
  }

  try {
    const ctx = await loadApiServer(event, session, serverId, 'startup')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    await nitroPrisma.server.update({
      where: { UUID: serverId },
      data: { Variables: JSON.stringify(variables) },
    })
    console.info(`Variables updated in database for server ${serverId}`)

    try {
      const statusResponse = await daemonRequest<unknown>({
        method: 'GET',
        path: '/container/status',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        params: { id: serverId },
      })
      const isRunning =
        parseDaemonResponse(containerStatusSchema, statusResponse.data)?.running === true

      if (isRunning) {
        if (!server.dockerImage) {
          console.error(`Docker image not found for server ${serverId}`, new Error('Docker image not found'))
          setResponseStatus(event, 400)
          return { error: 'Docker image not found.' }
        }
        await restartServerContainer(server, String(serverId), {
          variables: variables as never,
        })
        console.info(`Container restarted with new variables: ${serverId}`)
      }
    } catch (statusError) {
      console.warn(`Could not check server status or restart server: ${statusError}`)
    }

    console.info(`Successfully updated variables for server ${serverId}`)
    if (acceptsJson(event)) {
      setResponseStatus(event, 200)
      return { success: true }
    }
    return await sendRedirect(
      event,
      `/server/${serverId}/startup?success=true&message=Server+variables+updated+successfully`,
      302,
    )
  } catch (error) {
    console.error(`Error updating variables for server ${serverId}:`, error)
    if (acceptsJson(event)) {
      setResponseStatus(event, 500)
      return { error: 'Failed to update server variables' }
    }
    return await sendRedirect(
      event,
      `/server/${serverId}/startup?error=true&message=Failed+to+update+server+variables`,
      302,
    )
  }
})
