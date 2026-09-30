import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getLanguageFromUrl } from '../utils'
import { useAuth } from '../auth-context'
import { isNavItemActive, navPathInLang, visibleNavItems } from './nav'

// 手机竖屏底部 tab 骨架（web 横屏由断点 CSS 隐藏，但**始终在 DOM 中**）。
// 结构与比选页手机壳底栏同形：grid repeat(5,1fr) 的竖直 icon+label 单元
// （docs/design/style-preview.html:169-174）。与顶栏复用同一份 SHELL_NAV_ITEMS 与同一可见性规则。
const BottomTabBar = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const { isAuthenticated } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const items = visibleNavItems(isAuthenticated)

  return (
    <nav className="sf-tabbar" data-sf-region="tabbar" aria-label={t('siteBrand')}>
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
