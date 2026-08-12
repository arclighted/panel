/**
 * POST /admin/apikeys/edit/:id — Nitro twin of the Express handler in
 * src/modules/admin/apiKeys.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'

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

  const id = parseInt(getRouterParam(event, 'id') ?? '', 10)
  try {
    const { name, description, permissions } = body as Record<string, unknown>
    if (!name) {
      setResponseStatus(event, 400)
      return { error: 'API key name is required' }
    }

    const permissionsArray = permissions
      ? Array.isArray(permissions)
        ? permissions
        : [permissions]
      : []

    await nitroPrisma.apiKey.update({
      where: { id },
      data: {
        name: String(name),
        description: description as string | null | undefined,
        permissions: JSON.stringify(permissionsArray),
        updatedAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Error updating API key:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update API key' }
  }
})
