// @vitest-environment node
/**
 * Phase 5 addon-runtime tests.
 *
 * Express is deleted; the addon runtime lives in the Nitro process
 * (web/server/utils/addon-runtime.ts + middleware/03.addons.ts). These tests
 * boot the runtime against a committed fixture addon (an Express-router addon,
 * web/src/__tests__/fixtures/addon-express) and drive the real bridge through
 * an h3 app composed like Nitro (01.session → addon dispatch → routes).
 *
 * Pins the Express contract (D4): addon routers serve through the bridge with
 * `req.session` bridged, mutations are CSRF-gated (addon apiPaths are not
 * exempt), non-addon paths fall through untouched, the v3 UI manifest is
 * byte-identical, and the admin addons APIs enforce the admin guard.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createApp, defineEventHandler } from 'h3'
import { toNodeListener } from 'h3/node'
import type { AddressInfo } from 'node:net'

// Env must be in place before the runtime modules are imported (auth-session
// binds DATABASE_URL at module load).
process.env.NODE_ENV = 'test'
process.env.URL = 'http://localhost'
const tmpDbDir = mkdtempSync(path.join(tmpdir(), 'arclight-addons-test-'))
const dbPath = path.join(tmpDbDir, 'test.db')
process.env.DATABASE_URL = `file:${dbPath}`

// ── Test database (mirror the smoke schema + Addon tables) ─────────────────
const db = new Database(dbPath)
db.exec(`
  CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL,
    expires DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Session_session_id_key" ON "Session"("session_id");

  CREATE TABLE IF NOT EXISTS "settings" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'Arclight', description TEXT NOT NULL DEFAULT '',
    logo TEXT NOT NULL DEFAULT '', favicon TEXT NOT NULL DEFAULT '',
    theme TEXT NOT NULL DEFAULT 'default', lightTheme TEXT NOT NULL DEFAULT 'default',
    darkTheme TEXT NOT NULL DEFAULT 'default', language TEXT NOT NULL DEFAULT 'en',
    allowRegistration BOOLEAN NOT NULL DEFAULT false, uploadLimit INTEGER NOT NULL DEFAULT 100,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sftpPort INTEGER NOT NULL DEFAULT 3003, virusTotalApiKey TEXT,
    rateLimitEnabled BOOLEAN NOT NULL DEFAULT true, rateLimitRpm INTEGER NOT NULL DEFAULT 100,
    bannedIps TEXT NOT NULL DEFAULT '[]',
    allowUserCreateServer BOOLEAN NOT NULL DEFAULT false,
    allowUserDeleteServer BOOLEAN NOT NULL DEFAULT false,
    defaultServerLimit INTEGER NOT NULL DEFAULT 0, defaultMaxMemory INTEGER NOT NULL DEFAULT 512,
    defaultMaxCpu INTEGER NOT NULL DEFAULT 100, defaultMaxStorage INTEGER NOT NULL DEFAULT 5120,
    defaultMaxDatabases INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateMemory INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateDisk INTEGER NOT NULL DEFAULT 0,
    defaultOverallocateCpu INTEGER NOT NULL DEFAULT 0,
    loginWallpaper TEXT, registerWallpaper TEXT, panelWallpaper TEXT,
    loginMaxAttempts INTEGER NOT NULL DEFAULT 5, loginLockoutMinutes INTEGER NOT NULL DEFAULT 15,
    enforceDaemonHttps BOOLEAN NOT NULL DEFAULT false,
    require2faForAdmins BOOLEAN NOT NULL DEFAULT false,
    behindReverseProxy BOOLEAN NOT NULL DEFAULT false,
    hashApiKeys BOOLEAN NOT NULL DEFAULT false,
    arclightCloudApiKey TEXT, arclightCloudBackupEnabled BOOLEAN NOT NULL DEFAULT false,
    smtpHost TEXT, smtpPort INTEGER DEFAULT 587, smtpUser TEXT, smtpPassword TEXT,
    smtpFrom TEXT, smtpSecure BOOLEAN NOT NULL DEFAULT false,
    s3Enabled BOOLEAN NOT NULL DEFAULT false, s3Endpoint TEXT, s3Region TEXT, s3Bucket TEXT,
    s3AccessKey TEXT, s3SecretKey TEXT, s3PathStyle BOOLEAN NOT NULL DEFAULT false,
    allowPrivilegedServerLimit INTEGER NOT NULL DEFAULT 5,
    allowPrivilegedMaxMemory INTEGER NOT NULL DEFAULT 2048,
    allowPrivilegedMaxCpu INTEGER NOT NULL DEFAULT 200,
    allowPrivilegedMaxStorage INTEGER NOT NULL DEFAULT 61440,
    allowPrivilegedMaxDatabases INTEGER NOT NULL DEFAULT 10,
    allowUserCreateImages BOOLEAN NOT NULL DEFAULT false,
    onboardingEnabled BOOLEAN NOT NULL DEFAULT true,
    onboardingSteps TEXT NOT NULL DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS "Users" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL, username TEXT, password TEXT NOT NULL,
    isAdmin BOOLEAN NOT NULL DEFAULT false, description TEXT DEFAULT 'No About Me',
    avatar TEXT, permissions TEXT DEFAULT '[]',
    serverLimit INTEGER DEFAULT 0, maxMemory INTEGER DEFAULT 0, maxCpu INTEGER DEFAULT 0,
    maxStorage INTEGER DEFAULT 0, maxDatabases INTEGER DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user', onboardingCompleted BOOLEAN NOT NULL DEFAULT false,
    onboardingSkipped BOOLEAN NOT NULL DEFAULT false, preferredNodeId INTEGER,
    loginAttempts INTEGER NOT NULL DEFAULT 0, lockedUntil DATETIME,
    totpSecret TEXT, totpEnabled BOOLEAN NOT NULL DEFAULT false, totpRecoveryCodes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users"("email");
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_key" ON "Users"("username");

  CREATE TABLE IF NOT EXISTS "Addon" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT,
    version TEXT NOT NULL, author TEXT, enabled BOOLEAN NOT NULL DEFAULT true,
    mainFile TEXT NOT NULL DEFAULT 'index.ts',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "AddonSetting" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    addonSlug TEXT NOT NULL, "key" TEXT NOT NULL, value TEXT NOT NULL,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(addonSlug, "key")
  );

  CREATE TABLE IF NOT EXISTS "ActivityLog" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    actorId INTEGER, serverId TEXT, event TEXT NOT NULL, metadata TEXT,
    ip TEXT, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)
db.prepare(`INSERT OR IGNORE INTO "settings" (id) VALUES (1)`).run()
db.prepare(
  `INSERT OR IGNORE INTO "Users" (id, email, username, password, isAdmin, role, description) VALUES (1, 'admin@test.local', 'admin', 'x', 1, 'admin', '')`,
).run()

const ADMIN_ID = 1

// ── Modules (dynamic import AFTER env is set) ──────────────────────────────
const auth = await import('../../server/utils/auth-session')
const runtime = await import('../../server/utils/addon-runtime')
const sessionMiddleware = (await import('../../server/middleware/01.session')).default
const uiRoute = (await import('../../server/routes/api/addons/ui.get')).default
const listRoute = (await import('../../server/routes/admin/addons/list.get')).default
const storeInstallRoute = (await import('../../server/routes/admin/addons/store/install.post')).default
const toggleRoute = (await import('../../server/routes/admin/addons/toggle/[slug].post')).default

const fixtureParent = path.join(
  process.cwd(),
  'src',
  '__tests__',
  'fixtures',
)

// ── Composed app (01.session → addon dispatch → routes → SSR catch-all) ────
const app = createApp()
app.use(sessionMiddleware)
app.use(runtime.createAddonDispatchHandler())

// Test-only helper: mint an admin session + CSRF token (like GET /login does).
app.all('/__test-session', defineEventHandler(async (event) => {
  const session: auth.SessionPayload = {
    user: { id: ADMIN_ID, email: 'admin@test.local', isAdmin: true },
  }
  await auth.saveSession(event, session)
  await auth.generateCsrfToken(event, session)
  return { ok: true }
}))

app.all('/api/addons/ui', uiRoute)
app.all('/admin/addons/list', listRoute)
app.all('/admin/addons/store/install', storeInstallRoute)
app.all('/admin/addons/toggle/:slug', toggleRoute)
// Catch-all mirroring Nitro's SSR fallback (status 200 HTML shell).
app.all('/**', () => new Response('<html>tanstack-shell</html>', {
  headers: { 'content-type': 'text/html' },
}))

let server: ReturnType<typeof createServer>
let base = ''

beforeAll(async () => {
  await runtime.bootAddons({ addonsDir: fixtureParent })
  server = createServer(toNodeListener(app))
  await new Promise((resolve) => server.listen(0, resolve))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve))
  rmSync(tmpDbDir, { recursive: true, force: true })
})

// ── Helpers ────────────────────────────────────────────────────────────────

const CSRF_COOKIE = 'psifi.x-csrf-token'

function getCookieValue(setCookies: string[] | undefined, name: string): string | null {
  for (const entry of setCookies ?? []) {
    const [pair] = entry.split(';')
    const eq = pair?.indexOf('=')
    if (eq === undefined || eq === -1) continue
    const key = pair?.slice(0, eq).trim()
    if (key === name) return pair?.slice(eq + 1) ?? null
  }
  return null
}

interface SessionBundle {
  cookieHeader: string
  token: string
}

/** Mint an admin session + CSRF token via the __test-session route. */
async function acquireAdminSession(): Promise<SessionBundle> {
  const res = await fetch(`${base}/__test-session`)
  const cookies = res.headers.getSetCookie()
  const sessionCookie = getCookieValue(cookies, 'connect.sid')!
  const csrfCookie = getCookieValue(cookies, CSRF_COOKIE)!
  return {
    cookieHeader: `connect.sid=${sessionCookie}; ${CSRF_COOKIE}=${csrfCookie}`,
    token: csrfCookie,
  }
}

