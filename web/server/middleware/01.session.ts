/**
 * Nitro middleware: loads the session (from the shared Prisma store) once and
 * exposes it as `event.context.session`. The DB is only touched when the
 * request actually carries a `connect.sid` cookie — anonymous visitors get {}
 * with zero DB traffic. Phase 2+ handlers read this instead of calling
 * loadSession() themselves.
 */
import { defineEventHandler, getCookie } from 'h3'
import { loadSession, sessionCookieName } from '../utils/auth-session'

export default defineEventHandler(async (event) => {
  event.context.session = getCookie(event, sessionCookieName)
    ? await loadSession(event)
    : {}
})
