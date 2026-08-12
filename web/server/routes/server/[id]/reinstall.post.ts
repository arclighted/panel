/**
 * POST /server/:id/reinstall — Nitro twin of the Express handler in
 * src/modules/user/server/console.ts. Byte-identical (D3): marks the server
 * Installing/Queued, enqueues the reinstall on the queueer, and returns the
 * same 200 { success, message } immediately.
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { requireServerAccess } from '../../../utils/auth'
import { requireTabPermission } from '../../../utils/server-tabs'
import { logActivity } from '../../../utils/server-api'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { getPrimaryExternalPort } from '../../../../../src/handlers/utils/server/ports'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = (await readBody(event).catch(() => ({}))) as {
    preserveData?: unknown
  }
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  const serverId = getRouterParam(event, 'id') ?? ''
  // preserveData defaults to true: plain "reinstall" keeps the server's data
  // (worlds, configs, files). Only an explicit wipe request removes the volume.
  const preserveData = body?.preserveData !== false

  const access = await requireServerAccess(event, session, serverId)
  if (!access.ok) {
    return access.response
  }
  const { subUser } = access.value
  const gate = requireTabPermission(event, subUser, 'settings.reinstall')
  if (!gate.ok) {
    return gate.response
  }
  const userId = (session as { user?: { id?: number } }).user?.id

  try {
    const user = await nitroPrisma.users.findUnique({ where: { id: userId } })
    if (!user) {
      setResponseStatus(event, 404)
      return { error: 'User not found' }
    }

    const server = await nitroPrisma.server.findUnique({
      where: { UUID: serverId },
      include: { node: true, image: true },
    })
    if (!server) {
      setResponseStatus(event, 404)
      return { error: 'Server not found' }
    }

    await nitroPrisma.server.update({
      where: { UUID: serverId },
      data: {
        Installing: true,
        Queued: true,
      },
    })

    // Simple in-process serial queue (mirror of src/handlers/queueer.ts) so
    // the Nitro-owned reinstall does not need to reach the Express process.
    queueTask(async () => {
      try {
        const serverToReinstall = await nitroPrisma.server.findUnique({
          where: { UUID: serverId },
          include: { image: true, node: true },
        })
        if (!serverToReinstall) {
          console.error('Server not found for reinstallation:', serverId)
          return
        }

        interface ReinstallVariable {
          env?: string
          name?: string
          value?: string | number | boolean
          type?: 'boolean' | 'number' | 'text'
        }
        let serverEnv: ReinstallVariable[] = []
        if (serverToReinstall.Variables) {
          try {
            serverEnv = JSON.parse(serverToReinstall.Variables) as ReinstallVariable[]
            const primaryPort = getPrimaryExternalPort(serverToReinstall.Ports)
            if (primaryPort) {
              serverEnv.push({
                env: 'SERVER_PORT',
                name: 'Primary Port',
                value: primaryPort,
                type: 'text',
              })
            }
          } catch (error) {
            console.error(
              `Error parsing Variables for server ID ${serverToReinstall.id}:`,
              error,
            )
          }
        }

        const env = serverEnv.reduce(
          (acc: Record<string, string | number | boolean>, curr: ReinstallVariable) => {
            if (curr.env && curr.value !== undefined && curr.value !== null) {
              let processedValue: string | number | boolean
              switch (curr.type) {
              case 'boolean':
                processedValue =
                    curr.value === 1 ||
                    curr.value === '1' ||
                    curr.value === true
                      ? 'true'
                      : 'false'
                break
              case 'number':
                processedValue = Number(curr.value)
                break
              case 'text':
              default:
                processedValue = String(curr.value)
                break
              }
              acc[curr.env] = processedValue
            }
            return acc
          },
          {},
        )

        if (serverToReinstall.image?.scripts) {
          try {
            const scripts = JSON.parse(serverToReinstall.image.scripts)
            let reinstallDockerImage: string | undefined
            try {
              const parsed = JSON.parse(serverToReinstall.dockerImage || '{}')
              reinstallDockerImage = Object.values(parsed)[0] as string | undefined
            } catch {
              /* leave undefined */
            }

            const installResponse = await daemonRequest<{ status?: number }>({
              method: 'POST',
              path: '/container/reinstall',
              nodeAddress: serverToReinstall.node.address,
              nodePort: serverToReinstall.node.port,
              nodeKey: serverToReinstall.node.key,
              body: {
                id: serverToReinstall.UUID,
                image: reinstallDockerImage,
                env,
                preserveData,
                scripts: scripts.install.map(
                  (script: {
                    url: string
                    fileName: string
                    onStart: boolean
                    ALVKT: boolean
                  }) => ({
                    url: script.url,
                    onStartup: script.onStart,
                    ALVKT: script.ALVKT,
                    fileName: script.fileName,
                  }),
                ),
              },
            })
            console.info(
              `Installation scripts sent for server ${serverId}. Response status: ${installResponse.status}`,
            )
            await nitroPrisma.server.update({
              where: { UUID: serverId },
              data: { Queued: false },
            })
          } catch (error: unknown) {
            console.error(`Error during reinstallation of server ${serverId}:`, error)
            const err = error && typeof error === 'object'
              ? (error as Record<string, unknown>)
              : {}
            if (err.status) {
              console.error(`Response status: ${err.status}`)
              console.error('Response data:', err.body)
            }
            await nitroPrisma.server.update({
              where: { UUID: serverId },
              data: { Queued: false, Installing: false },
            })
          }
        } else {
          await nitroPrisma.server.update({
            where: { UUID: serverId },
            data: { Queued: false, Installing: false },
          })
        }
      } catch (error) {
        console.error(`Error in reinstallation queue for server ${serverId}:`, error)
        await nitroPrisma.server
          .update({
            where: { UUID: serverId },
            data: { Queued: false, Installing: false },
          })
          .catch((e) => console.error('Error updating server queue status:', e))
      }
    })

    setResponseStatus(event, 200)
    // Express logs the reinstall activity fire-and-forget after the response.
    void logActivity(event, session, 'server:reinstall', { serverId: String(serverId) })
    return {
      success: true,
      message: 'Server reinstallation initiated',
    }
  } catch (error) {
    console.error('Error reinstalling server:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to reinstall server' }
  }
})

// ── In-process serial task queue (mirror of src/handlers/queueer.ts) ────────
const taskQueue: (() => Promise<void>)[] = []
let processingQueue = false

function queueTask(task: () => Promise<void>): void {
  taskQueue.push(task)
  if (!processingQueue) {
    void processTaskQueue()
  }
}

async function processTaskQueue(): Promise<void> {
  if (taskQueue.length === 0) {
    processingQueue = false
    return
  }
  processingQueue = true
  const task = taskQueue.shift()
  try {
    if (task) {
      await task()
    }
  } catch (error) {
    console.error('Error processing queue task:', error)
  } finally {
    await processTaskQueue()
  }
}
