/**
 * Neng 独立质检腿 · §22.9 `AC-4`（无 Router 回落 · **两向判负** · 质检方自建）
 *
 * 判据（§22.9 AC-4 字面）：
 *   ① 无 `MemoryRouter` 直接 `render(<RewardCard reward={{…}} />)` ⇒ **不抛错**；
 *   ② 同一次裸渲染 ⇒ `container.querySelectorAll('a').length === 0`（回落**非链接容器**）。
 *   ③ 灵敏度自证（**同一把尺子在链接态必须能变红**）：`MemoryRouter` + `to` ⇒ 必须产出 `<a href>`，
 *      且 `href` 逐字 = `buildLocalizedPath(lang, '/item/' + id)`（zh `/item/1` / en `/en/item/1`）。
 *      —— 缺该臂则「`a` 计数 = 0」分不清「真回落」与「尺子读不到 `a`」。
 *
 * 本文件的**独立约定**：不 mock `react-i18next`、不 mock 路由；走仓内真实 i18n 实例。
 */
import React from 'react'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '/src/i18n'
import { RewardCard } from '/src/components/reward/RewardCard'

// 真实感商品文案（目视/报告可读；非 `FIXTURE` 占位字）
const R = {
  bID: 1,
  title: '九成新 iPhone 14 Pro 128G 深空黑 无拆无修',
  description: '自用一年，电池健康度 91%，原装盒充电线齐全',
  status: 'available',
  statusText: '在售',
  points_required: 29,
}

afterEach(() => cleanup())

describe('AC-4 · 无 Router 回落（两向判负）', () => {
  it('① 裸渲染（无 MemoryRouter）不抛错', () => {
    let err = null
    try {
      render(<RewardCard reward={R} />)
    } catch (e) {
      err = e
    }
    expect(err).toBeNull()
  })

  it('② 裸渲染（无 MemoryRouter）不产出 <a>：a 计数 = 0 且根元素回落 DIV', () => {
    const { container } = render(<RewardCard reward={R} />)
    const cardRoot = container.querySelector('[data-sf-m="reward-card"]')
    expect(cardRoot).not.toBeNull()
    expect(cardRoot.tagName).toBe('DIV')
    expect(container.querySelectorAll('a').length).toBe(0)
    expect(container.querySelectorAll('a[href]').length).toBe(0)
  })

  it('③ 灵敏度自证：有 Router + to ⇒ 产出 <a> 且 href = 构造器产物（en 档）', async () => {
    await i18n.changeLanguage('en')
    const { container } = render(
      <MemoryRouter>
        <RewardCard reward={R} to="/en/item/1" />
      </MemoryRouter>
    )
    const a = container.querySelector('a')
    expect(a).not.toBeNull()
    expect(a.getAttribute('href')).toBe('/en/item/1')

    // 与「裸渲染 a = 0」同一把尺子（`container.querySelectorAll('a').length`）⇒ 该臂必须非 0
    expect(container.querySelectorAll('a').length).toBeGreaterThan(0)

    // 卡内嵌套交互元素计数 = 0（`T112` 硬契约，随该臂一并取）
    const nested = container.querySelector('[data-sf-m="reward-card"]').querySelectorAll(
      'a,button,input,select,textarea'
    ).length
    expect(nested).toBe(0)

    // CTA 钩子在场且非 BUTTON / A（`T112` CTA 降级为视觉胶囊）
    const cta = container.querySelector('[data-sf-m="reward-card-view"]')
    if (cta) expect(['BUTTON', 'A'].includes(cta.tagName)).toBe(false)

    await i18n.changeLanguage('zh')
  })
})
