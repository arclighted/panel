/**
 * Arclight Cloud — v3 UI bundle entry.
 *
 * Follows the addon v3 UI contract (docs/addon-ui-contract-v3.md), mirroring
 * the modrinth reference implementation:
 *
 *  - Built as an ESM bundle that EXTERNALIZES react, react-dom,
 *    react/jsx-runtime, @arclight/ui, and @tanstack/react-query (the browser
 *    resolves them through the panel's import map — single React instance).
 *  - Named exports are referenced by the manifest's `ui.routes` entry
 *    (`/arclight-cloud/settings` → SettingsPage).
 *  - Server data comes from the addon's OWN Express API (/arclight-cloud/api).
 *
 * Build: pnpm --dir storage/addons/arclight-cloud build:ui
 * Output: public/ui/bundle.mjs (+ styles.css) served at
 *         /addon-assets/arclight-cloud/ui/bundle.mjs
 */
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@arclight/ui'

/* ── Types (mirror the addon's own API response shapes) ──────────────────── */

interface SettingsResponse {
  success: boolean
  data: {
    arclightCloudApiKey: string
    arclightCloudBackupEnabled: boolean
  }
}

interface SaveResponse {
  success: boolean
  error?: string
}

/* ── API helpers ─────────────────────────────────────────────────────────── */

function csrfToken(): string {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? ''
}

const api = {
  fetchSettings: async (): Promise<SettingsResponse['data']> => {
    const res = await fetch('/arclight-cloud/api/settings', { credentials: 'same-origin' })
    if (!res.ok) throw new Error('Failed to load settings')
    const data = (await res.json()) as SettingsResponse
    return data.success ? data.data : { arclightCloudApiKey: '', arclightCloudBackupEnabled: false }
  },
  saveSettings: async (input: { arclightCloudApiKey: string; arclightCloudBackupEnabled: boolean }): Promise<string | null> => {
    const res = await fetch('/arclight-cloud/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-csrf-token': csrfToken(),
      },
      credentials: 'same-origin',
      body: JSON.stringify(input),
    })
    const data = (await res.json()) as SaveResponse
    return data.success ? null : (data.error ?? 'Failed to save settings')
  },
}

/* ── Route component: SettingsPage (declared at /arclight-cloud/settings) ── */

// Stable default so the form-sync effect doesn't re-fire on every render
// while the query is still loading (mirrors the EMPTY_MANIFESTS pattern).
const EMPTY_SETTINGS = { arclightCloudApiKey: '', arclightCloudBackupEnabled: false }

export function SettingsPage() {
  const { data: initial = EMPTY_SETTINGS, refetch } = useQuery({
    queryKey: ['arclight-cloud-settings'],
    queryFn: api.fetchSettings,
    staleTime: 30_000,
  })

  const [apiKey, setApiKey] = useState('')
  const [backupEnabled, setBackupEnabled] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  // Populate the form once the initial settings arrive (and when they change
  // from a refetch after saving).
  useEffect(() => {
    setApiKey(initial.arclightCloudApiKey ?? '')
    setBackupEnabled(initial.arclightCloudBackupEnabled ?? false)
    setLoaded(true)
  }, [initial])

  async function save() {
    setBusy(true)
    setMessage(null)
    const err = await api.saveSettings({ arclightCloudApiKey: apiKey, arclightCloudBackupEnabled: backupEnabled })
    if (err) {
      setMessage({ kind: 'error', text: err })
    } else {
      setMessage({ kind: 'success', text: 'Settings saved.' })
      refetch()
    }
    setBusy(false)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" data-addon-arclight-cloud>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Arclight Cloud</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure your Arclight Cloud integration — cloud backups, API access, and more.
        </p>
      </header>

      {!loaded ? (
        <div className="mt-10 flex items-center justify-center text-sm text-muted-foreground">Loading…</div>
      ) : (
        <div className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">API Settings</CardTitle>
              <CardDescription>Your Arclight Cloud API key.</CardDescription>
            </CardHeader>
            <CardContent>
              <div>
                <Label htmlFor="arclight-cloud-api-key">Arclight Cloud API key</Label>
                <Input
                  id="arclight-cloud-api-key"
                  type="password"
                  placeholder="YOUR_API_KEY_HERE"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="mt-1 font-mono"
                  autoComplete="off"
                  spellCheck={false}
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Get your API key from{' '}
                  <a
                    href="https://arclight.my.id/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    Arclight Cloud
                  </a>
                  .
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Features</CardTitle>
              <CardDescription>Which Arclight Cloud features are enabled.</CardDescription>
            </CardHeader>
            <CardContent>
              <label className="flex cursor-pointer items-center justify-between gap-4">
                <span>
                  <span className="block text-sm font-medium">Enable Cloud Backups</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    When enabled, instance backups are stored on Arclight Cloud instead of the local daemon.
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={backupEnabled}
                  onChange={(e) => setBackupEnabled(e.target.checked)}
                  className="size-4 accent-[var(--theme-accent,#3b82f6)]"
                  aria-label="Enable cloud backups"
                />
              </label>
            </CardContent>
          </Card>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy}>
              {busy ? 'Saving…' : 'Save Settings'}
            </Button>
            {message ? (
              <p className={`text-sm ${message.kind === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                {message.text}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}

export default { SettingsPage }
