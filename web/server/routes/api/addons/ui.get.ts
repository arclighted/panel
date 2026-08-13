/**
 * GET /api/addons/ui — Nitro twin of src/modules/api/addonUi.ts.
 *
 * Returns the v3 UI manifest entries for every enabled addon that declares a
 * `ui` field. The React frontend (web/src/lib/addon-v3/registry.tsx) reads
 * this on startup to know which bundles to load, which CSS to inject, which
 * slots to populate, and which API paths the addon owns. Byte-identical
 * payload (D3): `{ addons: [...] }`.
 */
import fs from 'node:fs'
import path from 'node:path'
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  parseAddonManifest,
  type AddonUIV3Manifest,
} from '../../../../../src/handlers/addonManifest'
import { getAllAddons, getActiveAddonsDir } from '../../../utils/addon-runtime'

export default defineEventHandler(async (event) => {
  try {
    const dbAddons = await getAllAddons()
    const result: AddonUIV3Manifest[] = []
    const addonsDir = getActiveAddonsDir()

    for (const dbEntry of dbAddons) {
      if (!dbEntry.enabled) continue

      const slug = dbEntry.slug || ''
      const addonDir = path.join(addonsDir, slug)
      const pkgPath = path.join(addonDir, 'package.json')

      if (!fs.existsSync(pkgPath)) continue

      const parsed = parseAddonManifest(pkgPath, slug)
      if (!parsed.success) continue

      const manifest = parsed.manifest
      if (!manifest.ui) continue

      result.push({
        slug,
        name: manifest.name,
        version: manifest.version,
        bundles: manifest.ui.bundles,
        css: manifest.ui.css,
        slots: manifest.ui.slots as Record<string, string[]> | undefined,
        routes: manifest.ui.routes,
        adminSidebar: manifest.ui.adminSidebar,
        serverMenu: manifest.ui.serverMenu,
        apiPaths: manifest.ui.apiPaths,
      })
    }

    return { addons: result }
  } catch (error: unknown) {
    console.error(
      'Failed to serve /api/addons/ui:',
      error instanceof Error ? error.message : String(error),
    )
    setResponseStatus(event, 500)
    return { error: 'Internal server error' }
  }
})
