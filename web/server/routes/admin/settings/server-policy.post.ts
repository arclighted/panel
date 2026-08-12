/**
 * POST /admin/settings/server-policy — Nitro twin of the Express handler in
 * src/modules/admin/settings.ts. Byte-identical (D3): validates the
 * server-policy numeric ranges then saves.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard, saveSettings } from '../../../utils/admin-api'

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
    const allowUserCreateServer = body.allowUserCreateServer === true || body.allowUserCreateServer === 'true'
    const allowUserDeleteServer = body.allowUserDeleteServer === true || body.allowUserDeleteServer === 'true'
    const allowUserCreateImages = body.allowUserCreateImages === true || body.allowUserCreateImages === 'true'
    const onboardingEnabled = body.onboardingEnabled === true || body.onboardingEnabled === 'true'
    const defaultServerLimit = parseInt(String(body.defaultServerLimit), 10)
    const defaultMaxMemory = parseInt(String(body.defaultMaxMemory), 10)
    const defaultMaxCpu = parseInt(String(body.defaultMaxCpu), 10)
    const defaultMaxStorage = parseInt(String(body.defaultMaxStorage), 10)
    const defaultMaxDatabases = parseInt(String(body.defaultMaxDatabases), 10)
    const defaultOverallocateMemory = parseInt(String(body.defaultOverallocateMemory), 10)
    const defaultOverallocateDisk = parseInt(String(body.defaultOverallocateDisk), 10)
    const defaultOverallocateCpu = parseInt(String(body.defaultOverallocateCpu), 10)

    if (isNaN(defaultServerLimit) || defaultServerLimit < 0) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Server limit must be 0 or greater.' }
    }
    if (isNaN(defaultMaxMemory) || defaultMaxMemory < 128) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Max memory must be at least 128 MB.' }
    }
    if (isNaN(defaultMaxCpu) || defaultMaxCpu < 10) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Max CPU must be at least 10%.' }
    }
    if (isNaN(defaultMaxStorage) || defaultMaxStorage < 128) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Max storage must be at least 128 MB.' }
    }
    if (isNaN(defaultMaxDatabases) || defaultMaxDatabases < 0) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Default max databases must be 0 or greater.' }
    }
    if (
      [defaultOverallocateMemory, defaultOverallocateDisk, defaultOverallocateCpu].some(
        (v) => isNaN(v) || v < 0 || v > 10000,
      )
    ) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Overallocation defaults must be between 0 and 10000%.' }
    }

    const serverPolicyData: Record<string, unknown> = {
      allowUserCreateServer,
      allowUserDeleteServer,
      allowUserCreateImages,
      onboardingEnabled,
      defaultServerLimit,
      defaultMaxMemory,
      defaultMaxCpu,
      defaultMaxStorage,
      defaultMaxDatabases,
      defaultOverallocateMemory,
      defaultOverallocateDisk,
      defaultOverallocateCpu,
    }
    if (body.uploadLimit) {
      serverPolicyData.uploadLimit = parseInt(String(body.uploadLimit), 10) || 100
    }
    await saveSettings(serverPolicyData)
    return { success: true }
  } catch (error) {
    console.error('Error saving server policy:', error)
    setResponseStatus(event, 500)
    return { success: false, error: 'Failed to save server policy.' }
  }
})
