/**
 * POST /server/:id/files/copy — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): duplicates a file or
 * directory on the daemon (the frontend "Duplicate" action).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { isPathSafe } from '../../../../../../src/utils/pathSecurity'
import { daemonMessage, errorBody } from '../../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    location?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const location = body?.location

  if (typeof location !== 'string' || !location.trim()) {
    setResponseStatus(event, 400)
    return { error: 'Location is required.' }
  }

  const cleanLocation = location.replace(/^\/+/, '')
  if (cleanLocation === '' || !isPathSafe(cleanLocation)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid location.' }
  }

  try {
    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const response = await daemonRequest<{
      message?: string
      path?: string
    }>({
      method: 'POST',
      path: '/fs/copy',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: server.UUID,
        source: cleanLocation,
      },
    })

    if (response.status === 200) {
      setResponseStatus(event, 200)
      return {
        success: true,
        message: response.data?.message,
        path: response.data?.path,
      }
    }

    const data = response.data as { error?: string } | undefined
    setResponseStatus(event, response.status)
    return { error: daemonMessage(data, 'Failed to duplicate file') }
  } catch (error: unknown) {
    console.error('Error duplicating file:', error)
    const status = (
      error && typeof error === 'object'
        ? (error as Record<string, unknown>).status
        : 500
    ) as number
    setResponseStatus(event, status || 500)
    return { error: daemonMessage(errorBody(error), 'Failed to duplicate file') }
  }
})
