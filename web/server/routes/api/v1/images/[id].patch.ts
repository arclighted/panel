/**
 * PATCH /api/v1/images/:id — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3).
 */
import { defineEventHandler, getRouterParam, readBody, setResponseStatus } from 'h3'
import { nitroPrisma } from '../../../../utils/auth-session'
import { requireApiKey, apiAudit, getParamAsNumber } from '../../../../utils/external-api'

export default defineEventHandler(async (event) => {
  const guard = await requireApiKey(event, 'arclight.api.images.update')
  if (!guard.ok) return guard.response

  try {
    const imageId = getParamAsNumber(getRouterParam(event, 'id') ?? '')
    const existing = await nitroPrisma.images.findUnique({ where: { id: imageId } })
    if (!existing) {
      setResponseStatus(event, 404)
      return { error: 'Image not found' }
    }

    const body = (await readBody(event).catch(() => ({}))) as Record<string, unknown>
    const {
      name,
      description,
      author,
      authorName,
      startup,
      stop,
      startup_done,
      config_files,
      dockerImages,
      variables,
      info,
      scripts,
      portRequirements,
    } = body

    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (author !== undefined) data.author = author
    if (authorName !== undefined) data.authorName = authorName
    if (startup !== undefined) data.startup = startup
    if (stop !== undefined) data.stop = stop
    if (startup_done !== undefined) data.startup_done = startup_done
    if (config_files !== undefined) data.config_files = config_files
    if (dockerImages !== undefined) data.dockerImages = JSON.stringify(dockerImages)
    if (variables !== undefined) data.variables = JSON.stringify(variables)
    if (info !== undefined) data.info = JSON.stringify(info)
    if (scripts !== undefined) data.scripts = JSON.stringify(scripts)
    if (portRequirements !== undefined) {
      data.portRequirements = JSON.stringify(portRequirements)
    }

    const image = await nitroPrisma.images.update({
      where: { id: imageId },
      data,
      select: {
        id: true,
        UUID: true,
        name: true,
        description: true,
        startup: true,
        createdAt: true,
      },
    })

    await apiAudit(event, 'image:update', undefined, {
      metadata: { imageId, name: image.name },
    })
    return { data: image }
  } catch (error) {
    console.error('Error updating image:', error)
    setResponseStatus(event, 500)
    return { error: 'Failed to update image' }
  }
})
