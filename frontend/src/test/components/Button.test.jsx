import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@components/ui/Button'
import { STRUCT, THEME_TOKENS } from '../../theme/tokens'

// P6-BTN-IMPL-2 · 本文件前两例改为**按新契约断言**（原断言的是已被删掉的 Tailwind 盖色类：
//   bg-yellow-500 / text-white / bg-blue-500 …）—— 只替换「取样对象」，不删断言、不削弱：
//   新契约 = variant → CSS class 映射（primary ⇒ .btn-a / secondary ⇒ .btn-a-alt）+ 该类的落地形态
//   （扁平无阴影、圆角与内边距 = 高 × 真源比例 0.222 / 0.359）。原例其余部分逐条保留。
//   真源：docs/design/style-preview.html 938–982 行 [BTN-SRC-REF]。

// —— A 系规则现取（styles.css 是 .btn-a 的唯一落地处；单测不加载 CSS，故按「规则文本 + STRUCT 常量」断言）
const STYLES_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../styles.css')
const stylesCss = fs.readFileSync(STYLES_PATH, 'utf8')
const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
const styleRules = [...stylesCss.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ selector: m[1].trim(), body: m[2] }))
const aBaseRule = styleRules.find(
  (r) => r.selector.includes('.btn.btn-a') && r.selector.includes('.btn-a-alt') && r.body.includes('height')
)
const aPrimaryRule = styleRules.find((r) => r.selector.trim() === '.btn.btn-a')

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })

    expect(button).toBeInTheDocument()
    // 新契约（默认 = primary/日档 A″）：类映射走 .btn-a，Tailwind 盖色类已删净
    expect(button).toHaveClass('btn', 'btn-a', 'btn-md')
    expect(button.className).not.toMatch(/bg-(yellow|blue|green|red|gray)-\d+/)
    expect(button.className).not.toMatch(/text-white/)
    // 契约：A 系落地形态 —— 扁平（无阴影/无背景图/无切角），几何全部由 STRUCT 常量驱动
    expect(aBaseRule).toBeTruthy()
    const aBody = norm(aBaseRule.body)
    expect(aBody).toContain('box-shadow:none')
    expect(aBody).toContain('background-image:none')
    expect(aBody).toContain('clip-path:none')
    expect(aBody).toContain('height:var(--sf-st-h-btna)')
    expect(aBody).toContain('border-radius:var(--sf-st-radius-btna)')
    expect(aBody).toContain('padding:0var(--sf-st-padx-btna)')
    expect(aBody).toContain('border:var(--sf-st-stroke-w-thin)solidtransparent') // 1px 槽位两档常驻
    // 颜色只在颜色槽位，且来自这批 token（不另造色值）
    expect(norm(aPrimaryRule.body)).toContain('background-color:var(--sf-btna-bg)')
    expect(norm(aPrimaryRule.body)).toContain('color:var(--sf-btna-fg)')
    expect(norm(aPrimaryRule.body)).toContain('border-color:var(--sf-btna-border)')
    // 口径复核（现取 STRUCT，不写死）：圆角 = 高×0.222、内边距 = 高×0.359，四舍五入到整像素
    const h = parseFloat(STRUCT['h-btna'])
    expect(STRUCT['h-btna']).toBe('34px')
    expect(Math.abs(parseFloat(STRUCT['radius-btna']) - parseFloat(STRUCT['ratio-radius-btna']) * h)).toBeLessThanOrEqual(0.6)
    expect(Math.abs(parseFloat(STRUCT['padx-btna']) - parseFloat(STRUCT['ratio-padx-btna']) * h)).toBeLessThanOrEqual(0.6)
    // 默认档为日档 A″：黄底 + 深字（token 值现取，两档同值）
    for (const theme of ['day', 'night']) {
      expect(THEME_TOKENS[theme]['btna-bg']).toBe('#FFE60F')
      expect(THEME_TOKENS[theme]['btna-fg']).toBe('#202020')
    }
  })

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>)
    let button = screen.getByRole('button')
    // secondary ⇒ A′ 次按钮类（原断言 bg-blue-500 已随盖色类删除 ⇒ 改按类映射断言）
    expect(button).toHaveClass('btn-a-alt')
    expect(button.className).not.toMatch(/bg-(yellow|blue|green|red|gray)-\d+/)

    rerender(<Button variant="success">Success</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('btn-success')
    expect(button).not.toHaveClass('btn-a')

    rerender(<Button variant="warning">Warning</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('btn-warning')
    expect(button).not.toHaveClass('btn-a-alt')

    rerender(<Button variant="inactive">Inactive</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('btn-inactive')
    // 非 A 系变体同样不得回退到 Tailwind 盖色类（本单「删净盖色类」的回归门）
    expect(button.className).not.toMatch(/bg-(yellow|blue|green|red|gray)-\d+/)
  })

  it('renders with different sizes', () => {
    const { rerender } = render(<Button size="sm">Small</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm')

    rerender(<Button size="lg">Large</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('px-8', 'py-3', 'text-lg')
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    render(<Button onClick={handleClick}>Click me</Button>)

    const button = screen.getByRole('button')
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('can be disabled', () => {
    const handleClick = vi.fn()
    render(<Button disabled onClick={handleClick}>Disabled</Button>)

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveClass('opacity-50', 'cursor-not-allowed')

    fireEvent.click(button)
    expect(handleClick).not.toHaveBeenCalled()
  })

  it('renders with custom className', () => {
    render(<Button className="custom-class">Custom</Button>)
    const button = screen.getByRole('button')
    expect(button).toHaveClass('custom-class')
  })

  it('renders as different element', () => {
    render(<Button as="a" href="/test">Link</Button>)
    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
  })
})
