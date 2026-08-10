import type { Request, Response } from 'express';
import type { Router } from 'express';
import {
  isAuthenticatedForServer,
  requireSubUserPermission,
  PERMISSION_GROUPS,
} from '../../../handlers/utils/auth/serverAuthUtil';
import logger from '../../../handlers/logger';
import { getParamAsString } from '../../../utils/typeHelpers';
import prisma from '../../../db';
import { serverPageInclude, type ServerVariable } from './shared';
import { PERMISSION_LABELS } from './subusers';

/**
 * Additive JSON payloads for the React server tab pages. Each endpoint mirrors
 * the data the matching EJS page renders server-side — same permission gates,
 * same queries — so the React pages never have to guess at role/limit logic.
 *
 * The EJS GET routes are untouched; the React pages call these instead.
 * Mutations reuse the existing `/server/:id/*` endpoints unchanged.
 */

function subUserPermissionsOf(req: Request): string[] {
  if (!req.subUser?.permissions) {return [];}
  try {
    const parsed = JSON.parse(req.subUser.permissions);
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : [];
  } catch {
    return [];
  }
}

async function requireServer(req: Request, res: Response) {
  const user = await prisma.users.findUnique({ where: { id: req.session?.user?.id } });
  if (!user) {res.status(404).json({ success: false, error: 'User not found' }); return null;}
  const server = await prisma.server.findUnique({
    where: { UUID: getParamAsString(req.params?.id) },
    include: serverPageInclude,
  });
  if (!server) {res.status(404).json({ success: false, error: 'Server not found' }); return null;}
  return { user, server };
}

function authMeta(req: Request, ownerId: number) {
  const user = req.session?.user;
  return {
    isAdmin: user?.isAdmin === true,
    isOwner: ownerId === user?.id,
    isSubUser: !!req.subUser,
    subUserPermissions: subUserPermissionsOf(req),
  };
}

