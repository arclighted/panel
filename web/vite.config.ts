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
        if (isGet && !isLegacyServerPage && !isProxyPath) {
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
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
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
