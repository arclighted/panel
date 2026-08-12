/**
 * POST /server/:id/files/mkdir — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): folder-name and
 * path-safety validation, then daemon /fs/mkdir.
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

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    path?: unknown
    name?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const relativePath = typeof body?.path === 'string' ? body.path : '/'
  const folderName = body?.name

  if (
    typeof folderName !== 'string' ||
    !folderName.trim() ||
    folderName.includes('..')
  ) {
    setResponseStatus(event, 400)
    return { error: 'Invalid folder name.' }
  }
  if (
    typeof relativePath === 'string' &&
    !isPathSafe(relativePath) &&
    relativePath !== '/'
  ) {
    setResponseStatus(event, 400)
    return { error: 'Invalid path.' }
  }

  try {
    if (!serverId) {
      setResponseStatus(event, 400)
      return { error: 'Server ID is required.' }
    }

    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const response = await daemonRequest<{ message?: string }>({
      method: 'POST',
      path: '/fs/mkdir',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: serverId,
        path: relativePath,
        folderName: folderName.trim(),
      },
    })

    if (response.status === 200) {
      return { success: true }
    }
    setResponseStatus(event, response.status)
    return { error: response.data?.message || 'Failed to create folder' }
  } catch (error) {
    console.error('Error creating folder:', error)
    setResponseStatus(event, 502)
    return { error: 'Failed to create folder' }
  }
})
