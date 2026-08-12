/**
 * Shared Nitro-side helpers for the Phase 2 group 3a server tab reads
 * (GET /api/server/:id/{settings,startup,databases,schedules,backups,subusers,
 * worlds}). Each mirrors the corresponding Express helper in
 * src/modules/user/server/tabs.ts / subusers.ts exactly so payloads stay
 * byte-identical across the seam (D3).
 */
import { setResponseStatus, type H3Event } from 'h3'
import type { Users } from '../../../src/generated/prisma/client'
import {
  nitroPrisma,
  type SessionPayload,
} from './auth-session'
import { requireServerAccess, subUserHasPermission, type GuardOutcome } from './auth'

/** Mirror of serverPageInclude in src/modules/user/server/shared.ts. */
export const serverPageInclude = {
  node: true,
  image: true,
  owner: true,
} as const

/**
 * The auth meta block every tab payload spreads (mirror of authMeta() in
 * src/modules/user/server/tabs.ts).
 */
export function authMeta(
  user: Pick<Users, 'id' | 'isAdmin'>,
  ownerId: number,
  subUser: { permissions: string | null } | null,
): {
  isAdmin: boolean
  isOwner: boolean
  isSubUser: boolean
  subUserPermissions: string[]
} {
  return {
    isAdmin: user.isAdmin === true,
    isOwner: ownerId === user.id,
    isSubUser: !!subUser,
    subUserPermissions: subUserPermissionsOf(subUser),
  }
}

