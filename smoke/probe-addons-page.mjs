import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage();

const errors = [];
const badResponses = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().split('\n')[0]); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
page.on('response', r => { if (r.status() >= 400) badResponses.push(`${r.status()} ${r.request().method()} ${r.url()}`); });

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(12000);
await page.getByLabel('Username or Email').first().fill('smokeadmin');
await page.getByLabel('Password').first().fill('SmokePass123');
await page.getByRole('button', { name: /sign in|login|log in/i }).first().click();
await page.waitForTimeout(8000);

await page.goto(BASE + '/admin/addons', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);

const body = await page.locator('body').innerText();
console.log('ADMIN_ADDONS_URL:', page.url());
console.log('ADMIN_ADDONS_TITLE:', await page.title());
console.log('BODY_SNIPPET:', body.slice(0, 600).replace(/\n/g, ' | '));
console.log('HAS_TOGGLE:', /toggle|enable|disable|install/i.test(body));
console.log('BAD_RESPONSES:', JSON.stringify(badResponses, null, 2));
console.log('CONSOLE_ERRORS_FIRST_LINES:', JSON.stringify(errors, null, 2));

await browser.close();
