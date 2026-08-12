/**
 * PATCH /api/v1/settings — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey } from '../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.settings.update')
  if (!guard.ok) return guard.response

  try {
    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const { title, description, logo, favicon, theme, language } = body

    const currentSettings = await nitroPrisma.settings.findFirst()

    if (!currentSettings) {
      setResponseStatus(event, 404)
      return { error: 'Settings not found' }
    }

    const updatedSettings = await nitroPrisma.settings.update({
      where: { id: currentSettings.id },
      data: {
        title: title !== undefined ? String(title) : currentSettings.title,
        description:
          description !== undefined ? String(description) : currentSettings.description,
        logo: logo !== undefined ? String(logo) : currentSettings.logo,
        favicon: favicon !== undefined ? String(favicon) : currentSettings.favicon,
        theme: theme !== undefined ? String(theme) : currentSettings.theme,
        language: language !== undefined ? String(language) : currentSettings.language,
        updatedAt: new Date(),
      },
    })

    return { data: updatedSettings }
  } catch (error) {
    console.error('Error updating settings:', error)
    setResponseStatus(event, 500)
    return { error: 'Internal Server Error' }
  }
})
