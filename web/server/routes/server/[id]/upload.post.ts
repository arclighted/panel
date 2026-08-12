/**
 * POST /server/:id/upload — Nitro twin of the Express handler in
 * src/modules/user/server/files.ts. Byte-identical behavior (D3): parses the
 * multipart form (h3 readMultipartFormData replaces multer memoryStorage),
 * enforces the settings upload limit, and streams small files (≤10 MiB) in
 * one request or large files in 5 MiB chunks.
 */
import { defineEventHandler, getRouterParam, readMultipartFormData, setResponseStatus } from 'h3'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../../../utils/auth-session'
import { loadApiServer, logActivity } from '../../../utils/server-api'
import { daemonRequest } from '../../../../../src/handlers/utils/core/daemonRequest'
import { isPathSafe } from '../../../../../src/utils/pathSecurity'
import { daemonMessage } from '../../../../../src/utils/errors'

const CHUNK_SIZE = 5 * 1024 * 1024
const SMALL_FILE_LIMIT = 10 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  const serverId = getRouterParam(event, 'id') ?? ''

  // Express's global doubleCsrfProtection runs before this route — the token
  // travels in the CSRF-Token header (the multipart body carries no _csrf
  // field), so validate from the header before parsing the multipart body.
  if (!requireCsrf(event, session)) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }

  // The upload limit comes from settings (multer's fileSize limit in Express).
  const settings = await nitroPrisma.settings.findUnique({ where: { id: 1 } })
  const limitMb = settings?.uploadLimit ?? 100

  // Parse the multipart body once; CSRF is validated from the header (the
  // frontend sends CSRF-Token), so the body is only needed for field parsing.
  const parts = await readMultipartFormData(event).catch(() => [])
  const filePart = parts.find((p) => p.name === 'file')
  const pathPart = parts.find((p) => p.name === 'path')
  const fileNamePart = parts.find((p) => p.name === 'fileName')

  const pathValue = pathPart
    ? Buffer.from(pathPart.data).toString('utf8')
    : '/'
  const fileName =
    fileNamePart && fileNamePart.data
      ? Buffer.from(fileNamePart.data).toString('utf8')
      : filePart?.filename || ''

  if (
    typeof fileName !== 'string' ||
    !fileName.trim() ||
    fileName.includes('/') ||
    fileName.includes('\\') ||
    fileName.includes('..')
  ) {
    setResponseStatus(event, 400)
    return { error: 'Invalid file name.' }
  }

  if (
    typeof pathValue === 'string' &&
    !isPathSafe(pathValue) &&
    pathValue !== '/'
  ) {
    setResponseStatus(event, 400)
    return { error: 'Invalid path.' }
  }

  console.info(
    `Upload request received for file ${fileName} to path ${pathValue} for server ${serverId}`,
  )

  try {
    if (!filePart || !filePart.data) {
      console.warn('File content is required')
      setResponseStatus(event, 400)
      return { error: 'File content is required' }
    }
    if (filePart.data.byteLength > limitMb * 1024 * 1024) {
      setResponseStatus(event, 413)
      return { error: `File exceeds the ${limitMb} MB upload limit.` }
    }

    const ctx = await loadApiServer(event, session, serverId, 'files')
    if (!ctx.ok) {
      return ctx.response
    }
    const { server } = ctx.value

    const fileBuffer = Buffer.from(filePart.data)
    const mimetype = filePart.type || 'application/octet-stream'
    console.info(
      `Sending upload request to node at ${server.node.address}:${server.node.port}`,
    )
    console.info(`File size: ${fileBuffer.length} bytes`)

    if (fileBuffer.length < SMALL_FILE_LIMIT) {
      const fileContent = fileBuffer.toString('base64')
      const fileContentWithMeta = `data:${mimetype};base64,${fileContent}`

      const uploadResponse = await daemonRequest<{
        fileName?: string
        path?: string
      }>({
        method: 'POST',
        path: '/fs/upload',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        body: {
          id: server.UUID,
          path: pathValue,
          fileName,
          fileContent: fileContentWithMeta,
        },
        timeout: 60000,
      })
      console.info(`File ${fileName} successfully uploaded to ${pathValue}`)
      await logActivity(event, session, 'file:upload', {
        serverId: String(server.UUID),
        metadata: { path: pathValue, fileName, size: fileBuffer.length },
      })
      setResponseStatus(event, 200)
      return {
        success: true,
        fileName: uploadResponse.data?.fileName,
        path: uploadResponse.data?.path,
      }
    }

    await daemonRequest({
      method: 'POST',
      path: '/fs/create-empty-file',
      nodeAddress: server.node.address,
      nodePort: server.node.port,
      nodeKey: server.node.key,
      body: {
        id: server.UUID,
        path: pathValue,
        fileName,
      },
      timeout: 10000,
    })
    console.info(`Created empty file ${fileName} in ${pathValue}`)

    const totalChunks = Math.ceil(fileBuffer.length / CHUNK_SIZE)
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, fileBuffer.length)
      const chunk = fileBuffer.slice(start, end)
      const chunkContent = chunk.toString('base64')
      const chunkContentWithMeta = `data:${mimetype};base64,${chunkContent}`

      await daemonRequest({
        method: 'POST',
        path: '/fs/append-file',
        nodeAddress: server.node.address,
        nodePort: server.node.port,
        nodeKey: server.node.key,
        body: {
          id: server.UUID,
          path: pathValue,
          fileName,
          fileContent: chunkContentWithMeta,
          chunkIndex: i,
          totalChunks,
        },
        timeout: 30000,
      })
      console.info(`Uploaded chunk ${i + 1}/${totalChunks} for file ${fileName}`)
    }

    console.info(
      `File ${fileName} successfully uploaded to ${pathValue} in ${totalChunks} chunks`,
    )
    await logActivity(event, session, 'file:upload', {
      serverId: String(server.UUID),
      metadata: { path: pathValue, fileName, size: fileBuffer.length },
    })
    setResponseStatus(event, 200)
    return {
      success: true,
      fileName,
      path: pathValue,
    }
  } catch (error: unknown) {
    const err =
      error && typeof error === 'object'
        ? (error as Record<string, unknown>)
        : {}
    const errBody =
      err.body && typeof err.body === 'object'
        ? (err.body as Record<string, unknown>)
        : undefined
    if (err.status && errBody) {
      console.error(
        `Error uploading file - Status: ${err.status}, Data:`,
        errBody,
      )
      setResponseStatus(event, err.status as number)
      return { error: daemonMessage(errBody, 'Failed to upload file') }
    }
    if (err.message) {
      console.error('Error uploading file - No response received:', err.message)
      setResponseStatus(event, 500)
      return {
        error:
          'Connection error during file upload. Please try again with a smaller file.',
      }
    }
    console.error('Error uploading file - Request setup error:', error)
    setResponseStatus(event, 500)
    return { error: 'Error setting up upload request' }
  }
})
