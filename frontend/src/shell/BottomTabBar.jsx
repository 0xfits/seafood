import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getLanguageFromUrl, stripLangPrefix } from '../utils'
import { useAuth } from '../auth-context'
import { isNavItemActive, navPathInLang, visibleNavItems } from './nav'
import { withPanelParams } from './messages-panel-routing'
// T103 未读角标（v1.17 §20.6）：共享态 = 外壳层（与桌面悬浮菜单**同源消费、同值**）；
// 角标样式落 shell/badge.css（**不改 shell.css**，不新增断点块）。
import { unreadBadgeText, useUnreadCount } from './unread-context'
import './badge.css'

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
//
// ★ v1.19 §21（消息面板化 · 方案 1「就地叠加」· 入口①底栏第 4 格）：
//   左键单击（`button === 0` 且无 ctrl/meta/shift/alt）⇒ `preventDefault()` + 在**当前路径**上加
//   `?msg=1`（保留当前 search 里除 `c` / `msg` 外的参数）⇒ `navigate`（**不换页**、宿主页原地左压）；
//   修饰键 / 中键 ⇒ **不拦截**，交给浏览器自然跳转（退化为 `/messages` 直链落点）。
//   `href` **一字不改**（仍是 `/messages` / `/en/messages` …）；判据 / 参数构造 = `messages-panel-routing` 单一真源。
//   ★ 本文件仍**零视口宽度判定**（只做路由串 + 查询串匹配）。
const BottomTabBar = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const lang = getLanguageFromUrl(location.pathname)
  const items = visibleNavItems(isAuthenticated)
  // T103 未读角标（第 4 格 messages）：共享态同源消费。★ 本文件**不得**引入任何视口宽度判定 ——
  //   `theme-shell-isomorphism` 硬断言禁止在外壳 JS 里出现断点类读数，且**按明文全文扫描**（注释同样命中）
  //   ⇒ 本文件只做**路由串**匹配，宽度翻转一律交给 CSS 断点块（`shell.css` 唯一 767 块）。
  const { total: unreadTotal } = useUnreadCount()
  const unreadBadge = unreadBadgeText(unreadTotal)
  // T95：仅详情路由追加 is-detail 修饰类；隐藏规则落 styles.css 顶层（具体性压过 767 断点块）
  const isDetail = isItemDetailPath(location.pathname)

  // 入口①（底栏第 4 格）= **就地叠加**：当前路径 + `?msg=1`（不换页、不改 `href`）。
  const onTabClick = (event, item) => {
    if (item.key !== 'messages') return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.defaultPrevented) return
    event.preventDefault()
    navigate(withPanelParams(location))
  }

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
            onClick={(event) => onTabClick(event, item)}
          >
            <Icon className="sf-tab-ic" size={22} aria-hidden="true" />
            <span className="sf-tab-label">{t(item.labelKey)}</span>
            {/* T103：角标是第 4 格 `<a data-sf-nav="messages">` 的**子节点**（DOM 恒在 / 零改锚；
                `0` ⇒ 不渲染。） */}
            {item.key === 'messages' && unreadBadge ? (
              <span
                className="sf-badge-count"
                data-sf-m="tabbar-unread-badge"
                aria-label={t('messagesPage.unreadA11y', { count: unreadTotal })}
              >{unreadBadge}</span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}

export default BottomTabBar
