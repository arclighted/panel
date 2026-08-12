/**
 * /events/:id — Nitro (crossws) twin of Express router.ws('/events/:id')
 * in src/modules/user/serverConsole.ts. Read-only mirror of the daemon's
 * /containerevents/:id push stream (lifecycle events).
 */
import { defineConsoleSocket, wsScheme } from '../../utils/console-proxy'

export default defineConsoleSocket(
  async (addr, port, id) =>
    `${await wsScheme()}://${addr}:${port}/containerevents/${id}`,
  'readonly',
  null,
)
