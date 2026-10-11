import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { buildLocalizedPath, getLanguageFromUrl } from '../utils'

// ============================================================================
// catch-all 提示页（★ design-system.spec v1.12 §16.1 · T91 · Kevin 2026-10-11 裁定③）
// · 挂载点 = `frontend/src/App.jsx` **LangShell 内层 `<Routes>` 的末位** `<Route path="*" />`
//   —— 末位让既有 index / 精确段 / 动态段按 react-router v6 排名优先命中。
// · 口径 = 旧路径（`/reward`、`/listing`、`/listing/new`、`/listing/:listingId` 及四语前缀档）
//   不匹配任何内层精确 / 动态段 ⇒ 命中本页 ⇒ 渲染「提示页」，**不再是空白 main**。
// · **非重定向 · 仍不是 301**（Kevin 裁定③ 未变）：本组件**不含** `<Navigate>`、不发 301/302；
//   HTTP 语义仍是对同一 URL 呈现提示页（`200`）。
// · **不得动外层 LangShell 的兜底壳机制**（语言前缀壳与无前缀兜底壳 = 挂载点，非本页；App.jsx 外层一字不动）。
// · 文案键 = locale `notFound.title` / `notFound.description` / `notFound.backHome`（四语同集；
//   非 zh 译文登记「待复核」，见 `docs/audit/item-rename.md`）。
// · 骨架沿用仓内既有页面类（`.sf-layout` / `.sf-layout-main` / `.sf-panel-title` / `.sf-btn`，均在
//   `src/shell/shell.css`），**不另造风格、不新增依赖**。
// ============================================================================
const NotFoundPage = () => {
  const { t } = useTranslation()
  const location = useLocation()
  // 返回首页入口：唯一构造器 `buildLocalizedPath` ⇒ 带当前语言前缀（zh 无前缀 ⇒ `/`）。
  const homePath = buildLocalizedPath(getLanguageFromUrl(location.pathname), '/')

  return (
    <div className="sf-layout" data-sf-m="not-found-page">
      <div className="sf-layout-main">
        <h1 className="sf-panel-title" data-sf-m="not-found-title">{t('notFound.title')}</h1>
        <p data-sf-m="not-found-desc">{t('notFound.description')}</p>
        <p>
          <Link className="sf-btn" to={homePath} data-sf-m="not-found-home">{t('notFound.backHome')}</Link>
        </p>
      </div>
    </div>
  )
}

export default NotFoundPage
