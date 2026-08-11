import { chromium } from '@playwright/test'
import fs from 'fs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const statePath = './report/auth.json'

if (!fs.existsSync(statePath)) {
  console.log('NO AUTH STATE — run setup first')
  process.exit(1)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: statePath })
const page = await ctx.newPage()

const requests = []
page.on('request', (r) => {
  if (r.url().includes('/admin/addons')) requests.push(`REQ ${r.method()} ${r.url().replace(baseURL, '')}`)
})
page.on('response', (r) => {
  if (r.url().includes('/admin/addons')) requests.push(`RES ${r.status()} ${r.url().replace(baseURL, '')}`)
})
page.on('console', (m) => {
  if (m.type() === 'error') console.log('CONSOLE-ERR:', m.text())
})

await page.goto(`${baseURL}/admin/addons`, { waitUntil: 'networkidle' })

// wait for both the list AND csrf availability
await page.waitForSelector('li:has-text("modrinth") button:has-text("Enable")', { timeout: 10000 })
await page.waitForFunction(() => {
  const meta = document.querySelector('meta[name="csrf-token"]')
  return meta && meta.getAttribute('content')?.length > 0
}, { timeout: 10000 }).catch(() => console.log('NO CSRF META FOUND'))

const csrfAtClick = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null)
console.log('csrf-token at click:', csrfAtClick ? csrfAtClick.slice(0, 12) + '…' : 'null')

await page.click('li:has-text("modrinth") button:has-text("Enable")')
await page.waitForTimeout(2500)

console.log(requests.join('\n'))
console.log('buttons now:', await page.locator('li:has-text("modrinth") button').allTextContents())

await browser.close()