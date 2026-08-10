import { createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/api/docs')({
  component: AdminApiDocsPage,
})

interface ApiEndpoint {
  method?: string
  path?: string
  description?: string
  auth?: string | boolean
  [key: string]: unknown
}

interface ApiDocsData {
  apiEndpoints: ApiEndpoint[]
  apiKeys: unknown[]
}

function AdminApiDocsPage() {
  const page = useAdminPage<ApiDocsData>('apikeys-docs')

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<a href="/admin/apikeys" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">API documentation</h1>
          <p className="text-sm text-muted-foreground">
            Endpoints available to API keys with the right scopes
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
          <CardDescription>
            {page.data ? `${page.data.apiEndpoints.length} routes` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading || !page.data ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading docs...
            </div>
          ) : page.data.apiEndpoints.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No documented endpoints.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {page.data.apiEndpoints.map((ep, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                    {String(ep.method ?? 'GET').toUpperCase()}
                  </span>
                  <span className="truncate font-mono text-sm">{String(ep.path ?? '')}</span>
                  {ep.description ? (
                    <span className="w-full truncate pl-16 text-xs text-muted-foreground sm:w-auto sm:flex-1 sm:pl-0">
                      {String(ep.description)}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
