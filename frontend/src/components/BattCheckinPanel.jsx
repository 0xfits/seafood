// ============================================================================
// 电量卡（P9② / Kong；Kevin 2026-10-20 需求②③收口）
// 依据：docs/route-layer.spec.md v2.14 §28.7（后台复用 `adminSettings`；用户面 = 电量卡，
//   「既有渲染点接覆盖值 / 新取数 · 不新增独立页面」）。
//   · 文案命名空间 = `battCard`（名称 / 单位 % / 区间提示 / 不足不可承接提示）。
//   · 派生布尔（`canAccept`）**不落库** ⇒ 每次由读口即时取（§28.7(d)）。
//   · 六类工程口径泄漏 = 0：本组件只消费 `t(...)` 的四语文案值，**不拼**章节号 / 码 / 路径 / 表名。
// ----------------------------------------------------------------------------
// ★ 两次迁出（同一卡片本体的边界，逐条留痕）：
//   ① 2026-10-20 需求②：BTTC 资产块（余额 / 铸造 / 分解 / 缺额）→ `components/BttcAssetPanel.jsx`，
//      渲染点 = `/profile/assets`（我的资产）；本组件不再留半套。
//   ② 2026-10-20 需求③：签到 UI（连续签到天数 / 【签到】/ 补签 / 断签提示）**整体下线** ⇒
//      本组件只剩电量点阵（工资累积展示仍依赖它）；组件名 / 钩子 / 锚点 `batt-checkin` 保持不变
//      （`/wage#batt-checkin` 深链与 JobDetail「电量不足」提示仍直达本卡）。
//      签到后端口（`GET/POST /api/checkin`）**保留不动**（本次只撤前端 UI）。
// ============================================================================
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent, Badge } from './ui'
import { FadeIn } from './ui/Motion'
import BattMeter from './BattMeter'
import { useAuth } from '../auth-context'
import { fetchBatt } from '../batt-checkin'

// 电量卡锚点（R-9-83）：供招工线「电量不足」提示以 `/wage#batt-checkin` 直达。
export const BATT_CHECKIN_ANCHOR_ID = 'batt-checkin'

const BattCheckinPanel = ({ children }) => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const location = useLocation()
  const [batt, setBatt] = useState(null)
  const cardRef = useRef(null)

  // 带 hash 进入（`#batt-checkin`）⇒ 滚动到本区（react-router 不自动处理 hash 锚点）。
  useEffect(() => {
    if (location.hash !== `#${BATT_CHECKIN_ANCHOR_ID}`) return
    const el = cardRef.current
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'start' })
  }, [location.hash])

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setBatt(null)
      return
    }
    try {
      setBatt(await fetchBatt({ user }))
    } catch {
      // 读口失败 = 静默（不阻塞本页其余面）。
      setBatt(null)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    load()
  }, [load])

  if (!isAuthenticated) return null

  return (
    <FadeIn>
      <Card ref={cardRef} id={BATT_CHECKIN_ANCHOR_ID} variant="secondary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{t('battCard.title')}</CardTitle>
            {batt && !batt.canAccept && <Badge variant="warning">{t('battCard.insufficient')}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* 电量点阵条（10 点 × 10%）：无值/无账户 ⇒ 全空 + 数字 0（R-9-82 ④）。 */}
            <BattMeter batt={batt?.batt ?? null} canAccept={batt?.canAccept ?? null} />
            <span className="text-sm text-gray-500">{t('battCard.rangeHint')}</span>
          </div>
          {/* ★ Kevin 2026-10-24：卡内追加动作区（当前唯一消费方 = `/wage` 的【铸造】入口）。
              children 以**函数**形式调用 ⇒ 复用本卡已取的同一份 `GET /api/batt` 读数（`batt` / `bttc` / policy），
              零新增 GET；`reload` 供子级动作成功后重拉（电量点阵与缺口同源刷新）。
              不传 children ⇒ 卡面逐字不变（其他渲染点零影响）。 */}
          {typeof children === 'function' ? children({ batt, reload: load }) : children}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

export default BattCheckinPanel
