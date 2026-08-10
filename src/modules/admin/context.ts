import type { Request, Response } from 'express';
import { Router } from 'express';
import type { Module } from '../../handlers/moduleInit';
import prisma from '../../db';
import { isAuthenticated } from '../../handlers/utils/auth/authUtil';
import { uiComponentStore } from '../../handlers/uiComponentHandler';
import { daemonRequest } from '../../handlers/utils/core/daemonRequest';
import { getPrimaryExternalPort } from '../../handlers/utils/server/ports';
import { getActivityEventMeta } from '../../handlers/utils/activity/activityEvents';
import { apiEndpoints } from '../api/v1/apiDocs';
import { getCatalogue } from '../../handlers/eggCatalogueService';
import { getAllAddons } from '../../handlers/addonHandler';
import { parseAddonManifest } from '../../handlers/addonManifest';
import logger from '../../handlers/logger';
import { getParamAsNumber } from '../../utils/typeHelpers';
import fs from 'fs';
import path from 'path';

/**
 * Additive JSON endpoints for the React admin panel:
 *
 * - GET /api/admin/context — current admin identity + the addon-driven admin
 *   sidebar groups (same source the EJS template uses) + the 2FA requirement.
 * - GET /api/admin/page/:page — the render data for one admin page, mirroring
 *   the corresponding EJS `res.render(...)` payload so the React pages never
 *   guess at queries or permission gates.
 *
 * All the existing admin mutation endpoints (`/admin/*` POST/PUT/DELETE) are
 * left untouched and are called directly by the React pages.
 */

function safeUser(user: {
  id: number;
  username: string | null;
  email: string | null;
  avatar: string | null;
  isAdmin: boolean | null;
  role: string | null;
  description: string | null;
  createdAt: Date;
  serverLimit: number | null;
  maxMemory: number | null;
  maxCpu: number | null;
  maxStorage: number | null;
  maxDatabases: number | null;
  preferredNodeId: number | null;
  totpEnabled: boolean | null;
  permissions: string | null;
}) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    isAdmin: user.isAdmin === true,
    role: user.role,
    description: user.description ?? '',
    createdAt: user.createdAt,
    serverLimit: user.serverLimit,
    maxMemory: user.maxMemory,
    maxCpu: user.maxCpu,
    maxStorage: user.maxStorage,
    maxDatabases: user.maxDatabases,
    preferredNodeId: user.preferredNodeId,
    totpEnabled: user.totpEnabled === true,
    permissions: user.permissions,
  };
}

function loadAllThemes() {
  const builtinThemesDir = path.join(process.cwd(), 'public', 'themes');
  const builtinThemes = fs
    .readdirSync(builtinThemesDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => ({ name: f.replace('.css', ''), path: `/themes/${f}`, builtin: true }));

  const userThemes: { name: string; path: string; builtin: boolean }[] = [];
  try {
    const dir = path.join(process.cwd(), 'storage', 'themes');
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.css')) {
          userThemes.push({ name: f.replace('.css', ''), path: `/themes/${f}`, builtin: false });
        }
      }
    }
  } catch {
    /* ignore */
  }

  return [{ name: 'default', path: null, builtin: true }, ...builtinThemes, ...userThemes];
}

