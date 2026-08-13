#!/usr/bin/env node
/**
 * Single-process development runner (Phase 5 — Express is deleted).
 *
 * Boots the whole stack with one command:
 *
 *   browser ──▶ Vite dev server (public, :3000) ── serves the TanStack app,
 *               every API, the WebSockets, the static surface, the addon
 *               runtime and the background workers — one process, one port,
 *               identical to production (web/server/index.mjs).
 *
 * Usage: pnpm run dev
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { loadEnvFile, normalizeDatabaseUrl } from '../web/server/env-loader.mjs'

// Load .env (repo root) so the dev server sees DATABASE_URL / SESSION_SECRET.
// DATABASE_URL is normalized to an absolute path so root modules bundled into
// the Vite (Nitro) dev server resolve the same SQLite file from web/ that the
// repo root uses.
loadEnvFile()
normalizeDatabaseUrl()

// If the env secret is missing or a known-insecure placeholder (example.env
// ships "change_me"), generate a shared dev secret for this boot — sessions
// won't survive a restart, but that's expected in dev.
const INSECURE_SECRETS = new Set([
  'change_me',
  'dev-only-insecure-secret-change-me',
  'secret',
  'changeme',
  'insecure',
])
if (
  !process.env.SESSION_SECRET ||
  process.env.SESSION_SECRET.length < 32 ||
  INSECURE_SECRETS.has(process.env.SESSION_SECRET)
) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex')
  console.warn(
    '[dev] SESSION_SECRET missing/insecure — generated a shared dev secret for this boot.',
  )
}

const PUBLIC_PORT = process.env.PORT ?? '3000'

const children = new Map()
let shuttingDown = false

function run(label, command, args, env = {}) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: process.platform === 'win32',
  })
  children.set(label, child)
  child.on('exit', (code, signal) => {
    children.delete(label)
    if (shuttingDown) return
    console.error(
      `[dev] ${label} exited (code=${code ?? 'signal:' + signal})`,
    )
    if (code !== 0) shutdown(code ?? 1)
  })
  return child
}

function shutdown(code = 0) {
  if (shuttingDown) return
  shuttingDown = true
  for (const child of children.values()) child.kill('SIGTERM')
  // Give children a moment to die, then force-exit.
  setTimeout(() => process.exit(code), 1500).unref()
}

function runOnce(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: process.env,
      shell: process.platform === 'win32',
    })
    child.on('exit', (code) => resolve(code ?? 1))
  })
}

process.on('SIGINT', () => shutdown(130))
process.on('SIGTERM', () => shutdown(143))

// 1. Apply DB migrations + generate the Prisma client (idempotent — this is
//    what the old `pnpm dev` did first).
const migrateCode = await runOnce('pnpm', ['exec', 'prisma', 'migrate', 'deploy'])
if (migrateCode !== 0) process.exit(migrateCode)
const genCode = await runOnce('pnpm', ['exec', 'prisma', 'generate'])
if (genCode !== 0) process.exit(genCode)

console.log('')
console.log('──────────────────────────────────────────────────────────────')
console.log('  Arclight dev stack')
console.log(`  TanStack app (Nitro) → http://localhost:${PUBLIC_PORT}`)
console.log('  Single process — no Express, no proxy seam')
console.log('  Ctrl+C stops everything')
console.log('──────────────────────────────────────────────────────────────')
console.log('')

// 2. Legacy EJS passthrough pages get their CSS from public/styles.css. The
//    Tailwind v4 CLI watch mode exits immediately when not attached to a TTY
//    (and in containers), so this is a one-shot build per `pnpm dev` start —
//    live CSS iteration on migrated pages goes through Vite's own Tailwind
//    pipeline, and `pnpm run build` regenerates styles.css for production.
run('tailwind', 'pnpm', [
  'exec',
  'tailwindcss',
  '-i',
  './public/tw.css',
  '-o',
  './public/styles.css',
])

// 3. TanStack Start dev server (Vite/Nitro) on the public port — the only
//    server. The addon runtime + background workers boot inside it
//    (web/server/middleware/03.addons.ts).
run('vite', 'pnpm', ['--filter', 'arclight-web', 'dev'], {
  PORT: PUBLIC_PORT,
})
