import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  parseRedirectOutcome,
  submit2FA,
  type RedirectHandlerOptions,
} from '@/lib/auth'
import { loginErrorMessage } from '@/lib/errors'

const loginOpts: RedirectHandlerOptions = {
  successPaths: ['/', '/2fa'],
  errorPaths: ['/login'],
  mapError: loginErrorMessage,
  rateLimitMessage: 'Too many attempts. Try again in a minute.',
}

describe('parseRedirectOutcome', () => {
  it('reports success for the dashboard', () => {
    const outcome = parseRedirectOutcome('http://localhost/', loginOpts)
    expect(outcome).toEqual({ type: 'success', path: '/' })
  })

  it('reports success for the 2FA step', () => {
    const outcome = parseRedirectOutcome('http://localhost/2fa', loginOpts)
    expect(outcome).toEqual({ type: 'success', path: '/2fa' })
  })

  it('maps error redirects via the err param', () => {
    const outcome = parseRedirectOutcome(
      'http://localhost/login?err=invalid_credentials',
      loginOpts,
    )
    expect(outcome).toEqual({
      type: 'error',
      message: 'Incorrect username or password.',
    })
  })

  it('handles unparseable URLs', () => {
    const outcome = parseRedirectOutcome('not-a-url', loginOpts)
    expect(outcome.type).toBe('error')
  })
})

describe('register redirect interplay', () => {
  const registerOpts: RedirectHandlerOptions = {
    successPaths: ['/login'],
    errorPaths: ['/register', '/login'],
    mapError: (err) => (err ? 'Registration is currently disabled.' : ''),
    rateLimitMessage: 'x',
  }

  it('treats a plain /login redirect as success', () => {
    const outcome = parseRedirectOutcome('http://localhost/login', registerOpts)
    expect(outcome).toEqual({ type: 'success', path: '/login' })
  })

  it('treats /login?err=registration_disabled as an error', () => {
    const outcome = parseRedirectOutcome(
      'http://localhost/login?err=registration_disabled',
      registerOpts,
    )
    expect(outcome).toEqual({
      type: 'error',
      message: 'Registration is currently disabled.',
    })
  })
})

describe('submit2FA', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns success with the redirect target', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, redirect: '/' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const outcome = await submit2FA({ token: '123456', csrfToken: 'tok' })
    expect(outcome).toEqual({ type: 'success', path: '/' })

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(url).toBe('/2fa')
    expect((init as RequestInit).headers).toMatchObject({ 'CSRF-Token': 'tok' })
  })

  it('returns the server error message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid code. Try again.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    const outcome = await submit2FA({ token: '000000', csrfToken: 'tok' })
    expect(outcome).toEqual({
      type: 'error',
      message: 'Invalid code. Try again.',
    })
  })
})