/**
 * GET /admin/addons/:slug — Nitro twin of the Express handler in
 * src/modules/admin/addons.ts. Byte-identical (D3): addon row + parsed
 * manifest + registered commands + settings map, admin-guarded.
 */
import path from 'node:path'
import { defineEventHandler, getRouterParam, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { commandRegistry } from '../../../../../src/handlers/addonCommands'
import { parseAddonManifest } from '../../../../../src/handlers/addonManifest'
import { containPath } from '../../../../../src/utils/pathSecurity'
import { projectRoot } from '../../../utils/paths'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
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

    const commands = commandRegistry
      .getAddonCommands(slug)
      .map((c) => ({ name: c.name, description: c.description }))

    const allSettings = await nitroPrisma.addonSetting.findMany({
      where: { addonSlug: slug },
    })
    const settingsMap: Record<string, string> = {}
    for (const s of allSettings) settingsMap[s.key] = s.value

    return {
      success: true,
      addon,
      manifest: result.success ? result.manifest : null,
      commands,
      settings: settingsMap,
    }
  } catch (error) {
    console.error('Error fetching addon:', error)
    setResponseStatus(event, 500)
    return { success: false, message: 'Failed to fetch addon' }
  }
})
