import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getLanguageFromUrl, stripLangPrefix } from '../utils'
import { useAuth } from '../auth-context'
import { isNavItemActive, navPathInLang, visibleNavItems } from './nav'

// T95（design-system.spec v1.15 §19）· 详情页隐藏底栏 —— **DOM 恒在 + 页面级 display:none**。
// 判定只用**路由串匹配**（剥语言前缀后）：`rest === '/item'`（同路由 ?id= 兼容档）
//   或 `/item/<段>` 形态命中 **且** 静态段 `/item/new`（发布页）不隐藏。
// ★ 严禁在此引入任何宽度判定（外壳 JS 无内联断点硬断言 —— theme-shell-isomorphism
//   「断点只能落在 CSS 里」；本文件只做**路由串**匹配）。
// 语言前缀剥离复用单一真源 utils.stripLangPrefix（shell/nav.js 同用）。
const isItemDetailPath = (pathname) => {
  const rest = stripLangPrefix(pathname || '/')
  if (rest === '/item/new') return false
  return rest === '/item' || /^\/item\/[^/]+\/?$/.test(rest)
}

// 手机竖屏底部 tab 骨架（web 横屏由断点 CSS 隐藏，但**始终在 DOM 中**）。
// 结构与比选页手机壳底栏同形：grid repeat(5,1fr) 的竖直 icon+label 单元
// （docs/design/style-preview.html:169-174）。与顶栏复用同一份 SHELL_NAV_ITEMS 与同一可见性规则。
const BottomTabBar = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const items = visibleNavItems(isAuthenticated)
  // T95：仅详情路由追加 is-detail 修饰类；隐藏规则落 styles.css 顶层（具体性压过 767 断点块）
  const isDetail = isItemDetailPath(location.pathname)

  return (
    <nav className={`sf-tabbar${isDetail ? ' is-detail' : ''}`} data-sf-region="tabbar" aria-label={t('siteBrand')}>
      {items.map((item) => {
        const active = isNavItemActive(location.pathname, item)
        const Icon = item.icon
        return (
          <Link
            key={item.key}
            to={navPathInLang(item, lang)}
            className={`sf-tab${active ? ' is-active' : ''}`}
            data-sf-nav={item.key}
            aria-current={active ? 'page' : undefined}
          >
            <Icon className="sf-tab-ic" size={22} aria-hidden="true" />
            <span className="sf-tab-label">{t(item.labelKey)}</span>
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomTabBar
