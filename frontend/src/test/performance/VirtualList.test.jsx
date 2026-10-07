import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VirtualList } from '@components/ui/Performance'

describe('VirtualList Performance', () => {
  const mockItems = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    value: i * 10
  }))

  const renderItem = (item, index) => (
    <div key={item.id} data-testid={`item-${index}`}>
      {item.name} - {item.value}
    </div>
  )

  beforeEach(() => {
    // Mock IntersectionObserver
    vi.stubGlobal('IntersectionObserver', vi.fn().mockImplementation(() => ({
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn()
    })))
  })

  it('renders only visible items', () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        renderItem={renderItem}
      />
    )

    // Should render only visible items + buffer
    const visibleItems = screen.getAllByTestId(/^item-\d+$/)
    expect(visibleItems.length).toBeLessThan(10) // Much less than total 1000
  })

  it('handles large datasets efficiently', () => {
    const startTime = performance.now()
    
    render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={400}
        renderItem={renderItem}
      />
    )

    const endTime = performance.now()
    const renderTime = endTime - startTime
    
    // Should render quickly even with 1000 items
    expect(renderTime).toBeLessThan(100) // Less than 100ms
  })

  it('updates visible items on scroll', () => {
    const { container } = render(
      <VirtualList
        items={mockItems}
        itemHeight={50}
        containerHeight={200}
        renderItem={renderItem}
      />
    )

    const initialItems = screen.getAllByTestId(/^item-\d+$/)
    const firstItemBefore = initialItems[0]

    // S44-R1 · 判据对齐：VirtualList 自管滚动（useState(0) + onScroll→setScrollTop），
    //   从未提供 `scrollTop` prop（07360a3 建文件起至今一致）。原测以 prop 驱动滚动 ⇒ 无效。
    //   改为对真实滚动容器派发 scroll 事件。
    const scroller = container.querySelector('.overflow-auto')
    fireEvent.scroll(scroller, { target: { scrollTop: 500 } })

    const scrolledItems = screen.getAllByTestId(/^item-\d+$/)
    expect(scrolledItems.length).toBe(initialItems.length)

    // Items should be different after scroll
    const firstItemAfter = scrolledItems[0]
    expect(firstItemBefore).not.toBe(firstItemAfter)
  })

  it('handles empty list', () => {
    render(
      <VirtualList
        items={[]}
        itemHeight={50}
        containerHeight={200}
        renderItem={renderItem}
      />
    )

    const items = screen.queryAllByTestId(/^item-\d+$/)
    expect(items).toHaveLength(0)
  })

  it('handles dynamic item height', () => {
    render(
      <VirtualList
        items={mockItems}
        itemHeight={80}
        containerHeight={240}
        renderItem={renderItem}
      />
    )

    const visibleItems = screen.getAllByTestId(/^item-\d+$/)
    // With 240px container and 80px items, should show ~4 items
    expect(visibleItems.length).toBeLessThanOrEqual(6) // Including buffer
  })
})
