import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/Card'

// S44-R1 · 判据对齐（尺子跟产品）。
//   Card 根即承载样式类：`getByText(...)` 直接返回 Card 根 div（其 children 为纯文本/内层元素）。
//   原测对 `card.parentElement` 断言 ⇒ 指向 RTL 容器（className 恒为空串），永远量不到组件。
describe('Card Components', () => {
  it('renders Card with default props', () => {
    render(<Card>Card content</Card>)
    const card = screen.getByText('Card content')
    expect(card).toBeInTheDocument()
    expect(card).toHaveClass('bg-white', 'border-gray-200')
  })

  it('renders Card with different variants', () => {
    const { rerender } = render(<Card variant="primary">Primary</Card>)
    let card = screen.getByText('Primary')
    expect(card).toHaveClass('bg-yellow-50', 'border-yellow-200')

    rerender(<Card variant="success">Success</Card>)
    card = screen.getByText('Success')
    expect(card).toHaveClass('bg-green-50', 'border-green-200')
  })

  it('renders CardHeader', () => {
    render(<CardHeader>Header content</CardHeader>)
    const header = screen.getByText('Header content')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'pb-4')
  })

  it('renders CardTitle', () => {
    render(<CardTitle>Card Title</CardTitle>)
    const title = screen.getByText('Card Title')
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('font-semibold', 'text-lg', 'leading-none', 'tracking-tight')
  })

  it('renders CardContent', () => {
    render(<CardContent>Card content</CardContent>)
    const content = screen.getByText('Card content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass('pt-0')
  })

  it('renders complete Card structure', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Test Card</CardTitle>
        </CardHeader>
        <CardContent>Test content</CardContent>
      </Card>
    )

    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByText('Test content')).toBeInTheDocument()
  })

  it('applies hover effect when enabled', () => {
    // hover 是枚举 prop（'none'|'lift'|'glow'），应用侧亦用 hover="lift" / hover="glow"。
    // 原测写作布尔 `<Card hover>` ⇒ cardVariants.hover[true] === undefined ⇒ 不落任何 hover 类。
    render(<Card hover="lift">Hoverable card</Card>)
    const card = screen.getByText('Hoverable card')
    expect(card).toHaveClass('hover:shadow-lg', 'hover:-translate-y-1')
  })
})
