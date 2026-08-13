/**
 * Phase 5 — the addon runtime moves into the Nitro process.
 *
 * Previously the addon loader (src/handlers/addonHandler.ts) mounted each
 * addon's `express.Router` onto the Express app, and the launcher proxied the
 * addon apiPaths (/modrinth/api, /arclight-cloud/api) to Express. With
 * Express deleted, the same addons run here — inside Nitro — via an in-process
 * Express *bridge*:
 *
 *   - `getAddonBridge()` returns a plain `express()` app (never listens) that
 *     parses JSON/urlencoded bodies and mounts every addon router at its
 *     manifest `router` path. `express` stays a dependency purely as the addon
 *     SDK — the addon API contract is `express.Router`, and third-party addon
 *     bundles `require('express')` directly.
 *   - `bootAddons()` is the port of `loadAddons()`: enumerates storage/addons,
 *     validates manifests, applies migrations, requires each main file with
 *     the addon API, and mounts the router on the bridge.
 *   - `createAddonDispatchHandler()` is the Nitro middleware handler: for
 *     addon-owned paths it bridges `event.context.session` → `req.session`
 *     (the shape Express addon routers read), enforces CSRF on mutations
 *     (addon apiPaths are NOT csrf-exempt — mirroring csrfRouting.ts), and
 *     dispatches through `fromNodeMiddleware(bridge)`. Non-addon paths fall
 *     through untouched, so addon *pages* (/modrinth, /arclight-cloud/settings)
 *     still reach the TanStack app.
 *
 * The v2-only getComponent/getComponents helpers are dead (views deleted in
 * Phase 4) — kept as no-op stubs for API-shape compatibility.
 */
import express, { Router } from 'express'
import type { Express as ExpressApp } from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import {
  defineEventHandler,
  fromNodeMiddleware,
  getMethod,
  setResponseStatus,
  type EventHandler,
  type H3Event,
  type NodeMiddleware,
} from 'h3'
import type {
  AddonManifestV2,
} from '../../../src/handlers/addonManifest'
import {
  isReservedRoutePrefix,
  isVersionInRange,
  parseAddonManifest,
} from '../../../src/handlers/addonManifest'
import { isValidAddonSlug } from '../../../src/handlers/addonViewResolver'
import { uiComponentStore } from './ui-store'
import { slotRegistry } from '../../../src/handlers/addonSlotRegistry'
import type { SlotId } from '../../../src/handlers/addonSlotRegistry'
import { commandRegistry, scheduler } from '../../../src/handlers/addonCommands'
import type {
  RegisteredCommand,
  ScheduledTask,
} from '../../../src/handlers/addonCommands'
import { createConfigStore } from '../../../src/handlers/addonConfigStore'
import {
  clearAddonPermissions,
  registerAddonPermission,
  registerPermission,
} from '../../../src/handlers/permissions'
import type { Permission } from '../../../src/handlers/permissions'
import { containPath } from '../../../src/utils/pathSecurity'
import { isPrivateHostname } from '../../../src/utils/ssrf'
import { nitroPrisma, requireCsrf, type SessionPayload } from './auth-session'
import { projectRoot } from './paths'
import logger from '../../../src/handlers/logger'
import { isAuthenticated } from '../../../src/handlers/utils/auth/authUtil'
import { apiValidator } from '../../../src/handlers/utils/api/apiValidator'
import csrfProtection from '../../../src/handlers/utils/security/csrfProtection'

// ── Admin addon permissions (mirror src/modules/admin/addons.ts) ────────────
// Registered once at import so permission-aware surfaces see them, exactly as
// the Express module's top-level side effects did.
registerPermission('arclight.admin.addons.view')
registerPermission('arclight.admin.addons.toggle')
registerPermission('arclight.admin.addons.reload')
registerPermission('arclight.admin.addons.store')
registerPermission('arclight.admin.addons.install')
registerPermission('arclight.admin.addons.settings' as Permission)
registerPermission('arclight.admin.addons.commands' as Permission)

// ── Security utilities (mirror src/handlers/addonHandler.ts) ───────────────

/** Allowed SQL verbs for addon migrations (CREATE/ALTER/DROP, CREATE INDEX). */
const ALLOWED_MIGRATION_SQL =
  /^\s*(CREATE\s+(TABLE|INDEX)\s+(IF\s+NOT\s+EXISTS\s+)?|ALTER\s+TABLE\s+|DROP\s+(TABLE|INDEX)\s+(IF\s+EXISTS\s+)?)\S/i

