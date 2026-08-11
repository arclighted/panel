import { chromium } from 'playwright';

const out = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => out.push('PAGEERROR: ' + e.stack.split('\n').slice(0, 4).join(' | ')));
page.on('console', m => {
  if (['error', 'warning'].includes(m.type())) out.push('CONSOLE_' + m.type().toUpperCase() + ': ' + m.text().slice(0, 300));
});
page.on('requestfailed', r => out.push('REQFAIL: ' + r.url().slice(0, 100) + ' -> ' + (r.failure() || {}).errorText));

try {
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
  out.push('WAIT for hydration (12s first-compile)');
  await page.waitForTimeout(12000);

  const pre = await page.evaluate(() => ({
    title: document.title,
    formCount: document.querySelectorAll('form').length,
    hasImportmap: !!document.querySelector('script[type="importmap"]'),
    clientEntryLoaded: [...performance.getEntriesByType('resource')].some(r => r.name.includes('tanstack-start-dev-client-entry')),
    vendorReactLoaded: [...performance.getEntriesByType('resource')].some(r => r.name.includes('vendor/react')),
  }));
  out.push('PRE: ' + JSON.stringify(pre));

  // try interacting: fill + click, then check url AFTER 3s
  await page.fill('input[name="identifier"]', 'smokeadmin');
  await page.fill('input[name="password"]', 'SmokePass123');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  out.push('POST_CLICK_URL: ' + page.url());
} catch (e) {
  out.push('ERR: ' + e.message.split('\n')[0]);
}
await browser.close();
console.log(out.join('\n---\n'));