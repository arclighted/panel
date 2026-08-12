/**
 * POST /server/:id/rename — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): the legacy rename
 * (path + newName, relative-only paths, no '..' and no leading '/').
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { loadApiServer, logActivity } from '../../../utils/server-api'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    path?: unknown
    newName?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const relativePath = body?.path
  const newName = body?.newName

  const isSafe = (p: unknown) =>
    typeof p === 'string' && !p.includes('..') && !p.startsWith('/')
  if (!isSafe(relativePath) || !isSafe(newName)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid path' }
  }

  try {
    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    try {
      await daemonRequest({
        method: 'POST',
        path: '/fs/rename',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        body: {
          id: server.UUID,
          path: relativePath,
          newName,
          newPath: newName,
        },
      })
      await logActivity(event, session, 'file:rename', {
        serverId: String(server.UUID),
        metadata: { path: relativePath, newName },
      })
      setResponseStatus(event, 200)
      return { success: true }
    } catch (error) {
      console.error('Error renaming file:', error)
      setResponseStatus(event, 500)
      return { error: 'Failed to rename file' }
    }
  } catch (error) {
    console.error('Error renaming file:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to rename file' }
  }
})
