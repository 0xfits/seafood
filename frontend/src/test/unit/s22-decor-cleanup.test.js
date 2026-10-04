import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// S22-A4 · 把「装饰性切角」与「legacy 硬位移阴影」统一到已收敛的形状语言
//   —— 台账 docs/OPEN-ITEMS.md A4（Kevin 定档「不保留」）；文 = docs/seafood.master-plan.md §5.339。
//
// 口径（写死，与报告 docs/audit/s22-decor-cleanup.md §3 同）：
//   ① 装饰性 `clip-path: polygon(...)` 命中 = 0；
//   ② **禁碰** SVG 内部 `clip-path: url(#clip-path…)`（图形定义，非切角）—— 命中数不变；
//   ③ **禁碰** 焦点环 `:focus { box-shadow: 0 0 0 Npx … }` —— 规则数不变（可达性面）；
//   ④ 「硬位移阴影」= 非 `inset` 且 x/y 偏移 ≠ 0 的 box-shadow 层 ⇒ 命中 = 0。
//      零偏移环（`0 0 0 Npx`）与 `inset` 内高光**不属**「位移」⇒ 不计入；前者亦须逐数不变。
//
// 真源：本文只读 `frontend/src/styles.css` 文本解析（不加载浏览器）；判负自证见本文件末例。

const here = path.dirname(fileURLToPath(import.meta.url))
const STYLES = path.resolve(here, '../../styles.css')
const CSS = fs.readFileSync(STYLES, 'utf8')
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

// —— 检查器（纯函数；正向断言与判负自证共用同一实现）——
const decorativeCutCorners = (css) =>
  [...css.matchAll(/clip-path\s*:\s*polygon\s*\([^;]*\)/gi)].map((m) => m[0])
const svgClipUrls = (css) => [...css.matchAll(/url\(#clip-path[^)]*\)/gi)]
const focusRingRules = (css) => [...css.matchAll(/:focus\s*\{[^}]*box-shadow\s*:\s*0 0 0\s+[0-9]+px/gi)]
const zeroRingOccurrences = (css) => [...css.matchAll(/0 0 0 [0-9]+px/g)]

const boxShadowDecls = (css) =>
  [...stripComments(css).matchAll(/box-shadow\s*:([^;}]*)[;}]/g)].map((m) => m[1].trim())
const splitLayers = (d) => d.split(/,\s*(?![^()]*\))/).map((s) => s.trim()).filter(Boolean)
const isDisplacementLayer = (layer) => {
  const m = /^(inset\s+)?(-?[\d.]+)(?:px)?\s+(-?[\d.]+)(?:px)?/.exec(layer)
  if (!m) return false // `none` 等无偏移形态
  if (m[1]) return false // inset = 内高光，非投影
  return Number(m[2]) !== 0 || Number(m[3]) !== 0
}
const displacementLayers = (css) => boxShadowDecls(css).flatMap(splitLayers).filter(isDisplacementLayer)

describe('S22-A4 · 装饰性切角 / legacy 硬位移阴影 收敛', () => {
  it('① 装饰性 clip-path: polygon(...) 命中 = 0（本单三条：.badge-gift::before / #section_gift .point-badge / .badge::after）', () => {
    expect(decorativeCutCorners(CSS)).toEqual([])
  })

  it('① 去切角采用「成对 + none」写法（与 :150/:299 同形；-webkit- 与标准成对出现）', () => {
    for (const sel of ['.badge-gift::before', '#section_gift .point-badge', '.badge::after']) {
      const idx = CSS.indexOf(sel)
      expect(idx, `${sel} 未找到`).toBeGreaterThan(-1)
      const body = CSS.slice(idx, CSS.indexOf('}', idx))
      expect(body.replace(/\s+/g, '')).toContain('-webkit-clip-path:none;clip-path:none')
    }
  })

  it('② 禁碰：SVG 内部 clip-path: url(#clip-path…) 命中数 = 20（两段嵌入式 SVG：cls-7..cls-16 × 2）', () => {
    expect(svgClipUrls(CSS)).toHaveLength(20)
  })

  it('③ 禁碰：焦点环规则数 = 8（.btn-* :focus box-shadow: 0 0 0 2px … 逐条不变）', () => {
    expect(focusRingRules(CSS)).toHaveLength(8)
  })

  it('④ legacy 硬位移阴影命中 = 0（非 inset 且 x/y ≠ 0 的 box-shadow 层）', () => {
    expect(displacementLayers(CSS)).toEqual([])
  })

  it('④ 零偏移环 0 0 0 Npx 命中数不变 = 19（焦点环 8 + 描边环 9 + badge-dot 1 + gem-pulse 1）', () => {
    expect(zeroRingOccurrences(CSS)).toHaveLength(19)
  })

  it('色板/布局未动：still 有既有形状语言真源（--sf-st-radius-btna / --sf-st-stroke-w-thin 引用仍在）', () => {
    expect(CSS).toContain('var(--sf-st-radius-btna)')
    expect(CSS).toContain('var(--sf-st-stroke-w-thin)')
  })

  it('判负自证：把任一已去切角改回 polygon(…) ⇒ ① 的检查器必红；复原 ⇒ 回绿', () => {
    // 取真实 `.badge-gift::before` 去切角段，做**内存**变异（不动盘）
    const marker = CSS.indexOf('.badge-gift::before')
    const before = CSS.slice(marker, CSS.indexOf('}', marker))
    expect(decorativeCutCorners(CSS)).toEqual([]) // 基线：绿
    const mutated = CSS.replace(before, before.replace('clip-path: none;', 'clip-path: polygon(100% 0, 0 0, 100% 100%);'))
    expect(decorativeCutCorners(mutated).length).toBeGreaterThan(0) // 变异：必红
    // 反向：把 SVG 的 url(#…) 换成 polygon ⇒ ② 的检查器应「不变仍 20」而 ① 也红（证明 ② 判的是 url 形态，不受切角影响）
    expect(svgClipUrls(mutated)).toHaveLength(20)
  })

  it('判负自证：把一处硬位移阴影改回 ⇒ ④ 的检查器必红；复原 ⇒ 回绿', () => {
    expect(displacementLayers(CSS)).toEqual([]) // 基线：绿
    const mutated = stripComments(CSS).replace('box-shadow: none;', 'box-shadow: 0 8px 16px rgba(0,0,0,0.1);')
    expect(displacementLayers(mutated).length).toBeGreaterThan(0) // 变异：必红
  })
})
