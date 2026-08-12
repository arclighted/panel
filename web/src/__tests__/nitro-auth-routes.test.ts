// @vitest-environment node
/**
 * Integration tests for the Phase 2 Nitro-owned auth routes:
 * POST /login, POST /register, GET /logout, POST /2fa.
 *
 * Runs the real handlers against a real temporary SQLite database (Users,
 * settings, LoginHistory, Session tables) through an h3 app with the 01.session
 * middleware mounted — the same composition Nitro builds. Pins the Express
 * contract (D3): redirect locations, status codes, error JSON shapes, session
 * regeneration, lockout counters, 2FA pending flow and login history rows.
 */
import { describe, expect, it, beforeAll, afterAll, afterEach } from 'vitest'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import bcrypt from 'bcryptjs'
import * as OTPAuth from 'otpauth'
import { createApp, defineEventHandler } from 'h3'
import { toNodeListener } from 'h3/node'
import { unsign } from 'cookie-signature'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-auth-'))
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
const loginHandler = (await import('../../server/routes/login.post')).default
const registerHandler = (await import('../../server/routes/register.post')).default
const logoutHandler = (await import('../../server/routes/logout.get')).default
const twoFaHandler = (await import('../../server/routes/2fa.post')).default
const auth = await import('../../server/utils/auth-session')

const PASSWORD = 'correct-password'
let passwordHash = ''

beforeAll(async () => {
  passwordHash = await bcrypt.hash(PASSWORD, 12)
})

