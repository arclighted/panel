/**
 * POST /admin/addons/settings/:slug — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Applies the manifest settingsSchema against the
 * posted body and upserts addonSetting rows (D3).
 */
import path from 'node:path'
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { parseAddonManifest } from '../../../../../../src/handlers/addonManifest'
import { containPath } from '../../../../../../src/utils/pathSecurity'
import { projectRoot } from '../../../../utils/paths'

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

  try {
    const addon = await nitroPrisma.addon.findUnique({ where: { slug } })
    if (!addon) {
      setResponseStatus(event, 404)
      return { success: false, message: 'Addon not found' }
    }

    const addonsDir = path.join(projectRoot(), 'storage', 'addons')
    const addonDir = path.join(addonsDir, slug)
    if (!containPath(addonsDir, addonDir)) {
      setResponseStatus(event, 400)
      return { success: false, message: 'Invalid addon slug' }
    }
    const packageJsonPath = path.join(addonDir, 'package.json')
    const result = parseAddonManifest(packageJsonPath, slug)
    if (!result.success || !result.manifest.settingsSchema) {
      setResponseStatus(event, 400)
      return { success: false, message: 'Addon has no settings schema' }
    }

    const schema = result.manifest.settingsSchema
    const updates: Record<string, string> = {}

    for (const field of schema) {
      if (field.key in body) {
        const raw = body[field.key]
        let value: string
        if (field.type === 'boolean') {
          value = raw === 'true' || raw === true ? 'true' : 'false'
        } else if (field.type === 'number') {
          const num = Number(raw)
          if (isNaN(num)) continue
          value = String(num)
        } else {
          value = String(raw)
        }
        updates[field.key] = value
      }
    }

    for (const [key, value] of Object.entries(updates)) {
      await nitroPrisma.addonSetting.upsert({
        where: { addonSlug_key: { addonSlug: slug, key } },
        create: { addonSlug: slug, key, value },
        update: { value },
      })
    }

    return { success: true, message: 'Settings saved' }
  } catch (error) {
    console.error('Error saving addon settings:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to save addon settings' }
  }
})
