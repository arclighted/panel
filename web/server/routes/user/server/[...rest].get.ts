/**
 * GET /user/server/:uuid/... — legacy EJS server pages (pre-TanStack). The
 * migrated app owns /server/:uuid/*; redirect old bookmarks 1:1. (DELETE
 * /user/server/:uuid remains a real Nitro route — user self-delete.)
 */
import { defineEventHandler, getRouterParams, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  const params = getRouterParams(event) as Record<string, unknown>
  // Nitro compiles the catch-all param as a '/' joined string (**:rest); the
  // unit tests construct it as an array — normalize both.
  const raw = Array.isArray(params.rest)
    ? (params.rest as unknown[]).map((s) => String(s))
    : String(params.rest ?? '').split('/')
  const [uuidRaw, ...tailRaw] = raw
  if (!uuidRaw) {
    return sendRedirect(event, '/', 302)
  }
  // The catch-all param arrives percent-ENCODED (raw path split) — decode
  // before re-encoding so a `%20` in the original URL doesn't double-encode.
  const decode = (s: string): string => {
    try {
      return decodeURIComponent(s)
    } catch {
      return s
    }
  }
  const uuid = decode(uuidRaw)
  const tail = tailRaw.map((s) => encodeURIComponent(decode(s)))
  const target = `/server/${encodeURIComponent(uuid)}${
    tail.length > 0 ? `/${tail.join('/')}` : ''
  }${event.url.search}`
  return sendRedirect(event, target, 302)
})