// Tests mutate the shared settings row (lockout threshold, registration flag)
// to exercise specific branches. Reset it after each so tests stay
// order-independent regardless of which ran first.
afterEach(() => {
  db.prepare(
    'UPDATE "settings" SET allowRegistration = 0, loginMaxAttempts = 5, loginLockoutMinutes = 15 WHERE id = 1',
  ).run()
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

function loginHistoryCount(userId: number): number {
  const row = db
    .prepare('SELECT COUNT(*) AS c FROM "LoginHistory" WHERE userId = ?')
    .get(userId) as { c: number }
  return row.c
}

function makeApp(): (req: unknown, res: unknown) => void {
  const app = createApp()
  app.use(sessionMiddleware)
  app.all('/login', loginHandler)
  app.all('/register', registerHandler)
  app.all('/logout', logoutHandler)
  app.all('/2fa', twoFaHandler)
  // Mirrors what GET /api/auth-config does (mint/reuse the CSRF token for the
  // current session) so tests can simulate the browser's token refresh after
  // a session regeneration.
  app.all('/__refresh-csrf', defineEventHandler(async (event) => {
    const session = (event.context.session as never) ?? (await auth.loadSession(event))
    return { token: await auth.generateCsrfToken(event, session) }
  }))
  app.all('/__session', defineEventHandler(async (event) => {
    const session = (event.context.session ?? {}) as { user?: unknown; pendingUserId?: unknown }
    return { user: session.user ?? null, pendingUserId: session.pendingUserId ?? null }
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
      // h3 URL-encodes cookie values (s:<sid>.<sig> → s%3A…); browsers decode
      // automatically, so mirror that here.
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

/** Acquire a CSRF token + cookies for a fresh visitor (like loading /login). */
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

async function postAuth(
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

describe('POST /login (Nitro)', () => {
  it('redirects to / on success and writes the session user + login history', async () => {
    const userId = insertUser({ email: 'alice@x.io', username: 'alice' })
    const ip = '10.0.0.1'

    await withServer(makeApp(), async (base) => {
      const before = await acquireCsrf(base, ip)
      const res = await postAuth(base, ip, '/login', {
        identifier: 'alice@x.io',
        password: PASSWORD,
      }, before)

      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/')

      // Session regenerated: new connect.sid differs from the pre-login one
      // and the old session row is gone (regression guard for the h3
      // getCookie-after-setCookie trap).
      const newSessionCookie = getCookieValue(res.headers.getSetCookie(), 'connect.sid')
      expect(newSessionCookie).toBeTruthy()
      expect(newSessionCookie).not.toBe(before.sessionCookie)
      const oldSid = unsign(before.sessionCookie.replace(/^s:/, ''), 'a'.repeat(64))
      const oldRow = db
        .prepare('SELECT session_id FROM "Session" WHERE session_id = ?')
        .get(oldSid)
      expect(oldRow).toBeUndefined()

      const sessionRes = await fetch(`${base}/__session`, {
        headers: { cookie: `connect.sid=${newSessionCookie}`, 'x-forwarded-for': ip },
      })
      const session = (await sessionRes.json()) as { user: Record<string, unknown> }
      expect(session.user).toEqual({
        id: userId,
        email: 'alice@x.io',
        isAdmin: false,
        description: 'No About Me',
        username: 'alice',
        role: 'user',
        onboardingCompleted: false,
        onboardingSkipped: false,
      })
      expect(loginHistoryCount(userId)).toBe(1)
      const hist = db
        .prepare('SELECT ipAddress FROM "LoginHistory" WHERE userId = ?')
        .get(userId) as { ipAddress: string }
      expect(hist.ipAddress).toBe(ip)
    })
  })

  it('returns a generic redirect and increments the attempt counter on a wrong password', async () => {
    const userId = insertUser({ email: 'bob@x.io', username: 'bob' })
    const ip = '10.0.0.2'

    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const res = await postAuth(base, ip, '/login', {
        identifier: 'bob@x.io',
        password: 'wrong-password',
      }, csrf)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login?err=invalid_credentials')
      expect(getUserRow(userId).loginAttempts).toBe(1)
      expect(loginHistoryCount(userId)).toBe(0)
    })
  })

  it('locks the account after max attempts and reports the wait', async () => {
    const userId = insertUser({ email: 'carol@x.io', username: 'carol' })
    db.prepare(
      'UPDATE "settings" SET loginMaxAttempts = 2, loginLockoutMinutes = 15 WHERE id = 1',
    ).run()
    const ip = '10.0.0.3'

    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      await postAuth(base, ip, '/login', { identifier: 'carol@x.io', password: 'nope-1' }, csrf)
      await postAuth(base, ip, '/login', { identifier: 'carol@x.io', password: 'nope-2' }, csrf)
      expect(getUserRow(userId).lockedUntil).toBeTruthy()

      const res = await postAuth(base, ip, '/login', { identifier: 'carol@x.io', password: 'nope-3' }, csrf)
      expect(res.status).toBe(302)
      const location = res.headers.get('location')!
      expect(location.startsWith('/login?err=account_locked&wait=')).toBe(true)
      const wait = Number(location.split('wait=')[1])
      expect(wait).toBeGreaterThan(0)
      expect(wait).toBeLessThanOrEqual(15)
    })
  })

  it('returns 403 without a CSRF token', async () => {
    const ip = '10.0.0.4'
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/login`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ identifier: 'x@y.z', password: 'whatever' }),
      })
      expect(res.status).toBe(403)
    })
  })

  it('returns 429 with the Express error shape once the rate limit is exhausted', async () => {
    const ip = '9.9.9.9'
    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      for (let i = 0; i < 10; i++) {
        const res = await postAuth(base, ip, '/login', {
          identifier: 'ghost@x.io',
          password: 'wrong-password',
        }, csrf)
        expect(res.status).toBe(302)
      }
      const res = await postAuth(base, ip, '/login', {
        identifier: 'ghost@x.io',
        password: 'wrong-password',
      }, csrf)
      expect(res.status).toBe(429)
      expect(await res.json()).toEqual({
        error: 'Too many attempts. Try again in a minute.',
      })
    })
  })
})

describe('POST /register (Nitro)', () => {
  it('creates the first user as owner/admin and redirects to /login', async () => {
    db.exec('DELETE FROM "Users"; DELETE FROM "LoginHistory";')
    const ip = '10.0.1.1'

    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const res = await postAuth(base, ip, '/register', {
        email: 'owner@arclight.dev',
        username: 'owner',
        password: 'str0ngPass',
      }, csrf)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')

      const row = db
        .prepare('SELECT role, isAdmin FROM "Users" WHERE email = ?')
        .get('owner@arclight.dev') as { role: string; isAdmin: number }
      expect(row.role).toBe('owner')
      expect(row.isAdmin).toBe(1)
    })
  })

  it('rejects a duplicate account', async () => {
    insertUser({ email: 'dupe@x.io', username: 'dupe' })
    db.prepare('UPDATE "settings" SET allowRegistration = 1 WHERE id = 1').run()
    const ip = '10.0.1.2'

    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const res = await postAuth(base, ip, '/register', {
        email: 'dupe@x.io',
        username: 'dupe',
        password: 'str0ngPass',
      }, csrf)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/register?err=user_already_exists')
    })
  })

  it('bounces registration when disabled and a user already exists', async () => {
    insertUser({ email: 'existing@x.io', username: 'existing' })
    db.prepare('UPDATE "settings" SET allowRegistration = 0 WHERE id = 1').run()
    const ip = '10.0.1.3'

    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const res = await postAuth(base, ip, '/register', {
        email: 'newuser@x.io',
        username: 'newuser',
        password: 'str0ngPass',
      }, csrf)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login?err=registration_disabled')
    })
  })

  it('maps validation failures to the Express error codes', async () => {
    db.prepare('UPDATE "settings" SET allowRegistration = 1 WHERE id = 1').run()
    const ip = '10.0.1.4'

    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const missing = await postAuth(base, ip, '/register', {
        email: '',
        username: 'someone',
        password: 'str0ngPass',
      }, csrf)
      expect(missing.headers.get('location')).toBe('/register?err=missing_credentials')

      const badUsername = await postAuth(base, ip, '/register', {
        email: 'ok@x.io',
        username: 'x',
        password: 'str0ngPass',
      }, csrf)
      expect(badUsername.headers.get('location')).toBe('/register?err=invalid_username')

      const badPassword = await postAuth(base, ip, '/register', {
        email: 'ok2@x.io',
        username: 'fine',
        password: 'weak',
      }, csrf)
      expect(badPassword.headers.get('location')).toBe('/register?err=invalid_input')
    })
  })

  it('returns 403 without a CSRF token', async () => {
    const ip = '10.0.1.5'
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/register`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ email: 'a@b.c', username: 'abc', password: 'str0ngPass' }),
      })
      expect(res.status).toBe(403)
    })
  })
})

