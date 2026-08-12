/**
 * POST /admin/radar/scan/:serverId — Nitro twin of the Express handler in
 * src/modules/admin/radar.ts. Byte-identical (D3): reads the radar script
 * (containPath-guarded), asks the node daemon to run the scan, and attaches
 * severity derived from the script pattern definitions.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import path from 'path'
import fs from 'fs/promises'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard, getParamAsNumber } from '../../../../utils/admin-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { containPath } from '../../../../../../src/utils/pathSecurity'

function deriveSeverity(matchCount: number): string {
  if (matchCount >= 10) return 'critical'
  if (matchCount >= 3) return 'high'
  if (matchCount >= 1) return 'medium'
  return 'low'
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const serverId = getRouterParam(event, 'serverId') ?? ''
    const { scriptId } = body

    if (!serverId || !scriptId) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Server ID and Script ID are required' }
    }

    const server = await nitroPrisma.server.findUnique({
      where: { id: getParamAsNumber(serverId) },
      include: { node: true },
    })

    if (!server) {
      setResponseStatus(event, 404)
      return { success: false, error: 'Server not found' }
    }

    const radarDir = path.join(process.cwd(), 'storage', 'radar')
    const scriptPath = path.join(radarDir, `${String(scriptId)}.json`)
    if (!containPath(radarDir, scriptPath)) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid script ID' }
    }
    const scriptContent = await fs.readFile(scriptPath, 'utf-8')
    const script = JSON.parse(scriptContent) as Record<string, unknown>

    const response = await daemonRequest<unknown>({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'POST',
      path: '/radar/scan',
      body: {
        id: server.UUID,
        script,
      },
      timeout: 60000,
    })

    const scanData = response.data as Record<string, unknown> | undefined

    // Attach severity from the script pattern definitions to each result
    // so the frontend can colour-code without having to re-derive it
    if (scanData && Array.isArray(scanData.results)) {
      const patternMap: Record<string, string> = {}
      const patterns = script.patterns as
        | Array<Record<string, unknown>>
        | undefined
      for (const p of patterns ?? []) {
        const key = String((p.description || '') as string).toLowerCase()
        if (p.severity) patternMap[key] = String(p.severity)
      }

      scanData.results = (scanData.results as Array<Record<string, unknown>>).map(
        (result) => {
          const desc = String(
            ((result.pattern as Record<string, unknown> | undefined)?.description) || '',
          )
          const key = desc.toLowerCase()
          return {
            ...result,
            severity:
              patternMap[key] ||
              deriveSeverity((result.matches as unknown[] | undefined)?.length ?? 0),
          }
        },
      )
    }

    return {
      success: true,
      serverName: server.name,
      scriptName: script.name ?? null,
      results: scanData,
    }
  } catch (error: unknown) {
    console.error('Error running radar scan:', error)
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error occurred'
    setResponseStatus(event, 500)
    return {
      success: false,
      error: 'Failed to run radar scan',
      message: errorMessage,
    }
  }
})
