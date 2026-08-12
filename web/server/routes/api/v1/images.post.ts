/**
 * POST /api/v1/images — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../utils/auth-session'
import { requireApiKey, apiAudit } from '../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.images.create')
  if (!guard.ok) return guard.response

  try {
    const body = (await readBody(event).catch(() => ({}))) as {
      name?: string
      description?: string
      author?: string
      authorName?: string
      startup?: string
      stop?: string
    }

    if (!body.name || typeof body.name !== 'string' || body.name.trim() === '') {
      setResponseStatus(event, 422)
      return { error: 'Image name is required' }
    }
    if (!body.startup || typeof body.startup !== 'string' || body.startup.trim() === '') {
      setResponseStatus(event, 422)
      return { error: 'Image startup command is required' }
    }

    const image = await nitroPrisma.images.create({
      data: {
        name: body.name.trim(),
        description: body.description ?? '',
        author: body.author ?? '',
        authorName: body.authorName ?? '',
        startup: body.startup.trim(),
        stop: body.stop ?? 'stop',
        startup_done: '',
        config_files: '',
        meta: JSON.stringify({ version: 'AL_V1' }),
        dockerImages: JSON.stringify([]),
        info: JSON.stringify({ features: [] }),
        scripts: JSON.stringify({}),
        variables: JSON.stringify([]),
        portRequirements: JSON.stringify([]),
      },
      select: {
        id: true,
        UUID: true,
        name: true,
        description: true,
        startup: true,
        createdAt: true,
      },
    })

    await apiAudit(event, 'image:create', undefined, {
      metadata: { imageId: image.id, name: image.name },
    })
    setResponseStatus(event, 201)
    return { data: image }
  } catch (error) {
    console.error('Error creating image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to create image' }
  }
})
