import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * Phase 1.5 contract tests: the migrated server pages (worlds/players),
 * user pages (account, create-server) and the admin panel data layer.
 * Each test pins the URL, method, CSRF header, and payload shape so a
 * backend contract change fails loudly.
 */

function mockFetch(
  impl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
) {
  vi.stubGlobal('fetch', vi.fn(impl))
}

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    ok,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

/* ── server-pages lib ────────────────────────────────────────────────────── */

describe('server-pages', () => {
  it('maps world names to the EJS icon set', async () => {
    const { worldIcon } = await import('@/lib/server-pages')
    expect(worldIcon('world')).toBe('/assets/world_icons/overworld.png')
    expect(worldIcon('world_nether')).toBe('/assets/world_icons/nether.png')
    expect(worldIcon('world_the_end')).toBe('/assets/world_icons/end.png')
    expect(worldIcon('survival_nether')).toBe('/assets/world_icons/nether.png')
    expect(worldIcon('anything_else')).toBe('/assets/world_icons/overworld.png')
  })

  it('fetches worlds from the additive endpoint', async () => {
    const { fetchWorlds } = await import('@/lib/server-pages')
    const payload = { worlds: [{ name: 'world' }], daemonError: null }
    mockFetch(async (input) => {
      expect(String(input)).toBe('/api/server/abc-123/worlds')
      return jsonResponse(payload)
    })
    const data = await fetchWorlds('abc-123')
    expect(data.worlds).toEqual([{ name: 'world' }])
  })

  it('fetches player data from the existing endpoint with Accept json', async () => {
    const { fetchPlayersData } = await import('@/lib/server-pages')
    mockFetch(async (_input, init) => {
      expect(init?.headers).toMatchObject({ Accept: 'application/json' })
      return jsonResponse({
        players: [{ name: 'Steve', uuid: 'u1' }],
        serverInfo: { maxPlayers: 20, onlinePlayers: 1, version: '1.21' },
        serverIsOnline: true,
        error: null,
      })
    })
    const data = await fetchPlayersData('abc')
    expect(data.players).toHaveLength(1)
    expect(data.serverInfo.version).toBe('1.21')
  })
})

/* ── account lib ─────────────────────────────────────────────────────────── */

describe('account lib', () => {
  it('sends the CSRF header and JSON body on description updates', async () => {
    const { updateDescription } = await import('@/lib/account')
    mockFetch(async (_input, init) => {
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({ 'CSRF-Token': 'tok' })
      expect(init?.body).toBe(JSON.stringify({ description: 'hello' }))
      return jsonResponse({ message: 'ok' })
    })
    await expect(updateDescription('hello', 'tok')).resolves.toBeUndefined()
  })

  it('surfaces server-side error messages', async () => {
    const { changePassword } = await import('@/lib/account')
    mockFetch(async () => jsonResponse({ message: 'Current password is incorrect.' }, false, 401))
    await expect(changePassword('a', 'b', null)).rejects.toThrow(
      'Current password is incorrect.',
    )
  })

  it('uploads avatars as FormData with the CSRF header', async () => {
    const { uploadAvatar } = await import('@/lib/account')
    mockFetch(async (_input, init) => {
      expect(init?.body).toBeInstanceOf(FormData)
      expect((init?.headers as Record<string, string>)['CSRF-Token']).toBe('tok')
      return jsonResponse({ avatar: '/uploads/avatars/u/avatar.png' })
    })
    const file = new File(['x'], 'avatar.png', { type: 'image/png' })
    const path = await uploadAvatar(file, 'tok')
    expect(path).toBe('/uploads/avatars/u/avatar.png')
  })
})

/* ── create-server lib ───────────────────────────────────────────────────── */

describe('create-server lib', () => {
  it('posts the resource payload and resolves with the server UUID', async () => {
    const { createServer } = await import('@/lib/create-server')
    mockFetch(async (_input, init) => {
      expect(String(_input)).toBe('/create-server')
      expect(init?.method).toBe('POST')
      const body = JSON.parse(String(init?.body))
      expect(body).toMatchObject({ name: 'Test', Memory: 512, ports: [{ name: 'P', internalPort: 25565 }] })
      return jsonResponse({ success: true, serverUUID: 'srv-1' })
    })
    const uuid = await createServer(
      { name: 'Test', nodeId: 1, imageId: 2, dockerImage: 'v', Memory: 512, Swap: 0, Cpu: 100, Storage: 5120, ports: [{ name: 'P', internalPort: 25565 }] },
      null,
    )
    expect(uuid).toBe('srv-1')
  })

  it('parses error JSON from a failed create', async () => {
    const { createServer } = await import('@/lib/create-server')
    mockFetch(async () => jsonResponse({ error: 'Memory must be between 128 and 512 MB.' }, false, 400))
    await expect(
      createServer({ name: 'x', nodeId: 1, imageId: 1, dockerImage: 'v', Memory: 10, Swap: 0, Cpu: 100, Storage: 500 }, null),
    ).rejects.toThrow('Memory must be between 128 and 512 MB.')
  })
})

/* ── admin lib ───────────────────────────────────────────────────────────── */

describe('admin lib', () => {
  it('builds page-data URLs with optional ids', async () => {
    const { fetchAdminPage } = await import('@/lib/admin')
    mockFetch(async (input) => {
      expect(String(input)).toBe('/api/admin/page/users-edit?id=7')
      return jsonResponse({ success: true, page: 'users-edit', data: { dataUser: {} } })
    })
    await fetchAdminPage('users-edit', 7)
  })

  it('posts mutations with the CSRF header', async () => {
    const { adminPost } = await import('@/lib/admin')
    mockFetch(async (_input, init) => {
      expect(init?.method).toBe('POST')
      expect(init?.headers).toMatchObject({ 'CSRF-Token': 'tok' })
      expect(init?.body).toBe(JSON.stringify({ enabled: true }))
      return jsonResponse({ success: true })
    })
    await expect(adminPost('/admin/addons/toggle/x', { enabled: true }, 'tok')).resolves.toMatchObject({
      success: true,
    })
  })

  it('deletes with DELETE and throws on errors', async () => {
    const { adminDelete } = await import('@/lib/admin')
    mockFetch(async () => jsonResponse({ error: 'In use.' }, false, 400))
    await expect(adminDelete('/admin/mounts/1', null)).rejects.toThrow('In use.')
  })
})
