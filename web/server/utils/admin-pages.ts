/**
 * Nitro twin of `loadPageData()` in src/modules/admin/context.ts — the render
 * data for each admin page behind GET /api/admin/page/:page. Byte-identical
 * payloads (D3): every case mirrors the Express switch, using the shared
 * SQLite store and the same framework-free root helpers (daemonRequest,
 * activity event meta, API docs, addon manifest parser, egg catalogue).
 *
 * Known deviations (documented in docs/tanstack-migration-plan.md):
 * - The `menu` case returns the Nitro-side default UI store (addon v2 runtime
 *   items live in the Express process only).
 * - The egg-store catalogue reads storage/eggs relative to the process cwd
 *   (Nitro runs from web/); the store dirs follow in Phase 4.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { H3Event } from 'h3'
import { getQuery } from 'h3'
import type { Users } from '../../../src/generated/prisma/client'
import { getParamAsNumber } from '../../../src/utils/typeHelpers'
import { daemonRequest } from '../../../src/handlers/utils/core/daemonRequest'
import { getPrimaryExternalPort } from '../../../src/handlers/utils/server/ports'
import { getActivityEventMeta } from '../../../src/handlers/utils/activity/activityEvents'
import { apiEndpoints } from '../../../src/modules/api/v1/apiDocs'
import { parseAddonManifest } from '../../../src/handlers/addonManifest'
import { getCatalogue } from '../../../src/handlers/eggCatalogueService'
import { nitroPrisma } from './auth-session'
import { safeUser } from './auth'
import { uiComponentStore } from './ui-store'
import { projectRoot } from './paths'

function loadAllThemes() {
  const root = projectRoot()
  const builtinThemesDir = path.join(root, 'public', 'themes')
  let builtinThemes: { name: string; path: string; builtin: boolean }[] = []
  try {
    builtinThemes = fs
      .readdirSync(builtinThemesDir)
      .filter((f) => f.endsWith('.css'))
      .map((f) => ({ name: f.replace('.css', ''), path: `/themes/${f}`, builtin: true }))
  } catch {
    builtinThemes = []
  }

  const userThemes: { name: string; path: string; builtin: boolean }[] = []
  try {
    const dir = path.join(root, 'storage', 'themes')
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        if (f.endsWith('.css')) {
          userThemes.push({ name: f.replace('.css', ''), path: `/themes/${f}`, builtin: false })
        }
      }
    }
  } catch {
    /* ignore */
  }

  return [{ name: 'default', path: null, builtin: true }, ...builtinThemes, ...userThemes]
}

/** Panel version + codename from storage/config.json (mirrors src/config.ts meta). */
function readPanelMeta(): { version: string | null; codename: string | null } {
  try {
    const cfg = JSON.parse(
      fs.readFileSync(path.join(projectRoot(), 'storage', 'config.json'), 'utf8'),
    ) as { meta?: { version?: unknown; codename?: unknown } }
    return {
      version: typeof cfg.meta?.version === 'string' ? cfg.meta.version : null,
      codename: typeof cfg.meta?.codename === 'string' ? cfg.meta.codename : null,
    }
  } catch {
    return { version: null, codename: null }
  }
}

/** Mirror of getAllAddons() in src/handlers/addonHandler.ts (DB-backed). */
async function getAllAddons() {
  try {
    return await nitroPrisma.addon.findMany({ orderBy: { name: 'asc' } })
  } catch (error) {
    console.error(
      'Failed to get addons:',
      error instanceof Error ? error.message : String(error),
    )
    return []
  }
}

