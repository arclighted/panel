import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Store } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export const Route = createFileRoute('/_app/admin/addons/store')({
  component: AdminAddonsStorePage,
})

function AdminAddonsStorePage() {
  return (
    <div className="mx-auto max-w-md space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/addons" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <h1 className="text-lg font-semibold tracking-tight">Addon store</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="size-4" />
            Coming soon
          </CardTitle>
          <CardDescription>
            The addon store is not available yet. Addons are installed by dropping
            them into <code className="font-mono text-xs">storage/addons/</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" render={<a href="/admin/addons" />}>
            Back to installed addons
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