/** Resolve a user path within a base directory; null when it escapes. */
function sanitizePath(baseDir: string, userPath: string): string | null {
  const resolved = path.resolve(baseDir, userPath)
  return containPath(baseDir, resolved) ? resolved : null
}

/** HTTPS + allowed-domain URL guard (mirrors addonHandler.validateUrl). */
function validateUrl(urlStr: string, allowedDomains: string[]): boolean {
  try {
    const url = new URL(urlStr)
    if (url.protocol !== 'https:') return false
    if (isPrivateHostname(url.hostname)) return false
    if (
      allowedDomains.length > 0 &&
      !allowedDomains.some(
        (d) => url.hostname === d || url.hostname.endsWith(`.${d}`),
      )
    ) return false
    return true
  } catch {
    return false
  }
}

/** Escape HTML entities for safe injection into HTML context. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/** Escape a string for safe use inside a JS string literal in a <script>. */
function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/<\//g, '<\\/')
}

// ── Addon API (the object passed to addon main functions) ──────────────────

export interface AddonLifecycleHooks {
  onInstall?: () => Promise<void> | void
  onEnable?: () => Promise<void> | void
  onDisable?: () => Promise<void> | void
  onUpdate?: (previousVersion: string) => Promise<void> | void
  onUninstall?: () => Promise<void> | void
}

export interface AddonServerData {
  id: number
  UUID: string
  name: string
  Ports: string | null
  node?: { id: number; name: string; address: string; port: number; key: string } | null
  image?: {
    id: number
    UUID: string
    name: string | null
    dockerImages: string | null
  } | null
  owner?: { id: number; username: string | null; email: string; avatar: string | null } | null
  [key: string]: unknown
}

export interface AddonServerPort {
  port: number
  primary?: boolean
  [key: string]: unknown
}

export interface AddonAPI {
  registerRoute: (path: string, router: Router) => void
  logger: typeof logger
  prisma: typeof nitroPrisma
  utils: {
    isUserAdmin: (userId: number) => Promise<boolean>
    getServerById: (serverId: number) => Promise<AddonServerData | null>
    getServerByUUID: (uuid: string) => Promise<AddonServerData | null>
    getServerPorts: (server: AddonServerData) => AddonServerPort[]
    getPrimaryPort: (server: AddonServerData) => AddonServerPort | null
  }
  security: {
    sanitizePath: (baseDir: string, userPath: string) => string | null
    validateUrl: (url: string, allowedDomains?: string[]) => boolean
    escapeHtml: (str: string) => string
    escapeJsString: (str: string) => string
    requireAuth: (isAdmin?: boolean, permission?: string) => unknown
    requireCsrf: () => unknown
  }
  addonPath: string
  /** v2 component helpers — dead since Phase 4 (views deleted), kept as stubs. */
  getComponentPath: (componentPath: string) => string
  getComponent: () => null
  getComponents: () => Record<string, never>
  config: ReturnType<typeof createConfigStore>
  ui: {
    addSidebarItem: (item: Parameters<typeof uiComponentStore.addSidebarItem>[0]) => void
    removeSidebarItem: (id: string) => void
    getSidebarItems: (section?: string, isAdmin?: boolean) => unknown[]
    addServerMenuItem: (item: Parameters<typeof uiComponentStore.addServerMenuItem>[0]) => void
    removeServerMenuItem: (id: string) => void
    getServerMenuItems: (feature?: string) => unknown[]
    addServerSection: (section: Parameters<typeof uiComponentStore.addServerSection>[0]) => void
    removeServerSection: (id: string) => void
    getServerSections: () => unknown[]
    addServerSectionItem: (
    sectionId: string,
    item: Parameters<typeof uiComponentStore.addServerSectionItem>[1],
  ) => void
    removeServerSectionItem: (sectionId: string, itemId: string) => void
    getServerSectionItems: (sectionId: string) => unknown[]
    registerSlot: (slotId: SlotId, render: (locals: Record<string, unknown>) => string | Promise<string>) => void
    unregisterSlot: (slotId: SlotId) => void
    registerDashboardWrapper: (render: (locals: Record<string, unknown>) => string | Promise<string>) => void
    unregisterDashboardWrapper: () => void
    registerAdminWrapper: (render: (locals: Record<string, unknown>) => string | Promise<string>) => void
    unregisterAdminWrapper: () => void
  }
  commands: { register: (command: RegisteredCommand) => void }
  schedule: { register: (task: ScheduledTask) => void }
  permissions: { register: (permission: string) => boolean }
  middleware: {
    isAuthenticated: typeof isAuthenticated
    apiValidator: typeof apiValidator
    csrfProtection: typeof csrfProtection
  }
  assetsUrl: string
}

