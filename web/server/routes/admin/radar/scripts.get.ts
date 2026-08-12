/**
 * GET /admin/radar/scripts — Nitro twin of the Express handler in
 * src/modules/admin/radar.ts. Byte-identical (D3): lists the radar script
 * JSONs from storage/radar.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import path from 'path'
import fs from 'fs/promises'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  if (!requireCsrf(event, session, {})) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const radarDir = path.join(process.cwd(), 'storage', 'radar')
    try {
      await fs.access(radarDir)
    } catch {
      await fs.mkdir(radarDir, { recursive: true })
    }

    const files = await fs.readdir(radarDir)
    const scripts = await Promise.all(
      files
        .filter((file) => file.endsWith('.json'))
        .map(async (file) => {
          const content = await fs.readFile(path.join(radarDir, file), 'utf-8')
          try {
            const scriptData = JSON.parse(content)
            return {
              id: file.replace('.json', ''),
              name: scriptData.name || file,
              description: scriptData.description || '',
              version: scriptData.version || '1.0.0',
              filename: file,
            }
          } catch (error: unknown) {
            console.error(`Error parsing radar script ${file}:`, error)
            return {
              id: file.replace('.json', ''),
              name: file,
              description: 'Invalid script format',
              version: 'unknown',
              filename: file,
            }
          }
        }),
    )

    return { success: true, scripts }
  } catch (error) {
    console.error('Error fetching radar scripts:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to fetch radar scripts' }
  }
})
