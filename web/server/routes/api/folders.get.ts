/**
 * GET /api/folders — Nitro twin of the Express handler in
 * src/modules/user/folderSystem.ts. Lists the authenticated user's folders
 * with their member server UUIDs (byte-identical `{ success, folders }`).
 * The sibling mutations (POST/PATCH/DELETE /api/folders*) stay Express-owned.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../utils/auth-session'
import { requireAuthenticated } from '../../utils/auth'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const auth = await requireAuthenticated(event, session)
  if (!auth.ok) {
    return auth.response
  }
  const user = auth.value

  try {
    const folders = await nitroPrisma.serverFolder.findMany({
      where: { ownerId: user.id },
      include: { members: true },
      orderBy: { createdAt: 'asc' },
    })
    return { success: true, folders }
  } catch (error) {
    console.error('Error fetching folders:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to fetch folders.' }
  }
})
