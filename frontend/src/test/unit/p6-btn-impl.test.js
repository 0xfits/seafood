import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PROV, STRUCT, STRUCT_PROV, THEME_TOKENS, TOKEN_KEYS } from '../../theme/tokens'

// Unit P6-BTN-IMPL · 按钮新样式（日档 A″ / 夜档 A′）
// 真源 = docs/design/style-preview.html 938–982 行（[BTN-SRC-REF] 追加块，本单**现取**）
// 口径：日档主 = #FFE60F 底 + #202020 字 + 1px 深描边；夜档主 = #FFE60F 底 + 深字、无描边；
//       日档次 = 白底 + 1px #E0E0E0 + 深字；夜档次 = 站点夜档面 + 浅字 + 浅描边。
//       两档统一：扁平（无阴影）、圆角 = 高×0.222、水平内边距 ≈ 高×0.359。
//      （拍板表原记 0.17/0.45；真源 JING-BTN-SRC-FIX 复采后修正为 0.222/0.359 ⇒ 高 34 落地 8px / 12px，本单**现取**。）

const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(here, '../../../..')
const SOURCE_PATH = path.join(REPO_ROOT, 'docs/design/style-preview.html')
const STYLES_PATH = path.join(here, '../../styles.css')
const BUTTON_JSX_PATH = path.join(here, '../../components/ui/Button.jsx')

const sourceLines = fs.readFileSync(SOURCE_PATH, 'utf8').split('\n')
const stylesCss = fs.readFileSync(STYLES_PATH, 'utf8')
const buttonJsx = fs.readFileSync(BUTTON_JSX_PATH, 'utf8')

const norm = (s) => s.replace(/\s+/g, '').toLowerCase()

const BTN_KEYS = ['btna-bg', 'btna-fg', 'btna-border', 'btnalt-bg', 'btnalt-fg', 'btnalt-border']
const STRUCT_KEYS_BTN = ['h-btna', 'radius-btna', 'padx-btna', 'ratio-radius-btna', 'ratio-padx-btna']

// —— PROV 校验器（与 theme-tokens.test.js 同口径：去空白 + 小写后「单行子串包含」；行号越界判负）
//    **硬门①** needle 不得为单字符（单字符不构成定位/唯一性证据）
//    **硬门②** 行号必须在文件行数内，越界判负；无豁免。
const verifyProv = (provTable, keys) => {
  const failures = []
  for (const key of keys) {
    const prov = provTable[key]
    if (!prov) { failures.push(`${key}: 缺 PROV`); continue }
    for (const [which] of [['d'], ['n']]) {
      const entry = prov[which]
      if (!entry) { failures.push(`${key}.${which}: 缺证据`); continue }
      const [lineNo, needle, mustNot] = entry
      if (typeof needle !== 'string' || needle.trim().length < 2) {
        failures.push(`${key}.${which}: needle 为单字符（非法证据）`)
        continue
      }
      const raw = sourceLines[lineNo - 1]
      if (raw === undefined) { failures.push(`${key}.${which}: 行号 ${lineNo} 越界`); continue }
      if (!norm(raw).includes(norm(needle))) failures.push(`${key}.${which}: L${lineNo} 不含「${needle}」`)
      if (mustNot && norm(raw).includes(norm(mustNot))) failures.push(`${key}.${which}: L${lineNo} 不该含「${mustNot}」`)
    }
  }
  return failures
}

