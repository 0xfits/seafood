/**
 * 商品卡**行结构重定义**单测（Kevin 2026-10-19 逐字：image-container + content 四行）
 *
 * 口径（断言分两层，jsdom 无布局 ⇒ 几何读数走真浏览器探针 `ops/card-rows/`）：
 *   ① DOM 面：两部分结构（`.image-container` + `.content`），content 恰四行且顺序固定
 *      （`.row1-wrap-title` 48 / `.row2-wrap-service` 32 空 / `.row3-wrap-price` 24 / `.row4-wrap-seller` 48）；
 *      标题按**显示宽单位** 48 截断并追加字面 `...`（纯函数 `truncateByWidth` 四边界）；
 *      价格行左 `$` + 数字、右「{n}人想要」（n = `reward.wants`）；卖家栏结构与四档胶囊不变。
 *   ② 接线面（仓内静态断言体例）：reward-card.css 卡高 392 / 图 240 / 四行 48|32|24|48 声明在场；
 *      后端 `listBrands` 携带 `listing_favorite` 聚合列并透出加性键 `wants`；四语 `rewardCard.wants` 键齐备。
 *
 * ★ 相对上一版（412 恒高 + 中部卡体）的**合法移除**（四行结构无槽位）：描述行 / 剩余时间行 /
 *   `reward-card-claim` 三态胶囊（仓内唯一消费方首页恒传 `actionLabelKey` ⇒ 生产不可达）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '../../i18n'
import { RewardCard } from '../../components/reward/RewardCard'
import { truncateByWidth, displayWidthUnits, charWidthUnits, TITLE_MAX_UNITS } from '../../components/reward/truncate'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cardSrc = fs.readFileSync(path.join(SRC, 'components/reward/RewardCard.jsx'), 'utf8')
const cardCss = fs.readFileSync(path.join(SRC, 'components/reward/reward-card.css'), 'utf8')
const msgSrc = fs.readFileSync(path.join(SRC, '../../backend-ts/src/messages-service.ts'), 'utf8')
const dbSrc = fs.readFileSync(path.join(SRC, '../../backend-ts/src/database.ts'), 'utf8')

const baseReward = (over = {}) => ({
  bID: 1,
  title: '商品 R',
  description: '描述 D',
  image: '/media/x.png',
  points_required: 495,
  wants: 20,
  status: 'available',
  statusText: '库存不足-XYZ',
  limited: true,
  claimed: 0,
  total: 5,
  seller: { uid: 7, nickname: '0x12**12', avatar: null, credit: 'excellent' },
  ...over,
})

const renderCard = (reward, over = {}) => render(
  <MemoryRouter>
    <RewardCard reward={reward} {...over} />
  </MemoryRouter>,
)

afterEach(() => { cleanup(); })

// ---------------------------------------------------------------------------
// A · 纯函数 `truncateByWidth`（48 显示宽单位 · CJK/全角 = 2，拉丁/数字 = 1）
// ---------------------------------------------------------------------------
describe('A · truncateByWidth 四边界（48 显示宽单位）', () => {
  it('宽度单位：CJK / 全角 = 2，拉丁 / 数字 / 半角 = 1；上限常量 = 48', () => {
    expect(charWidthUnits('汉')).toBe(2)
    expect(charWidthUnits('、')).toBe(2)
    expect(charWidthUnits('a')).toBe(1)
    expect(charWidthUnits('7')).toBe(1)
    expect(charWidthUnits(' ')).toBe(1)
    expect(TITLE_MAX_UNITS).toBe(48)
    expect(displayWidthUnits('汉a')).toBe(3)
  })

  it('48 单位内不截（拉丁 48 / 汉字 24 / 混排 48）', () => {
    const latin48 = 'a'.repeat(48)
    expect(truncateByWidth(latin48, 48)).toBe(latin48)

    const han24 = '汉'.repeat(24)
    expect(displayWidthUnits(han24)).toBe(48)
    expect(truncateByWidth(han24, 48)).toBe(han24)

    const mixed = '汉a'.repeat(16) // 16 × 3 = 48
    expect(displayWidthUnits(mixed)).toBe(48)
    expect(truncateByWidth(mixed, 48)).toBe(mixed)
  })

  it('49 单位截断且末尾是字面 `...`（三个 ASCII 点，非 `…`）', () => {
    const latin49 = 'a'.repeat(49)
    const out = truncateByWidth(latin49, 48)
    expect(out).toBe('a'.repeat(48) + '...')
    expect(out.endsWith('...')).toBe(true)
    expect(out.includes('…')).toBe(false)

    const han25 = '汉'.repeat(25) // 50 单位
    const outHan = truncateByWidth(han25, 48)
    expect(outHan).toBe('汉'.repeat(24) + '...')
  })

  it('空值 / 非字符串安全：null ⇒ 空串；数字 ⇒ 字符串化后原样', () => {
    expect(truncateByWidth(null, 48)).toBe('')
    expect(truncateByWidth(undefined, 48)).toBe('')
    expect(truncateByWidth('短标题', 48)).toBe('短标题')
  })
})

// ---------------------------------------------------------------------------
// B · DOM 面：两部分 + 四行固定结构
// ---------------------------------------------------------------------------
describe('B · DOM 面 · image-container + content 四行', () => {
  it('卡体恰两个流内子元素：`.image-container` 与 `.content`（顺序固定）', () => {
    const { container } = renderCard(baseReward())
    const inner = container.querySelector('.sf-reward-inner')
    expect(inner).not.toBeNull()
    const flow = [...inner.children]
    expect(flow.map((el) => el.className.split(' ')[0])).toEqual(['image-container', 'content'])
    expect(inner.querySelector('.image-container img.sf-reward-media-img')).not.toBeNull()
  })

  it('content 恰四行、顺序与命名固定（row1 标题 / row2 服务空槽 / row3 价格 / row4 卖家）', () => {
    const { container } = renderCard(baseReward())
    const content = container.querySelector('.sf-reward-inner > .content')
    expect(content).not.toBeNull()
    const rows = [...content.children]
    expect(rows.map((el) => el.className.split(' ')[0])).toEqual([
      'row1-wrap-title', 'row2-wrap-service', 'row3-wrap-price', 'row4-wrap-seller',
    ])
    expect(rows.map((el) => el.getAttribute('data-sf-m'))).toEqual([
      'reward-card-title', 'reward-card-service', 'reward-card-price', 'reward-card-seller',
    ])
  })

  it('row2-wrap-service：**空占位**（无文本、无子元素）但恒在场', () => {
    const { container } = renderCard(baseReward({ tags: ['新品', '包邮'] }))
    const row = container.querySelector('.row2-wrap-service')
    expect(row).not.toBeNull()
    expect(row.textContent).toBe('')
    expect(row.children.length).toBe(0)
  })

  it('无图组合：`.image-container` 仍在（灰底占位，卡高恒 392 不塌陷），只是无 img', () => {
    const { container } = renderCard(baseReward({ image: null }))
    const box = container.querySelector('.image-container')
    expect(box).not.toBeNull()
    expect(box.querySelector('img')).toBeNull()
    expect(container.querySelectorAll('.content > *').length).toBe(4)
  })

  it('稀有度光斑（Q5）保留：absolute 出流，不占 image-container / content 的流内位', () => {
    const { container } = renderCard(baseReward({ rarity: 'legendary' }))
    expect(container.querySelector('.sf-reward-inner > .absolute.rounded-full')).not.toBeNull()
    const flow = [...container.querySelector('.sf-reward-inner').children].filter((el) => !el.className.includes('absolute top-0 right-0'))
    expect(flow.map((el) => el.className.split(' ')[0])).toEqual(['image-container', 'content'])
  })

  it('整卡链接（T112）：Router 内按 bID 构造 `/item/:id`（入口不变）', () => {
    const { container } = renderCard(baseReward())
    expect(container.querySelector('a[href="/item/1"]')).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// C · 标题行：48 单位截断落地到 DOM
// ---------------------------------------------------------------------------
describe('C · row1 标题截断（按显示宽单位，末尾 `...`）', () => {
  it('24 个汉字（48 单位）不截；25 个汉字截成 24 个 + `...`', () => {
    const han24 = '汉'.repeat(24)
    const a = renderCard(baseReward({ title: han24 }))
    expect(a.container.querySelector('[data-sf-m="reward-card-title"]').textContent).toBe(han24)
    a.unmount()

    const han25 = '汉'.repeat(25)
    const b = renderCard(baseReward({ title: han25 }))
    const txt = b.container.querySelector('[data-sf-m="reward-card-title"]').textContent
    expect(txt).toBe('汉'.repeat(24) + '...')
    expect(txt).not.toContain('…')
  })

  it('拉丁 48 字符不截；60 字符夹具截断且以 `...` 收尾（不溢出 48 单位）', () => {
    const latin48 = 'Ab1 '.repeat(12) // 48
    const a = renderCard(baseReward({ title: latin48 }))
    expect(a.container.querySelector('[data-sf-m="reward-card-title"]').textContent).toBe(latin48)
    a.unmount()

    const long = 'Ultra long product title fixture for truncation 60 chars!!'
    expect(long.length).toBeGreaterThan(48)
    const b = renderCard(baseReward({ title: long }))
    const txt = b.container.querySelector('[data-sf-m="reward-card-title"]').textContent
    expect(txt.endsWith('...')).toBe(true)
    expect(displayWidthUnits(txt.slice(0, -3))).toBeLessThanOrEqual(48)
    // 与纯函数同源（DOM 面不另算一套口径）
    expect(txt).toBe(truncateByWidth(long, 48))
  })
})

// ---------------------------------------------------------------------------
// D · 价格行：$N + {n}人想要
// ---------------------------------------------------------------------------
describe('D · row3 价格行（$N · {n}人想要）', () => {
  it('左 `$` + 数字（`$` 仍在 span 内）、右「{n}人想要」，n = reward.wants', () => {
    const { container } = renderCard(baseReward({ points_required: 495, wants: 20 }))
    const row = container.querySelector('.row3-wrap-price')
    expect(row).not.toBeNull()
    expect(container.querySelectorAll('span.sf-reward-price-cur')).toHaveLength(1)
    expect(container.querySelector('span.sf-reward-price-cur').textContent).toBe('$')
    expect(container.querySelector('span.sf-reward-price-num').textContent).toBe('495')
    expect(row.querySelector('[data-sf-m="reward-card-wants"]').textContent).toBe('20人想要')
  })

  it('wants = 0 ⇒「0人想要」（行恒在场，不因 0 隐藏）', () => {
    const { container } = renderCard(baseReward({ wants: 0 }))
    expect(container.querySelector('[data-sf-m="reward-card-wants"]').textContent).toBe('0人想要')
  })

  it('缺 wants 键（旧夹具 / 未升级后端）⇒ 回落 0，行仍在场', () => {
    const { container } = renderCard(baseReward({ wants: undefined }))
    expect(container.querySelector('[data-sf-m="reward-card-wants"]').textContent).toBe('0人想要')
  })

  it('四语 `rewardCard.wants`：值齐备、插值符为 `{{n}}` 双花括号、en/vn 无 CJK', () => {
    const tables = { zh, en, hk, vn }
    expect(zh.rewardCard.wants).toBe('{{n}}人想要')
    expect(hk.rewardCard.wants).toBe('{{n}}人想要')
    expect(en.rewardCard.wants).toBe('{{n}} want it')
    expect(vn.rewardCard.wants).toBe('{{n}} người muốn')
    for (const lang of ['zh', 'en', 'hk', 'vn']) {
      // i18next 未定制插值符 ⇒ 必须双花括号（单花括号不会被替换，会原样显示给用户）
      expect(tables[lang].rewardCard.wants).toContain('{{n}}')
      expect(tables[lang].rewardCard.wants.split('{{').length - 1).toBe(1)
      expect(tables[lang].rewardCard.wants.split('}}').length - 1).toBe(1)
    }
    const CJK = /[\u3400-\u9fff]/
    expect(CJK.test(en.rewardCard.wants)).toBe(false)
    expect(CJK.test(vn.rewardCard.wants)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// E · 卖家行（第 4 条）：结构与四档胶囊不变
// ---------------------------------------------------------------------------
describe('E · row4 卖家栏（视觉与上一版逐字不变）', () => {
  it('头像 24px（css 类）+ 灰昵称 + 信用胶囊；excellent ⇒ 橙系类 + zh 文案、胶囊内无图标', () => {
    const { container } = renderCard(baseReward())
    const bar = container.querySelector('[data-sf-m="reward-card-seller"]')
    expect(bar).not.toBeNull()
    expect(bar.className.split(' ')[0]).toBe('row4-wrap-seller')
    expect(bar.querySelector('.sf-reward-seller-avatar')).not.toBeNull()
    expect(bar.querySelector('.sf-reward-seller-name').textContent).toBe('0x12**12')
    expect(bar.querySelector('.sf-reward-seller-avatar').textContent).toBe('0')
    const tier = bar.querySelector('[data-sf-m="reward-card-seller-tier"]')
    expect(tier.textContent).toBe(zh.sellerCredit.excellent)
    expect(tier.className).toContain('bg-orange-100')
    expect(tier.className).toContain('text-orange-600')
    expect(tier.querySelector('svg')).toBeNull()
  })

  it('缺失 seller ⇒ 空名占位（「·」）+ new 档，栏恒在场', () => {
    const { container } = renderCard(baseReward({ seller: undefined }))
    const bar = container.querySelector('[data-sf-m="reward-card-seller"]')
    expect(bar).not.toBeNull()
    expect(bar.querySelector('.sf-reward-seller-avatar').textContent).toBe('·')
    expect(bar.querySelector('[data-sf-m="reward-card-seller-tier"]').textContent).toBe(zh.sellerCredit.new)
  })

  it('带头像组合：avatar 进 `.sf-reward-seller-avatar-img`（后端 0052 列透传）', () => {
    const { container } = renderCard(baseReward({ seller: { uid: 7, nickname: '0x12**12', avatar: '/api/media/m1', credit: 'good' } }))
    const img = container.querySelector('img.sf-reward-seller-avatar-img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/api/media/m1')
    expect(container.querySelector('[data-sf-m="reward-card-seller-tier"]').textContent).toBe(zh.sellerCredit.good)
  })
})

// ---------------------------------------------------------------------------
// F · 移除件零残留（四行结构无槽位）
// ---------------------------------------------------------------------------
describe('F · 移除件零残留（描述 / 时间 / 动作胶囊 / 状态徽章）', () => {
  it('描述、剩余时间、库存/限量/已领取文案与 `reward-card-claim` 均不进 DOM', () => {
    const { container } = renderCard(baseReward(), { actionLabelKey: 'item.viewDetail' })
    const text = container.textContent
    expect(text).not.toContain('描述 D')
    expect(text).not.toContain('库存不足-XYZ')
    expect(text).not.toContain(zh.rewardCard.limited)
    expect(text).not.toContain(zh.rewardCard.timeLimited)
    expect(text).not.toContain(zh.common.claimedUnit)
    expect(container.querySelectorAll('[data-sf-m="reward-card-claim"]').length).toBe(0)
    expect(container.querySelectorAll('.lucide-gift, .lucide-star, .lucide-crown, .lucide-clock').length).toBe(0)
  })

  it('不传 actionLabelKey 的旧路径同样回到四行结构（无 CTA）—— 生产不可达路径已下线', () => {
    const { container } = renderCard(baseReward({ status: 'locked' }), { userPoints: 0 })
    expect(container.querySelectorAll('[data-sf-m="reward-card-claim"]').length).toBe(0)
    expect(container.querySelectorAll('.content > *').length).toBe(4)
  })

  it('RewardCard.jsx：退役件零残留（getRarityIcon / Gift|Star|Crown / Badge / statusText / Clock）', () => {
    expect(cardSrc).not.toContain('getRarityIcon')
    for (const dead of ['Gift', 'Star', 'Crown', "from '../ui/Badge'", 'reward.statusText', "t('rewardCard.limited')", "t('common.claimedUnit')", 'lucide-react']) {
      expect(cardSrc).not.toContain(dead)
    }
    expect(cardSrc).toContain('truncateByWidth')
    expect(cardSrc).toContain("t('rewardCard.wants'")
    expect(cardSrc.split('data-sf-m="reward-card-wants"').length - 1).toBe(1)
    expect(cardSrc).toContain('`sellerCredit.${')
  })
})

// ---------------------------------------------------------------------------
// G · 接线面：CSS 几何常量（真读数由 ops/card-rows 探针承重）
// ---------------------------------------------------------------------------
describe('G · 接线面 · reward-card.css 几何常量', () => {
  it('卡高 392 + 图容器 240 + 四行 48/32/24/48 + cover/center + 头像 24', () => {
    expect(cardCss).toContain('height: 392px')
    expect(cardCss).toContain('.image-container')
    expect(cardCss).toContain('height: 240px')
    expect(cardCss).toContain('object-fit: cover')
    expect(cardCss).toContain('object-position: center')
    for (const sel of ['.row1-wrap-title', '.row2-wrap-service', '.row3-wrap-price', '.row4-wrap-seller']) {
      expect(cardCss).toContain(sel)
    }
    expect(cardCss).toContain('flex: 0 0 48px')
    expect(cardCss).toContain('flex: 0 0 32px')
    expect(cardCss).toContain('flex: 0 0 24px')
    expect(cardCss).toContain('width: 24px')
    // 旧口径 412 必须零残留（本单把卡高常量整体前推到 392）
    expect(cardCss).not.toContain('412px')
  })

  it('价格行参考图口径（2026-10-19）：#FF4D00 17px/700 数字 + 同色 12px 符号（≥12 下限）+ #999999 12px/400 wants + 左对齐同基线', () => {
    // ① 局部常量（卡片白底、日/夜同值）——**不进主题 token 层**
    expect(cardCss).toContain('--sf-reward-price-fg: #FF4D00')
    expect(cardCss).toContain('--sf-reward-wants-fg: #999999')
    const themeTokensCss = fs.readFileSync(path.join(SRC, 'theme/theme-tokens.css'), 'utf8')
    expect(themeTokensCss).not.toContain('#FF4D00')
    expect(themeTokensCss).not.toContain('#999999')
    // ② 行：左对齐分组 + 基线（不再两端对齐）
    const block = (sel) => {
      const i = cardCss.indexOf(sel + ' {')
      expect(i).toBeGreaterThan(-1)
      return cardCss.slice(i, cardCss.indexOf('}', i))
    }
    const row3 = block('.sf-reward-card .row3-wrap-price')
    expect(row3).toContain('height: 24px')
    expect(row3).toContain('align-items: baseline')
    expect(row3).toContain('justify-content: flex-start')
    expect(row3).not.toContain('space-between')
    // ③ 字号/字重：数字 17px/700，符号 12px/700 同色（硬口径 ≥12px：参考图 0.6em=10.2px 已废），wants 12px/400 灰
    const numBlk = block('.sf-reward-price-num')
    expect(numBlk).toContain('font-size: 17px')
    expect(numBlk).toContain('font-weight: 700')
    expect(numBlk).toContain('color: var(--sf-reward-price-fg)')
    const curBlk = block('.sf-reward-price-cur')
    expect(curBlk).toContain('font-size: 12px')
    expect(curBlk).not.toMatch(/font-size:\s*[\d.]+em/)
    const curSize = parseFloat((curBlk.match(/font-size:\s*([\d.]+)px/) || [])[1])
    expect(curSize).toBeGreaterThanOrEqual(12)
    expect(curBlk).toContain('font-weight: 700')
    expect(curBlk).toContain('color: var(--sf-reward-price-fg)')
    const wantsBlk = block('.sf-reward-card .sf-reward-wants')
    expect(wantsBlk).toContain('font-size: 12px')
    expect(wantsBlk).toContain('font-weight: 400')
    expect(wantsBlk).toContain('color: var(--sf-reward-wants-fg, #999999)')
    // ④ 符号仍是 `$`（span 内、无 `¥` 引入）
    expect(cardSrc).toContain('<span className="sf-reward-price-cur">$</span>')
    const { container } = renderCard(baseReward({ points_required: 495, wants: 20 }))
    const rowText = container.querySelector('.row3-wrap-price').textContent
    expect(rowText).toBe('$49520人想要')
    expect(rowText).not.toMatch(/[¥￥]/)
  })
})

// ---------------------------------------------------------------------------
// H · 后端单源：maskWalletAddress + seller / wants 加性键
// ---------------------------------------------------------------------------
describe('H · 后端单源 · 星号掩码 + seller / wants 加性键', () => {
  it('messages-service.ts：maskWalletAddress = 前4 + 2 星 + 后2；credit 档位函数在场；avatar 读 0052 列', () => {
    expect(msgSrc).toContain("evm.slice(0, 4)}**${evm.slice(-2)")
    expect(msgSrc).toContain('evm.length >= 8')
    expect(msgSrc).toContain('export const creditFromAvg')
    expect(msgSrc).toContain('4.5')
    expect(msgSrc).toContain('3.5')
    expect(msgSrc).toContain('u.avatar_url')
  })

  it('database.ts：listBrands 带 `listing_favorite` 计数聚合（LEFT JOIN + COALESCE）并透出 `wants`', () => {
    expect(dbSrc).toContain('listing_favorite')
    expect(dbSrc).toContain('AS want_count')
    expect(dbSrc).toContain('COALESCE(fav.want_count, 0)::int AS want_count')
    expect(dbSrc).toContain('GROUP BY listing_id')
    expect(dbSrc).toContain(') AS fav ON fav.listing_id = l.listing_id')
    expect(dbSrc).toContain("getValue(row, 'want_count')")
    expect(dbSrc).toContain('record.wants =')
    expect(dbSrc).toContain('wants?: number')
    // 卖家三列（上一版）不得回退
    expect(dbSrc).toContain('maskWalletAddress')
    expect(dbSrc).toContain('seller_evm')
    expect(dbSrc).toContain('seller_avatar_url')
    expect(dbSrc).toContain('seller_rating_avg')
    expect(dbSrc).toContain('LEFT JOIN public.users AS u ON u.uid = l.seller_uid')
  })

  it('四语 sellerCredit：键集逐文件相同、en/vn 无 CJK、值互异', () => {
    const tables = { zh, en, hk, vn }
    const keys = Object.keys(zh.sellerCredit).sort()
    expect(keys).toEqual(['excellent', 'good', 'new', 'normal'])
    for (const lang of ['en', 'hk', 'vn']) {
      expect(Object.keys(tables[lang].sellerCredit).sort()).toEqual(keys)
    }
    const CJK = /[\u3400-\u9fff]/
    expect(CJK.test(JSON.stringify(en.sellerCredit))).toBe(false)
    expect(CJK.test(JSON.stringify(vn.sellerCredit))).toBe(false)
    expect(new Set(Object.values(zh.sellerCredit)).size).toBe(4)
  })
})
