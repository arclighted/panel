/**
 * Filesystem-backed `serveStatic` adapter for Phase 4 (static assets to Nitro).
 *
 * Replaces the Express `express.static` mounts for the ROOT `public/` surface
 * (assets, themes, uploads, favicon, legacy dirs) and the addon-assets handler.
 * h3's `serveStatic` is generic — it asks a `getMeta`/`getContents` pair for
 * asset metadata + bytes. This adapter answers from the real filesystem with
 * the same semantics Express applied:
 *
 *   - id is the request pathname (with leading slash, already decoded and
 *     dot-resolved by serveStatic); it is joined to the base dir and must stay
 *     INSIDE it (containment guard — same defence addonHandler used).
 *   - meta carries type/size/mtime/etag so h3 can emit Last-Modified, ETag,
 *     Content-Length, Content-Type and answer 304s — matching the conditional
 *     behaviour of express.static.
 *   - `indexNames: []` disables directory index.html serving (no index.html
 *     exists under these mounts).
 *
 * Usage: pass `{ getMeta, getContents }` to h3's `serveStatic` with
 * `fallthrough: true`, so a missing file returns undefined and the request
 * continues to Nitro's own baked assets / the SSR catch-all.
 */
import { stat, readFile } from 'node:fs/promises'
import path from 'node:path'

/** Small MIME map for the extensions present under public/ (h3's internal
 * getType covers most of these; this makes the adapter self-contained). */
const MIME: Record<string, string> = {
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/vnd.microsoft.icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.zip': 'application/zip',
  '.pdf': 'application/pdf',
  '.map': 'application/json',
}

export interface FsStaticHandlers {
  getMeta: (id: string) => Promise<{ type?: string; size: number; mtime: number; etag: string } | undefined>
  // h3's ServeStaticOptions.getContents is typed as BodyInit — a Buffer is a
  // valid BodyInit at runtime; the cast bridges Node's Uint8Array<ArrayBufferLike>
  // vs the DOM's ArrayBufferView<ArrayBuffer> typing gap.
  getContents: (id: string) => Promise<BodyInit | null>
}

interface FsStaticOptions {
  /**
   * URL prefix to strip before joining to the base dir — for mounts whose URL
   * namespace differs from the on-disk layout (e.g. /themes/* →
   * storage/themes/*, /uploads/* → web/public/uploads/*). Must start with
   * '/' and match the request pathname exactly.
   */
  stripPrefix?: string
}

/** Builds getMeta/getContents reading from `baseDir`, refusing any path that
 * escapes the base directory (defence in depth on top of serveStatic's own
 * dot-segment resolution). */
export function createFsStatic(baseDir: string, opts: FsStaticOptions = {}): FsStaticHandlers {
  const root = path.resolve(baseDir)
  const strip = opts.stripPrefix ? opts.stripPrefix.replace(/\/$/, '') : ''

  function resolveSafe(id: string): string | null {
    let rel = id
    if (strip) {
      if (rel === strip) {
        rel = '/'
      } else if (rel.startsWith(strip + '/')) {
        rel = rel.slice(strip.length)
      } else {
        return null
      }
    }
    const candidate = path.resolve(root, '.' + rel)
    if (candidate !== root && !candidate.startsWith(root + path.sep)) {
      return null
    }
    return candidate
  }

  return {
    async getMeta(id: string) {
      const file = resolveSafe(id)
      if (!file) return undefined
      try {
        const st = await stat(file)
        if (!st.isFile()) return undefined
        const ext = path.extname(file).toLowerCase()
        return {
          type: MIME[ext],
          size: st.size,
          mtime: st.mtimeMs,
          // Same shape express.static emits (W/"<size>-<mtime>").
          etag: `W/"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"`,
        }
      } catch {
        return undefined
      }
    },
    async getContents(id: string) {
      const file = resolveSafe(id)
      if (!file) return null
      try {
        return (await readFile(file)) as unknown as BodyInit
      } catch {
        return null
      }
    },
  }
}