/** Mirror of subUserPermissionsOf() in src/modules/user/server/tabs.ts. */
export function subUserPermissionsOf(
  subUser: { permissions: string | null } | null,
): string[] {
  if (!subUser?.permissions) {
    return []
  }
  try {
    const parsed = JSON.parse(subUser.permissions)
    return Array.isArray(parsed)
      ? parsed.filter((p): p is string => typeof p === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * Subuser permission gate mirroring requireSubUserPermission() in
 * src/handlers/utils/auth/serverAuthUtil.ts: owners and admins (subUser ===
 * null) always pass; a subuser without the permission gets a 403 (Express
 * renders an HTML error page — the status is preserved with a JSON body
 * here, same documented deviation as the group-2 guards). Returns a
 * GuardOutcome the caller must return to the event handler.
 */
export function requireTabPermission(
  event: H3Event,
  subUser: { permissions: string | null } | null,
  permission: string,
): GuardOutcome<true> {
  if (!subUser) {
    return { ok: true, value: true }
  }
  if (subUserHasPermission(subUser, permission)) {
    return { ok: true, value: true }
  }
  setResponseStatus(event, 403)
  return { ok: false, response: { error: 'Forbidden' } }
}

/** The ready tab-read context: the user, the SubUser row and the server. */
export interface TabServerContext {
  user: Users
  subUser: { permissions: string | null } | null
  server: NonNullable<Awaited<ReturnType<typeof loadTabServerRow>>>
}

/**
 * Loads the server row with the page include for a tab read. The caller is
 * expected to have already run requireServerAccess (via loadTabContext) —
 * this returns null for a missing server so the route can 404.
 */
export async function loadTabServerRow(serverId: string) {
  return nitroPrisma.server.findUnique({
    where: { UUID: serverId },
    include: serverPageInclude,
  })
}

/**
 * Full tab-read context loader mirroring the composition in tabs.ts:
 * isAuthenticatedForServer('id') (via requireServerAccess) → optional
 * requireSubUserPermission(permission) → requireServer() (user + server with
 * the page include). Missing server → GuardOutcome with a 404 JSON body
 * ({ success: false, error: 'Server not found' } — matching requireServer()).
 */
export async function loadTabContext(
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

  const server = await loadTabServerRow(serverId)
  if (!server) {
    setResponseStatus(event, 404)
    return { ok: false, response: { success: false, error: 'Server not found' } }
  }

  return { ok: true, value: { user, subUser, server } }
}

/**
 * PERMISSION_LABELS — faithful mirror of the constant exported from
 * src/modules/user/server/subusers.ts (importing that module would drag
 * nodemailer into the Nitro bundle; the labels are static UI contract data).
 * Keep in sync with the Express source.
 */
export const PERMISSION_LABELS: Record<string, string> = {  'websocket.connect': 'Live console',
  console: 'Full console',
  'console.send': 'Send commands',
  'control.start': 'Start server',
  'control.stop': 'Stop server',
  'control.restart': 'Restart server',
  'control.console': 'Console access',
  files: 'All files',
  'files.read': 'Read files',
  'files.write': 'Edit & upload',
  'files.delete': 'Delete files',
  'files.sftp': 'SFTP access',
  'files.pull': 'Pull/import',
  'files.archive': 'Archive & unpack',
  'files.create': 'Create files',
  'files.update': 'Update files',
  startup: 'Full startup',
  'startup.read': 'View startup',
  'startup.update': 'Edit startup',
  'startup.docker-image': 'Change Docker image',
  backups: 'All backups',
  'backups.read': 'List backups',
  'backups.create': 'Create backups',
  'backups.delete': 'Delete backups',
  'backups.download': 'Download backups',
  'backups.restore': 'Restore backups',
  'backups.lock': 'Lock backups',
  'database.create': 'Create databases',
  'database.read': 'View databases',
  'database.update': 'Edit databases',
  'database.delete': 'Delete databases',
  'database.view_password': 'View passwords',
  'schedule.create': 'Create schedules',
  'schedule.read': 'View schedules',
  'schedule.update': 'Edit schedules',
  'schedule.delete': 'Delete schedules',
  'allocation.read': 'View allocations',
  'allocation.create': 'Create allocations',
  'allocation.update': 'Edit allocations',
  'allocation.delete': 'Delete allocations',
  settings: 'View settings',
  'settings.update': 'Edit settings',
  'settings.rename': 'Rename server',
  'settings.reinstall': 'Reinstall server',
  'activity.read': 'View activity',
}

/**
 * SUBUSER_PERMISSIONS — faithful mirror of the constant exported from
 * src/handlers/utils/auth/serverAuthUtil.ts (importing that module would pull
 * Express-flavored request types into the web program; the list is static UI
 * contract data). Keep in sync with the Express source.
 */
export const SUBUSER_PERMISSIONS = [
  'websocket.connect',
  'console',
  'console.send',
  'control.start',
  'control.stop',
  'control.restart',
  'control.console',
  'files',
  'files.read',
  'files.write',
  'files.delete',
  'files.sftp',
  'files.pull',
  'files.archive',
  'files.create',
  'files.update',
  'startup',
  'startup.read',
  'startup.update',
  'startup.docker-image',
  'backups',
  'backups.read',
  'backups.create',
  'backups.delete',
  'backups.download',
  'backups.restore',
  'backups.lock',
  'database.create',
  'database.read',
  'database.update',
  'database.delete',
  'database.view_password',
  'schedule.create',
  'schedule.read',
  'schedule.update',
  'schedule.delete',
  'allocation.read',
  'allocation.create',
  'allocation.update',
  'allocation.delete',
  'settings',
  'settings.update',
  'settings.rename',
  'settings.reinstall',
  'activity.read',
] as const

/**
 * PERMISSION_GROUPS — faithful mirror of the constant exported from
 * src/handlers/utils/auth/serverAuthUtil.ts (importing that module would pull
 * Express-flavored request types into the web program; the groups are static
 * UI contract data). Keep in sync with the Express source.
 */
export const PERMISSION_GROUPS: {
  title: string
  perms: string[]
}[] = [
  {
    title: 'Console control',
    perms: [
      'console',
      'console.send',
      'control.start',
      'control.stop',
      'control.restart',
      'control.console',
      'websocket.connect',
    ],
  },
  {
    title: 'Files',
    perms: [
      'files',
      'files.read',
      'files.write',
      'files.delete',
      'files.sftp',
      'files.pull',
      'files.archive',
      'files.create',
      'files.update',
    ],
  },
  {
    title: 'Startup',
    perms: ['startup', 'startup.read', 'startup.update', 'startup.docker-image'],
  },
  {
    title: 'Backups',
    perms: [
      'backups',
      'backups.read',
      'backups.create',
      'backups.delete',
      'backups.download',
      'backups.restore',
      'backups.lock',
    ],
  },
  {
    title: 'Databases',
    perms: [
      'database.create',
      'database.read',
      'database.update',
      'database.delete',
      'database.view_password',
    ],
  },
  {
    title: 'Schedules',
    perms: ['schedule.create', 'schedule.read', 'schedule.update', 'schedule.delete'],
  },
  {
    title: 'Allocations',
    perms: [
      'allocation.read',
      'allocation.create',
      'allocation.update',
      'allocation.delete',
    ],
  },
  {
    title: 'Settings & Activity',
    perms: [
      'settings',
      'settings.update',
      'settings.rename',
      'settings.reinstall',
      'activity.read',
    ],
  },
]
