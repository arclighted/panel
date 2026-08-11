import { chromium } from 'playwright';

const out = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => out.push('PAGEERROR: ' + e.stack.split('\n')[0]));
page.on('console', m => { if (m.type() === 'error') out.push('CONSOLE: ' + m.text()); });

try {
  // 1. login
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.fill('input[name="identifier"]', process.env.SMOKE_USER || 'smokeadmin');
  await page.fill('input[name="password"]', process.env.SMOKE_PASS || 'SmokePass123');
  await page.locator('button[type="submit"]').click();
  await page.waitForURL('**/*', { timeout: 15000 });
  await page.waitForTimeout(1500);
  out.push('AFTER_LOGIN_URL: ' + page.url());

  // 2. go to addons admin
  await page.goto('http://localhost:3000/admin/addons', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  out.push('ADDONS_TITLE: ' + (await page.title()));
  out.push('ADDONS_BODY: ' + (await page.evaluate(() => document.body.innerText.replace(/\n+/g, ' | ').slice(0, 600))));
} catch (e) {
  out.push('ERR: ' + e.message.split('\n')[0]);
}
await browser.close();
console.log(out.join('\n---\n'));