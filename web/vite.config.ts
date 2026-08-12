import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import type { Plugin } from 'vite';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { tanstackStart } from '@tanstack/react-start/plugin/vite';

import viteReact from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';

import {
  ALL_PROXY_PATHS,
  createProxyConfig,
  isMigratedServerPage,
  isNitroOwnedPath,
  PANEL_INTERNAL_URL,
} from './proxy.config';

/**
 * Express is the authority for everything Vite's path-based proxy cannot
 * express: every non-GET request (login, register, password reset, 2FA, admin
 * actions, …) carries session + CSRF state only Express can validate, and the
 * un-migrated `/server/:uuid/*` tabs (settings, databases, schedules, …) are
 * still rendered by Express as EJS. The migrated server pages (`/server/:uuid`
 * and `/server/:uuid/files`) stay on the TanStack app.
 */
function proxyToExpress(): Plugin {
  return {
    name: 'arclight:proxy-to-express',
    // Must run BEFORE the TanStack Start dev middleware (which renders its own
    // 404 for unmatched paths, swallowing /api/* GETs) and before Vite's
    // built-in middlewares: `enforce: 'pre'` + first in the plugin array.
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const method = (req.method ?? 'GET').toUpperCase();
        const url = req.url ?? '';
        if (url.startsWith('/__tsd/')) {
          return next();
        }
        const isGet = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
        const isLegacyServerPage =
          url.startsWith('/server/') && !isMigratedServerPage(url);
        const isProxyPath = ALL_PROXY_PATHS.some((p) => url.startsWith(p));
        // Nitro-owned paths (GET /api/auth-config, GET /logout and the auth
        // mutations POST /login, /register, /2fa, plus the Phase 2 group 2
        // GET-only context endpoints /api/account/context, /api/folders,
        // /api/create-server/context, /api/system/status, /api/admin/context,
        // /api/admin/page/* and /api/server/:id/context) must reach the
        // TanStack (Nitro) dev middleware — same as prod (web/server/index.mjs
        // routes nitro-owned paths before the non-GET-to-Express rule). The
        // method is passed so GET-only ownership never steals the sibling
        // mutations (POST /api/folders, PATCH/DELETE /api/folders/:id, POST
        // /api/system/test-node-connection).
        const isNitroOwned = isNitroOwnedPath(
          url.split('?')[0] ?? url,
          method,
        )
        if (isNitroOwned || (isGet && !isLegacyServerPage && !isProxyPath)) {
          return next();
        }

        const target = new URL(PANEL_INTERNAL_URL);
        const proxyReq = http.request(
          {
            host: target.hostname,
            port: Number(target.port),
            path: req.url,
            method: req.method,
            headers: { ...req.headers },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
            proxyRes.pipe(res);
          },
        );
        proxyReq.on('error', () => {
          res.writeHead(502);
          res.end('Proxy Error');
        });
        req.pipe(proxyReq);
      });
    },
  };
}

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
    proxyToExpress(),
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
  server: {
    proxy: createProxyConfig(),
  },
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
