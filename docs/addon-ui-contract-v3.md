# Addon v3 UI Contract

## Overview

Arclight Panel v3 addon UI is a React-based runtime. Addons ship compiled ESM
bundles that the panel loads at runtime. The panel provides a shared runtime
(React, React DOM, TanStack Router) via an **import map** so that the app and
every addon bundle share a single React instance.

## How it works

1. **Vendor runtime** — The panel builds single-instance ESM modules from its
   own pinned dependencies and serves them from `/vendor/*.mjs` (built by
   `web/scripts/vendor-v3.mjs`). The import map in `<head>` maps bare specifiers
   (`react`, `react-dom/client`, `@tanstack/react-router`, …) to these files.

2. **Addon bundles** — Addons produce compiled ESM bundles (one per entry) that
   **externalize** the shared runtime:
   - `react`, `react-dom/client`, `react/jsx-runtime`, `react/jsx-dev-runtime`
   - `@tanstack/react-router`, `@tanstack/react-query` (optional)
   
   The addon author's bundler (esbuild, Rollup, Vite) must leave these as bare
   specifiers. The browser resolves them through the panel's import map.

3. **Manifest** — Each addon declares its UI entries in a `ui` field in
   `package.json`. The panel reads this at startup and serves it to the React
   frontend via `GET /api/addons/ui`.

4. **Registry** — A lightweight runtime registry (`window.__arclight`) tracks
   loaded bundles, injected CSS, mounted slot components, and registered routes.
   The registry prevents duplicate loading and provides lifecycle tracking.

## Manifest `ui` field

Add `ui` to your addon's `package.json`:

```json
{
  "name": "My Addon",
  "identifier": "my-addon",
  "version": "1.0.0",
  "ui": {
    "bundles": ["/addon-assets/my-addon/ui/bundle.mjs"],
    "css": ["/addon-assets/my-addon/ui/styles.css"],
    "slots": {
      "server:console:toolbar": ["MyToolbar"]
    },
    "routes": [
      { "path": "/admin/addons/my-addon", "component": "MyAdminPage" }
    ],
    "adminSidebar": [
      {
        "id": "my-addon",
        "label": "My Addon",
        "icon": "settings",
        "url": "/admin/addons/my-addon",
        "section": "system"
      }
    ],
    "serverMenu": [],
    "apiPaths": ["/api/addons/my-addon/"]
  }
}
```

### Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `bundles` | `string[]` | No | ESM bundle URLs. Each file is loaded once per page visit. |
| `css` | `string[]` | No | CSS file URLs injected into `<head>`. |
| `slots` | `Record<string, string[]>` | No | Slot identifier → component name(s) the addon provides. |
| `routes` | `{path, component}[]` | No | Routes registered in the app's TanStack router. |
| `adminSidebar` | `SidebarItem[]` | No | Admin sidebar items merged into the panel's sidebar. |
| `serverMenu` | `ServerMenuItem[]` | No | Server context menu items for /server/:uuid pages. |
| `apiPaths` | `string[]` | No | API path prefixes the addon handles (informational; the panel's proxy already forwards `/api/*` to Express). |

## Slot identifiers

The panel defines the following named mount points (slots):

| Slot | Location | Props |
|------|----------|-------|
| `server:console:toolbar` | Above the terminal in the server console | `{ uuid: string }` |
| `server:header:actions` | Server header action area | `{ uuid: string }` |
| `admin:page:after` | After the main admin page content | `{ section: string }` |
| `dashboard:server:card:footer` | Below each server card on the dashboard | `{ server: ServerSummary }` |

Slots may accept multiple components (ordered array).

## Building an addon bundle

### Required bundler config

Externalize all shared runtime packages:

```js
// esbuild example
{
  entryPoints: ['src/ui/index.tsx'],
  bundle: true,
  format: 'esm',
  outfile: 'dist/ui/bundle.mjs',
  external: [
    'react', 'react/*',
    'react-dom', 'react-dom/*',
    'react/jsx-runtime', 'react/jsx-dev-runtime',
    '@arclight/ui',
  ],
  define: { 'process.env.NODE_ENV': '"production"' },
}
```

```js
// Vite example (vite.config.ts)
import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    lib: { entry: 'src/ui/index.tsx', formats: ['es'] },
    rollupOptions: {
      external: [
        'react', 'react-dom', 'react-dom/client',
        'react/jsx-runtime', 'react/jsx-dev-runtime',
        '@arclight/ui',
      ],
    },
  },
})
```

### Minimum import contract

Your bundle may import:

| Specifier | What it resolves to |
|-----------|-------------------|
| `react` | Single React instance shared with the panel |
| `react-dom/client` | Single react-dom shared with the panel |
| `react/jsx-runtime` | JSX runtime (automatic JSX transform) |
| `@arclight/ui` | Panel UI primitives (Button, Card, Dialog, …) |
| `@tanstack/react-router` | Single router instance (if registering routes) |
| `@tanstack/react-query` | Single query client (if querying data via the shared client) |

The import map also resolves `@tanstack/react-router` and
`@tanstack/react-query` to single-instance vendor modules. Use these sparingly
— prefer to receive shared context via the registry API.

### Do NOT bundle

- React, React DOM, JSX runtime
- `@arclight/ui` components (import from the package name)
- `sonner` (toasts) — use the panel's Toaster via `@arclight/ui/toast`
- TanStack Router or Query internals

## Registering routes

When the panel loads your bundle, it scans the `routes` field in your manifest
and registers each path + component pair with the TanStack Router. The
component name must match a **named export** in your bundle.

```ts
// src/ui/index.tsx
import { Button } from '@arclight/ui'
export { MyAdminPage } // <-- matches manifest route component name
```

## Slot components

Slot components receive props as React props. Export them as named exports from
your bundle:

```tsx
export function MyToolbar({ uuid }: { uuid: string }) {
  return <Button onClick={() => fetch(`/api/servers/${uuid}/my-action`)}>Do</Button>
}
```

## CSP

The panel enforces `script-src 'self' 'strict-dynamic'` in production. Bundles
served from `/addon-assets/` (same origin) satisfy this. No inline scripts in
addon bundles — all code must be in the compiled `.mjs` file.

## Version gating

Addons declare the minimum panel version in `engines.panel`. The loader checks
that the panel major matches the addon's declared major. Your addon must
declare `"engines": { "panel": ">=2.0.0" }` for the v3 contract.

## Development

### Panel dev server

```bash
# Start the full stack (Express + TanStack app + Tailwind)
pnpm dev
# Open http://localhost:3000
```

In development, the panel bundles React via Vite's optimizer. Addon bundles
loaded via the import map resolve React from the vendored `/vendor/react.mjs`,
which may differ from Vite's React instance. For production, the panel
externalizes React so all chunks resolve through the same import map.

### Testing an addon

1. Place your addon in `storage/addons/<your-slug>/` with a valid
   `package.json` (matching the manifest schema).
2. Enable it in the admin panel or set `"enabled": true` in the manifest.
3. The v3 UI data appears at `GET /api/addons/ui` (requires panel session).
4. Load your bundle in the browser: open DevTools → Network → filter by your
   bundle name.

### Drift check

```bash
node web/scripts/vendor-v3.mjs --check
```

CI runs this to ensure the vendored runtime matches the lockfile. If it fails,
re-run `node web/scripts/vendor-v3.mjs` and commit the updated vendor files.

## Store review checklist

The store verifies, for every v3 submission:

- [ ] Bundles externalize all shared runtime specifiers correctly
- [ ] No React, React DOM, or `@arclight/ui` in the bundle output
- [ ] Bundle passes `node -e "import('…')"` without errors
- [ ] Manifest declares `"engines": { "panel": ">=2.0.0" }`
- [ ] CSS files are valid and use `--theme-*` CSS variables for theme compat
- [ ] Routes paths don't conflict with reserved panel routes (checked by panel)
- [ ] Components render correctly in their target slot (manual review)
- [ ] No inline scripts violating CSP