/**
 * Neng 独立质检 v1.21 —— 腿 4：AC-6 结构不变式 + 冻结面零改动 + i18n 计数 + 五 region / href 集
 * 只读：不写任何被测文件；不 commit / 不 push / 不 git add。
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const REPO = '/Users/kevin/bistro/seafood'
const FE = path.join(REPO, 'frontend')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const require_ = createRequire(path.join(FE, 'package.json'))
const { chromium } = require_('playwright')
const sh = (c) => { try { return execSync(c, { cwd: REPO, encoding: 'utf8' }).trim() } catch (e) { return 'ERR:' + String(e.stdout || e.message).trim() } }

const R = { meta: {}, ac6: {}, frozen: {}, i18n: {}, browser: {} }
R.meta = {
  head: sh('git log --oneline -2'),
  statusPorcelain: sh('git status --porcelain').split('\n'),
  numstat: sh('git diff --numstat'),
  refShots: {
    ref_xianyu: sh('shasum -a 256 ops/ui-card-ref-20261017/shots/ref-xianyu.png'),
    current_seafood: sh('shasum -a 256 ops/ui-card-ref-20261017/shots/current-seafood.png'),
  },
}

// ---- AC-6：shell.css 双边断言 ----
const shellCss = fs.readFileSync(path.join(FE, 'src/shell/shell.css'), 'utf8')
R.ac6.shell = {
  mediaCount: (shellCss.match(/@media/g) || []).length,
  dataThemeCount: (shellCss.match(/data-theme/g) || []).length,
  themeDayNight: (shellCss.match(/theme-day|theme-night/g) || []).length,
  cssSha256: sh('shasum -a 256 frontend/src/shell/shell.css').split(' ')[0],
}
R.ac6.shellVsParent = {
  parentSha256: sh('shasum -a 256 /Users/kevin/.hermes/profiles/zang/cache/scratch/neng-v121/parent/frontend/src/shell/shell.css').split(' ')[0],
  identical: false,
}
R.ac6.shellVsParent.identical = R.ac6.shell.cssSha256 === R.ac6.shellVsParent.parentSha256

// ---- 冻结面：文件级零 diff ----
const frozenFiles = [
  'frontend/src/shell/shell.css',
  'frontend/src/theme/tokens.js',
  'frontend/src/theme/theme-tokens.css',
  'frontend/src/theme/ThemeProvider.jsx',
  'docs/design/design-system.spec.md',
  'docs/design/style-preview.html',
]
R.frozen.files = {}
for (const f of frozenFiles) R.frozen.files[f] = { numstat: sh(`git diff --numstat -- ${f}`) || '(empty)', vsHeadNumstat: sh(`git diff --numstat HEAD -- ${f}`) || '(empty)', vsParentEqual: sh(`git diff --quiet HEAD -- ${f} && echo SAME || echo DIFF`) }
R.frozen.statusByArea = {}
for (const area of ['frontend/src/pages/item', 'frontend/src/pages/theme-preview.jsx', 'frontend/src/pages/theme-preview-demo.js', 'backend-ts', 'docs', 'tools', 'ctrl']) {
  R.frozen.statusByArea[area] = sh(`git status --porcelain -- ${area}`) || '(empty)'
}
R.frozen.themePreviewAny = sh("git status --porcelain -- frontend/src/pages | grep theme-preview") || '(empty)'

// ---- i18n 计数 ----
const flat = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' && !Array.isArray(v) ? flat(v, pre + k + '.') : [pre + k]))
const localeFiles = ['zh', 'en', 'hk', 'vn']
R.i18n.perLocale = {}
for (const l of localeFiles) {
  const j = JSON.parse(fs.readFileSync(path.join(FE, 'src/locales', `${l}.json`), 'utf8'))
  const keys = flat(j)
  R.i18n.perLocale[l] = { top: Object.keys(j).length, flat: keys.length, sortedSha: sh(`shasum -a 256 ${path.join(FE, 'src/locales', l + '.json')}`).split(' ')[0], keySetSha: sh(`node -e "" >/dev/null 2>&1; echo ok`) }
  R.i18n.perLocale[l].keys = keys
}
R.i18n.keySetEqual = localeFiles.every((l) => JSON.stringify(R.i18n.perLocale[l].keys.slice().sort()) === JSON.stringify(R.i18n.perLocale.zh.keys.slice().sort()))
R.i18n.zhTop = R.i18n.perLocale.zh.top
R.i18n.zhFlat = R.i18n.perLocale.zh.flat
R.i18n.fourLocaleNodes = R.i18n.perLocale.zh.flat * 4
R.i18n.frozenAssertions = { expected: { top: 128, flat: 1104, nodes: 4416 } }
R.i18n.localeNumstat = sh('git diff --numstat -- frontend/src/locales') || '(empty)'
for (const l of localeFiles) delete R.i18n.perLocale[l].keys

// ---- 浏览器：五 region / nav-link href 集 / 顶栏子树 ----
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json; charset=utf-8', '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' }
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--force-device-scale-factor=1', '--hide-scrollbars'] })
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, reducedMotion: 'reduce' })
  await ctx.route('**/*', (route) => {
    const u = new URL(route.request().url())
    if (u.hostname !== 'sf.local') return route.abort()
    if (u.pathname.startsWith('/api/')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: { tasks: [], prizes: [], claimed_prize_ids: [], user_points: 0, threads: [], next_cursor: null, total: 0 } }) })
    let f = path.join(FE, 'dist', decodeURIComponent(u.pathname))
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory() || !path.extname(f)) f = path.join(FE, 'dist', 'index.html')
    return route.fulfill({ status: 200, headers: { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }, body: fs.readFileSync(f) })
  })
  const p = await ctx.newPage()
  await p.goto('http://sf.local/', { waitUntil: 'load' })
  await p.waitForSelector('#header', { timeout: 8000 }).catch(() => {})
  await p.waitForTimeout(400)
  R.browser = await p.evaluate(() => ({
    regions: [...document.querySelectorAll('[data-sf-region]')].map((e) => ({ region: e.getAttribute('data-sf-region'), tag: e.tagName, id: e.id || '', cls: String(e.className || '').slice(0, 60) })),
    regionSet: [...new Set([...document.querySelectorAll('[data-sf-region]')].map((e) => e.getAttribute('data-sf-region')))].sort(),
    navLinkHrefs: [...document.querySelectorAll('#header .nav-link[href]')].map((e) => new URL(e.href).pathname).sort(),
    topnavBrand: !!document.querySelector('[data-sf-region="topnav"] a[href="/"]'),
    topnavLangButtons: document.querySelectorAll('[data-sf-region="topnav"] button').length,
    headerInnerNavLinkCount: document.querySelectorAll('#header .nav-link').length,
    headerInnerNavLinkClasses: [...document.querySelectorAll('#header .nav-link')].map((e) => ({ tag: e.tagName, cls: String(e.className), text: (e.textContent || '').trim().slice(0, 12) })),
    tabbarLinks: [...document.querySelectorAll('[data-sf-region="tabbar"] a')].map((e) => new URL(e.href).pathname).sort(),
    headerClass: document.getElementById('header').className,
    headerChildCount: document.getElementById('header').querySelectorAll('*').length,
    rootInnerLen: (document.getElementById('root') || {}).innerHTML ? document.getElementById('root').innerHTML.length : 0,
  }))
  await ctx.close()
} finally { await browser.close() }

fs.writeFileSync(path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-v121-static.json'), JSON.stringify(R, null, 2))
console.log('[leg4] static checks written')
console.log(JSON.stringify({ ac6: R.ac6, frozenBrief: Object.fromEntries(Object.entries(R.frozen.files).map(([k, v]) => [k, v.vsHeadNumstat])), statusByArea: R.frozen.statusByArea, i18n: { top: R.i18n.zhTop, flat: R.i18n.zhFlat, nodes: R.i18n.fourLocaleNodes, keySetEqual: R.i18n.keySetEqual }, browser: { regionSet: R.browser.regionSet, navLinkHrefs: R.browser.navLinkHrefs, headerClass: R.browser.headerClass } }, null, 2))
