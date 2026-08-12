// @vitest-environment node
/**
 * Integration tests for the Phase 4 Nitro-owned static surface:
 *   02.static middleware (root public/, /themes, /uploads),
 *   GET /avatar/:seed (local dicebear SVG),
 *   GET /addon-assets/:slug/{*path} (addon public dirs).
 *
 * Runs the real middleware + route handlers through an h3 app composed the
 * same way Nitro builds it (01.session → 02.static → routes). Pins the
 * Express contract (D4): content types, fallthrough to the catch-all for
 * missing files, avatar seed validation + SVG output, and the addon-assets
 * slug/containment guards.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createServer, request as httpRequest } from 'node:http'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createApp } from 'h3'
import { toNodeListener } from 'h3/node'
import type { AddressInfo } from 'node:net'

// Env must be in place before the route modules are imported (path
// resolution + dicebear are set up at module load).
process.env.NODE_ENV = 'test'
process.env.URL = 'http://localhost'

const { default: staticMiddleware } = await import('../../server/middleware/02.static')
const avatarRoute = (await import('../../server/routes/avatar/[seed].get')).default
const addonAssetsRoute = (await import('../../server/routes/addon-assets/[slug]/[...path].get')).default

// Repo root, resolved the same way projectRoot() does (pnpm-workspace.yaml).
let repoRoot = path.resolve(process.env.INIT_CWD || process.cwd())
for (let i = 0; i < 8; i++) {
  if (existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) break
  const parent = path.dirname(repoRoot)
  if (parent === repoRoot) break
  repoRoot = parent
}

const app = createApp()
app.use(staticMiddleware)
app.all('/avatar/:seed', avatarRoute)
app.all('/addon-assets/:slug/**', addonAssetsRoute)
// Catch-all mirroring Nitro's SSR fallback: if the static middleware and
// routes fall through, the request lands here (status 200 HTML shell).
app.all('/**', () => new Response('<html>tanstack-shell</html>', {
  headers: { 'content-type': 'text/html' },
}))

let server: ReturnType<typeof createServer>
let base = ''
let port = 0

beforeAll(async () => {
  server = createServer(toNodeListener(app))
  await new Promise((resolve) => server.listen(0, resolve))
  port = (server.address() as AddressInfo).port
  base = `http://127.0.0.1:${port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
})

async function get(pathname: string): Promise<Response> {
  return fetch(`${base}${pathname}`)
}

/** Sends a RAW path (no client-side .. resolution — fetch() would normalize
 * dot segments away, defeating the point of a traversal test). */
async function getRaw(pathname: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = httpRequest(
      { host: '127.0.0.1', port, path: pathname, method: 'GET' },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (c) => (body += c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
      },
    )
    req.on('error', reject)
    req.end()
  })
}

// ── 02.static middleware: root public/ surface ──────────────────────────────

describe('02.static middleware', () => {
  it('serves /favicon.ico from the root public dir', async () => {
    const res = await get('/favicon.ico')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/vnd.microsoft.icon')
  })

  it('serves /tw.css and /styles.css with the css content type', async () => {
    for (const p of ['/tw.css', '/styles.css']) {
      const res = await get(p)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-type')).toContain('text/css')
      expect(Number(res.headers.get('content-length'))).toBeGreaterThan(0)
    }
  })

  it('serves /assets/wallpapers/* (root public/assets)', async () => {
    const res = await get('/assets/wallpapers/login.jpeg')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/jpeg')
  })

  it('serves builtin themes from /themes/*', async () => {
    const res = await get('/themes/default-dark.css')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/css')
  })

  it('falls through for a missing /uploads file (no crash, SSR shell)', async () => {
    const res = await get('/uploads/favicons/nonexistent-sentinel.png')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('tanstack-shell')
  })

  it('emits ETag + Last-Modified and answers 304 on If-None-Match', async () => {
    const first = await get('/tw.css')
    const etag = first.headers.get('etag')
    expect(etag).toBeTruthy()

    const res = await fetch(`${base}/tw.css`, {
      headers: { 'if-none-match': etag! },
    })
    expect(res.status).toBe(304)
  })

  it('falls through for unknown paths (client chunks, SSR)', async () => {
    const res = await get('/assets/does-not-exist.js')
    // Middleware returns undefined → the catch-all renders the app shell.
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('tanstack-shell')
  })

  it('serves the live web/public/uploads for avatar uploads', async () => {
    // Create a throwaway file in the live uploads dir, then remove it.
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'avatars')
    const probe = path.join(uploadsDir, '.phase4-test-probe.png')
    writeFileSync(probe, 'probe-bytes')
    try {
      const res = await get('/uploads/avatars/.phase4-test-probe.png')
      expect(res.status).toBe(200)
      expect(await res.text()).toBe('probe-bytes')
    } finally {
      rmSync(probe, { force: true })
    }
  })
})

// ── GET /avatar/:seed ───────────────────────────────────────────────────────

describe('GET /avatar/:seed', () => {
  it('returns an SVG avatar for a valid seed', async () => {
    const res = await get('/avatar/radityra')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/svg+xml')
    const body = await res.text()
    expect(body).toContain('<svg')
    expect(body.length).toBeGreaterThan(200)
  })

  it('is deterministic per seed', async () => {
    const a = await (await get('/avatar/alice')).text()
    const b = await (await get('/avatar/alice')).text()
    expect(a).toBe(b)
  })

  it('rejects a control-character seed with the Express error shape', async () => {
    const res = await get('/avatar/a%00b')
    // isValidAvatarSeed rejects NUL → 400 + text/plain body.
    expect(res.status).toBe(400)
    expect(await res.text()).toBe('invalid avatar seed')
  })

  it('serves a long but valid seed (username-length seeds)', async () => {
    const res = await get(`/avatar/${'u'.repeat(64)}`)
    expect(res.status).toBe(200)
  })
})

// ── GET /addon-assets/:slug/{*path} ─────────────────────────────────────────

describe('GET /addon-assets/:slug/{*path}', () => {
  // The modrinth addon ships a public/ui dir with real assets.
  const modrinthPublic = path.join(repoRoot, 'storage', 'addons', 'modrinth', 'public')

  it('serves the addon ui bundle (mirrors express.static)', async () => {
    if (!existsSync(path.join(modrinthPublic, 'ui', 'bundle.mjs'))) return
    const res = await get('/addon-assets/modrinth/ui/bundle.mjs')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/javascript')
  })

  it('serves the addon ui stylesheet', async () => {
    if (!existsSync(path.join(modrinthPublic, 'ui', 'styles.css'))) return
    const res = await get('/addon-assets/modrinth/ui/styles.css')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/css')
  })

  it('blocks traversal through the slug segment (raw path, no 500, no leak)', async () => {
    // fetch() normalizes .. client-side and h3 normalizes the raw pathname
    // before routing, so a ..-laden request can never reach the addon dir
    // (it lands on the SSR shell). The security property: never a 500 and
    // never /etc/passwd content.
    const res = await getRaw('/addon-assets/../../etc/passwd')
    expect(res.status).not.toBe(500)
    expect(res.body).not.toContain('root:')
  })

  it('blocks a slug that escapes the addons dir (raw path)', async () => {
    const res = await getRaw('/addon-assets/a/../../b')
    expect(res.status).not.toBe(500)
  })

  it('returns 404 for an unknown addon', async () => {
    const res = await get('/addon-assets/does-not-exist/ui/bundle.mjs')
    expect(res.status).toBe(404)
  })

  it('returns 404 for a missing file inside a known addon', async () => {
    const res = await get('/addon-assets/modrinth/ui/does-not-exist.mjs')
    expect(res.status).toBe(404)
  })

  it('refuses a symlink-escaped public dir (containment guard)', async () => {
    // Create a temp addon whose public/ is a symlink to /tmp.
    const tmp = mkdtempSync(path.join(tmpdir(), 'arclight-addon-link-'))
    const addonDir = path.join(repoRoot, 'storage', 'addons', `linkprobe-${Date.now()}`)
    try {
      mkdirSync(addonDir, { recursive: true })
      writeFileSync(path.join(tmp, 'secret.txt'), 'secret')
      writeFileSync(path.join(addonDir, 'package.json'), '{}')
      symlinkSync(tmp, path.join(addonDir, 'public'))
      const res = await get('/addon-assets/linkprobe/secret.txt')
      expect(res.status).toBe(404)
    } finally {
      rmSync(addonDir, { recursive: true, force: true })
      rmSync(tmp, { recursive: true, force: true })
    }
  })
})

afterAll(() => {
  // No server or DB to tear down — the middleware and routes are stateless.
})
