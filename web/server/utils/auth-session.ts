/**
 * Nitro-side twin of the Express session + CSRF machinery.
 *
 * Phase 1 of the Express-elimination plan (docs/tanstack-migration-plan.md):
 * Nitro owns `/api/auth-config` (session user + CSRF token) while Express
 * still owns every mutation. Both processes must therefore agree on:
 *
 *  - **Session cookie contract** (express-session + PrismaSessionStore):
 *    cookie `connect.sid` = `s:<sid>.<signature>` (cookie-signature over
 *    `sid` with SESSION_SECRET); the session payload JSON lives in the
 *    `Session` table (`session_id` unique, `expires` for TTL).
 *  - **CSRF token contract** (csrf-csrf `doubleCsrf` in
 *    `src/handlers/utils/security/csrfProtection.ts`): token is
 *    `<hmac-sha256(SESSION_SECRET, [id.length, id, rnd.length, rnd].join('!'))>.<rnd>`
 *    where `id` is `session.csrfSessionId`. Cookie name
 *    `psifi.x-csrf-token` (dev) / `__Host-psifi.x-csrf-token` (prod);
 *    validated by double-submit (cookie === request token) + HMAC check.
 *
 * Because both processes read the same session row and derive the same HMAC
 * from the same secret, a token issued here validates in Express and vice
 * versa — no shared in-memory state is required.
 */

import { createHmac, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { deleteCookie, getCookie, getRequestHeader, setCookie } from 'h3'
import type { H3Event } from 'h3'
import { sign, unsign } from 'cookie-signature'
import Database from 'better-sqlite3'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaClient } from '../../../src/generated/prisma/client'

// ── Configuration (mirrors src/config.ts / src/app.ts) ─────────────────────

/** Same name Express uses (default express-session cookie name). */
export const sessionCookieName = 'connect.sid'

export const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

/** Same cookie name logic as csrfProtection.ts (csrf-csrf doubleCsrf). */
export function getCsrfCookieName(): string {
  return process.env.NODE_ENV === 'production'
    ? '__Host-psifi.x-csrf-token'
    : 'psifi.x-csrf-token'
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function isHttps(): boolean {
  return (process.env.URL ?? '').startsWith('https://')
}

const INSECURE_SECRETS = new Set([
  'change_me',
  'dev-only-insecure-secret-change-me',
  'secret',
  'changeme',
  'insecure',
])

/**
 * Resolves SESSION_SECRET with the same fail-fast rules as src/config.ts.
 * In production a missing/weak secret is fatal; in development we fall back
 * to an ephemeral random secret (sessions won't survive a restart — the
 * `pnpm dev` runner injects a shared dev secret so the two processes agree).
 */
export function getSessionSecret(): string {
  const raw = process.env.SESSION_SECRET
  if (raw && raw.length >= 32 && !INSECURE_SECRETS.has(raw)) {
    return raw
  }
  if (isProduction()) {
    throw new Error(
      'SESSION_SECRET is missing or insecure. Set a strong value in .env and restart.',
    )
  }
  console.warn(
    '[auth-session] SESSION_SECRET missing/insecure — generated an ephemeral secret for this boot; sessions will NOT survive a restart.',
  )
  return randomBytes(32).toString('hex')
}

// ── Database (shared SQLite file, same file Express uses) ──────────────────

/**
 * Resolves `file:./storage/dev.db` (relative to the repo root) to an absolute
 * path. The web process runs from `web/`, but the DB lives at the project
 * root — walk up from INIT_CWD/cwd until the parent directory exists.
 */
function resolveDbFile(raw: string): string {
  const rel = raw.replace(/^(sqlite|file):/, '')
  if (path.isAbsolute(rel)) {
    return rel
  }
  let dir = process.env.INIT_CWD || process.cwd()
  for (let i = 0; i < 8; i++) {
    const candidate = path.resolve(dir, rel)
    if (fs.existsSync(path.dirname(candidate))) {
      return candidate
    }
    const parent = path.dirname(dir)
    if (parent === dir) {
      break
    }
    dir = parent
  }
  return path.resolve(process.env.INIT_CWD || process.cwd(), rel)
}

const dbUrl = (() => {
  const raw = process.env.DATABASE_URL || 'file:./storage/dev.db'
  const resolved = `file:${resolveDbFile(raw)}`
  // Configure the SQLite file once (WAL + busy timeout) so concurrent reads
  // from Express and this process don't throw SQLITE_BUSY. journal_mode
  // persists in the file itself.
  try {
    const dbPath = resolved.slice('file:'.length)
    const setup = new Database(dbPath, { fileMustExist: false })
    setup.pragma('journal_mode = WAL')
    setup.pragma('synchronous = NORMAL')
    setup.pragma('busy_timeout = 5000')
    setup.close()
  } catch (error) {
    console.warn('[auth-session] Could not initialise SQLite journal mode.', {
      error: error instanceof Error ? error.message : String(error),
    })
  }
  return resolved
})()

const adapter = new PrismaBetterSqlite3({ url: dbUrl, timeout: 5000 })
export const nitroPrisma = new PrismaClient({ adapter })

// ── Session payload ─────────────────────────────────────────────────────────

export interface SessionPayload {
  user?: { id: number; email: string; isAdmin: boolean } & Record<
    string,
    unknown
  >
  pendingUserId?: number
  csrfSessionId?: string
  cookie?: Record<string, unknown>
  [key: string]: unknown
}

function unsignSessionCookie(cookie: string, secret: string): string | null {
  const value = cookie.startsWith('s:') ? cookie.slice(2) : cookie
  const sid = unsign(value, secret)
  return typeof sid === 'string' ? sid : null
}

function sessionCookieOptions() {
  return {
    maxAge: MAX_AGE_MS / 1000,
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isHttps(),
    path: '/',
  }
}

function csrfCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: isProduction(),
    path: '/',
  }
}

