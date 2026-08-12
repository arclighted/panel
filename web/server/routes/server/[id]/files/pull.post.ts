/**
 * POST /server/:id/files/pull — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): pulls a file from an
 * http(s) URL onto the daemon (SSRF-guarded to http/https).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer, logActivity } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { safeClientMessage, daemonMessage } from '../../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    url?: unknown
    path?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const url = body?.url
  const path = body?.path

  if (!url || typeof url !== 'string') {
    setResponseStatus(event, 400)
    return { error: 'URL is required' }
  }
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    setResponseStatus(event, 400)
    return { error: 'Invalid URL' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    setResponseStatus(event, 400)
    return { error: 'Only http(s) URLs are allowed' }
  }

  try {
    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const pullResponse = await daemonRequest<{
      success: boolean
      file?: string
      path?: string
      error?: string
    }>({
      method: 'POST',
      path: '/fs/pull',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: server.UUID,
        url,
        path: typeof path === 'string' ? path : '/',
      },
      timeout: 120000,
    })

    if (pullResponse.status !== 200 || !pullResponse.data?.success) {
      setResponseStatus(event, pullResponse.status === 200 ? 400 : pullResponse.status)
      return {
        error: daemonMessage(pullResponse.data, 'Failed to pull file from URL'),
      }
    }

    await logActivity(event, session, 'file:pull', {
      serverId: String(server.UUID),
      metadata: { url, path: pullResponse.data.path ?? '/' },
    })
    return {
      success: true,
      message: 'File pulled successfully',
      file: pullResponse.data.file,
      path: pullResponse.data.path,
    }
  } catch (error: unknown) {
    console.error('Error pulling file from URL:', error)
    setResponseStatus(event, 500)
    return { error: safeClientMessage(error, 'Failed to pull file from URL') }
  }
})
