/**
 * POST /admin/settings/reset — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): resets appearance
 * fields to defaults and restores the stock favicon.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import path from 'path'
import fs from 'fs'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, saveSettings } from '../../../utils/admin-api'

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

  try {
    await saveSettings({
      title: 'Arclight',
      logo: '../assets/logo.png',
      favicon: '../assets/favicon.ico',
      lightTheme: 'default',
      darkTheme: 'default',
      language: 'en',
      allowRegistration: false,
      loginWallpaper: null,
      registerWallpaper: null,
      panelWallpaper: null,
    })
    const defaultFavicon = path.join(process.cwd(), 'public', 'assets', 'favicon.ico')
    const dest = path.join(process.cwd(), 'public', 'favicon.ico')
    if (fs.existsSync(defaultFavicon)) {
      fs.copyFileSync(defaultFavicon, dest)
    }
    return { success: true }
  } catch (error) {
    console.error('Error resetting settings:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to reset settings.' }
  }
})
