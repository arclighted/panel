import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const lucide = require('lucide') as Record<string, unknown>;

function toPascalCase(name: string): string {
  return name
    .split('-')
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join('');
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.tmp-ejs-lint' || entry.name === '.output') {continue;}
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {walk(full, acc);}
    else if (/\.(ejs|ts|js)$/.test(entry.name)) {acc.push(full);}
  }
  return acc;
}

function serverIconNames(): string[] {
  // EJS views were removed in the full cutover; only the backend src (which
  // still serves the sidebar icon set via uiComponentHandler) is scanned.
  const files = walk(join(__dirname, '..', 'src'));
  const names = new Set<string>();
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const m of content.matchAll(/icon\(\s*'([a-z0-9-]+)'/g)) {names.add(m[1]);}
  }
  return [...names];
}

describe('icon vocabulary', () => {
  const serverNames = serverIconNames();

  it('every server-side icon() name resolves against lucide', () => {
    const missing = serverNames.filter(n => !lucide[toPascalCase(n)]);
    expect(missing).toEqual([]);
  });

  it('server-side icon() renders stroke-width 1.5 by default', async () => {
    const mod = await import('../src/utils/icon');
    const out = mod.default('x');
    expect(out).toContain('stroke-width="1.5"');
    expect(out).not.toContain('stroke-width="1.75"');
  });

});
