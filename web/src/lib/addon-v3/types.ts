/**
 * Addon v3 UI manifest types.
 *
 * Mirrors the server's `AddonUIV3Manifest` (src/handlers/addonManifest.ts,
 * served by GET /api/addons/ui). Kept structurally identical so the registry
 * never has to guess at shapes.
 */

export interface AddonUIV3Route {
  path: string
  component: string
}

export interface AddonUIV3AdminSidebarItem {
  id: string
  label: string
  icon?: string
  url: string
  section?: string
  group?: string
}

export interface AddonUIV3ServerMenuItem {
  id: string
  label: string
  icon?: string
  url: string
  group?: string
  feature?: string
}

export interface AddonUIManifest {
  slug: string
  name: string
  version: string
  bundles?: string[]
  css?: string[]
  slots?: Record<string, string[]>
  routes?: AddonUIV3Route[]
  adminSidebar?: AddonUIV3AdminSidebarItem[]
  serverMenu?: AddonUIV3ServerMenuItem[]
  apiPaths?: string[]
}

export interface AddonUIResponse {
  addons: AddonUIManifest[]
}

/** A loaded addon bundle module (its named exports are the components). */
export type AddonBundleModule = Record<string, unknown>
