// ============================================================================
// 评分区 + 时效区（P9③ / Kong）
// 依据：docs/route-layer.spec.md v2.16 §29.7（后台复用 `adminSettings`；用户面 = 「评分区」+「时效区」，
//   「既有渲染点接新取数 · 不新增独立页面」）+ §29.12(f)。
//   · 文案命名空间 = `ratingPanel`（四角色星级 / 周期选择 / 「暂无数据」）
//     + `timelinessPanel`（四时长 / 四比率 / 「暂无数据」）。
//   · 派生布尔 **不落库** ⇒ 每次由读口即时取（§29.7(d)）。
//   · 六类工程口径泄漏 = 0：本组件只消费 `t(...)` 的四语文案值，**不拼**章节号 / 码 / 路径 / 表名。
//   · 无数据（时长分母 = 0）⇒ 展示 `t('timelinessPanel.noData')`（**不填 0** · `§32.2(c)`）。
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardHeader, CardTitle, CardContent } from './ui'
import { FadeIn } from './ui/Motion'
import { useAuth } from '../auth-context'
import { fetchRatingSummary, fetchTimeliness } from '../rating-timeliness'

const PERIODS = [30, 90, 360, 1000]
const ROLES = ['poster', 'worker', 'vendor', 'customer']
const DURATIONS = ['posterAvgDays', 'workerAvgDays', 'vendorAvgShipDays', 'customerAvgReceiveDays']
const RATES = ['workerPassRate', 'customerDealRate', 'jobPassRate', 'listingDealRate']

const RatingTimelinessPanel = () => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [period, setPeriod] = useState(90)
  const [rating, setRating] = useState(null)
  const [timeliness, setTimeliness] = useState(null)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setRating(null)
      setTimeliness(null)
      return
    }
    try {
      const [r, tm] = await Promise.all([
        fetchRatingSummary({ user, period }),
        fetchTimeliness({ user }),
      ])
      setRating(r)
      setTimeliness(tm)
    } catch {
      // 读口失败 = 静默（不阻塞个人页其余面）。
      setRating(null)
      setTimeliness(null)
    }
  }, [isAuthenticated, user, period])

  useEffect(() => { load() }, [load])

  if (!isAuthenticated) return null

  const starText = (value) => (value === null || value === undefined
    ? t('ratingPanel.noData')
    : `${Number(value).toFixed(1)}${t('ratingPanel.starsUnit')}`)

  const dayText = (value) => (value === null || value === undefined
    ? t('timelinessPanel.noData')
    : `${Math.round(Number(value))}${t('timelinessPanel.daysUnit')}`)

  const rateText = (value) => (value === null || value === undefined
    ? t('timelinessPanel.noData')
    : `${Math.round(Number(value) * 100)}%`)

  const stars = rating?.stars || {}

  return (
    <FadeIn>
      <Card variant="secondary">
        <CardHeader>
          <CardTitle className="text-2xl">{t('ratingPanel.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2" data-sf-m="rating-period">
            <span className="text-sm text-gray-500">{t('ratingPanel.periodLabel')}</span>
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                className="sf-btn"
                data-sf-m="rating-period-btn"
                data-sf-period={p}
                aria-pressed={period === p}
                onClick={() => setPeriod(p)}
              >
                {t(`ratingPanel.period${p}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3" data-sf-m="rating-stars">
            {ROLES.map((role) => (
              <div className="flex items-center justify-between" key={role} data-sf-role={role}>
                <span className="text-sm text-gray-700">{t(`ratingPanel.role${role[0].toUpperCase()}${role.slice(1)}`)}</span>
                <span className="text-lg font-semibold">{starText(stars[role])}</span>
              </div>
            ))}
          </div>

          <div className="border-t pt-4">
            <div className="text-2xl font-semibold mb-3">{t('timelinessPanel.title')}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2" data-sf-m="timeliness-durations">
              {DURATIONS.map((k) => (
                <div className="flex items-center justify-between" key={k}>
                  <span className="text-sm text-gray-700">{t(`timelinessPanel.${k}`)}</span>
                  <span className="text-sm font-semibold">{dayText(timeliness?.[k])}</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-3" data-sf-m="timeliness-rates">
              {RATES.map((k) => (
                <div className="flex items-center justify-between" key={k}>
                  <span className="text-sm text-gray-700">{t(`timelinessPanel.${k}`)}</span>
                  <span className="text-sm font-semibold">{rateText(timeliness?.[k])}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </FadeIn>
  )
}

export default RatingTimelinessPanel
