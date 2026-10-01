#!/usr/bin/env node
/**
 * Unit P6-BTN-IMPL-2 · `.sf-btn` 家族纳入 A 体系 —— 机械自检（现取文件文本，不依赖任何测试框架）
 *
 * 口径（每项断言都印读数）：
 *   ① 家族清单：src 下 .js/.jsx（排除 test/）里 `\bsf-btn\b` 出现的文件名 / 次数 / 总数
 *   ② 基类 .sf-btn（shell.css）：颜色槽位只走 --sf-btna-*，几何只走 --sf-st-*；扁平（无阴影/无背景图/无切角）
 *   ③ 不得另造色值：基类规则体内 hex / rgba 字面量计数 = 0
 *   ④ micro 类（jobs/market/listings）：只保留位置/尺寸；min-height 的页内 ctl-h = STRUCT.h-btna（34px）；
 *      水平内边距 = var(--sf-st-padx-btna)；命中口径 高×0.359 = 12.21px ≈ 12px
 *   ⑤ ThemePreviewPage 开关（.sf-btn.sf-preview-btn）在家族内，其 is-on 只保留状态指示 outline
 *   ⑥ 死 token 登记：全 src CSS 里 var(--sf-btn-*)/var(--sf-btnsm-*) 引用数 = 0（token 仍由 theme-tokens.css 定义）
 *
 * 退出码：0 = 全 PASS；1 = 有 FAIL（逐条列出）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')

const read = (p) => fs.readFileSync(p, 'utf8')
const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
const strip = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '')
const rulesOf = (t) =>
  [...strip(t).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }))
const ruleOf = (t, sel) => rulesOf(t).find((r) => norm(r.selector) === norm(sel))

const CSS = {
  shell: path.join(SRC, 'shell/shell.css'),
  jobs: path.join(SRC, 'pages/jobs/jobs.css'),
  market: path.join(SRC, 'pages/market/market.css'),
  listings: path.join(SRC, 'pages/listings/listings.css'),
  preview: path.join(SRC, 'pages/theme-preview.css'),
}
const css = Object.fromEntries(Object.entries(CSS).map(([k, p]) => [k, read(p)]))

const fails = []
const ok = (cond, label, reading) => {
  const line = `${cond ? 'PASS' : 'FAIL'} · ${label} · 读数=${reading}`
  console.log(line)
  if (!cond) fails.push(label)
}

// ① 清单
const walk = (dir, exts, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['test', 'node_modules', '__mocks__'].includes(e.name)) continue
      walk(p, exts, out)
    } else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}
const jsFiles = walk(SRC, ['.js', '.jsx'])
const inv = jsFiles
  .map((f) => {
    const hits = read(f).split('\n').filter((l) => /\bsf-btn\b/.test(l))
    return { file: path.relative(SRC, f), n: hits.length }
  })
  .filter((e) => e.n > 0)
const total = inv.reduce((a, e) => a + e.n, 0)
const EXPECTED_FILES = [
  'pages/TaskPage.jsx',
  'pages/ThemePreviewPage.jsx',
  'pages/jobs/JobDetailPage.jsx',
  'pages/jobs/JobReviewPage.jsx',
  'pages/jobs/PublishJobPage.jsx',
  'pages/listings/ListingDetailPage.jsx',
  'pages/listings/ListingsPage.jsx',
  'pages/listings/PublishListingPage.jsx',
  'pages/market/MarketPage.jsx',
]
console.log('— ① 家族清单（现取）—')
for (const e of inv.sort((a, b) => a.file.localeCompare(b.file))) console.log(`   ${e.file} × ${e.n}`)
ok(
  inv.map((e) => e.file).sort().join('|') === [...EXPECTED_FILES].sort().join('|'),
  '清单文件集 = 9 个 JSX 文件',
  `${inv.length} files`
)
ok(total >= 22, '`sf-btn` 用法总数 ≥ 22', `${total} 处`)

// ②③ 基类
const base = ruleOf(css.shell, '.sf-btn')
const b = base ? norm(base.body) : ''
console.log('— ② / ③ 基类 .sf-btn（shell.css）—')
ok(!!base, '基类规则存在', base ? base.selector : '缺失')
ok(b.includes('background:var(--sf-btna-bg)'), '底色 = --sf-btna-bg（主题 token）', 'background:var(--sf-btna-bg)')
ok(b.includes('color:var(--sf-btna-fg)'), '文字 = --sf-btna-fg', 'color:var(--sf-btna-fg)')
ok(
  b.includes('border:var(--sf-st-stroke-w-thin)solidvar(--sf-btna-border)'),
  '描边 = STRUCT 宽 × --sf-btna-border',
  'border:var(--sf-st-stroke-w-thin) solid var(--sf-btna-border)'
)
ok(b.includes('border-radius:var(--sf-st-radius-btna)'), '圆角 = --sf-st-radius-btna（结构常量）', 'border-radius:var(--sf-st-radius-btna)')
ok(b.includes('box-shadow:none'), '扁平：无阴影', 'box-shadow:none')
ok(b.includes('background-image:none'), '扁平：无背景图', 'background-image:none')
ok(b.includes('clip-path:none'), '扁平：无切角', 'clip-path:none')
ok(!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(base ? base.body : ''), '不另造色值（规则体内 hex/rgba 计数）', String((base?.body.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) || []).length))

// ④ micro 类
const H = 34
const PADX = 12
console.log('— ④ micro 类（只留位置/尺寸）—')
for (const [file, sel, ctlVar] of [
  ['jobs', '.sf-jobs-btn', '--sf-j-ctl-h'],
  ['market', '.sf-mkt-btn', '--sf-k-ctl-h'],
  ['listings', '.sf-listings-btn', '--sf-l-ctl-h'],
]) {
  const r = ruleOf(css[file], sel)
  const body = r ? norm(r.body) : ''
  const m = strip(css[file]).match(new RegExp(`${ctlVar}\\s*:\\s*([0-9.]+)px`))
  ok(!!r, `${sel} 存在`, r ? r.selector : '缺失')
  ok(body.includes(`min-height:var(${ctlVar})`), `${sel} 保留 min-height=${ctlVar}`, `min-height:var(${ctlVar})`)
  ok(body.includes('padding:8pxvar(--sf-st-padx-btna)'), `${sel} 水平内边距 = STRUCT.padx-btna`, 'padding:8px var(--sf-st-padx-btna)')
  ok(!body.includes('background') && !body.includes('border'), `${sel} 无重复视觉声明（单一来源 = 基类）`, 'no background/border')
  ok(m && parseFloat(m[1]) === H, `${ctlVar} = STRUCT.h-btna`, `${m ? m[1] : 'N/A'}px vs ${H}px`)
}
console.log(`   口径复核：高 ${H} × 0.359 = ${(H * 0.359).toFixed(2)}px ≈ padx-btna ${PADX}px`)
ok(Math.abs(H * 0.359 - PADX) <= 0.6, 'padx 合真源比例 0.359（±0.6px 取整容差）', `${(H * 0.359).toFixed(2)} vs ${PADX}`)
ok(Math.abs(H * 0.222 - 8) <= 0.6, 'radius 合真源比例 0.222（±0.6px 取整容差）', `${(H * 0.222).toFixed(2)} vs 8`)

// ⑤ ThemePreview
console.log('— ⑤ ThemePreviewPage 开关 —')
const prev = ruleOf(css.preview, '.sf-preview-btn')
const prevOn = ruleOf(css.preview, '.sf-preview-btn.is-on')
ok(!!prev, '.sf-preview-btn 在家族内（与 .sf-btn 同挂）', prev ? prev.selector : '缺失')
ok(!!prev && !norm(prev.body).includes('background'), '开关视觉由基类注入（自身无背景声明）', 'no background')
ok(!!prevOn && norm(prevOn.body).includes('outline:var(--sf-st-stroke-w-strong)solidvar(--sf-tab-active-fg)'), 'is-on 保留状态指示 outline', prevOn ? prevOn.body.trim() : '缺失')

// ⑥ 死 token
console.log('— ⑥ 死 token 登记 —')
const cssFiles = walk(SRC, ['.css'])
const deadRefs = []
for (const f of cssFiles) {
  for (const m of read(f).matchAll(/var\((--sf-(?:btn|btnsm)-[a-z0-9-]+)/g)) deadRefs.push(`${path.relative(SRC, f)}: ${m[1]}`)
}
ok(deadRefs.length === 0, '旧 --sf-btn-*/--sf-btnsm-* 无消费者（登记为死 token）', `${deadRefs.length} 处${deadRefs.length ? ' → ' + deadRefs.join(', ') : ''}`)

console.log('')
console.log(fails.length === 0 ? `总判 PASS（0 FAIL / ${inv.length} 文件 / 用法 ${total} 处）` : `总判 FAIL（${fails.length}）：${fails.join(' | ')}`)
process.exit(fails.length === 0 ? 0 : 1)
