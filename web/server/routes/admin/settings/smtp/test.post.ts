/**
 * POST /admin/settings/smtp/test — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): verifies the stored
 * SMTP transport with nodemailer.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import nodemailer from 'nodemailer'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'

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
    const smtp = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    if (!smtp?.smtpHost) {
      setResponseStatus(event, 400)
      return { success: false, error: 'SMTP is not configured yet.' }
    }
    const transporter = nodemailer.createTransport({
      host: smtp.smtpHost,
      port: smtp.smtpPort ?? 587,
      secure: smtp.smtpSecure,
      auth: { user: smtp.smtpUser ?? '', pass: smtp.smtpPassword ?? '' },
    })
    await transporter.verify()
    return { success: true, message: 'SMTP connection verified.' }
  } catch (error) {
    console.error('SMTP test failed:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'SMTP connection failed.' }
  }
})
