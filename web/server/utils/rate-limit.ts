/**
 * In-memory per-IP rate limiter — the Nitro twin of express-rate-limit as
 * configured for the auth routes in src/modules/auth/authService.ts
 * (`authRateLimit`: 10 requests per minute per IP). Once the auth routes move
 * to Nitro (Phase 2), this process is the only one handling them, so a
 * per-process store is equivalent to the Express behavior it replaces.
 *
 * Both POST /login and POST /register share one limiter instance — exactly
 * like Express, where authRateLimit is module-level and applied to both
 * routes with the same window budget.
 */
import type { H3Event } from 'h3'
import { getClientIp } from './auth'

interface Bucket {
  count: number
  resetAt: number
}

export interface RateLimiterOptions {
  windowMs: number
  max: number
}

export function createRateLimiter(opts: RateLimiterOptions) {
  const buckets = new Map<string, Bucket>()
  // Lazy sweep every window to bound memory (bucket count stays small).
  let lastSweep = Date.now()

  return (event: H3Event): boolean => {
    const now = Date.now()
    if (now - lastSweep >= opts.windowMs) {
      for (const [key, bucket] of buckets) {
        if (bucket.resetAt <= now) {
          buckets.delete(key)
        }
      }
      lastSweep = now
    }

    const key = getClientIp(event)
    let bucket = buckets.get(key)
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + opts.windowMs }
      buckets.set(key, bucket)
    }
    bucket.count += 1
    return bucket.count > opts.max
  }
}

/**
 * Shared auth limiter: 10 attempts per minute per IP (mirrors authService.ts).
 * Returns true when the request is over the limit (→ 429).
 */
export const isAuthRateLimited = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
})
