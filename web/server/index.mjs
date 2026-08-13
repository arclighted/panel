/**
 * Arclight panel production server — Phase 5 (single process, single port).
 *
 * The proxy seam is gone: Express is deleted and this launcher simply loads
 * the env, forces NODE_ENV=production, and boots the built Nitro (TanStack
 * Start) server IN PROCESS. The Nitro server listens on `PORT` (default 3000)
 * and serves the HTML shell, every API, the WebSockets, the static surface,
 * the addon runtime (Express-bridge addons) and the background workers —
 * there are no internal ports, no proxy code, and no child spawn.
 *
 * Used via: node web/server/index.mjs (wired to `pnpm run start:panel` /
 * `arclight-web.service`).
 */
import { loadEnvFile, normalizeDatabaseUrl } from './env-loader.mjs'

// Load .env (repo root) so SESSION_SECRET / DATABASE_URL are available to the
// Nitro server — the same values the old Express panel read.
// DATABASE_URL is normalized to an absolute path so root modules bundled into
// the Nitro server (src/db.ts via daemonRequest) resolve the same SQLite file
// from web/ that Express resolved from the repo root.
loadEnvFile()
normalizeDatabaseUrl()

// Always serve production React builds. The repo .env ships
// NODE_ENV="development"; if that leaks into the Nitro server, the SSR bundle
// resolves react/jsx-runtime to the dev build, whose getOwner() calls against
// the production react-server dispatcher crash every page render
// ("dispatcher.getOwner is not a function").
process.env.NODE_ENV = 'production'

// The built Nitro entry reads PORT / NITRO_PORT and listens on import.
// Signal handlers: the Nitro entry handles its own process lifecycle; be
// explicit so systemd / process managers see a clean exit on SIGTERM/SIGINT.
process.on('SIGTERM', () => process.exit(0))
process.on('SIGINT', () => process.exit(0))

await import('../.output/server/index.mjs')
