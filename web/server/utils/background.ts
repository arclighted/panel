/**
 * Phase 5 — panel background workers that used to start inside the Express
 * process (src/app.ts) now start in the Nitro process. The addon middleware
 * (03.addons.ts) calls startBackgroundWorkers() once at boot.
 *
 * All workers are the ROOT framework-free implementations — the Nitro process
 * is now the only process, so timers/intervals behave exactly as before.
 */
import { startScheduler } from '../../../src/handlers/schedulerWorker'
import { startPlayerStatsCollection } from '../../../src/handlers/playerStatsCollector'
import { reenqueueQueuedInstalls } from '../../../src/handlers/installQueue'
import { initEggCatalogue } from '../../../src/handlers/eggCatalogueService'
import { refreshSecurityCache } from '../../../src/handlers/securityCache'
import logger from '../../../src/handlers/logger'

let started = false

/** Idempotent boot of the panel's background workers (mirror src/app.ts). */
export function startBackgroundWorkers(): void {
  if (started) return
  started = true

  // IP ban + rate-limit cache: initial load + 30s refresh (mirror app.ts).
  refreshSecurityCache()
  setInterval(refreshSecurityCache, 30_000)

  try {
    startScheduler()
  } catch (error) {
    logger.error(
      'Failed to start scheduler:',
      error instanceof Error ? error.message : String(error),
    )
  }
  try {
    startPlayerStatsCollection()
  } catch (error) {
    logger.error(
      'Failed to start player stats collection:',
      error instanceof Error ? error.message : String(error),
    )
  }
  try {
    reenqueueQueuedInstalls()
  } catch (error) {
    logger.error(
      'Failed to re-enqueue queued installs:',
      error instanceof Error ? error.message : String(error),
    )
  }

  // Clone/pull egg repos on startup; auto-refreshes every 2 days (mirror app.ts).
  initEggCatalogue().catch((err: unknown) =>
    logger.warn(
      `Store catalogue init failed: ${
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : String(err)
      }`,
    ),
  )
}
