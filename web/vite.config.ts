import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import type { Plugin } from 'vite'
import http from 'node:http'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

import { createProxyConfig, isMigratedServerPage, PANEL_INTERNAL_URL } from './proxy.config'

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
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const method = (req.method ?? 'GET').toUpperCase()
        const url = req.url ?? ''
        const isGet = method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
        if (isGet && !(url.startsWith('/server/') && !isMigratedServerPage(url))) {
          return next()
        }

        const target = new URL(PANEL_INTERNAL_URL)
        const proxyReq = http.request(
          {
            host: target.hostname,
            port: Number(target.port),
            path: req.url,
            method: req.method,
            headers: { ...req.headers },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers)
            proxyRes.pipe(res)
          },
        )
        proxyReq.on('error', () => {
          res.writeHead(502)
          res.end('Proxy Error')
        })
        req.pipe(proxyReq)
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
    proxyToExpress(),
  ],
  server: {
    proxy: createProxyConfig(),
  },
})

export default config
