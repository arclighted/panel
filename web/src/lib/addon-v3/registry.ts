import { useEffect, useMemo, useState } from 'react'

import { useQuery } from '@tanstack/react-query'

import type {
  AddonBundleModule,
  AddonUIManifest,
  AddonUIResponse,
} from './types'

/**
 * Addon v3 runtime registry.
 *
 * Responsibilities:
 *  - Fetch enabled addon UI manifests from GET /api/addons/ui (TanStack Query).
 *  - Dynamically import each addon's ESM bundle(s) and inject its CSS.
 *  - Expose slot → component-name lookups so shell components can mount
 *    addon UI at named points.
 *  - Expose route → component lookups so addon pages render at their declared
 *    paths (via the addon splat route).
 *
 * Single-instance React is guaranteed by the import map in __root.tsx: addon
 * bundles externalize react/react-dom and the browser resolves them to the
 * vendored /vendor/*.mjs files shared with the app.
 */

/** React component type — kept loose so the registry doesn't hard-pin React. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AddonComponent = any

/** Stable empty array so `data ?? EMPTY_MANIFESTS` keeps a constant reference
 *  across renders (a fresh `[]` literal would retrigger the loader effect on
 *  every render and loop). */
const EMPTY_MANIFESTS: AddonUIManifest[] = []

export interface AddonRegistryState {
  /** Manifests for enabled addons that declare a `ui` field. */
  manifests: AddonUIManifest[]
  /** Loaded bundle modules, keyed by addon slug. */
  bundles: Record<string, AddonBundleModule>
  /** True once every enabled addon bundle has been loaded (or failed). */
  settled: boolean
  /** Slugs whose bundles failed to load. */
  failed: string[]
}

/** Fetch the enabled addon v3 UI manifests. */
async function fetchAddonUIManifests(): Promise<AddonUIManifest[]> {
  const res = await fetch('/api/addons/ui', { credentials: 'same-origin' })
  if (!res.ok) throw new Error('Failed to load addon UI manifests')
  const data = (await res.json()) as AddonUIResponse
  return data.addons ?? []
}

/** Inject a stylesheet link once per URL. */
function injectCss(url: string): void {
  const existing = document.querySelector<HTMLLinkElement>(
    `link[data-addon-css="${CSS.escape(url)}"]`,
  )
  if (existing) return
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = url
  link.dataset.addonCss = url
  document.head.appendChild(link)
}

/** Resolve a relative addon bundle URL to an absolute one. */
function resolveBundleUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return url.startsWith('/') ? url : `/${url}`
}

/** Dynamically import one addon bundle. Vite leaves dynamic imports alone. */
async function loadBundle(url: string): Promise<AddonBundleModule> {
  const resolved = resolveBundleUrl(url)
  return (await import(/* @vite-ignore */ resolved)) as AddonBundleModule
}

/**
 * React hook providing the addon v3 registry state.
 *
 * Loads every enabled addon's bundles + CSS once the manifests arrive. Idempotent
 * across re-renders: bundles are only imported once per unique URL.
 */
export function useAddonRegistry(): AddonRegistryState {
  const { data: manifests = EMPTY_MANIFESTS } = useQuery({
    queryKey: ['addon-ui-manifests'],
    queryFn: fetchAddonUIManifests,
    staleTime: 5 * 60_000,
    // No silent retry: a missing /api/addons/ui (e.g. no addons installed, or
    // a stub in tests) should resolve instantly, not burn the default 3 retries.
    retry: 0,
  })

  const [bundles, setBundles] = useState<Record<string, AddonBundleModule>>({})
  const [failed, setFailed] = useState<string[]>([])

  useEffect(() => {
    if (manifests.length === 0) {
      // Stable empty manifests means this branch runs exactly once (initial
      // mount) — never reset state here, or a re-render loop follows.
      return
    }

    let cancelled = false

    async function loadAll() {
      const next: Record<string, AddonBundleModule> = {}
      const errors: string[] = []

      for (const addon of manifests) {
        for (const url of addon.bundles ?? []) {
          try {
            const mod = await loadBundle(url)
            if (cancelled) return
            next[addon.slug] = { ...next[addon.slug], ...mod }
          } catch {
            errors.push(addon.slug)
          }
        }
        // CSS injection is independent of bundle success.
        for (const cssUrl of addon.css ?? []) {
          injectCss(cssUrl)
        }
      }

      if (!cancelled) {
        setBundles(next)
        setFailed(errors)
      }
    }

    void loadAll()

    return () => {
      cancelled = true
    }
  }, [manifests])

  const settled = useMemo(() => {
    if (manifests.length === 0) return true
    const expected = manifests.filter((m) => (m.bundles ?? []).length > 0).length
    if (expected === 0) return true
    return Object.keys(bundles).length >= expected
  }, [manifests, bundles])

  return { manifests, bundles, settled, failed }
}

/**
 * Resolve the component(s) registered for a named slot across all loaded
 * addons. Returns an array of `{ slug, component }` pairs in manifest order.
 */
export function useAddonSlotComponents(slot: string): { slug: string; component: AddonComponent }[] {
  const { manifests, bundles } = useAddonRegistry()

  return useMemo(() => {
    const out: { slug: string; component: AddonComponent }[] = []
    for (const addon of manifests) {
      const names = addon.slots?.[slot]
      if (!names) continue
      const mod = bundles[addon.slug]
      if (!mod) continue
      for (const name of names) {
        const comp = mod[name]
        // Components are functions (FC) or objects (class/forwardRef).
        if (comp && (typeof comp === 'function' || typeof comp === 'object')) {
          out.push({ slug: addon.slug, component: comp as AddonComponent })
        }
      }
    }
    return out
  }, [manifests, bundles, slot])
}

/**
 * Look up a single component by addon slug + export name (used by the addon
 * page route to render a declared route component).
 */
export function useAddonComponent(slug: string, exportName: string): AddonComponent | null {
  const { bundles } = useAddonRegistry()
  return useMemo(() => {
    const mod = bundles[slug]
    if (!mod) return null
    const comp = mod[exportName]
    return comp && (typeof comp === 'function' || typeof comp === 'object')
      ? (comp as AddonComponent)
      : null
  }, [bundles, slug, exportName])
}

/** Find which addon declares a route path, and its component export name. */
export function useAddonRouteForPath(pathname: string): { slug: string; componentName: string } | null {
  const { manifests } = useAddonRegistry()
  return useMemo(() => {
    const normalized = pathname.split('?')[0]
    for (const addon of manifests) {
      for (const route of addon.routes ?? []) {
        if (route.path === normalized) {
          return { slug: addon.slug, componentName: route.component }
        }
      }
    }
    return null
  }, [manifests, pathname])
}

/** Imperative helper (non-hook) — used by shell components outside React hooks. */
export function getAddonCssFor(addon: AddonUIManifest): string[] {
  return addon.css ?? []
}

/** Re-exported for consumers that only need to fetch manifests once. */
export { fetchAddonUIManifests }
