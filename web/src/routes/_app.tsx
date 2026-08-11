import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/app-shell'
import { useAddonRegistry } from '@/lib/addon-v3/registry'
import { useAuthConfig, isAuthenticatedUser } from '@/lib/auth-config'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

/**
 * Kick off addon v3 bundle loading for the authenticated session. The registry
 * is lazy by nature (hooks pull manifests/bundles on demand), but starting it
 * here means addon UI is typically ready before the first addon slot/page
 * renders. Harmless no-op when no addons declare a `ui` field.
 */
function AddonRegistryLoader() {
  useAddonRegistry()
  return null
}

function AppLayout() {
  const auth = useAuthConfig()

  // The auth query only runs client-side (cookies live in the browser), so
  // render a neutral loading state instead of flashing the shell.
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
    <AppShell user={user} settings={auth.data.settings}>
      <AddonRegistryLoader />
      <Outlet />
    </AppShell>
  )
}
