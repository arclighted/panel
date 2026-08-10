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
import { createFolder } from '../lib/folders'
import { skipOnboarding } from '../lib/onboarding'

const NAV = {
  regular: [
    {
      id: 'servers',
      label: 'Dashboard',
      url: '/',
      iconName: 'layout-grid',
      icon: '',
      matchPrefix: '/server',
    },
  ],
  admin: [],
  adminGroups: [],
}

const SERVER_1 = {
  UUID: 'aaaa-1111',
  name: 'Survival',
  description: 'Vanilla survival',
  Storage: 2048,
  Suspended: false,
  shared: false,
  status: 'running',
  dockerStatus: 'running',
  ramUsage: '42.5',
  cpuUsage: '12',
  ramUsed: '850MB',
  nodeOffline: false,
  node: { name: 'Main Node', address: '127.0.0.1' },
  owner: { username: 'admin', avatar: null },
}

const SERVER_2 = {
  UUID: 'bbbb-2222',
  name: 'Creative',
  description: null,
  Storage: 0,
  Suspended: false,
  shared: false,
  status: 'stopped',
  dockerStatus: null,
  ramUsage: '0',
  cpuUsage: '0',
  ramUsed: '0MB',
  nodeOffline: false,
  node: { name: 'Main Node', address: '127.0.0.1' },
  owner: { username: 'admin', avatar: null },
}

function authConfig(user: unknown) {
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

function dashboardPayload(overrides: Record<string, unknown> = {}) {
  return new Response(
    JSON.stringify({
      success: true,
      servers: [SERVER_1, SERVER_2],
      allServers: [SERVER_1, SERVER_2],
      folders: [{ id: 1, name: 'Game Servers', members: [] }],
      canCreateServer: true,
      currentPage: 1,
      totalPages: 1,
      daemonOffline: false,
      offlineNodes: [],
      needsOnboarding: false,
      canCreateServerForOnboarding: false,
      nav: NAV,
      ...overrides,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

function renderApp(path = '/') {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  })
  return render(<RouterProvider router={router} />)
}

const signedInUser = {
  id: 1,
  email: 'admin@arclight.dev',
  isAdmin: true,
  username: 'admin',
}

describe('dashboard page', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    queryClient.clear()
  })

  it('renders server cards with status, usage and owner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth-config')) {
          return authConfig(signedInUser)
        }
        if (String(url).includes('/api/dashboard')) {
          return dashboardPayload()
        }
        return new Response('{}', { status: 404 })
      }),
    )

    renderApp()

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    // The heading renders as soon as the page mounts; server cards wait for
    // the dashboard payload query.
    await waitFor(
      () => {
        expect(screen.getByText('Survival')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    expect(screen.getByText('Creative')).toBeInTheDocument()
    expect(screen.getByText('Online')).toBeInTheDocument()
    expect(screen.getByText('Offline')).toBeInTheDocument()
    // Usage tiles (42.5 → 43%) and storage formatting.
    expect(screen.getByText('43%')).toBeInTheDocument()
    expect(screen.getByText('2.0 GB')).toBeInTheDocument()
    expect(screen.getByText('Unlimited')).toBeInTheDocument()
    // Folder card.
    expect(screen.getByRole('button', { name: 'Open folder Game Servers' }))
      .toBeInTheDocument()
    // Nav link from the payload (sidebar + mobile bottom nav).
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0)
  })

  it('toggles between grid and list views', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth-config')) {
          return authConfig(signedInUser)
        }
        if (String(url).includes('/api/dashboard')) {
          return dashboardPayload()
        }
        return new Response('{}', { status: 404 })
      }),
    )

    renderApp()

    await waitFor(
      () => {
        expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    // Table is hidden in grid view.
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()

    // Wait for the payload so the view toggle is present.
    await waitFor(
      () => {
        expect(screen.getByText('Survival')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    await userEvent.click(screen.getByRole('button', { name: /List/ }))
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument()
    expect(screen.getByText('Survival')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Grid/ }))
    expect(screen.queryByRole('columnheader', { name: 'Status' })).not.toBeInTheDocument()
  })

  it('creates a folder through a CSRF-guarded POST', async () => {
    // The dialog itself is exercised in the browser (base-ui focus
    // management hangs under jsdom); this test locks the mutation contract.
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) === '/api/folders') {
        return new Response(
          JSON.stringify({
            success: true,
            folder: { id: 2, name: 'Test Folder', members: [] },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await createFolder('Test Folder', 'test-token')

    const createCall = fetchMock.mock.calls.find(
      ([url]) => String(url) === '/api/folders',
    )
    expect(createCall).toBeDefined()
    const init = createCall?.[1] as RequestInit | undefined
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.['CSRF-Token']).toBe('test-token')
    expect(JSON.parse(String(init?.body))).toEqual({ name: 'Test Folder' })
  })

  it('skips onboarding through a CSRF-guarded POST', async () => {
    // The dialog interaction itself hangs under jsdom (base-ui focus
    // management); this test locks the skip contract: POST /onboarding/skip
    // with the session CSRF token, then the dashboard refetches so
    // `needsOnboarding` flips to false and the dialog dismisses.
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url) === '/onboarding/skip') {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      return new Response('{}', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await skipOnboarding('test-token')

    const call = fetchMock.mock.calls.find(
      ([url]) => String(url) === '/onboarding/skip',
    )
    expect(call).toBeDefined()
    const init = call?.[1] as RequestInit | undefined
    expect(init?.method).toBe('POST')
    const headers = init?.headers as Record<string, string> | undefined
    expect(headers?.['CSRF-Token']).toBe('test-token')
  })

  it('shows the admin create action in the empty state', async () => {
    // Mirrors the EJS empty state (views/user/dashboard.ejs): admins always
    // get a create action pointing at /admin/servers/create, even when
    // `canCreateServer` (a non-admin flag) is false.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/auth-config')) {
          return authConfig(signedInUser)
        }
        if (String(url).includes('/api/dashboard')) {
          return dashboardPayload({
            servers: [],
            allServers: [],
            folders: [],
            canCreateServer: false,
          })
        }
        return new Response('{}', { status: 404 })
      }),
    )

    renderApp()

    await waitFor(
      () => {
        expect(screen.getByText('No servers yet')).toBeInTheDocument()
      },
      { timeout: 5000 },
    )
    expect(
      screen.getByText('Create your first server to get started.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Create server' })).toHaveAttribute(
      'href',
      '/admin/servers/create',
    )
  })
})
