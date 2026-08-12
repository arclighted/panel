/**
 * POST /remove-avatar — Nitro twin of the Express handler in
 * src/modules/user/account.ts. Byte-identical (D3): clears the user's avatar
 * directory and nulls the stored avatar path.
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { existsSync, readdirSync, unlinkSync, rmdirSync } from 'node:fs'
import path from 'node:path'
import {
  loadSession,
  nitroPrisma,
  requireCsrf,
  type SessionPayload,
} from '../utils/auth-session'
import { isSafeUserDirName } from '../../../src/utils/imageSecurity'

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
  const body = await readBody(event).catch(() => ({}))
  if (!requireCsrf(event, session, body)) {
    setResponseStatus(event, 403)
    return { message: 'Invalid CSRF token' }
  }

  try {
    const userId = (session as { user?: { id?: unknown } }).user?.id
    const username = (session as { user?: { username?: unknown } }).user?.username
    if (typeof username !== 'string' || !username) {
      setResponseStatus(event, 400)
      return { message: 'User not authenticated.' }
    }

    const userDir = avatarUserDir(username)
    if (!userDir) {
      setResponseStatus(event, 400)
      return { message: 'Invalid user directory.' }
    }
    if (existsSync(userDir)) {
      readdirSync(userDir).forEach((f) => {
        try {
          unlinkSync(path.join(userDir, f))
        } catch {
          /* ignore per-file errors */
        }
      })
      try {
        rmdirSync(userDir)
      } catch {
        /* ignore if dir still has files */
      }
    }

    if (typeof userId === 'number') {
      await nitroPrisma.users.update({
        where: { id: userId },
        data: { avatar: null },
      })
    }

    return { message: 'Avatar removed.' }
  } catch (error) {
    console.error('Error removing avatar:', error)
    setResponseStatus(event, 500)
    return { message: 'Internal Server Error' }
  }
})