async function loadPageData(page: string, req: Request) {
  const idRaw = req.query.id;
  const id = getParamAsNumber(typeof idRaw === 'string' ? idRaw : String(idRaw ?? ''));

  switch (page) {
  case 'overview': {
    const [userCount, nodeCount, instanceCount, imageCount, settings] = await Promise.all([
      prisma.users.count(),
      prisma.node.count(),
      prisma.server.count(),
      prisma.images.count(),
      prisma.settings.findUnique({ where: { id: 1 } }),
    ]);

    let arclightCodename = String(req.res?.locals?.arclightCodename ?? '');
    let vcodeBg: string | null = null;
    try {
      const configPath = path.join(process.cwd(), 'storage', 'config.json');
      if (fs.existsSync(configPath)) {
        const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (cfg?.meta?.codename) {arclightCodename = String(cfg.meta.codename);}
      }
    } catch {
      /* ignore */
    }
    if (arclightCodename) {
      try {
        const vcodeDir = path.join(process.cwd(), 'public', 'assets', 'vcode');
        if (fs.existsSync(vcodeDir)) {
          const target = `${arclightCodename.toLowerCase()}.svg`;
          const match = fs.readdirSync(vcodeDir).find((f) => f.toLowerCase() === target);
          if (match) {vcodeBg = `/assets/vcode/${match}`;}
        }
      } catch {
        /* ignore */
      }
    }

    return {
      userCount,
      nodeCount,
      instanceCount,
      imageCount,
      arclightVersion: req.res?.locals?.arclightVersion ?? null,
      arclightCodename,
      vcodeBg,
    };
  }

  case 'users': {
    const users = await prisma.users.findMany({
      include: { _count: { select: { servers: true } } },
      orderBy: { id: 'asc' },
    });
    return {
      users: users.map((u) => ({
        ...safeUser(u),
        serverCount: u._count.servers,
      })),
    };
  }

  case 'users-edit':
  case 'users-view': {
    const dataUser = await prisma.users.findUnique({
      where: { id },
      include: { _count: { select: { servers: true } } },
    });
    if (!dataUser) {return { error: 'User not found' };}
    const adminUser = await prisma.users.findUnique({
      where: { id: req.session?.user?.id },
    });
    return {
      dataUser: {
        ...safeUser(dataUser),
        serverCount: dataUser._count.servers,
        email: dataUser.email,
      },
      canTransferOwner:
          adminUser?.role === 'owner' && dataUser.role !== 'owner',
    };
  }

  case 'nodes': {
    const nodes = await prisma.node.findMany({
      include: { location: true, _count: { select: { servers: true } } },
      orderBy: { id: 'asc' },
    });
    const nodesWithUsage = await Promise.all(
      nodes.map(async (node) => {
        const agg = await prisma.server.aggregate({
          where: { nodeId: node.id },
          _sum: { Memory: true, Cpu: true, Storage: true },
        });
        const usedMemory = agg._sum.Memory ?? 0;
        const usedCpu = agg._sum.Cpu ?? 0;
        const usedDisk = agg._sum.Storage ?? 0;
        const [allocationTotal, allocationsInUse] = await Promise.all([
          prisma.allocation.count({ where: { nodeId: node.id } }),
          prisma.allocation.count({ where: { nodeId: node.id, serverId: { not: null } } }),
        ]);
        return {
          id: node.id,
          name: node.name,
          address: node.address,
          port: node.port,
          ram: node.ram,
          cpu: node.cpu,
          disk: node.disk,
          overallocateMemory: node.overallocateMemory,
          overallocateCpu: node.overallocateCpu,
          overallocateDisk: node.overallocateDisk,
          location: node.location ? { id: node.location.id, name: node.location.name } : null,
          instanceCount: node._count.servers,
          usage: {
            memory: node.ram > 0 ? Math.round((usedMemory / (node.ram * 1024)) * 100) : 0,
            cpu: node.cpu > 0 ? Math.round((usedCpu / node.cpu) * 100) : 0,
            disk: node.disk > 0 ? Math.round((usedDisk / (node.disk * 1024)) * 100) : 0,
          },
          allocationCount: allocationTotal,
          allocationsInUse,
        };
      }),
    );
    const locations = await prisma.location.findMany({
      include: { _count: { select: { nodes: true } } },
      orderBy: { name: 'asc' },
    });
    return { nodes: nodesWithUsage, locations };
  }

  case 'nodes-create': {
    const locations = await prisma.location.findMany({
      include: { _count: { select: { nodes: true } } },
      orderBy: { name: 'asc' },
    });
    return { locations };
  }

  case 'nodes-edit': {
    const [node, locations] = await Promise.all([
      prisma.node.findUnique({ where: { id } }),
      prisma.location.findMany({
        include: { _count: { select: { nodes: true } } },
        orderBy: { name: 'asc' },
      }),
    ]);
    if (!node) {return { error: 'Node not found' };}
    return { node, locations };
  }

  case 'nodes-stats': {
    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) {return { error: 'Node not found' };}
    let stats: Record<string, unknown> = {};
    try {
      const response = await daemonRequest({
        nodeAddress: node.address,
        nodePort: node.port,
        nodeKey: node.key,
        method: 'GET',
        path: '/stats',
      });
      stats = (response.data ?? {}) as Record<string, unknown>;
    } catch {
      stats = { error: 'Unable to fetch stats from the node.' };
    }
    return { node, stats };
  }

  case 'nodes-configure': {
    // Mirrors GET /admin/node/:id/configure: the daemon onboarding command.
    const node = await prisma.node.findUnique({ where: { id } });
    if (!node) {return { error: 'Node not found' };};
    return {
      command: `configure -- -- --panel "${process.env.URL}" --key "$(cat /path/to/daemon/.env | grep ^key= | cut -d= -f2)"`,
    };
  }

  case 'servers': {
    const servers = await prisma.server.findMany({
      include: { node: true, owner: true, image: true },
      orderBy: { id: 'desc' },
    });
    return {
      servers: servers.map((s) => ({
        id: s.id,
        UUID: s.UUID,
        name: s.name,
        description: s.description,
        Memory: s.Memory,
        Cpu: s.Cpu,
        Storage: s.Storage,
        Suspended: s.Suspended,
        Installing: s.Installing,
        image: s.image?.name ?? null,
        node: s.node ? { id: s.node.id, name: s.node.name, address: s.node.address } : null,
        owner: s.owner ? { id: s.owner.id, username: s.owner.username, email: s.owner.email } : null,
        primaryAddress:
            s.node && getPrimaryExternalPort(s.Ports)
              ? `${s.node.address}:${getPrimaryExternalPort(s.Ports)}`
              : null,
        createdAt: s.createdAt,
      })),
    };
  }

  case 'servers-create': {
    const [users, nodes, images] = await Promise.all([
      prisma.users.findMany({ orderBy: { username: 'asc' } }),
      prisma.node.findMany({ orderBy: { name: 'asc' } }),
      prisma.images.findMany({ orderBy: { name: 'asc' } }),
    ]);
    return {
      users: users.map((u) => ({ id: u.id, username: u.username, email: u.email })),
      nodes: nodes.map((n) => ({ id: n.id, name: n.name, address: n.address })),
      images: images.map((img) => ({
        id: img.id,
        name: img.name,
        startup: img.startup,
        dockerImages: img.dockerImages,
      })),
    };
  }

  case 'servers-edit': {
    const server = await prisma.server.findUnique({
      where: { id },
      include: { node: true, owner: true, image: true, serverMounts: true },
    });
    if (!server) {return { error: 'Server not found' };}
    const [users, nodes, images, mounts, serverMounts] = await Promise.all([
      prisma.users.findMany({ orderBy: { username: 'asc' } }),
      prisma.node.findMany({ orderBy: { name: 'asc' } }),
      prisma.images.findMany({ orderBy: { name: 'asc' } }),
      prisma.mount.findMany(),
      prisma.serverMount.findMany({ where: { serverId: server.UUID } }),
    ]);
    return {
      server: {
        id: server.id,
        UUID: server.UUID,
        name: server.name,
        description: server.description,
        Memory: server.Memory,
        Swap: server.Swap,
        Cpu: server.Cpu,
        Storage: server.Storage,
        Suspended: server.Suspended,
        Installing: server.Installing,
        dockerImage: server.dockerImage,
        StartCommand: server.StartCommand,
        nodeId: server.nodeId,
        ownerId: server.ownerId,
        imageId: server.imageId,
        backupLimit: server.backupLimit,
        databaseLimit: server.databaseLimit,
        allowStartupEdit: server.allowStartupEdit,
        Ports: server.Ports,
      },
      users: users.map((u) => ({ id: u.id, username: u.username, email: u.email })),
      nodes: nodes.map((n) => ({ id: n.id, name: n.name, address: n.address })),
      images: images.map((img) => ({
        id: img.id,
        name: img.name,
        startup: img.startup,
        dockerImages: img.dockerImages,
      })),
      mounts: mounts.map((m) => ({ id: m.id, name: m.name, source: m.source, target: m.target })),
      serverMounts: serverMounts.map((sm) => ({ mountId: sm.mountId })),
    };
  }

  case 'images': {
    const [images, pending] = await Promise.all([
      prisma.images.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.images.findMany({ where: { status: 'pending' }, orderBy: { createdAt: 'asc' } }),
    ]);
    const creatorIds = [...new Set(pending.map((i) => i.createdById).filter((x): x is number => x !== null))];
    const creators =
        creatorIds.length > 0
          ? await prisma.users.findMany({
            where: { id: { in: creatorIds } },
            select: { id: true, username: true, email: true },
          })
          : [];
    const creatorMap = new Map(creators.map((c) => [c.id, c]));
    return {
      images: images.map((img) => ({
        id: img.id,
        name: img.name,
        status: img.status,
        createdAt: img.createdAt,
        rejectionReason: img.rejectionReason,
        author: img.author,
      })),
      pending: pending.map((i) => ({
        id: i.id,
        name: i.name,
        createdAt: i.createdAt,
        creator: i.createdById !== null ? (creatorMap.get(i.createdById) ?? null) : null,
      })),
    };
  }

  case 'images-edit': {
    const image = await prisma.images.findUnique({ where: { id } });
    if (!image) {return { error: 'Image not found' };}

    let dockerImages: Record<string, string> = {};
    try {
      const parsed = JSON.parse(image.dockerImages || '[]');
      if (Array.isArray(parsed)) {
        for (const obj of parsed) {
          if (typeof obj === 'object') {Object.assign(dockerImages, obj);}
        }
      } else if (typeof parsed === 'object') {
        dockerImages = parsed;
      }
    } catch {
      dockerImages = {};
    }

    let variables: unknown[] = [];
    let scripts: Record<string, unknown> = {};
    let info: Record<string, unknown> = {};
    let portRequirements: unknown[] = [];
    try {
      variables = JSON.parse(image.variables || '[]');
    } catch {
      variables = [];
    }
    try {
      scripts = JSON.parse(image.scripts || '{}');
    } catch {
      scripts = {};
    }
    try {
      info = JSON.parse(image.info || '{}');
    } catch {
      info = {};
    }
    try {
      portRequirements = JSON.parse(image.portRequirements || '[]');
    } catch {
      portRequirements = [];
    }

    const parsedImage = {
      ...image,
      dockerImages,
      variables,
      scripts,
      info,
      portRequirements,
    };

    return { image: parsedImage, imageJson: JSON.stringify(parsedImage, null, 2) };
  }

  case 'apikeys': {
    const [apiKeys, settings] = await Promise.all([
      prisma.apiKey.findMany({
        include: { user: { select: { id: true, username: true, email: true } } },
        orderBy: { id: 'desc' },
      }),
      prisma.settings.findFirst(),
    ]);
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
    return { apiKeys, allPermissions, hashApiKeys: settings?.hashApiKeys === true };
  }

  case 'apikeys-docs': {
    const apiKeys = await prisma.apiKey.findMany({
      include: { user: { select: { id: true, username: true, email: true } } },
    });
    return { apiEndpoints, apiKeys };
  }

  case 'databases': {
    const hosts = await prisma.databaseHost.findMany({
      include: {
        _count: { select: { databases: true } },
        node: { select: { id: true, name: true } },
      },
      orderBy: { id: 'asc' },
    });
    return { hosts };
  }

  case 'databases-create': {
    const nodes = await prisma.node.findMany({ orderBy: { name: 'asc' } });
    return { nodes: nodes.map((n) => ({ id: n.id, name: n.name, address: n.address })) };
  }

  case 'settings': {
    const settings = await prisma.settings.findUnique({ where: { id: 1 } });
    return { settings, allThemes: loadAllThemes() };
  }

  case 'activity': {
    const eventFilter = typeof req.query.event === 'string' ? req.query.event : '';
    const serverFilter = typeof req.query.server === 'string' ? req.query.server : '';
    const actorFilter = typeof req.query.actor === 'string' ? req.query.actor : '';
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : '';
    const toRaw = typeof req.query.to === 'string' ? req.query.to : '';
    const pageRaw = req.query.page;
    const page = Math.max(1, getParamAsNumber(typeof pageRaw === 'string' ? pageRaw : String(pageRaw ?? '')) || 1);
    const ACTIVITY_PAGE_SIZE = 25;

    const where: Record<string, unknown> = {};
    if (eventFilter) {where.event = eventFilter;}
    if (serverFilter) {where.serverId = serverFilter;}
    if (actorFilter) {
      const actors = await prisma.users.findMany({
        where: {
          OR: [{ username: { contains: actorFilter } }, { email: { contains: actorFilter } }],
        },
        select: { id: true },
      });
      where.actorId = { in: actors.map((a) => a.id) };
    }
    const createdAt: Record<string, Date> = {};
    if (fromRaw) {
      const from = new Date(`${fromRaw}T00:00:00.000Z`);
      if (!isNaN(from.getTime())) {createdAt.gte = from;}
    }
    if (toRaw) {
      const to = new Date(`${toRaw}T23:59:59.999Z`);
      if (!isNaN(to.getTime())) {createdAt.lte = to;}
    }
    if (Object.keys(createdAt).length > 0) {where.createdAt = createdAt;}

    const [total, logs, events, actors, servers] = await Promise.all([
      prisma.activityLog.count({ where }),
      prisma.activityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * ACTIVITY_PAGE_SIZE,
        take: ACTIVITY_PAGE_SIZE,
        include: {
          actor: { select: { id: true, username: true, email: true } },
          server: { select: { UUID: true, name: true } },
        },
      }),
      prisma.activityLog.groupBy({
        by: ['event'],
        _count: { _all: true },
        orderBy: { event: 'asc' },
      }),
      prisma.users.findMany({ select: { id: true, username: true, email: true }, orderBy: { username: 'asc' }, take: 500 }),
      prisma.server.findMany({ select: { UUID: true, name: true }, orderBy: { name: 'asc' }, take: 500 }),
    ]);

    return {
      logs: logs.map((log) => ({
        id: log.id,
        event: log.event,
        createdAt: log.createdAt,
        metadata: log.metadata ? JSON.parse(log.metadata) : null,
        meta: getActivityEventMeta(log.event),
        actor: log.actor,
        server: log.server,
      })),
      events: events.map((e) => ({ event: e.event, count: e._count._all })),
      actors,
      servers,
      total,
      page,
      pageSize: ACTIVITY_PAGE_SIZE,
      filters: { event: eventFilter, server: serverFilter, actor: actorFilter, from: fromRaw, to: toRaw },
    };
  }

  case 'mounts': {
    const mounts = await prisma.mount.findMany({
      include: { _count: { select: { servers: true } } },
      orderBy: { id: 'asc' },
    });
    return { mounts };
  }

  case 'addons': {
    const addons = await getAllAddons();
    const addonsDir = path.join(process.cwd(), 'storage', 'addons');
    const addonsWithMeta = addons.map((addon) => {
      const addonDir = path.join(addonsDir, addon.slug);
      const packageJsonPath = path.join(addonDir, 'package.json');
      const result = parseAddonManifest(packageJsonPath, addon.slug);
      const hasDisabledPh = fs.existsSync(path.join(addonDir, 'disabled.ph'));
      if (!result.success) {return { ...addon, manifest: null, hasDisabledPh };}
      return { ...addon, manifest: result.manifest, hasDisabledPh };
    });
    return { addons: addonsWithMeta };
  }

  case 'images-store': {
    try {
      const data = getCatalogue();
      return { catalogue: data };
    } catch (error) {
      logger.error('Error loading egg store catalogue:', error);
      return { catalogue: { images: [], builtAt: 0 } };
    }
  }

  case 'addons-store': {
    // The addon store is a stub (410) in the panel today; mirror the EJS page.
    return { unavailable: true, message: 'Addon store is not available yet.' };
  }

  case 'menu': {
    return { sidebarGroups: uiComponentStore.getAdminSidebarGroups() };
  }

  default:
    return { error: 'Unknown admin page.' };
  }
}

