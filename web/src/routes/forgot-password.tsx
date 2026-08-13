import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/auth/auth-layout'
import { useAuthConfig, DEFAULT_SETTINGS } from '@/lib/auth-config'
import { submitForgotPassword } from '@/lib/auth'

export const Route = createFileRoute('/forgot-password')({
  component: ForgotPasswordPage,
})

function ForgotPasswordPage() {
  const navigate = Route.useNavigate()
  const auth = useAuthConfig()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const settings = auth.data?.settings

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const outcome = await submitForgotPassword({
        email: email.trim(),
        csrfToken: auth.data?.csrfToken ?? null,
      })
      if (outcome.type === 'success') {
        // The endpoint always reports the same outcome (anti-enumeration):
        // show the neutral confirmation on the login page, as EJS does.
        navigate({ to: '/login', search: { err: 'reset_email_sent' } })
        return
      }
      setError(outcome.message)
    } catch {
      setError('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a reset link."
      settings={settings ?? DEFAULT_SETTINGS}
      error={error}
      footer={
        <Link to="/login" className="text-sm font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            spellCheck={false}
            autoCapitalize="none"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  )
}