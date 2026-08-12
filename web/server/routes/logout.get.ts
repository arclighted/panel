/**
 * GET /logout — Nitro-owned twin of the Express handler in
 * src/modules/auth/authService.ts. The browser navigates to /logout via a
 * plain link (<a href="/logout">); the handler destroys the session row and
 * clears the connect.sid cookie, then redirects to /login — same contract.
 */
import { defineEventHandler, sendRedirect } from 'h3'
import { destroySession } from '../utils/auth-session'

export default defineEventHandler(async (event) => {
  await destroySession(event)
  return sendRedirect(event, '/login', 302)
})
