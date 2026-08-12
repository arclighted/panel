/**
 * POST /server/:id/files/rename — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): moves a file or
 * directory to a new path (the frontend Move modal posts { oldPath, newPath }).
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
    oldPath?: unknown
    newPath?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const oldPath = body?.oldPath
  const newPath = body?.newPath

  if (
    typeof oldPath !== 'string' ||
    typeof newPath !== 'string' ||
    !isPathSafe(oldPath) ||
    !isPathSafe(newPath)
  ) {
    setResponseStatus(event, 400)
    return { error: 'Invalid path.' }
  }

  try {
    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const response = await daemonRequest<{ message?: string }>({
      method: 'POST',
      path: '/fs/rename',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: server.UUID,
        path: oldPath,
        newName: newPath,
      },
    })

    if (response.status === 200) {
      return { success: true }
    }

    setResponseStatus(event, response.status)
    return { error: daemonMessage(response.data, 'Failed to rename file') }
  } catch (error) {
    console.error('Error renaming file:', error)
    const status = (
      error && typeof error === 'object'
        ? (error as Record<string, unknown>).status
        : 500
    ) as number
    setResponseStatus(event, status || 500)
    return { error: daemonMessage(errorBody(error), 'Failed to rename file') }
  }
})
