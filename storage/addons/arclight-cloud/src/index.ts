import { Router } from 'express';

const CLOUD_ICON = `<svg class="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;

/**
 * JSON-aware admin gate.
 *
 * The v3 UI (React bundle) calls the settings API from a page rendered by the
 * TanStack app, so unauthenticated/forbidden requests must come back as JSON,
 * not as an HTML redirect. Non-API requests keep the redirect behaviour.
 */
function createRequireAdmin(prisma: any) {
  return async (req: any, res: any, next: any) => {
    const userId = req.session?.user?.id;
    if (!userId) {
      if (req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: 'Not authenticated' });
      }
      return res.redirect('/login');
    }

    try {
      const user = await prisma.users.findUnique({ where: { id: userId } });
      if (!user?.isAdmin) {
        return res.status(403).json({ success: false, error: 'Admin required' });
      }
      next();
    } catch {
      res.status(500).json({ success: false, error: 'Auth check failed' });
    }
  };
}

export default async (router: Router, api: any) => {
  const { logger, prisma, ui } = api;

  const requireAdmin = createRequireAdmin(prisma);

  ui.addSidebarItem?.({
    id: 'arclight-cloud',
    label: 'Arclight Cloud',
    icon: CLOUD_ICON,
    url: '/arclight-cloud/settings',
    isAdminItem: true,
    priority: 20,
    description: 'Configure Arclight Cloud integration',
  });

  const loadSettings = async (req: any, res: any) => {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    res.json({
      success: true,
      data: {
        arclightCloudApiKey: settings?.arclightCloudApiKey ?? '',
        arclightCloudBackupEnabled: settings?.arclightCloudBackupEnabled ?? false,
      },
    });
  };

  const saveSettings = async (req: any, res: any) => {
    const { arclightCloudApiKey, arclightCloudBackupEnabled } = req.body || {};

    const data: Record<string, any> = {
      arclightCloudApiKey: arclightCloudApiKey || null,
      arclightCloudBackupEnabled:
        arclightCloudBackupEnabled === true || arclightCloudBackupEnabled === 'true',
    };

    await prisma.settings.upsert({
      where: { id: 1 },
      update: data,
      create: {
        title: 'Arclight',
        ...data,
      },
    });

    res.json({ success: true });
  };

  // v3 API — consumed by the React SettingsPage bundle
  // (storage/addons/arclight-cloud/src/ui-v3/index.tsx). The panel's proxy
  // forwards /arclight-cloud/api/* to Express (see web/proxy.config.ts and
  // web/server/index.mjs).
  router.get('/api/settings', requireAdmin, async (req: any, res: any) => {
    try {
      await loadSettings(req, res);
    } catch (error) {
      logger.error('Error loading Arclight Cloud settings:', error);
      res.status(500).json({ success: false, error: 'Failed to load settings.' });
    }
  });

  router.post('/api/settings', requireAdmin, async (req: any, res: any) => {
    try {
      await saveSettings(req, res);
    } catch (error) {
      logger.error('Error saving Arclight Cloud settings:', error);
      res.status(500).json({ success: false, error: 'Failed to save settings.' });
    }
  });

  // Legacy alias (pre-v3 contract) — the old EJS page posted here. Kept as a
  // thin compatibility shim; the v3 UI uses /api/settings.
  router.post('/settings', requireAdmin, async (req: any, res: any) => {
    try {
      await saveSettings(req, res);
    } catch (error) {
      logger.error('Error saving Arclight Cloud settings:', error);
      res.status(500).json({ success: false, error: 'Failed to save settings.' });
    }
  });

  logger.info('Arclight Cloud addon initialized');

  return {
    onDisable: () => {
      ui.removeSidebarItem?.('arclight-cloud');
    },
    onUninstall: async () => {
      ui.removeSidebarItem?.('arclight-cloud');
    },
  };
};
