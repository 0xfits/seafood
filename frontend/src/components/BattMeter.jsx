// ============================================================================
// BattMeter · 电量点阵条（R-9-82 / Kong）
// 纯展示组件：无业务取数、无副作用 ⇒ 可复用（「既能取数也能复用」中的展示半边）。
//
// 口径（R-9-82，逐字）：
//   · 10 点横排，每点 = 10%；`full = floor(batt/10)`；`rem = batt % 10`。
//   · `rem >= 5` ⇒ 第 `full+1` 点绘「半电点」；`rem < 5` ⇒ 第 `full+1` 点绘空点。
//   · `full` 个实点自**左**起算（例：65 ⇒ 6 满 + 1 半 + 3 空）。
//   · 「低电量」= 状态修饰、非第 4 种几何：读口 `canAccept === false` ⇒ 全部**已点亮**
//     点（实点 + 半电点）叠加「轻微呼吸光」；`canAccept !== false` ⇒ 无光。
//   · `batt` 无值 / 无账户 ⇒ 10 点全空 + 数字显示 `0`（绝不崩、不显 `NaN`/`undefined`）。
//   · 保留右侧大号数字 + 「电量」标签（单位 = `t('battCard.unit')`）。
//   · 整条 `role="img"` + `aria-label`（`battCard.title` + 数值 + `battCard.unit`）。
//
// 颜色优先取主题 token（`--sf-*`；日档 A / 夜档 B 同名、随 `<html data-theme>` 切值）：
//   实点/半点黄底   = --sf-btna-bg      （A #FFE60F / B #FFE60F，主按钮黄）
//   闪电（黑）      = --sf-btna-fg      （A #202020 / B #202020，黄底深字）
//   点描边（实/半点）= --sf-jobtag-fg    （A #030402 / B #0B0C0E，深色描边）
//   空点底 / 半点空白半 = --sf-card-bg   （A #fff    / B #141619，卡面底色）
//   空点描边        = --sf-tab-fg       （A #6B6B5A / B #6E747C，静置灰）
//   空点淡闪电      = --sf-glyph-fg     （A rgba(3,4,2,.30) / B rgba(253,232,21,.20)，淡前景）
// 无恰好等值的「浅灰描边 token」（图上 ≈#B0B0B0）⇒ 取**最近既有静置灰** `--sf-tab-fg`，
//   不新造 token（主题层为单一真源生成物，新增须带 style-preview 行级证据，本单无真源行）。
// 呼吸光动画见 `styles/animations.css`（仅追加，含 prefers-reduced-motion 降级）。
// 六类工程口径泄漏 = 0：本组件只消费 `t(...)` 的四语文案值。
// ============================================================================
import React from 'react'
import { useTranslation } from 'react-i18next'

const DOT_COUNT = 10

/** 黑色闪电图标（`color` = CSS 颜色串；`aria-hidden`：语义由整条 `role="img"` 承担）。 */
const Bolt = ({ color }) => (
  <svg
    viewBox="0 0 24 24"
    width="10"
    height="10"
    aria-hidden="true"
    focusable="false"
    style={{ display: 'block' }}
  >
    <path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13z" fill={color} />
  </svg>
)

/** 单点态：`full`（满电）/ `half`（半电）/ `empty`（空电）。 */
const dotKind = (index, full, rem) => {
  if (index <= full) return 'full'
  if (index === full + 1 && rem >= 5) return 'half'
  return 'empty'
}

const BASE_DOT_STYLE = {
  width: 16,
  height: 16,
  borderRadius: '999px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxSizing: 'border-box',
  flex: '0 0 auto',
}

const DOT_STYLE = {
  full: {
    background: 'var(--sf-btna-bg)',
    border: '1px solid var(--sf-jobtag-fg)',
  },
  half: {
    background: 'linear-gradient(90deg, var(--sf-btna-bg) 0 50%, var(--sf-card-bg) 50% 100%)',
    border: '1px solid var(--sf-jobtag-fg)',
  },
  empty: {
    background: 'var(--sf-card-bg)',
    border: '1px solid var(--sf-tab-fg)',
  },
}

const BOLT_COLOR = {
  full: 'var(--sf-btna-fg)',
  half: 'var(--sf-btna-fg)',
  empty: 'var(--sf-glyph-fg)',
}

const BattMeter = ({ batt = null, canAccept = null, className = '' }) => {
  const { t } = useTranslation()

  // 值域收敛：非有限数（含 null / undefined / NaN）⇒ 视为「无值」；其余截断并夹到 [0,100]。
  const safe = Number.isFinite(batt) ? Math.max(0, Math.min(100, Math.trunc(batt))) : null
  const value = safe ?? 0
  const full = safe == null ? 0 : Math.floor(safe / 10)
  const rem = safe == null ? 0 : safe % 10
  const low = canAccept === false

  const ariaLabel = `${t('battCard.title')} ${value}${t('battCard.unit')}`

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      data-sf-m="batt-meter"
      data-batt-value={value}
      data-batt-low={low ? '1' : '0'}
      className={`flex items-center gap-3 ${className}`}
    >
      <div className="flex items-center gap-1" data-sf-m="batt-dots">
        {Array.from({ length: DOT_COUNT }, (_, i) => {
          const index = i + 1
          const kind = dotKind(index, full, rem)
          const glow = low && (kind === 'full' || kind === 'half')
          return (
            <span
              key={index}
              data-sf-m="batt-dot"
              data-dot={kind}
              data-idx={index}
              data-glow={glow ? '1' : '0'}
              className={glow ? 'sf-batt-dot--glow' : undefined}
              style={{ ...BASE_DOT_STYLE, ...DOT_STYLE[kind] }}
            >
              <Bolt color={BOLT_COLOR[kind]} />
            </span>
          )
        })}
      </div>
      <div className="flex flex-col items-center leading-none" data-sf-m="batt-readout">
        <span className="text-3xl font-bold" data-sf-m="batt-value">
          {value}
          <span className="text-base font-normal">{t('battCard.unit')}</span>
        </span>
        <span className="text-sm text-gray-500" data-sf-m="batt-label">{t('battCard.title')}</span>
      </div>
    </div>
  )
}

export default BattMeter
