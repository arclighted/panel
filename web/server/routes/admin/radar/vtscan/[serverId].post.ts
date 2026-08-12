/**
 * POST /admin/radar/vtscan/:serverId — Nitro twin of the Express handler in
 * src/modules/admin/radar.ts. Byte-identical (D3): asks the node to zip the
 * scannable folders, uploads to VirusTotal, polls the analysis, and returns
 * per-engine verdicts (or a pending link).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import path from 'path'
import fs from 'fs/promises'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard, getParamAsNumber } from '../../../../utils/admin-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'
import { httpGet, httpPost } from '../../../../../../src/utils/http'

// In-memory rate limiter respecting VT free tier: 4/min, 500/day
const vtRateLimit = {
  minuteWindow: 0,
  minuteCount: 0,
  dayWindow: 0,
  dayCount: 0,
  allow(): boolean {
    const now = Math.floor(Date.now() / 1000)
    const minute = Math.floor(now / 60)
    if (minute !== this.minuteWindow) {
      this.minuteWindow = minute
      this.minuteCount = 0
    }
    if (this.minuteCount >= 4) return false
    this.minuteCount++
    return true
  },
  allowDaily(): boolean {
    const day = Math.floor(Date.now() / 86400000)
    if (day !== this.dayWindow) {
      this.dayWindow = day
      this.dayCount = 0
    }
    if (this.dayCount >= 500) return false
    this.dayCount++
    return true
  },
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
  const apiKey = settings?.virusTotalApiKey

  if (!apiKey) {
    setResponseStatus(event, 503)
    return {
      success: false,
      error: 'VirusTotal API key is not configured. Add it in Admin Settings.',
    }
  }

  if (!vtRateLimit.allow()) {
    setResponseStatus(event, 429)
    return {
      success: false,
      error: 'Rate limit: 4 requests/min on free tier. Wait a moment.',
    }
  }

  if (!vtRateLimit.allowDaily()) {
    setResponseStatus(event, 429)
    return {
      success: false,
      error: 'Daily quota reached: 500 requests/day on free tier.',
    }
  }

  const server = await nitroPrisma.server.findUnique({
    where: { id: getParamAsNumber(getRouterParam(event, 'serverId') ?? '') },
    include: { node: true },
  })

  if (!server) {
    setResponseStatus(event, 404)
    return { success: false, error: 'Server not found' }
  }

  // server.UUID comes from the database record, not from user input.
  const tmpPath = path.join('/tmp', `vtscan-${server.UUID}-${Date.now()}.zip`)

  try {
    // Ask the node to zip the scannable folders and stream back the archive.
    const zipResponse = await daemonRequest<Buffer>({
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      method: 'POST',
      path: '/radar/zip',
      body: {
        id: server.UUID,
        include: ['plugins', 'mods', 'config', 'addons', 'datapacks'],
        exclude: ['world', 'world_nether', 'world_the_end', 'logs', 'cache', 'crash-reports'],
        maxFileSizeMb: 32,
      },
      responseType: 'arraybuffer',
      timeout: 120000,
    })

    await fs.writeFile(tmpPath, zipResponse.data as Buffer)

    const stat = await fs.stat(tmpPath)
    // VT free tier rejects files over 32 MB
    if (stat.size > 32 * 1024 * 1024) {
      await fs.unlink(tmpPath)
      setResponseStatus(event, 413)
      return {
        success: false,
        error:
          'Zipped server files exceed 32 MB — VT free tier limit. Try excluding more folders.',
      }
    }

    // Upload the zip to VT
    const fileBuffer = await fs.readFile(tmpPath)
    const boundary = `----FormBoundary${Math.random().toString(36).slice(2)}`
    const fileName = `${server.name}-scan.zip`

    const formBody = Buffer.concat([
      Buffer.from(
        `--${boundary}\r\n` +
          `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
          'Content-Type: application/zip\r\n\r\n',
      ),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ])

    const uploadResponse = await httpPost<Record<string, unknown>>(
      'https://www.virustotal.com/api/v3/files',
      formBody,
      {
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'x-apikey': apiKey,
        },
        timeout: 90000,
      },
    )

    // Accept 200 (success) or 409 (file already uploaded recently)
    if (uploadResponse.status !== 200 && uploadResponse.status !== 409) {
      setResponseStatus(event, 502)
      return { success: false, error: `VT returned status ${uploadResponse.status}` }
    }

    const vtUploadData = uploadResponse.data as { data?: { id?: string } }
    const analysisId = vtUploadData?.data?.id
    if (!analysisId) {
      setResponseStatus(event, 502)
      return { success: false, error: 'VT did not return an analysis ID' }
    }

    // Poll VT up to 8 times, 20s apart (max ~2.7 min wait).
    let analysisData: Record<string, unknown> | null = null
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((r) => setTimeout(r, 20000))

      const pollResponse = await httpGet<Record<string, unknown>>(
        `https://www.virustotal.com/api/v3/analyses/${analysisId}`,
        { headers: { 'x-apikey': apiKey }, timeout: 15000 },
      )

      const pollData = pollResponse.data as Record<string, unknown> | undefined
      const status = (
        (pollData?.data as Record<string, unknown> | undefined)?.attributes as
          | Record<string, unknown>
          | undefined
      )?.status
      if (status === 'completed') {
        analysisData = pollResponse.data
        break
      }
    }

    if (!analysisData) {
      return {
        success: true,
        pending: true,
        analysisId,
        vtLink: 'https://www.virustotal.com/gui/home/upload',
      }
    }

    // The correct GUI URL needs the file's SHA256, not the analysis ID.
    const meta = analysisData.meta as Record<string, unknown> | undefined
    const fileInfo = meta?.file_info as Record<string, unknown> | undefined
    const sha256 = fileInfo?.sha256 as string | undefined
    const vtLink = sha256
      ? `https://www.virustotal.com/gui/file/${sha256}`
      : 'https://www.virustotal.com/gui/home/upload'

    const dataAttrs = (
      analysisData.data as Record<string, unknown>
    )?.attributes as Record<string, unknown> | undefined
    const results = (dataAttrs?.results || {}) as Record<
      string,
      Record<string, unknown>
    >
    const stats = (dataAttrs?.stats || {}) as Record<string, number>
    const maliciousEngines = Object.entries(results)
      .filter(([, v]) => v.category === 'malicious' || v.category === 'suspicious')
      .map(([engine, v]) => ({ engine, result: v.result }))

    return {
      success: true,
      pending: false,
      serverName: server.name,
      maliciousEngines,
      stats,
      totalEngines: Object.keys(results).length,
      vtLink,
    }
  } catch (err: unknown) {
    console.error('VT file scan error:', err instanceof Error ? err.message : err)
    setResponseStatus(event, 502)
    return { success: false, error: 'File scan failed' }
  } finally {
    fs.unlink(tmpPath).catch(() => {})
  }
})
