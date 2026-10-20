import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlusCircle, MessageCircle, Smartphone, Banknote, Headphones } from 'lucide-react'
import { getLanguageFromUrl } from '../utils'
import { navPathInLang } from './nav'
import { withPanelParams } from './messages-panel-routing'
// T103 未读角标（v1.17 §20.6）：与底栏**同源消费**（同一共享态、同值）；样式落 badge.css（不改 shell.css）。
import { unreadBadgeText, useUnreadCount } from './unread-context'
import './badge.css'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from '../components/ui/Modal'

// 右侧悬浮菜单（design-system.spec v1.5 §14 · T81–T85）
// · 仅桌面档（>767）显示：可见性**只由 shell.css 的唯一 767 断点块**承担（≤767 ⇒ .sf-fm{display:none}）；
//   本组件**不得**做任何 JS 内联断点判定（可见性完全交给 shell.css）。
// · 五项由 上→下（Kevin 2026-10-20 改版）：卖闲置→/item/new · **领工资→/wage** · 消息→/messages
//   · APP→弹窗 · 客服→弹窗。**【反馈】项已移除**（连同它的弹窗模板位一并删除，不留死钩子）。
// · 两项弹窗复用 ui/Modal；内容 = 模板位（APP 二维码占位 / 客服联系方式占位）。
// · 弹窗**默认不渲染**（按需挂载）⇒ 日/夜 DOM 形状同值。
// · 测量钩子一律用 data-sf-m；**不得** data-sf-region（后者被外壳区域顺序断言占用）。
// · 弹窗内按钮**刻意不挂既有按钮家族基类**（避免纳入 p6-btn-impl2 的按钮家族清单 ⇒ 触碰该单未获 §14.5 授权的断言）；
//   输入框复用既有 .sf-box（无家族清单断言）。
const FM_ITEMS = [
  { key: 'sell', kind: 'link', path: 'item/new', labelKey: 'sell', icon: PlusCircle },
  // ★ 本单新增（第二位）：领工资 ⇒ `/wage` 页；文案键落新命名空间 `wage.menuLabel`（四语齐备）。
  { key: 'wage', kind: 'link', path: 'wage', labelKey: 'wage.menuLabel', icon: Banknote },
  { key: 'messages', kind: 'link', path: 'messages', labelKey: 'messages', icon: MessageCircle },
  { key: 'app', kind: 'modal', labelKey: 'app', icon: Smartphone },
  { key: 'support', kind: 'modal', labelKey: 'support', icon: Headphones },
]

const FloatingMenu = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const lang = getLanguageFromUrl(location.pathname)
  const [openModal, setOpenModal] = useState(null)
  const closeModal = () => setOpenModal(null)
  // T103：桌面悬浮菜单「消息」项角标（与底栏第 4 格同源同值；`0` ⇒ 不渲染）。
  const { total: unreadTotal } = useUnreadCount()
  const unreadBadge = unreadBadgeText(unreadTotal)

  // ★ v1.19 §21（入口②悬浮菜单「消息」）= **就地叠加**：左键单击（`button === 0` 且无 ctrl/meta/shift/alt）
  //   ⇒ `preventDefault()` + 当前路径加 `?msg=1`（不换页）；修饰键 / 中键 ⇒ 不拦截（退化为直链落点）。
  //   `href` **一字不改**；★ 零视口宽度判定（路由串 + 查询串匹配）。
  const onMenuItemClick = (event, item) => {
    if (item.key !== 'messages') return
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.defaultPrevented) return
    event.preventDefault()
    navigate(withPanelParams(location))
  }

  return (
    <>
      <nav className="sf-fm" data-sf-m="floatmenu" aria-label={t('siteBrand')}>
        {FM_ITEMS.map((item, index) => {
          const Icon = item.icon
          const body = (
            <>
              <Icon className="sf-fm-ic" aria-hidden="true" />
              <span className="sf-fm-label">{t(item.labelKey)}</span>
              {/* T103：桌面悬浮菜单「消息」项角标子节点（底栏同源同值；`0` ⇒ 不渲染）。 */}
              {item.key === 'messages' && unreadBadge ? (
                <span
                  className="sf-badge-count"
                  data-sf-m="floatmenu-unread-badge"
                  aria-label={t('messagesPage.unreadA11y', { count: unreadTotal })}
                >{unreadBadge}</span>
              ) : null}
            </>
          )
          return (
            <React.Fragment key={item.key}>
              {index > 0 && <span className="sf-fm-div" aria-hidden="true" />}
              {item.kind === 'link' ? (
                <Link
                  className="sf-fm-item"
                  data-sf-m="floatmenu-item"
                  data-sf-fm={item.key}
                  to={navPathInLang({ path: item.path }, lang)}
                  onClick={(event) => onMenuItemClick(event, item)}
                >
                  {body}
                </Link>
              ) : (
                <button
                  type="button"
                  className="sf-fm-item"
                  data-sf-m="floatmenu-item"
                  data-sf-fm={item.key}
                  onClick={() => setOpenModal(item.key)}
                >
                  {body}
                </button>
              )}
            </React.Fragment>
          )
        })}
      </nav>

      {/* APP 弹窗（模板位：二维码图位 + 下载引导占位） */}
      <Modal isOpen={openModal === 'app'} onClose={closeModal}>
        <ModalHeader><ModalTitle>{t('appModal.title')}</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="sf-fm-qrbox" data-sf-m="floatmenu-qr-placeholder" aria-hidden="true" />
          <p>{t('appModal.downloadHint')}</p>
          <p className="sf-foot-note">{t('appModal.qrPlaceholder')}</p>
        </ModalContent>
        <ModalFooter>
          <button type="button" data-sf-m="floatmenu-modal-close" onClick={closeModal}>{t('appModal.close')}</button>
        </ModalFooter>
      </Modal>

      {/* 客服弹窗（模板位：联系方式占位） */}
      <Modal isOpen={openModal === 'support'} onClose={closeModal}>
        <ModalHeader><ModalTitle>{t('supportModal.title')}</ModalTitle></ModalHeader>
        <ModalContent>
          <p data-sf-m="floatmenu-support-contact">{t('supportModal.contactPlaceholder')}</p>
        </ModalContent>
        <ModalFooter>
          <button type="button" data-sf-m="floatmenu-modal-close" onClick={closeModal}>{t('supportModal.close')}</button>
        </ModalFooter>
      </Modal>
    </>
  )
}

export default FloatingMenu