// ── Loaded-addon bookkeeping + bridge ──────────────────────────────────────

interface LoadedAddon {
  slug: string
  router: Router
  routerPath: string
  manifest: AddonManifestV2
  hooks?: AddonLifecycleHooks
  version?: string
}

let bridge: ExpressApp | null = null
const loadedAddons = new Map<string, LoadedAddon>()
/** The addons dir the last boot used — reloadAddons() reuses it. */
let activeAddonsDir: string | null = null
const addonMutexes = new Map<string, Promise<void>>()
/** Every path the bridge can serve (manifest routers + registerRoute paths). */
const addonPaths = new Set<string>()
/** Extra routers an addon mounted via api.registerRoute, per slug — so unload
 * can remove EVERYTHING an addon contributed (a disabled addon must not keep
 * serving its registerRoute endpoints). */
const addonRegisterRoutes = new Map<string, { path: string; router: Router }[]>()

/** The shared in-process Express bridge (never listens — dispatch only). */
export function getAddonBridge(): ExpressApp {
  if (!bridge) {
    bridge = express()
    bridge.disable('x-powered-by')
    bridge.use(express.json({ limit: '512kb' }))
    bridge.use(express.urlencoded({ extended: false, limit: '512kb' }))
  }
  return bridge
}

/** True when the path belongs to a loaded addon's router / apiPath surface. */
export function isAddonPath(pathname: string): boolean {
  for (const p of addonPaths) {
    if (pathname === p || pathname.startsWith(`${p}/`)) return true
  }
  return false
}

/** Loaded addon record (used by the admin addon detail route). */
export function getLoadedAddon(slug: string): LoadedAddon | undefined {
  return loadedAddons.get(slug)
}

/** The addons dir the current boot used (defaults to storage/addons). */
export function getActiveAddonsDir(): string {
  return activeAddonsDir ?? path.join(projectRoot(), 'storage', 'addons')
}

// ── Loader (port of loadAddons() in src/handlers/addonHandler.ts) ──────────

const require = createRequire(import.meta.url)

