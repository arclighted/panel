import { Navigate, Outlet, createFileRoute } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'

import { AdminSidebar, AdminSidebarMobile } from '@/components/admin/admin-sidebar'
import { useAuthConfig, isAuthenticatedUser } from '@/lib/auth-config'
import { useAdminContext } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  const auth = useAuthConfig()
  const context = useAdminContext()

  const user = auth.data?.user
  if (!user || !isAuthenticatedUser(user) || !user.isAdmin) {
    return <Navigate to="/" />
  }

  if (context.isLoading || !context.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading admin panel...
      </div>
    )
  }

  // Mirror the EJS admin guard: admins must enable 2FA when the panel requires it.
  if (context.data.require2faForAdmins && !context.data.user.totpEnabled) {
    return <Navigate to="/account/2fa/setup" search={{ required: '1' }} />
  }

  return (
    <div className="space-y-6">
      <AdminSidebarMobile groups={context.data.sidebarGroups} />
      <div className="flex gap-6">
        <AdminSidebar groups={context.data.sidebarGroups} />
        <main className="min-w-0 flex-1 space-y-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
