/**
 * GET /user/server — legacy EJS index (pre-TanStack). The migrated app lives
 * at /server/:uuid; redirect bookmarks to the dashboard.
 */
import { defineEventHandler, sendRedirect } from 'h3'

export default defineEventHandler((event) => {
  return sendRedirect(event, '/', 302)
})
