// ============================================================================
// 电量卡 + 签到区（P9② / Kong）
// 依据：docs/route-layer.spec.md v2.14 §28.7（后台复用 `adminSettings`；**用户面 = 电量卡 + 签到区**，
//   「既有渲染点接覆盖值 / 新取数 · 不新增独立页面」）。
//   · 文案命名空间 = `battCard`（名称 / 单位 % / 区间提示 / 不足不可承接提示）
//     + `checkinPanel`（签到按钮 / 连续天数 / 断签提示 / 补签按钮 / 补签费用提示）。
//   · 派生布尔（`canAccept` / `checkedInToday` / `canMakeup`）**不落库** ⇒ 每次由读口即时取（§28.7(d)）。
//   · 六类工程口径泄漏 = 0：本组件只消费 `t(...)` 的四语文案值，**不拼**章节号 / 码 / 路径 / 表名。
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from './ui'
import { FadeIn } from './ui/Motion'
import { useAuth } from '../auth-context'
import { fetchBatt, fetchCheckinStatus, postCheckin, postMakeup, utcDay } from '../batt-checkin'

const BattCheckinPanel = () => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [batt, setBatt] = useState(null)
  const [checkin, setCheckin] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setBatt(null)
      setCheckin(null)
      return
    }
    try {
      const [b, c] = await Promise.all([fetchBatt({ user }), fetchCheckinStatus({ user })])
      setBatt(b)
      setCheckin(c)
    } catch {
      // 读口失败 = 静默（不阻塞个人页其余面）；动作口失败才回吐错误（见下）。
      setBatt(null)
      setCheckin(null)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    load()
  }, [load])

  const runAction = async (action) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      await load()
    } catch (error) {
      toast.error(String(error?.message || '').trim() || t('error'))
    } finally {
      setBusy(false)
    }
  }

  if (!isAuthenticated) return null

  const battValue = batt ? `${batt.batt}${t('battCard.unit')}` : '—'

  return (
    <FadeIn>
      <Card variant="secondary">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">{t('battCard.title')}</CardTitle>
            {batt && !batt.canAccept && <Badge variant="warning">{t('battCard.insufficient')}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-bold">{battValue}</span>
            <span className="text-sm text-gray-500">{t('battCard.rangeHint')}</span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-gray-700">
              {t('checkinPanel.streakDays')}: {checkin ? checkin.streakDay : 0}
            </span>
            {checkin && !checkin.checkedInToday && (
              <Button onClick={() => runAction(() => postCheckin({ user }))} disabled={busy}>
                {t('checkinPanel.checkinButton')}
              </Button>
            )}
            {checkin && checkin.checkedInToday && <Badge variant="success">{t('checkinPanel.checkinButton')}</Badge>}
          </div>

          {checkin && !checkin.checkedInToday && checkin.canMakeup && (
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="outline"
                onClick={() => runAction(() => postMakeup({ user, targetDay: utcDay(-1) }))}
                disabled={busy}
              >
                {t('checkinPanel.makeupButton')}
              </Button>
              <span className="text-sm text-gray-500">{t('checkinPanel.makeupCost')}</span>
            </div>
          )}

          {checkin && !checkin.checkedInToday && !checkin.canMakeup && (
            <p className="text-sm text-gray-500">{t('checkinPanel.brokenHint')}</p>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

export default BattCheckinPanel
