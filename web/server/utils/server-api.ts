/**
 * Shared Nitro-side helpers for the Phase 2 group 3b/3c/3d server APIs
 * (console/power/status/logs/ws-token/players/eula, files, and the tab CRUD
 * mutations). Each mirrors the corresponding Express helper in
 * src/modules/user/server/{shared,console,files,schedules,databases,backups,
 * subusers}.ts exactly so payloads and status codes stay byte-identical
 * across the seam (D3).
 */
import { setResponseStatus, type H3Event } from 'h3'
import type { Users } from '../../../src/generated/prisma/client'
import { getRequestHeader } from 'h3'
import {
  nitroPrisma,
  type SessionPayload,
} from './auth-session'
import { getClientIp, requireServerAccess, type GuardOutcome } from './auth'
import { requireTabPermission, serverPageInclude, type TabServerContext } from './server-tabs'
import { getPrimaryExternalPort } from '../../../src/handlers/utils/server/ports'

/** Mirror of getImageFeatures() in src/modules/user/server/shared.ts. */
export function getImageFeatures(
  image: { info?: string | null } | null | undefined,
): string[] {
  if (!image) {
    return []
  }
  try {
    const info =
      typeof image.info === 'string' ? JSON.parse(image.info) : image.info
    return Array.isArray(info?.features) ? info.features : []
  } catch {
    return []
  }
}

/** Mirror of getServerStatusInput() in src/modules/user/server/shared.ts. */
export function getServerStatusInput(server: {
  UUID: string
  node: { address: string; port: number; key: string }
}) {
  return {
    nodeAddress: server.node.address,
    nodePort: server.node.port,
    serverUUID: server.UUID,
    nodeKey: server.node.key,
  }
}

/** Mirror of getPrimaryPort() in src/modules/user/server/shared.ts. */
export function getPrimaryPort(portsJson: string): number | undefined {
  return getPrimaryExternalPort(portsJson)
}

/**
 * Mutation-context loader mirroring loadServerForUser() in
 * src/modules/user/server/schedules.ts / databases.ts: the server must exist
 * AND be owned by / accessible to the user (the caller has already run
 * requireServerAccess, so a missing server means the admin case — Express
 * answers that with 403 "Server not found or access denied."). Returns a
 * GuardOutcome the caller must return to the event handler.
 */
export async function loadMutationServer(
  event: H3Event,
  session: SessionPayload,
  serverId: string,
  permission: string,
): Promise<GuardOutcome<TabServerContext>> {
  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access
  }
  const { user, subUser } = access.value

  const gate = requireTabPermission(event, subUser, permission)
  if (!gate.ok) {
    return gate
  }

  const server = await nitroPrisma.server.findUnique({
    where: { UUID: serverId },
    include: serverPageInclude,
  })
  if (!server) {
    setResponseStatus(event, 403)
    return { ok: false, response: { error: 'Server not found or access denied.' } }
  }

  return { ok: true, value: { user, subUser, server } }
}

/**
 * Authenticated-context loader mirroring loadAuthenticatedServerContext() +
 * sendMissingServerContext() in src/modules/user/server/shared.ts: user and
 * server must exist (404 "User not found" / "Server not found"). The caller
 * has already run requireServerAccess, so these 404s mirror Express exactly
 * for the reachable paths. Returns a GuardOutcome the caller must return.
 */
export async function loadApiServer(
  event: H3Event,
  session: SessionPayload,
  serverId: string,
  permission: string,
): Promise<GuardOutcome<{ user: Users; server: TabServerContext['server'] }>> {
  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access
  }
  const { user, subUser } = access.value

  const gate = requireTabPermission(event, subUser, permission)
  if (!gate.ok) {
    return gate
  }

  const server = await nitroPrisma.server.findUnique({
    where: { UUID: serverId },
    include: serverPageInclude,
  })
  if (!server) {
    setResponseStatus(event, 404)
    return { ok: false, response: { error: 'Server not found' } }
  }

  return { ok: true, value: { user, server } }
}

// ── Activity audit twin (mirror src/handlers/utils/activity/activityLogger.ts) ─

export type ActivityEvent =
  | 'server:start'
  | 'server:stop'
  | 'server:restart'
  | 'server:reinstall'
  | 'file:create'
  | 'file:delete'
  | 'file:rename'
  | 'file:edit'
  | 'file:upload'
  | 'file:download'
  | 'file:pull'
  | 'backup:create'
  | 'backup:restore'
  | 'backup:download'
  | 'backup:delete'
  | 'backup:lock'
  | 'backup:unlock'
  | 'subuser:create'
  | 'subuser:update'
  | 'subuser:delete'
  | 'database:create'
  | 'database:delete'
  | 'schedule:run'
  // Phase 2 group 4 admin mutations (mirror the Express admin logActivity
  // event names in src/modules/admin/*.ts).
  | 'user:create'
  | 'user:update'
  | 'user:delete'
  | 'node:create'
  | 'node:update'
  | 'node:delete'
  | 'server:create'
  | 'server:update'
  | 'server:delete'
  | 'server:suspend'
  | 'server:unsuspend'
  | 'server:transfer'
  | 'image:create'
  | 'image:update'
  | 'image:delete'
  | 'image:approve'
  | 'image:reject'
  | 'image:submit'
  | 'mount:create'
  | 'mount:delete'
  | 'location:create'
  | 'location:delete'
  | 'apikey:create'
  | 'apikey:delete'
  | 'addon:toggle'
  | 'addon:reload'
  | 'addon:uninstall'
  | 'addon:capability'
  | 'addon:command'
  // Phase 2 group 5 external-API events (mirror src/modules/api/v1/api.ts).
  | 'server:update-startup'
  | 'allocation:create'
  | 'node:delete-allocation'
  | 'location:create'