/**
 * Serializes a session payload into the `Session.data` JSON. Existing
 * sessions carry the express-session `cookie` sub-object (preserved
 * verbatim); brand-new sessions (anonymous visitor, first Nitro touch) get a
 * cookie object mirroring the panel's express-session config so Express can
 * hydrate the row later.
 */
function serializeSessionData(payload: SessionPayload): string {
  const cookie = payload.cookie ?? {
    originalMaxAge: MAX_AGE_MS,
    expires: new Date(Date.now() + MAX_AGE_MS),
    httpOnly: true,
    path: '/',
    sameSite: 'strict',
    secure: isHttps(),
  }
  return JSON.stringify({ ...payload, cookie })
}

/**
 * Loads the session for the request from the shared Prisma store. Returns {}
 * when there is no (valid) session — anonymous visitors included.
 */
export async function loadSession(event: H3Event): Promise<SessionPayload> {
  const cookie = getCookie(event, sessionCookieName)
  if (!cookie) {
    return {}
  }
  const sid = unsignSessionCookie(cookie, getSessionSecret())
  if (!sid) {
    return {}
  }
  const row = await nitroPrisma.session.findUnique({
    where: { session_id: sid },
  })
  if (!row) {
    return {}
  }
  // Drop expired sessions (prevents DB bloat) — mirrors PrismaSessionStore.get.
  if (row.expires && row.expires < new Date()) {
    await nitroPrisma.session
      .delete({ where: { session_id: sid } })
      .catch(() => {})
    return {}
  }
  try {
    return JSON.parse(row.data) as SessionPayload
  } catch {
    return {}
  }
}

/**
 * Persists the session payload and (re)issues the `connect.sid` cookie.
 * Reuses the existing sid when the request already carries one; otherwise a
 * fresh sid is generated (anonymous first touch).
 */
export async function saveSession(
  event: H3Event,
  payload: SessionPayload,
): Promise<string> {
  const secret = getSessionSecret()
  const cookie = getCookie(event, sessionCookieName)
  const sid = cookie ? unsignSessionCookie(cookie, secret) : null
  const nextSid = sid ?? randomBytes(16).toString('hex')
  const expires = new Date(Date.now() + MAX_AGE_MS)
  const data = serializeSessionData(payload)
  await nitroPrisma.session.upsert({
    where: { session_id: nextSid },
    update: { data, expires },
    create: { session_id: nextSid, data, expires },
  })
  setCookie(event, sessionCookieName, `s:${sign(nextSid, secret)}`, sessionCookieOptions())
  return nextSid
}

