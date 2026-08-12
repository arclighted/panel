/**
 * POST /admin/radar/virustotal — Nitro twin of the Express handler in
 * src/modules/admin/radar.ts. Byte-identical (D3): hash lookup against the
 * VirusTotal v3 API with the free-tier in-process rate limiter.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { httpGet } from '../../../../../src/utils/http'

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
  const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
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
      error: 'Rate limit: 4 lookups/min on free tier. Wait a moment.',
    }
  }

  if (!vtRateLimit.allowDaily()) {
    setResponseStatus(event, 429)
    return {
      success: false,
      error: 'Daily quota reached: 500 lookups/day on free tier.',
    }
  }

  const { hash } = body
  if (!hash || !/^[a-fA-F0-9]{32,64}$/.test(String(hash))) {
    setResponseStatus(event, 400)
    return { success: false, error: 'A valid MD5, SHA1, or SHA256 hash is required' }
  }

  try {
    const vtResponse = await httpGet<Record<string, unknown>>(
      `https://www.virustotal.com/api/v3/files/${hash}`,
      {
        headers: { 'x-apikey': apiKey },
        timeout: 15000,
      },
    )

    if (vtResponse.status === 404) {
      return { success: true, found: false }
    }

    if (vtResponse.status !== 200) {
      console.error('VirusTotal API error:', `Status ${vtResponse.status}`)
      setResponseStatus(event, 502)
      return {
        success: false,
        error: 'VirusTotal request failed',
        message: `Status ${vtResponse.status}`,
      }
    }

    const vtData = vtResponse.data as Record<string, unknown> | undefined
    const attrs = (vtData?.data as Record<string, unknown> | undefined)
      ?.attributes as Record<string, unknown> | undefined
    if (!attrs) {
      return { success: true, found: false }
    }

    const stats = (attrs.last_analysis_stats || {}) as Record<string, number>
    const total = Object.values(stats).reduce((a, b) => a + b, 0)
    const malicious = (stats.malicious || 0) + (stats.suspicious || 0)

    return {
      success: true,
      found: true,
      hash,
      malicious,
      total,
      name: String(attrs.meaningful_name || attrs.name || null),
      type: String(attrs.type_description || null),
      size: attrs.size || null,
      firstSeen: attrs.first_submission_date
        ? new Date(Number(attrs.first_submission_date) * 1000).toISOString().split('T')[0]
        : null,
      vtLink: `https://www.virustotal.com/gui/file/${hash}`,
    }
  } catch (err: unknown) {
    console.error('VirusTotal API error:', err instanceof Error ? err.message : err)
    setResponseStatus(event, 502)
    return {
      success: false,
      error: 'VirusTotal request failed',
      message: 'VirusTotal scan failed',
    }
  }
})
