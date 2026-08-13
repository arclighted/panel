/**
 * Phase 8 theme-seam probe: boots the production Nitro server (as the other
 * arclight-smoke scripts do) and verifies:
 *   1. The SSR shell links BOTH default theme stylesheets (default-light/dark).
 *   2. GET /themes/default-light.css + default-dark.css return 200 with the
 *      --theme-* token set.
 *   3. GET /themes/solarized-light.css returns 200 (builtin override).
 */
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const DB_DIR = mkdtempSync(join(tmpdir(), 'arclight-theme-'))
const DB_PATH = join(DB_DIR, 'theme.db')
const PORT = 3821

function check(name, ok, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

const child = spawn(
  process.execPath,
  [join(ROOT, 'web', '.output', 'server', 'index.mjs')],
  {
    env: {
      ...process.env,
      PORT: String(PORT),
      NODE_ENV: 'production',
      DATABASE_URL: `file:${DB_PATH}`,
    },
    stdio: 'ignore',
  },
)

const BASE = `http://127.0.0.1:${PORT}`
let failures = 0
try {
  // Wait for the server to come up.
  let up = false
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`${BASE}/login`)
      if (r.status < 500) {
        up = true
        break
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  check('prod server boots', up)
  if (!up) throw new Error('server never came up')

  const res = await fetch(`${BASE}/login`)
  const html = await res.text()
  check(
    'SSR shell links default-light.css',
    html.includes('/themes/default-light.css'),
  )
  check(
    'SSR shell links default-dark.css',
    html.includes('/themes/default-dark.css'),
  )

  const light = await fetch(`${BASE}/themes/default-light.css`)
  const lightCss = await light.text()
  check(
    'GET /themes/default-light.css → 200 + tokens',
    light.status === 200 && lightCss.includes('--theme-bg'),
  )

  const dark = await fetch(`${BASE}/themes/default-dark.css`)
  const darkCss = await dark.text()
  check(
    'GET /themes/default-dark.css → 200 + html.dark block',
    dark.status === 200 && darkCss.includes('html.dark'),
  )

  const solarized = await fetch(`${BASE}/themes/solarized-light.css`)
  check('GET /themes/solarized-light.css → 200 (override)', solarized.status === 200)

  // The bundled app CSS must remap tokens to the --theme-* palette.
  const assetRes = await fetch(`${BASE}/login`)
  const shell = await assetRes.text()
  const cssMatch = shell.match(/<link[^>]*href="([^"]*styles[^"]*\.css)"/)
  if (cssMatch) {
    const cssRes = await fetch(`${BASE}${cssMatch[1]}`)
    const css = await cssRes.text()
    check(
      'bundled styles remap tokens to var(--theme-bg)',
      css.includes('var(--theme-bg'),
      cssRes.status === 200 ? undefined : `status ${cssRes.status}`,
    )
  } else {
    check('bundled styles remap tokens to var(--theme-bg)', false, 'css link not found')
  }
} catch (e) {
  check('theme probe', false, String(e))
} finally {
  child.kill('SIGTERM')
  setTimeout(() => rmSync(DB_DIR, { recursive: true, force: true }), 200)
}
console.log(failures === 0 ? 'THEME_PROBE_DONE' : 'THEME_PROBE_HAD_FAILURES')
