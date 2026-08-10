import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthLayout } from '@/components/auth/auth-layout'
import { useAuthConfig } from '@/lib/auth-config'
import { submitRegister } from '@/lib/auth'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const USERNAME_REGEX = /^[a-zA-Z0-9]{3,20}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

function RegisterPage() {
  const navigate = Route.useNavigate()
  const auth = useAuthConfig()

  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; email?: string; password?: string }>({})
  const [loading, setLoading] = useState(false)

  const settings = auth.data?.settings
  const registrationAllowed = auth.isSuccess
    ? auth.data.firstUser || (settings?.allowRegistration ?? false)
    : true

  // Mirror Express GET /register: if registration is disabled and this is not
  // the first user, bounce to the login page with the same error code.
  useEffect(() => {
    if (auth.isSuccess && !registrationAllowed) {
      navigate({ to: '/login', search: { err: 'registration_disabled' } })
    }
  }, [auth.isSuccess, registrationAllowed, navigate])

  function validate(): boolean {
    const fe: typeof fieldErrors = {}
    if (!USERNAME_REGEX.test(username.trim())) {
      fe.username = 'Username must be 3–20 characters, letters and numbers only.'
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      fe.email = 'Enter a valid email address.'
    }
    if (!PASSWORD_REGEX.test(password)) {
      fe.password = 'Password needs 8+ characters, at least one letter and one number.'
    }
    setFieldErrors(fe)
    return Object.keys(fe).length === 0
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    setError(null)
    try {
      const outcome = await submitRegister({
        email: email.trim(),
        username: username.trim(),
        password,
        csrfToken: auth.data?.csrfToken ?? null,
      })
      if (outcome.type === 'success') {
        navigate({ to: '/login' })
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
      title="Create account"
      subtitle={settings?.title}
      settings={settings ?? { title: 'Arclight', logo: null, allowRegistration: false, loginWallpaper: null, registerWallpaper: null }}
      wallpaper={settings?.registerWallpaper}
      error={error}
      footer={
        <p>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" autoComplete="on" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              spellCheck={false}
              autoCapitalize="none"
              maxLength={20}
              placeholder="johndoe"
              aria-invalid={!!fieldErrors.username}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            {fieldErrors.username ? <p className="text-xs text-destructive">{fieldErrors.username}</p> : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
              aria-invalid={!!fieldErrors.email}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            {fieldErrors.email ? <p className="text-xs text-destructive">{fieldErrors.email}</p> : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              placeholder="••••••••"
              aria-invalid={!!fieldErrors.password}
              className="pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">8+ characters, one letter, one number.</p>
          {fieldErrors.password ? <p className="text-xs text-destructive">{fieldErrors.password}</p> : null}
        </div>

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}

function EyeIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.73 5.08A10.75 10.75 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  )
}