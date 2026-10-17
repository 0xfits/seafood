// 生产终验 · 真浏览器探针（0xseafood.com）
// 目的：curl/sha256 看不到白屏 ⇒ 必须真渲染一次，核 #root 有内容 + 零未捕获异常。
// 本机 DNS 被劫持 ⇒ Chrome 用 --host-resolver-rules 把域钉到真实 Vercel IP（76.76.21.21）。
// 运行：node ops/bttc-mint-shortfall/prod-verify/probe-prod-white-screen.mjs
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'

const REPO = '/Users/kevin/bistro/seafood'
const require = createRequire(`${REPO}/frontend/package.json`)
const { chromium } = require('playwright')

const OUT = path.join(REPO, 'ops/bttc-mint-shortfall/prod-verify/probe-result.json')
const IP = '76.76.21.21'
const TARGETS = ['/', '/activities']

const run = async () => {
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args: [`--host-resolver-rules=MAP 0xseafood.com ${IP}`, '--ignore-certificate-errors'],
  })
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(() => {
    window.__probe = { errors: [], rejections: [] }
    window.addEventListener('error', (e) => window.__probe.errors.push(String(e.message || e.error || '')))
    window.addEventListener('unhandledrejection', (e) => window.__probe.rejections.push(String(e.reason || '')))
  })
  const results = []
  for (const target of TARGETS) {
    const page = await context.newPage()
    const consoleErrors = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)) })
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${String(e.message).slice(0, 200)}`))
    let status = null
    try {
      const resp = await page.goto(`https://0xseafood.com${target}`, { waitUntil: 'networkidle', timeout: 45000 })
      status = resp ? resp.status() : null
      await page.waitForTimeout(1200)
      const info = await page.evaluate(() => {
        const root = document.getElementById('root')
        const shell = document.querySelector('.sf-shell')
        return {
          url: location.pathname,
          title: document.title,
          rootHtmlLen: root ? root.innerHTML.length : -1,
          rootChildren: root ? root.children.length : -1,
          shellPresent: !!shell,
          shellBg: shell ? getComputedStyle(shell).backgroundColor : null,
          dataTheme: document.documentElement.getAttribute('data-theme'),
          probe: window.__probe,
          bodyText: (document.body.innerText || '').slice(0, 160),
        }
      })
      results.push({ target, status, ...info, consoleErrors })
    } catch (error) {
      results.push({ target, status, gotoError: String(error).slice(0, 300), consoleErrors })
    }
    await page.close()
  }
  await browser.close()
  const verdict = results.every((r) => r.rootHtmlLen > 0 && (r.probe?.errors?.length ?? 0) === 0 && (r.probe?.rejections?.length ?? 0) === 0)
  fs.writeFileSync(OUT, JSON.stringify({ probe: 'prod-white-screen', ip: IP, verdict: verdict ? 'PASS' : 'FAIL', results }, null, 2))
  console.log(JSON.stringify({ verdict: verdict ? 'PASS' : 'FAIL', out: OUT, brief: results.map((r) => ({ target: r.target, status: r.status, rootHtmlLen: r.rootHtmlLen, shellBg: r.shellBg, theme: r.dataTheme, errs: r.probe?.errors?.length, rej: r.probe?.rejections?.length, consoleErrors: r.consoleErrors?.length })) }, null, 2))
}

run().catch((e) => { console.error('PROBE_CRASH', e); process.exit(1) })
