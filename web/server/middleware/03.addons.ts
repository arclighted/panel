/**
 * Phase 5 — the addon runtime + panel background workers boot inside the Nitro
 * process (module top-level await, before the server starts listening — the
 * same "load everything at startup" behavior Express had in src/app.ts).
 *
 * Runs after 01.session (event.context.session is populated) and 02.static.
 * For addon-owned paths (/modrinth/api, /arclight-cloud/api, …) it bridges
 * the session + CSRF and dispatches through the in-process Express bridge;
 * every other request falls through to the Nitro routes / TanStack SSR.
 */
import { bootAddons, createAddonDispatchHandler } from '../utils/addon-runtime'
import { startBackgroundWorkers } from '../utils/background'

await bootAddons()
startBackgroundWorkers()

export default createAddonDispatchHandler()
