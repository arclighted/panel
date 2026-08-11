import { chromium } from 'playwright'
import fs from 'fs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const statePath = './report/auth-fresh.json'

const browser = await chromium.launch()
const ctx = await browser.newContext(fs.existsSync(statePath) ? { storageState: statePath } : {})
const page = await ctx.newPage()

const requests = []
page.on('request', (r) => {
  if (r.url().includes('/admin/addons')) requests.push(`REQ ${r.method()} ${r.url().replace(baseURL, '')}`)
})
page.on('response', (r) => {
  if (r.url().includes('/admin/addons')) requests.push(`RES ${r.status()} ${r.url().replace(baseURL, '')}`)
})
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message))

await page.goto(`${baseURL}/admin/addons`, { waitUntil: 'networkidle' })

// fresh login if storage state is stale
if (!(await page.locator('li:has-text("arclight-cloud")').count())) {
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[name="identifier"]', process.env.SMOKE_USER ?? 'smokeadmin')
  await page.fill('input[name="password"]', process.env.SMOKE_PASS ?? 'SmokePass123')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/')
  await page.goto(`${baseURL}/admin/addons`, { waitUntil: 'networkidle' })
}

const btn = page.locator('li:has-text("arclight-cloud") button', { hasText: /Enable|Disable/ }).first()
console.log('arclight-cloud button:', await btn.allTextContents().catch(() => 'MISSING'))
await btn.click()

// wait for a response on the toggle endpoint, up to 15s
const respPromise = page.waitForResponse((r) => r.url().includes('/admin/addons/toggle/'), { timeout: 15000 }).catch(() => null)
const resp = await respPromise
console.log('toggle response:', resp ? `${resp.status()} ${resp.url().replace(baseURL, '')}` : 'NO RESPONSE (15s)')

console.log(requests.join('\n'))
console.log('buttons now:', await page.locator('li:has-text("arclight-cloud") button').allTextContents())

await browser.close()