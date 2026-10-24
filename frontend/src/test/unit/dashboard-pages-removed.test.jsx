/**
 * 后台两页下架（Kevin 2026-10-22）：`/dashboard/listing-review`（商品审核）与
 * `/dashboard/rewards` 移除 —— 静态钉死：路由、页面文件、侧栏入口三处零残留。
 * 后端口（GET /api/admin/listing、takedown）保留不动（闲置但无害）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(process.cwd(), 'src')
const read = (p) => fs.readFileSync(path.join(SRC, p), 'utf8')

describe('后台下架：listing-review 与 rewards 两页零残留', () => {
  it('① 页面文件已删除', () => {
    expect(fs.existsSync(path.join(SRC, 'pages/admin/ListingReviewPage.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/admin/RewardsManagement.jsx'))).toBe(false)
  })

  it('② App.jsx 路由与 import 零残留', () => {
    const app = read('App.jsx')
    expect(app).not.toContain('ListingReviewPage')
    expect(app).not.toContain('RewardsManagement')
    expect(app).not.toMatch(/path="listing-review"/)
    expect(app).not.toMatch(/path="rewards"/)
  })

  it('③ AdminLayout 侧栏零残留（title 引用与路径都移除；i18n 键保留不删）', () => {
    const layout = read('components/layout/AdminLayout.jsx')
    expect(layout).not.toContain('/dashboard/listing-review')
    expect(layout).not.toContain('/dashboard/rewards')
    expect(layout).not.toContain("t('adminNav.listingReview')")
    expect(layout).not.toContain("t('adminNav.rewards')")
  })

  it('④ locale 键保留（不删键：adminNav.rewards/listingReview 四语仍在，避免计数爆炸）', () => {
    const zh = JSON.parse(fs.readFileSync(path.join(SRC, 'locales/zh.json'), 'utf8'))
    expect(zh.adminNav.rewards).toBe('奖品管理')
    expect(zh.adminNav.listingReview).toBe('商品审核')
  })

  it('⑤ TasksManagement / ShardsManagement 两页已下线（2026-10-24 第②轮 ⇒ 文件不存在）；其余后台页不受影响', () => {
    // ★ 2026-10-24（Kevin · 三轮中的第②轮）：本行由 at.true 反转为 at.false（两页下线，
    //   零残留判据见 `admin-basic-settings.test.jsx` ②）。
    expect(fs.existsSync(path.join(SRC, 'pages/admin/TasksManagement.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/admin/ShardsManagement.jsx'))).toBe(false)
    // ★ 2026-10-24（Kevin · 三轮中的第①轮）：仲裁审核 / 权限管理两页下架 ⇒ 本行由 at.true 反转为 at.false
    expect(fs.existsSync(path.join(SRC, 'pages/admin/ArbitrationReviewPage.jsx'))).toBe(false)
    expect(fs.existsSync(path.join(SRC, 'pages/admin/PermissionsManagement.jsx'))).toBe(false)
  })
})
