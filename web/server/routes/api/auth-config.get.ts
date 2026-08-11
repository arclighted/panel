/**
 * GET /api/auth-config — Nitro-owned twin of the Express endpoint
 * (src/modules/core/index.ts). Returns the CSRF token (bound to the current
 * session), the session user (if any), and the public subset of panel
 * settings needed by the auth pages. The response shape is byte-identical to
 * the Express version (D2/D3 contract) so the React Query layer needs zero
 * changes.
 *
 * The CSRF token is issued with the same deterministic scheme as Express's
 * csrf-csrf doubleCsrf (HMAC over session.csrfSessionId), so POSTs that later
 * reach Express validate it there too.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  generateCsrfToken,
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../utils/auth-session'
import { buildAuthConfigPayload } from '../../utils/auth-config'

export default defineEventHandler(async (event) => {
  try {
    // Prefer the session attached by the 01.session middleware; fall back to
    // loading directly (keeps this route correct if middleware is skipped).
    const session =
      (event.context.session as SessionPayload | undefined) ??
      (await loadSession(event))

    const csrfToken = await generateCsrfToken(event, session)

    const [settingsRow, userCount] = await Promise.all([
      nitroPrisma.settings.findUnique({ where: { id: 1 } }),
      nitroPrisma.users.count(),
    ])

    return buildAuthConfigPayload({ csrfToken, session, settingsRow, userCount })
  } catch (error) {
    console.error('[api/auth-config] failed:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to fetch auth config' }
  }
})
