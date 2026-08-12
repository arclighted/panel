/**
 * POST /server/:id/unzip — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): extracts zipname
 * into its parent path on the daemon.
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
import { safeClientMessage, daemonMessage } from '../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    relativePath?: string
    zipname?: string
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  let relativePath: string = body?.relativePath || '/'
  const zipName = body?.zipname

  if (typeof relativePath === 'string') {
    relativePath = normalizePath(relativePath)
    if (!isPathSafe(relativePath) && relativePath !== '/') {
      setResponseStatus(event, 400)
      return { error: 'Invalid path.' }
    }
  }

  if (typeof zipName !== 'string' || !zipName.trim()) {
    setResponseStatus(event, 400)
    return { error: 'Zip file name is required' }
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

    const cleanPath = relativePath
      .replace(/\/+/g, '/')
      .replace(/^\/|\/$/g, '')
    const cleanZipName = zipName.replace(/^\/+/, '').replace(/\/+$/, '')

    try {
      const response = await daemonRequest<{ message?: string }>({
        method: 'POST',
        path: '/fs/unzip',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        body: {
          id: serverId,
          path: cleanPath,
          zipname: cleanZipName,
        },
      })

      if (response.status === 200) {
        return { success: true }
      }
      setResponseStatus(event, response.status)
      return { error: daemonMessage(response.data, 'Failed to unzip file') }
    } catch (innerError: unknown) {
      const inner =
        innerError && typeof innerError === 'object'
          ? (innerError as Record<string, unknown>)
          : {}
      console.error('Error during unzip request:', {
        error: innerError,
        response: inner.body,
        status: inner.status,
      })
      setResponseStatus(event, 502)
      return { error: daemonMessage(inner.body, 'Failed to unzip files') }
    }
  } catch (error) {
    console.error('Error unzipping files:', error)
    setResponseStatus(event, 500)
    return { error: safeClientMessage(error, 'Failed to unzip files.') }
  }
})
