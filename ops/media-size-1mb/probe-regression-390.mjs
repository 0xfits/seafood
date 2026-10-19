// 不回归探针 · 390×844：① 首页未传图商品仍用占位图（naturalWidth=320）② /item/new 选图字段仍在
// 会话：localStorage 假 JWT（结构合法 · 非真实凭据）；**/api/** 在 /item/new 页 abort（零写）
// 首页需要真实 /api/home 数据面 ⇒ 首页不 abort（只读 GET）
import { createRequire } from 'node:module'
import fs from 'node:fs'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5800'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/Users/kevin/bistro/seafood/ops/media-size-1mb/readings/regression-390.json'

const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa' })}.qa-probe-sig`
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Probe', nickname: 'QA-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN }

const run = async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const rec = { at: new Date().toISOString(), viewport: [390, 844], cases: {} }

  // ---------- ① 首页占位图 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${BASE}/zh`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-m="home-items"]', { timeout: 25000 })
    await page.waitForTimeout(1200)
    const imgs = await page.evaluate(() => Array.from(document.querySelectorAll('[data-sf-m="home-items"] img')).map((im) => ({
      src: (im.currentSrc || im.src || '').slice(0, 80),
      naturalWidth: im.naturalWidth,
      naturalHeight: im.naturalHeight,
      complete: im.complete,
    })))
    rec.cases.home_placeholder = {
      url: `${BASE}/zh`,
      img_count: imgs.length,
      imgs,
      pageErrors: errors,
      pass: imgs.length > 0 && imgs.some((i) => i.naturalWidth === 320 && i.naturalHeight === 320),
    }
    await ctx.close()
  }

  // ---------- ② /item/new 选图字段 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    await ctx.addInitScript((u) => {
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('token', u.token)
    }, USER)
    await ctx.route('**/api/**', (route) => route.abort())
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`${BASE}/zh/item/new`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-m="item-images"]', { timeout: 25000 })
    const field = await page.evaluate(() => {
      const input = document.querySelector('[data-sf-m="item-image-input"]')
      const add = document.querySelector('[data-sf-m="item-image-add"]')
      return {
        input: input ? { type: input.type, accept: input.getAttribute('accept'), multiple: input.multiple, display: getComputedStyle(input).display } : null,
        addButton: add ? { text: add.textContent.trim(), disabled: add.hasAttribute('disabled') } : null,
        containerPresent: !!document.querySelector('[data-sf-m="item-images"]'),
        docScrollWidth: document.documentElement.scrollWidth,
      }
    })
    rec.cases.publish_media_field = {
      url: `${BASE}/zh/item/new`,
      ...field,
      pageErrors: errors,
      pass: !!field.input && field.input.type === 'file' && String(field.input.accept).includes('image/*')
        && field.input.multiple === true && !!field.addButton && !field.addButton.disabled,
    }
    await ctx.close()
  }

  rec.summary = { total: 2, passed: Object.values(rec.cases).filter((c) => c.pass).length }
  fs.mkdirSync('/Users/kevin/bistro/seafood/ops/media-size-1mb/readings', { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(rec, null, 2)}\n`)
  console.log(JSON.stringify(rec, null, 2))
  await browser.close()
  process.exit(rec.summary.passed === 2 ? 0 : 1)
}

await run()