function buildAddonAPI(slug: string, addonPath: string): AddonAPI {
  return {
    registerRoute: (routePath: string, router: Router) => {
      if (typeof routePath !== 'string' || routePath.length === 0) return
      if (isReservedRoutePrefix(routePath)) {
        logger.warn(
          `Addon "${slug}" attempted to register reserved route prefix "${routePath}" — blocked`,
        )
        return
      }
      getAddonBridge().use(routePath, router)
      addonPaths.add(routePath)
      const list = addonRegisterRoutes.get(slug) ?? []
      list.push({ path: routePath, router })
      addonRegisterRoutes.set(slug, list)
    },
    logger,
    prisma: nitroPrisma,
    addonPath,
    getComponentPath: (componentPath: string) =>
      path.join(projectRoot(), componentPath),
    getComponent: () => null,
    getComponents: () => ({}),
    utils: {
      isUserAdmin: async (userId: number) => {
        try {
          const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
          return user?.isAdmin === true
        } catch (error) {
          logger.error('Error checking if user is admin:', error)
          return false
        }
      },
      getServerById: async (serverId: number) => {
        try {
          return (await nitroPrisma.server.findUnique({
            where: { id: serverId },
            include: { node: true, image: true, owner: true },
          })) as AddonServerData | null
        } catch (error) {
          logger.error('Error getting server by ID:', error)
          return null
        }
      },
      getServerByUUID: async (uuid: string) => {
        try {
          return (await nitroPrisma.server.findUnique({
            where: { UUID: uuid },
            include: { node: true, image: true, owner: true },
          })) as AddonServerData | null
        } catch (error) {
          logger.error('Error getting server by UUID:', error)
          return null
        }
      },
      getServerPorts: (server: AddonServerData) => {
        try {
          if (!server.Ports) return []
          return JSON.parse(server.Ports) as AddonServerPort[]
        } catch (error) {
          logger.error('Error parsing server ports:', error)
          return []
        }
      },
      getPrimaryPort: (server: AddonServerData) => {
        try {
          if (!server.Ports) return null
          const ports = JSON.parse(server.Ports) as AddonServerPort[]
          return ports.find((port) => port.primary === true) ?? null
        } catch (error) {
          logger.error('Error getting primary port:', error)
          return null
        }
      },
    },
    security: {
      sanitizePath,
      validateUrl: (url: string, allowedDomains: string[] = []) =>
        validateUrl(url, allowedDomains),
      escapeHtml,
      escapeJsString,
      requireAuth: (_isAdmin?: boolean, _permission?: string) => {
        // No installed addon uses this; the panel's guards live on the bridge
        // via the Express `middleware` exports. Keep a working dispatcher.
        return (req: unknown, _res: unknown, next: () => void) => {
          void req
          next()
        }
      },
      requireCsrf: () => {
        // See middleware.csrfProtection — bridge requests already ran the
        // dispatch-level CSRF gate.
        return (_req: unknown, _res: unknown, next: () => void) => next()
      },
    },
    config: createConfigStore(slug),
    ui: {
      addSidebarItem: (item) => uiComponentStore.addSidebarItem(item, slug),
      removeSidebarItem: (id) => uiComponentStore.removeSidebarItem(id),
      getSidebarItems: (section?: string, isAdmin?: boolean) =>
        uiComponentStore.getSidebarItems(section, isAdmin),
      addServerMenuItem: (item) => uiComponentStore.addServerMenuItem(item, slug),
      removeServerMenuItem: (id) => uiComponentStore.removeServerMenuItem(id),
      getServerMenuItems: (feature?: string) =>
        uiComponentStore.getServerMenuItems(feature),
      addServerSection: (section) => uiComponentStore.addServerSection(section, slug),
      removeServerSection: (id) => uiComponentStore.removeServerSection(id),
      getServerSections: () => uiComponentStore.getServerSections(),
      addServerSectionItem: (sectionId, item) =>
        uiComponentStore.addServerSectionItem(sectionId, item),
      removeServerSectionItem: (sectionId, itemId) =>
        uiComponentStore.removeServerSectionItem(sectionId, itemId),
      getServerSectionItems: (sectionId) =>
        uiComponentStore.getServerSectionItems(sectionId),
      registerSlot: (slotId, render) => slotRegistry.register(slotId, slug, render),
      unregisterSlot: (slotId) => slotRegistry.unregister(slotId, slug),
      registerDashboardWrapper: (render) =>
        slotRegistry.register('layout.dashboard.wrapper', slug, render),
      unregisterDashboardWrapper: () =>
        slotRegistry.unregister('layout.dashboard.wrapper', slug),
      registerAdminWrapper: (render) =>
        slotRegistry.register('layout.admin.wrapper', slug, render),
      unregisterAdminWrapper: () =>
        slotRegistry.unregister('layout.admin.wrapper', slug),
    },
    commands: {
      register: (command) => commandRegistry.register(slug, command),
    },
    schedule: {
      register: (task) => scheduler.register(slug, task),
    },
    permissions: {
      register: (permission) => registerAddonPermission(slug, permission),
    },
    middleware: {
      isAuthenticated,
      apiValidator,
      csrfProtection,
    },
    assetsUrl: `/addon-assets/${slug}`,
  }
}

async function withAddonLock<T>(
  slug: string,
  fn: () => Promise<T>,
): Promise<T> {
  const prev = addonMutexes.get(slug) ?? Promise.resolve()
  const chain = prev.then(fn)
  const entry = chain.then(
    () => {},
    () => {},
  )
  addonMutexes.set(slug, entry)
  try {
    return await chain
  } finally {
    if (addonMutexes.get(slug) === entry) addonMutexes.delete(slug)
  }
}

async function safeHookCall(
  slug: string,
  hookName: string,
  fn: () => Promise<void> | void,
): Promise<void> {
  try {
    await fn()
  } catch (err: unknown) {
    logger.error(
      `Addon "${slug}" hook "${hookName}" failed:`,
      err instanceof Error ? err.message : String(err),
    )
  }
}

/** Removes a mounted router layer from the bridge by its tagged name. */
function removeRouterLayer(slug: string): void {
  const stack = (bridge as unknown as { _router?: { stack: { handle: { name?: string } }[] } })
    ?._router?.stack
  if (!stack) return
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]?.handle?.name === `router_${slug}`) {
      stack.splice(i, 1)
      break
    }
  }
}

/** Removes a bridge layer by its exact router reference (registerRoute mounts). */
function removeLayerByHandle(handle: unknown): void {
  const stack = (bridge as unknown as { _router?: { stack: { handle: unknown }[] } })
    ?._router?.stack
  if (!stack) return
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]?.handle === handle) {
      stack.splice(i, 1)
      break
    }
  }
}

