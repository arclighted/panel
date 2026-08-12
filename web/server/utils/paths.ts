/**
 * Resolves the repo root from the web process. The Nitro server runs from
 * `web/` (prod child spawn + dev Vite), but panel data lives at the project
 * root (storage/, public/). INIT_CWD (set by npm/pnpm to the invocation dir)
 * is the reliable anchor; fall back to walking up for pnpm-workspace.yaml.
 */
import fs from 'node:fs'
import path from 'node:path'

export function projectRoot(): string {
  let dir = path.resolve(process.env.INIT_CWD || process.cwd())
  for (let i = 0; i < 8; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir
    }
    const parent = path.dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return path.resolve(process.env.INIT_CWD || process.cwd())
}
