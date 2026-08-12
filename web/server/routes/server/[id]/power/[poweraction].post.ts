/**
 * POST /server/:id/power/:poweraction — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical behavior (D3): start /
 * stop / restart with the suspended + maintenance gates, the capacity-aware
 * start queue (202 when queued), and the optimistic stopping state.
 */
import {
  defineEventHandler,
  getRouterParam,
  readBody,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { requireServerAccess } from '../../../../utils/auth'
import { requireTabPermission } from '../../../../utils/server-tabs'
import { logActivity } from '../../../../utils/server-api'
import { safeClientMessage } from '../../../../../../src/utils/errors'
import { runtimeStartQueue, QueueBannedError } from '../../../../../../src/handlers/runtimeQueue'
import { stopServerContainer } from '../../../../../../src/modules/user/server/shared'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

const STOP_STATE_TTL_MS = 120_000
const RESTART_DELAY_MS = 2_000

/** Mirror of global.serverStoppingStates used by the Express stop handler. */
function setStoppingState(serverId: string, value: boolean): void {
  const g = globalThis as Record<string, unknown>
  const states = (g.serverStoppingStates ??
    {}) as Record<string, boolean>
  if (value) {
    states[`server_stopping_${serverId}`] = true
    g.serverStoppingStates = states
    setTimeout(() => {
      const cur = (g.serverStoppingStates ?? {}) as Record<string, boolean>
      delete cur[`server_stopping_${serverId}`]
    }, STOP_STATE_TTL_MS)
  } else {
    delete states[`server_stopping_${serverId}`]
  }
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  // Express runs global doubleCsrfProtection before any route middleware —
  // CSRF failure is a 403 before the handler logic runs.
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  const powerAction = getRouterParam(event, 'poweraction') ?? ''

  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const { subUser } = access.value
  const gate = requireTabPermission(event, subUser, 'console')
  if (!gate.ok) {
    return gate.response
  }
  const userId = (session as { user?: { id?: number } }).user?.id

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 401)
      return { error: 'User not found.' }
    }

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true, image: true, owner: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found.' }
    }

    if (server.Suspended && (powerAction === 'start' || powerAction === 'restart')) {
      console.warn(`Attempt to start suspended server ${serverId} by user ${userId}`)
      setResponseStatus(event, 403)
      return {
        error: 'This server is suspended. Please contact an administrator for assistance.',
      }
    }

    if (
      server.node?.maintenanceMode &&
      (powerAction === 'start' || powerAction === 'restart')
    ) {
      console.warn(
        `Attempt to start server ${serverId} on node ${server.node.id} in maintenance mode by user ${userId}`,
      )
      setResponseStatus(event, 403)
      return {
        error: 'This server is on a node under maintenance. Please try again later.',
      }
    }

    if (powerAction === 'stop') {
      const stoppingStatus = {
        online: true,
        starting: false,
        stopping: true,
        uptime: null,
        startedAt: null,
      }
      setStoppingState(serverId, true)
      setResponseStatus(event, 200)

      // Optimistic 200 with the stopping state is returned immediately — the
      // daemon stop continues in the background exactly like Express (which
      // flushes res.json() and then keeps running the async tail).
      const responseBody = {
        success: true,
        message: 'Server is stopping...',
        status: stoppingStatus,
      }
      void (async () => {
        try {
          await daemonRequest({
            method: 'POST',
            path: '/container/stop',
            nodeAddress: server.node.address,
            nodePort: server.node.port,
            nodeKey: server.node.key,
            body: {
              id: String(serverId),
              stopCmd: server.image?.stop || 'stop',
            },
          })
          console.info(`Container stopped successfully: ${serverId}`)
          await nitroPrisma.server
            .update({ where: { UUID: String(serverId) }, data: { Running: false } })
            .catch(() => {})
          runtimeStartQueue.cleanCapacityFreed().catch(() => undefined)
          await logActivity(event, session, 'server:stop', { serverId: String(serverId) })
        } catch (stopError: unknown) {
          const stopErr = stopError as { status?: number } | undefined
          if (stopErr?.status === 404) {
            console.info(`Container already stopped or not found: ${serverId}`)
            await nitroPrisma.server
              .update({ where: { UUID: String(serverId) }, data: { Running: false } })
              .catch(() => {})
            runtimeStartQueue.cleanCapacityFreed().catch(() => undefined)
            setStoppingState(serverId, false)
          } else {
            console.warn('Failed to stop container', {
              serverId: String(serverId),
              action: 'stop',
              error: stopError,
            })
          }
        }
      })()

      return responseBody
    }

    if (powerAction !== 'start' && powerAction !== 'stop' && powerAction !== 'restart') {
      console.error('Invalid power action:', powerAction)
      setResponseStatus(event, 400)
      return { error: `Invalid power action: ${powerAction}` }
    }

    if (powerAction === 'restart') {
      try {
        await stopServerContainer(server, String(serverId), 'stop', { releaseResources: false })
      } catch {
        // Container may already be stopped
      }

      try {
        await new Promise((resolve) => setTimeout(resolve, RESTART_DELAY_MS))
        const q = await runtimeStartQueue.enqueueStart({
          serverId: String(serverId),
          userId: user.id,
          priority: user.isAdmin === true || server.ownerId === user.id || user.role === 'privileged',
        })
        if (q.queued) {
          setResponseStatus(event, 202)
          return {
            queued: true,
            position: q.position,
            message: `Server queued to restart (position ${q.position}).`,
          }
        }
      } catch (error) {
        if (error instanceof QueueBannedError) {
          setResponseStatus(event, 403)
          return { error: error.message }
        }
        if (error instanceof Error && error.message === 'Server not found.') {
          setResponseStatus(event, 404)
          return { error: 'Server not found.' }
        }
        throw error
      }

      console.info(`Container restart queued successfully: ${serverId}`)
      await logActivity(event, session, 'server:restart', { serverId: String(serverId) })
      setResponseStatus(event, 200)
      return { success: true, message: 'Server restarted successfully' }
    }

    try {
      const q = await runtimeStartQueue.enqueueStart({
        serverId: String(serverId),
        userId: user.id,
        priority: user.isAdmin === true || server.ownerId === user.id || user.role === 'privileged',
      })
      if (q.queued) {
        await logActivity(event, session, 'server:start', {
          serverId: String(serverId),
          metadata: { queued: true, position: q.position },
        })
        setResponseStatus(event, 202)
        return {
          queued: true,
          position: q.position,
          message: `Server queued to start (position ${q.position}).`,
        }
      }
      await logActivity(event, session, 'server:start', { serverId: String(serverId) })
      setResponseStatus(event, 200)
      return { message: 'Container is starting.' }
    } catch (error) {
      if (error instanceof QueueBannedError) {
        setResponseStatus(event, 403)
        return { error: error.message }
      }
      if (error instanceof Error && error.message === 'Server not found.') {
        setResponseStatus(event, 404)
        return { error: 'Server not found.' }
      }
      throw error
    }
  } catch (error) {
    console.error('Failed to process power action', error, {
      serverId: String(serverId),
      action: String(powerAction),
    })
    setResponseStatus(event, 500)
    return { error: safeClientMessage(error, 'Failed to process power action.') }
  }
})
