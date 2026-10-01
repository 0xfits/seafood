import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { STRUCT, TOKEN_KEYS } from '../../theme/tokens'

// Unit P6-BTN-IMPL-2 · `.sf-btn` 家族纳入 A 体系（与 `.btn.btn-a` 同口径、同批 token）
// 真源 = docs/design/style-preview.html 938–982 行 [BTN-SRC-REF]（本单现取）
// 口径：颜色/描边色 = --sf-btna-*（主题 token，日/夜有差）；几何（圆角 / 描边宽度 / 水平内边距）
//       = --sf-st-*（结构常量，两档同值）⇒ 切档 rect 逐值相等；两档扁平（无阴影/无背景图/无切角）。
// 本单不得另造色值：`.sf-btn` 规则内出现任何 hex/rgba 字面量即判负。

const here = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(here, '../..') // frontend/src
const read = (p) => fs.readFileSync(p, 'utf8')

const CSS_FILES = {
  shell: path.join(SRC, 'shell/shell.css'),
  jobs: path.join(SRC, 'pages/jobs/jobs.css'),
  market: path.join(SRC, 'pages/market/market.css'),
  listings: path.join(SRC, 'pages/listings/listings.css'),
  preview: path.join(SRC, 'pages/theme-preview.css'),
}
const css = Object.fromEntries(Object.entries(CSS_FILES).map(([k, p]) => [k, read(p)]))

const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
const strip = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '')
const rulesOf = (text) =>
  [...strip(text).matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }))
const decls = (body) =>
  body
    .split(';')
    .map((p) => {
      const i = p.indexOf(':')
      return i === -1 ? null : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
    })
    .filter(Boolean)
const rule = (file, sel) => rulesOf(css[file]).find((r) => norm(r.selector) === norm(sel))

const BTN_VARS = ['btna-bg', 'btna-fg', 'btna-border', 'btnalt-bg', 'btnalt-fg', 'btnalt-border']
const THEME_VARS = new Set(BTN_VARS.map((k) => `--sf-${k}`))
const GEOMETRY_WORDS = ['height', 'width', 'padding', 'margin', 'gap', 'border-width', 'border-radius', 'font-size', 'top', 'left', 'right', 'bottom', 'inset']
const COLOR_LITERAL = /#[0-9a-f]{3,8}\b|rgba?\(/i

// —— 家族清单（现取：src 下 .js/.jsx，排除测试目录）
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (['test', 'node_modules', '__mocks__'].includes(e.name)) continue
      walk(p, out)
    } else if (/\.(jsx|js)$/.test(e.name)) out.push(p)
  }
  return out
}
const inventory = walk(SRC)
  .map((file) => {
    const hits = read(file)
      .split('\n')
      .map((line, i) => ({ line: i + 1, text: line }))
      .filter((l) => /\bsf-btn\b/.test(l.text)) // \b 边界：排除 --sf-btna-* / --sf-btnsm-* 这类同前缀串
    return { file: path.relative(SRC, file), hits }
  })
  .filter((e) => e.hits.length > 0)
const totalUses = inventory.reduce((n, e) => n + e.hits.length, 0)

