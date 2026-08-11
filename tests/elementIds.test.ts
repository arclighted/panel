import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Static integrity checks for the React (TanStack) surface: element IDs
// referenced in app code must be statically defined or created dynamically.
// The legacy EJS views and their `public/javascript` scripts were removed in
// the full cutover, so only the React app and addon views are scanned.

function walk(dir: string, acc: string[] = [], skip: Set<string>): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || skip.has(entry.name)) {continue;}
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {walk(full, acc, skip);}
    else if (/\.(ejs|tsx?|jsx?)$/.test(entry.name)) {acc.push(full);}
  }
  return acc;
}

const root = join(__dirname, '..');

const appSource: string[] = [];

function allSourceFiles(): string[] {
  const skip = new Set(['.tmp-ejs-lint', '.output', '.vite', 'dist', 'node_modules']);
  const files: string[] = [];
  walk(join(root, 'web', 'src'), files, skip);
  appSource.push(...walk(join(root, 'web', 'src'), [], skip));
  const addonViews = join(root, 'storage', 'addons');
  if (existsSync(addonViews)) {
    for (const addon of readdirSync(addonViews, { withFileTypes: true })) {
      if (!addon.isDirectory()) {continue;}
      // Addons that have fully migrated to v3 React UI have no views/ dir.
      const viewsDir = join(addonViews, addon.name, 'views');
      if (existsSync(viewsDir)) {walk(viewsDir, files, skip);}
    }
  }
  return files;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('element id integrity', () => {
  const files = allSourceFiles();

  const staticIds = new Set<string>();
  const dynamicIds = new Set<string>();
  const contents = new Map<string, string>();
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    contents.set(file, content);
    for (const m of content.matchAll(/id="([^"]+)"/g)) {staticIds.add(m[1]);}
    // element.id = 'x' or id:'x' inside template literals / objects
    for (const m of content.matchAll(/\bid\s*[=:]\s*['"]([^'"]+)['"]/g))
    {dynamicIds.add(m[1]);}
    for (const m of content.matchAll(
      /setAttribute\(\s*'id'\s*,\s*'([^']+)'\)/g,
    ))
    {dynamicIds.add(m[1]);}
  }

  it('React app getElementById targets exist statically or are created somewhere', () => {
    const offenders: string[] = [];
    for (const file of files) {
      if (!file.endsWith('.js') && !file.endsWith('.ts') && !file.endsWith('.tsx')) {continue;}
      const content = contents.get(file)!;
      for (const m of content.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)) {
        const id = m[1];
        if (staticIds.has(id) || dynamicIds.has(id)) {continue;}
        // created via innerHTML template in the same file
        const inHtml = new RegExp(`id=["']${escapeRegExp(id)}["']`);
        if (inHtml.test(content)) {continue;}
        offenders.push(`${file.replace(`${root  }/`, '')} -> ${id}`);
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });

  it('no code references the removed server-started-at element id', () => {
    for (const file of files) {
      const content = contents.get(file)!;
      expect(content).not.toMatch(/['"]server-started-at['"]/);
    }
  });

  it('addon views only reference ids defined in that view or shared includes', () => {
    const offenders: string[] = [];
    const addonViews = join(root, 'storage', 'addons');
    if (!existsSync(addonViews)) {return;}
    for (const addon of readdirSync(addonViews, { withFileTypes: true })) {
      if (!addon.isDirectory()) {continue;}
      const viewDir = join(addonViews, addon.name, 'views');
      if (!existsSync(viewDir)) {continue;}
      const viewFiles = walk(viewDir, [], new Set());
      for (const file of viewFiles) {
        const content = readFileSync(file, 'utf8');
        const localIds = new Set<string>();
        for (const m of content.matchAll(/id="([^"]+)"/g)) {localIds.add(m[1]);}
        for (const m of content.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)) {
          const code = m[1];
          for (const g of code.matchAll(
            /getElementById\(\s*['"]([^'"]+)['"]\s*\)/g,
          )) {
            const id = g[1];
            if (localIds.has(id)) {continue;}
            const created = new RegExp(`id\\s*[=:]\\s*['"]${escapeRegExp(id)}['"]`);
            if (created.test(content)) {continue;}
            offenders.push(`${file.replace(`${root  }/`, '')} -> ${id}`);
          }
        }
      }
    }
    expect([...new Set(offenders)]).toEqual([]);
  });
});
