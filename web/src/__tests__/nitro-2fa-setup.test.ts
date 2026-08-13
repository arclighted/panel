// @vitest-environment node
/**
 * Integration tests for the Phase 6.5-ported 2FA management routes:
 * GET /api/account/2fa/setup, POST /account/2fa/enable, POST /account/2fa/disable.
 *
 * These were the last user-facing Express routes deleted (Phase 2) without a
 * Nitro twin — the React account page fetched a QR that 404'd. The port
 * mirrors src/modules/user/twoFactor.ts exactly (D3): a fresh TOTP secret is
 * stashed in the session (`pendingTotpSecret`), the setup GET renders the QR
 * data URL, enable validates the code and persists sha256-hashed recovery
 * codes, disable requires the current password.
 *
 * Runs the real handlers against a real temporary SQLite database through an
 * h3 app with the 01.session middleware mounted, exactly like
 * nitro-auth-routes.test.ts.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import * as OTPAuth from 'otpauth'
import { createApp, defineEventHandler } from 'h3'
import { toNodeListener } from 'h3/node'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-2fa-'))
const dbPath = path.join(tmpDir, 'test.db')

// Env must be in place before the route modules are imported (the Prisma
// client + SQLite file are constructed at module load).
process.env.DATABASE_URL = `file:${dbPath}`
process.env.SESSION_SECRET = 'a'.repeat(64)
process.env.NODE_ENV = 'test'
process.env.URL = 'http://localhost'

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

  CREATE TABLE IF NOT EXISTS "Users" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    username TEXT,
    password TEXT NOT NULL,
    isAdmin BOOLEAN NOT NULL DEFAULT false,
    description TEXT DEFAULT 'No About Me',
    avatar TEXT,
    permissions TEXT DEFAULT '[]',
    serverLimit INTEGER DEFAULT 0,
    maxMemory INTEGER DEFAULT 0,
    maxCpu INTEGER DEFAULT 0,
    maxStorage INTEGER DEFAULT 0,
    maxDatabases INTEGER DEFAULT 0,
    role TEXT NOT NULL DEFAULT 'user',
    onboardingCompleted BOOLEAN NOT NULL DEFAULT false,
    onboardingSkipped BOOLEAN NOT NULL DEFAULT false,
    preferredNodeId INTEGER,
    loginAttempts INTEGER NOT NULL DEFAULT 0,
    lockedUntil DATETIME,
    totpSecret TEXT,
    totpEnabled BOOLEAN NOT NULL DEFAULT false,
    totpRecoveryCodes TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_email_key" ON "Users"("email");
  CREATE UNIQUE INDEX IF NOT EXISTS "Users_username_key" ON "Users"("username");

  CREATE TABLE IF NOT EXISTS "settings" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    allowRegistration BOOLEAN NOT NULL DEFAULT false,
    loginMaxAttempts INTEGER NOT NULL DEFAULT 5,
    loginLockoutMinutes INTEGER NOT NULL DEFAULT 15
  );

  CREATE TABLE IF NOT EXISTS "LoginHistory" (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    userId INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  INSERT OR IGNORE INTO "settings" (id, allowRegistration, loginMaxAttempts, loginLockoutMinutes)
  VALUES (1, 0, 5, 15);
`)

const { default: sessionMiddleware } = await import('../../server/middleware/01.session')
const setupHandler = (await import('../../server/routes/api/account/2fa/setup.get')).default
const enableHandler = (await import('../../server/routes/account/2fa/enable.post')).default
const disableHandler = (await import('../../server/routes/account/2fa/disable.post')).default
const loginHandler = (await import('../../server/routes/login.post')).default
const twoFaHandler = (await import('../../server/routes/2fa.post')).default
const auth = await import('../../server/utils/auth-session')

const PASSWORD = 'correct-password'
let passwordHash = ''

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 12)
})

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function insertUser(overrides: Record<string, unknown> = {}): number {
  const row = {
    email: 'default@x.io',
    username: 'defaultuser',
    password: passwordHash,
    isAdmin: 0,
    description: 'No About Me',
    role: 'user',
    onboardingCompleted: 0,
    onboardingSkipped: 0,
    loginAttempts: 0,
    lockedUntil: null,
    totpSecret: null,
    totpEnabled: 0,
    totpRecoveryCodes: null,
    ...overrides,
  }
  const info = db
    .prepare(
      `INSERT INTO "Users" (email, username, password, isAdmin, description, role,
        onboardingCompleted, onboardingSkipped, loginAttempts, lockedUntil,
        totpSecret, totpEnabled, totpRecoveryCodes)
       VALUES (@email, @username, @password, @isAdmin, @description, @role,
        @onboardingCompleted, @onboardingSkipped, @loginAttempts, @lockedUntil,
        @totpSecret, @totpEnabled, @totpRecoveryCodes)`,
    )
    .run(row)
  return Number(info.lastInsertRowid)
}

function getUserRow(userId: number) {
  return db
    .prepare('SELECT * FROM "Users" WHERE id = ?')
    .get(userId) as Record<string, unknown>
}

function makeApp(): (req: unknown, res: unknown) => void {
  const app = createApp()
  app.use(sessionMiddleware)
  app.all('/api/account/2fa/setup', setupHandler)
  app.all('/account/2fa/enable', enableHandler)
  app.all('/account/2fa/disable', disableHandler)
  app.all('/login', loginHandler)
  app.all('/2fa', twoFaHandler)
  // Mirrors GET /api/auth-config (mint/reuse the CSRF token for the current
  // session) so tests can simulate the browser's token refresh.
  app.all('/__refresh-csrf', defineEventHandler(async (event) => {
    const session = (event.context.session as never) ?? (await auth.loadSession(event))
    return { token: await auth.generateCsrfToken(event, session) }
  }))
  app.all('/__session', defineEventHandler(async (event) => {
    const session = (event.context.session ?? {}) as {
      user?: unknown
      pendingTotpSecret?: unknown
    }
    return {
      user: session.user ?? null,
      pendingTotpSecret: session.pendingTotpSecret ?? null,
    }
  }))
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

function getCookieValue(setCookies: string[] | undefined, name: string): string | null {
  for (const entry of setCookies ?? []) {
    const [pair] = entry.split(';')
    const eq = pair?.indexOf('=')
    if (eq === undefined || eq === -1) continue
    const key = pair!.slice(0, eq).trim()
    if (key === name) {
      try {
        return decodeURIComponent(pair!.slice(eq + 1).trim())
      } catch {
        return pair!.slice(eq + 1).trim()
      }
    }
  }
  return null
}

const CSRF_COOKIE = 'psifi.x-csrf-token'

async function acquireCsrf(
  base: string,
  ip: string,
): Promise<{ sessionCookie: string; csrfCookie: string; token: string }> {
  const res = await fetch(`${base}/__refresh-csrf`, {
    headers: { 'x-forwarded-for': ip },
  })
  const { token } = (await res.json()) as { token: string }
  const cookies = res.headers.getSetCookie()
  return {
    sessionCookie: getCookieValue(cookies, 'connect.sid')!,
    csrfCookie: getCookieValue(cookies, CSRF_COOKIE)!,
    token,
  }
}

function cookieHeader(session: string, csrf: string): string {
  return `connect.sid=${session}; ${CSRF_COOKIE}=${csrf}`
}

async function postJson(
  base: string,
  ip: string,
  path: string,
  body: Record<string, unknown>,
  csrf: { sessionCookie: string; csrfCookie: string; token: string },
): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      cookie: cookieHeader(csrf.sessionCookie, csrf.csrfCookie),
      'csrf-token': csrf.token,
    },
    body: JSON.stringify(body),
  })
}

/**
 * Logs a real user in through POST /login (no 2FA yet) and returns a CSRF
 * token bound to the *regenerated* session the login created — the same
 * refresh the browser does after a 302.
 */
