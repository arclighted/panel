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
