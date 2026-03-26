import { test, expect } from '@playwright/test'

test.describe('Jinli Club E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('homepage loads correctly', async ({ page }) => {
    await expect(page).toHaveTitle(/Jinli Club/)
    await expect(page.locator('h1')).toContainText('欢迎来到金立俱乐部')
  })

  test('navigation works correctly', async ({ page }) => {
    // Test navigation to tasks page
    await page.click('text=任务')
    await expect(page).toHaveURL(/.*tasks/)
    await expect(page.locator('h1')).toContainText('任务中心')

    // Test navigation to rewards page
    await page.click('text=奖励')
    await expect(page).toHaveURL(/.*rewards/)
    await expect(page.locator('h1')).toContainText('奖励中心')

    // Test navigation to profile page
    await page.click('text=个人中心')
    await expect(page).toHaveURL(/.*profile/)
    await expect(page.locator('h1')).toContainText('个人中心')
  })

  test('responsive design works', async ({ page }) => {
    // Test desktop view
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('.container')).toBeVisible()
    
    // Test tablet view
    await page.setViewportSize({ width: 768, height: 1024 })
    await expect(page.locator('.container')).toBeVisible()
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 })
    await expect(page.locator('.container')).toBeVisible()
    
    // Test mobile menu
    await page.click('[data-testid="mobile-menu-button"]')
    await expect(page.locator('[data-testid="mobile-menu"]')).toBeVisible()
  })

  test('dark mode toggle works', async ({ page }) => {
    const toggle = page.locator('[data-testid="theme-toggle"]')
    
    // Check initial state
    const html = page.locator('html')
    await expect(html).not.toHaveClass('dark')
    
    // Toggle dark mode
    await toggle.click()
    await expect(html).toHaveClass('dark')
    
    // Toggle back to light mode
    await toggle.click()
    await expect(html).not.toHaveClass('dark')
  })

  test('language switching works', async ({ page }) => {
    // Test switching to English
    await page.click('[data-testid="language-selector"]')
    await page.click('text=English')
    await expect(page).toHaveURL(/.*\/en\//)
    
    // Test switching to Chinese
    await page.click('[data-testid="language-selector"]')
    await page.click('text=中文')
    await expect(page).toHaveURL(/.*\/zh\//)
  })

  test('search functionality works', async ({ page }) => {
    await page.goto('/tasks')
    
    // Enter search term
    await page.fill('[data-testid="search-input"]', 'test task')
    await page.press('[data-testid="search-input"]', 'Enter')
    
    // Verify search results
    await expect(page.locator('[data-testid="task-card"]')).toBeVisible()
  })

  test('modal interactions work', async ({ page }) => {
    await page.goto('/demo')
    
    // Open modal
    await page.click('[data-testid="open-modal"]')
    await expect(page.locator('[data-testid="modal"]')).toBeVisible()
    
    // Close modal with button
    await page.click('[data-testid="modal-close"]')
    await expect(page.locator('[data-testid="modal"]')).not.toBeVisible()
    
    // Open modal again and close with overlay
    await page.click('[data-testid="open-modal"]')
    await expect(page.locator('[data-testid="modal"]')).toBeVisible()
    await page.click('[data-testid="modal-overlay"]')
    await expect(page.locator('[data-testid="modal"]')).not.toBeVisible()
  })

  test('form submission works', async ({ page }) => {
    await page.goto('/demo')
    
    // Fill form fields
    await page.fill('[data-testid="form-name"]', 'Test User')
    await page.fill('[data-testid="form-email"]', 'test@example.com')
    await page.selectOption('[data-testid="form-role"]', 'user')
    await page.check('[data-testid="form-newsletter"]')
    
    // Submit form
    await page.click('[data-testid="form-submit"]')
    
    // Verify success message
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
  })

  test('error handling works', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/**', route => route.abort())
    
    await page.goto('/tasks')
    
    // Check if error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
  })

  test('loading states work', async ({ page }) => {
    // Simulate slow loading
    await page.route('**/api/tasks', route => {
      setTimeout(() => route.fulfill({ status: 200 }), 2000)
    })
    
    await page.goto('/tasks')
    
    // Check loading state
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible()
    
    // Wait for loading to complete
    await page.waitForSelector('[data-testid="task-card"]')
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible()
  })

  test('accessibility features work', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab')
    await expect(page.locator(':focus')).toBeVisible()
    
    // Test ARIA labels
    const button = page.locator('[aria-label="搜索"]')
    await expect(button).toHaveAttribute('aria-label', '搜索')
    
    // Test screen reader support
    const main = page.locator('main')
    await expect(main).toHaveAttribute('role', 'main')
  })
})
