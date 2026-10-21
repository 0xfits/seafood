import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'

import { Card, CardContent } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn } from '../components/ui/Motion'
import { ResponsiveContainer } from '../components/ui/Responsive'
import HomeCampaignCard from '../components/campaign/HomeCampaignCard'
import { fetchHomeCampaignTasks, fetchHomeCurrencies } from '../home-api'
import { normalizeHomeCampaignRow } from '../home-campaign'
import { useAuth } from '../auth-context'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'

// ============================================================================
// `/task` · **campaign 任务列表**（Kevin 2026-10-21 裁定：job / 悬赏体系弃用）
// ----------------------------------------------------------------------------
// 口径：
//   · 数据面 = `GET /api/home/campaign-tasks`（公开 · 30s 公共缓存，与首页「热门任务」同一读口）：
//       row = { task_id, title, description, status, joined_count, reward_amount_primary,
//               reward_cid_secondary?, reward_amount_secondary?, campaign_id, campaign_title,
//               project_title, project_slug, project_avatar_url? }
//     **旧 job 数据面 `/api/task/all`、`/api/task-progress` 全部退出本页**（不再是本页读口）；
//   · 卡 = 复用首页卡 `HomeCampaignCard`（圆头像 + 项目名 + 活动名 + 标题 + 状态 + 参与 + 奖励），
//     整卡 → `/task/<taskId>`（卡内唯一构造器 `buildLocalizedPath`，随页语言前缀）；
//   · 页头标题沿用既有键 `taskPage.title`（= 悬赏中心，Kevin 明示保留）；空态复用
//     `taskPage.emptyAvailable` / `taskPage.emptyAvailableHint` ⇒ **本页零新增 i18n 键**；
//   · 发布口 `/task/new` 已下线（后端 `POST /api/job` 随 job 体系删除）⇒ 本页**不再有发布入口**；
//     审核口 `/task/review` 保留（唯一入口 = 页头条按钮）；
//   · 类名只吃既有 `sf-home-camp-grid` / `sf-home-camp-card`（卡组件自带）+ `sf-jobs*`（页头条），
//     不新造样式层、不改几何。
// ============================================================================

/** 读口行 ⇒ 卡片视图模型（`normalizeHomeCampaignRow` 单一归一器 + 渲染旗标） */
const cardOfRow = (row) => ({
  ...normalizeHomeCampaignRow(row),
  joinedTarget: row?.joined_target ?? null,
  isMain: false,
})

const TaskPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated, user } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)

  const [cards, setCards] = useState([])
  // 公开币种表 { cid → symbol }（只用于次币符号；失败 ⇒ 空表 ⇒ 次币行不渲染）
  const [symbols, setSymbols] = useState({})
  const [phase, setPhase] = useState('loading')
  const [errorText, setErrorText] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setPhase('loading')
      setErrorText('')
      // 两读口并行、独立降级：任务读口失败 ⇒ 空态 + 错误行；币种表失败 ⇒ 次币行不渲染（不影响列表）。
      const [taskResult, symbolsResult] = await Promise.all([
        fetchHomeCampaignTasks(user).then(
          (rows) => ({ ok: true, rows: Array.isArray(rows) ? rows : [] }),
          (error) => ({ ok: false, error }),
        ),
        fetchHomeCurrencies(user).then(
          (currencies) => {
            const map = {}
            for (const currency of (Array.isArray(currencies) ? currencies : [])) {
              if (currency?.cid != null && currency?.symbol) map[String(currency.cid)] = String(currency.symbol)
            }
            return map
          },
          () => ({}),
        ),
      ])
      if (cancelled) return
      setSymbols(symbolsResult)
      if (!taskResult.ok) {
        console.warn('Task list campaign endpoint failed:', taskResult.error)
        setCards([])
        setErrorText(taskResult.error?.message || '')
        setPhase('error')
        return
      }
      setCards(taskResult.rows.map(cardOfRow))
      setPhase('ready')
    }

    load()
    return () => { cancelled = true }
  }, [isAuthenticated, location.pathname, user?.uID, user?.token, user?.access_token, user])

  if (phase === 'loading') {
    return (
      <ResponsiveContainer>
        <LoadingPage message={t('common.loadingTasks')} />
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer>
      <div className="space-y-8" data-sf-m="task-list">
        <FadeIn>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4" data-sf-m="task-list-title">
              {t('taskPage.title')}
            </h1>
            {/* 页头条（沿用 jobs.css 的 `sf-jobs` token 层）：发布口已随 job 体系下线，只留审核口。 */}
            <div className="sf-jobs" data-sf-m="jobs-nav">
              <div className="sf-jobs-actions">
                <Link
                  className="sf-btn sf-jobs-btn"
                  to={buildLocalizedPath(lang, '/task/review')}
                  data-sf-m="jobs-nav-review"
                >
                  {t('jobs.review')}
                </Link>
              </div>
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={120}>
          {cards.length > 0 ? (
            <div className="sf-home-camp-grid" data-sf-m="task-list-grid">
              {cards.map((card) => (
                <HomeCampaignCard
                  key={`task-${card.taskId}`}
                  card={card}
                  lang={lang}
                  t={t}
                  symbols={symbols}
                />
              ))}
            </div>
          ) : (
            <Card variant="inactive">
              <CardContent className="text-center py-12" data-sf-m="task-list-empty">
                <div className="text-gray-500 mb-4">
                  <div className="text-6xl mb-4">📋</div>
                  <p className="text-lg">{t('taskPage.emptyAvailable')}</p>
                  <p className="text-sm mt-2">{t('taskPage.emptyAvailableHint')}</p>
                </div>
                {errorText ? (
                  <p className="text-sm text-red-600" role="alert" data-sf-m="task-list-error">
                    {`${t('error')}: ${errorText}`}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          )}
        </FadeIn>
      </div>
    </ResponsiveContainer>
  )
}

export default TaskPage
