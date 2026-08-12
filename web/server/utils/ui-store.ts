/**
 * Nitro-side UI component store (admin sidebar + server menu).
 *
 * The React shell reads `sidebarGroups` (GET /api/admin/context), the admin
 * `menu` page, and the server `nav` (GET /api/server/:id/context) from the
 * Express `uiComponentStore` (src/handlers/uiComponentHandler.ts). The store
 * is in-memory per process, so this module imports the SAME class and
 * initializes the same defaults in the Nitro process — the admin sidebar and
 * server menu render byte-identically (icons included).
 *
 * Known deviation (documented in docs/tanstack-migration-plan.md): items that
 * addon v2 runtimes register at Express boot (arclight-cloud, modrinth) live
 * in the Express process only and won't appear here until the addon runtime
 * moves into Nitro. The declarative addon v3 manifest (`adminSidebar` /
 * `serverMenu`) is consumed by the client-side v3 runtime.
 */
import {
  initializeDefaultUIComponents,
  uiComponentStore,
} from '../../../src/handlers/uiComponentHandler'

// addSidebarItem/addServerMenuItem replace by id → idempotent.
initializeDefaultUIComponents()

export { uiComponentStore }
