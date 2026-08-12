/**
 * POST /admin/servers/create — Nitro twin of the Express handler in
 * src/modules/admin/servers.ts. Byte-identical (D3): validates fields,
 * ports (node pool, image requirements), node capacity, merges variables,
 * creates the server under the per-node port lock, queues the install.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../utils/auth-session'
import { requireAdminGuard } from '../../../utils/admin-api'
import { logActivity } from '../../../utils/server-api'
import { queueer } from '../../../../../src/handlers/queueer'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { assertNodeCapacity } from '../../../../../src/handlers/utils/server/resourceCheck'
import {
  claimNodePorts,
  getNodePortPool,
  withNodePortLock,
} from '../../../../../src/handlers/utils/server/allocations'
import {
  getPrimaryExternalPort,
  getUsedExternalPorts,
  normalizeServerPorts,
  parseImagePortRequirements,
  parseServerPorts,
  serializeServerPorts,
  validatePortAssignments,
} from '../../../../../src/handlers/utils/server/ports'
import { emitRealtime, serverEvent } from '../../../../../src/handlers/realtime/events'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  const {
    name,
    description,
    nodeId,
    imageId,
    Ports,
    ports,
    Memory,
    Swap,
    Cpu,
    Storage,
    dockerImage,
    variables,
    ownerId,
    databaseLimit,
    allowStartupEdit,
  } = body as Record<string, unknown>

  const userId = parseInt(String(ownerId), 10)
  if (
    !name ||
    !description ||
    !nodeId ||
    !imageId ||
    (!Ports && !ports) ||
    !Memory ||
    !Cpu ||
    !Storage ||
    !userId
  ) {
    setResponseStatus(event, 400)
    return { error: 'Missing required fields' }
  }

  const memInt = parseInt(String(Memory), 10)
  const cpuInt = parseInt(String(Cpu), 10)
  const storageInt = parseInt(String(Storage), 10)
  const swapInt =
    Swap !== undefined && Swap !== ''
      ? Math.max(0, parseInt(String(Swap), 10) || 0)
      : 0
  if (
    isNaN(memInt) ||
    memInt <= 0 ||
    isNaN(cpuInt) ||
    cpuInt <= 0 ||
    isNaN(storageInt) ||
    storageInt <= 0
  ) {
    setResponseStatus(event, 400)
    return { error: 'Memory, CPU, and Storage must be positive integers.' }
  }

  const owner = await nitroPrisma.users.findUnique({ where: { id: userId } })
  if (!owner) {
    setResponseStatus(event, 400)
    return { error: 'Owner not found' }
  }

  let minPorts = 0
  try {
    const node = await nitroPrisma.node.findUnique({
      where: { id: parseInt(String(nodeId), 10) },
    })
    if (!node) {
      setResponseStatus(event, 400)
      return { error: 'Selected node not found' }
    }
    if (node.maintenanceMode) {
      setResponseStatus(event, 400)
      return {
        error: 'Cannot create a server on a node under maintenance',
      }
    }

    const pool = await getNodePortPool(parseInt(String(nodeId), 10))
    const existingServers = await nitroPrisma.server.findMany({
      where: { nodeId: parseInt(String(nodeId), 10) },
    })
    const image = await nitroPrisma.images.findUnique({
      where: { id: parseInt(String(imageId), 10) },
    })
    if (!image) {
      setResponseStatus(event, 400)
      return { error: 'Image not found' }
    }

    const submittedPorts = ports
      ? normalizeServerPorts(ports)
      : parseServerPorts(`[{"Port":"${Ports}","primary":true}]`)
    minPorts = parseImagePortRequirements(image.portRequirements).length
    const portError = validatePortAssignments(
      submittedPorts,
      pool,
      getUsedExternalPorts(existingServers),
      minPorts,
    )
    if (portError) {
      setResponseStatus(event, 400)
      return { error: portError }
    }

    await assertNodeCapacity(
      node,
      parseInt(String(Memory), 10) || 1024,
      parseInt(String(Cpu), 10) || 100,
      parseInt(String(Storage), 10) || 20480,
    )
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Error validating port allocation'
    console.error('Error validating server resources:', error)
    setResponseStatus(event, 400)
    return { error: message }
  }

  const Port = serializeServerPorts(
    ports
      ? normalizeServerPorts(ports)
      : parseServerPorts(`[{"Port":"${Ports}","primary":true}]`),
  )

  try {
    const selectedImage = await nitroPrisma.images.findUnique({
      where: { id: parseInt(String(imageId), 10) },
    })
    if (!selectedImage) {
      setResponseStatus(event, 400)
      return { error: 'Image not found' }
    }

    const dockerImagesRaw = selectedImage.dockerImages
    if (!dockerImagesRaw) {
      setResponseStatus(event, 400)
      return { error: 'Docker image not found' }
    }

    const imagesDocker = JSON.parse(dockerImagesRaw) as Record<string, string>[]
    const imageDocker = imagesDocker.find((img) =>
      Object.keys(img).includes(String(dockerImage)),
    )
    if (!imageDocker) {
      setResponseStatus(event, 400)
      return { error: 'Docker image not found' }
    }

    const StartCommand = selectedImage.startup
    if (!StartCommand) {
      setResponseStatus(event, 400)
      return { error: 'Image startup command not found' }
    }

    let imageVariables: Record<string, unknown>[] = []
    try {
      imageVariables = JSON.parse(selectedImage.variables || '[]')
    } catch {
      imageVariables = []
    }

    const submittedVars = Array.isArray(variables) ? variables : []
    const mergedVariables = imageVariables.map(
      (imgVar: Record<string, unknown>) => {
        const envKey = String(imgVar.env_variable ?? imgVar.env ?? '')
        const submitted = submittedVars.find(
          (sv: Record<string, unknown>) =>
            String(sv.env_variable ?? sv.env ?? '') === envKey,
        )
        return { ...imgVar, value: submitted?.value ?? imgVar.default_value ?? '' }
      },
    )

    const submittedExternal = (
      ports
        ? normalizeServerPorts(ports)
        : parseServerPorts(`[{"Port":"${Ports}","primary":true}]`)
    ).map((p) => p.externalPort)

    let createdServer
    try {
      createdServer = await withNodePortLock(
        parseInt(String(nodeId), 10),
        async () => {
          const livePool = await getNodePortPool(parseInt(String(nodeId), 10))
          const liveServers = await nitroPrisma.server.findMany({
            where: { nodeId: parseInt(String(nodeId), 10) },
          })
          const recheck = validatePortAssignments(
            ports
              ? normalizeServerPorts(ports)
              : parseServerPorts(`[{"Port":"${Ports}","primary":true}]`),
            livePool,
            getUsedExternalPorts(liveServers),
            minPorts,
          )
          if (recheck) throw new Error(recheck)

          const created = await nitroPrisma.server.create({
            data: {
              name: String(name),
              description: String(description),
              ownerId: userId,
              nodeId: parseInt(String(nodeId), 10),
              imageId: parseInt(String(imageId), 10),
              Ports: Port || '[{"Port": "25565:25565", "primary": true}]',
              Memory: memInt,
              Swap: swapInt,
              Cpu: cpuInt,
              databaseLimit:
                databaseLimit !== undefined && databaseLimit !== ''
                  ? Math.max(0, parseInt(String(databaseLimit), 10) || 0)
                  : 5,
              Storage: storageInt,
              Variables: JSON.stringify(mergedVariables),
              StartCommand,
              dockerImage: JSON.stringify(imageDocker),
            },
          })

          await nitroPrisma.$executeRaw`UPDATE "Server" SET "allowStartupEdit" = ${allowStartupEdit === 'true'} WHERE "id" = ${created.id}`
          await claimNodePorts(
            parseInt(String(nodeId), 10),
            submittedExternal,
            created.UUID,
          ).catch((err: unknown) => {
            console.warn(
              `Failed to claim ports for server ${created.UUID}: ${
                err instanceof Error ? err.message : err
              }`,
            )
          })
          return created
        },
      )
    } catch (error: unknown) {
      console.error('Error creating server:', error)
      setResponseStatus(event, 400)
      return {
        error:
          error instanceof Error ? error.message : 'Failed to create server.',
      }
    }

    queueer.addTask(async () => {
      const servers = await nitroPrisma.server.findMany({
        where: { Queued: true },
        include: { image: true, node: true },
      })

      for (const server of servers) {
        emitRealtime(
          serverEvent('server.install.started', server.UUID, {
            operationId: server.UUID,
            state: { queued: true, installing: true },
          }),
        )
        if (!server.Variables) {
          await nitroPrisma.server.update({
            where: { id: server.id },
            data: { Queued: false },
          })
          continue
        }

        let ServerEnv: { env: string; value: unknown }[]
        try {
          const parsed: unknown[] = JSON.parse(server.Variables)
          ServerEnv = (parsed as Record<string, unknown>[]).map((v) => ({
            env: String(v.env_variable ?? v.env ?? ''),
            value: v.value ?? v.default_value ?? '',
          }))

          let serverPort = String(
            parseServerPorts(Port)[0]?.externalPort ?? '',
          )
          const primaryExternalPort = getPrimaryExternalPort(server.Ports)
          if (primaryExternalPort) serverPort = String(primaryExternalPort)
          ServerEnv.push({ env: 'SERVER_PORT', value: serverPort })
          ServerEnv.push({ env: 'SERVER_MEMORY', value: String(server.Memory) })
          ServerEnv.push({ env: 'SERVER_CPU', value: String(server.Cpu) })
        } catch (error: unknown) {
          console.error(
            `Error parsing Variables for server ID ${server.id}:`,
            error,
          )
          await nitroPrisma.server.update({
            where: { id: server.id },
            data: { Queued: false },
          })
          continue
        }

        if (!Array.isArray(ServerEnv)) {
          await nitroPrisma.server.update({
            where: { id: server.id },
            data: { Queued: false },
          })
          continue
        }

        const env = ServerEnv.reduce(
          (acc: Record<string, unknown>, curr: { env: string; value: unknown }) => {
            acc[curr.env] = curr.value
            return acc
          },
          {},
        )

        if (server.image?.scripts) {
          let scripts: Record<string, unknown>
          try {
            scripts = JSON.parse(server.image.scripts)
          } catch (error: unknown) {
            console.error(
              `Error parsing scripts for server ID ${server.id}:`,
              error,
            )
            await nitroPrisma.server.update({
              where: { id: server.id },
              data: { Queued: false },
            })
            continue
          }

          try {
            if (
              scripts.installation &&
              typeof scripts.installation === 'object'
            ) {
              const installation = scripts.installation as Record<string, string>
              await daemonRequest({
                nodeAddress: server.node.address,
                nodePort: server.node.port,
                nodeKey: server.node.key,
                method: 'POST',
                path: '/container/installer',
                body: {
                  id: server.UUID,
                  script: installation.script,
                  container: installation.container,
                  entrypoint: installation.entrypoint || 'bash',
                  env,
                },
                timeout: 600000,
              })
            } else if (Array.isArray(scripts.install)) {
              let dockerImageValue: string | undefined
              try {
                const parsed = JSON.parse(server.dockerImage || '{}')
                dockerImageValue = Object.values(parsed)[0] as string | undefined
              } catch { /* leave undefined */ }

              await daemonRequest({
                nodeAddress: server.node.address,
                nodePort: server.node.port,
                nodeKey: server.node.key,
                method: 'POST',
                path: '/container/install',
                body: {
                  id: server.UUID,
                  image: dockerImageValue,
                  env,
                  scripts: (scripts.install as Record<string, unknown>[]).map(
                    (s) => ({
                      url: s.url,
                      onStartup: s.onStart,
                      ALVKT: s.ALVKT,
                      fileName: s.fileName,
                    }),
                  ),
                },
              })

              if (scripts.native && typeof scripts.native === 'object') {
                const native = scripts.native as Record<string, string>
                await daemonRequest({
                  nodeAddress: server.node.address,
                  nodePort: server.node.port,
                  nodeKey: server.node.key,
                  method: 'POST',
                  path: '/container/installer',
                  body: {
                    id: server.UUID,
                    env,
                    script: native.CMD,
                    container: native.container,
                    entrypoint: 'bash',
                  },
                  timeout: 600000,
                })
              }
            } else {
              console.info(
                `No install scripts for server ${server.id}, marking as installed`,
              )
            }

            await nitroPrisma.server.update({
              where: { id: server.id },
              data: { Queued: false },
            })
            emitRealtime(
              serverEvent('server.install.completed', server.UUID, {
                operationId: server.UUID,
                state: { installing: false, queued: false },
              }),
            )
          } catch (error: unknown) {
            console.error(
              `Error sending install request for server ID ${server.id}:`,
              error,
            )
            await nitroPrisma.server.update({
              where: { id: server.id },
              data: { Queued: false },
            })
            emitRealtime(
              serverEvent('server.install.failed', server.UUID, {
                operationId: server.UUID,
                error: {
                  message:
                    error instanceof Error ? error.message : 'Install dispatch failed',
                },
              }),
            )
          }
        } else {
          console.warn(
            `No scripts found for server ID ${server.id}, marking as installed`,
          )
          await nitroPrisma.server.update({
            where: { id: server.id },
            data: { Queued: false },
          })
        }
      }
    })

    await logActivity(event, session, 'server:create', {
      serverId: String(createdServer.UUID),
      metadata: { name: String(name), nodeId: createdServer.nodeId },
    })
    emitRealtime(
      serverEvent('server.created', createdServer.UUID, {
        state: { id: createdServer.id, name: String(name), UUID: createdServer.UUID },
      }),
    )
    emitRealtime({
      type: 'admin.servers.updated',
      scope: { admin: true },
      state: {},
    })

    return { success: true, message: 'Server created successfully' }
  } catch (error) {
    console.error('Error creating server:', error)
    setResponseStatus(event, 500)
    return { error: 'Error creating server' }
  }
})
