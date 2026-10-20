import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../auth-context'
import { getLanguageFromUrl } from '../../utils'
import { fetchCampaignList } from './campaign-api'
import CampaignCard from './CampaignCard'
import './campaign.css'

// ============================================================================
// `/campaign` · 活动列表（公开可浏览 · 未登录也渲染列表，只是进详情后不能提交）
// ----------------------------------------------------------------------------
// 形态（design §26.19.1）：H5 ≤767 单列卡片流（**禁 >1 列**）；Web ≥768 多列网格。
//   列数全部交给 `campaign.css` 的 auto-fill 栅格 + 唯一 767 断点块 ⇒ 页面零 JS 宽度读数。
// 数据：`GET /api/campaign/all`（仅 active 活动，行内已嵌套任务与子任务）。
//   失败 ⇒ 页内错误块 + 重试（不白屏、不清空到无提示）；空列表 ⇒ 空态文案。
// ============================================================================

const CampaignListPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)

  const [state, setState] = useState({ phase: 'loading', rows: [] })

  // user 走 ref：取数 effect 的依赖收敛到「是否换号」，语言切换不重拉（同 WagePage 体例）。
  const userRef = useRef(user)
  userRef.current = user

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, phase: prev.rows.length ? prev.phase : 'loading' }))
    try {
      const payload = await fetchCampaignList(userRef.current)
      const rows = Array.isArray(payload) ? payload : (payload?.rows || payload?.campaigns || [])
      setState({ phase: 'ready', rows: Array.isArray(rows) ? rows : [] })
    } catch (error) {
      setState({ phase: 'error', rows: [] })
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="sf-layout sf-campaign-page" data-sf-m="campaign-page">
      <div className="sf-layout-main">
        <header className="sf-campaign-head">
          <h1 className="sf-panel-title" data-sf-m="campaign-page-title">{t('campaign.listTitle')}</h1>
        </header>

        {state.phase === 'loading' ? (
          <p className="sf-foot-note" data-sf-m="campaign-loading">{t('campaign.loading')}</p>
        ) : state.phase === 'error' ? (
          <div className="sf-panel" data-sf-m="campaign-error" role="alert">
            <p>{t('campaign.loadFailed')}</p>
            <button type="button" className="sf-campaign-btn" data-sf-m="campaign-retry" onClick={load}>
              {t('campaign.retry')}
            </button>
          </div>
        ) : state.rows.length === 0 ? (
          <p className="sf-foot-note" data-sf-m="campaign-empty">{t('campaign.empty')}</p>
        ) : (
          <div className="sf-campaign-list" data-sf-m="campaign-list">
            {state.rows.map((row, index) => (
              <CampaignCard
                campaign={row}
                lang={lang}
                t={t}
                key={String(row?.campaign_id ?? row?.snowflake_id ?? `row-${index}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default CampaignListPage
