import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { Card, CardHeader, CardTitle, CardContent } from '@components/ui/Card'

describe('Card Components', () => {
  it('renders Card with default props', () => {
    render(<Card>Card content</Card>)
    const card = screen.getByText('Card content')
    expect(card).toBeInTheDocument()
    expect(card.parentElement).toHaveClass('bg-white', 'border-gray-200')
  })

  it('renders Card with different variants', () => {
    const { rerender } = render(<Card variant="primary">Primary</Card>)
    let card = screen.getByText('Primary')
    expect(card.parentElement).toHaveClass('bg-yellow-50', 'border-yellow-200')

    rerender(<Card variant="success">Success</Card>)
    card = screen.getByText('Success')
    expect(card.parentElement).toHaveClass('bg-green-50', 'border-green-200')
  })

  it('renders CardHeader', () => {
    render(<CardHeader>Header content</CardHeader>)
    const header = screen.getByText('Header content')
    expect(header).toBeInTheDocument()
    expect(header).toHaveClass('p-6', 'pb-4')
  })

  it('renders CardTitle', () => {
    render(<CardTitle>Card Title</CardTitle>)
    const title = screen.getByText('Card Title')
    expect(title).toBeInTheDocument()
    expect(title).toHaveClass('text-lg', 'font-semibold', 'text-gray-900')
  })

  it('renders CardContent', () => {
    render(<CardContent>Card content</CardContent>)
    const content = screen.getByText('Card content')
    expect(content).toBeInTheDocument()
    expect(content).toHaveClass('p-6', 'pt-0')
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
    render(<Card hover>Hoverable card</Card>)
    const card = screen.getByText('Hoverable card')
    expect(card.parentElement).toHaveClass('hover:shadow-lg', 'transition-shadow')
  })
})
