import React from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card } from '../ui/Card'
import { buildLocalizedPath, cn } from '../../utils'
import { contentStatus } from '../../i18n-content'
import TranslatingBadge from '../i18n/TranslatingBadge'
import { truncateByWidth, TITLE_MAX_UNITS } from './truncate'
import './reward-card.css'

/**
 * 首页商品卡（design-system.spec §22 · T109–T113；2026-10-19 **结构重定义**）
 * ============================================================================
 * Kevin 逐字（本文件即该口径的实现）：
 *   「商品卡片实际分为两个部分：image-container 和 content，后者分为四行：
 *     row1-wrap-title 内容是商品的标题，如果超出 48 个字符（24 个汉字）则截断，并在后面加'...'，
 *     尺寸 224x48；row2-wrap-service 内容放一些标签，目前暂时留空，尺寸 224x32；row3-wrap-price
 *     内容是价格，形如：¥495 20人想要；row4-wrap-seller 内容是卖家信息。」
 *
 * 几何（卡内宽 224 · 常量只落 reward-card.css）：
 *   `.image-container` 240×224（cover 居中裁切）→ 240
 *   `.row1-wrap-title` 48 + `.row2-wrap-service` 32 + `.row3-wrap-price` 24 + `.row4-wrap-seller` 48 = 152
 *   ⇒ **卡总高 392**（原 412 作废：412 需要图 260，非本单口径）。
 *
 * 标题截断：**按显示宽单位**（CJK/全角 = 2，拉丁/数字 = 1）上限 48，超出后追加字面 `...`
 *   —— 纯函数 `./truncate.js#truncateByWidth(text, 48)`（可单测；`-webkit-line-clamp: 2` 只作兜底）。
 *
 * 相对上一版**合法移除**（四行结构无槽位，均为死路径或在第 4 条改版已移除）：
 *   · 描述行（`reward.description`）· 剩余时间行（`rewardCard.timeLimited` + `Clock` 图标）
 *   · 旧「动作胶囊」`reward-card-claim` 三态路径（`actionLabelKey` 不传时才走；仓内唯一消费方
 *     首页恒传 `actionLabelKey` ⇒ 生产不可达 ⇒ 整块下线，`onClaim` 保留形参仅为调用方兼容）
 *   · `CardHeader` / `CardContent` / `CardTitle` 包裹层（行高由 `.row*-wrap-*` 固定）
 * 保留：整卡链接（T112/T113）、稀有度光斑（Q5）、`$` 在 `<span>` 内（r9-93 锚）、
 *   「翻译中」小标（TR-2）、卖家栏结构与四档信用胶囊（第 4 条，视觉不变）。
 */
