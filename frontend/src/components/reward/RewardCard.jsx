import React from 'react'
import { Link, useInRouterContext } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card'
import { Clock } from 'lucide-react'
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
  // ★ 2026-10-17 Kevin 指令：**首页卡片不再显示动作胶囊**（「查看详情」）—— 入口由**整卡链接**承载
  //   （卡根本身已是单一 `<Link>` / `<a>` ⇒ 删胶囊不丢入口）⇒ 本参数**保留为语义标记**（HomePage 传参不动），
  //   存在时动作胶囊**整块不渲染**；只有不传时那条 `reward-card-claim` 路径逐字照旧。
  actionLabelKey = null,
  // ★ v1.20 §22 `T112`（整卡可点击）：链接目标由调用方（首页）经**唯一构造器**
  //   `buildLocalizedPath(lang, '/item/' + id)` 传入（`utils.js:115`）。
  //   **缺省（无 `to`）⇒ 回落非链接容器**（`T113` 硬契约）：`i18n-batch-b2.test.jsx:154/158/170`
  //   无 `MemoryRouter` 裸渲染 ⇒ ① 不得抛错；② 不得产出 `<a href>`。
  //   语言来源 = i18next（**严禁**任何宽度 / `matchMedia` 判定 —— 外壳硬断言按明文全文扫描）。
  to = null
}) => {
  const { t, i18n } = useTranslation()

  const canClaim = reward.status === 'available' && userPoints >= reward.points_required

  // ★ 2026-10-19 Kevin 第 4 条：卡底卖家栏数据（服务端算好下发，前端不本地算）——
  //   `nickname` = 星号打码钱包地址（后端 `maskWalletAddress`，与详情页同源）；`avatar` = `users.avatar_url`
  //   （null ⇒ 灰底 + 掩码名首字符占位）；`credit` ∈ new/normal/good/excellent（无评分 ⇒ new）。
  //   缺 `seller`（既有裸渲染用例 / 旧夹具）⇒ 空名占位 + 'new' 档，**卖家栏恒渲染**（固定高布局的一员）。
  const seller = reward.seller ?? { uid: 0, nickname: '', avatar: null, credit: 'new' }

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
          // ★ 2026-10-19 Kevin 改版：`sf-reward-inner`（reward-card.css）= 恒高 412 + flex column + padding 0
          //   （图通栏占满卡宽；body 内边距由 `.sf-reward-body` 承接）。几何常量只落 css 文件，不用 Tailwind 任意值。
          'sf-reward-inner relative overflow-hidden hover:shadow-lg',
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

        {/* ★ 2026-10-19 Kevin 改版：商品预览图置卡**最顶**（Card 第一个子元素），通栏无侧 padding，
            固定高 240px；原图任意比例 ⇒ `object-fit: cover; object-position: center` 居中裁切
            （样式与常量在 reward-card.css 的 `.sf-reward-media` / `.sf-reward-media-img`）。
            卡体 `overflow-hidden` + `rounded-lg` ⇒ 圆角只落卡顶两角。 */}
        {reward.image && (
          <div className="sf-reward-media">
            <img
              src={reward.image}
              alt={reward.title}
              className="sf-reward-media-img"
            />
            {reward.discount && (
              <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-md text-xs font-bold">
                -{reward.discount}%
              </div>
            )}
          </div>
        )}

        <div className="sf-reward-body">
          <CardHeader className={cn('sf-reward-header', compact && 'pb-2')}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* ★ 2026-10-19 改版：原状态徽章行（稀有度图标 + statusText/limited 徽章）整行移除
                   （Kevin：移除「库存不足」等状态提示与其前置礼物图标）；标题固定两行盒高（css `.sf-reward-title`）。 */}
                <CardTitle className={cn(
                  'sf-reward-title text-gray-900 line-clamp-2',
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

          <CardContent className={cn('sf-reward-content', compact && 'pt-0')}>
            {reward.description && (
              <p className="sf-reward-desc text-gray-600 text-sm mb-4 line-clamp-3">
                {reward.description}
              </p>
            )}

            {/* ★ 2026-10-19 改版：原品牌行（`brand.name` 与标题同源、`brand.logo` 与预览图同源，信息重复）
                整块移除 —— 卖家身份改由卡底卖家栏承载（Kevin 第 4 条参考图卡面清单：图 / 标题+价格 / 描述 / 卖家栏）。 */}

            {/* 剩余时间 */}
            {reward.time_end && reward.status === 'available' && (
              <div className="flex items-center gap-1 text-sm text-orange-600 mb-3">
                <Clock className="w-4 h-4" />
                <span>{t('rewardCard.timeLimited')}</span>
              </div>
            )}

            {/* ★ 2026-10-19 改版：原行内的「N 人已领取 / 总数」块（含其前置礼物图标）整块移除
                （Kevin：移除「0 人已领取 0」提示）；行容器只余 CTA，`justify-end` 保住其原有右位。 */}
            <div className="flex items-center justify-end">
              {/* ★ `T112`（v1.20）：CTA 由 `<Button>` 降级为**非交互视觉胶囊**（整卡已是单一 `<a>` ⇒ 卡内
                  `a|button|input|select|textarea` 计数必须 = 0）；仅在**非链接回落态**（无 `to` 且无 Router）
                  才保留旧 `onClaim` 行为，链接态下不可加点击副作用。
                  ★ 2026-10-17 Kevin 指令：**首页卡片不再显示该胶囊** ⇒ `actionLabelKey` 存在时整块不渲染
                    （入口由整卡链接承载，见上方 prop 注释）；原钩子 `reward-card-view` 随胶囊一并下线
                    （`design-system.spec` §22 的该条由 Jing 另单勘误 —— 规范面不在本单范围）。
                  ★ 2026-10-19 改版：不传 `actionLabelKey` 的路径（`reward-card-claim` / `onClaim` / 三态文案）
                    **逐字不变**（仅外层容器由 `justify-between` 改 `justify-end`：左侧同行元素已删，保 CTA 原右位）。 */}
              {!actionLabelKey && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full font-semibold',
                    compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-base',
                    canClaim ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  )}
                  data-sf-m="reward-card-claim"
                  onClick={clickable ? undefined : () => onClaim?.(reward)}
                >
                  {!canClaim && userPoints < reward.points_required
                    ? t('rewardCard.insufficient')
                    : reward.status === 'claimed'
                    ? t('common.claimed')
                    : t('rewardCard.claimNow')
                  }
                </span>
              )}
            </div>
          </CardContent>
        </div>

        {/* ★ 2026-10-19 Kevin 第 4 条：卡底卖家栏 —— 恒 48px、通栏（几何常量在 reward-card.css `.sf-reward-seller`）；
            左 = 24px 圆头像（无图 ⇒ 灰底 + 掩码名首字符）+ 灰色脱敏昵称；右 = 信用胶囊标签（无图标，两端对齐；
            四档配色：excellent 浅橙底橙字 / good 蓝 / normal 灰 / new 灰）。 */}
        <div className="sf-reward-seller" data-sf-m="reward-card-seller">
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
      </Card>
    </Root>
  )
}

export { RewardCard }
