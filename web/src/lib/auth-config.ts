import { useQuery } from '@tanstack/react-query'

export interface SessionUser {
  id: number
  email: string
  isAdmin: boolean
  description?: string
  username?: string
  role?: string
}

export interface AuthSettings {
  title: string
  logo: string | null
  allowRegistration: boolean
  loginWallpaper: string | null
  registerWallpaper: string | null
}

export interface AuthConfig {
  csrfToken: string | null
  user: SessionUser | null
  /** True when no users exist yet — registration is always allowed then. */
  firstUser: boolean
  settings: AuthSettings
}

export const DEFAULT_SETTINGS: AuthSettings = {
  title: 'Arclight',
  logo: null,
  allowRegistration: false,
  loginWallpaper: null,
  registerWallpaper: null,
}

/**
 * Fetches the auth configuration (CSRF token + session user + settings) from
 * the additive Express endpoint. Each auth page fetches this on mount so the
 * CSRF token is always bound to the current session (after session
 * regeneration the next page load obtains a fresh token).
 */
export async function fetchAuthConfig(): Promise<AuthConfig> {
  const res = await fetch('/api/auth-config', { credentials: 'same-origin' })
  if (!res.ok) {
    throw new Error('Failed to load auth configuration')
  }
  const data = (await res.json()) as Partial<AuthConfig>
  return {
    csrfToken: data.csrfToken ?? null,
    user: data.user ?? null,
    firstUser: data.firstUser ?? false,
    settings: { ...DEFAULT_SETTINGS, ...data.settings },
  }
}

export function useAuthConfig() {
  return useQuery({
    queryKey: ['auth-config'],
    queryFn: fetchAuthConfig,
    staleTime: 30_000,
    // The auth config includes the session cookie state, which only exists in
    // the browser. Never run this query during SSR (the server has no cookies).
    enabled: typeof window !== 'undefined',
  })
}

/** True when the returned user object represents a signed-in session. */
export function isAuthenticatedUser(user: SessionUser | null | undefined): boolean {
  return !!user && typeof user.id === 'number'
}