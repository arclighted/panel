import { useEffect } from 'react'

import { useAuthConfig } from '@/lib/auth-config'

/**
 * Keeps `<meta name="csrf-token">` in sync with the session's CSRF token.
 *
 * Addon v3 bundles (which live outside the React tree) read the token from
 * this meta tag before issuing state-changing POSTs — see the reference
 * implementation (storage/addons/modrinth/src/ui-v3/index.tsx). The token is
 * only available after the `/api/auth-config` query resolves, so it can't be
 * rendered during SSR; this component sets it on the client instead.
 */
export function CsrfMeta() {
  const auth = useAuthConfig()
  const token = auth.data?.csrfToken ?? null

  useEffect(() => {
    if (!token) return
    let el = document.head.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')
    if (!el) {
      el = document.createElement('meta')
      el.name = 'csrf-token'
      document.head.appendChild(el)
    }
    el.content = token
  }, [token])

  return null
}