/** Destroys the session row (if any) and clears the cookie. */
export async function destroySession(event: H3Event): Promise<void> {
  const cookie = getCookie(event, sessionCookieName)
  const sid = cookie ? unsignSessionCookie(cookie, getSessionSecret()) : null
  if (sid) {
    await nitroPrisma.session
      .delete({ where: { session_id: sid } })
      .catch(() => {})
  }
  deleteCookie(event, sessionCookieName, { path: '/' })
}

// ── CSRF (csrf-csrf `doubleCsrf` compatible) ────────────────────────────────

/**
 * Ensures `session.csrfSessionId` exists (random hex) — the per-session
 * identifier both processes HMAC into the token. Mirrors
 * ensureCsrfSessionId() in csrfProtection.ts.
 */
export function ensureCsrfSessionId(session: SessionPayload): string {
  if (!session.csrfSessionId) {
    session.csrfSessionId = randomBytes(16).toString('hex')
  }
  return session.csrfSessionId
}

/**
 * Builds a CSRF token exactly like csrf-csrf's doubleCsrf:
 * token = `<hmac-sha256(secret, [id.length, id, rnd.length, rnd].join('!'))>.<rnd>`
 */
export function csrfTokenValue(
  secret: string,
  sessionId: string,
  randomValue: string,
): string {
  const message = [sessionId.length, sessionId, randomValue.length, randomValue].join('!')
  return `${createHmac('sha256', secret).update(message).digest('hex')}.${randomValue}`
}

/** Verifies a cookie token's HMAC against the current session identifier. */
export function csrfCookieValid(
  cookie: string,
  secret: string,
  sessionId: string,
): boolean {
  const dot = cookie.indexOf('.')
  if (dot <= 0 || dot === cookie.length - 1) {
    return false
  }
  const hmac = cookie.slice(0, dot)
  const randomValue = cookie.slice(dot + 1)
  if (!hmac || !randomValue) {
    return false
  }
  const expected = createHmac('sha256', secret)
    .update([sessionId.length, sessionId, randomValue.length, randomValue].join('!'))
    .digest('hex')
  return hmac === expected
}

/**
 * Issues (or reuses) the session's CSRF token and sets the CSRF cookie.
 * Mirrors csrf-csrf generateCsrfToken: an existing valid cookie is reused;
 * otherwise a fresh token is minted. If the session had no csrfSessionId yet
 * (anonymous visitor, first touch), the session is persisted so Express can
 * validate the token later — same side effect as Express's
 * addCsrfTokenToLocals.
 */
export async function generateCsrfToken(
  event: H3Event,
  session: SessionPayload,
): Promise<string> {
  const hadSessionId = typeof session.csrfSessionId === 'string'
  const sessionId = ensureCsrfSessionId(session)
  const secret = getSessionSecret()

  const existing = getCookie(event, getCsrfCookieName())
  if (existing && csrfCookieValid(existing, secret, sessionId)) {
    if (!hadSessionId) {
      await saveSession(event, session)
    }
    return existing
  }

  const randomValue = randomBytes(32).toString('hex')
  const token = csrfTokenValue(secret, sessionId, randomValue)
  setCookie(event, getCsrfCookieName(), token, csrfCookieOptions())
  if (!hadSessionId) {
    await saveSession(event, session)
  }
  return token
}

/** Reads the CSRF token from the request (header first, then _csrf body). */
export function getCsrfTokenFromRequest(event: H3Event): string | null {
  return (
    getRequestHeader(event, 'csrf-token') ||
    getRequestHeader(event, 'x-csrf-token') ||
    null
  )
}

/**
 * Validates a request token against the CSRF cookie + session identifier —
 * the exact double-submit semantics of csrf-csrf doubleCsrfProtection.
 * Callers that accept `_csrf` from the JSON body pass it explicitly.
 */
export function validateCsrfToken(
  event: H3Event,
  session: SessionPayload,
  tokenFromRequest: string | null,
): boolean {
  const cookie = getCookie(event, getCsrfCookieName())
  if (typeof cookie !== 'string' || typeof tokenFromRequest !== 'string') {
    return false
  }
  if (cookie === '' || tokenFromRequest === '' || cookie !== tokenFromRequest) {
    return false
  }
  return csrfCookieValid(cookie, getSessionSecret(), ensureCsrfSessionId(session))
}
