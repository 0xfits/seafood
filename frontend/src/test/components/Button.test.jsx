import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Button } from '@components/ui/Button'

describe('Button Component', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: /click me/i })
    
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('bg-yellow-500', 'text-white')
  })

  it('renders with different variants', () => {
    const { rerender } = render(<Button variant="secondary">Secondary</Button>)
    let button = screen.getByRole('button')
    expect(button).toHaveClass('bg-blue-500')

    rerender(<Button variant="success">Success</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-green-500')

    rerender(<Button variant="warning">Warning</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-red-500')

    rerender(<Button variant="inactive">Inactive</Button>)
    button = screen.getByRole('button')
    expect(button).toHaveClass('bg-gray-400')
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
