/**
 * POST /admin/addons/store/uninstall — Nitro twin of the Express stub in
 * src/modules/admin/addons.ts (store is coming soon → 410).
 */
import { defineEventHandler, setResponseStatus } from 'h3'

export default defineEventHandler((event) => {
  setResponseStatus(event, 410)
  return { success: false, message: 'Addon store is not available yet.' }
})
