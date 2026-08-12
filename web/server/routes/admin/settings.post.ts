/**
 * POST /admin/settings — Nitro twin of the Express appearance handler in
 * src/modules/admin/settings.ts (logo / favicon / theme zip / wallpapers).
 * h3 readMultipartFormData replaces multer diskStorage; uploaded files land
 * in public/uploads/<subdir> with the same naming scheme. The React settings
 * page doesn't call this endpoint today, but the seam claims /admin/settings
 * so the route must exist to keep the surface total.
 */
import { defineEventHandler, readMultipartFormData, setResponseStatus, type H3Event } from 'h3'
import path from 'path'
import fs from 'fs'
import { randomUUID } from 'crypto'
import AdmZip from 'adm-zip'
import { loadSession, requireCsrf, type SessionPayload } from '../../utils/auth-session'
import { requireAdminGuard, saveSettings, resolveWallpaperValue } from '../../utils/admin-api'

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024
const MIME_TYPE_ALLOWLIST = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
] as const

function installThemeZip(zipBuffer: Buffer): { success: boolean; error?: string } {
  const themesDir = path.join(process.cwd(), 'public', 'themes', 'user')
  const tempDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'theme-zips',
    `tmp-${Date.now()}`,
  )
  try {
    fs.mkdirSync(tempDir, { recursive: true })
    const zip = new AdmZip(zipBuffer)
    zip.extractAllTo(tempDir, true)
    const infoPath = path.join(tempDir, 'info.json')
    const lightPath = path.join(tempDir, 'light.css')
    const darkPath = path.join(tempDir, 'dark.css')
    if (!fs.existsSync(infoPath)) return { success: false, error: 'Theme zip must contain info.json.' }
    if (!fs.existsSync(lightPath)) return { success: false, error: 'Theme zip must contain light.css.' }
    if (!fs.existsSync(darkPath)) return { success: false, error: 'Theme zip must contain dark.css.' }
    JSON.parse(fs.readFileSync(infoPath, 'utf-8'))
    const themeId = randomUUID()
    const themeDir = path.join(themesDir, themeId)
    fs.mkdirSync(themeDir, { recursive: true })
    fs.copyFileSync(infoPath, path.join(themeDir, 'info.json'))
    fs.copyFileSync(lightPath, path.join(themeDir, 'light.css'))
    fs.copyFileSync(darkPath, path.join(themeDir, 'dark.css'))
    return { success: true }
  } catch (err: unknown) {
    if (err instanceof SyntaxError) {
      return { success: false, error: 'info.json contains invalid JSON.' }
    }
    const errMsg = err instanceof Error ? err.message : ''
    if (errMsg.startsWith('Theme zip')) return { success: false, error: errMsg }
    return { success: false, error: 'Failed to extract theme zip.' }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

export default defineEventHandler(async (event: H3Event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))

  const parts = await readMultipartFormData(event).catch(() => [])
  if (!parts || parts.length === 0) {
    setResponseStatus(event, 400)
    return { success: false, error: 'Expected a multipart form.' }
  }

  const fields = new Map<string, string>()
  const files = new Map<string, { data: Uint8Array; filename?: string; type?: string }>()
  for (const p of parts) {
    if (!p.name) continue
    if (p.filename) {
      files.set(p.name, { data: p.data, filename: p.filename, type: p.type })
    } else {
      fields.set(p.name, Buffer.from(p.data).toString('utf8'))
    }
  }

  if (!requireCsrf(event, session)) {
    setResponseStatus(event, 403)
    return { success: false, error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const themeFile = files.get('themeFile')
    if (themeFile) {
      if (
        themeFile.data.byteLength > MAX_UPLOAD_SIZE_BYTES ||
        !themeFile.filename?.toLowerCase().endsWith('.zip')
      ) {
        setResponseStatus(event, 400)
        return { success: false, error: 'Theme must be a .zip under 10 MB.' }
      }
      const result = installThemeZip(Buffer.from(themeFile.data))
      if (!result.success) {
        setResponseStatus(event, 400)
        return { success: false, error: result.error }
      }
    }

    const data: Record<string, unknown> = {}
    const raw = (name: string): string | undefined => fields.get(name)

    const title = raw('title')
    if (typeof title === 'string') data.title = title
    const allowReg = raw('allowRegistration')
    if (typeof allowReg !== 'undefined') {
      data.allowRegistration = allowReg === 'true'
    }
    const lightTheme = raw('lightTheme')
    if (typeof lightTheme === 'string') data.lightTheme = lightTheme
    const darkTheme = raw('darkTheme')
    if (typeof darkTheme === 'string') data.darkTheme = darkTheme
    const uploadLimit = raw('uploadLimit')
    if (uploadLimit) data.uploadLimit = parseInt(uploadLimit, 10) || 100
    const vtKey = raw('virusTotalApiKey')
    if (typeof vtKey === 'string') {
      data.virusTotalApiKey = vtKey.trim() || null
    }

    for (const [field, subdir] of [
      ['logo', 'logos'],
      ['favicon', 'favicons'],
    ] as const) {
      const f = files.get(field)
      if (f) {
        const mimeOk = (MIME_TYPE_ALLOWLIST as readonly string[]).includes(
          f.type ?? '',
        )
        if (!mimeOk) {
          setResponseStatus(event, 400)
          return { success: false, error: `Unsupported ${field} file type.` }
        }
        const ext = path.extname(f.filename ?? '')
        const filename =
          field === 'favicon' ? `favicon${ext}` : `${field}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', subdir)
        fs.mkdirSync(uploadDir, { recursive: true })
        fs.writeFileSync(path.join(uploadDir, filename), f.data)
        data[field] = `/uploads/${subdir}/${filename}`
        if (field === 'favicon') {
          fs.copyFileSync(
            path.join(uploadDir, filename),
            path.join(process.cwd(), 'public', 'favicon.ico'),
          )
        }
      }
    }

    // Wallpapers: uploaded file > URL input > no change
    for (const [fileField, urlField, key] of [
      ['loginWallpaperFile', 'loginWallpaperUrl', 'loginWallpaper'],
      ['registerWallpaperFile', 'registerWallpaperUrl', 'registerWallpaper'],
      ['panelWallpaperFile', 'panelWallpaperUrl', 'panelWallpaper'],
    ] as const) {
      const f = files.get(fileField)
      if (f) {
        const ext = path.extname(f.filename ?? '')
        const filename = `wallpaper-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'wallpapers')
        fs.mkdirSync(uploadDir, { recursive: true })
        fs.writeFileSync(path.join(uploadDir, filename), f.data)
        data[key] = `/uploads/wallpapers/${filename}`
      } else {
        const urlValue = raw(urlField)
        if (typeof urlValue === 'string') {
          const resolved = resolveWallpaperValue(urlValue)
          if (resolved !== undefined) data[key] = resolved
        }
      }
    }

    if (Object.keys(data).length > 0) {
      await saveSettings(data)
    }
    return { success: true, panelWallpaper: data.panelWallpaper ?? null }
  } catch (error) {
    console.error('Error saving appearance settings:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to save settings.' }
  }
})
