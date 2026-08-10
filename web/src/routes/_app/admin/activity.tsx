import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Activity as ActivityIcon, LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { fetchAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/activity')({
  component: AdminActivityPage,
})

interface ActivityLog {
  id: number
  event: string
  createdAt: string
  metadata: Record<string, unknown> | null
  meta?: { label?: string; color?: string; icon?: string }
  actor: { id: number; username: string | null; email: string | null } | null
  server: { UUID: string; name: string } | null
}

interface ActivityData {
  logs: ActivityLog[]
  events: { event: string; count: number }[]
  actors: { id: number; username: string | null; email: string | null }[]
  servers: { UUID: string; name: string }[]
  total: number
  page: number
  pageSize: number
  filters: { event: string; server: string; actor: string; from: string; to: string }
}

function AdminActivityPage() {
  const [pageNum, setPageNum] = useState(1)
  const [filters, setFilters] = useState({ event: '', server: '', actor: '', from: '', to: '' })
  const [data, setData] = useState<ActivityData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const qs = new URLSearchParams({
      page: String(pageNum),
      ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '')),
    })
    fetchAdminPage<ActivityData>(`activity?${qs.toString()}`)
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch(() => {
        if (!cancelled) setData(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [pageNum, filters])

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Activity Log</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {data ? `${data.total} events` : 'Loading…'}
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="act-event">Event</Label>
            <select
              id="act-event"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={filters.event}
              onChange={(e) => {
                setFilters((f) => ({ ...f, event: e.target.value }))
                setPageNum(1)
              }}
            >
              <option value="">All events</option>
              {(data?.events ?? []).map((e) => (
                <option key={e.event} value={e.event}>
                  {e.event} ({e.count})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-server">Server</Label>
            <select
              id="act-server"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={filters.server}
              onChange={(e) => {
                setFilters((f) => ({ ...f, server: e.target.value }))
                setPageNum(1)
              }}
            >
              <option value="">All servers</option>
              {(data?.servers ?? []).map((s) => (
                <option key={s.UUID} value={s.UUID}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-actor">Actor</Label>
            <select
              id="act-actor"
              className="w-full rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none"
              value={filters.actor}
              onChange={(e) => {
                setFilters((f) => ({ ...f, actor: e.target.value }))
                setPageNum(1)
              }}
            >
              <option value="">All actors</option>
              {(data?.actors ?? []).map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.username ?? a.email ?? a.id}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-from">From</Label>
            <Input
              id="act-from"
              type="date"
              value={filters.from}
              onChange={(e) => {
                setFilters((f) => ({ ...f, from: e.target.value }))
                setPageNum(1)
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="act-to">To</Label>
            <Input
              id="act-to"
              type="date"
              value={filters.to}
              onChange={(e) => {
                setFilters((f) => ({ ...f, to: e.target.value }))
                setPageNum(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="size-4" />
            Events
          </CardTitle>
          <CardDescription>Page {data?.page ?? 1} of {totalPages}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading activity...
            </div>
          ) : !data || data.logs.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No activity matches those filters.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {data.logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <span className="rounded-lg border border-destructive/20 bg-destructive/5 px-2 py-0.5 font-mono text-xs text-destructive">
                    {log.event}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {log.server ? <span className="font-medium">{log.server.name}</span> : null}{' '}
                    {log.actor?.username ? <span className="text-muted-foreground">by {log.actor.username}</span> : null}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {data && totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button
            variant="secondary"
            size="sm"
            disabled={pageNum <= 1}
            onClick={() => setPageNum((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground">
            Page {data.page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={pageNum >= totalPages}
            onClick={() => setPageNum((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  )
}
