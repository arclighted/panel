/**
 * Shared Nitro-side image normalization for the Phase 2 group 4 admin image
 * routes — mirrors normalizeImageData() in src/modules/admin/images.ts so
 * payloads stay byte-identical across the seam (D3).
 */
import {
  isPterodactylEgg,
  parseEgg,
  normalizeEggForDb,
} from '../../../src/handlers/utils/egg/eggParser'

export function normalizeImageData(raw: Record<string, unknown>) {
  if (isPterodactylEgg(raw)) {
    const egg = parseEgg(raw)
    const data = normalizeEggForDb(egg)
    return {
      ...data,
      portRequirements: JSON.stringify(
        raw.portRequirements ?? raw.port_requirements ?? [],
      ),
    }
  }

  const dockerImages = raw.docker_images || raw.dockerImages
  const dockerImagesArray = Array.isArray(dockerImages)
    ? dockerImages
    : typeof dockerImages === 'object' && dockerImages !== null
      ? Object.entries(dockerImages as Record<string, string>).map(([k, v]) => ({
          [k]: v,
        }))
      : []

  return {
    name: String(raw.name ?? ''),
    description: String(raw.description ?? ''),
    author: String(raw.author ?? ''),
    authorName: String(raw.authorName ?? ''),
    startup: String(raw.startup ?? ''),
    stop: String(raw.stop ?? ''),
    startup_done: String(raw.startup_done ?? ''),
    config_files: String(raw.config_files ?? ''),
    meta: JSON.stringify(raw.meta ?? {}),
    dockerImages: JSON.stringify(dockerImagesArray),
    info: JSON.stringify(raw.info ?? {}),
    scripts: JSON.stringify(raw.scripts ?? {}),
    variables: JSON.stringify(raw.variables ?? []),
    portRequirements: JSON.stringify(
      raw.portRequirements ?? raw.port_requirements ?? [],
    ),
  }
}
