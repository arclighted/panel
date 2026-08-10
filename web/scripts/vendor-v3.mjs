#!/usr/bin/env node
/**
 * web/scripts/vendor-v3.mjs
 *
 * Produces the self-hosted ESM runtime for the addon v3 import map:
 *
 *   - web/public/vendor/react.mjs — ONE single-instance module serving the
 *     `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom` and
 *     `react-dom/client` import-map keys (hooks + createRoot + jsxDEV all in
 *     one file, so the browser never loads a second React).
 *   - web/public/vendor/react-router.mjs — @tanstack/react-router (react
 *     externalized, resolved through the import map).
 *   - web/public/vendor/react-query.mjs — @tanstack/react-query (same).
 *   - web/public/arclight-ui/* — the built @arclight/ui package (primitives
 *     addons consume).
 *
 * Addon bundles externalize these bare specifiers; the panel's import map
 * (web/src/routes/__root.tsx) resolves them to these files.
 *
 * WHY the react bundle is an IIFE + wrapper instead of plain `export * from`:
 * esbuild's ESM output cannot statically re-export React's CJS entry
 * (`module.exports = require('./cjs/react.production.js')` + a NODE_ENV
 * branch) — the output is a runtime `__reExport(...)` with NO export
 * statement, so `import ... from "react"` yields an empty namespace
 * (verified empirically). Bundling to an IIFE global (which returns the
 * runtime exports object) and re-exporting its keys from a small ESM wrapper
 * works and keeps everything in ONE module.
 *
 * Run:      node web/scripts/vendor-v3.mjs
 * CI check: node web/scripts/vendor-v3.mjs --check  (exits 1 on drift)
 *
 * NEVER hand-edit vendor files — the source of truth is node_modules + the
 * lockfile, exactly like scripts/build-vendor.mjs.
 */
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const WEB = resolve(ROOT, 'web')
const VENDOR_DIR = resolve(WEB, 'public', 'vendor')
const UI_DIR = resolve(WEB, 'public', 'arclight-ui')
const check = process.argv.includes('--check')

const esbuildBin = resolve(ROOT, 'node_modules', '.bin', 'esbuild')
if (!existsSync(esbuildBin)) {
  console.error('esbuild not found — cannot build v3 vendor bundles')
  process.exit(1)
}

const DEFINE_FLAG = "--define:process.env.NODE_ENV='\"production\"'"

/**
 * Bundle native-ESM packages (router, query) into an ESM vendor file.
 * `externals` stay as bare specifiers so the browser resolves them through
 * the panel's import map — this is what guarantees a SINGLE React instance.
 */
function bundleEsm(specifiers, outFile, externals = []) {
  const list = Array.isArray(specifiers) ? specifiers : [specifiers]
  const entry = join(VENDOR_DIR, `.entry-${outFile}.js`)
  writeFileSync(entry, list.map((s) => `export * from ${JSON.stringify(s)};\n`).join(''))
  const temp = join(VENDOR_DIR, `.out-${outFile}.js`)
  const extFlags = externals.map((e) => `--external:${e}`)
  execSync(
    `"${esbuildBin}" ${JSON.stringify(entry)} --bundle --outfile=${JSON.stringify(temp)} --format=esm --platform=browser --target=es2022 --minify --log-level=error ${DEFINE_FLAG} ${extFlags.join(' ')}`,
    { cwd: ROOT, stdio: 'inherit' },
  )
  const generated = readFileSync(temp, 'utf8')
  writeOut(outFile, generated, `${list.join(' + ')}`)
  cleanup([entry, temp])
}

/**
 * Bundle the react family into an IIFE global, then emit an ESM wrapper that
 * re-exports every key of that global (plus a default export for
 * `import React from 'react'`). All four react specifiers map to the SAME
 * file, so there is exactly one React instance in the browser.
 */
function bundleReactIife() {
  const globalName = 'ArclightRuntime'
  const entry = join(VENDOR_DIR, '.entry-react.js')
  writeFileSync(
    entry,
    ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'react-dom', 'react-dom/client']
      .map((s) => `export * from ${JSON.stringify(s)};\n`)
      .join(''),
  )
  const temp = join(VENDOR_DIR, '.out-react-iife.js')
  execSync(
    `"${esbuildBin}" ${JSON.stringify(entry)} --bundle --outfile=${JSON.stringify(temp)} --format=iife --global-name=${globalName} --platform=browser --target=es2022 --minify --log-level=error ${DEFINE_FLAG}`,
    { cwd: ROOT, stdio: 'inherit' },
  )
  const iife = readFileSync(temp, 'utf8')
  // Evaluate the IIFE in Node to enumerate the runtime export keys, then build
  // the ESM wrapper. React is DOM-lazy, so evaluating it here is safe.
  const ns = new Function(`${iife}\n;return ${globalName};`)()
  const keys = Object.keys(ns)
  const wrapper =
    iife +
    '\n' +
    'const React = ' +
    globalName +
    ';\n' +
    'export default React;\n' +
    keys.map((k) => `export const ${k} = React.${k};`).join('\n') +
    '\n'
  writeOut('react.mjs', wrapper, 'react + jsx-runtime + react-dom + react-dom/client')
  cleanup([entry, temp])
}

function writeOut(outFile, generated, label) {
  const out = join(VENDOR_DIR, outFile)
  if (check) {
    const current = existsSync(out) ? readFileSync(out, 'utf8') : null
    if (current !== generated) {
      console.error(`DRIFT: ${outFile} differs from bundled output`)
      process.exit(1)
    }
    console.log(`  ${label} → ${outFile} ✓`)
  } else {
    writeFileSync(out, generated)
    console.log(`  ${label} → ${outFile}`)
  }
}

function cleanup(files) {
  for (const f of files) {
    try {
      execSync(`rm -f ${JSON.stringify(f)}`)
    } catch {
      /* ignore */
    }
  }
}

/** Copy the built @arclight/ui dist into the web public dir. */
function copyUiPackage() {
  const src = resolve(ROOT, 'packages', 'ui', 'dist')
  const needed = ['index.js', 'index.css', 'index.d.ts']
  for (const f of needed) {
    const abs = join(src, f)
    if (!existsSync(abs)) {
      console.error(`@arclight/ui is not built (missing ${abs}) — run pnpm --filter @arclight/ui build`)
      process.exit(1)
    }
  }
  mkdirSync(UI_DIR, { recursive: true })
  for (const f of needed) {
    const content = readFileSync(join(src, f))
    const out = join(UI_DIR, f)
    if (check) {
      if (!existsSync(out) || !readFileSync(out).equals(content)) {
        console.error(`DRIFT: arclight-ui/${f} differs from packages/ui/dist`)
        process.exit(1)
      }
      console.log(`  @arclight/ui ${f} → arclight-ui/${f} ✓`)
    } else {
      writeFileSync(out, content)
      console.log(`  @arclight/ui ${f} → arclight-ui/${f}`)
    }
  }
}

mkdirSync(VENDOR_DIR, { recursive: true })

console.log('— v3 runtime vendor bundles —')
bundleReactIife()
bundleEsm('@tanstack/react-router', 'react-router.mjs', [
  'react', 'react/*', 'react-dom', 'react-dom/*', 'react/jsx-runtime',
])
bundleEsm('@tanstack/react-query', 'react-query.mjs', [
  'react', 'react/*', 'react/jsx-runtime',
])

console.log('— @arclight/ui —')
copyUiPackage()

console.log('Done.')
