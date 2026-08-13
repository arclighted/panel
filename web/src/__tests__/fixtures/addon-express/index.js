'use strict'
// Test fixture for the Phase 5 addon runtime: a plain Express-router addon.
// The loader calls `module.exports(addonRouter, addonAPI)`; the router is
// mounted on the Nitro Express bridge at the manifest router path.
const { Router } = require('express')

module.exports = (router, api) => {
  router.get('/hello', (req, res) => {
    res.json({
      ok: true,
      user: (req.session && req.session.user && req.session.user.id) || null,
      path: req.path,
    })
  })
  router.post('/echo', (req, res) => {
    res.json({ body: req.body || {} })
  })
  router.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })
  // Extra router mounted via api.registerRoute — must be unmounted together
  // with the addon when it is disabled (Phase 5 review finding).
  const { Router } = require('express')
  const extra = Router()
  extra.get('/ping', (_req, res) => {
    res.json({ pong: true })
  })
  api.registerRoute('/test-express-extra', extra)
  return {}
}
