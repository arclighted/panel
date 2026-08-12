/**
 * Shared Nitro-side helpers for the Phase 2 group 4 admin mutations
 * (users, nodes, servers, images, apiKeys, database hosts, mounts,
 * settings, locations, radar, playerstats, analytics, overview). Each
 * mirrors the corresponding Express helper in src/modules/admin/*.ts so
 * payloads and status codes stay byte-identical across the seam (D3).
 */
import { setResponseStatus, type H3Event } from 'h3'
import type { Users } from '../../../src/generated/prisma/client'
import { nitroPrisma, type SessionPayload } from './auth-session'
import { getClientIp, requireAdmin, type GuardOutcome } from './auth'

export { roleFields, isRoleInput } from '../../../src/handlers/utils/auth/roles'
export type { UserRole } from '../../../src/handlers/utils/auth/roles'
export { generateApiKey } from '../../../src/utils/apiKey'

export { getParamAsNumber } from '../../../src/utils/typeHelpers'

/**
 * Admin mutation guard: authenticated (302 /login), isAdmin (403 JSON),
 * 2FA requirement (302 setup) — mirroring isAuthenticated(true) in
 * src/handlers/utils/auth/authUtil.ts (the permission string is only
 * consulted for non-admin routes there; admins always pass). Returns a
 * GuardOutcome the caller must return to the event handler.
 */
export function requireAdminGuard(
  event: H3Event,
  session: SessionPayload,
): Promise<GuardOutcome<Users>> {
  return requireAdmin(event, session)
}

/**
 * Upsert the settings row — creates it with defaults if it doesn't exist,
 * then applies the partial update (mirror of saveSettings() in
 * src/modules/admin/settings.ts). Never overwrites fields it didn't touch.
 */
export async function saveSettings(data: Record<string, unknown>) {
  return nitroPrisma.settings.upsert({
    where: { id: 1 },
    update: data,
    create: {
      title: 'Arclight',
      logo: '../assets/logo.png',
      favicon: '../assets/favicon.ico',
      lightTheme: 'default',
      darkTheme: 'default',
      language: 'en',
      allowRegistration: false,
      uploadLimit: 100,
      rateLimitEnabled: true,
      rateLimitRpm: 500,
      bannedIps: '[]',
      allowUserCreateServer: false,
      allowUserDeleteServer: false,
      defaultServerLimit: 0,
      defaultMaxMemory: 512,
      defaultMaxCpu: 100,
      defaultMaxStorage: 5120,
      loginMaxAttempts: 5,
      loginLockoutMinutes: 15,
      enforceDaemonHttps: false,
      require2faForAdmins: false,
      behindReverseProxy: false,
      hashApiKeys: false,
      ...data,
    },
  })
}

/**
 * Reads a boolean admin form field the way Express handlers do: `true`,
 * `'true'`, or 1/`'1'` count as true (mirrors `=== true || === 'true'`).
 */
export function adminBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1'
}

/**
 * Resolve a wallpaper value from an upload-or-URL form field (mirror of
 * resolveWallpaperValue in src/modules/admin/settings.ts): non-string →
 * undefined (no change), empty → null (clear), http(s) URL → the URL,
 * anything else → undefined.
 */
export function resolveWallpaperValue(raw: unknown): string | null | undefined {
  if (typeof raw !== 'string') return undefined
  const u = raw.trim()
  if (u === '') return null
  if (u.startsWith('http://') || u.startsWith('https://')) return u
  return undefined
}

/**
 * JSON error response helper — mirrors `res.status(n).json({...})`.
 */
export function adminError(
  event: H3Event,
  status: number,
  body: Record<string, unknown>,
): { ok: false; response: unknown } {
  setResponseStatus(event, status)
  return { ok: false, response: body }
}

/** Client IP mirror — same x-forwarded-for resolution as the Express side. */
export { getClientIp }
