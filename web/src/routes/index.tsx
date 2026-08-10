import { createFileRoute, Navigate } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'
import { useAuthConfig, isAuthenticatedUser } from '@/lib/auth-config'

export const Route = createFileRoute('/')({
  component: DashboardPlaceholder,
})

function DashboardPlaceholder() {
  const auth = useAuthConfig()

  // The auth query only runs client-side (no cookies during SSR), so while it
  // is pending we render a neutral loading state — never the dashboard body —
  // to avoid flashing authenticated content at logged-out visitors.
  if (!auth.isSuccess) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-border border-t-transparent" />
      </div>
    )
  }

  // No session → login. Rendered client-side after the query resolves.
  if (!isAuthenticatedUser(auth.data.user)) {
    return <Navigate to="/login" />
  }

  const user = auth.data?.user
  const settings = auth.data?.settings

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <div className="mb-2 flex items-center gap-3">
        {settings?.logo ? (
          <img
            src={settings.logo}
            alt={`${settings.title} logo`}
            className="h-12 w-12 rounded-xl object-contain"
          />
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">
          {settings?.title ?? 'Arclight'}
        </h1>
      </div>
      <p className="text-muted-foreground">
        Welcome{user?.username ? `, ${user.username}` : ''} — the dashboard
        lands in Phase 1.2.
      </p>
      <a href="/logout" className="text-sm font-medium text-primary hover:underline">
        <Button variant="outline">Sign out</Button>
      </a>
    </div>
  )
}