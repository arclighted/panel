import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Module } from '../../handlers/moduleInit';
import prisma from '../../db';
import { isAuthenticated } from '../../handlers/utils/auth/authUtil';
import logger from '../../handlers/logger';
import { registerPermission } from '../../handlers/permissions';
import { getParamAsNumber } from '../../utils/typeHelpers';
import crypto from 'crypto';
import { apiEndpoints } from '../api/v1/apiDocs';
import { generateApiKey } from '../../utils/apiKey';
import { logActivity } from '../../handlers/utils/activity/activityLogger';

const MAX_API_KEYS_PER_USER = 25;

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function shouldHashKeys(): Promise<boolean> {
  try {
    const s = await prisma.settings.findUnique({ where: { id: 1 } });
    return s?.hashApiKeys === true;
  } catch {
    return false;
  }
}

registerPermission('arclight.admin.apikeys.view');
registerPermission('arclight.admin.apikeys.create');
registerPermission('arclight.admin.apikeys.delete');
registerPermission('arclight.admin.apikeys.edit');
registerPermission('arclight.admin.api.docs.view');

const coreModule: Module = {
  info: {
    name: 'API Keys Module',
    description: 'This module handles API key management.',
    version: '2.0.0',
    moduleVersion: '1.0.0',
    author: 'Arclight',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    router.get(
      '/admin/api/docs',
      isAuthenticated(true, 'arclight.admin.api.docs.view'),
      async (req: Request, res: Response) => {
        try {
          const settings = await prisma.settings.findFirst();
          const apiKeys = await prisma.apiKey.findMany({
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          });


          res.render('admin/apikeys/docs', {
            apiEndpoints,
            apiKeys,
            settings,
            user: req.session.user,
            req,
          });
        } catch (error: unknown) {
          logger.error('Error rendering API documentation:', error);
          res.status(500).render('errors/error', {
            error: 'Failed to load API documentation',
            req
          });
        }
      }
    );

    router.get(
      '/admin/apikeys',
      isAuthenticated(true, 'arclight.admin.apikeys.view'),
      async (req: Request, res: Response) => {
        try {
          const apiKeys = await prisma.apiKey.findMany({
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  email: true,
                },
              },
            },
          });

          const settings = await prisma.settings.findFirst();

          const allPermissions = [
            { name: 'Servers - Read', value: 'arclight.api.servers.read' },
            { name: 'Servers - Create', value: 'arclight.api.servers.create' },
            { name: 'Servers - Update', value: 'arclight.api.servers.update' },
            { name: 'Servers - Delete', value: 'arclight.api.servers.delete' },
            { name: 'Users - Read', value: 'arclight.api.users.read' },
            { name: 'Users - Create', value: 'arclight.api.users.create' },
            { name: 'Users - Update', value: 'arclight.api.users.update' },
            { name: 'Users - Delete', value: 'arclight.api.users.delete' },
            { name: 'Nodes - Read', value: 'arclight.api.nodes.read' },
            { name: 'Nodes - Create', value: 'arclight.api.nodes.create' },
            { name: 'Nodes - Update', value: 'arclight.api.nodes.update' },
            { name: 'Nodes - Delete', value: 'arclight.api.nodes.delete' },
            { name: 'Settings - Read', value: 'arclight.api.settings.read' },
            { name: 'Settings - Update', value: 'arclight.api.settings.update' },
            { name: 'Images - Read', value: 'arclight.api.images.read' },
            { name: 'Images - Create', value: 'arclight.api.images.create' },
            { name: 'Images - Update', value: 'arclight.api.images.update' },
            { name: 'Images - Delete', value: 'arclight.api.images.delete' },
            { name: 'Locations - Read', value: 'arclight.api.locations.read' },
            { name: 'Locations - Create', value: 'arclight.api.locations.create' },
          ];

          res.render('admin/apikeys/apikeys', {
            apiKeys,
            allPermissions,
            settings,
            user: req.session.user,
            created: typeof req.query.created === 'string' ? req.query.created : null,
            req,
          });
        } catch (error: unknown) {
          logger.error('Error fetching API keys:', error);
          res.status(500).render('errors/error', {
            error: 'Failed to fetch API keys',
            req,
          });
        }
      },
    );

    router.post(
      '/admin/apikeys/create',
      isAuthenticated(true, 'arclight.admin.apikeys.create'),
      async (req: Request, res: Response) => {
        try {
          const { name, description, permissions } = req.body ?? {};

          if (!name) {
            res.status(400).json({ error: 'API key name is required' });
            return;
          }

          const userId = req.session.user?.id;

          const keyCount = await prisma.apiKey.count({ where: { userId: userId ?? undefined } });
          if (keyCount >= MAX_API_KEYS_PER_USER) {
            res.status(400).json({ error: `API key limit reached (${MAX_API_KEYS_PER_USER}). Delete an existing key first.` });
            return;
          }

          const rawKey = generateApiKey(32);
          const useHash = await shouldHashKeys();
          const storedKey = useHash ? sha256(rawKey) : rawKey;

          const permissionsArray = permissions ?
            (Array.isArray(permissions) ? permissions : [permissions]) :
            [];

          await prisma.apiKey.create({
            data: {
              name,
              key: storedKey,
              description,
              permissions: JSON.stringify(permissionsArray),
              userId,
              updatedAt: new Date(),
            },
          });

          await logActivity(req, 'apikey:create', { metadata: { name, userId } });

          if (useHash) {
            res.redirect(`/admin/apikeys?created=${encodeURIComponent(rawKey)}`);
          } else {
            res.redirect('/admin/apikeys');
          }
        } catch (error: unknown) {
          logger.error('Error creating API key:', error);
          res.status(500).json({ error: 'Failed to create API key' });
        }
      },
    );

    router.post(
      '/admin/apikeys/delete/:id',
      isAuthenticated(true, 'arclight.admin.apikeys.delete'),
      async (req: Request, res: Response) => {
        try {
          const id = getParamAsNumber(req.params.id);

          const existing = await prisma.apiKey.findUnique({
            where: { id },
          });

          if (!existing) {
            res.status(404).json({ error: 'API key not found' });
            return;
          }

          await prisma.apiKey.delete({
            where: { id },
          });

          await logActivity(req, 'apikey:delete', { metadata: { keyId: id } });

          res.redirect('/admin/apikeys');
        } catch (error: unknown) {
          logger.error('Error deleting API key:', error);
          res.status(500).json({ error: 'Failed to delete API key' });
        }
      },
    );

    router.post(
      '/admin/apikeys/toggle/:id',
      isAuthenticated(true, 'arclight.admin.apikeys.edit'),
      async (req: Request, res: Response) => {
        try {
          const id = getParamAsNumber(req.params.id);

          const apiKey = await prisma.apiKey.findUnique({
            where: { id },
          });

          if (!apiKey) {
            res.status(404).json({ error: 'API key not found' });
            return;
          }

          await prisma.apiKey.update({
            where: { id },
            data: {
              active: !apiKey.active,
              updatedAt: new Date(),
            },
          });

          res.redirect('/admin/apikeys');
        } catch (error: unknown) {
          logger.error('Error toggling API key status:', error);
          res.status(500).json({ error: 'Failed to toggle API key status' });
        }
      },
    );

    router.post(
      '/admin/apikeys/edit/:id',
      isAuthenticated(true, 'arclight.admin.apikeys.edit'),
      async (req: Request, res: Response) => {
        try {
          const id = getParamAsNumber(req.params.id);
          const { name, description, permissions } = req.body;

          if (!name) {
            res.status(400).json({ error: 'API key name is required' });
            return;
          }

          const permissionsArray = permissions ?
            (Array.isArray(permissions) ? permissions : [permissions]) :
            [];

          await prisma.apiKey.update({
            where: { id },
            data: {
              name,
              description,
              permissions: JSON.stringify(permissionsArray),
              updatedAt: new Date(),
            },
          });

          res.redirect('/admin/apikeys');
        } catch (error: unknown) {
          logger.error('Error updating API key:', error);
          res.status(500).json({ error: 'Failed to update API key' });
        }
      },
    );

    return router;
  },
};

export default coreModule;