export function registerServerTabsRoutes(router: Router): void {
  // ── GET /api/server/:id/settings ─────────────────────────────────────────
  router.get(
    '/api/server/:id/settings',
    isAuthenticatedForServer('id'),
    requireSubUserPermission('settings'),
    async (req: Request, res: Response) => {
      try {
        const ctx = await requireServer(req, res);
        if (!ctx) {return;}
        const { server } = ctx;
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });

        res.json({
          success: true,
          server: {
            UUID: server.UUID,
            id: server.id,
            name: server.name,
            description: server.description ?? '',
            createdAt: server.createdAt,
            nodeName: server.node?.name ?? 'Unknown',
            imageName: server.image?.name ?? 'Unknown',
            memory: server.Memory,
            cpu: server.Cpu,
            storage: server.Storage,
            suspended: server.Suspended,
          },
          allowUserDeleteServer: settings?.allowUserDeleteServer === true,
          ...authMeta(req, server.ownerId),
        });
      } catch (error) {
        logger.error('Error loading settings tab data:', error);
        res.status(500).json({ success: false, error: 'Failed to load settings.' });
      }
    },
  );

  // ── GET /api/server/:id/startup ──────────────────────────────────────────
  router.get(
    '/api/server/:id/startup',
    isAuthenticatedForServer('id'),
    requireSubUserPermission('startup'),
    async (req: Request, res: Response) => {
      try {
        const ctx = await requireServer(req, res);
        if (!ctx) {return;}
        const { server } = ctx;

        let variables: ServerVariable[] = [];
        if (server.Variables) {
          try {
            const parsed: unknown = JSON.parse(server.Variables);
            if (Array.isArray(parsed)) {variables = parsed;}
          } catch {
            variables = [];
          }
        }

        let currentDockerImage = '';
        try {
          const obj = JSON.parse(server.dockerImage || '{}') as Record<string, unknown>;
          currentDockerImage = Object.keys(obj)[0] ?? '';
        } catch {
          currentDockerImage = '';
        }

        let availableDockerImages: string[] = [];
        try {
          if (server.image?.dockerImages) {
            const arr = JSON.parse(server.image.dockerImages) as Record<string, string>[];
            for (const imageObj of arr) {
              for (const key of Object.keys(imageObj)) {
                availableDockerImages.push(key);
              }
            }
          }
        } catch {
          availableDockerImages = [];
        }

        res.json({
          success: true,
          server: {
            UUID: server.UUID,
            startCommand: server.StartCommand ?? '',
            allowStartupEdit: server.allowStartupEdit === true,
          },
          currentDockerImage,
          availableDockerImages,
          variables,
          ...authMeta(req, server.ownerId),
        });
      } catch (error) {
        logger.error('Error loading startup tab data:', error);
        res.status(500).json({ success: false, error: 'Failed to load startup.' });
      }
    },
  );

  // ── GET /api/server/:id/databases ────────────────────────────────────────
  router.get(
    '/api/server/:id/databases',
    isAuthenticatedForServer('id'),
    requireSubUserPermission('settings'),
    async (req: Request, res: Response) => {
      try {
        const ctx = await requireServer(req, res);
        if (!ctx) {return;}
        const { server } = ctx;

        const [databases, hosts] = await Promise.all([
          prisma.serverDatabase.findMany({
            where: { serverId: server.UUID },
            include: { host: true },
            orderBy: { createdAt: 'desc' },
          }),
          prisma.databaseHost.findMany({
            where: { OR: [{ nodeId: null }, { nodeId: server.nodeId ?? -1 }] },
            orderBy: { id: 'asc' },
          }),
        ]);

        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        const owner = await prisma.users.findUnique({ where: { id: server.ownerId } });
        const userDbLimit =
          owner?.maxDatabases !== null && owner?.maxDatabases !== undefined
            ? (owner.maxDatabases ?? 0)
            : (settings?.defaultMaxDatabases ?? 0);
        const userDbCount = await prisma.serverDatabase.count({
          where: { server: { ownerId: server.ownerId } },
        });

        res.json({
          success: true,
          databases: databases.map((db: { id: number; databaseName: string; databaseUser: string; databasePassword: string; createdAt: Date; host: { name: string; host: string; port: number } | null }) => ({
            id: db.id,
            databaseName: db.databaseName,
            databaseUser: db.databaseUser,
            databasePassword: db.databasePassword,
            createdAt: db.createdAt,
            host: {
              name: db.host?.name ?? 'Unknown',
              host: db.host?.host ?? '',
              port: db.host?.port ?? 3306,
            },
          })),
          hosts: hosts.map((host: { id: number; name: string; host: string; port: number }) => ({
            id: host.id,
            name: host.name,
            host: host.host,
            port: host.port,
          })),
          userDbLimit,
          userDbCount,
          ...authMeta(req, server.ownerId),
        });
      } catch (error) {
        logger.error('Error loading databases tab data:', error);
        res.status(500).json({ success: false, error: 'Failed to load databases.' });
      }
    },
  );

  // ── GET /api/server/:id/schedules ────────────────────────────────────────
  router.get(
    '/api/server/:id/schedules',
    isAuthenticatedForServer('id'),
    requireSubUserPermission('schedule.read'),
    async (req: Request, res: Response) => {
      try {
        const ctx = await requireServer(req, res);
        if (!ctx) {return;}
        const { server } = ctx;

        const schedules = await prisma.schedule.findMany({
          where: { serverId: server.UUID },
          include: { tasks: { orderBy: { order: 'asc' } } },
          orderBy: { createdAt: 'desc' },
        });

        res.json({
          success: true,
          schedules: schedules.map((schedule: { id: number; name: string; cron: string; enabled: boolean; timeOffset: number | null; nextRunAt: Date | null; lastRunAt: Date | null; tasks: { id: number; action: string; payload: string; timeOffset: number | null }[] }) => ({
            id: schedule.id,
            name: schedule.name,
            cron: schedule.cron,
            enabled: schedule.enabled,
            timeOffset: schedule.timeOffset ?? 0,
            nextRunAt: schedule.nextRunAt,
            lastRunAt: schedule.lastRunAt,
            tasks: schedule.tasks.map((task: { id: number; action: string; payload: string; timeOffset: number | null }) => {
              let payload: Record<string, unknown> = {};
              try {
                const parsed = JSON.parse(task.payload || '{}');
                if (parsed && typeof parsed === 'object') {payload = parsed;}
              } catch {
                payload = {};
              }
              return {
                id: task.id,
                action: task.action,
                payload,
                timeOffset: task.timeOffset ?? 0,
              };
            }),
          })),
          ...authMeta(req, server.ownerId),
        });
      } catch (error) {
        logger.error('Error loading schedules tab data:', error);
        res.status(500).json({ success: false, error: 'Failed to load schedules.' });
      }
    },
  );

  // ── GET /api/server/:id/backups ──────────────────────────────────────────
  router.get(
    '/api/server/:id/backups',
    isAuthenticatedForServer('id'),
    requireSubUserPermission('backups'),
    async (req: Request, res: Response) => {
      try {
        const ctx = await requireServer(req, res);
        if (!ctx) {return;}
        const { server } = ctx;

        const backups = await prisma.backup.findMany({
          where: { serverId: server.UUID },
          orderBy: { createdAt: 'desc' },
        });

        res.json({
          success: true,
          backups: backups.map((backup: { UUID: string; name: string; size: bigint | null; checksum: string | null; locked: boolean; createdAt: Date }) => ({
            UUID: backup.UUID,
            name: backup.name,
            size: backup.size?.toString() ?? '0',
            checksum: backup.checksum,
            locked: backup.locked,
            createdAt: backup.createdAt,
          })),
          ...authMeta(req, server.ownerId),
        });
      } catch (error) {
        logger.error('Error loading backups tab data:', error);
        res.status(500).json({ success: false, error: 'Failed to load backups.' });
      }
    },
  );

  // ── GET /api/server/:id/subusers ─────────────────────────────────────────
  router.get(
    '/api/server/:id/subusers',
    isAuthenticatedForServer('id'),
    async (req: Request, res: Response) => {
      try {
        const user = await prisma.users.findUnique({ where: { id: req.session?.user?.id } });
        if (!user) {res.status(404).json({ success: false, error: 'User not found' }); return;}

        const server = await prisma.server.findUnique({
          where: { UUID: getParamAsString(req.params?.id) },
          include: serverPageInclude,
        });
        if (!server) {res.status(404).json({ success: false, error: 'Server not found' }); return;}
        if (server.ownerId !== user.id) {
          res.status(403).json({ success: false, error: 'Only the server owner can manage subusers.' });
          return;
        }

        const subUsers = await prisma.subUser.findMany({
          where: { serverId: server.UUID },
          include: { user: { select: { id: true, username: true, email: true, avatar: true } } },
          orderBy: { createdAt: 'asc' },
        });

        res.json({
          success: true,
          subUsers: subUsers.map((subUser: { id: number; permissions: string; user: { id: number; username: string | null; email: string | null; avatar: string | null } | null }) => {
            let permissions: string[] = [];
            try {
              const parsed = JSON.parse(subUser.permissions);
              if (Array.isArray(parsed)) {permissions = parsed.filter((p): p is string => typeof p === 'string');}
            } catch {
              permissions = [];
            }
            return {
              id: subUser.id,
              permissions,
              user: {
                id: subUser.user?.id,
                username: subUser.user?.username ?? '',
                email: subUser.user?.email ?? '',
                avatar: subUser.user?.avatar ?? null,
              },
            };
          }),
          permissionLabels: PERMISSION_LABELS,
          permissionGroups: PERMISSION_GROUPS,
          isOwner: true,
          isAdmin: user.isAdmin === true,
        });
      } catch (error) {
        logger.error('Error loading subusers tab data:', error);
        res.status(500).json({ success: false, error: 'Failed to load subusers.' });
      }
    },
  );
}
