/**
 * GET /avatar/:seed — Nitro twin of the Express handler in
 * src/modules/core/index.ts. Byte-identical (D3): seed validation,
 * image/svg+xml content type, and the same cache headers. The avatar is
 * rendered server-side with the local @dicebear packages (no external API).
 *
 * Only the seed matters; the route is public and content is static per seed.
 */
import { defineEventHandler, getRouterParam } from 'h3'
import {
  avatarSvg,
  isValidAvatarSeed,
} from '../../../../src/utils/avatar'

export default defineEventHandler(async (event) => {
  // Decode like Express does (req.params.seed): %00 → NUL so the seed
  // validation below rejects control characters exactly as the Express twin
  // (src/modules/core/index.ts) did.
  const seedParam = getRouterParam(event, 'seed', { decode: true })
  const seed = Array.isArray(seedParam) ? seedParam[0] : seedParam

  if (!isValidAvatarSeed(seed)) {
    return new Response('invalid avatar seed', {
      status: 400,
      headers: { 'content-type': 'text/plain' },
    })
  }

  try {
    const svg = await avatarSvg(seed as string)
    return new Response(svg, {
      headers: {
        'content-type': 'image/svg+xml',
        'cache-control': 'public, max-age=86400, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('Avatar generation failed:', error)
    return new Response('avatar generation failed', {
      status: 500,
      headers: { 'content-type': 'text/plain' },
    })
  }
})
