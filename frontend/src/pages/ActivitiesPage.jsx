import React from 'react'
import { useTranslation } from 'react-i18next'
import BattCheckinPanel from '../components/BattCheckinPanel'
import './activities.css'

// ============================================================================
// /activities · 签到与活动独立页（Kevin 2026-10-14 需求③）
// ----------------------------------------------------------------------------
// 电量卡 + 签到区（BattCheckinPanel）自 /profile 迁出成页，「原样搬入」：
//   · 组件文件 / 锚点常量 BATT_CHECKIN_ANCHOR_ID / hash 滚动机制一字不动
//     （`/activities#batt-checkin` 直达仍滚动到签到卡；Header 两处直达项与招工线电量提示均已改指本页）；
//   · 路由 = LangShell 内层相对段 `activities`，ProtectedRoute 包裹（签到需登录；未登录 ⇒ 既有登录引导）。
// 页面自身零取数、零新主题 token：样式落 activities.css（页面局部 --sf-l-*，自带 767 断点）。
// 钩子：activities-page（页根）。
// ============================================================================
const ActivitiesPage = () => {
  const { t } = useTranslation()

  return (
    <div className="sf-layout sf-act-page" data-sf-m="activities-page">
      <div className="sf-layout-main">
        <h1 className="sf-panel-title">{t('activitiesPage.title')}</h1>
        <BattCheckinPanel />
      </div>
    </div>
  )
}

export default ActivitiesPage