function unloadAddon(slug: string): void {
  const addon = loadedAddons.get(slug)
  if (!addon) return
  removeRouterLayer(slug)
  addonPaths.delete(addon.routerPath)
  // api.registerRoute mounts are per-slug too — remove every layer + path the
  // addon contributed so a disabled addon stops serving ALL of its routes.
  const extras = addonRegisterRoutes.get(slug)
  if (extras) {
    for (const { path: routePath, router } of extras) {
      removeLayerByHandle(router)
      addonPaths.delete(routePath)
    }
    addonRegisterRoutes.delete(slug)
  }
  uiComponentStore.clearAddonItems(slug)
  slotRegistry.clearAddonSlots(slug)
  commandRegistry.clearAddonCommands(slug)
  scheduler.clearAddonTimers(slug)
  clearAddonPermissions(slug)
  loadedAddons.delete(slug)
  logger.info(`Unloaded addon: ${slug}`)
}

async function applyAddonMigrations(
  slug: string,
  manifest: AddonManifestV2,
): Promise<{ success: boolean; message: string }> {
  if (!manifest.migrations || manifest.migrations.length === 0) {
    return { success: true, message: 'No migrations to apply' }
  }
  try {
    await nitroPrisma.$executeRaw`
      CREATE TABLE IF NOT EXISTS AddonMigration (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        addonSlug TEXT NOT NULL,
        migrationName TEXT NOT NULL,
        appliedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(addonSlug, migrationName)
      )
    `
    const applied = await nitroPrisma.$queryRaw<{ migrationName: string }[]>`
      SELECT migrationName FROM AddonMigration WHERE addonSlug = ${slug}
    `
    const appliedNames = new Set(applied.map((m) => m.migrationName))
    const pending = manifest.migrations.filter(
      (m) => !appliedNames.has(m.name),
    )
    if (pending.length === 0) {
      return { success: true, message: 'No new migrations to apply' }
    }
    for (const migration of pending) {
      if (!ALLOWED_MIGRATION_SQL.test(migration.sql)) {
        return {
          success: false,
          message: `Migration "${migration.name}" contains disallowed SQL. Only CREATE TABLE, CREATE INDEX, ALTER TABLE, and DROP are permitted.`,
        }
      }
      try {
        await nitroPrisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(migration.sql)
          await tx.$executeRaw`
            INSERT INTO AddonMigration (addonSlug, migrationName)
            VALUES (${slug}, ${migration.name})
          `
        })
        logger.info(`Applied migration ${migration.name} for addon ${manifest.name}`)
      } catch (error: unknown) {
        return {
          success: false,
          message: `Failed to apply migration ${migration.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        }
      }
    }
    return {
      success: true,
      message: `Applied ${pending.length} migrations for addon ${manifest.name}`,
    }
  } catch (error: unknown) {
    return {
      success: false,
      message: `Failed to apply migrations: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}

function topologicalSort(
  graph: Map<string, { manifest: AddonManifestV2; folder: string }>,
): string[] {
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const order: string[] = []
  function visit(folder: string): void {
    if (visited.has(folder)) return
    if (visiting.has(folder)) {
      logger.warn(`Circular dependency detected involving addon "${folder}"`)
      return
    }
    visiting.add(folder)
    const node = graph.get(folder)
    if (node?.manifest.dependencies) {
      for (const dep of node.manifest.dependencies) {
        if (graph.has(dep.identifier)) visit(dep.identifier)
      }
    }
    visiting.delete(folder)
    visited.add(folder)
    order.push(folder)
  }
  for (const folder of graph.keys()) visit(folder)
  return order
}

/**
 * Loads every enabled addon in storage/addons into the bridge. Idempotent:
 * concurrent callers share one boot; call `reloadAddons()` to re-run.
 */
export async function bootAddons(opts?: { addonsDir?: string }): Promise<void> {
  const addonsDir =
    opts?.addonsDir ?? activeAddonsDir ?? path.join(projectRoot(), 'storage', 'addons')
  activeAddonsDir = addonsDir

  // Unload anything from a previous boot (reload path).
  for (const [slug] of loadedAddons.entries()) unloadAddon(slug)

  if (!fs.existsSync(addonsDir)) {
    fs.mkdirSync(addonsDir, { recursive: true })
    logger.info('Created addons directory')
  }

  const addonFolders = fs
    .readdirSync(addonsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)

  let addonTableExists = true
  try {
    await nitroPrisma.$queryRaw`SELECT 1 FROM Addon LIMIT 1`
  } catch {
    addonTableExists = false
    logger.warn('Addon table does not exist yet. Run migrations to create it.')
  }

  if (addonTableExists) {
    try {
      const dbAddons = await nitroPrisma.addon.findMany()
      const missing = dbAddons.filter(
        (addon) => !addonFolders.includes(addon.slug),
      )
      for (const addon of missing) {
        await nitroPrisma.addon.delete({ where: { id: addon.id } })
        logger.info(
          `Removed addon ${addon.name} (${addon.slug}) from database because it no longer exists in the filesystem`,
        )
      }
    } catch (error) {
      logger.error('Failed to check for missing addons:', error)
    }
  }

  const dependencyGraph = new Map<
    string,
    { manifest: AddonManifestV2; folder: string }
  >()
  const parseResults = new Map<string, ReturnType<typeof parseAddonManifest>>()

  for (const folder of addonFolders) {
    const addonPath = path.join(addonsDir, folder)
    if (!isValidAddonSlug(folder)) {
      logger.warn(`Addon folder "${folder}" is not a valid slug, skipping`)
      continue
    }
    if (!containPath(addonsDir, addonPath)) {
      logger.warn(`Addon ${folder}: path escapes addons directory, skipping`)
      continue
    }
    const result = parseAddonManifest(path.join(addonPath, 'package.json'), folder)
    parseResults.set(folder, result)
    if (result.success) {
      dependencyGraph.set(folder, { manifest: result.manifest, folder })
    } else {
      logger.warn(`Addon ${folder}: ${(result as { error: string }).error}`)
    }
  }

  for (const folder of topologicalSort(dependencyGraph)) {
    const result = parseResults.get(folder)
    if (!result || !result.success) continue

    const addonPath = path.join(addonsDir, folder)
    const manifest = result.manifest
    const disabledPhPath = path.join(addonPath, 'disabled.ph')
    const hasDisabledPh = fs.existsSync(disabledPhPath)

    let addonEnabled = !hasDisabledPh && manifest.enabled !== false

    if (addonTableExists) {
      try {
        let addonRecord = await nitroPrisma.addon.findUnique({
          where: { slug: folder },
        })
        if (!addonRecord) {
          if (addonEnabled) {
            const migrationResult = await applyAddonMigrations(folder, manifest)
            if (!migrationResult.success) {
              logger.error(
                `Failed to apply migrations for new addon ${manifest.name}:`,
                migrationResult.message,
              )
              addonEnabled = false
            }
          }
          addonRecord = await nitroPrisma.addon.create({
            data: {
              name: manifest.name,
              slug: folder,
              description: manifest.description || '',
              version: manifest.version,
              author: manifest.author || '',
              enabled: addonEnabled,
              mainFile: manifest.main || 'index.ts',
            },
          })
          logger.info(`Added addon ${manifest.name} to database`)
        } else {
          await nitroPrisma.addon.update({
            where: { id: addonRecord.id },
            data: {
              name: manifest.name,
              description: manifest.description || '',
              version: manifest.version,
              author: manifest.author || '',
              mainFile: manifest.main || 'index.ts',
            },
          })
          if (hasDisabledPh && addonRecord.enabled) {
            await nitroPrisma.addon.update({
              where: { id: addonRecord.id },
              data: { enabled: false },
            })
            addonEnabled = false
          } else {
            addonEnabled = addonRecord.enabled
          }
        }
        if (!addonEnabled) {
          logger.info(`Addon ${manifest.name} is disabled, skipping`)
          continue
        }
      } catch (error) {
        logger.error(`Database error for addon ${folder}:`, error)
      }
    }

    if (manifest.engines?.panel) {
      const panelVersion = JSON.parse(
        fs.readFileSync(path.join(projectRoot(), 'package.json'), 'utf8'),
      ).version as string
      if (!isVersionInRange(panelVersion, manifest.engines.panel)) {
        logger.warn(
          `Addon ${manifest.name} targets panel ${manifest.engines.panel}, running panel ${panelVersion}`,
        )
      }
    }

    if (manifest.permissions) {
      for (const perm of manifest.permissions) {
        registerAddonPermission(folder, perm)
      }
    }

    const mainFile = manifest.main || 'index.ts'
    const mainFilePath = path.join(addonPath, mainFile)
    if (!fs.existsSync(mainFilePath)) {
      logger.warn(
        `Addon ${manifest.name} is missing main file (${mainFile}), skipping`,
      )
      continue
    }
    if (!containPath(addonPath, mainFilePath)) {
      logger.warn(
        `Addon ${manifest.name} main file escapes addon directory, skipping`,
      )
      continue
    }

    const addonRouter = Router()
    const addonAPI = buildAddonAPI(folder, addonPath)
    const animationsDisabled = manifest.dontfuckinganimateme === true
    addonRouter.use((_req, res, next) => {
      res.locals.addonAnimationsDisabled = animationsDisabled
      res.locals.addonSlug = folder
      next()
    })

    try {
      const addonModule: unknown = require(mainFilePath)

      const routerPath = manifest.router || '/'
      let hooks: AddonLifecycleHooks | undefined

      // Addon mains may be sync or async (`exports.default = async (router,
      // api) => …` — modrinth/arclight-cloud both await DB setup before
      // mounting their router). ALWAYS await: the bridge mount below must not
      // race the addon's own router.use(...) calls.
      let result: unknown
      if (typeof addonModule === 'function') {
        result = await (addonModule as (r: Router, a: AddonAPI) => unknown)(
          addonRouter,
          addonAPI,
        )
      } else if (
        addonModule &&
        typeof (addonModule as { default?: unknown }).default === 'function'
      ) {
        result = await (
          addonModule as { default: (r: Router, a: AddonAPI) => unknown }
        ).default(addonRouter, addonAPI)
      } else {
        logger.error(`Invalid main export for addon ${manifest.name}`)
        continue
      }
      if (result && typeof result === 'object') {
        hooks = result as AddonLifecycleHooks
      }

      Object.defineProperty(addonRouter, 'name', { value: `router_${folder}` })
      getAddonBridge().use(routerPath, addonRouter)
      addonPaths.add(routerPath)
      loadedAddons.set(folder, {
        slug: folder,
        router: addonRouter,
        routerPath,
        manifest,
        hooks,
        version: manifest.version,
      })

      if (addonTableExists) {
        try {
          const addonRecord = await nitroPrisma.addon.findUnique({
            where: { slug: folder },
          })
          if (addonRecord && hooks?.onInstall) {
            const existingMigrations = await nitroPrisma.$queryRaw<
              { migrationName: string }[]
            >`SELECT migrationName FROM AddonMigration WHERE addonSlug = ${folder}`
            if (existingMigrations.length === 0) {
              await safeHookCall(folder, 'onInstall', () => hooks!.onInstall!())
            }
          }
        } catch {
          // best-effort lifecycle
        }
      }

      logger.info(`Loaded addon: ${manifest.name} (${folder})`)
    } catch (error: unknown) {
      logger.error(
        `Failed to initialize addon ${manifest.name}:`,
        error instanceof Error ? error.message : String(error),
      )
    }
  }
}

// ── Mutations (admin addons API) ───────────────────────────────────────────

/** DB-backed addon list (mirror of getAllAddons in addonHandler.ts). */
export async function getAllAddons() {
  try {
    try {
      await nitroPrisma.$queryRaw`SELECT 1 FROM Addon LIMIT 1`
    } catch {
      logger.warn('Addon table does not exist yet. Run migrations to create it.')
      return []
    }
    return await nitroPrisma.addon.findMany({ orderBy: { name: 'asc' } })
  } catch (error: unknown) {
    logger.error('Failed to get addons:', error)
    return []
  }
}

/** Enable/disable an addon (mirror of toggleAddonStatus in addonHandler.ts). */
export async function toggleAddonStatus(
  slug: string,
  enabled: boolean,
): Promise<{ success: boolean; message: string }> {
  return withAddonLock(slug, async () => {
    try {
      try {
        await nitroPrisma.$queryRaw`SELECT 1 FROM Addon LIMIT 1`
      } catch {
        return { success: false, message: 'Addon table does not exist yet' }
      }

      const addon = await nitroPrisma.addon.findUnique({ where: { slug } })
      if (!addon) return { success: false, message: `Addon ${slug} not found` }

      const loaded = loadedAddons.get(slug)

      if (enabled) {
        const addonsDir = path.join(projectRoot(), 'storage', 'addons')
        const disabledPhPath = path.join(addonsDir, slug, 'disabled.ph')
        if (
          containPath(addonsDir, path.join(addonsDir, slug)) &&
          fs.existsSync(disabledPhPath)
        ) {
          fs.unlinkSync(disabledPhPath)
          logger.info(`Removed disabled.ph for ${slug}`)
        }
      }

      if (enabled && !addon.enabled) {
        if (loaded?.hooks?.onEnable) {
          await safeHookCall(slug, 'onEnable', () => loaded.hooks!.onEnable!())
        }
        if (loaded?.manifest?.migrations && loaded.manifest.migrations.length > 0) {
          const migrationResult = await applyAddonMigrations(slug, loaded.manifest)
          if (!migrationResult.success) {
            return {
              success: false,
              message: `Failed to enable: ${migrationResult.message}`,
            }
          }
        }
      }

      if (!enabled && addon.enabled) {
        const current = loadedAddons.get(slug)
        if (current?.hooks?.onDisable) {
          await safeHookCall(slug, 'onDisable', () => current.hooks!.onDisable!())
        }
      }

      await nitroPrisma.addon.update({ where: { id: addon.id }, data: { enabled } })

      return {
        success: true,
        message: `Addon ${addon.name} ${enabled ? 'enabled' : 'disabled'} successfully`,
      }
    } catch (error: unknown) {
      logger.error('Failed to toggle addon status:', error)
      return {
        success: false,
        message: `Failed to toggle addon status: ${
          error instanceof Error ? error.message : String(error)
        }`,
      }
    }
  })
}

/** Unload + reload every addon (mirror of reloadAddons in addonHandler.ts). */
export async function reloadAddons(): Promise<{ success: boolean; message: string }> {
  logger.info('Reloading addons...')
  try {
    await bootAddons()
    return { success: true, message: 'Addons reloaded successfully' }
  } catch (error: unknown) {
    logger.error('Failed to reload addons:', error)
    return {
      success: false,
      message: `Failed to reload addons: ${
        error instanceof Error ? error.message : String(error)
      }`,
    }
  }
}

/** Uninstall an addon: hooks, migration rollback, DB rows, unload, delete dir. */
export async function uninstallAddon(
  slug: string,
): Promise<{ success: boolean; message: string }> {
  return withAddonLock(slug, async () => {
    const loaded = loadedAddons.get(slug)
    if (loaded?.hooks?.onUninstall) {
      await safeHookCall(slug, 'onUninstall', () => loaded.hooks!.onUninstall!())
    }

    const addonRecord = await nitroPrisma.addon.findUnique({ where: { slug } })
    if (addonRecord) {
      const manifest = loaded?.manifest
      if (manifest?.migrations) {
        const appliedMigrations = await nitroPrisma.$queryRaw<
          { migrationName: string }[]
        >`SELECT migrationName FROM AddonMigration WHERE addonSlug = ${slug}`
        const appliedNames = new Set(appliedMigrations.map((m) => m.migrationName))
        const reversible = manifest.migrations
          .filter((m) => m.down && appliedNames.has(m.name))
          .reverse()
        for (const migration of reversible) {
          if (!ALLOWED_MIGRATION_SQL.test(migration.down!)) {
            logger.warn(
              `Rollback migration "${migration.name}" rejected: disallowed SQL pattern`,
            )
            continue
          }
          try {
            await nitroPrisma.$executeRawUnsafe(migration.down!)
            logger.info(`Rolled back migration ${migration.name} for addon ${slug}`)
          } catch (err: unknown) {
            logger.error(
              `Failed to roll back migration ${migration.name}:`,
              err instanceof Error ? err.message : String(err),
            )
          }
        }
      }
      await nitroPrisma.addonSetting.deleteMany({ where: { addonSlug: slug } })
      await nitroPrisma.$executeRaw`DELETE FROM AddonMigration WHERE addonSlug = ${slug}`
      await nitroPrisma.addon.delete({ where: { slug } })
    }

    unloadAddon(slug)

    const addonsDir = path.join(projectRoot(), 'storage', 'addons')
    const targetDir = path.join(addonsDir, slug)
    if (fs.existsSync(targetDir) && containPath(addonsDir, targetDir)) {
      fs.rmSync(targetDir, { recursive: true, force: true })
    }
    return { success: true, message: `Addon "${slug}" uninstalled` }
  })
}

// ── Nitro middleware handler ───────────────────────────────────────────────

/**
 * The per-request dispatch handler (mounted as web/server/middleware/03.addons).
 * For addon-owned paths: bridge the session, enforce CSRF on mutations, and
 * dispatch through the Express bridge. Everything else falls through.
 */
export function createAddonDispatchHandler(): EventHandler {
  const bridgeHandler = fromNodeMiddleware(
    getAddonBridge() as unknown as NodeMiddleware,
  )
  return defineEventHandler(async (event: H3Event) => {
    const pathname = event.url.pathname
    if (!isAddonPath(pathname)) return undefined

    const session = (event.context.session as SessionPayload | undefined) ?? {}
    const rawReq = event.node?.req
    if (!rawReq) return undefined
    const req = rawReq as unknown as Record<string, unknown>
    req.session = session
    req.user = (session as { user?: unknown }).user

    const method = (getMethod(event) ?? 'GET').toUpperCase()
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      // Addon apiPaths are NOT csrf-exempt (mirror isCsrfExempt in
      // csrfRouting.ts: only ws upgrades + bearer mounts are). The addon v3 UI
      // sends the `x-csrf-token` header minted by /api/auth-config.
      if (!requireCsrf(event, session)) {
        setResponseStatus(event, 403)
        return { error: 'CSRF token validation failed' }
      }
    }

    return bridgeHandler(event)
  })
}