describe('P6-BTN-IMPL-2 · `.sf-btn` 家族纳入 A 体系', () => {
  it('家族清单现取：9 个 JSX 文件、≥22 处用法，且每处都挂基类 .sf-btn', () => {
    expect(inventory.map((e) => e.file).sort()).toEqual([
      'pages/TaskPage.jsx',
      'pages/ThemePreviewPage.jsx',
      'pages/jobs/JobDetailPage.jsx',
      'pages/jobs/JobReviewPage.jsx',
      'pages/jobs/PublishJobPage.jsx',
      'pages/listings/ListingDetailPage.jsx',
      'pages/listings/ListingsPage.jsx',
      'pages/listings/PublishListingPage.jsx',
      'pages/market/MarketPage.jsx',
    ])
    expect(totalUses).toBeGreaterThanOrEqual(22)
    for (const entry of inventory) {
      for (const hit of entry.hits) expect(hit.text).toMatch(/\bsf-btn\b/)
    }
  })

  it('基类 .sf-btn：颜色走 --sf-btna-*（主题 token）、几何走 --sf-st-*（结构常量）', () => {
    const base = rule('shell', '.sf-btn')
    expect(base).toBeTruthy()
    const b = norm(base.body)
    expect(b).toContain('background:var(--sf-btna-bg)')
    expect(b).toContain('color:var(--sf-btna-fg)')
    expect(b).toContain('border:var(--sf-st-stroke-w-thin)solidvar(--sf-btna-border)')
    expect(b).toContain('border-radius:var(--sf-st-radius-btna)')
    expect(b).toContain('box-sizing:border-box')
  })

  it('扁平硬要求：无阴影 / 无背景图 / 无切角（clip-path: none）', () => {
    const b = norm(rule('shell', '.sf-btn').body)
    expect(b).toContain('box-shadow:none')
    expect(b).toContain('background-image:none')
    expect(b).toContain('clip-path:none')
    // 家族内不得残留切角（clip-path 只允许 none）
    for (const r of Object.values(css).flatMap((text) => rulesOf(text))) {
      if (!/sf-btn|sf-jobs-btn|sf-mkt-btn|sf-listings-btn|sf-preview-btn/.test(r.selector)) continue
      for (const m of r.body.matchAll(/clip-path\s*:\s*([^;}]+)/gi)) {
        expect(norm(m[1])).toBe('none')
      }
    }
  })

  it('不另造色值：.sf-btn 基类规则内无 hex/rgba 字面量，var() 只走白名单', () => {
    const base = rule('shell', '.sf-btn')
    expect(COLOR_LITERAL.test(base.body)).toBe(false)
    const offenders = []
    for (const [prop, value] of decls(base.body)) {
      for (const m of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
        const v = m[1]
        if (v.startsWith('--sf-st-')) continue
        if (!THEME_VARS.has(v)) offenders.push(`${prop}: 白名单外变量 ${v}`)
      }
    }
    expect(offenders).toEqual([])
    for (const key of BTN_VARS) expect(TOKEN_KEYS).toContain(key)
  })

  it('主题 token 不落几何槽位 ⇒ 切档 rect 同构（颜色槽位才允许 token）', () => {
    const offenders = []
    for (const r of rulesOf(css.shell).filter((x) => norm(x.selector).startsWith('.sf-btn'))) {
      for (const [prop, value] of decls(r.body)) {
        if (!/--sf-btna/.test(value)) continue
        if (GEOMETRY_WORDS.some((w) => prop.toLowerCase().includes(w))) offenders.push(`${r.selector} → ${prop}: ${value}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('各页 micro 类只保留位置/尺寸约束：min-height = 页内 ctl-h = STRUCT.h-btna（34px），水平内边距 = STRUCT.padx-btna', () => {
    const h = parseFloat(STRUCT['h-btna'])
    const cases = [
      ['jobs', '.sf-jobs-btn', '--sf-j-ctl-h'],
      ['market', '.sf-mkt-btn', '--sf-k-ctl-h'],
      ['listings', '.sf-listings-btn', '--sf-l-ctl-h'],
    ]
    for (const [file, sel, ctlVar] of cases) {
      const r = rule(file, sel)
      expect(r, `${sel} 缺失`).toBeTruthy()
      const b = norm(r.body)
      expect(b).toContain(`min-height:var(${ctlVar})`)
      expect(b).toContain('padding:8pxvar(--sf-st-padx-btna)')
      expect(b).toContain('cursor:pointer')
      // 页内高度常量 = A 口径高度 ⇒ 12px 内边距正合 高×0.359
      const m = strip(css[file]).match(new RegExp(`${ctlVar}\\s*:\\s*([0-9.]+)px`))
      expect(m, `${ctlVar} 未定义`).toBeTruthy()
      expect(parseFloat(m[1])).toBe(h)
      expect(b).not.toContain('background') // 视觉不得在 micro 类里二次定义（单一来源 = 基类）
      expect(b).not.toContain('border')
    }
    expect(Math.abs(parseFloat(STRUCT['padx-btna']) - parseFloat(STRUCT['ratio-padx-btna']) * h)).toBeLessThanOrEqual(0.6)
    expect(Math.abs(parseFloat(STRUCT['radius-btna']) - parseFloat(STRUCT['ratio-radius-btna']) * h)).toBeLessThanOrEqual(0.6)
  })

  it('ThemePreviewPage 开关（.sf-btn.sf-preview-btn）纳入体系；其选中态仅保留状态指示 outline', () => {
    const r = rule('preview', '.sf-preview-btn')
    expect(r).toBeTruthy()
    expect(norm(r.body)).not.toContain('background') // 颜色由基类注入
    const on = rule('preview', '.sf-preview-btn.is-on')
    expect(on).toBeTruthy()
    expect(norm(on.body)).toContain('outline:var(--sf-st-stroke-w-strong)solidvar(--sf-tab-active-fg)')
    expect(COLOR_LITERAL.test(on.body)).toBe(false)
  })

  it('旧黑底黄字 token（--sf-btn-* / --sf-btnsm-*）已无消费者（登记为死 token，待 Jing 裁决）', () => {
    const cssFiles = []
    const walkCss = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) {
          if (['node_modules', '__mocks__'].includes(e.name)) continue
          walkCss(p)
        } else if (e.name.endsWith('.css')) cssFiles.push(p)
      }
    }
    walkCss(SRC)
    expect(cssFiles.length).toBeGreaterThanOrEqual(6)
    const refs = []
    for (const file of cssFiles) {
      for (const m of read(file).matchAll(/var\((--sf-(?:btn|btnsm)-[a-z0-9-]+)/g)) refs.push(`${path.relative(SRC, file)}: ${m[1]}`)
    }
    expect(refs).toEqual([])
  })

  it('家族 CSS 无按主题分支的选择器（主题只能来自 token）', () => {
    for (const [name, text] of Object.entries(css)) {
      for (const r of rulesOf(text)) {
        expect(norm(r.selector), `${name} → ${r.selector}`).not.toContain('[data-theme')
        expect(norm(r.selector), `${name} → ${r.selector}`).not.toMatch(/theme-(day|night)/)
      }
    }
  })
})
