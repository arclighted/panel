import { Navigate, createFileRoute, useLocation } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/app-shell'
import {
  useAuthConfig,
  isAuthenticatedUser,
  type SessionUser,
} from '@/lib/auth-config'
import {
  AddonRegistryProvider,
  useAddonRouteForPath,
  useAddonComponent,
} from '@/lib/addon-v3/registry'

/**
 * Addon v3 page catch-all.
 *
 * Addon manifests declare routes as absolute paths (e.g. `/modrinth` or
 * `/modrinth/admin/config`). Because TanStack uses file-based routing, addon
 * routes can't be static files — this splat route owns every path no other
 * file route matches and renders the registered addon component (wrapped in
 * the app shell, auth-gated) when one exists, else a 404.
 */
export const Route = createFileRoute('/$')({
  component: AddonSplatPage,
})

function AddonSplatPage() {
  const auth = useAuthConfig()

  if (!auth.isSuccess) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-transparent" />
      </div>
    )
  }

  const user = auth.data.user
  if (!user || !isAuthenticatedUser(user)) {
    return <Navigate to="/login" />
  }

  return (
    <AddonRegistryProvider>
      <AddonPage user={user} settings={auth.data.settings} />
    </AddonRegistryProvider>
  )
}

function AddonPage({
  user,
  settings,
}: {
  user: SessionUser
  settings: NonNullable<ReturnType<typeof useAuthConfig>['data']>['settings']
}) {
  const location = useLocation()
  const match = useAddonRouteForPath(location.pathname)
  const component = useAddonComponent(match?.slug ?? '', match?.componentName ?? '')

  if (!match || !component) {
    return (
      <AppShell user={user} settings={settings}>
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-4xl font-semibold text-foreground">404</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This page isn't provided by any enabled addon.
          </p>
        </div>
      </AppShell>
    )
  }

  const Page = component
  return (
    <AppShell user={user} settings={settings}>
      <Page />
    </AppShell>
  )
}
