import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage();

// capture console errors
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
await page.waitForTimeout(12000); // hydration window

const identifier = page.getByLabel('Username or Email').first();
const password = page.getByLabel('Password').first();
console.log('IDENTIFIER_VISIBLE:', await identifier.isVisible());
console.log('PASSWORD_VISIBLE:', await password.isVisible());

await identifier.fill('smokeadmin');
await password.fill('SmokePass123');
await page.getByRole('button', { name: /sign in|login|log in/i }).first().click();

await page.waitForTimeout(8000);
console.log('URL_AFTER_SUBMIT:', page.url());
console.log('BODY_HAS_LOGOUT:', await page.locator('body').innerText().then(t => /log ?out|sign ?out/i.test(t)));

// try to reach admin addons directly with the session
await page.goto(BASE + '/admin/addons', { waitUntil: 'networkidle' });
await page.waitForTimeout(6000);
console.log('ADMIN_ADDONS_URL:', page.url());
console.log('ADMIN_ADDONS_STATUS:', page.locator('body').innerText().then(t => t.slice(0, 300).replace(/\n/g, ' | ')));

console.log('CONSOLE_ERRORS:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