function csrfHeaders(token: string): Record<string, string> {
  return { 'content-type': 'application/json', 'x-csrf-token': token }
}

async function get(pathname: string, cookieHeader?: string): Promise<Response> {
  return fetch(`${base}${pathname}`, {
    // Don't follow the guard's 302 → /login (we assert on the redirect).
    redirect: 'manual',
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  })
}

async function post(
  pathname: string,
  body: unknown,
  cookieHeader?: string,
  token?: string,
): Promise<Response> {
  return fetch(`${base}${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(token ? csrfHeaders(token) : {}),
    },
    body: JSON.stringify(body),
  })
}

// ── Bridge: addon routers serve through the Express bridge ────────────────

describe('addon bridge', () => {
  it('serves addon api routes through the bridge', async () => {
    const res = await get('/test-express/api/health')
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ status: 'ok' })
  })

  it('bridges req.session into addon routers (anonymous → null user)', async () => {
    const res = await get('/test-express/hello')
    const body = (await res.json()) as { ok: boolean; user: number | null; path: string }
    expect(body.ok).toBe(true)
    expect(body.user).toBeNull()
    // req.path is relative to the mount — Express behavior preserved.
    expect(body.path).toBe('/hello')
  })

  it('bridges the logged-in session into addon routers', async () => {
    const c = await acquireAdminSession()
    const res = await get('/test-express/hello', c.cookieHeader)
    const body = (await res.json()) as { user: number | null }
    expect(body.user).toBe(ADMIN_ID)
  })

  it('enforces CSRF on addon mutations (403 without a token)', async () => {
    const c = await acquireAdminSession()
    const noToken = await post('/test-express/echo', { hello: 'world' }, c.cookieHeader)
    expect(noToken.status).toBe(403)
    expect(await noToken.json()).toEqual({ error: 'CSRF token validation failed' })

    const withToken = await post('/test-express/echo', { hello: 'world' }, c.cookieHeader, c.token)
    expect(withToken.status).toBe(200)
    expect(await withToken.json()).toEqual({ body: { hello: 'world' } })
  })

  it('falls through untouched for non-addon paths (no CSRF gate, SSR shell)', async () => {
    const res = await post('/api/not-an-addon-path', { x: 1 })
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('tanstack-shell')
  })

  it('falls through to the TanStack shell when the addon router has no match', async () => {
    // GET /test-express is a v3 PAGE (TanStack), not an addon router route.
    const res = await get('/test-express')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('tanstack-shell')
  })
})

// ── GET /api/addons/ui (v3 manifest, byte-identical) ───────────────────────

describe('GET /api/addons/ui', () => {
  it('returns the enabled addon ui manifest (byte-identical shape)', async () => {
    const res = await get('/api/addons/ui')
    expect(res.status).toBe(200)
    const { addons } = (await res.json()) as { addons: Record<string, unknown>[] }
    expect(addons.length).toBe(1)
    expect(addons[0]).toMatchObject({
      slug: 'addon-express',
      name: 'Test Express Addon',
      version: '1.0.0',
      bundles: ['/addon-assets/test-express/ui/bundle.mjs'],
      css: ['/addon-assets/test-express/ui/styles.css'],
      routes: [{ path: '/test-express/page', component: 'Page' }],
      apiPaths: ['/test-express/api/'],
    })
  })
})

// ── Admin addons APIs ──────────────────────────────────────────────────────

describe('admin addons API', () => {
  it('GET /admin/addons/list requires admin (302 without a session)', async () => {
    const res = await get('/admin/addons/list')
    expect(res.status).toBe(302)
  })

  it('GET /admin/addons/list returns the addon rows for an admin', async () => {
    const c = await acquireAdminSession()
    const res = await get('/admin/addons/list', c.cookieHeader)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      success: boolean
      addons: { slug: string }[]
    }
    expect(data.success).toBe(true)
    expect(data.addons.some((a) => a.slug === 'addon-express')).toBe(true)
  })

  it('POST /admin/addons/store/install is a 410 stub', async () => {
    const c = await acquireAdminSession()
    const res = await post('/admin/addons/store/install', {}, c.cookieHeader, c.token)
    expect(res.status).toBe(410)
  })

  it('POST /admin/addons/toggle/:slug disables + reloads (unmount), then re-enables', async () => {
    const c = await acquireAdminSession()

    // api.registerRoute mounts serve while the addon is enabled.
    const extraBefore = await get('/test-express-extra/ping', c.cookieHeader)
    expect((await extraBefore.json()) as { pong: boolean }).toEqual({ pong: true })

    const off = await post(
      '/admin/addons/toggle/addon-express',
      { enabled: false },
      c.cookieHeader,
      c.token,
    )
    expect(off.status).toBe(200)
    expect(((await off.json()) as { success: boolean }).success).toBe(true)

    // Disabled + reloaded → the manifest router AND the registerRoute mounts
    // are unmounted together → both fall through to the shell.
    const unmounted = await get('/test-express/api/health', c.cookieHeader)
    expect(await unmounted.text()).toContain('tanstack-shell')
    const extraAfter = await get('/test-express-extra/ping', c.cookieHeader)
    expect(await extraAfter.text()).toContain('tanstack-shell')

    const on = await post(
      '/admin/addons/toggle/addon-express',
      { enabled: true },
      c.cookieHeader,
      c.token,
    )
    expect(((await on.json()) as { success: boolean }).success).toBe(true)

    const health = await get('/test-express/api/health', c.cookieHeader)
    expect((await health.json()) as { status: string }).toEqual({ status: 'ok' })
    const extraOn = await get('/test-express-extra/ping', c.cookieHeader)
    expect((await extraOn.json()) as { pong: boolean }).toEqual({ pong: true })
  })
})