export async function loadAdminPageData(
  page: string,
  event: H3Event,
  sessionUser: Users | null,
): Promise<Record<string, unknown>> {
  const query = getQuery(event)
  const idRaw = query.id
  const id = getParamAsNumber(
    typeof idRaw === 'string' ? idRaw : String(idRaw ?? ''),
  )

  switch (page) {
    case 'overview': {
      const [userCount, nodeCount, instanceCount, imageCount, _settings] =
        await Promise.all([
          nitroPrisma.users.count(),
          nitroPrisma.node.count(),
          nitroPrisma.server.count(),
          nitroPrisma.images.count(),
          nitroPrisma.settings.findUnique({ where: { id: 1 } }),
        ])

      const meta = readPanelMeta()
      let arclightCodename = meta.codename ?? ''
      let vcodeBg: string | null = null
      if (arclightCodename) {
        try {
          const vcodeDir = path.join(projectRoot(), 'public', 'assets', 'vcode')
          if (fs.existsSync(vcodeDir)) {
            const target = `${arclightCodename.toLowerCase()}.svg`
            const match = fs
              .readdirSync(vcodeDir)
              .find((f) => f.toLowerCase() === target)
            if (match) {
              vcodeBg = `/assets/vcode/${match}`
            }
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
        arclightVersion: meta.version,
        arclightCodename,
        vcodeBg,
      }
    }

    case 'users': {
      const users = await nitroPrisma.users.findMany({
        include: { _count: { select: { servers: true } } },
        orderBy: { id: 'asc' },
      })
      return {
        users: users.map((u) => ({
          ...safeUser(u),
          serverCount: u._count.servers,
        })),
      }
    }

    case 'users-edit':
    case 'users-view': {
      const dataUser = await nitroPrisma.users.findUnique({
        where: { id },
        include: { _count: { select: { servers: true } } },
      })
      if (!dataUser) {
        return { error: 'User not found' }
      }
      return {
        dataUser: {
          ...safeUser(dataUser),
          serverCount: dataUser._count.servers,
          email: dataUser.email,
        },
        canTransferOwner: sessionUser?.role === 'owner' && dataUser.role !== 'owner',
      }
    }

    case 'nodes': {
      const nodes = await nitroPrisma.node.findMany({
        include: { location: true, _count: { select: { servers: true } } },
        orderBy: { id: 'asc' },
      })
      const nodesWithUsage = await Promise.all(
        nodes.map(async (node) => {
          const agg = await nitroPrisma.server.aggregate({
            where: { nodeId: node.id },
            _sum: { Memory: true, Cpu: true, Storage: true },
          })
          const usedMemory = agg._sum.Memory ?? 0
          const usedCpu = agg._sum.Cpu ?? 0
          const usedDisk = agg._sum.Storage ?? 0
          const [allocationTotal, allocationsInUse] = await Promise.all([
            nitroPrisma.allocation.count({ where: { nodeId: node.id } }),
            nitroPrisma.allocation.count({
              where: { nodeId: node.id, serverId: { not: null } },
            }),
          ])
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
            location: node.location
              ? { id: node.location.id, name: node.location.name }
              : null,
            instanceCount: node._count.servers,
            usage: {
              memory: node.ram > 0 ? Math.round((usedMemory / (node.ram * 1024)) * 100) : 0,
              cpu: node.cpu > 0 ? Math.round((usedCpu / node.cpu) * 100) : 0,
              disk: node.disk > 0 ? Math.round((usedDisk / (node.disk * 1024)) * 100) : 0,
            },
            allocationCount: allocationTotal,
            allocationsInUse,
          }
        }),
      )
      const locations = await nitroPrisma.location.findMany({
        include: { _count: { select: { nodes: true } } },
        orderBy: { name: 'asc' },
      })
      return { nodes: nodesWithUsage, locations }
    }

    case 'nodes-create': {
      const locations = await nitroPrisma.location.findMany({
        include: { _count: { select: { nodes: true } } },
        orderBy: { name: 'asc' },
      })
      return { locations }
    }

    case 'nodes-edit': {
      const [node, locations] = await Promise.all([
        nitroPrisma.node.findUnique({ where: { id } }),
        nitroPrisma.location.findMany({
          include: { _count: { select: { nodes: true } } },
          orderBy: { name: 'asc' },
        }),
      ])
      if (!node) {
        return { error: 'Node not found' }
      }
      return { node, locations }
    }

    case 'nodes-stats': {
      const node = await nitroPrisma.node.findUnique({ where: { id } })
      if (!node) {
        return { error: 'Node not found' }
      }
      let stats: Record<string, unknown> = {}
      try {
        const response = await daemonRequest({
          nodeAddress: node.address,
          nodePort: node.port,
          nodeKey: node.key,
          method: 'GET',
          path: '/stats',
        })
        stats = (response.data ?? {}) as Record<string, unknown>
      } catch {
        stats = { error: 'Unable to fetch stats from the node.' }
      }
      return { node, stats }
    }

    case 'nodes-configure': {
      const node = await nitroPrisma.node.findUnique({ where: { id } })
      if (!node) {
        return { error: 'Node not found' }
      }
      return {
        command: `configure -- -- --panel "${process.env.URL}" --key "$(cat /path/to/daemon/.env | grep ^key= | cut -d= -f2)"`,
      }
    }

    case 'servers': {
      const servers = await nitroPrisma.server.findMany({
        include: { node: true, owner: true, image: true },
        orderBy: { id: 'desc' },
      })
      return {
        servers: servers.map((s) => {
          const primaryPort = getPrimaryExternalPort(s.Ports)
          return {
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
            node: s.node
              ? { id: s.node.id, name: s.node.name, address: s.node.address }
              : null,
            owner: s.owner
              ? { id: s.owner.id, username: s.owner.username, email: s.owner.email }
              : null,
            primaryAddress:
              s.node && primaryPort ? `${s.node.address}:${primaryPort}` : null,
            createdAt: s.createdAt,
          }
        }),
      }
    }

    case 'servers-create': {
      const [users, nodes, images] = await Promise.all([
        nitroPrisma.users.findMany({ orderBy: { username: 'asc' } }),
        nitroPrisma.node.findMany({ orderBy: { name: 'asc' } }),
        nitroPrisma.images.findMany({ orderBy: { name: 'asc' } }),
      ])
      return {
        users: users.map((u) => ({ id: u.id, username: u.username, email: u.email })),
        nodes: nodes.map((n) => ({ id: n.id, name: n.name, address: n.address })),
        images: images.map((img) => ({
          id: img.id,
          name: img.name,
          startup: img.startup,
          dockerImages: img.dockerImages,
        })),
      }
    }

    case 'servers-edit': {
      const server = await nitroPrisma.server.findUnique({
        where: { id },
        include: { node: true, owner: true, image: true, serverMounts: true },
      })
      if (!server) {
        return { error: 'Server not found' }
      }
      const [users, nodes, images, mounts, serverMounts] = await Promise.all([
        nitroPrisma.users.findMany({ orderBy: { username: 'asc' } }),
        nitroPrisma.node.findMany({ orderBy: { name: 'asc' } }),
        nitroPrisma.images.findMany({ orderBy: { name: 'asc' } }),
        nitroPrisma.mount.findMany(),
        nitroPrisma.serverMount.findMany({ where: { serverId: server.UUID } }),
      ])
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
        mounts: mounts.map((m) => ({
          id: m.id,
          name: m.name,
          source: m.source,
          target: m.target,
        })),
        serverMounts: serverMounts.map((sm) => ({ mountId: sm.mountId })),
      }
    }

    case 'images': {
      const [images, pending] = await Promise.all([
        nitroPrisma.images.findMany({ orderBy: { createdAt: 'desc' } }),
        nitroPrisma.images.findMany({
          where: { status: 'pending' },
          orderBy: { createdAt: 'asc' },
        }),
      ])
      const creatorIds = [
        ...new Set(
          pending.map((i) => i.createdById).filter((x): x is number => x !== null),
        ),
      ]
      const creators =
        creatorIds.length > 0
          ? await nitroPrisma.users.findMany({
              where: { id: { in: creatorIds } },
              select: { id: true, username: true, email: true },
            })
          : []
      const creatorMap = new Map(creators.map((c) => [c.id, c]))
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
      }
    }

    case 'images-edit': {
      const image = await nitroPrisma.images.findUnique({ where: { id } })
      if (!image) {
        return { error: 'Image not found' }
      }

      let dockerImages: Record<string, string> = {}
      try {
        const parsed = JSON.parse(image.dockerImages || '[]')
        if (Array.isArray(parsed)) {
          for (const obj of parsed) {
            if (typeof obj === 'object') {
              Object.assign(dockerImages, obj)
            }
          }
        } else if (typeof parsed === 'object') {
          dockerImages = parsed
        }
      } catch {
        dockerImages = {}
      }

      let variables: unknown[] = []
      let scripts: Record<string, unknown> = {}
      let info: Record<string, unknown> = {}
      let portRequirements: unknown[] = []
      try {
        variables = JSON.parse(image.variables || '[]')
      } catch {
        variables = []
      }
      try {
        scripts = JSON.parse(image.scripts || '{}')
      } catch {
        scripts = {}
      }
      try {
        info = JSON.parse(image.info || '{}')
      } catch {
        info = {}
      }
      try {
        portRequirements = JSON.parse(image.portRequirements || '[]')
      } catch {
        portRequirements = []
      }

      const parsedImage = {
        ...image,
        dockerImages,
        variables,
        scripts,
        info,
        portRequirements,
      }

      return { image: parsedImage, imageJson: JSON.stringify(parsedImage, null, 2) }
    }

    case 'apikeys': {
      const [apiKeys, settings] = await Promise.all([
        nitroPrisma.apiKey.findMany({
          include: { user: { select: { id: true, username: true, email: true } } },
          orderBy: { id: 'desc' },
        }),
        nitroPrisma.settings.findFirst(),
      ])
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
      ]
      return { apiKeys, allPermissions, hashApiKeys: settings?.hashApiKeys === true }
    }

    case 'apikeys-docs': {
      const apiKeys = await nitroPrisma.apiKey.findMany({
        include: { user: { select: { id: true, username: true, email: true } } },
      })
      return { apiEndpoints, apiKeys }
    }

    case 'databases': {
      const hosts = await nitroPrisma.databaseHost.findMany({
        include: {
          _count: { select: { databases: true } },
          node: { select: { id: true, name: true } },
        },
        orderBy: { id: 'asc' },
      })
      return { hosts }
    }

    case 'databases-create': {
      const nodes = await nitroPrisma.node.findMany({ orderBy: { name: 'asc' } })
      return {
        nodes: nodes.map((n) => ({ id: n.id, name: n.name, address: n.address })),
      }
    }

    case 'settings': {
      const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
      return { settings, allThemes: loadAllThemes() }
    }

    case 'activity': {
      const eventFilter = typeof query.event === 'string' ? query.event : ''
      const serverFilter = typeof query.server === 'string' ? query.server : ''
      const actorFilter = typeof query.actor === 'string' ? query.actor : ''
      const fromRaw = typeof query.from === 'string' ? query.from : ''
      const toRaw = typeof query.to === 'string' ? query.to : ''
      const pageRaw = query.page
      const page = Math.max(
        1,
        getParamAsNumber(typeof pageRaw === 'string' ? pageRaw : String(pageRaw ?? '')) ||
          1,
      )
      const ACTIVITY_PAGE_SIZE = 25

      const where: Record<string, unknown> = {}
      if (eventFilter) {
        where.event = eventFilter
      }
      if (serverFilter) {
        where.serverId = serverFilter
      }
      if (actorFilter) {
        const actors = await nitroPrisma.users.findMany({
          where: {
            OR: [
              { username: { contains: actorFilter } },
              { email: { contains: actorFilter } },
            ],
          },
          select: { id: true },
        })
        where.actorId = { in: actors.map((a) => a.id) }
      }
      const createdAt: Record<string, Date> = {}
      if (fromRaw) {
        const from = new Date(`${fromRaw}T00:00:00.000Z`)
        if (!isNaN(from.getTime())) {
          createdAt.gte = from
        }
      }
      if (toRaw) {
        const to = new Date(`${toRaw}T23:59:59.999Z`)
        if (!isNaN(to.getTime())) {
          createdAt.lte = to
        }
      }
      if (Object.keys(createdAt).length > 0) {
        where.createdAt = createdAt
      }

      const [total, logs, events, actors, servers] = await Promise.all([
        nitroPrisma.activityLog.count({ where }),
        nitroPrisma.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * ACTIVITY_PAGE_SIZE,
          take: ACTIVITY_PAGE_SIZE,
          include: {
            actor: { select: { id: true, username: true, email: true } },
            server: { select: { UUID: true, name: true } },
          },
        }),
        nitroPrisma.activityLog.groupBy({
          by: ['event'],
          _count: { _all: true },
          orderBy: { event: 'asc' },
        }),
        nitroPrisma.users.findMany({
          select: { id: true, username: true, email: true },
          orderBy: { username: 'asc' },
          take: 500,
        }),
        nitroPrisma.server.findMany({
          select: { UUID: true, name: true },
          orderBy: { name: 'asc' },
          take: 500,
        }),
      ])

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
        filters: {
          event: eventFilter,
          server: serverFilter,
          actor: actorFilter,
          from: fromRaw,
          to: toRaw,
        },
      }
    }

    case 'mounts': {
      const mounts = await nitroPrisma.mount.findMany({
        include: { _count: { select: { servers: true } } },
        orderBy: { id: 'asc' },
      })
      return { mounts }
    }

    case 'addons': {
      const addons = await getAllAddons()
      const addonsDir = path.join(projectRoot(), 'storage', 'addons')
      const addonsWithMeta = addons.map((addon) => {
        const addonDir = path.join(addonsDir, addon.slug)
        const packageJsonPath = path.join(addonDir, 'package.json')
        const result = parseAddonManifest(packageJsonPath, addon.slug)
        const hasDisabledPh = fs.existsSync(path.join(addonDir, 'disabled.ph'))
        if (!result.success) {
          return { ...addon, manifest: null, hasDisabledPh }
        }
        return { ...addon, manifest: result.manifest, hasDisabledPh }
      })
      return { addons: addonsWithMeta }
    }

    case 'images-store': {
      try {
        const data = getCatalogue()
        return { catalogue: data }
      } catch (error) {
        console.error('Error loading egg store catalogue:', error)
        return { catalogue: { images: [], builtAt: 0 } }
      }
    }

    case 'addons-store': {
      return { unavailable: true, message: 'Addon store is not available yet.' }
    }

    case 'menu': {
      return { sidebarGroups: uiComponentStore.getAdminSidebarGroups() }
    }

    default:
      return { error: 'Unknown admin page.' }
  }
}
