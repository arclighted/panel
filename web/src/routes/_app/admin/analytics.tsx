import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { LoaderCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@/components/ui/card'

export const Route = createFileRoute('/_app/admin/analytics')({
  component: AdminAnalyticsPage,
})

interface AnalyticsSummary {
  users?: { total: number; newThisWeek?: number }
  servers?: { total: number; online?: number }
  activity?: { total: number; recent?: { event: string; count: number }[] }
  [key: string]: unknown
}

function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/analytics/summary', { credentials: 'same-origin' })
      .then((r) => {
        if (!r.ok) throw new Error('failed')
        return r.json() as Promise<AnalyticsSummary>
      })
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
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Panel usage statistics
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={loading}
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Loading analytics...
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(data).map(([key, value]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardDescription>{key}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm">
                  {typeof value === 'string' || typeof value === 'number'
                    ? String(value)
                    : JSON.stringify(value)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border bg-muted/40 px-4 py-8 text-center text-sm text-muted-foreground">
          Analytics are unavailable right now.
        </p>
      )}
    </div>
  )
}
