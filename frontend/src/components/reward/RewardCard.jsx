import React from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { Gift, Clock, Star, Crown } from 'lucide-react'
import { buildLocalizedPath, cn } from '../../utils'
import { contentStatus } from '../../i18n-content'
import TranslatingBadge from '../i18n/TranslatingBadge'
import './reward-card.css'

const RewardCard = ({
  reward,
  onClaim,
  userPoints = 0,
  showStatus = true,
  compact = false,
  // 2026-10-11 合并单：可选动作文案键。首页（= 唯一列表）传 `item.viewDetail` ⇒
  // 卡片动作语义由「领取」改为「查看闲置物品详情」（原 `/reward` 已硬删）；**不传则行为与旧版逐字不变**
  // （`r9-93` / `i18n-batch-b2` 等裸渲染用例不受影响）。
  actionLabelKey = null,
  // ★ v1.20 §22 `T112`（整卡可点击）：链接目标由调用方（首页）经**唯一构造器**
  //   `buildLocalizedPath(lang, '/item/' + id)` 传入（`utils.js:115`）。
  //   **缺省（无 `to`）⇒ 回落非链接容器**（`T113` 硬契约）：`i18n-batch-b2.test.jsx:154/158/170`
  //   无 `MemoryRouter` 裸渲染 ⇒ ① 不得抛错；② 不得产出 `<a href>`。
  //   语言来源 = i18next（**严禁**任何宽度 / `matchMedia` 判定 —— 外壳硬断言按明文全文扫描）。
  to = null
}) => {
  const { t, i18n } = useTranslation()

  const getStatusVariant = (status) => {
    switch (status) {
      case 'available': return 'success'
      case 'claimed': return 'inactive'
      case 'locked': return 'warning'
      case 'expired': return 'inactive'
      default: return 'default'
    }
  }

  const getRarityIcon = (rarity) => {
    switch (rarity) {
      case 'legendary': return <Crown className="w-4 h-4 text-yellow-500" />
      case 'epic': return <Star className="w-4 h-4 text-purple-500" />
      case 'rare': return <Star className="w-4 h-4 text-blue-500" />
      default: return <Gift className="w-4 h-4 text-gray-500" />
    }
  }

  const canClaim = reward.status === 'available' && userPoints >= reward.points_required

  // 整卡链接：优先用调用方传入的 `to`（首页走构造器）；否则在**有 Router** 时按 id + 当前语言自行构造。
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
        // ★ Q5 裁定（方案 a）：缺省档由 `'primary'`（奶黄底 + 黄边框）改 `'default'`（`ui/Card.jsx:10`
        //   `bg-white border-gray-200`）⇒ 「卡片底色纯白」；**未改 `ui/Card.jsx` 变体表**。
        variant={reward.variant || 'default'}
        // ★ Q6 裁定：hover 只留阴影 —— 去 `hover="glow"`（含黄环 `ring-2 ring-yellow-200`）改 `"none"`，
        //   阴影由下方 `hover:shadow-lg` 提供；**不得位移**（不引入 `-translate-y-*`）；未改 hover 变体表。
        hover="none"
        className={cn(
          'relative overflow-hidden hover:shadow-lg',
          compact && 'p-4',
          // 稀有度：只留描边（**渐变底已按 Q5 同批去掉** —— 底属底色面）
          reward.rarity === 'legendary' && 'border-yellow-400',
          reward.rarity === 'epic' && 'border-purple-400'
        )}
      >
        {/* 稀有度光效（Q5：**保留**） */}
        {reward.rarity && (
          <div className={cn(
            'absolute top-0 right-0 w-20 h-20 rounded-full opacity-20 blur-xl',
            reward.rarity === 'legendary' && 'bg-yellow-400',
            reward.rarity === 'epic' && 'bg-purple-400',
            reward.rarity === 'rare' && 'bg-blue-400'
          )} />
        )}

        <CardHeader className={cn(compact && 'pb-2')}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {getRarityIcon(reward.rarity)}
                <Badge variant={getStatusVariant(reward.status)} size="sm">
                  {reward.statusText}
                </Badge>
                {reward.limited && (
                  <Badge variant="warning" size="sm">
                    {t('rewardCard.limited')}
                  </Badge>
                )}
              </div>

              <CardTitle className={cn(
                'text-gray-900 line-clamp-2',
                compact && 'text-base'
              )}>
                {reward.title}
                {/* 「翻译中」小标（TR-2）：`i18n_status ∈ {pending, partial}` 且非 zh 档才渲染 */}
                <TranslatingBadge status={contentStatus(reward)} />
              </CardTitle>
            </div>

            {reward.points_required && (
              // ★ `T110` 价格块（照参考图排版）：一行 flex + `align-items: baseline`；顺序 `$` → 数字；
              //   符号小（数字的 0.75 倍）/ 数字大号加粗；**无外框 / 无底色 / 无内边距**；
              //   色取本站 token `--sf-price-cur-fg` / `--sf-price-num-fg`（卡内局部重绑为日档值，见 reward-card.css）。
              //   ★ `$` 必须仍在 `<span>` 内（`r9-93-points-symbol` 断言本文件「$ 收尾 span」恰 1 处）。
              <div className="ml-4 sf-reward-price">
                <span className="sf-reward-price-cur">$</span>
                <span className="sf-reward-price-num text-2xl">{reward.points_required}</span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className={cn(compact && 'pt-0')}>
          {reward.image && (
            <div className="mb-4 relative">
              <img
                src={reward.image}
                alt={reward.title}
                className="w-full h-32 object-cover rounded-lg"
              />
              {reward.discount && (
                <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                  -{reward.discount}%
                </div>
              )}
            </div>
          )}

          {reward.description && (
            <p className="text-gray-600 text-sm mb-4 line-clamp-3">
              {reward.description}
            </p>
          )}

          {reward.brand && (
            <div className="flex items-center gap-2 mb-4">
              {reward.brand.logo && (
                <img
                  src={reward.brand.logo}
                  alt={reward.brand.name}
                  className="w-6 h-6 rounded-full object-cover"
                />
              )}
              <span className="text-sm text-gray-500">{reward.brand.name}</span>
            </div>
          )}

          {/* 剩余时间 */}
          {reward.time_end && reward.status === 'available' && (
            <div className="flex items-center gap-1 text-sm text-orange-600 mb-3">
              <Clock className="w-4 h-4" />
              <span>{t('rewardCard.timeLimited')}</span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Gift className="w-4 h-4" />
              <span>{reward.claimed || 0} {t('common.claimedUnit')}</span>
              {reward.total && (
                <span>/ {reward.total}</span>
              )}
            </div>

            {/* ★ `T112`：CTA 由 `<Button>` 降级为**非交互视觉胶囊**（整卡已是单一 `<a>` ⇒ 卡内
                `a|button|input|select|textarea` 计数必须 = 0）；文案键 `item.viewDetail` 与钩子
                `reward-card-view` 保留（钩子挂点由 `<button>` 迁至非交互元素）。
                仅在**非链接回落态**（无 `to` 且无 Router）才保留旧 `onClaim` 行为，链接态下不可加点击副作用。 */}
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-full font-semibold',
                compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-base',
                canClaim ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
              )}
              data-sf-m={actionLabelKey ? 'reward-card-view' : 'reward-card-claim'}
              onClick={clickable ? undefined : () => onClaim?.(reward)}
            >
              {actionLabelKey
                ? t(actionLabelKey)
                : !canClaim && userPoints < reward.points_required
                ? t('rewardCard.insufficient')
                : reward.status === 'claimed'
                ? t('common.claimed')
                : t('rewardCard.claimNow')
              }
            </span>
          </div>
        </CardContent>
      </Card>
    </Root>
  )
}

export { RewardCard }
