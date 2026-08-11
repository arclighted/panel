#!/usr/bin/env node
/**
 * storage/addons/arclight-cloud/scripts/build-ui.mjs
 *
 * Builds the addon v3 UI bundle (the reference implementation for
 * docs/addon-ui-contract-v3.md):
 *
 *   src/ui-v3/index.tsx  →  public/ui/bundle.mjs  (+ styles.css)
 *
 * The bundle EXTERNALIZES the shared runtime — react, react-dom,
 * react/jsx-runtime, @arclight/ui, and @tanstack/react-query stay as bare
 * specifiers so the browser resolves them through the panel's import map
 * (single React instance, shared QueryClient context).
 *
 * @arclight/ui is resolved to the workspace package (packages/ui). When the
 * addon is published to the marketplace, install @arclight/ui as a dependency
 * and the panel will serve it via the import map.
 *
 * Run: pnpm --dir storage/addons/arclight-cloud build:ui
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ADDON_DIR = resolve(__dirname, '..')
const ROOT = resolve(ADDON_DIR, '..', '..', '..')
const esbuildBin = resolve(ROOT, 'node_modules', '.bin', 'esbuild')
const outDir = join(ADDON_DIR, 'public', 'ui')
const entry = join(ADDON_DIR, 'src', 'ui-v3', 'index.tsx')

if (!existsSync(esbuildBin)) {
  console.error('esbuild not found — run pnpm install at the repo root first')
  process.exit(1)
}
if (!existsSync(entry)) {
  console.error(`UI entry not found: ${entry}`)
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })

// The addon's own node_modules resolves axios/adm-zip; the shared runtime is
// external. @arclight/ui resolves through the workspace symlink at the repo
// root — the import map serves the built copy at /arclight-ui/index.js.
// @arclight/ui stays external: the panel's import map serves the built copy
// at /arclight-ui/index.js (copied from packages/ui/dist by vendor-v3.mjs).
// Addons never bundle it — they import it as a bare specifier.
const arclightUiDist = resolve(ROOT, 'packages', 'ui', 'dist', 'index.js')
if (!existsSync(arclightUiDist)) {
  console.error(`@arclight/ui not built — run pnpm --filter @arclight/ui build first`)
  process.exit(1)
}

const args = [
  JSON.stringify(entry),
  '--bundle',
  '--outfile=' + JSON.stringify(join(outDir, 'bundle.mjs')),
  '--format=esm',
  '--platform=browser',
  '--target=es2022',
  '--minify',
  '--log-level=error',
  "--define:process.env.NODE_ENV='\"production\"'",
  '--external:react',
  '--external:react-dom',
  '--external:react-dom/client',
  '--external:react/jsx-runtime',
  '--external:react/jsx-dev-runtime',
  '--external:@arclight/ui',
  '--external:@tanstack/react-query',
  '--external:@tanstack/react-query/*',
  '--jsx=automatic',
].join(' ')

console.log(`Building arclight-cloud v3 UI → ${join('public', 'ui', 'bundle.mjs')}`)
execSync(`"${esbuildBin}" ${args}`, { cwd: ROOT, stdio: 'inherit' })

// Verify no react/@arclight/ui got inlined (store checklist item).
const bundle = readFileSync(join(outDir, 'bundle.mjs'), 'utf8')
const size = Buffer.byteLength(bundle)
console.log(`  bundle size: ${(size / 1024).toFixed(1)} KB`)
console.log(`  imports: ${[...new Set(bundle.match(/from"[^"]+"/g) ?? [])].join(' ') || '(none)'}`)
console.log('Done.')