const adminContextModule: Module = {
  info: {
    name: 'Admin Context Module',
    description: 'Additive JSON endpoints for the React admin panel.',
    version: '1.0.0',
    moduleVersion: '1.0.0',
    author: 'Arclight',
    license: 'MIT',
  },

  router: () => {
    const router = Router();

    router.get('/api/admin/context', isAuthenticated(true), async (req: Request, res: Response) => {
      try {
        const user = await prisma.users.findUnique({ where: { id: req.session?.user?.id } });
        if (!user) {
          res.status(404).json({ success: false, error: 'User not found.' });
          return;
        }
        const settings = await prisma.settings.findUnique({ where: { id: 1 } });
        res.json({
          success: true,
          user: safeUser(user),
          sidebarGroups: uiComponentStore.getAdminSidebarGroups(),
          require2faForAdmins: settings?.require2faForAdmins === true,
        });
      } catch (error) {
        logger.error('Error loading admin context:', error);
        res.status(500).json({ success: false, error: 'Failed to load admin context.' });
      }
    });

    router.get('/api/admin/page/:page', isAuthenticated(true), async (req: Request, res: Response) => {
      try {
        const page = String(req.params.page);
        const data = await loadPageData(page, req);
        if (data && 'error' in data) {
          res.status(404).json({ success: false, error: data.error });
          return;
        }
        res.json({ success: true, page, data });
      } catch (error) {
        logger.error(`Error loading admin page data (${String(req.params.page)}):`, error);
        res.status(500).json({ success: false, error: 'Failed to load page data.' });
      }
    });

    return router;
  },
};

export default adminContextModule;
