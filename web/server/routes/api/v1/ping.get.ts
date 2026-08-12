/**
 * GET /api/v1/ping — Nitro twin of the Express handler in
 * src/modules/api/v1/api.ts. Byte-identical (D3): public health check.
 */
import { defineEventHandler } from 'h3'

export default defineEventHandler(() => ({
  status: 'ok',
  timestamp: new Date().toISOString(),
  uptime: process.uptime(),
  version: '2.0.0',
}))
