/**
 * Modrinth Store — v3 UI bundle entry.
 *
 * The canonical reference for the addon v3 UI contract
 * (docs/addon-ui-contract-v3.md):
 *
 *  - Built as an ESM bundle that EXTERNALIZES react, react-dom,
 *    react/jsx-runtime, and @arclight/ui (never bundled inline).
 *  - Named exports are the components referenced by the addon manifest's
 *    `ui.routes`, `ui.slots`, and `ui.adminSidebar` entries.
 *  - Server data comes from the addon's OWN Express API routes
 *    (`/modrinth/api/*`), which are untouched by the UI migration.
 *
 * Build: pnpm --dir storage/addons/modrinth build:ui
 * Output: public/ui/bundle.mjs (+ styles.css) served at
 *         /addon-assets/modrinth/ui/bundle.mjs
 */
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Separator,
} from '@arclight/ui'

/* ── Types (mirror the addon's own API response shapes) ──────────────────── */

interface SearchHit {
  project_id: string
  title: string
  description: string
  project_type: string
  downloads: number
  icon_url: string | null
  slug?: string
}

interface SearchResponse {
  success: boolean
  data: {
    hits: SearchHit[]
    total_hits: number
    offset?: number
    limit?: number
  }
}

interface ServersResponse {
  success: boolean
  data: { id: string; name: string; status: string }[]
}

interface InstallResponse {
  success: boolean
  error?: string
}

interface InstallationsResponse {
  success: boolean
  data: { id: number; projectName: string | null; status: string; installedAt: string }[]
}

/* ── Shared API helpers ───────────────────────────────────────────────────── */

const api = {
  search: async (q: string, type: string, page: number): Promise<SearchHit[]> => {
    const res = await fetch(
      `/modrinth/api/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(type)}&page=${page}`,
      { credentials: 'same-origin' },
    )
    if (!res.ok) return []
    const data = (await res.json()) as SearchResponse
    return data.success ? (data.data?.hits ?? []) : []
  },
  servers: async (): Promise<{ id: string; name: string }[]> => {
    const res = await fetch('/modrinth/api/servers', { credentials: 'same-origin' })
    if (!res.ok) return []
    const data = (await res.json()) as ServersResponse
    return data.success ? (data.data ?? []) : []
  },
  install: async (serverId: string, projectId: string, versionId: string): Promise<string | null> => {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
    const res = await fetch('/modrinth/api/install', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrf,
      },
      credentials: 'same-origin',
      body: JSON.stringify({ serverId, projectId, versionId }),
    })
    const data = (await res.json()) as InstallResponse
    return data.success ? null : (data.error ?? 'Install failed')
  },
}

/* ── Route component: BrowsePage (declared at /modrinth) ─────────────────── */

export function BrowsePage() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('mod')
  const [results, setResults] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)

  async function runSearch() {
    setLoading(true)
    try {
      setResults(await api.search(query || 'minecraft', type, 1))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Modrinth Store</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse and install mods, modpacks, and plugins for your servers.
        </p>
      </header>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label htmlFor="modrinth-search">Search</Label>
          <Input
            id="modrinth-search"
            placeholder="e.g. sodium, lithium, fabric API…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runSearch()}
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="modrinth-type">Type</Label>
          <select
            id="modrinth-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm sm:w-auto"
          >
            <option value="mod">Mods</option>
            <option value="modpack">Modpacks</option>
            <option value="plugin">Plugins</option>
            <option value="resourcepack">Resource Packs</option>
            <option value="shader">Shaders</option>
          </select>
        </div>
        <Button onClick={runSearch} disabled={loading} className="sm:self-auto">
          {loading ? 'Searching…' : 'Search'}
        </Button>
      </div>

      {results.length > 0 && (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {results.map((hit) => (
            <ProjectCard key={hit.project_id} hit={hit} />
          ))}
        </div>
      )}
      {!loading && results.length === 0 && (
        <p className="mt-10 text-center text-sm text-muted-foreground">
          No results yet — try a search above.
        </p>
      )}
    </div>
  )
}

function ProjectCard({ hit }: { hit: SearchHit }) {
  const [server, setServer] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const { data: servers = [] } = useQuery({
    queryKey: ['modrinth-servers'],
    queryFn: api.servers,
    staleTime: 30_000,
  })

  async function install() {
    if (!server) return
    setBusy(true)
    setMessage(null)
    // Version selection is out of scope for the reference; the API resolves
    // the latest compatible version when versionId is empty.
    const err = await api.install(server, hit.project_id, '')
    setMessage(err ?? 'Install started — check the server console.')
    setBusy(false)
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">{hit.title}</CardTitle>
          <CardDescription className="mt-1 line-clamp-2">{hit.description}</CardDescription>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {hit.project_type}
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor={`server-${hit.project_id}`} className="text-xs">
              Target server
            </Label>
            <select
              id={`server-${hit.project_id}`}
              value={server}
              onChange={(e) => setServer(e.target.value)}
              className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">Select…</option>
              {servers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={install} disabled={!server || busy} size="sm">
            {busy ? 'Installing…' : 'Install'}
          </Button>
        </div>
        {message ? <p className="mt-2 text-xs text-muted-foreground">{message}</p> : null}
      </CardContent>
    </Card>
  )
}

/* ── Slot component: server:console:toolbar ───────────────────────────────── */

export function ConsoleToolbar({ uuid, online }: { uuid: string; online?: boolean }) {
  const [opened, setOpened] = useState(false)
  const { data: servers = [] } = useQuery({
    queryKey: ['modrinth-servers'],
    queryFn: api.servers,
    staleTime: 30_000,
  })

  const isTarget = servers.some((s) => s.id === uuid)

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">Modrinth</span>
        <Badge variant={online ? 'default' : 'secondary'} className="text-xs">
          {online ? 'online' : 'offline'}
        </Badge>
      </div>
      {isTarget ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpened((v) => !v)}
        >
          {opened ? 'Hide store' : 'Quick install'}
        </Button>
      ) : null}
      {opened ? (
        <Separator className="mx-2 my-1" />
      ) : null}
    </div>
  )
}

/* ── Route component: AdminConfigPage (declared at /modrinth/admin/config) ─ */

export function AdminConfigPage() {
  const [blockedIds, setBlockedIds] = useState('')
  const [saved, setSaved] = useState(false)

  async function save() {
    const csrf = document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
    await fetch('/modrinth/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
      credentials: 'same-origin',
      body: JSON.stringify({ blockedProjectIds: blockedIds.split(/[,\s]+/).filter(Boolean) }),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Modrinth Admin</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Configure the Modrinth store addon.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <Label htmlFor="blocked-ids">Blocked project IDs</Label>
          <Input
            id="blocked-ids"
            placeholder="comma or space separated Modrinth project IDs"
            value={blockedIds}
            onChange={(e) => setBlockedIds(e.target.value)}
            className="mt-1"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Blocked projects are hidden from search results and cannot be installed.
          </p>
        </div>
        <Button onClick={save}>Save settings</Button>
        {saved ? <p className="text-xs text-emerald-600">Saved.</p> : null}
      </div>
    </div>
  )
}

// Re-export the UI primitives so addon consumers don't need a second import.
export const ui = { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, Separator }

/** Named exports referenced by the manifest ui.slots map. */
export const ModrinthConsoleToolbar = ConsoleToolbar

export default { BrowsePage, AdminConfigPage, ConsoleToolbar }
