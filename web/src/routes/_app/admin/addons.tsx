import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { LoaderCircle, Power, RefreshCw, Store, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuthConfig } from '@/lib/auth-config'
import { reloadAddons, toggleAddon, uninstallAddon, useAdminPage } from '@/lib/admin'

export const Route = createFileRoute('/_app/admin/addons')({
  component: AdminAddonsPage,
})

interface AddonRow {
  slug: string
  name?: string
  version?: string
  enabled?: boolean
  hasDisabledPh: boolean
  manifest: {
    name?: string
    version?: string
    description?: string
    author?: string
  } | null
}

interface AddonsData {
  addons: AddonRow[]
}

function AdminAddonsPage() {
  const queryClient = useQueryClient()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null
  const page = useAdminPage<AddonsData>('addons')
  const [busy, setBusy] = useState<string | null>(null)

  const addons = page.data?.addons ?? []

  const refresh = () =>
    void queryClient.invalidateQueries({ queryKey: ['admin-page', 'addons'] })

  async function toggle(row: AddonRow): Promise<void> {
    if (!csrf) return
    setBusy(`t-${row.slug}`)
    try {
      await toggleAddon(row.slug, row.enabled !== true, csrf)
      toast.success(`${row.slug} ${row.enabled !== true ? 'enabled' : 'disabled'}.`)
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to toggle addon.')
    } finally {
      setBusy(null)
    }
  }

  async function remove(row: AddonRow): Promise<void> {
    if (!csrf) return
    if (!window.confirm(`Uninstall "${row.slug}"?`)) return
    setBusy(`u-${row.slug}`)
    try {
      await uninstallAddon(row.slug, csrf)
      toast.success('Addon uninstalled.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to uninstall addon.')
    } finally {
      setBusy(null)
    }
  }

  async function reload(): Promise<void> {
    if (!csrf) return
    setBusy('reload')
    try {
      await reloadAddons(csrf)
      toast.success('Addons reloaded.')
      refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reload addons.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Addons</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {addons.length} installed {addons.length === 1 ? 'addon' : 'addons'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            nativeButton={false}
            render={<a href="/admin/addons/store" />}
          >
            <Store className="size-4" />
            Store
          </Button>
          <Button variant="secondary" size="sm" disabled={busy === 'reload'} onClick={() => void reload()}>
            <RefreshCw className="size-4" />
            Reload
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installed addons</CardTitle>
          <CardDescription>Extend the panel with community packages</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {page.isLoading ? (
            <div className="flex items-center gap-2 border-t px-4 py-8 text-sm text-muted-foreground">
              <LoaderCircle className="size-4 animate-spin" />
              Loading addons...
            </div>
          ) : addons.length === 0 ? (
            <p className="border-t px-4 py-8 text-center text-sm text-muted-foreground">
              No addons installed yet.
            </p>
          ) : (
            <ul className="divide-y border-t">
              {addons.map((row) => {
                const enabled = row.enabled !== false && !row.hasDisabledPh
                return (
                  <li key={row.slug} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${
                        enabled ? 'bg-emerald-500' : 'bg-muted-foreground/40'
                      }`}
                      title={enabled ? 'Enabled' : 'Disabled'}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {row.manifest?.name ?? row.name ?? row.slug}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {row.slug}
                        {row.manifest?.version ? ` · v${row.manifest.version}` : ''}
                        {row.manifest?.author ? ` · ${row.manifest.author}` : ''}
                      </p>
                      {row.manifest?.description ? (
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {row.manifest.description}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busy === `t-${row.slug}`}
                        onClick={() => void toggle(row)}
                      >
                        <Power className="size-3" />
                        {enabled ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={busy === `u-${row.slug}`}
                        onClick={() => void remove(row)}
                      >
                        <Trash2 className="size-3" />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
