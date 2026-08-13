/**
 * POST /admin/addons/command/:slug/:command — Nitro twin of the Express
 * handler in src/modules/admin/addons.ts. Executes a registered addon command
 * and records the activity event (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../../utils/admin-api'
import { logActivity } from '../../../../../utils/server-api'
import { commandRegistry } from '../../../../../../../src/handlers/addonCommands'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const slug = getRouterParam(event, 'slug') ?? ''
  const command = getRouterParam(event, 'command') ?? ''
  const args = Array.isArray(body.args)
    ? body.args.filter((a): a is string => typeof a === 'string')
    : []

  try {
    const key = `${slug}:${command}`
    const result = await commandRegistry.execute(key, args)
    await logActivity(event, session, 'addon:command', {
      metadata: { slug, command },
    })
    return { success: true, output: result }
  } catch (error) {
    console.error('Error executing addon command:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to execute addon command' }
  }
})