// Per-user (or per-IP when unauthenticated) sliding-window rate limit so a
// single actor cannot flood the audit table — the exact contract of
// isActivityRateLimited in the Express activityLogger.
const ACTIVITY_WINDOW_MS = 60_000
const ACTIVITY_MAX_PER_WINDOW = 120
const buckets = new Map<string, number[]>()

export function resetActivityRateLimitForTests(): void {
  buckets.clear()
}

function isActivityRateLimited(key: string): boolean {
  const now = Date.now()
  const cutoff = now - ACTIVITY_WINDOW_MS
  const times = buckets.get(key)?.filter((t) => t > cutoff) ?? []
  if (times.length >= ACTIVITY_MAX_PER_WINDOW) {
    buckets.set(key, times)
    return true
  }
  times.push(now)
  buckets.set(key, times)
  return false
}

function activityRateLimitKey(
  event: H3Event,
  session: SessionPayload,
): string {
  const id = (session as { user?: { id?: unknown } }).user?.id
  if (typeof id === 'number') {
    return `user:${id}`
  }
  const ip = getClientIp(event)
  return ip ? `ip:${ip}` : 'anon'
}

/**
 * Writes an ActivityLog row identical to the Express logActivity() — same
 * actor / server / event / metadata-JSON / IP fields and the same
 * sliding-window rate limit. Audit logging never breaks the action it
 * records.
 */
export async function logActivity(
  event: H3Event,
  session: SessionPayload,
  eventName: ActivityEvent,
  opts: { serverId?: string | null; metadata?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    if (isActivityRateLimited(activityRateLimitKey(event, session))) {
      return
    }
    const actorId =
      typeof (session as { user?: { id?: unknown } }).user?.id === 'number'
        ? (session as { user: { id: number } }).user.id
        : null
    await nitroPrisma.activityLog.create({
      data: {
        actorId,
        serverId: opts.serverId ?? null,
        event: eventName,
        metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
        ip: getClientIp(event),
      },
    })
  } catch (error) {
    console.error('[audit] failed to write activity log', error)
  }
}

/** Request header read helper for the Accept-based JSON branches. */
export function acceptsJson(event: H3Event): boolean {
  return (getRequestHeader(event, 'accept') ?? '').includes('application/json')
}

// ── Cron parsing (interop-safe) ────────────────────────────────────────────

import CronParserModule from 'cron-parser'

/**
 * Nitro bundles cron-parser's CJS exports under different interop shapes
 * depending on environment:
 *  - dev (vitest, Node ESM):  module namespace with a top-level `.parse`
 *  - prod (Nitro bundle):     the CJS exports object whose `.default` is the
 *    CronExpressionParser class carrying the static `.parse` (the runtime
 *    __toESM sets default to the whole module, so `.parse` is NOT top-level)
 *  - some bundles:            the parse function itself as the default
 * Normalize all shapes to the callable parse so `cronParser(expr)` behaves
 * identically in dev and the prod Nitro bundle.
 */
type CronParse = (expression: string, options?: Record<string, unknown>) => {
  next: () => { toDate: () => Date }
}

type CronModuleObject = {
  parse?: CronParse
  default?: CronParse & { parse?: CronParse }
}

export function resolveCronParser(mod: unknown): CronParse {
  const m = mod as CronModuleObject
  // Node ESM namespace: { parse } (dev / vitest)
  if (typeof m?.parse === 'function') {
    return m.parse
  }
  const dflt = m?.default
  // Nitro bundle: the CJS exports object's default is the CronExpressionParser
  // class, whose static .parse is the real parser (calling the class itself
  // without `new` throws, so the .parse check MUST come first).
  if (typeof dflt?.parse === 'function') {
    return dflt.parse
  }
  // Some bundles hand back the parse function as the default export.
  if (typeof dflt === 'function') {
    return dflt
  }
  // Last resort: the module itself is the callable.
  if (typeof (m as unknown) === 'function') {
    return (m as unknown) as CronParse
  }
  throw new Error('cron-parser: unsupported module shape')
}

// Eager + fail-fast by design: an unsupported interop shape should crash the
// whole server at boot (caught by the prod smoke) rather than 400 every
// schedule request at runtime.
export const cronParser: CronParse = resolveCronParser(CronParserModule)

/** Shared schedule helpers (mirror src/modules/user/server/schedules.ts). */
export function isValidCron(cron: string): boolean {
  try {
    cronParser(cron)
    return true
  } catch {
    return false
  }
}

export function nextRunFromCron(cron: string, timeOffset = 0): Date {
  const clock = new Date(Date.now() + timeOffset * 60_000)
  return cronParser(cron, { currentDate: clock }).next().toDate()
}

