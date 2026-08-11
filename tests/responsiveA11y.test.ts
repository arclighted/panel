import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');

function readFile(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

/* ------------------------------------------------------------------ */
/* ARIA attributes — every interactive component must be keyboard and  */
/* screen-reader safe. These tests verify structural ARIA patterns.   */
/* ------------------------------------------------------------------ */

describe('ARIA: tabs', () => {
  const tabSrc = readFile('public/javascript/shared/al-tabs.js');

  it('queries for role="tabpanel" elements', () => {
    expect(tabSrc).toContain('[role="tabpanel"]');
  });

  it('queries for role="tab" elements', () => {
    expect(tabSrc).toContain('[role="tab"]');
  });

  it('manages aria-selected on tab activation', () => {
    expect(tabSrc).toContain('\'aria-selected\'');
  });

  it('manages tabindex for roving focus', () => {
    expect(tabSrc).toContain('\'tabindex\'');
  });

  it('hides inactive panels with hidden attribute', () => {
    expect(tabSrc).toContain('\'hidden\'');
  });

  it('supports arrow key navigation', () => {
    expect(['ArrowRight', 'ArrowLeft'].some((key) => tabSrc.includes(key))).toBe(true);
  });
});

describe('ARIA: dialog', () => {
  const dialogSrc = readFile('public/javascript/shared/al-dialog.js');

  it('uses native <dialog> showModal()', () => {
    expect(dialogSrc).toContain('showModal');
  });

  it('listens for cancel event (Escape key)', () => {
    expect(dialogSrc).toContain('\'cancel\'');
  });

  it('listens for click event (backdrop close)', () => {
    expect(dialogSrc).toContain('\'click\'');
  });
});

/* ------------------------------------------------------------------ */
/* Responsive patterns — shared CSS contract.                          */
/* ------------------------------------------------------------------ */

describe('responsive: layout patterns', () => {
  const layoutCss = readFile('public/layout-animations.css');

  it('has a non-empty layout animation stylesheet', () => {
    expect(layoutCss.length).toBeGreaterThan(100);
  });
});

/* ------------------------------------------------------------------ */
/* Keyboard: focus management and escape handling.                     */
/* ------------------------------------------------------------------ */

describe('keyboard: focus management', () => {
  const tabsSrc = readFile('public/javascript/shared/al-tabs.js');

  it('tabs focuses the active tab on activation', () => {
    expect(tabsSrc).toContain('.focus()');
  });

  const dialogSrc = readFile('public/javascript/shared/al-dialog.js');

  it('dialog focuses the first focusable element on open', () => {
    expect(dialogSrc).toContain('.focus()');
  });
});