async function loginAs(
  base: string,
  ip: string,
  email: string,
): Promise<{ sessionCookie: string; csrfCookie: string; token: string }> {
  const anon = await acquireCsrf(base, ip)
  const login = await postJson(base, ip, '/login', { identifier: email, password: PASSWORD }, anon)
  expect(login.status).toBe(302)
  const sessionCookie = getCookieValue(login.headers.getSetCookie(), 'connect.sid')!
  expect(sessionCookie).toBeTruthy()
  const refresh = await fetch(`${base}/__refresh-csrf`, {
    headers: { cookie: `connect.sid=${sessionCookie}`, 'x-forwarded-for': ip },
  })
  const { token } = (await refresh.json()) as { token: string }
  const csrfCookie = getCookieValue(refresh.headers.getSetCookie(), CSRF_COOKIE)!
  return { sessionCookie, csrfCookie, token }
}

/**
 * Logs in a user whose 2FA is ALREADY enabled: POST /login 302s to /2fa
 * (pending flow — no session.user yet), then POST /2fa with the TOTP code
 * completes the login and returns a session carrying the authenticated user.
 * Mirrors startPendingLogin + postTwoFa in nitro-auth-routes.test.ts.
 */
async function loginAs2fa(
  base: string,
  ip: string,
  email: string,
  totpSecret: string,
): Promise<{ sessionCookie: string; csrfCookie: string; token: string }> {
  const anon = await acquireCsrf(base, ip)
  const login = await postJson(base, ip, '/login', { identifier: email, password: PASSWORD }, anon)
  expect(login.status).toBe(302)
  expect(login.headers.get('location')).toBe('/2fa')
  const pendingCookie = getCookieValue(login.headers.getSetCookie(), 'connect.sid')!

  const refresh = await fetch(`${base}/__refresh-csrf`, {
    headers: { cookie: `connect.sid=${pendingCookie}`, 'x-forwarded-for': ip },
  })
  const { token: pendingToken } = (await refresh.json()) as { token: string }
  const pendingCsrf = getCookieValue(refresh.headers.getSetCookie(), CSRF_COOKIE)!

  const code = totpFor(totpSecret, email)
  const twoFa = await fetch(`${base}/2fa`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      cookie: cookieHeader(pendingCookie, pendingCsrf),
      'csrf-token': pendingToken,
    },
    body: JSON.stringify({ token: code }),
  })
  expect(twoFa.status).toBe(200)
  expect(await twoFa.json()).toEqual({ success: true, redirect: '/' })
  const sessionCookie = getCookieValue(twoFa.headers.getSetCookie(), 'connect.sid')!
  expect(sessionCookie).toBeTruthy()

  // The completed login regenerated the session again — refresh CSRF for it.
  const final = await fetch(`${base}/__refresh-csrf`, {
    headers: { cookie: `connect.sid=${sessionCookie}`, 'x-forwarded-for': ip },
  })
  const { token } = (await final.json()) as { token: string }
  const csrfCookie = getCookieValue(final.headers.getSetCookie(), CSRF_COOKIE)!
  return { sessionCookie, csrfCookie, token }
}

