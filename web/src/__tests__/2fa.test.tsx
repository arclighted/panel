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

function mockAuthConfig(user: unknown) {
  return new Response(
    JSON.stringify({
      csrfToken: 'test-token',
      user,
      firstUser: false,
      settings: {
        title: 'Arclight',
        logo: null,
        allowRegistration: false,
        loginWallpaper: null,
        registerWallpaper: null,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function renderApp(path: string) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  // The root route wraps content in the shared queryClient (see __root.tsx).
  return render(<RouterProvider router={router} />)
}

describe('2fa page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    queryClient.clear()
  })

  it('submits the code with a CSRF header and lands on the dashboard', async () => {
    let signedIn = false
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const path = String(url)
      if (path.includes('/api/auth-config')) {
        // Before the POST the session is pending (user null); afterwards the
        // post-2FA session is returned to the re-fetched dashboard query.
        return mockAuthConfig(
          signedIn
            ? { id: 1, email: 'admin@arclight.dev', isAdmin: true, username: 'admin' }
            : null,
        )
      }
      if (path === '/2fa') {
        signedIn = true
        return new Response(JSON.stringify({ success: true, redirect: '/' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    renderApp('/2fa')

    const input = await screen.findByLabelText(
      '6-digit code',
      {},
      { timeout: 5000 },
    )
    await userEvent.type(input, '123456')
    await userEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }))

    // Land on the dashboard with the fresh post-2FA session.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    })

    // POST /2fa carried the CSRF token and the JSON body.
    const twoFaCall = fetchMock.mock.calls.find(([url]) => String(url) === '/2fa')
    expect(twoFaCall).toBeDefined()
    const init = twoFaCall?.[1] as RequestInit | undefined
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.['CSRF-Token']).toBe('test-token')
    expect(JSON.parse(String(init?.body))).toEqual({ token: '123456' })
  })

  it('toggles between code and recovery-code entry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockAuthConfig(null)))
    renderApp('/2fa')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Use a recovery code instead' }),
    )
    expect(screen.getByLabelText('Recovery code')).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole('button', { name: 'Use the 6-digit code instead' }),
    )
    expect(screen.getByLabelText('6-digit code')).toBeInTheDocument()
  })
})
