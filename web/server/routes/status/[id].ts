/**
 * /status/:id — Nitro (crossws) twin of Express router.ws('/status/:id')
 * in src/modules/user/serverConsole.ts. Read-only mirror of the daemon's
 * /containerstatus/:id stream (no command forwarding).
 */
import { defineConsoleSocket, wsScheme } from '../../utils/console-proxy'

export default defineConsoleSocket(
  async (addr, port, id) =>
    `${await wsScheme()}://${addr}:${port}/containerstatus/${id}`,
  'readonly',
  null,
)
