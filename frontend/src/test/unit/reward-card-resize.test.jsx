/**
 * 商品卡改版单测（Kevin 2026-10-19 四条指令 + 追加第 4 条卖家栏）
 *
 * 口径（断言分两层，jsdom 无布局 ⇒ 几何读数走真浏览器探针 `ops/card-resize/`）：
 *   ① DOM 面：状态徽章（库存不足/可兑换/已兑换 + limited + 前置礼物图标）、「N 人已领取」领取行、
 *      品牌行（与卖家栏/标题信息重复）整块移除；预览图置卡顶（`.sf-reward-media` 为卡体首个流内子元素）；
 *      卖家栏恒渲染（头像/昵称/四档信用胶囊）；`$` 价格块、`reward-card-claim`（非首页路径）、
 *      整卡链接（T112/T113）逐字保留；稀有度光斑（Q5）保留。
 *   ② 接线面（仓内静态断言体例）：reward-card.css 恒高 412 / 图 240 cover / 卖家栏 48 / 头像 24 声明在场；
 *      RewardCard.jsx 退役件零残留（getRarityIcon / Gift|Star|Crown / Badge / statusText / 死键消费点）；
 *      后端单源助手 `maskWalletAddress`（星号打码）在 messages-service 与 database.ts 同源共用。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cleanup, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'

import i18n from '../../i18n'
import { RewardCard } from '../../components/reward/RewardCard'
import zh from '../../locales/zh.json'
import en from '../../locales/en.json'
import hk from '../../locales/hk.json'
import vn from '../../locales/vn.json'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const cardSrc = fs.readFileSync(path.join(SRC, 'components/reward/RewardCard.jsx'), 'utf8')
const cardCss = fs.readFileSync(path.join(SRC, 'components/reward/reward-card.css'), 'utf8')
const msgSrc = fs.readFileSync(path.join(SRC, '../../backend-ts/src/messages-service.ts'), 'utf8')
const dbSrc = fs.readFileSync(path.join(SRC, '../../backend-ts/src/database.ts'), 'utf8')

const EVM = '0x1234567890abcdef1234567890ABCDEF12'

const baseReward = (over = {}) => ({
  bID: 1,
  title: '商品 R',
  description: '描述 D',
  image: '/media/x.png',
  points_required: 66,
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

describe('卡改版 ① DOM 面 · 移除件零残留', () => {
  it('状态徽章/限量/领取行（含礼物图标语义）不进 DOM；首页路径（actionLabelKey）CTA 也不渲染', () => {
    const { container } = renderCard(baseReward(), { actionLabelKey: 'item.viewDetail' })
    const text = container.textContent
    expect(text).not.toContain('库存不足-XYZ')          // statusText（徽章唯一消费点已删）
    expect(text).not.toContain(zh.rewardCard.limited)   // 限量徽章
    expect(text).not.toContain(zh.common.claimedUnit)   // 「人已领取」领取行
    expect(text).not.toContain('/ 5')                   // 「/ 总数」
    expect(container.querySelectorAll('[data-sf-m="reward-card-claim"]').length).toBe(0)
    // 状态徽章的伴生 lucide 图标（gift/star/crown）零渲染
    expect(container.querySelectorAll('.lucide-gift, .lucide-star, .lucide-crown').length).toBe(0)
  })

  it('非首页回落路径：`reward-card-claim` 恰 1（三态文案路径保留）', () => {
    const { container } = renderCard(baseReward({ status: 'locked' }), { userPoints: 0 })
    const cta = container.querySelectorAll('[data-sf-m="reward-card-claim"]')
    expect(cta.length).toBe(1)
    expect(cta[0].textContent).toBe(zh.rewardCard.insufficient)
  })

  it('品牌行不再渲染（name 与标题同源、logo 与预览图同源；身份改由卖家栏承载）', () => {
    const { container } = renderCard(baseReward({ brand: { name: '商品 R', logo: '/media/x.png' } }))
    // 旧品牌行 = `<span className="text-sm text-gray-500">` ⇒ 移除后该形态在卡内计数 0
    expect(container.querySelectorAll('span.text-sm.text-gray-500').length).toBe(0)
    const imgs = [...container.querySelectorAll('img')]
    expect(imgs.every((img) => img.className.includes('sf-reward-media-img') || img.className.includes('sf-reward-seller-avatar-img'))).toBe(true)
  })
})

describe('卡改版 ② DOM 面 · 预览图置卡顶 + 结构保留', () => {
  it('`.sf-reward-media` 是卡体（.sf-reward-inner）首个流内子元素，img 在内', () => {
    const { container } = renderCard(baseReward())
    const inner = container.querySelector('.sf-reward-inner')
    expect(inner).not.toBeNull()
    expect(inner.firstElementChild.className).toContain('sf-reward-media')
    expect(inner.querySelector('img.sf-reward-media-img')).not.toBeNull()
  })

  it('无图组合：media 不渲染、卡体仍完整（恒 412 由 css 兜底，见接线面）', () => {
    const { container } = renderCard(baseReward({ image: null }))
    expect(container.querySelector('.sf-reward-media')).toBeNull()
    expect(container.querySelector('.sf-reward-inner')).not.toBeNull()
    expect(container.querySelector('.sf-reward-price-cur').textContent).toBe('$')
  })

  it('稀有度光斑（Q5 裁定）保留：光斑在场且不影响 media 的流内首位（absolute 出流）', () => {
    const { container } = renderCard(baseReward({ rarity: 'legendary' }))
    expect(container.querySelector('.sf-reward-inner > .absolute.rounded-full')).not.toBeNull()
    const inner = container.querySelector('.sf-reward-inner')
    const flowChildren = [...inner.children].filter((el) => !el.className.includes('absolute top-0 right-0'))
    expect(flowChildren[0].className).toContain('sf-reward-media')
  })

  it('整卡链接（T112）：Router 内按 bID 构造 `/item/:id`；`$` 价格块恰 1 处 `$` span（r9-93 锚）', () => {
    const { container } = renderCard(baseReward())
    const a = container.querySelector('a[href="/item/1"]')
    expect(a).not.toBeNull()
    expect(container.querySelectorAll('span.sf-reward-price-cur')).toHaveLength(1)
    expect(container.querySelector('span.sf-reward-price-cur').textContent).toBe('$')
  })
})

describe('卡改版 ③ DOM 面 · 卡底卖家栏（Kevin 第 4 条）', () => {
  it('恒渲染：头像 24px（css 类）+ 灰昵称 + 信用胶囊；excellent ⇒ 橙色系类 + zh 文案', () => {
    const { container } = renderCard(baseReward())
    const bar = container.querySelector('[data-sf-m="reward-card-seller"]')
    expect(bar).not.toBeNull()
    expect(bar.querySelector('.sf-reward-seller-avatar')).not.toBeNull()
    expect(bar.querySelector('.sf-reward-seller-name').textContent).toBe('0x12**12')
    // 掩码名首字符占位头像（avatar=null ⇒ '0'）
    expect(bar.querySelector('.sf-reward-seller-avatar').textContent).toBe('0')
    const tier = bar.querySelector('[data-sf-m="reward-card-seller-tier"]')
    expect(tier.textContent).toBe(zh.sellerCredit.excellent)
    expect(tier.className).toContain('bg-orange-100')
    expect(tier.className).toContain('text-orange-600')
    expect(tier.querySelector('svg')).toBeNull() // 胶囊内无图标
  })

  it('档位映射：new ⇒ 灰系 + 「新卖家」；缺失 seller ⇒ 空名占位（「·」）+ new 档，栏恒在场', () => {
    const a = renderCard(baseReward({ seller: { uid: 7, nickname: '0x12**12', avatar: null, credit: 'new' } }))
    const t1 = a.container.querySelector('[data-sf-m="reward-card-seller-tier"]')
    expect(t1.textContent).toBe(zh.sellerCredit.new)
    expect(t1.className).toContain('bg-gray-100')
    a.unmount()

    const b = renderCard(baseReward({ seller: undefined }))
    const bar = b.container.querySelector('[data-sf-m="reward-card-seller"]')
    expect(bar).not.toBeNull()
    expect(bar.querySelector('.sf-reward-seller-avatar').textContent).toBe('·')
    expect(b.container.querySelector('[data-sf-m="reward-card-seller-tier"]').textContent).toBe(zh.sellerCredit.new)
  })

  it('带头像组合：avatar 进 `.sf-reward-seller-avatar-img`（后端 0052 列透传）', () => {
    const { container } = renderCard(baseReward({ seller: { uid: 7, nickname: '0x12**12', avatar: '/api/media/m1', credit: 'good' } }))
    const img = container.querySelector('img.sf-reward-seller-avatar-img')
    expect(img).not.toBeNull()
    expect(img.getAttribute('src')).toBe('/api/media/m1')
    expect(container.querySelector('[data-sf-m="reward-card-seller-tier"]').textContent).toBe(zh.sellerCredit.good)
  })
})

describe('卡改版 ④ 接线面 · css 恒高/裁切/卖家栏声明（几何读数由真浏览器探针承重）', () => {
  it('reward-card.css：卡高 412、图 240 + cover/center、卖家栏 48、头像 24、标题两行盒（2.25rem）', () => {
    expect(cardCss).toContain('height: 412px')
    expect(cardCss).toContain('.sf-reward-media')
    expect(cardCss).toContain('object-fit: cover')
    expect(cardCss).toContain('object-position: center')
    expect(cardCss).toContain('height: 240px')
    expect(cardCss).toContain('height: 48px')
    expect(cardCss).toContain('width: 24px')
    expect(cardCss).toContain('2.25rem')
  })

  it('RewardCard.jsx：退役件零残留（getRarityIcon / Gift|Star|Crown / Badge / statusText / 死键消费点）', () => {
    expect(cardSrc).not.toContain('getRarityIcon')
    for (const dead of ['Gift', 'Star', 'Crown', "from '../ui/Badge'", 'reward.statusText', "t('rewardCard.limited')", "t('common.claimedUnit')"]) {
      expect(cardSrc).not.toContain(dead)
    }
    expect(cardSrc).toContain("import { Clock } from 'lucide-react'")
    expect(cardSrc.split('data-sf-m="reward-card-claim"').length - 1).toBe(1)
    expect(cardSrc).toContain('`sellerCredit.${')
  })
})

describe('卡改版 ⑤ 后端单源 · 星号掩码助手 + seller 加性键', () => {
  it('messages-service.ts：maskWalletAddress = 前4 + 2 星 + 后2（0x12**cd）；credit 档位函数在场；avatar 读 0052 列', () => {
    expect(msgSrc).toContain("evm.slice(0, 4)}**${evm.slice(-2)")
    expect(msgSrc).toContain('evm.length >= 8')
    expect(msgSrc).toContain('export const creditFromAvg')
    expect(msgSrc).toContain('4.5')
    expect(msgSrc).toContain('3.5')
    expect(msgSrc).toContain('u.avatar_url')
  })

  it('database.ts：listBrands 携带卖家取数列（seller_evm/avatar_url/rating_avg 裸值）并经同源助手构建 seller', () => {
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
