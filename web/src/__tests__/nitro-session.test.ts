// @vitest-environment node
/**
 * Integration tests for the Nitro session + CSRF twin (web/server/utils/
 * auth-session.ts) against a real temporary SQLite database.
 *
 * These pin the two contracts that must hold across the Express seam:
 *  1. the session cookie is express-session shaped (`connect.sid=s:<sid>.<sig>`,
 *     payload JSON in the `Session` table), and
 *  2. the CSRF token is csrf-csrf `doubleCsrf` shaped (HMAC over
 *     session.csrfSessionId, validated by double-submit), so tokens issued by
 *     Nitro validate in Express POSTs and vice versa.
 */
import { describe, expect, it, beforeAll, afterAll } from 'vitest'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { createApp, defineEventHandler } from 'h3'
import { toNodeListener } from 'h3/node'
import { sign } from 'cookie-signature'

const tmpDir = mkdtempSync(path.join(tmpdir(), 'arclight-nitro-session-'))
const dbPath = path.join(tmpDir, 'test.db')

// Env must be in place before the module under test is imported (the client
// and SQLite file are constructed at module load).
process.env.DATABASE_URL = `file:${dbPath}`
process.env.SESSION_SECRET = 'a'.repeat(64)
process.env.NODE_ENV = 'test'
process.env.URL = 'http://localhost'

const setup = new Database(dbPath)
setup.exec(`
  CREATE TABLE IF NOT EXISTS "Session" (
    id TEXT NOT NULL PRIMARY KEY,
    session_id TEXT NOT NULL,
    data TEXT NOT NULL,
    expires DATETIME NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "Session_session_id_key" ON "Session"("session_id");
`)
setup.close()

const auth = await import('../../server/utils/auth-session')

