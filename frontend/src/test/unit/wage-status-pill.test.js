/**
 * /wage 状态标签 = 胶囊（Kevin 2026-10-22）
 * ---------------------------------------------------------------------------
 * 要求：【招募中】/【已截止】改为首页曾用过的**胶囊标签**视觉，
 *   胶囊暗示「不可点击」——不得带描边、不得用按钮圆角（否则读成按钮、误点）。
 * 本文件用 CSS 源码断言钉死三点：
 *   ① `border-radius` 用 `--sf-st-radius-pill`（999px 全圆，非按钮圆角）
 *   ② `border: 0`（无描边 ⇒ 不呈现按钮轮廓）
 *   ③ 仍只用既有 token，零新色值（不出现 hex）
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../..')
const CSS = fs.readFileSync(path.join(SRC, 'pages/wage/wage.css'), 'utf8')

/** 抓出某个选择器的声明块（取首个匹配） */
const ruleOf = (selector) => {
  const idx = CSS.indexOf(`${selector} {`)
  expect(idx, `缺失选择器 ${selector}`).toBeGreaterThan(-1)
  const end = CSS.indexOf('}', idx)
  return CSS.slice(idx, end)
}

describe('/wage 状态标签胶囊化', () => {
  const base = ruleOf('.sf-wage-status')

  it('① 全圆角走 --sf-st-radius-pill（不是 --sf-st-radius-btna）', () => {
    expect(base).toContain('border-radius: var(--sf-st-radius-pill)')
    expect(base).not.toContain('--sf-st-radius-btna')
  })

  it('② 无描边：border: 0（胶囊不呈现按钮轮廓）', () => {
    expect(base).toMatch(/border:\s*0\s*;/)
    expect(base).not.toMatch(/border:\s*var\(--sf-st-stroke-w-thin\)/)
  })

  it('③ 12px 字号 + 左右 10px 内距（与首页标签同体例）', () => {
    expect(base).toContain('font-size: 12px')
    expect(base).toContain('padding: 2px 10px')
  })

  it('④ 两态仍只用既有 token，零 hex 字面量', () => {
    const open = ruleOf('.sf-wage-status.is-open')
    const closed = ruleOf('.sf-wage-status.is-closed')
    for (const block of [open, closed]) {
      expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
      expect(block).not.toMatch(/border/)
    }
    expect(open).toContain('var(--sf-btna-bg)')
    expect(closed).toContain('var(--sf-tag-bg)')
  })
})
