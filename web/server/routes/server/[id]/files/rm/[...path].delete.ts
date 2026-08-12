/**
 * DELETE /server/:id/files/rm/{*path} — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical (D3): path-safety check,
 * isWorld detection for logging, daemon /fs/rm, activity log.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  requireCsrf,
  type SessionPayload,
} from '../../../../../utils/auth-session'
import { loadApiServer, logActivity, getServerStatusInput } from '../../../../../utils/server-api'
import { daemonRequest } from '../../../../../../../src/handlers/utils/core/daemonRequest'
import { isPathSafe } from '../../../../../../../src/utils/pathSecurity'
import { isWorld } from '../../../../../../../src/handlers/features'
import { daemonMessage, errorBody } from '../../../../../../../src/utils/errors'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const filePath = getRouterParam(event, 'path') ?? ''

  if (!isPathSafe(filePath)) {
    setResponseStatus(event, 400)
    return { error: 'Invalid file path.' }
  }

  console.info(`Deleting file/directory: ${filePath} from server ${serverId}`)

  try {
    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const isMinecraftWorld = await isWorld(
      filePath,
      getServerStatusInput(server),
    )
    if (isMinecraftWorld) {
      console.info(`Deleting Minecraft world: ${filePath}`)
    }

    try {
      await daemonRequest({
        method: 'DELETE',
        path: '/fs/rm',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        body: {
          id: server.UUID,
          path: filePath,
        },
        timeout: 10000,
      })

      console.info(
        `Successfully deleted ${isMinecraftWorld ? 'world' : 'file/directory'}: ${filePath}`,
      )
      await logActivity(event, session, 'file:delete', {
        serverId: String(server.UUID),
        metadata: { path: filePath },
      })
      return { success: true }
    } catch (deleteError: unknown) {
      const del =
        deleteError && typeof deleteError === 'object'
          ? (deleteError as Record<string, unknown>)
          : {}
      const statusCode = (del.status as number) || 500
      console.error(`Error deleting ${filePath}`, deleteError)
      setResponseStatus(event, statusCode)
      return { error: daemonMessage(errorBody(deleteError), 'Failed to delete file') }
    }
  } catch (error) {
    console.error('Error in file deletion endpoint:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to delete file' }
  }
})
