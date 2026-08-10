import { Router } from 'express';
import type { Module } from '../../handlers/moduleInit';
import { getAllAddons } from '../../handlers/addonHandler';
import { parseAddonManifest, type AddonUIV3Manifest } from '../../handlers/addonManifest';
import logger from '../../handlers/logger';
import path from 'path';
import fs from 'fs';

const ADDONS_DIR = path.join(__dirname, '..', '..', '..', 'storage', 'addons');

/**
 * GET /api/addons/ui
 *
 * Returns the v3 UI manifest entries for every enabled addon that declares a
 * `ui` field. The React frontend reads this on startup to know which bundles
 * to load, which CSS to inject, which slots to populate, and which API paths
 * the addon owns (for proxy configuration).
 *
 * This is additive — addons without a `ui` field are ignored here and continue
 * to work via the v2 EJS-only contract.
 */
const addonUIModule: Module = {
  info: {
    name: 'addon/ui',
    description: 'Addon v3 UI manifest API',
    version: '2.0.0',
    moduleVersion: '2.0.0',
    author: 'Arclight Panel',
    license: 'GPL-3.0',
  },

  router: () => {
    const router = Router();

    router.get('/api/addons/ui', async (_req, res) => {
      try {
        const dbAddons = await getAllAddons();
        const result: AddonUIV3Manifest[] = [];

        for (const dbEntry of dbAddons) {
          if (!dbEntry.enabled) continue;

          const slug = dbEntry.name || dbEntry.slug || '';
          const addonDir = path.join(ADDONS_DIR, slug);
          const pkgPath = path.join(addonDir, 'package.json');

          if (!fs.existsSync(pkgPath)) continue;

          const parsed = parseAddonManifest(pkgPath, slug);
          if (!parsed.success) continue;

          const manifest = parsed.manifest;
          if (!manifest.ui) continue;

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
          });
        }

        res.json({ addons: result });
      } catch (error: any) {
        logger.error('Failed to serve /api/addons/ui:', error?.message ?? error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    return router;
  },
}

export default addonUIModule;