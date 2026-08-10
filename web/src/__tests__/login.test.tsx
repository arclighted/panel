import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from '@tanstack/react-router'

import { routeTree } from '../routeTree.gen'
import { queryClient } from '../lib/query-client'

function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  // The root route wraps content in the shared queryClient (see __root.tsx),
  // so each test must start from an empty cache or auth-config state leaks
  // between tests (staleTime is 30s in production config).
  return render(<RouterProvider router={router} />)
}

function mockAuthConfig(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      csrfToken: 'test-token',
      user: null,
      firstUser: false,
      settings: {
        title: 'Arclight',
        logo: null,
        allowRegistration: true,
        loginWallpaper: null,
        registerWallpaper: null,
      },
      ...overrides,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

describe('login page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    queryClient.clear()
  })

  it('renders the login form', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockAuthConfig()),
    )

    renderApp('/login')

    await waitFor(() => {
      expect(screen.getByLabelText('Username or email')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
    // The register link only renders once the auth-config query resolves.
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Create one' })).toBeInTheDocument()
    })
  })

  it('shows the server rate-limit message on a 429', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/api/auth-config')) {
        return mockAuthConfig()
      }
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Try again in a minute.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } },
      )
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp('/login')

    const identifier = await screen.findByLabelText('Username or email')
    await userEvent.type(identifier, 'admin')
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password')
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    await waitFor(() => {
      expect(
        screen.getByText('Too many attempts. Try again in a minute.'),
      ).toBeInTheDocument()
    })

    // The POST must carry the CSRF token header.
    const postCall = fetchMock.mock.calls.find(
      ([url]) => String(url) === '/login',
    )
    expect(postCall).toBeDefined()
    const headers = (postCall?.[1] as RequestInit | undefined)?.headers as
      | Record<string, string>
      | undefined
    expect(headers?.['CSRF-Token']).toBe('test-token')
  })

  it('shows a redirect-provided error from the search params', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(mockAuthConfig()),
    )

    renderApp('/login?err=password_reset')

    await waitFor(() => {
      expect(
        screen.getByText('Password updated. Sign in with your new password.'),
      ).toBeInTheDocument()
    })
  })

  it('redirects to the dashboard when already signed in', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockAuthConfig({
          user: { id: 1, email: 'admin@arclight.dev', isAdmin: true, username: 'admin' },
        }),
      ),
    )

    renderApp('/login')

    // The login page should navigate to the dashboard, which greets the user.
    await waitFor(
      () => {
        expect(screen.getByText(/Welcome/)).toBeInTheDocument()
      },
      { timeout: 3000 },
    )
    expect(screen.getByText(/admin/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument()
  })
})