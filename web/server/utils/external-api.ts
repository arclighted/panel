/**
 * Shared Nitro-side helpers for the Phase 2 group 5 external APIs (/api/v1,
 * /api/client) — mirrors src/handlers/utils/api/apiValidator.ts and the
 * paginate()/apiAudit() helpers in src/modules/api/v1/api.ts so the
 * Bearer-key contract stays byte-identical across the seam (D3).
 */
import { getHeader, setResponseStatus, type H3Event } from 'h3'
import crypto from 'crypto'
import { nitroPrisma, type SessionPayload } from './auth-session'
import { logActivity } from './server-api'
import { getParamAsString, getParamAsNumber } from '../../../src/utils/typeHelpers'

export { getParamAsString, getParamAsNumber }

// SHA-256 is used for API key hashing (not bcrypt) because API keys are
// random high-entropy strings. The 200ms delay on invalid keys provides
// additional timing attack protection (mirrors apiValidator.ts).
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function hashingEnabled(): Promise<boolean> {
  try {
    const s = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    return s?.hashApiKeys === true
  } catch {
    return false
  }
}

export type ApiKeyGuard =
  | { ok: true; value: { id: number; name: string; permissions: string } }
  | { ok: false; response: unknown }

/**
 * Port of the Express apiValidator middleware: validates the Bearer key,
 * checks active flag, and enforces the required permission (with `.*` wildcard
 * support). Sets the response status and returns the GuardOutcome the handler
 * must return.
 */
export async function requireApiKey(
  event: H3Event,
  requiredPermission?: string,
): Promise<ApiKeyGuard> {
  try {
    const authHeader = getHeader(event, 'authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      setResponseStatus(event, 401)
      return {
        ok: false,
        response: {
          error: 'Unauthorized: Missing or malformed Authorization header',
        },
      }
    }

    const rawKey = authHeader.split(' ')[1] ?? ''

    // When key hashing is enabled, look up the SHA-256 hash of the submitted
    // key — the raw value is never stored. Fall back to plaintext if not.
    const useHash = await hashingEnabled()
    const lookupKey = useHash ? sha256(rawKey) : rawKey

    const keyData = await nitroPrisma.apiKey.findUnique({
      where: { key: lookupKey },
    })

    if (!keyData) {
      await new Promise((r) => setTimeout(r, 200))
      setResponseStatus(event, 403)
      return { ok: false, response: { error: 'Invalid API key' } }
    }

    if (!keyData.active) {
      setResponseStatus(event, 401)
      return { ok: false, response: { error: 'Unauthorized: API Key is inactive' } }
    }

    if (requiredPermission) {
      try {
        const permissions = JSON.parse(keyData.permissions || '[]') as string[]
        const hasPermission = permissions.some((perm: string) => {
          if (perm === requiredPermission) return true
          if (perm.endsWith('.*')) {
            return requiredPermission.startsWith(`${perm.slice(0, -2)}.`)
          }
          return false
        })

        if (!hasPermission) {
          setResponseStatus(event, 403)
          return {
            ok: false,
            response: {
              error: 'Forbidden: API Key does not have the required permission',
              requiredPermission,
            },
          }
        }
      } catch (error) {
        console.error('Error parsing API key permissions:', error)
        setResponseStatus(event, 500)
        return { ok: false, response: { error: 'Internal Server Error' } }
      }
    }

    return {
      ok: true,
      value: { id: keyData.id, name: keyData.name, permissions: keyData.permissions ?? '[]' },
    }
  } catch (error) {
    console.error('Error in API validator middleware:', error)
    setResponseStatus(event, 500)
    return { ok: false, response: { error: 'Internal Server Error' } }
  }
}

export function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length
  const lastPage = Math.max(1, Math.ceil(total / perPage))
  const safePage = Math.max(1, Math.min(page, lastPage))
  return {
    data: items.slice((safePage - 1) * perPage, safePage * perPage),
    meta: {
      total,
      per_page: perPage,
      current_page: safePage,
      last_page: lastPage,
    },
  }
}

/**
 * API audit wrapper — mirrors apiAudit() in src/modules/api/v1/api.ts:
 * writes an activity log row keyed to the API actor; never throws into the
 * response path. External API calls carry no session, so the actor is the
 * API key name when available.
 */
export async function apiAudit(
  event: H3Event,
  eventName: string,
  serverId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    const actorName = (event.context.apiKey as { name?: string } | undefined)
      ?.name
    const session = {
      user: actorName ? { id: null as number | null, username: actorName } : null,
    } as unknown as SessionPayload
    await logActivity(event, session, eventName as never, {
      serverId,
      metadata,
    })
  } catch {
    // Audit logging must never break the API response.
  }
}
