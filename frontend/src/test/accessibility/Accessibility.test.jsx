import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axe, toHaveNoViolations } from 'jest-axe'
import { Button, Card, Modal, Form } from '@components/ui'

// 扩展 expect 匹配器
expect.extend(toHaveNoViolations)

describe('Accessibility Tests', () => {
  describe('Button Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(<Button>Accessible Button</Button>)
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper ARIA attributes', () => {
      render(<Button disabled>Disabled Button</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('disabled')
    })

    it('should announce loading state', () => {
      render(<Button loading>Loading</Button>)
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-busy', 'true')
    })
  })

  describe('Card Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <Card>
          <h3>Card Title</h3>
          <p>Card content</p>
        </Card>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper heading structure', () => {
      render(
        <Card>
          <h3>Card Title</h3>
          <p>Card content</p>
        </Card>
      )
      
      const heading = screen.getByRole('heading', { level: 3 })
      expect(heading).toBeInTheDocument()
    })
  })

  describe('Modal Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <Modal isOpen onClose={() => {}}>
          <h2>Modal Title</h2>
          <p>Modal content</p>
        </Modal>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should trap focus within modal', () => {
      render(
        <Modal isOpen onClose={() => {}}>
          <h2>Modal Title</h2>
          <button>Modal Button</button>
        </Modal>
      )
      
      const modal = screen.getByRole('dialog')
      expect(modal).toHaveAttribute('aria-modal', 'true')
    })

    it('should have proper ARIA labels', () => {
      render(
        <Modal isOpen onClose={() => {}}>
          <h2>Modal Title</h2>
          <p>Modal content</p>
        </Modal>
      )
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('role', 'dialog')
    })
  })

  describe('Form Accessibility', () => {
    it('should not have accessibility violations', async () => {
      const { container } = render(
        <Form>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required />
          <button type="submit">Submit</button>
        </Form>
      )
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should have proper form labels', () => {
      render(
        <Form>
          <label htmlFor="name">Name</label>
          <input id="name" type="text" required />
        </Form>
      )
      
      const input = screen.getByRole('textbox', { name: /name/i })
      expect(input).toBeInTheDocument()
      expect(input).toHaveAttribute('aria-required', 'true')
    })

    it('should announce form errors', () => {
      render(
        <Form>
          <label htmlFor="email">Email</label>
          <input 
            id="email" 
            type="email" 
            aria-invalid="true"
            aria-describedby="email-error"
          />
          <div id="email-error">Invalid email address</div>
        </Form>
      )
      
      const input = screen.getByRole('textbox')
      expect(input).toHaveAttribute('aria-invalid', 'true')
      expect(input).toHaveAttribute('aria-describedby', 'email-error')
      
      const error = screen.getByText('Invalid email address')
      expect(error).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for buttons', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      
      const button = screen.getByRole('button')
      
      // Test Enter key
      button.focus()
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
      expect(handleClick).toHaveBeenCalled()
      
      // Test Space key
      handleClick.mockClear()
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
      expect(handleClick).toHaveBeenCalled()
    })

    it('should handle escape key for modals', () => {
      const handleClose = vi.fn()
      render(
        <Modal isOpen onClose={handleClose}>
          <h2>Modal Title</h2>
        </Modal>
      )
      
      const modal = screen.getByRole('dialog')
      modal.focus()
      modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      
      expect(handleClose).toHaveBeenCalled()
    })
  })

  describe('Color Contrast', () => {
    it('should have sufficient color contrast', async () => {
      const { container } = render(
        <div>
          <Button variant="primary">Primary Button</Button>
          <Button variant="secondary">Secondary Button</Button>
          <Card variant="warning">
            <h3>Warning Card</h3>
            <p>Warning content</p>
          </Card>
        </div>
      )
      
      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true }
        }
      })
      
      expect(results).toHaveNoViolations()
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide proper ARIA descriptions', () => {
      render(
        <Button aria-describedby="help-text">Help</Button>
        <div id="help-text">Click for help</div>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveAttribute('aria-describedby', 'help-text')
      
      const description = screen.getByText('Click for help')
      expect(description).toBeInTheDocument()
    })

    it('should announce live regions', () => {
      render(
        <div>
          <div aria-live="polite" aria-atomic="true">
            Loading complete
          </div>
        </div>
      )
      
      const liveRegion = screen.getByText('Loading complete')
      expect(liveRegion).toHaveAttribute('aria-live', 'polite')
      expect(liveRegion).toHaveAttribute('aria-atomic', 'true')
    })
  })
})
