/**
 * Shared Nitro-side auth helpers for the Phase 2 auth routes
 * (login / register / logout / 2fa). Each mirrors the corresponding Express
 * helper exactly (src/utils/ip.ts, getSecuritySettings in authService.ts,
 * the session.user shape in authService.ts / twoFactor.ts) so behavior and
 * response shapes stay byte-identical across the seam.
 */
import {
  getRequestHeader,
  sendRedirect,
  setResponseStatus,
  type H3Event,
} from 'h3'
import type { Users } from '../../../src/generated/prisma/client'
import { nitroPrisma, type SessionPayload } from './auth-session'

/**
 * Client IP — mirror of src/utils/ip.ts getClientIp: x-forwarded-for first
 * entry when present, otherwise the socket remote address. The panel's proxy
 * layer (Vite / web/server/index.mjs) forwards the original headers, so the
 * value matches what Express would have computed.
 */
export function getClientIp(event: H3Event): string {
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (forwarded) {
    const first = String(forwarded).split(',')[0]
    return first?.trim() || 'unknown'
  }
  return event.node?.req.socket?.remoteAddress ?? 'unknown'
}

/** Security settings used by the login lockout flow (mirrors authService.ts). */
export interface SecuritySettings {
  maxAttempts: number
  lockoutMinutes: number
}

/**
 * Reads loginMaxAttempts / loginLockoutMinutes from the panel settings with
 * the same defaults as Express (5 attempts / 15 minutes). Uses a `select`
 * projection so a partial settings row (or none) still resolves cleanly.
 */
export async function getSecuritySettings(): Promise<SecuritySettings> {
  try {
    const s = await nitroPrisma.settings.findUnique({
      where: { id: 1 },
      select: { loginMaxAttempts: true, loginLockoutMinutes: true },
    })
    return {
      maxAttempts: s?.loginMaxAttempts ?? 5,
      lockoutMinutes: s?.loginLockoutMinutes ?? 15,
    }
  } catch {
    return { maxAttempts: 5, lockoutMinutes: 15 }
  }
}

/**
 * Records a successful login in the LoginHistory table — the exact row
 * Express writes in authService.ts and twoFactor.ts.
 */
export async function recordLoginHistory(
  event: H3Event,
  userId: number,
): Promise<void> {
  await nitroPrisma.loginHistory.create({
    data: {
      userId,
      ipAddress: getClientIp(event),
      userAgent: getRequestHeader(event, 'user-agent') ?? null,
    },
  })
}

/** Row shape the auth queries read from the Users table. */
export interface AuthUserRow {
  id: number
  email: string
  isAdmin: boolean
  description: string | null
  username: string | null
  role: string
  onboardingCompleted: boolean
  onboardingSkipped: boolean
  loginAttempts: number | null
  lockedUntil: Date | null
  totpEnabled: boolean
}

/**
 * The session.user shape written by POST /login (mirrors authService.ts —
 * includes role + onboarding state, which the React shell renders).
 */
export function loginSessionUser(row: AuthUserRow): SessionUserShape {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.isAdmin,
    description: row.description ?? '',
    username: row.username ?? '',
    role: row.role,
    onboardingCompleted: row.onboardingCompleted,
    onboardingSkipped: row.onboardingSkipped,
  }
}

/** The session.user shape written by POST /2fa (mirrors twoFactor.ts). */
export function twoFactorSessionUser(row: AuthUserRow): SessionUserShape {
  return {
    id: row.id,
    email: row.email,
    isAdmin: row.isAdmin,
    description: row.description ?? '',
    username: row.username ?? '',
  }
}

export type SessionUserShape = {
  id: number
  email: string
  isAdmin: boolean
  description: string
  username: string
  role?: string
  onboardingCompleted?: boolean
  onboardingSkipped?: boolean
}

// ── Auth guards (mirror src/handlers/utils/auth/authUtil.ts) ────────────────

/**
 * Result of an auth guard. `ok: true` carries the value (user row / access
 * result); `ok: false` carries an h3 response value the ROUTE HANDLER must
 * return — h3's sendRedirect / setResponseStatus in this version return a
 * value instead of writing to the response, so `await sendRedirect(...)` alone
 * would be dropped and the handler would reply 200. All call sites do
 * `if (!outcome.ok) return outcome.response`.
 */
export type GuardOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; response: unknown }

/** The session user id, or null when the session has no authenticated user. */
export function sessionUserId(session: SessionPayload): number | null {
  const id = (session as { user?: { id?: unknown } }).user?.id
  return typeof id === 'number' ? id : null
}

/**
 * Authenticated-user guard mirroring `isAuthenticated()`: no session user (or
 * a user row that no longer exists) → 302 /login. Returns a GuardOutcome the
 * caller must return to the event handler.
 */
