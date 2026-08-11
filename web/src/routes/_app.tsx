import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'

import { AppShell } from '@/components/shell/app-shell'
import { AddonRegistryProvider } from '@/lib/addon-v3/registry'
import { useAuthConfig, isAuthenticatedUser } from '@/lib/auth-config'

export const Route = createFileRoute('/_app')({
  component: AppLayout,
})

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
    <AddonRegistryProvider>
      <AppShell user={user} settings={auth.data.settings}>
        <Outlet />
      </AppShell>
    </AddonRegistryProvider>
  )
}
