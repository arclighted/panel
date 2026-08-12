/**
 * GET /api/system/status — Nitro twin of the Express handler in
 * src/modules/core/index.ts (admin-only). Byte-identical payload: host OS
 * stats, per-node status (via the real checkNodeStatus helper, which needs
 * no Express state), and server/user/node counts.
 */
import os from 'node:os'
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireAdmin } from '../../../utils/auth'
import { checkNodeStatus } from '../../../../../src/handlers/utils/node/nodeStatus'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const auth = await requireAdmin(event, session)
  if (!auth.ok) {
    return auth.response
  }

  try {
    const systemInfo = {
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      memory: {
        total:
          Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 100) / 100,
        free: Math.round((os.freemem() / (1024 * 1024 * 1024)) * 100) / 100,
      },
      uptime: Math.floor(os.uptime() / 60),
    }

    const nodes = await nitroPrisma.node.findMany()
    const nodeStatuses = await Promise.all(
      nodes.map(async (node) => {
        try {
          const nodeWithStatus = await checkNodeStatus(node)
          return nodeWithStatus
        } catch (error) {
          console.error(`Error checking node status for ${node.name}:`, error)
          return { ...node, status: 'Error', error: 'Failed to check status' }
        }
      }),
    )

    const serverCount = await nitroPrisma.server.count()
    const userCount = await nitroPrisma.users.count()

    return {
      system: systemInfo,
      nodes: nodeStatuses,
      stats: {
        servers: serverCount,
        users: userCount,
        nodes: nodes.length,
      },
    }
  } catch (error) {
    console.error('Error fetching system status:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to fetch system status' }
  }
})
