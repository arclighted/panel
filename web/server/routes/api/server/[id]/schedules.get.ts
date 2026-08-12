/**
 * GET /api/server/:id/schedules — Nitro twin of the Express handler in
 * src/modules/user/server/tabs.ts (schedules tab). Byte-identical payload
 * (D3): schedules with tasks (payloads JSON-parsed), offsets and the auth
 * meta block.
 */
import {
  defineEventHandler,
  getRouterParam,
  setResponseStatus,
} from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../../utils/auth-session'
import { loadTabContext, authMeta } from '../../../../utils/server-tabs'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  const ctx = await loadTabContext(event, session, serverId, 'schedule.read')
  if (!ctx.ok) {
    return ctx.response
  }
  const { user, subUser, server } = ctx.value

  try {
    const schedules = await nitroPrisma.schedule.findMany({
      where: { serverId: server.UUID },
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    return {
      success: true,
      schedules: schedules.map((schedule) => ({
        id: schedule.id,
        name: schedule.name,
        cron: schedule.cron,
        enabled: schedule.enabled,
        timeOffset: schedule.timeOffset ?? 0,
        nextRunAt: schedule.nextRunAt,
        lastRunAt: schedule.lastRunAt,
        tasks: schedule.tasks.map((task) => {
          let payload: Record<string, unknown> = {}
          try {
            const parsed = JSON.parse(task.payload || '{}')
            if (parsed && typeof parsed === 'object') {
              payload = parsed as Record<string, unknown>
            }
          } catch {
            payload = {}
          }
          return {
            id: task.id,
            action: task.action,
            payload,
            timeOffset: task.timeOffset ?? 0,
          }
        }),
      })),
      ...authMeta(user, server.ownerId, subUser),
    }
  } catch (error) {
    console.error('Error loading schedules tab data:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to load schedules.' }
  }
})
