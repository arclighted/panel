import { createFileRoute } from '@tanstack/react-router'
import { Box, LoaderCircle, Network, Server, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/overview')({
  component: AdminOverviewPage,
})

interface OverviewData {
  userCount: number
  nodeCount: number
  instanceCount: number
  imageCount: number
  arclightVersion: string | null
  arclightCodename: string
  vcodeBg: string | null
}

function AdminOverviewPage() {
  const page = useAdminPage<OverviewData>('overview')

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading overview...
      </div>
    )
  }

  const d = page.data

  const stats = [
    { label: 'Registered Users', value: d.userCount, to: '/admin/users', icon: Users },
    { label: 'Online Servers', value: d.instanceCount, to: '/admin/servers', icon: Server },
    { label: 'Connected Nodes', value: d.nodeCount, to: '/admin/nodes', icon: Network },
    { label: 'Available Images', value: d.imageCount, to: '/admin/images', icon: Box },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Panel information and credits.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-1.5">
                <stat.icon className="size-3.5" />
                {stat.label}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 text-xs"
                render={<a href={stat.to} />}
              >
                View all
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Panel</CardTitle>
          <CardDescription>Version and environment</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <p className="text-sm font-medium">
              Arclight Panel{' '}
              {d.arclightCodename ? (
                <span className="font-bold">{d.arclightCodename}</span>
              ) : null}
            </p>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">
              {d.arclightVersion ? `v${d.arclightVersion}` : 'dev'}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            This overview reflects live database counts.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
