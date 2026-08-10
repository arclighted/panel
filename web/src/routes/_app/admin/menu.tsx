import { createFileRoute } from '@tanstack/react-router'
import { LoaderCircle, Menu as MenuIcon } from 'lucide-react'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminPage } from '@/lib/admin'
import type { AdminSidebarGroup } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/menu')({
  component: AdminMenuPage,
})

function AdminMenuPage() {
  const page = useAdminPage<{ sidebarGroups: AdminSidebarGroup[] }>('menu')

  if (page.isLoading || !page.data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Loading menu...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Menu</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          The sidebar is assembled from registered UI components and addons.
        </p>
      </div>

      {page.data.sidebarGroups.map((group) => (
        <Card key={group.section}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MenuIcon className="size-4 text-muted-foreground" />
              {group.label}
            </CardTitle>
            <CardDescription>{group.items.length} items</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y border-t">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span
                    className="size-4 shrink-0 text-muted-foreground [&>svg]:size-4"
                    dangerouslySetInnerHTML={{ __html: item.icon }}
                  />
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="ml-auto truncate font-mono text-xs text-muted-foreground">
                    {item.url}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
