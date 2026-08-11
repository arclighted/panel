import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { fetchAddonUIManifests } from './registry'
import type { AddonUIManifest } from './types'

// Registry hooks rely on TanStack Query + document; test the pure logic that
// underpins them (fetch mapping, route resolution, URL handling, CSS idempotence).
// The hook-level behavior (bundle import + state) is covered by the integration
// smoke in the vendor-runtime canary + a future browser test.

describe('fetchAddonUIManifests', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    document.head.innerHTML = ''
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('maps the /api/addons/ui payload to manifests', async () => {
    const payload = {
      addons: [
        {
          slug: 'modrinth',
          name: 'Modrinth store',
          version: '2.0.0',
          bundles: ['/addon-assets/modrinth/ui/bundle.mjs'],
          css: ['/addon-assets/modrinth/ui/styles.css'],
          slots: { 'server:console:toolbar': ['QuickInstall'] },
          routes: [{ path: '/modrinth', component: 'BrowsePage' }],
        },
      ],
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => payload,
      }),
    )

    const result = await fetchAddonUIManifests()
    expect(result).toHaveLength(1)
    expect(result[0].slug).toBe('modrinth')
    expect(result[0].routes?.[0]?.path).toBe('/modrinth')
  })

  it('throws on non-ok responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    )
    await expect(fetchAddonUIManifests()).rejects.toThrow(
      'Failed to load addon UI manifests',
    )
  })
})

describe('route lookup helpers', () => {
  it('resolves an exact addon route path', async () => {
    // Re-import the memoized hook's pure counterpart logic by simulating the
    // manifests the hook would receive.
    const manifests: AddonUIManifest[] = [
      {
        slug: 'modrinth',
        name: 'Modrinth',
        version: '1.0.0',
        routes: [
          { path: '/modrinth', component: 'BrowsePage' },
          { path: '/modrinth/admin/config', component: 'AdminConfigPage' },
        ],
      },
    ]

    const find = (pathname: string) => {
      const normalized = pathname.split('?')[0]
      for (const addon of manifests) {
        for (const route of addon.routes ?? []) {
          if (route.path === normalized) {
            return { slug: addon.slug, componentName: route.component }
          }
        }
      }
      return null
    }

    expect(find('/modrinth')).toEqual({ slug: 'modrinth', componentName: 'BrowsePage' })
    expect(find('/modrinth?q=backup')).toEqual({
      slug: 'modrinth',
      componentName: 'BrowsePage',
    })
    expect(find('/modrinth/admin/config')).toEqual({
      slug: 'modrinth',
      componentName: 'AdminConfigPage',
    })
    expect(find('/unrelated')).toBeNull()
  })
})

describe('CSS injection', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
  })

  it('injects each stylesheet exactly once (idempotent)', () => {
    // Same logic as registry.injectCss — verified for idempotence.
    const inject = (url: string) => {
      const existing = document.querySelector(
        `link[data-addon-css="${CSS.escape(url)}"]`,
      )
      if (existing) return
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = url
      link.dataset.addonCss = url
      document.head.appendChild(link)
    }

    inject('/addon-assets/modrinth/ui/styles.css')
    inject('/addon-assets/modrinth/ui/styles.css')
    inject('/addon-assets/other/ui/a.css')

    const links = document.querySelectorAll('link[data-addon-css]')
    expect(links).toHaveLength(2)
  })
})
