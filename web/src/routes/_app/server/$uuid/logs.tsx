import { useCallback, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Download, Eye, FileText, LoaderCircle, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { fetchLogHistory, fetchLogArchives, fetchLogArchiveContent, formatBytes, type LogArchive } from '@/lib/server-tabs'

export const Route = createFileRoute('/_app/server/$uuid/logs')({
  component: ServerLogsPage,
})

function ServerLogsPage() {
  const { uuid } = Route.useParams()
  const [recent, setRecent] = useState<string | null>(null)
  const [recentLoading, setRecentLoading] = useState(true)
  const [archives, setArchives] = useState<LogArchive[]>([])
  const [archivesLoading, setArchivesLoading] = useState(true)

  const loadRecent = useCallback(async () => {
    setRecentLoading(true)
    try {
      const lines = await fetchLogHistory(uuid)
      setRecent(lines.length > 0 ? lines.join('\n') : 'No recent output saved to disk yet.')
    } catch (e) {
      setRecent('Failed to load logs: ' + (e instanceof Error ? e.message : 'request failed'))
      toast.error('Failed to load recent output.')
    } finally {
      setRecentLoading(false)
    }
  }, [uuid])

  const loadArchives = useCallback(async () => {
    setArchivesLoading(true)
    try {
      setArchives(await fetchLogArchives(uuid))
    } catch (e) {
      setArchives([])
      toast.error('Failed to load saved logs.')
    } finally {
      setArchivesLoading(false)
    }
  }, [uuid])

  useEffect(() => {
    void loadRecent()
    void loadArchives()
  }, [loadRecent, loadArchives])

  const refresh = () => {
    void loadRecent()
    void loadArchives()
  }

  const viewArchive = async (file: string) => {
    setRecentLoading(true)
    try {
      const lines = await fetchLogArchiveContent(uuid, file)
      setRecent(lines.length > 0 ? lines.join('\n') : '(archive is empty)')
    } catch (e) {
      setRecent('Failed to read archive: ' + (e instanceof Error ? e.message : 'request failed'))
      toast.error('Failed to read archive.')
    } finally {
      setRecentLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Recent output viewer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Recent output</CardTitle>
              <CardDescription>Last N lines from disk</CardDescription>
            </div>
            <Button variant="secondary" size="sm" onClick={refresh} disabled={recentLoading}>
              {recentLoading ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <pre
            className="h-96 overflow-y-auto whitespace-pre-wrap break-words border-t bg-muted/40 p-3 font-mono text-xs leading-relaxed"
            aria-live="polite"
          >
            {recentLoading && !recent ? 'Loading recent output…' : recent}
          </pre>
        </CardContent>
      </Card>

      {/* Saved logs */}
      <Card>
        <CardHeader>
          <CardTitle>Saved logs</CardTitle>
          <CardDescription>
            Archived snapshots of the console log, taken when the server stopped
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {archivesLoading ? (
            <div className="flex items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading saved logs...
            </div>
          ) : archives.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No saved logs yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {archives.map((log) => (
                <li key={log.fileName} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-medium" title={log.fileName}>
                      {log.fileName}
                    </span>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {formatBytes(log.size)}
                  </span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {log.createdAt ? new Date(log.createdAt).toLocaleString() : 'Unknown'}
                  </span>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void viewArchive(log.fileName)}
                    >
                      <Eye className="size-3" />
                      View
                    </Button>
                    <Button
                      variant="success"
                      size="sm"
                      render={
                        <a
                          href={`/server/${encodeURIComponent(uuid)}/logs/archives/download?file=${encodeURIComponent(log.fileName)}`}
                          download={log.fileName}
                        />
                      }
                    >
                      <Download className="size-3" />
                      Download
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
