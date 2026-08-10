import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import type { Plugin } from 'vite'
import http from 'node:http'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

import { createProxyConfig, PANEL_INTERNAL_URL } from './proxy.config'

/**
 * Express is the mutation authority: every non-GET request (login, register,
 * password reset, 2FA, admin actions, …) carries session + CSRF state that only
 * the Express process can validate. Vite's path-based proxy cannot be made
 * method-aware, so this middleware forwards all non-GET requests to Express.
 */
function proxyMutationsToExpress(): Plugin {
  return {
    name: 'arclight:proxy-mutations-to-express',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const method = (req.method ?? 'GET').toUpperCase()
        if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
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
    proxyMutationsToExpress(),
  ],
  server: {
    proxy: createProxyConfig(),
  },
})

export default config
