/**
 * POST /upload-avatar — Nitro twin of the Express handler in
 * src/modules/user/account.ts. Byte-identical (D3): h3 readMultipartFormData
 * replaces multer memoryStorage; magic-byte content validation (inspectImage),
 * polyglot rejection, safe username dir guard, and per-user dir cleanup
 * before writing the new avatar.
 */
import { defineEventHandler, readMultipartFormData, setResponseStatus } from 'h3'
import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../utils/auth-session'
import { inspectImage, isSafeUserDirName } from '../../../src/utils/imageSecurity'

const AVATAR_MAX_SIZE_BYTES = 2 * 1024 * 1024
const AVATARS_DIR = path.join(process.cwd(), 'public', 'uploads', 'avatars')

function avatarUserDir(username: string): string | null {
  if (!isSafeUserDirName(username)) {
    return null
  }
  return path.join(AVATARS_DIR, username)
}

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))

  // The multipart body carries no _csrf field; the token travels in the
  // CSRF-Token header (same as the file-upload route).
  if (!requireCsrf(event, session)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }

  const parts = await readMultipartFormData(event).catch(() => [])
  const filePart = parts.find((p) => p.name === 'avatar')
  if (!filePart || !filePart.data) {
    setResponseStatus(event, 400)
    return { message: 'No file uploaded.' }
  }
  // h3's readMultipartFormData returns Uint8Array parts; inspectImage and
  // writeFileSync expect a Buffer (Buffer.isBuffer gate + write semantics).
  const fileData = Buffer.from(filePart.data)
  if (fileData.length > AVATAR_MAX_SIZE_BYTES) {
    setResponseStatus(event, 400)
    return { message: 'Avatar exceeds the 2 MB size limit.' }
  }

  const userId = (session as { user?: { id?: unknown } }).user?.id
  const username = (session as { user?: { username?: unknown } }).user?.username
  if (typeof userId !== 'number' || typeof username !== 'string' || !username) {
    setResponseStatus(event, 401)
    return { message: 'Not authenticated.' }
  }

  // Real content validation: magic bytes + polyglot rejection. The
  // client-declared mimetype/originalname are never trusted.
  const inspection = inspectImage(fileData)
  if (!inspection.ok) {
    setResponseStatus(event, 400)
    return { message: inspection.reason ?? 'Invalid image file.' }
  }

  // username is validated at registration, but the session value still
  // drives the on-disk directory — guard it anyway.
  const userDir = avatarUserDir(username)
  if (!userDir) {
    setResponseStatus(event, 400)
    return { message: 'Invalid user directory.' }
  }

  try {
    if (!existsSync(userDir)) {
      mkdirSync(userDir, { recursive: true })
    } else {
      const existing = readdirSync(userDir)
      existing.forEach((f) => {
        try {
          unlinkSync(path.join(userDir, f))
        } catch {
          /* ignore per-file errors */
        }
      })
    }

    const filename = `avatar${inspection.ext}`
    writeFileSync(path.join(userDir, filename), fileData)
    const avatarPath = `/uploads/avatars/${username}/${filename}`

    await nitroPrisma.users.update({
      where: { id: userId },
      data: { avatar: avatarPath },
    })

    return { message: 'Avatar updated.', avatar: avatarPath }
  } catch (error) {
    console.error('Error uploading avatar:', error)
    setResponseStatus(event, 500)
    return { message: 'Internal Server Error' }
  }
})
