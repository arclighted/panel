/**
 * Byte-identical `/api/auth-config` response shape (mirrors the Express
 * handler in src/modules/core/index.ts). Kept pure so it can be unit-tested
 * without a database.
 */

import type { SessionPayload } from './auth-session'

/** Same SessionUser shape the React Query layer expects (web/src/lib/auth-config.ts). */
export interface SessionUser {
  id: number
  email: string
  isAdmin: boolean
  description?: string
  username?: string
  role?: string
  avatar?: string | null
}

export interface AuthConfigSettingsRow {
  title?: string | null
  logo?: string | null
  allowRegistration?: boolean | null
  loginWallpaper?: string | null
  registerWallpaper?: string | null
}

export interface AuthConfigPayload {
  csrfToken: string | null
  user: SessionUser | null
  /** True when no users exist yet — registration is always allowed then. */
  firstUser: boolean
  settings: {
    title: string
    logo: string | null
    allowRegistration: boolean
    loginWallpaper: string | null
    registerWallpaper: string | null
  }
}

export function buildAuthConfigPayload(opts: {
  csrfToken: string | null
  session: SessionPayload
  settingsRow: AuthConfigSettingsRow | null
  userCount: number
}): AuthConfigPayload {
  const settings = opts.settingsRow
  return {
    csrfToken: opts.csrfToken,
    user: (opts.session.user as SessionUser | null | undefined) ?? null,
    firstUser: opts.userCount === 0,
    settings: {
      title: settings?.title ?? 'Arclight',
      logo: settings?.logo ?? null,
      allowRegistration: settings?.allowRegistration ?? false,
      loginWallpaper: settings?.loginWallpaper ?? null,
      registerWallpaper: settings?.registerWallpaper ?? null,
    },
  }
}
