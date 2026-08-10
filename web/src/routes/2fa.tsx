import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/auth/auth-layout'
import { useAuthConfig, isAuthenticatedUser, DEFAULT_SETTINGS } from '@/lib/auth-config'
import { submit2FA } from '@/lib/auth'
import { queryClient } from '@/lib/query-client'

export const Route = createFileRoute('/2fa')({
  component: TwoFactorPage,
})

function TwoFactorPage() {
  const navigate = Route.useNavigate()
  const auth = useAuthConfig()

  const [token, setToken] = useState('')
  const [recoveryMode, setRecoveryMode] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // No 2FA flow in progress (or already signed in) → back to login.
  useEffect(() => {
    if (auth.isSuccess && isAuthenticatedUser(auth.data.user)) {
      navigate({ to: '/' })
    }
  }, [auth.isSuccess, auth.data?.user, navigate])

  const settings = auth.data?.settings

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const outcome = await submit2FA({
        token: token.replace(/[\s-]/g, ''),
        csrfToken: auth.data?.csrfToken ?? null,
      })
      if (outcome.type === 'success') {
        queryClient.removeQueries({ queryKey: ['auth-config'] })
        navigate({ to: outcome.path === '/2fa' ? '/' : (outcome.path as '/') })
        return
      }
      setError(outcome.message)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
      setToken('')
    }
  }

  return (
    <AuthLayout
      title="Two-factor authentication"
      subtitle="Enter the 6-digit code from your authenticator app."
      settings={settings ?? DEFAULT_SETTINGS}
      error={error}
      footer={
        <p>
          Lost access to your authenticator app?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in again
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="off" noValidate>
        <div className="space-y-2">
          <Label htmlFor="token">{recoveryMode ? 'Recovery code' : '6-digit code'}</Label>
          <Input
            id="token"
            name="token"
            type="text"
            inputMode={recoveryMode ? undefined : 'numeric'}
            autoComplete="one-time-code"
            required
            autoFocus
            maxLength={recoveryMode ? 14 : 6}
            placeholder={recoveryMode ? 'XXXX-XXXX-XXXX' : '••••••'}
            className="text-center font-mono text-lg tracking-[0.4em]"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Verifying…' : 'Verify and sign in'}
        </Button>

        <button
          type="button"
          onClick={() => {
            setRecoveryMode((v) => !v)
            setToken('')
          }}
          className="w-full text-center text-sm font-medium text-primary hover:underline"
        >
          {recoveryMode ? 'Use the 6-digit code instead' : 'Use a recovery code instead'}
        </button>
      </form>
    </AuthLayout>
  )
}