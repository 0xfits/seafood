/**
 * BATCH-1019-3 · 分页补充臂（loading 瞬态 + 失败重试复用 skip）
 *   arm slow  —— 夹具每页延迟 600ms：滚动期间必须出现 feed-loading，落地后必须消失（无残留）
 *   arm retry —— skip=36 首次返回 500：出 feed-error + feed-retry；等 2.5s 确认**不自动重试**
 *                （skip=36 只发 1 次）⇒ 点「重试」⇒ 复用同一 skip=36 ⇒ 成功 ⇒ 72 卡 ⇒ 第 3 页 ⇒ feed-end
 * 用法：node ops/batch-1019-3/qa/probe-paging-retry.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(path.join(REPO, 'frontend/package.json'))
const { chromium } = require('playwright')
const BASE = 'http://localhost:5787'
const OUT_DIR = path.join(REPO, 'ops/batch-1019-3/qa/readings')
fs.mkdirSync(OUT_DIR, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const row = (bID) => ({ bID, name: `海边小屋 · 分页夹具 ${bID}`, description: '夹具', points: 800 + bID, price: 800 + bID, stores_count: 2, claims_count: 0, media_urls: [], image_url: '', url_image: '' })
const PAGE = {
  0: Array.from({ length: 36 }, (_, i) => row(i + 1)),
  36: Array.from({ length: 36 }, (_, i) => row(i + 37)),
  72: Array.from({ length: 10 }, (_, i) => row(i + 71)),
}

const STATE = `(() => {
  const q = (h) => document.querySelector('[data-sf-m="' + h + '"]');
  const cards = [...document.querySelectorAll('[data-sf-m="feed-grid"] [data-sf-m="reward-card"]')];
  return {
    cards: cards.length,
    loading: !!q('feed-loading'), end: !!q('feed-end'), error: !!q('feed-error'), retry: !!q('feed-retry'), sentinel: !!q('feed-sentinel'),
    loadingText: q('feed-loading') ? q('feed-loading').textContent.trim() : null,
    endText: q('feed-end') ? q('feed-end').textContent.trim() : null,
  };
})()`

async function armSlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const hits = []
  await context.route('**/api/prize/all*', async (route) => {
    const u = new URL(route.request().url())
    const skip = Number(u.searchParams.get('skip') || 0)
    hits.push(skip)
    await new Promise((r) => setTimeout(r, 600))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: PAGE[skip] || [] }) })
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 25000 })
  await sleep(1200)
  const samples = []
  for (let i = 0; i < 30; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await sleep(120)
    const s = await page.evaluate(STATE)
    samples.push({ i, ...s })
    if (s.end) break
  }
  await sleep(700)
  const final = await page.evaluate(STATE)
  await context.close()
  return {
    arm: 'slow-600ms',
    hits,
    loading_samples: samples.filter((s) => s.loading).length,
    loading_seen_text: [...new Set(samples.filter((s) => s.loading).map((s) => s.loadingText))],
    card_progression: [...new Set(samples.map((s) => s.cards))],
    final,
    residual_loading: final.loading,
    pageErrors,
  }
}

async function armRetry(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const hits = []
  let failOnce = true
  await context.route('**/api/prize/all*', async (route) => {
    const u = new URL(route.request().url())
    const skip = Number(u.searchParams.get('skip') || 0)
    hits.push({ skip, t: Date.now() })
    if (skip === 36 && failOnce) {
      failOnce = false
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, message: 'fixture failure', error: { code: 'FIXTURE_FAIL' } }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, message: 'OK', data: PAGE[skip] || [] }) })
  })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e.message || e)))
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-sf-m="feed-grid"]', { timeout: 25000 })
  await sleep(600)

  // 滚动触发第 2 页（必然 500）
  for (let i = 0; i < 12; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await sleep(200)
    const s = await page.evaluate(STATE)
    if (s.error) break
  }
  const afterFail = await page.evaluate(STATE)
  const failHits = hits.filter((h) => h.skip === 36).length

  // 等 2.5s：确认不自动重试
  await sleep(2500)
  const autoRetryHits = hits.filter((h) => h.skip === 36).length
  const idleState = await page.evaluate(STATE)

  // 点重试
  await page.evaluate(() => {
    const btn = document.querySelector('[data-sf-m="feed-retry"]')
    if (btn) btn.click()
  })
  await sleep(900)
  const afterRetry = await page.evaluate(STATE)

  // 继续滚到底
  for (let i = 0; i < 15; i += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await sleep(220)
    const s = await page.evaluate(STATE)
    if (s.end) break
  }
  await sleep(500)
  const final = await page.evaluate(STATE)

  const retryButtonText = await page.evaluate(() => {
    const b = document.querySelector('[data-sf-m="feed-retry"]')
    return b ? b.textContent.trim() : null
  })

  await context.close()
  return {
    arm: 'retry-once',
    hits,
    distinct_skips: [...new Set(hits.map((h) => h.skip))],
    skip36_before_retry: failHits,
    skip36_after_idle_wait: autoRetryHits,
    auto_retry_observed: autoRetryHits > failHits,
    after_fail: afterFail,
    idle_after_2_5s: idleState,
    after_retry_click: afterRetry,
    retryButtonText,
    final,
    pageErrors,
  }
}

const run = async () => {
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true })
  const out = { at: new Date().toISOString(), base: BASE, arms: [] }
  out.arms.push(await armSlow(browser))
  out.arms.push(await armRetry(browser))
  await browser.close()
  fs.writeFileSync(path.join(OUT_DIR, 'probe-paging-retry.json'), JSON.stringify(out, null, 2))
  for (const a of out.arms) {
    console.log(a.arm, 'hits=', JSON.stringify(a.hits), 'loading_samples=', a.loading_samples, 'prog=', JSON.stringify(a.card_progression), 'final=', JSON.stringify(a.final))
  }
  console.log('DONE')
}
run().catch((e) => { console.error('FAILED', e); process.exit(1) })
