/**
 * GET /api/account/context — Nitro twin of the Express handler in
 * src/modules/user/account.ts (additive JSON for the React account page).
 * Byte-identical payload (D3): profile, login history, preferred-node list,
 * image submissions and the submission-permission flag, all computed from the
 * shared SQLite store.
 */
import { defineEventHandler, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireAuthenticated } from '../../../utils/auth'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const auth = await requireAuthenticated(event, session)
  if (!auth.ok) {
    return auth.response
  }
  const user = auth.value

  try {
    const userId = user.id
    const [userRow, loginHistory, nodes, images] = await Promise.all([
      nitroPrisma.users.findUnique({ where: { id: userId } }),
      nitroPrisma.loginHistory.findMany({
        where: { userId },
        orderBy: { timestamp: 'desc' },
        take: 10,
      }),
      nitroPrisma.node.findMany({
        select: { id: true, name: true, address: true },
        orderBy: { id: 'asc' },
      }),
      nitroPrisma.images.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' },
      }),
    ])
    if (!userRow) {
      setResponseStatus(event, 404)
      return { error: 'User not found.' }
    }

    const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
    const allowed =
      userRow.isAdmin === true || settings?.allowUserCreateImages === true

    return {
      success: true,
      user: {
        id: userRow.id,
        username: userRow.username,
        email: userRow.email,
        avatar: userRow.avatar,
        description: userRow.description ?? '',
        isAdmin: userRow.isAdmin === true,
        createdAt: userRow.createdAt,
        preferredNodeId: userRow.preferredNodeId ?? null,
        totpEnabled: userRow.totpEnabled === true,
      },
      loginHistory: loginHistory.map((h) => ({
        id: h.id,
        timestamp: h.timestamp,
        ipAddress: h.ipAddress,
        userAgent: h.userAgent,
      })),
      nodes: nodes.map((n) => ({
        id: n.id,
        name: n.name,
        address: n.address,
      })),
      images: images.map((img) => ({
        id: img.id,
        name: img.name,
        status: img.status,
        createdAt: img.createdAt,
        rejectionReason: img.rejectionReason,
      })),
      allowed,
      settings: {
        allowUserCreateImages: settings?.allowUserCreateImages === true,
      },
    }
  } catch (error) {
    console.error('Error fetching account context:', error)
    setResponseStatus(event, 500)
    return { error: 'Error fetching account data.' }
  }
})
