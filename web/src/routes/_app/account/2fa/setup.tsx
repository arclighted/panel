import { useEffect, useState } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  AlertTriangle,
  Check,
  LoaderCircle,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'

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
import { useAuthConfig } from '@/lib/auth-config'
import { queryClient } from '@/lib/query-client'

export const Route = createFileRoute('/_app/account/2fa/setup')({
  validateSearch: (search: Record<string, unknown>): { required?: string } => ({
    required: typeof search.required === 'string' ? search.required : undefined,
  }),
  component: TwoFactorSetupPage,
})

interface SetupData {
  qrDataUrl: string
  secretBase32: string
  required: boolean
}

function TwoFactorSetupPage() {
  const { required } = Route.useSearch()
  const auth = useAuthConfig()
  const csrf = auth.data?.csrfToken ?? null

  const [setup, setSetup] = useState<SetupData | null>(null)
  const [alreadyEnabled, setAlreadyEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState('')
  const [enabling, setEnabling] = useState(false)
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([])
  const [password, setPassword] = useState('')
  const [disabling, setDisabling] = useState(false)
  const [justDisabled, setJustDisabled] = useState(false)

  useEffect(() => {
    void loadSetup()
    // loadSetup is intentionally referenced once: the effect must only run on
    // mount (the search `required` param is fixed for the lifetime of the
    // page; the "Set up again" button calls loadSetup() directly).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Fetches the current 2FA state (QR + secret, or alreadyEnabled). */
  function loadSetup(): Promise<void> {
    setLoading(true)
    return fetch(
      `/api/account/2fa/setup${required === '1' ? '?required=1' : ''}`,
      { credentials: 'same-origin' },
    )
      .then((r) => r.json() as Promise<{ success?: boolean; alreadyEnabled?: boolean } & SetupData>)
      .then((data) => {
        if (data.success && data.qrDataUrl) {
          setSetup(data)
          setAlreadyEnabled(false)
        } else if (data.alreadyEnabled) {
          setAlreadyEnabled(true)
        }
      })
      .catch(() => {
        toast.error('Failed to start 2FA setup.')
      })
      .finally(() => setLoading(false))
  }

  async function enable(): Promise<void> {
    if (!csrf || !token.trim()) return
    setEnabling(true)
    try {
      const res = await fetch('/account/2fa/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ token: token.trim() }),
        credentials: 'same-origin',
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
        recoveryCodes?: string[]
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to enable two-factor authentication.')
      }
      setRecoveryCodes(data.recoveryCodes ?? [])
      // The account page badge reads user.totpEnabled from auth-config; make
      // it reflect the new state without waiting for the 30s staleTime.
      void queryClient.invalidateQueries({ queryKey: ['auth-config'] })
      toast.success('Two-factor authentication enabled.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to enable 2FA.')
    } finally {
      setEnabling(false)
    }
  }

  async function disable(): Promise<void> {
    if (!csrf || !password.trim()) return
    setDisabling(true)
    try {
      const res = await fetch('/account/2fa/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrf ? { 'CSRF-Token': csrf } : {}),
        },
        body: JSON.stringify({ password: password.trim() }),
        credentials: 'same-origin',
      })
      const data = (await res.json()) as {
        success?: boolean
        error?: string
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to disable two-factor authentication.')
      }
      setJustDisabled(true)
      // Keep the local setup state in sync with the now-disabled account so
      // "Set up again" can re-arm the QR flow without a full page reload.
      setPassword('')
      // The account page badge reads user.totpEnabled from auth-config; make
      // it reflect the new state without waiting for the 30s staleTime.
      void queryClient.invalidateQueries({ queryKey: ['auth-config'] })
      toast.success('Two-factor authentication disabled.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to disable 2FA.')
    } finally {
      setDisabling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" />
        Preparing setup...
      </div>
    )
  }

  if (justDisabled) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldOff className="size-5 text-muted-foreground" />
            Two-factor authentication disabled
          </CardTitle>
          <CardDescription>
            Your account is no longer protected by 2FA. You can set it up again anytime.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              setJustDisabled(false)
              setSetup(null)
              setAlreadyEnabled(false)
              setToken('')
              setRecoveryCodes([])
              void loadSetup()
            }}
          >
            <ShieldCheck className="size-4" />
            Set up again
          </Button>
          <Button variant="ghost" className="w-full" render={<Link to="/account" />}>
            Back to account
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (alreadyEnabled) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            Two-factor authentication is already enabled
          </CardTitle>
          <CardDescription>
            Your account is protected. To turn it off, confirm your current password.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="2fa-password">Current password</Label>
            <Input
              id="2fa-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void disable()
              }}
            />
          </div>
          <Button
            className="w-full"
            variant="destructive"
            disabled={disabling || password.length === 0}
            onClick={() => void disable()}
          >
            {disabling ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <ShieldOff className="size-4" />
            )}
            Disable two-factor authentication
          </Button>
          <Button variant="secondary" className="w-full" render={<Link to="/account" />}>
            Back to account
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!setup) {
    return (
      <p className="text-sm text-muted-foreground">Setup is unavailable right now.</p>
    )
  }

  if (recoveryCodes.length > 0) {
    return (
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Recovery codes</CardTitle>
          <CardDescription>
            Save these somewhere safe. Each code can be used once to sign in if you lose
            your authenticator app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
            {recoveryCodes.map((code) => (
              <li key={code} className="rounded-lg border bg-muted/40 px-3 py-2">
                {code}
              </li>
            ))}
          </ul>
          <Button variant="secondary" render={<Link to="/account" />}>
            <Check className="size-4" />
            Done — back to account
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-lg space-y-6">
      {setup.required ? (
        <div className="flex items-center gap-3 rounded-xl border border-amber-600/40 bg-amber-600/10 px-4 py-3 text-sm">
          <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>
            <strong>Two-factor authentication is required</strong> to access the admin panel.
            Enable it now to continue.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Set up two-factor authentication
          </CardTitle>
          <CardDescription>
            Scan the QR code with an authenticator app, then confirm with a code.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-center">
            <img
              src={setup.qrDataUrl}
              alt="TOTP QR code"
              className="rounded-xl border"
              width={220}
              height={220}
            />
          </div>
          <div className="text-center">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Manual entry secret
            </p>
            <p className="mt-1 font-mono text-sm">{setup.secretBase32}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="2fa-token">6-digit code</Label>
            <Input
              id="2fa-token"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={token}
              onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void enable()
              }}
            />
          </div>
          <Button className="w-full" disabled={enabling || token.length !== 6} onClick={() => void enable()}>
            {enabling ? <LoaderCircle className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Enable two-factor authentication
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
