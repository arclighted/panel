/**
 * POST /admin/node/:id/verify — Nitro twin of the Express handler in
 * src/modules/admin/nodes.ts. Byte-identical (D3): pings the daemon root
 * endpoint and reports connection health with friendly offline errors.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'
import { daemonRequest } from '../../../../../../src/handlers/utils/core/daemonRequest'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const nodeId = parseInt(getRouterParam(event, 'id') ?? '', 10)
  const node = await nitroPrisma.node.findUnique({ where: { id: nodeId } })
  if (!node) {
    setResponseStatus(event, 404)
    return { message: 'Node not found.' }
  }

  try {
    const result = await daemonRequest<{
      status?: string
      versionRelease?: string
      remote?: string
      error?: string
    }>({
      nodeAddress: node.address,
      nodePort: node.port,
      nodeKey: node.key,
      method: 'GET',
      path: '/',
      timeout: 10000,
    })

    return {
      connected: result.status === 200,
      status: result.data?.status || null,
      version: result.data?.versionRelease || null,
      remote: result.data?.remote ?? null,
      error: result.data?.error ?? null,
    }
  } catch (error: unknown) {
    const errObj = error as Record<string, unknown> | undefined
    const cause = String(
      (errObj?.cause as Record<string, unknown>)?.code ||
        errObj?.code ||
        errObj?.message ||
        '',
    )
    const friendly = cause.includes('ECONNREFUSED')
      ? 'No daemon is listening on that address and port yet. Start the daemon, then try again.'
      : cause.includes('ENOTFOUND') || cause.includes('EAI_AGAIN')
        ? 'That address does not resolve. Check the hostname or IP you entered.'
        : cause.includes('timed out')
          ? 'The daemon did not answer in time. Check the address, port, and firewall.'
          : 'Could not reach the daemon. Check the address, port, and firewall.'
    return { connected: false, error: friendly }
  }
})
