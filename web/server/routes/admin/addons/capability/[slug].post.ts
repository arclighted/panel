/**
 * POST /admin/addons/capability/:slug — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Toggles an addon capability flag (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { logActivity } from '../../../../utils/server-api'

const VALID_CAPABILITIES = [
  'wrapsDashboard',
  'wrapsAdminLayout',
  'runsRawSql',
  'registersSchedules',
]

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
  const { capability, enabled } = body as { capability?: unknown; enabled?: unknown }

  if (typeof capability !== 'string' || !VALID_CAPABILITIES.includes(capability)) {
    setResponseStatus(event, 400)
    return { success: false, message: 'Invalid capability' }
  }
  const enabledBool = enabled === true || enabled === 'true'

  try {
    await nitroPrisma.addonSetting.upsert({
      where: { addonSlug_key: { addonSlug: slug, key: `capability.${capability}` } },
      create: { addonSlug: slug, key: `capability.${capability}`, value: enabledBool ? 'true' : 'false' },
      update: { value: enabledBool ? 'true' : 'false' },
    })
    await logActivity(event, session, 'addon:capability', {
      metadata: { slug, capability, enabled: enabledBool },
    })
    return {
      success: true,
      message: `Capability "${capability}" ${enabledBool ? 'enabled' : 'disabled'}`,
    }
  } catch (error) {
    console.error('Error updating addon capability:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to update addon capability' }
  }
})