// —— styles.css 规则切分（用于「主题 token 只落在颜色槽位」的机械校验）
const parseRules = (text) => {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text)) !== null) out.push({ selector: m[1].trim(), body: m[2] })
  return out
}
// 解析前剥注释：否则注释文本会被并入选择器（.btn 规则将找不到）
const rules = parseRules(stylesCss.replace(/\/\*[\s\S]*?\*\//g, ''))
const aRules = rules.filter((r) => /\.btn-a(-alt)?(\b|[:,.\s])/.test(r.selector) || r.selector.includes('.btn-a'))

const decls = (body) => body.split(';').map((p) => {
  const i = p.indexOf(':')
  return i === -1 ? null : [p.slice(0, i).trim(), p.slice(i + 1).trim()]
}).filter(Boolean)

const THEME_VARS_BTN = new Set(BTN_KEYS.map((k) => `--sf-${k}`))
// 允许被主题 token 驱动的属性（颜色/圆角/阴影；**不得**出现几何属性）
const COLOR_SLOTS = new Set(['background-color', 'background', 'color', 'border-color', 'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'box-shadow', 'outline-color'])
const GEOMETRY_WORDS = ['height', 'width', 'padding', 'margin', 'gap', 'border-width', 'border-radius', 'font-size', 'top', 'left', 'right', 'bottom', 'inset']

const changedKeys = TOKEN_KEYS.filter((k) => THEME_TOKENS.day[k] !== THEME_TOKENS.night[k])
const changedBtnKeys = BTN_KEYS.filter((k) => THEME_TOKENS.day[k] !== THEME_TOKENS.night[k])
const COLOR_SHAPE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|transparent|none|inherit|currentColor)$/
const isColorish = (v) => COLOR_SHAPE.test(v)

describe('P6-BTN-IMPL · 日/夜两档 主/次按钮值符合口径', () => {
  it('六个按钮 token 存在，且日/夜键集合与顺序完全同构', () => {
    for (const key of BTN_KEYS) expect(TOKEN_KEYS).toContain(key)
    expect(Object.keys(THEME_TOKENS.night)).toEqual(Object.keys(THEME_TOKENS.day))
    expect(TOKEN_KEYS.length).toBeGreaterThanOrEqual(106) // P6-TAIL-2：授权删 7 键（113→106），闸门等量下移（其余键一个不许少）
  })

  it('主按钮（日档 A″ / 夜档 A′）：#FFE60F 底 + #202020 深字', () => {
    for (const t of ['day', 'night']) {
      expect(THEME_TOKENS[t]['btna-bg']).toBe('#FFE60F')
      expect(THEME_TOKENS[t]['btna-fg']).toBe('#202020')
    }
  })

  it('日档主按钮描边 = 站点既有 ink（#030402），非参考图 #202020【推断】；夜档主按钮无描边', () => {
    expect(THEME_TOKENS.day['btna-border']).toBe('#030402')
    expect(THEME_TOKENS.day['btna-border']).not.toBe('#202020')
    // 夜档：口径「无描边」；实现为 transparent（1px 槽位常驻以守 rect 同构，视觉等效 border:0）
    expect(THEME_TOKENS.night['btna-border']).toBe('transparent')
  })

  it('次按钮：日档 白底+#E0E0E0+深字；夜档 站点夜档面+浅字+#E0E0E0【推断】', () => {
    expect(THEME_TOKENS.day['btnalt-bg']).toBe('#FFFFFF')
    expect(THEME_TOKENS.day['btnalt-fg']).toBe('#202020')
    expect(THEME_TOKENS.day['btnalt-border']).toBe('#E0E0E0')
    // 夜档次底色 = 站点既有夜档面（card-bg/panel-bg），非参考图未展示值
    expect(THEME_TOKENS.night['btnalt-bg']).toBe(THEME_TOKENS.night['card-bg'])
    expect(THEME_TOKENS.night['btnalt-bg']).not.toBe('#202020')
    expect(THEME_TOKENS.night['btnalt-fg']).toBe('#FFFFFF')
    expect(THEME_TOKENS.night['btnalt-border']).toBe('#E0E0E0')
  })

  it('每个新 token 都有可回读的 PROV（现取 938–982 行），且 needle 均非单字符', () => {
    expect(verifyProv(PROV, BTN_KEYS)).toEqual([])
    expect(verifyProv(STRUCT_PROV, STRUCT_KEYS_BTN)).toEqual([])
    for (const key of BTN_KEYS) {
      expect(PROV[key].d[1].trim().length).toBeGreaterThanOrEqual(2)
      expect(PROV[key].n[1].trim().length).toBeGreaterThanOrEqual(2)
      expect(PROV[key].d[0]).toBeGreaterThanOrEqual(938)
      expect(PROV[key].d[0]).toBeLessThanOrEqual(982)
      expect(sourceLines[PROV[key].d[0] - 1]).toBeTruthy()
      expect(sourceLines[PROV[key].n[0] - 1]).toBeTruthy()
    }
  })

  it('判负用例：needle 单字符 / 行号越界 必须被判负', () => {
    const singleChar = { 'x-single': { d: [954, '#'], n: [958, '#'] } }
    const singleFailures = verifyProv(singleChar, ['x-single'])
    expect(singleFailures.length).toBe(2)
    expect(singleFailures.join(' ')).toMatch(/单字符/)

    const outOfRange = { 'x-range': { d: [999999, '#FFE60F'], n: [0, '#FFE60F'] } }
    const rangeFailures = verifyProv(outOfRange, ['x-range'])
    expect(rangeFailures.length).toBe(2)
    expect(rangeFailures.join(' ')).toMatch(/越界/)
  })

  it('结构常量：圆角/内边距 = 高 × 真源比例（复采 0.222 / 0.359），四舍五入到整像素', () => {
    const h = parseFloat(STRUCT['h-btna'])
    expect(h).toBe(34) // 真源唯一 px 落点：高 34 ⇒ 圆角 8px · 内边距 12px（复采修正后）
    expect(STRUCT['radius-btna']).toBe('8px')
    expect(STRUCT['padx-btna']).toBe('12px')
    expect(Math.abs(parseFloat(STRUCT['radius-btna']) - parseFloat(STRUCT['ratio-radius-btna']) * h)).toBeLessThanOrEqual(0.6)
    expect(Math.abs(parseFloat(STRUCT['padx-btna']) - parseFloat(STRUCT['ratio-padx-btna']) * h)).toBeLessThanOrEqual(0.6)
    for (const key of STRUCT_KEYS_BTN) {
      expect(TOKEN_KEYS).not.toContain(key) // 结构常量与主题 token 命名空间不串
      expect(STRUCT[key]).not.toMatch(/#|rgba?\(/) // 结构常量不含颜色
    }
  })
})

describe('P6-BTN-IMPL · 切档几何同构（rect 逐值相等的机制保证）', () => {
  it('A 系规则的 var() 引用白名单：几何只走 --sf-st-*，主题 token 只落在颜色槽位', () => {
    const failures = []
    expect(aRules.length).toBeGreaterThanOrEqual(8)
    for (const rule of aRules) {
      for (const [prop, value] of decls(rule.body)) {
        for (const m of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
          const v = m[1]
          if (v.startsWith('--sf-st-')) continue
          if (!THEME_VARS_BTN.has(v)) { failures.push(`${rule.selector} → ${prop}: 引用了白名单外的变量 ${v}`); continue }
          if (!COLOR_SLOTS.has(prop)) failures.push(`${rule.selector} → ${prop}: 颜色 token ${v} 出现在非颜色槽位`)
          if (GEOMETRY_WORDS.some((w) => prop.includes(w))) failures.push(`${rule.selector} → ${prop}: 几何槽位不得由主题 token 驱动`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  it('A 系几何全部由 STRUCT 常量驱动（两档同值 ⇒ 切档 rect 不变）', () => {
    const base = aRules.find((r) => r.selector.includes('.btn.btn-a') && r.body.includes('height'))
    expect(base).toBeTruthy()
    const body = norm(base.body)
    expect(body).toContain('height:var(--sf-st-h-btna)')
    expect(body).toContain('padding:0var(--sf-st-padx-btna)')
    expect(body).toContain('border-radius:var(--sf-st-radius-btna)')
    expect(body).toContain('border:var(--sf-st-stroke-w-thin)solidtransparent') // 1px 槽位两档常驻
    expect(base.selector).toContain('.btn.btn-a-alt')
  })

  it('按钮主题差集只含颜色型槽位（bg/fg/border），且值均为颜色 ⇒ 切档不改几何', () => {
    expect(changedBtnKeys.length).toBeGreaterThan(0)
    for (const key of changedBtnKeys) {
      expect(key).toMatch(/-(bg|fg|border)$/)
      expect(isColorish(THEME_TOKENS.day[key])).toBe(true)
      expect(isColorish(THEME_TOKENS.night[key])).toBe(true)
    }
    // 未参与差集的按钮 token 两档必须逐值相同
    for (const key of BTN_KEYS.filter((k) => !changedBtnKeys.includes(k))) {
      expect(THEME_TOKENS.day[key]).toBe(THEME_TOKENS.night[key])
    }
  })

  it('扁平化硬要求：.btn 三重渐变与 box-shadow 已删除、A 系无光泽伪元素/无阴影', () => {
    expect(stylesCss).not.toMatch(/radial-gradient\(120% 80%/)
    expect(stylesCss).not.toMatch(/linear-gradient\(135deg, rgba\(255,255,255,0\.35\)/)
    expect(stylesCss).not.toMatch(/glintSweep \.8s/)
    expect(stylesCss).not.toMatch(/\.btn::(before|after)\s*\{/) // 注释中允许提及；**规则**不得存在
    const btnRule = rules.find((r) => r.selector === '.btn')
    const b = norm(btnRule.body)
    expect(b).toContain('background-image:none')
    expect(b).toContain('box-shadow:none')
    const aAll = aRules.map((r) => norm(r.body)).join('|')
    expect(aAll).toContain('box-shadow:none')
    expect(aAll).toContain('background-image:none')
    for (const rule of aRules.filter((r) => r.selector.includes('.btn-a::before') || r.selector.includes('.btn-a::after'))) {
      expect(norm(rule.body)).toContain('display:none')
    }
  })

  it('Button.jsx：primary/secondary 走 .btn-a/.btn-a-alt，且已删净 Tailwind 盖色类', () => {
    expect(buttonJsx).toMatch(/primary:\s*'btn-a'/)
    expect(buttonJsx).toMatch(/secondary:\s*'btn-a-alt'/)
    expect(buttonJsx).not.toMatch(/bg-(yellow|blue|green|red|gray)-\d+/)
    expect(buttonJsx).not.toMatch(/text-white/)
    expect(buttonJsx).not.toMatch(/btn-primary/)
  })

  it('差异键数读数（口径 = 日/夜值不等的 token 键数）> 90；P6-TAIL-2 授权删 7 键后重定基（106→100）', () => {
    expect(changedKeys.length).toBeGreaterThan(90)
    expect(changedKeys.length).toBeGreaterThanOrEqual(100) // 删 7 键里 6 键参与差集 ⇒ 106→100
  })
})
