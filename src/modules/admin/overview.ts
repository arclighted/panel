import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Module } from '../../handlers/moduleInit';
import prisma from '../../db';
import { isAuthenticated } from '../../handlers/utils/auth/authUtil';
import logger from '../../handlers/logger';
import rateLimit from 'express-rate-limit';
import { checkForUpdates, performUpdate } from '../../handlers/updater';
import { registerPermission } from '../../handlers/permissions';
import { getClientIp } from '../../utils/ip';
import fs from 'fs';
import path from 'path';


registerPermission('arclight.admin.overview.main');
registerPermission('arclight.admin.overview.checkForUpdates');
registerPermission('arclight.admin.overview.performUpdate');

interface ErrorMessage {
  message?: string;
}

// Rate limit for expensive admin routes (file system access, update checks/runs).
// 100 requests per 15 minutes per IP before a 429.
const adminOverviewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' },
  keyGenerator: (req) => getClientIp(req),
  validate: false,
});

const adminModule: Module = {
  info: {
    name: 'Admin Module',
    description: 'This file is for admin functionality.',
    version: '2.0.0',
    moduleVersion: '1.0.0',
    author: 'Arclight',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    router.get(
      '/admin/overview',
      adminOverviewLimiter,
      isAuthenticated(true, 'arclight.admin.overview.main'),
      async (req: Request, res: Response) => {
        const errorMessage: ErrorMessage = {};

        try {
          const userId = req.session?.user?.id;
          const user = await prisma.users.findUnique({ where: { id: userId } });
          if (!user) {
            return res.redirect('/login');
          }

          const userCount = await prisma.users.count();
          const nodeCount = await prisma.node.count();
          const instanceCount = await prisma.server.count();
          const imageCount = await prisma.images.count();
          const settings = await prisma.settings.findUnique({
            where: { id: 1 },
          });

          let arclightCodename = String(res.locals.arclightCodename || '');

          try {
            const configPath = path.join(process.cwd(), 'storage', 'config.json');
            if (fs.existsSync(configPath)) {
              const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
              if (cfg && cfg.meta && cfg.meta.codename) {
                arclightCodename = String(cfg.meta.codename);
              }
            }
          } catch (error: unknown) {
            logger.error('Error reading storage/config.json for codename:', error);
          }

          res.render('admin/overview/overview', {
            errorMessage,
            user,
            userCount,
            instanceCount,
            nodeCount,
            imageCount,
            req,
            settings,
            arclightVersion: res.locals.arclightVersion,
            arclightCodename,
          });
        } catch (error: unknown) {
          logger.error('Error fetching user:', error);
          return res.redirect('/login');
        }
      },
    );



    router.get(
      '/admin/check-update',
      adminOverviewLimiter,
      isAuthenticated(true, 'arclight.admin.overview.checkForUpdates'),
      async (_req: Request, res: Response) => {
        try {
          const updateInfo = await checkForUpdates();
          res.json(updateInfo);
        } catch (error: unknown) {
          logger.error('Error checking for updates:', error);
          res.status(500).json({ error: 'Error checking for updates' });
        }
      },
    );

    router.post(
      '/admin/perform-update',
      adminOverviewLimiter,
      isAuthenticated(true, 'arclight.admin.overview.performUpdate'),
      async (_req: Request, res: Response) => {
        try {
          const success = await performUpdate();
          if (success) {
            res.json({ message: 'Update completed successfully' });
          } else {
            res.status(500).json({ error: 'Error performing update' });
          }
        } catch (error: unknown) {
          logger.error('Error performing update:', error);
          res.status(500).json({ error: 'Error performing update' });
        }
      },
    );

    return router;
  },
};

export default adminModule;