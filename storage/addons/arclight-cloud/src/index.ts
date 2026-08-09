import { Router } from 'express';
import path from 'path';

const CLOUD_ICON = `<svg class="w-5 h-5 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`;

const DEFAULT_SETTINGS = {
  title: 'Control Panel',
  logo: '/assets/logo.png',
  theme: 'dark',
};

export default async (router: Router, api: any) => {
  const { logger, prisma, security, ui } = api;

  const requireAdmin = security.requireAuth(true);

  ui.addSidebarItem?.({
    id: 'arclight-cloud',
    label: 'Arclight Cloud',
    icon: CLOUD_ICON,
    url: '/arclight-cloud/settings',
    isAdminItem: true,
    priority: 20,
    description: 'Configure Arclight Cloud integration',
  });

  router.get('/settings', requireAdmin, async (req: any, res: any) => {
    try {
      const userId = req.session?.user?.id;
      const user = await prisma.users.findUnique({ where: { id: userId } });
      if (!user) return res.redirect('/login');

      const settings = (await prisma.settings.findUnique({ where: { id: 1 } })) || DEFAULT_SETTINGS;

      res.render(path.join(__dirname, '../views/settings.ejs'), {
        title: 'Arclight Cloud',
        user: req.session?.user,
        req,
        settings,
      });
    } catch (error) {
      logger.error('Error loading Arclight Cloud settings page:', error);
      res.redirect('/admin/overview');
    }
  });

  router.post('/settings', requireAdmin, async (req: any, res: any) => {
    try {
      const { arclightCloudApiKey, arclightCloudBackupEnabled } = req.body || {};

      const data: Record<string, any> = {
        arclightCloudApiKey: arclightCloudApiKey || null,
        arclightCloudBackupEnabled: arclightCloudBackupEnabled === true || arclightCloudBackupEnabled === 'true',
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
