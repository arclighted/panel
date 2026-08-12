/**
 * POST /admin/databases/create — Nitro twin of the Express handler in
 * src/modules/admin/databases.ts. Byte-identical (D3): creates a MySQL
 * database host (missing fields → 400 JSON for the React form, since the
 * EJS redirect query params are unreachable from the TanStack app).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'

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

  try {
    const { name, host, port, username, password, nodeId } = body as Record<string, unknown>
    if (!name || !host || !username || !password) {
      setResponseStatus(event, 400)
      return { error: 'Missing required fields' }
    }
    const portNum = parseInt(String(port ?? ''), 10) || 3306
    const parsedNode = parseInt(String(nodeId ?? ''), 10)
    await nitroPrisma.databaseHost.create({
      data: {
        name: String(name).trim(),
        host: String(host).trim(),
        port: portNum,
        username: String(username).trim(),
        password: String(password),
        nodeId: parsedNode && parsedNode > 0 ? parsedNode : null,
      },
    })
    return { success: true }
  } catch (error) {
    console.error('Error creating database host:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create database host' }
  }
})