function makeApp(
  routes: Record<string, (event: unknown) => unknown>,
): (req: unknown, res: unknown) => void {
  const app = createApp()
  for (const [route, handler] of Object.entries(routes)) {
    app.all(route, defineEventHandler(handler))
  }
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

describe('Nitro session (auth-session.ts)', () => {
  afterAll(async () => {
    await auth.nitroPrisma.$disconnect().catch(() => {})
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('persists and reloads a session through the shared Prisma store', async () => {
    const app = makeApp({
      '/set': async (event) => {
        const session = await auth.loadSession(event as never)
        session.user = { id: 1, email: 'a@b.c', isAdmin: true, username: 'alice' }
        await auth.saveSession(event as never, session)
        return { ok: true }
      },
      '/get': async (event) => ({
        user: (await auth.loadSession(event as never)).user ?? null,
      }),
    })

    await withServer(app, async (base) => {
      const setRes = await fetch(`${base}/set`)
      const cookie = getCookieValue(setRes.headers.getSetCookie(), 'connect.sid')
      expect(cookie).toBeTruthy()
      // express-session cookie contract: s:<sid>.<signature>
      expect(cookie!.startsWith('s:')).toBe(true)

      const getRes = await fetch(`${base}/get`, {
        headers: { cookie: `connect.sid=${cookie}` },
      })
      const body = (await getRes.json()) as { user: unknown }
      expect(body.user).toEqual({
        id: 1,
        email: 'a@b.c',
        isAdmin: true,
        username: 'alice',
      })
    })
  })

  it('returns an empty session and no cookie for anonymous visitors', async () => {
    const app = makeApp({
      '/anon': async (event) => {
        const session = await auth.loadSession(event as never)
        return { keys: Object.keys(session), hadId: typeof session.csrfSessionId === 'string' }
      },
    })
    await withServer(app, async (base) => {
      const res = await fetch(`${base}/anon`)
      const body = (await res.json()) as { keys: string[]; hadId: boolean }
      expect(body.keys).toEqual([])
      expect(body.hadId).toBe(false)
      expect(getCookieValue(res.headers.getSetCookie(), 'connect.sid')).toBeNull()
    })
  })

  it('drops expired session rows on load', async () => {
    const sid = 'expired-sid-123'
    const db = new Database(dbPath)
    db.prepare(
      `INSERT INTO "Session" (id, session_id, data, expires) VALUES (?, ?, ?, ?)`,
    ).run(
      'row-1',
      sid,
      JSON.stringify({ cookie: {} }),
      new Date(Date.now() - 60_000).toISOString(),
    )
    db.close()

    const app = makeApp({
      '/load': async (event) => {
        const session = await auth.loadSession(event as never)
        return { keys: Object.keys(session) }
      },
    })
    await withServer(app, async (base) => {
      const signed = `s:${sign(sid, 'a'.repeat(64))}`
      const res = await fetch(`${base}/load`, {
        headers: { cookie: `connect.sid=${signed}` },
      })
      const body = (await res.json()) as { keys: string[] }
      expect(body.keys).toEqual([])

      const check = new Database(dbPath)
      const row = check
        .prepare('SELECT session_id FROM "Session" WHERE session_id = ?')
        .get(sid)
      check.close()
      expect(row).toBeUndefined()
    })
  })

  it('mints a csrf-csrf-shaped token and validates double-submit', async () => {
    const app = makeApp({
      '/token': async (event) => {
        const session = await auth.loadSession(event as never)
        return { token: await auth.generateCsrfToken(event as never, session) }
      },
      '/check': async (event) => {
        const session = await auth.loadSession(event as never)
        return { ok: auth.validateCsrfToken(event as never, session, auth.getCsrfTokenFromRequest(event as never)) }
      },
    })

    await withServer(app, async (base) => {
      const t = await fetch(`${base}/token`)
      const { token } = (await t.json()) as { token: string }
      const cookies = t.headers.getSetCookie()
      const sessionCookie = getCookieValue(cookies, 'connect.sid')
      const csrfCookie = getCookieValue(cookies, 'psifi.x-csrf-token')
      expect(sessionCookie).toBeTruthy()
      expect(csrfCookie).toBeTruthy()

      // csrf-csrf doubleCsrf shape: <64-hex hmac>.<64-hex random>
      expect(token).toMatch(/^[0-9a-f]{64}\.[0-9a-f]{64}$/)
      expect(token).toBe(csrfCookie)

      const cookieHeader = `connect.sid=${sessionCookie}; psifi.x-csrf-token=${csrfCookie}`

      // Valid double-submit (cookie + header match) passes.
      const ok = await fetch(`${base}/check`, {
        headers: { cookie: cookieHeader, 'csrf-token': token },
      })
      expect(((await ok.json()) as { ok: boolean }).ok).toBe(true)

      // Mismatched header token is rejected.
      const bad = await fetch(`${base}/check`, {
        headers: { cookie: cookieHeader, 'csrf-token': 'f'.repeat(129) },
      })
      expect(((await bad.json()) as { ok: boolean }).ok).toBe(false)

      // Tampered cookie is rejected even when header matches.
      const tampered = await fetch(`${base}/check`, {
        headers: {
          cookie: `connect.sid=${sessionCookie}; psifi.x-csrf-token=${'b'.repeat(129)}`,
          'csrf-token': token,
        },
      })
      expect(((await tampered.json()) as { ok: boolean }).ok).toBe(false)

      // No CSRF cookie at all is rejected.
      const none = await fetch(`${base}/check`, {
        headers: { cookie: `connect.sid=${sessionCookie}`, 'csrf-token': token },
      })
      expect(((await none.json()) as { ok: boolean }).ok).toBe(false)
    })
  })

  it('reuses a valid CSRF cookie instead of minting a fresh token', async () => {
    const app = makeApp({
      '/token': async (event) => {
        const session = await auth.loadSession(event as never)
        return { token: await auth.generateCsrfToken(event as never, session) }
      },
    })
    await withServer(app, async (base) => {
      const first = await fetch(`${base}/token`)
      const firstBody = (await first.json()) as { token: string }
      const sessionCookie = getCookieValue(first.headers.getSetCookie(), 'connect.sid')

      const firstCsrf = getCookieValue(first.headers.getSetCookie(), 'psifi.x-csrf-token')
      expect(firstCsrf).toBeTruthy()

      const second = await fetch(`${base}/token`, {
        headers: {
          cookie: `connect.sid=${sessionCookie}; psifi.x-csrf-token=${firstCsrf}`,
        },
      })
      const secondBody = (await second.json()) as { token: string }
      expect(secondBody.token).toBe(firstBody.token)
    })
  })

  it('attaches the session to event.context.session via the Nitro middleware', async () => {
    const { default: sessionMiddleware } = await import(
      '../../server/middleware/01.session'
    )
    const app = createApp()
    app.use(sessionMiddleware)
    app.all('/ctx', defineEventHandler(async (event) => {
      const context = (event as { context: { session?: unknown } }).context
      return { user: (context.session as { user?: unknown } | undefined)?.user ?? null }
    }))
    await withServer(toNodeListener(app), async (base) => {
      const anon = await fetch(`${base}/ctx`)
      expect(((await anon.json()) as { user: unknown }).user).toBeNull()
    })
  })
})
