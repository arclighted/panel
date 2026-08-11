import { chromium } from '@playwright/test'
import fs from 'fs'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'
const statePath = './report/auth.json'
if (!fs.existsSync(statePath)) { console.log('NO AUTH STATE'); process.exit(1) }

const browser = await chromium.launch()
const ctx = await browser.newContext({ storageState: statePath })
const page = await ctx.newPage()

const net = []
page.on('request', (r) => { if (r.url().includes('/admin/addons')) net.push(`REQ ${r.method()} ${new URL(r.url()).pathname}`) })
page.on('response', async (r) => {
  if (r.url().includes('/admin/addons')) net.push(`RES ${r.status()} ${new URL(r.url()).pathname}`)
})

await page.goto(`${baseURL}/admin/addons`, { waitUntil: 'networkidle' })
await page.waitForSelector('li:has-text("modrinth") button:has-text("Enable")', { timeout: 10000 })

const metaToken = await page.evaluate(() => document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') ?? null)
const cookies = await ctx.cookies(baseURL)
const csrfCookie = cookies.find(c => c.name.includes('csrf'))
console.log('=== cookies ===')
for (const c of cookies) console.log(`${c.name} = ${c.value.slice(0, 16)}… (sameSite=${c.sameSite}, domain=${c.domain}, path=${c.path})`)
console.log('meta token   =', metaToken ? metaToken.slice(0, 16) + '…' : 'null')
console.log('cookie match =', csrfCookie ? (csrfCookie.value === metaToken ? 'YES' : 'NO — DIVERGED') : 'NO CSRF COOKIE')

// capture POST response body
page.on('response', async (r) => {
  if (r.url().includes('/toggle/')) {
    console.log('POST status:', r.status())
    console.log('POST body:', await r.text().catch(() => '(<no body>)'))
  }
})
await page.click('li:has-text("modrinth") button:has-text("Enable")')
await page.waitForTimeout(2000)
console.log(net.join('\n'))
await browser.close()
