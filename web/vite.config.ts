import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { fileURLToPath } from 'node:url';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: [
      // base-ui imports use-sync-external-store/shim and
      // use-sync-external-store/shim/with-selector (CJS with a runtime
      // require("react")). Alias both to the shared ESM shim so the CJS shim
      // never reaches the bundle (it throws in browser ESM when react is
      // externalized in the production build).
      {
        find: /^use-sync-external-store\/shim(?:\/with-selector)?$/,
        replacement: fileURLToPath(
          new URL("../packages/ui/src/vendor/use-sync-external-store.ts", import.meta.url),
        ),
      },
    ],
  },
  plugins: [
    devtools(),
    // serverDir: Nitro 3 defaults serverDir to false (no input server dir
    // scanned). Enable it so `server/routes/**` (e.g. the Nitro-owned
    // GET /api/auth-config) and `server/middleware/**` (session loader) are
    // compiled into the Nitro server alongside the TanStack SSR renderer.
    // Phase 3: features.websocket wires crossws upgrade handling into the
    // production node server AND the Vite dev server (see vite.dev.mjs), so
    // the migrated WebSocket handlers (server/routes/ws/realtime.ts,
    // online-check.ts, console/status/events/[id].ts) actually receive
    // upgrades in both environments.
    nitro({
      serverDir: true,
      features: { websocket: true },
      rollupConfig: { external: [/^@sentry\//] },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  // Phase 5: no proxy — the dev server (Nitro) owns every path, exactly like
  // production. Express is deleted; the addon runtime + background workers
  // boot inside the Nitro process (web/server/middleware/03.addons.ts).
  // Addon v3 shared runtime: in the production build, the react family is
  // externalized so the app's chunks emit bare imports. The import map in
  // __root.tsx resolves these to /vendor/*.mjs, guaranteeing a single React
  // instance across app + addon bundles in production. SSR (Nitro) resolves
  // from node_modules independently (fine — SSR doesn't use the import map).
  // DEV mode does NOT externalize react (Vite pre-bundles it for HMR). In
  // dev, addon bundles that load at runtime via dynamic import() resolve
  // react through the browser import map to the vendored file, while the app
  // uses Vite's pre-bundled react — producing two React instances. This is a
  // documented dev-only caveat; single-instance is guaranteed in production.
  build: {
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        // react/jsx-dev-runtime MUST be external too: the plugin chain pulls
        // the CJS jsx-dev-runtime entry into the client graph, whose runtime
        // require("react") becomes a rolldown shim that throws in browser ESM.
        // The import map serves jsxDEV from /vendor/react.mjs.
        'react/jsx-dev-runtime',
      ],
    },
  },
});

export default config;
