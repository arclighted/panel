/**
 * Minimal .env loader for the web-side boot scripts (dev.mjs, index.mjs).
 *
 * The Express process loads .env relative to the project root
 * (`--env-file=.env` / loadEnv). The web process runs from `web/`, so this
 * resolves the repo root by walking up for `pnpm-workspace.yaml`, then fills
 * process.env with values that aren't already set. Mirrors the parser in
 * src/db.ts (strips surrounding quotes, never overrides existing env).
 */
import fs from 'node:fs'
import path from 'node:path'

export function findProjectRoot(startDir) {
  let dir = path.resolve(startDir)
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(startDir)
}

export function loadEnvFile() {
  const root = findProjectRoot(process.env.INIT_CWD || process.cwd())
  const envPath = path.join(root, '.env')
  if (!fs.existsSync(envPath)) return root
  const data = fs.readFileSync(envPath, 'utf8')
  for (const line of data.split('\n')) {
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    const value = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) {
      process.env[key] = value
    }
  }
  return root
}

/**
 * Resolves `file:./storage/dev.db` (relative to the project root) to an
 * absolute `file:/abs/path` URL in process.env.
 *
 * The web processes run from `web/`, but root modules bundled into the Nitro
 * server (e.g. src/db.ts, pulled in by daemonRequest → checkNodeStatus /
 * getServerStatus) resolve relative `file:` URLs against process.cwd().
 * Normalizing here makes every process agree on the same SQLite file.
 */
export function normalizeDatabaseUrl() {
  const raw = process.env.DATABASE_URL || 'file:./storage/dev.db'
  if (!raw.startsWith('file:')) return raw
  const rel = raw.slice('file:'.length)
  if (path.isAbsolute(rel)) return raw
  const root = findProjectRoot(process.env.INIT_CWD || process.cwd())
  const abs = path.resolve(root, rel)
  process.env.DATABASE_URL = `file:${abs}`
  return process.env.DATABASE_URL
}
