/**
 * POST /server/:id/startup/command — Nitro twin of the Express handler in
 * src/modules/user/server/startup.ts. Byte-identical (D3): allowStartupEdit
 * gate (403 JSON for Accept: application/json, else a 302 with the error
 * query — the React layer always sends the JSON Accept), DB update, and a
 * container restart when the server is running.
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

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    startCommand?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const startCommand = body.startCommand

  console.info(`Updating startup command for server ${serverId}: ${startCommand}`)

  const ctx = await loadApiServer(event, session, serverId, 'startup')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    const allowStartupEdit =
      await nitroPrisma.$queryRaw`SELECT "allowStartupEdit" FROM "Server" WHERE "UUID" = ${serverId}`
    const isEditAllowed =
      allowStartupEdit &&
      Array.isArray(allowStartupEdit) &&
      allowStartupEdit.length > 0 &&
      (allowStartupEdit[0] as { allowStartupEdit?: unknown }).allowStartupEdit === true

    if (!isEditAllowed) {
      console.warn(`Startup command editing not allowed for server ${serverId}`)
      if (acceptsJson(event)) {
        setResponseStatus(event, 403)
        return { error: 'Startup command editing not allowed for this server' }
      }
      return await sendRedirect(
        event,
        `/server/${serverId}/startup?error=true&message=Startup+command+editing+not+allowed+for+this+server`,
        302,
      )
    }

    await nitroPrisma.server.update({
      where: { UUID: serverId },
      data: { StartCommand: startCommand as string },
    })
    console.info(`Startup command updated in database for server ${serverId}`)

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
          setResponseStatus(event, 400)
          return { error: 'Docker image not found.' }
        }
        await restartServerContainer(server, String(serverId), {
          startCommand: startCommand as string,
        })
        console.info(`Container restarted with new startup command: ${serverId}`)
      }
    } catch (statusError) {
      console.warn(`Could not check server status or restart server: ${statusError}`)
    }

    console.info(`Successfully updated startup command for server ${serverId}`)
    if (acceptsJson(event)) {
      setResponseStatus(event, 200)
      return { success: true }
    }
    return await sendRedirect(
      event,
      `/server/${serverId}/startup?success=true&message=Startup+command+updated+successfully`,
      302,
    )
  } catch (error) {
    console.error(`Error updating startup command for server ${serverId}:`, error)
    if (acceptsJson(event)) {
      setResponseStatus(event, 500)
      return { error: 'Failed to update startup command' }
    }
    return await sendRedirect(
      event,
      `/server/${serverId}/startup?error=true&message=Failed+to+update+startup+command`,
      302,
    )
  }
})
