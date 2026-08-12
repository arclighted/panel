/**
 * Shared Nitro-side helpers for the Phase 2 group 5 client API (/api/client)
 * — mirrors getApiKeyUserId / jsonError / resolveServerForUser in
 * src/modules/api/client/clientApi.ts so the owner-or-subuser authorization
 * contract stays byte-identical across the seam (D3).
 */
import { setResponseStatus, type H3Event } from 'h3'
import { nitroPrisma } from './auth-session'
import { requireApiKey } from './external-api'

export { requireApiKey, getParamAsString } from './external-api'

/**
 * Client-API guard: validates the Bearer key AND requires it to belong to a
 * user (client APIs are user-scoped). Returns a GuardOutcome.
 */
export async function requireClientApiKey(
  event: H3Event,
): Promise<
  | { ok: true; userId: number; keyId: number }
  | { ok: false; response: unknown }
> {
  const guard = await requireApiKey(event)
  if (!guard.ok) return { ok: false, response: guard.response }

  const keyData = await nitroPrisma.apiKey.findUnique({
    where: { id: guard.value.id },
  })
  if (!keyData?.userId) {
    setResponseStatus(event, 403)
    return {
      ok: false,
      response: { error: 'API key must be associated with a user' },
    }
  }
  return { ok: true, userId: keyData.userId, keyId: keyData.id }
}

export function clientError(
  event: H3Event,
  error: string,
  status = 400,
): { ok: false; response: unknown } {
  setResponseStatus(event, status)
  return { ok: false, response: { error } }
}

/**
 * Resolve a server the API key's user can manage: owner or subuser. Returns
 * the server with its node joined, or null.
 */
export async function resolveServerForUser(
  serverId: string,
  userId: number,
): Promise<Awaited<ReturnType<typeof lookupServer>> | null> {
  const server = await lookupServer(serverId)
  if (!server) return null
  if (server.ownerId === userId) return server
  const subUser = await nitroPrisma.subUser.findFirst({
    where: { serverId: server.UUID, userId },
  })
  if (!subUser) return null
  return server
}

async function lookupServer(serverId: string) {
  return nitroPrisma.server.findUnique({
    where: { UUID: serverId },
    include: { node: true },
  })
}
