/**
 * POST /admin/apikeys/create — Nitro twin of the Express handler in
 * src/modules/admin/apiKeys.ts. Byte-identical (D3): enforces the per-user
 * key limit, generates a raw key (hashed at rest when enabled), stores the
 * permissions JSON. The frontend calls via adminPost (JSON), so the success
 * body carries the raw key when hashing is on (mirrors the Express
 * ?created= redirect query).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import crypto from 'crypto'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, generateApiKey } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'

const MAX_API_KEYS_PER_USER = 25

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

async function shouldHashKeys(): Promise<boolean> {
  try {
    const s = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    return s?.hashApiKeys === true
  } catch {
    return false
  }
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response
  const userId = guard.value.id

  try {
    const { name, description, permissions } = body as Record<string, unknown>
    if (!name) {
      setResponseStatus(event, 400)
      return { error: 'API key name is required' }
    }

    const keyCount = await nitroPrisma.apiKey.count({
      where: { userId: userId ?? undefined },
    })
    if (keyCount >= MAX_API_KEYS_PER_USER) {
      setResponseStatus(event, 400)
      return {
        error: `API key limit reached (${MAX_API_KEYS_PER_USER}). Delete an existing key first.`,
      }
    }

    const rawKey = generateApiKey(32)
    const useHash = await shouldHashKeys()
    const storedKey = useHash ? sha256(rawKey) : rawKey

    const permissionsArray = permissions
      ? Array.isArray(permissions)
        ? permissions
        : [permissions]
      : []

    await nitroPrisma.apiKey.create({
      data: {
        name: String(name),
        key: storedKey,
        description: description as string | null | undefined,
        permissions: JSON.stringify(permissionsArray),
        userId,
        updatedAt: new Date(),
      },
    })

    await logActivity(event, session, 'apikey:create', {
      metadata: { name: String(name), userId },
    })

    return useHash ? { success: true, created: rawKey } : { success: true }
  } catch (error) {
    console.error('Error creating API key:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create API key' }
  }
})
