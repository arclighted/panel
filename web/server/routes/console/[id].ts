/**
 * /console/:id — Nitro (crossws) twin of Express router.ws('/console/:id')
 * in src/modules/user/serverConsole.ts. Interactive terminal proxy:
 * browser → panel → daemon /container/:id. Binary frames preserved.
 */
import { defineConsoleSocket, wsScheme } from '../../utils/console-proxy'

export default defineConsoleSocket(
  async (addr, port, id) =>
    `${await wsScheme()}://${addr}:${port}/container/${id}`,
  'interactive',
  'console',
)
