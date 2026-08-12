/**
 * POST /server/:id/zip — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): archives a path or
 * path array into zipname on the daemon.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { loadApiServer } from '../../../utils/server-api'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { normalizePath, isPathSafe } from '../../../../../src/utils/pathSecurity'
import { safeClientMessage } from '../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    relativePath?: string | string[]
    zipname?: string
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  let relativePath: string | string[] = body?.relativePath || '/'
  const zipName = body?.zipname

  if (typeof relativePath === 'string') {
    relativePath = normalizePath(relativePath)
    if (!isPathSafe(relativePath) && relativePath !== '/') {
      setResponseStatus(event, 400)
      return { error: 'Invalid path.' }
    }
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

    // The daemon's /fs/zip accepts either a single path string or an array of
    // paths — pass arrays through as-is instead of stringifying them.
    const zipPaths = Array.isArray(relativePath)
      ? relativePath
      : String(relativePath)

    const response = await daemonRequest<{ message?: string }>({
      method: 'POST',
      path: '/fs/zip',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: serverId,
        path: zipPaths,
        zipname: zipName,
      },
    })

    if (response.status === 200) {
      return { success: true }
    }
    setResponseStatus(event, response.status)
    return { error: response.data?.message || 'Failed to zip files' }
  } catch (error) {
    console.error('Error zipping files:', error)
    setResponseStatus(event, 500)
    return { error: safeClientMessage(error, 'Failed to zip files.') }
  }
})
