/**
 * GET /server/:id/files/list — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical payload (D3): daemon
 * fs-list sorted directories-first, minus the `arclight` dir. The Express
 * handler also renders an EJS rows partial into `html` (legacy, unused by the
 * React file manager — the shape is preserved with an empty string).
 */
import {
  defineEventHandler,
  getQuery,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadApiServer } from '../../../../utils/server-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { fsListSchema, parseDaemonResponse } from '../../../../../../src/platform/daemon/dtos'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadApiServer(event, session, serverId, 'files')
  if (!ctx.ok) {
    return ctx.response
  }
  const { server } = ctx.value

  try {
    let path = getQuery(event)?.path || '/'
    path = typeof path === 'string' ? path : String(path)
    path = path.replace(/\/+/g, '/')

    const filesResponse = await daemonRequest<unknown>({
      method: 'GET',
      path: '/fs/list',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      params: { id: server.UUID, path },
    })

    const files = (
      parseDaemonResponse(fsListSchema, filesResponse.data) ?? []
    ).filter((file) => file.name !== 'arclight')

    files.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') {
        return -1
      }
      if (a.type === 'file' && b.type === 'directory') {
        return 1
      }
      return 0
    })

    return { success: true, files, html: '' }
  } catch (error: unknown) {
    console.error('Error listing files for in-place refresh:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to list files.' }
  }
})
