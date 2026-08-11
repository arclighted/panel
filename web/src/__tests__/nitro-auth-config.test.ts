// @vitest-environment node
/**
 * Tests for the Nitro-owned GET /api/auth-config handler. Pins the
 * byte-identical response shape (D2/D3 contract) that the React Query layer
 * consumes — the same fields Express returns, including the settings
 * fallbacks and firstUser flag.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createServer } from 'node:http'
import { createApp, defineEventHandler } from 'h3'
import { toNodeListener } from 'h3/node'

const mocks = vi.hoisted(() => ({
  loadSession: vi.fn(),
  generateCsrfToken: vi.fn(),
  nitroPrisma: {
    settings: { findUnique: vi.fn() },
    users: { count: vi.fn() },
  },
}))

vi.mock('../../server/utils/auth-session', () => ({
  loadSession: mocks.loadSession,
  generateCsrfToken: mocks.generateCsrfToken,
  nitroPrisma: mocks.nitroPrisma,
}))

const handler = (
  await import('../../server/routes/api/auth-config.get')
).default

function makeApp() {
  const app = createApp()
  app.all('/api/auth-config', handler)
  return toNodeListener(app)
}

async function withServer(
  listener: (req: unknown, res: unknown) => void,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = createServer(listener as never)
  await new Promise((resolve) => server.listen(0, resolve))
  const address = server.address() as { port: number }
  try {
    await fn(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

describe('GET /api/auth-config (Nitro)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSession.mockResolvedValue({})
    mocks.generateCsrfToken.mockResolvedValue('test-token-1')
  })

  it('returns the exact response shape with a signed-in user', async () => {
    mocks.loadSession.mockResolvedValue({
      user: { id: 7, email: 'owner@arclight.dev', isAdmin: true, username: 'owner' },
    })
    mocks.nitroPrisma.settings.findUnique.mockResolvedValue({
      title: 'My Panel',
      logo: '/logo.png',
      allowRegistration: true,
      loginWallpaper: '/wall.jpg',
      registerWallpaper: null,
    })
    mocks.nitroPrisma.users.count.mockResolvedValue(1)

    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/auth-config`)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({
        csrfToken: 'test-token-1',
        user: {
          id: 7,
          email: 'owner@arclight.dev',
          isAdmin: true,
          username: 'owner',
        },
        firstUser: false,
        settings: {
          title: 'My Panel',
          logo: '/logo.png',
          allowRegistration: true,
          loginWallpaper: '/wall.jpg',
          registerWallpaper: null,
        },
      })
    })
  })

  it('falls back to defaults and flags firstUser when no settings/users exist', async () => {
    mocks.nitroPrisma.settings.findUnique.mockResolvedValue(null)
    mocks.nitroPrisma.users.count.mockResolvedValue(0)

    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/auth-config`)
      expect(await res.json()).toEqual({
        csrfToken: 'test-token-1',
        user: null,
        firstUser: true,
        settings: {
          title: 'Arclight',
          logo: null,
          allowRegistration: false,
          loginWallpaper: null,
          registerWallpaper: null,
        },
      })
    })
  })

  it('returns 500 with the Express error shape on failure', async () => {
    mocks.generateCsrfToken.mockRejectedValue(new Error('boom'))

    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/auth-config`)
      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Failed to fetch auth config' })
    })
  })
})
