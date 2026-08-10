import { createFileRoute, Outlet } from '@tanstack/react-router'

import { ServerShell } from '@/components/server/server-shell'

export const Route = createFileRoute('/_app/server/$uuid')({
  component: ServerLayout,
})

function ServerLayout() {
  const { uuid } = Route.useParams()
  return (
    <ServerShell serverId={uuid}>
      <Outlet />
    </ServerShell>
  )
}
