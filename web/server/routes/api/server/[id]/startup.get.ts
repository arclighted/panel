/**
 * GET /api/server/:id/startup — Nitro twin of the Express handler in
 * src/modules/user/server/tabs.ts (startup tab). Byte-identical payload
 * (D3): start command + edit flag, the current Docker image, the image's
 * available Docker images, the parsed startup variables and the auth meta
 * block.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadTabContext, authMeta } from '../../../../utils/server-tabs'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadTabContext(event, session, serverId, 'startup')
  if (!ctx.ok) {
    return ctx.response
  }
  const { user, subUser, server } = ctx.value

  try {
    let variables: unknown[] = []
    if (server.Variables) {
      try {
        const parsed: unknown = JSON.parse(server.Variables)
        if (Array.isArray(parsed)) {
          variables = parsed
        }
      } catch {
        variables = []
      }
    }

    let currentDockerImage = ''
    try {
      const obj = JSON.parse(server.dockerImage || '{}') as Record<string, unknown>
      currentDockerImage = Object.keys(obj)[0] ?? ''
    } catch {
      currentDockerImage = ''
    }

    let availableDockerImages: string[] = []
    try {
      if (server.image?.dockerImages) {
        const arr = JSON.parse(server.image.dockerImages) as Record<string, string>[]
        for (const imageObj of arr) {
          for (const key of Object.keys(imageObj)) {
            availableDockerImages.push(key)
          }
        }
      }
    } catch {
      availableDockerImages = []
    }

    return {
      success: true,
      server: {
        UUID: server.UUID,
        startCommand: server.StartCommand ?? '',
        allowStartupEdit: server.allowStartupEdit === true,
      },
      currentDockerImage,
      availableDockerImages,
      variables,
      ...authMeta(user, server.ownerId, subUser),
    }
  } catch (error) {
    console.error('Error loading startup tab data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load startup.' }
  }
})