async function sessionState(base: string, sessionCookie: string) {
  const res = await fetch(`${base}/__session`, {
    headers: { cookie: `connect.sid=${sessionCookie}` },
  })
  return (await res.json()) as { user?: { id?: number }; pendingTotpSecret?: string | null }
}

/** 6-digit TOTP for the pending secret, same algorithm as two-factor.ts. */
function totpFor(secretBase32: string, email: string): string {
  const totp = new OTPAuth.TOTP({
    issuer: 'Arclight',
    label: email,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  })
  return totp.generate()
}

describe('GET /api/account/2fa/setup (Nitro)', () => {
  it('returns a QR data URL + formatted secret and stashes pendingTotpSecret', async () => {
    const userId = insertUser({ email: 'alice@x.io', username: 'alice' })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.1'
      const authed = await loginAs(base, ip, 'alice@x.io')

      const res = await fetch(`${base}/api/account/2fa/setup`, {
        headers: {
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
      })
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        success: boolean
        qrDataUrl: string
        secretBase32: string
        required: boolean
      }
      expect(body.success).toBe(true)
      expect(body.qrDataUrl).toMatch(/^data:image\/png;base64,/)
      expect(body.secretBase32).toMatch(/^[A-Z2-7]+( [A-Z2-7]+)*$/)
      expect(body.required).toBe(false)

      // The secret is persisted in the session for the enable step.
      const state = await sessionState(base, authed.sessionCookie)
      expect(state.pendingTotpSecret).toBeTruthy()
      expect(state.pendingTotpSecret!.replace(/ /g, '')).toBe(
        body.secretBase32.replace(/ /g, ''),
      )
    })
    const row = getUserRow(userId)
    expect(row.totpEnabled).toBe(0)
    expect(row.totpSecret).toBeNull()
  })

  it('honours the required=1 flag (admin 2FA mandate)', async () => {
    insertUser({ email: 'boss@x.io', username: 'boss' })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.2'
      const authed = await loginAs(base, ip, 'boss@x.io')
      const res = await fetch(`${base}/api/account/2fa/setup?required=1`, {
        headers: {
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
      })
      const body = (await res.json()) as { required: boolean }
      expect(body.required).toBe(true)
    })
  })

  it('refuses with alreadyEnabled when the user has 2FA on', async () => {
    insertUser({
      email: 'sec@x.io',
      username: 'sec',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpEnabled: 1,
      totpRecoveryCodes: '[]',
    })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.3'
      const authed = await loginAs2fa(base, ip, 'sec@x.io', 'JBSWY3DPEHPK3PXP')
      const res = await fetch(`${base}/api/account/2fa/setup`, {
        headers: {
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
      })
      const body = (await res.json()) as { success: boolean; alreadyEnabled: boolean }
      expect(body.success).toBe(false)
      expect(body.alreadyEnabled).toBe(true)
    })
  })

  it('redirects anonymous visitors to /login', async () => {
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/api/account/2fa/setup`, {
        headers: { 'x-forwarded-for': '10.0.0.4' },
        redirect: 'manual',
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')
    })
  })
})

describe('POST /account/2fa/enable (Nitro)', () => {
  it('enables 2FA with a valid code and returns 10 recovery codes', async () => {
    const userId = insertUser({ email: 'carol@x.io', username: 'carol' })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.5'
      const authed = await loginAs(base, ip, 'carol@x.io')

      // Start setup to populate pendingTotpSecret.
      await fetch(`${base}/api/account/2fa/setup`, {
        headers: {
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
      })
      const state = await sessionState(base, authed.sessionCookie)
      const pending = state.pendingTotpSecret!
      expect(pending).toBeTruthy()

      const code = totpFor(pending.replace(/ /g, ''), 'carol@x.io')
      const res = await postJson(
        base,
        ip,
        '/account/2fa/enable',
        { token: code },
        authed,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        success: boolean
        message: string
        recoveryCodes: string[]
      }
      expect(body.success).toBe(true)
      expect(body.recoveryCodes).toHaveLength(10)
      for (const c of body.recoveryCodes) {
        expect(c).toMatch(/^[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}$/)
      }

      const row = getUserRow(userId)
      expect(row.totpEnabled).toBe(1)
      expect(row.totpSecret).toBe(pending.replace(/ /g, ''))
      const stored = JSON.parse(row.totpRecoveryCodes as string) as string[]
      expect(stored).toHaveLength(10)
      // Codes are stored sha256-hashed, never plaintext.
      for (const c of body.recoveryCodes) {
        expect(stored).not.toContain(c.replace(/-/g, ''))
      }

      // The pending secret is cleared from the session.
      const after = await sessionState(base, authed.sessionCookie)
      expect(after.pendingTotpSecret).toBeNull()
    })
  })

  it('rejects an invalid code', async () => {
    insertUser({ email: 'dave@x.io', username: 'dave' })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.6'
      const authed = await loginAs(base, ip, 'dave@x.io')
      await fetch(`${base}/api/account/2fa/setup`, {
        headers: {
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
      })
      const res = await postJson(
        base,
        ip,
        '/account/2fa/enable',
        { token: '000000' },
        authed,
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toBe('Invalid code. Try again.')
    })
  })

  it('rejects when no setup is pending', async () => {
    insertUser({ email: 'erin@x.io', username: 'erin' })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.7'
      const authed = await loginAs(base, ip, 'erin@x.io')
      const res = await postJson(
        base,
        ip,
        '/account/2fa/enable',
        { token: '123456' },
        authed,
      )
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error: string }
      expect(body.error).toMatch(/No pending 2FA secret/)
    })
  })

  it('rejects when 2FA is already enabled', async () => {
    insertUser({
      email: 'frank@x.io',
      username: 'frank',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpEnabled: 1,
      totpRecoveryCodes: '[]',
    })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.8'
      const authed = await loginAs2fa(base, ip, 'frank@x.io', 'JBSWY3DPEHPK3PXP')
      const res = await postJson(
        base,
        ip,
        '/account/2fa/enable',
        { token: '123456' },
        authed,
      )
      expect(res.status).toBe(400)
    })
  })

  it('blocks the mutation without a CSRF token', async () => {
    insertUser({ email: 'grace@x.io', username: 'grace' })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.9'
      const authed = await loginAs(base, ip, 'grace@x.io')
      await fetch(`${base}/api/account/2fa/setup`, {
        headers: {
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
      })
      const res = await fetch(`${base}/account/2fa/enable`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': ip,
          cookie: cookieHeader(authed.sessionCookie, authed.csrfCookie),
        },
        body: JSON.stringify({ token: '123456' }),
      })
      expect(res.status).toBe(403)
    })
  })
})

describe('POST /account/2fa/disable (Nitro)', () => {
  // The route only needs an authenticated session for an already-enabled
  // user, so the 2FA state is seeded via insertUser overrides (setup+enable
  // itself is exercised in the enable describe above).
  async function seedEnabled(base: string, ip: string, email: string) {
    return loginAs2fa(base, ip, email, 'JBSWY3DPEHPK3PXP')
  }

  it('disables 2FA with the correct password', async () => {
    const userId = insertUser({
      email: 'heidi@x.io',
      username: 'heidi',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpEnabled: 1,
      totpRecoveryCodes: JSON.stringify([Buffer.from('x').toString('hex').repeat(64)]),
    })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.10'
      const authed = await seedEnabled(base, ip, 'heidi@x.io')

      const res = await postJson(
        base,
        ip,
        '/account/2fa/disable',
        { password: PASSWORD },
        authed,
      )
      expect(res.status).toBe(200)
      const body = (await res.json()) as { success: boolean; message: string }
      expect(body.success).toBe(true)

      const row = getUserRow(userId)
      expect(row.totpEnabled).toBe(0)
      expect(row.totpSecret).toBeNull()
      expect(row.totpRecoveryCodes).toBeNull()
    })
  })

  it('rejects a wrong password with 401', async () => {
    insertUser({
      email: 'ivan@x.io',
      username: 'ivan',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpEnabled: 1,
      totpRecoveryCodes: '[]',
    })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.11'
      const authed = await seedEnabled(base, ip, 'ivan@x.io')
      const res = await postJson(
        base,
        ip,
        '/account/2fa/disable',
        { password: 'wrong-password' },
        authed,
      )
      expect(res.status).toBe(401)
      const body = (await res.json()) as { error: string }
      expect(body.error).toMatch(/incorrect/i)
    })
  })

  it('requires the password field', async () => {
    insertUser({
      email: 'judy@x.io',
      username: 'judy',
      totpSecret: 'JBSWY3DPEHPK3PXP',
      totpEnabled: 1,
      totpRecoveryCodes: '[]',
    })
    await withServer(makeApp(), async (base) => {
      const ip = '10.0.0.12'
      const authed = await seedEnabled(base, ip, 'judy@x.io')
      const res = await postJson(base, ip, '/account/2fa/disable', {}, authed)
      expect(res.status).toBe(400)
    })
  })
})