export async function requireAuthenticated(
  event: H3Event,
  session: SessionPayload,
): Promise<GuardOutcome<Users>> {
  const userId = sessionUserId(session)
  if (!userId) {
    return { ok: false, response: await sendRedirect(event, '/login', 302) }
  }
  const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
  if (!user) {
    return { ok: false, response: await sendRedirect(event, '/login', 302) }
  }
  return { ok: true, value: user }
}

/**
 * Admin guard mirroring `isAuthenticated(true)`: authenticated (302 /login),
 * isAdmin (403 — Express renders an HTML error page; the status is preserved
 * with a JSON body here), and the 2FA requirement for admins (302
 * /account/2fa/setup?required=1). Returns a GuardOutcome the caller must
 * return to the event handler.
 */
export async function requireAdmin(
  event: H3Event,
  session: SessionPayload,
): Promise<GuardOutcome<Users>> {
  const outcome = await requireAuthenticated(event, session)
  if (!outcome.ok) {
    return outcome
  }
  const user = outcome.value
  if (!user.isAdmin) {
    setResponseStatus(event, 403)
    return { ok: false, response: { error: 'Forbidden' } }
  }
  const settings = await nitroPrisma.settings.findUnique({
    where: { id: 1 },
    select: { require2faForAdmins: true },
  })
  if (settings?.require2faForAdmins && !user.totpEnabled) {
    return {
      ok: false,
      response: await sendRedirect(event, '/account/2fa/setup?required=1', 302),
    }
  }
  return { ok: true, value: user }
}

/** Result of the server-access guard: the user plus the optional SubUser row. */
export interface ServerAccessResult {
  user: Users
  subUser: { permissions: string | null } | null
}

/**
 * Server-access guard mirroring `isAuthenticatedForServer('id')`: authenticated
 * (302 /login), then admin / owner / subuser access with the suspended check
 * (403). Falls back to 302 / for users with no access. Returns a GuardOutcome
 * the caller must return to the event handler.
 */
export async function requireServerAccess(
  event: H3Event,
  session: SessionPayload,
  serverId: string,
): Promise<GuardOutcome<ServerAccessResult>> {
  const userId = sessionUserId(session)
  if (!userId) {
    return { ok: false, response: await sendRedirect(event, '/login', 302) }
  }
  const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
  if (!user) {
    return { ok: false, response: await sendRedirect(event, '/login', 302) }
  }
  if (user.isAdmin) {
    return { ok: true, value: { user, subUser: null } }
  }

  const server = await nitroPrisma.server.findUnique({
    where: { UUID: serverId },
    select: { ownerId: true, Suspended: true },
  })

  if (server && server.ownerId === userId) {
    if (server.Suspended) {
      setResponseStatus(event, 403)
      return { ok: false, response: { error: 'Forbidden' } }
    }
    return { ok: true, value: { user, subUser: null } }
  }

  const subUser = await nitroPrisma.subUser.findUnique({
    where: { serverId_userId: { serverId, userId } },
  })
  if (subUser) {
    if (server?.Suspended) {
      setResponseStatus(event, 403)
      return { ok: false, response: { error: 'Forbidden' } }
    }
    return { ok: true, value: { user, subUser } }
  }

  return { ok: false, response: await sendRedirect(event, '/', 302) }
}

/**
 * The safe admin-facing user shape (mirrors safeUser() in admin/context.ts).
 */
export function safeUser(user: Users): SafeUserShape {
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
  }
}

export type SafeUserShape = {
  id: number
  username: string | null
  email: string | null
  avatar: string | null
  isAdmin: boolean
  role: string | null
  description: string
  createdAt: Date
  serverLimit: number | null
  maxMemory: number | null
  maxCpu: number | null
  maxStorage: number | null
  maxDatabases: number | null
  preferredNodeId: number | null
  totpEnabled: boolean
  permissions: string | null
}

/**
 * Subuser permission check — the exact logic of
 * subUserHasPermission() in src/handlers/utils/auth/serverAuthUtil.ts.
 */
export function subUserHasPermission(
  subUser: { permissions: string | null | undefined },
  permission: string,
): boolean {
  let perms: string[] = []
  if (subUser.permissions) {
    try {
      const parsed = JSON.parse(subUser.permissions)
      if (Array.isArray(parsed)) {
        perms = parsed.filter((p): p is string => typeof p === 'string')
      }
    } catch {
      perms = []
    }
  }
  const parent = permission.includes('.')
    ? permission.slice(0, permission.lastIndexOf('.'))
    : null

  for (const p of perms) {
    if (p === permission) {
      return true
    }
    if (
      p.endsWith('.*') &&
      (permission === p.slice(0, -2) || permission.startsWith(p.slice(0, -1)))
    ) {
      return true
    }
    if (parent && p === parent) {
      return true
    }
  }
  return false
}