describe('GET /logout (Nitro)', () => {
  it('destroys the session row, clears the cookie and redirects to /login', async () => {
    const ip = '10.0.2.1'
    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const rowBefore = db
        .prepare('SELECT COUNT(*) AS c FROM "Session" WHERE session_id = ?')
        .get(unsign(csrf.sessionCookie.replace(/^s:/, ''), 'a'.repeat(64))) as { c: number }
      expect(rowBefore.c).toBe(1)

      const res = await fetch(`${base}/logout`, {
        redirect: 'manual',
        headers: { cookie: `connect.sid=${csrf.sessionCookie}`, 'x-forwarded-for': ip },
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toBe('/login')

      const rowAfter = db
        .prepare('SELECT COUNT(*) AS c FROM "Session" WHERE session_id = ?')
        .get(unsign(csrf.sessionCookie.replace(/^s:/, ''), 'a'.repeat(64))) as { c: number }
      expect(rowAfter.c).toBe(0)
    })
  })
})

describe('POST /2fa (Nitro)', () => {
  const TOTP_SECRET = 'JBSWY3DPEHPK3PXP'
  const RECOVERY = 'A1B2C3D4E5F6'

  function insertTotpUser(email: string, withRecovery: boolean): number {
    return insertUser({
      email,
      username: email.split('@')[0],
      totpSecret: TOTP_SECRET,
      totpEnabled: 1,
      totpRecoveryCodes: withRecovery
        ? JSON.stringify([createHash('sha256').update(RECOVERY).digest('hex')])
        : null,
    })
  }

  /** Logs in a 2FA user and returns the regenerated session cookie + fresh CSRF. */
  async function startPendingLogin(
    base: string,
    ip: string,
    csrf: { sessionCookie: string; csrfCookie: string; token: string },
    identifier: string,
  ): Promise<{ sessionCookie: string; csrfCookie: string; token: string }> {
    const loginRes = await postAuth(base, ip, '/login', {
      identifier,
      password: PASSWORD,
    }, csrf)
    expect(loginRes.status).toBe(302)
    expect(loginRes.headers.get('location')).toBe('/2fa')

    const sessionCookie = getCookieValue(loginRes.headers.getSetCookie(), 'connect.sid')!
    // The browser renders /2fa which refetches auth-config → fresh CSRF token
    // bound to the regenerated session.
    const refresh = await fetch(`${base}/__refresh-csrf`, {
      headers: { cookie: `connect.sid=${sessionCookie}`, 'x-forwarded-for': ip },
    })
    const { token } = (await refresh.json()) as { token: string }
    const csrfCookie = getCookieValue(refresh.headers.getSetCookie(), CSRF_COOKIE)!
    return { sessionCookie, csrfCookie, token }
  }

  async function postTwoFa(
    base: string,
    ip: string,
    token: string,
    csrf: { sessionCookie: string; csrfCookie: string; token: string },
  ): Promise<Response> {
    return fetch(`${base}/2fa`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        'x-forwarded-for': ip,
        cookie: cookieHeader(csrf.sessionCookie, csrf.csrfCookie),
        'csrf-token': csrf.token,
      },
      body: JSON.stringify({ token }),
    })
  }

  it('completes a pending login with a valid TOTP code', async () => {
    const userId = insertTotpUser('totp@x.io', false)
    const ip = '10.0.3.1'

    await withServer(makeApp(), async (base) => {
      const before = await acquireCsrf(base, ip)
      const pending = await startPendingLogin(base, ip, before, 'totp@x.io')

      const code = new OTPAuth.TOTP({
        issuer: 'Arclight',
        label: 'totp@x.io',
        secret: OTPAuth.Secret.fromBase32(TOTP_SECRET),
      }).generate()

      const res = await postTwoFa(base, ip, code, pending)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true, redirect: '/' })

      // Session now carries the authenticated user.
      const sessionCookie = getCookieValue(res.headers.getSetCookie(), 'connect.sid')!
      const sessionRes = await fetch(`${base}/__session`, {
        headers: { cookie: `connect.sid=${sessionCookie}`, 'x-forwarded-for': ip },
      })
      const session = (await sessionRes.json()) as { user: Record<string, unknown> | null }
      expect(session.user).toEqual({
        id: userId,
        email: 'totp@x.io',
        isAdmin: false,
        description: 'No About Me',
        username: 'totp',
      })
      // Express semantics: a 2FA login records history once, at verification
      // (POST /login with a 2FA user redirects to /2fa BEFORE loginHistory
      // is written; the POST /2fa success path writes the single row).
      expect(loginHistoryCount(userId)).toBe(1)
    })
  })

  it('accepts a recovery code and consumes it', async () => {
    const userId = insertTotpUser('recovery@x.io', true)
    const ip = '10.0.3.2'

    await withServer(makeApp(), async (base) => {
      const before = await acquireCsrf(base, ip)
      const pending = await startPendingLogin(base, ip, before, 'recovery@x.io')

      const res = await postTwoFa(base, ip, 'A1B2-C3D4-E5F6', pending)
      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ success: true, redirect: '/' })

      // The single recovery code was consumed → list is now null.
      expect(getUserRow(userId).totpRecoveryCodes).toBeNull()
    })
  })

  it('rejects an invalid code', async () => {
    insertTotpUser('badcode@x.io', false)
    const ip = '10.0.3.3'

    await withServer(makeApp(), async (base) => {
      const before = await acquireCsrf(base, ip)
      const pending = await startPendingLogin(base, ip, before, 'badcode@x.io')

      const res = await postTwoFa(base, ip, '000000', pending)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Invalid code. Try again.' })
    })
  })

  it('rejects a request without a pending login', async () => {
    const ip = '10.0.3.4'
    await withServer(makeApp(), async (base) => {
      const csrf = await acquireCsrf(base, ip)
      const res = await postTwoFa(base, ip, '123456', csrf)
      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({
        error: 'No login in progress. Sign in again.',
      })
    })
  })

  it('returns 403 without a CSRF token', async () => {
    const ip = '10.0.3.5'
    await withServer(makeApp(), async (base) => {
      const res = await fetch(`${base}/2fa`, {
        method: 'POST',
        redirect: 'manual',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify({ token: '123456' }),
      })
      expect(res.status).toBe(403)
    })
  })
})

afterAll(async () => {
  await auth.nitroPrisma.$disconnect().catch(() => {})
  db.close()
  rmSync(tmpDir, { recursive: true, force: true })
})
