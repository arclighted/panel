import { chromium } from 'playwright';

const url = process.env.PROBE_URL || 'http://localhost:3000/login';
const out = [];
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', e => out.push('PAGEERROR: ' + e.stack));
page.on('console', m => { if (m.type() === 'error') out.push('CONSOLE: ' + m.text()); });
try {
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
  out.push('HTTP: ' + (resp && resp.status()));
  await page.waitForTimeout(2000);
  out.push('BODY: ' + (await page.evaluate(() => document.body ? document.body.innerText.slice(0, 500) : 'NO BODY')));
} catch (e) {
  out.push('GOTO_ERR: ' + e.message.split('\n')[0]);
}
await browser.close();
console.log(out.join('\n---\n'));