const RewardCard = ({
  reward,
  // —— 以下为调用方兼容形参：新四行结构不再消费（见文件头「合法移除」）——
  onClaim,
  userPoints = 0,
  showStatus = true,
  compact = false,
  actionLabelKey = null,
  /** v1.20 §22 `T112`（整卡可点击）：链接目标由调用方（首页）经 `buildLocalizedPath` 传入。 */
  to = null
}) => {
  void onClaim; void userPoints; void showStatus; void actionLabelKey
  const { t, i18n } = useTranslation()

  // 卖家栏数据（服务端算好下发）：`nickname` = 星号打码钱包地址；`avatar` = users.avatar_url；
  // `credit` ∈ new/normal/good/excellent。缺 `seller`（裸渲染用例 / 旧夹具）⇒ 空名占位 + 'new'，
  // **卖家栏恒渲染**（固定高布局的一员）。
  const seller = reward.seller ?? { uid: 0, nickname: '', avatar: null, credit: 'new' }

  // row3 右端「{n}人想要」：n = 该商品收藏数（`listing_favorite` count，后端 `wants` 加性键）。
  // 缺键（旧夹具 / 未升级后端）⇒ 0，**行恒在场**。
  const wants = Number.isFinite(Number(reward.wants)) ? Number(reward.wants) : 0

  // 标题：本地化文本先按显示宽单位截断（48 单位 = 24 个汉字），再进固定 48 高两行盒。
  const titleText = truncateByWidth(reward.title ?? '', TITLE_MAX_UNITS)

  // 整卡链接：优先用调用方传入的 `to`；否则在**有 Router** 时按 id + 当前语言自行构造。
  // 无 Router（既有裸渲染用例）⇒ `href = null` ⇒ 根元素回落 `<div>`（同 class / 同结构 / 无 `href`）。
  const inRouter = useInRouterContext()
  const lang = i18n?.resolvedLanguage || i18n?.language || 'zh'
  const itemId = reward?.bID ?? reward?.listing_id ?? reward?.id
  const href = to || (itemId != null && itemId !== '' ? buildLocalizedPath(lang, '/item/' + itemId) : null)
  const clickable = Boolean(href) && (Boolean(to) || inRouter)
  const Root = clickable ? (inRouter ? Link : 'a') : 'div'
  const rootLinkProps = clickable ? (inRouter ? { to: href } : { href }) : {}

  return (
    <Root className="sf-reward-card block" data-sf-m="reward-card" {...rootLinkProps}>
      <Card
        variant={reward.variant || 'default'}
        hover="none"
        className={cn(
          // 恒高 392 + flex column + padding 0（几何常量在 reward-card.css，不用 Tailwind 任意值）
          'sf-reward-inner relative overflow-hidden hover:shadow-lg',
          compact && 'p-4',
          reward.rarity === 'legendary' && 'border-yellow-400',
          reward.rarity === 'epic' && 'border-purple-400'
        )}
      >
        {/* 稀有度光效（Q5：保留） */}
        {reward.rarity && (
          <div className={cn(
            'absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-xl',
            reward.rarity === 'legendary' && 'bg-yellow-400',
            reward.rarity === 'epic' && 'bg-purple-400',
            reward.rarity === 'rare' && 'bg-blue-400'
          )} />
        )}

        {/* 第一部分 · image-container：恒 240 高、通栏（宽随栅格），原图任意比例 ⇒
            `object-fit: cover; object-position: center` 居中裁切（常量见 reward-card.css）。
            无图 ⇒ 容器仍在（灰底占位）—— 卡高恒 392 不允许图片槽塌陷。 */}
        <div className="image-container" data-sf-m="reward-card-image">
          {reward.image && (
            <img
              src={reward.image}
              alt={reward.title}
              className="sf-reward-media-img"
            />
          )}
          {reward.discount && (
            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">
              -{reward.discount}%
            </div>
          )}
        </div>

        {/* 第二部分 · content：四行固定高（48 / 32 / 24 / 48 = 152） */}
        <div className="content">
          {/* row1 · 标题：48 高 = 两行 × 24 行高；文本已按 48 显示宽单位截断并追加 `...`。
              `<h3>` 保标题语义（a11y role=heading，与 `ui/Card.jsx` 的 `CardTitle` 同级）。 */}
          <h3
            className="row1-wrap-title line-clamp-2"
            data-sf-m="reward-card-title"
          >
            {titleText}
            {/* 「翻译中」小标（TR-2）：`i18n_status ∈ {pending, partial}` 且非 zh 档才渲染 */}
            <TranslatingBadge status={contentStatus(reward)} />
          </h3>

          {/* row2 · 服务/标签槽：**当前留空**（Kevin：暂时留空），但占位恒在场（32 高） */}
          <div className="row2-wrap-service" data-sf-m="reward-card-service" />

          {/* row3 · 价格：左 `$` + 数字（两端对齐的左端）/ 右「{n}人想要」（灰、右对齐），单行不换行 */}
          <div className="row3-wrap-price" data-sf-m="reward-card-price">
            {Boolean(reward.points_required) && (
              // `$` 必须仍在 `<span>` 内（`r9-93-points-symbol` 断言本文件「$ 收尾 span」恰 1 处）。
              <div className="sf-reward-price">
                <span className="sf-reward-price-cur">$</span>
                <span className="sf-reward-price-num">{reward.points_required}</span>
              </div>
            )}
            <span className="sf-reward-wants" data-sf-m="reward-card-wants">
              {t('rewardCard.wants', { n: wants })}
            </span>
          </div>

          {/* row4 · 卖家栏（第 4 条，视觉不变）：左 24 圆头像 + 灰脱敏昵称，右信用胶囊 */}
          <div className="row4-wrap-seller" data-sf-m="reward-card-seller">
            <div className="sf-reward-seller-id">
              <span className="sf-reward-seller-avatar" aria-hidden="true">
                {seller.avatar
                  ? <img src={seller.avatar} alt="" className="sf-reward-seller-avatar-img" />
                  : (seller.nickname ? seller.nickname.slice(0, 1) : '·')}
              </span>
              <span className="sf-reward-seller-name">{seller.nickname}</span>
            </div>
            <span
              className={cn(
                'inline-flex items-center rounded-full font-medium',
                compact ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
                seller.credit === 'excellent' && 'bg-orange-100 text-orange-600',
                seller.credit === 'good' && 'bg-blue-50 text-blue-600',
                seller.credit === 'normal' && 'bg-gray-100 text-gray-500',
                (seller.credit === 'new' || !seller.credit) && 'bg-gray-100 text-gray-400'
              )}
              data-sf-m="reward-card-seller-tier"
            >
              {t(`sellerCredit.${seller.credit || 'new'}`)}
            </span>
          </div>
        </div>
      </Card>
    </Root>
  )
}

export { RewardCard }
