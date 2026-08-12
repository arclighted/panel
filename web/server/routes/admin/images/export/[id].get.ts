/**
 * GET /admin/images/export/:id — Nitro twin of the Express handler in
 * src/modules/admin/images.ts. Byte-identical (D3): serializes the image as
 * a PTDL_v2 egg JSON attachment.
 */
import { defineEventHandler, getRouterParam, setResponseHeaders, setResponseStatus } from 'h3'
import { loadSession, nitroPrisma, requireCsrf, type SessionPayload } from '../../../../utils/auth-session'
import { requireAdminGuard } from '../../../../utils/admin-api'

export default defineEventHandler(async (event) => {
  const session =
    (event.context.session as SessionPayload | undefined) ??
    (await loadSession(event))
  if (!requireCsrf(event, session, {})) {
    setResponseStatus(event, 403)
    return { error: 'Invalid CSRF token' }
  }
  const guard = await requireAdminGuard(event, session)
  if (!guard.ok) return guard.response

  try {
    const image = await nitroPrisma.images.findUnique({
      where: { id: Number(getRouterParam(event, 'id')) },
    })
    if (!image) {
      setResponseStatus(event, 404)
      return { error: 'Image not found' }
    }

    const dockerImagesRaw: Record<string, string> = {}
    try {
      const parsed = JSON.parse(image.dockerImages || '[]')
      if (Array.isArray(parsed)) {
        for (const obj of parsed) {
          if (typeof obj === 'object') {
            Object.assign(dockerImagesRaw, obj)
          }
        }
      }
    } catch {
      /* keep empty */
    }

    let meta: Record<string, unknown> = {}
    try {
      meta = JSON.parse(image.meta || '{}')
    } catch {
      /* keep empty */
    }

    const exported = {
      _comment: 'DO NOT EDIT: FILE GENERATED AUTOMATICALLY BY ARCLIGHT',
      meta: { version: 'PTDL_v2', ...meta },
      name: image.name,
      description: image.description,
      author: image.author,
      startup: image.startup,
      config: {
        files: (() => {
          try {
            return JSON.parse(image.config_files || '{}')
          } catch {
            return {}
          }
        })(),
        startup: { done: image.startup_done || '' },
        logs: {},
        stop: image.stop || 'stop',
      },
      docker_images: dockerImagesRaw,
      variables: (() => {
        try {
          return JSON.parse(image.variables || '[]')
        } catch {
          return []
        }
      })(),
      scripts: {
        installation: (() => {
          try {
            const s = JSON.parse(image.scripts || '{}')
            return s.installation || null
          } catch {
            return null
          }
        })(),
      },
      portRequirements: (() => {
        try {
          return JSON.parse(image.portRequirements || '[]')
        } catch {
          return []
        }
      })(),
    }

    const filename = `${(image.name || 'image').replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    setResponseHeaders(event, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    })
    return JSON.stringify(exported, null, 2)
  } catch (error) {
    console.error('Error exporting image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to export image' }
  }
})
