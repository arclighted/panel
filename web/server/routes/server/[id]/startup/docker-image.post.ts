/**
 * POST /server/:id/startup/docker-image — Nitro twin of the Express handler
 * in src/modules/user/server/startup.ts. Byte-identical (D3): validates the
 * selected image against the egg's dockerImages, persists, restarts when
 * running.
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
    dockerImage?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const dockerImage = body.dockerImage

  console.info(`Updating Docker image for server ${serverId} to ${dockerImage}`)

  const ctx = await loadApiServer(event, session, serverId, 'startup')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    let availableDockerImages: string[] = []
    let validImage = false

    try {
      if (server.image && server.image.dockerImages) {
        const dockerImagesArray = JSON.parse(server.image.dockerImages) as Record<string, string>[]
        dockerImagesArray.forEach((imageObj) => {
          Object.keys(imageObj).forEach((key) => {
            availableDockerImages.push(key)
            if (key === dockerImage) {
              validImage = true
            }
          })
        })
      }
    } catch (e) {
      console.error(`Error parsing Docker images for server ${serverId}:`, e)
      availableDockerImages = []
    }

    if (!validImage) {
      console.warn(`Invalid Docker image selected for server ${serverId}: ${dockerImage}`)
      if (acceptsJson(event)) {
        setResponseStatus(event, 400)
        return { error: 'Invalid Docker image selected' }
      }
      return await sendRedirect(
        event,
        `/server/${serverId}/startup?error=true&message=Invalid+Docker+image+selected`,
        302,
      )
    }

    let dockerImageObj: Record<string, string> = {}
    try {
      if (server.image && server.image.dockerImages) {
        const dockerImagesArray = JSON.parse(server.image.dockerImages) as Record<string, string>[]
        for (const imageObj of dockerImagesArray) {
          if (Object.keys(imageObj).includes(dockerImage as string)) {
            dockerImageObj = { [dockerImage as string]: imageObj[dockerImage as string] }
            break
          }
        }
      }
    } catch (e) {
      console.error(`Error finding Docker image object for server ${serverId}:`, e)
    }

    await nitroPrisma.server.update({
      where: { UUID: serverId },
      data: { dockerImage: JSON.stringify(dockerImageObj) },
    })
    console.info(`Docker image updated in database for server ${serverId}`)

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
        await restartServerContainer(server, String(serverId), {
          dockerImage: dockerImage as string,
        })
        console.info(`Container restarted with new Docker image: ${serverId}`)
      }
    } catch (statusError) {
      console.warn(`Could not check server status or restart server: ${statusError}`)
    }

    console.info(`Successfully updated Docker image for server ${serverId}`)
    if (acceptsJson(event)) {
      setResponseStatus(event, 200)
      return { success: true }
    }
    return await sendRedirect(
      event,
      `/server/${serverId}/startup?success=true&message=Docker+image+updated+successfully`,
      302,
    )
  } catch (error) {
    console.error(`Error updating Docker image for server ${serverId}:`, error)
    if (acceptsJson(event)) {
      setResponseStatus(event, 500)
      return { error: 'Failed to update Docker image' }
    }
    return await sendRedirect(
      event,
      `/server/${serverId}/startup?error=true&message=Failed+to+update+Docker+image`,
      302,
    )
  }
})
