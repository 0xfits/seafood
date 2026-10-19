// 浏览器探针 · 390×844 发布页「单张图片 1MiB 硬顶」（dev 5800）
// 契约（Kevin 2026-10-19）：客户端压缩后编码字节 ≤1MiB=1,048,576；超限按质量档 [0.82,0.72,0.62,0.5]
//   × 边长档 [1280,1120,960,832] 逐级降级重编码，命中即收；全档位仍超 ⇒ 该张拒收
//   （`item.imageTooLarge` 文案可见、不入列表）。
//
// 配方承 ops/media-upload/frontend-b/probe-390.md 与 ops/item-cid-select/probe-job-form.mjs：
//   · createRequire(<仓>/frontend/package.json) ⇒ 用仓内 playwright，不 npm install
//   · 探针会话 = localStorage('user') 预置的**结构合法假 JWT**（payload exp 远期），不是任何真实凭据
//   · **/api/** 全部 abort（零写请求、零后端口径依赖；货币下拉走 FALLBACK $，表单照常渲染）
//   · 「超大图」用 initScript 包装 HTMLCanvasElement.prototype.toDataURL 强制超限（桩，非真实编码）
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const require = createRequire('/Users/kevin/bistro/seafood/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5800'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const DIR = '/Users/kevin/bistro/seafood/ops/media-size-1mb'
const OUT = path.join(DIR, 'readings/probe-390.json')
const FIXTURE = path.join(DIR, 'fixtures/probe-2400x600.png')
const CAP = 1048576
const HUGE_B64 = 'A'.repeat(4 * 349526) // ⇒ 解码 1,048,578 bytes（超硬顶 2 字节）

// ---- 真 PNG 编码（RGB8 · filter 0 · 无第三方依赖）-----------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
})()
const crc32 = (buf) => {
  let c = -1
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ -1) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body), 0)
  return Buffer.concat([len, body, crc])
}
/** 2400×600 渐变 + 斜纹 ⇒ 真实可解码、压缩后远小于 1MiB 的「正常图」 */
const writePng = (file, width, height) => {
  const raw = Buffer.alloc(height * (1 + width * 3))
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3)
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const i = row + 1 + x * 3
      raw[i] = (x * 255 / width) | 0
      raw[i + 1] = (y * 255 / height) | 0
      raw[i + 2] = ((x + y) % 97) * 2
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, png)
  return png.length
}

// ---- 探针会话（结构合法假 JWT · 非真实凭据）----------------------------------
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const TOKEN = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ exp: 4102444800, sub: 'qa' })}.qa-probe-sig`
const USER = { uid: 500, id: 500, user_id: 500, name: 'QA-Probe', nickname: 'QA-Probe', bio: 'qa', token: TOKEN, access_token: TOKEN }

/** 包装 toDataURL 记录真实编码序列；mode 决定是否强制超限 */
const initEncodeProbe = ([mode, huge]) => {
  window.__encLog = []
  const orig = HTMLCanvasElement.prototype.toDataURL
  let calls = 0
  HTMLCanvasElement.prototype.toDataURL = function enc(type, quality) {
    calls += 1
    const real = orig.apply(this, arguments)
    window.__encLog.push({ type, quality, w: this.width, h: this.height, bytes: Math.floor(((real.split(',')[1] || '').length * 3) / 4) })
    if (mode === 'huge-all') return `data:image/webp;base64,${huge}`
    if (mode === 'huge-first' && calls === 1) return `data:image/webp;base64,${huge}`
    return real
  }
}

const readDom = () => {
  const thumbs = Array.from(document.querySelectorAll('[data-sf-m^="item-image-thumb-"]'))
  const notice = document.querySelector('[data-sf-m="item-image-notice"]')
  const srcOf = (t) => (t.querySelector('img') || {}).getAttribute ? t.querySelector('img').getAttribute('src') : ''
  const bytesOf = (s) => {
    const b64 = s.slice(s.indexOf(',') + 1)
    const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
    return Math.floor((b64.length * 3) / 4) - pad
  }
  return {
    thumbCount: thumbs.length,
    thumbIds: thumbs.map((t) => t.getAttribute('data-sf-m')),
    srcPrefixes: thumbs.map((t) => String(srcOf(t)).slice(0, 16)),
    thumbBytes: thumbs.map((t) => bytesOf(String(srcOf(t)))),
    notice: notice ? { text: notice.textContent, role: notice.getAttribute('role'), visible: !!notice.offsetParent } : null,
    addDisabled: !!document.querySelector('[data-sf-m="item-image-add"]')?.hasAttribute('disabled'),
    docScrollWidth: document.documentElement.scrollWidth,
    encodeLog: window.__encLog || [],
  }
}

const run = async () => {
  const pngBytes = writePng(FIXTURE, 2400, 600)
  const browser = await chromium.launch({ headless: true, executablePath: CHROME })
  const rec = {
    url: `${BASE}/zh/item/new`,
    viewport: [390, 844],
    at: new Date().toISOString(),
    fakeSession: { storageKey: 'user', tokenPayloadExp: 4102444800, realCredentials: false },
    api: 'all **/api/** aborted (zero writes)',
    capBytes: CAP,
    fixture: { path: FIXTURE, width: 2400, height: 600, pngBytes },
    cases: {},
  }

  const openPage = async (mode) => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
    await ctx.addInitScript((u) => {
      localStorage.setItem('user', JSON.stringify(u))
      localStorage.setItem('token', u.token)
    }, USER)
    await ctx.addInitScript(initEncodeProbe, [mode, HUGE_B64])
    await ctx.route('**/api/**', (route) => route.abort())
    const page = await ctx.newPage()
    const pageErrors = []
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    await page.goto(`${BASE}/zh/item/new`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-sf-m="item-images"]', { timeout: 20000 })
    return { ctx, page, pageErrors }
  }

  const pick = async (page) => {
    await page.setInputFiles('[data-sf-m="item-image-input"]', {
      name: 'probe-2400x600.png',
      mimeType: 'image/png',
      buffer: fs.readFileSync(FIXTURE),
    })
  }

  // ---------------- P1 · 正常图（真实编码）⇒ 入列且 ≤1MiB ----------------
  {
    const { ctx, page, pageErrors } = await openPage('passthrough')
    await pick(page)
    await page.waitForFunction(() => document.querySelectorAll('[data-sf-m^="item-image-thumb-"]').length > 0, { timeout: 15000 })
    await page.waitForTimeout(150)
    rec.cases.P1_normal_image = { ...(await page.evaluate(readDom)), pageErrors }
    rec.cases.P1_normal_image.pass = rec.cases.P1_normal_image.thumbCount === 1
      && rec.cases.P1_normal_image.thumbBytes.every((b) => b <= CAP)
      && rec.cases.P1_normal_image.notice === null
    await ctx.close()
  }

  // ---------------- P2 · 全档位强制超限（toDataURL 桩）⇒ 拒收 + 提示 ----------------
  {
    const { ctx, page, pageErrors } = await openPage('huge-all')
    await pick(page)
    await page.waitForSelector('[data-sf-m="item-image-notice"]', { timeout: 20000 })
    rec.cases.P2_oversized_rejected = { ...(await page.evaluate(readDom)), pageErrors }
    const c = rec.cases.P2_oversized_rejected
    c.pass = c.thumbCount === 0 && c.notice?.text === '单张图片不能超过 1MB' && c.notice?.role === 'alert'
      && c.encodeLog.length === 16
    await ctx.close()
  }

  // ---------------- P3 · 首档超限 ⇒ 降级重编命中（桩一次）⇒ 入列 ----------------
  {
    const { ctx, page, pageErrors } = await openPage('huge-first')
    await pick(page)
    await page.waitForFunction(() => document.querySelectorAll('[data-sf-m^="item-image-thumb-"]').length > 0, { timeout: 15000 })
    await page.waitForTimeout(150)
    rec.cases.P3_downgrade_then_accept = { ...(await page.evaluate(readDom)), pageErrors }
    const c = rec.cases.P3_downgrade_then_accept
    c.pass = c.thumbCount === 1 && c.thumbBytes.every((b) => b <= CAP)
      && c.encodeLog.length >= 2 && c.encodeLog[1].quality === 0.72
    await ctx.close()
  }

  rec.summary = {
    total: Object.keys(rec.cases).length,
    passed: Object.values(rec.cases).filter((c) => c.pass).length,
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, `${JSON.stringify(rec, null, 2)}\n`)
  console.log(JSON.stringify({ out: OUT, summary: rec.summary }, null, 2))
  for (const [k, v] of Object.entries(rec.cases)) {
    console.log(`${k}: pass=${v.pass} thumbs=${v.thumbCount} bytes=${JSON.stringify(v.thumbBytes)} notice=${JSON.stringify(v.notice)} enc=${v.encodeLog.length} pageErrors=${v.pageErrors.length}`)
  }
  await browser.close()
  process.exit(rec.summary.passed === rec.summary.total ? 0 : 1)
}

await run()
