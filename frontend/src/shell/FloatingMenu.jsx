import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PlusCircle, MessageCircle, Smartphone, Gauge, Headphones } from 'lucide-react'
import { getLanguageFromUrl } from '../utils'
import { navPathInLang } from './nav'
import { Modal, ModalHeader, ModalTitle, ModalContent, ModalFooter } from '../components/ui/Modal'

// 右侧悬浮菜单（design-system.spec v1.5 §14 · T81–T85）
// · 仅桌面档（>767）显示：可见性**只由 shell.css 的唯一 767 断点块**承担（≤767 ⇒ .sf-fm{display:none}）；
//   本组件**不得**做任何 JS 内联断点判定（可见性完全交给 shell.css）。
// · 五项由 上→下：卖闲置→/listing/new · 消息→/messages · APP→弹窗 · 反馈→弹窗 · 客服→弹窗。
// · 三项弹窗复用 ui/Modal；内容 = 模板位（APP 二维码占位 / 反馈表单占位·不落库 / 客服联系方式占位）。
// · 弹窗**默认不渲染**（按需挂载）⇒ 日/夜 DOM 形状同值。
// · 测量钩子一律用 data-sf-m；**不得** data-sf-region（后者被外壳区域顺序断言占用）。
// · 弹窗内按钮**刻意不挂既有按钮家族基类**（避免纳入 p6-btn-impl2 的按钮家族清单 ⇒ 触碰该单未获 §14.5 授权的断言）；
//   输入框复用既有 .sf-box（无家族清单断言）。
const FM_ITEMS = [
  { key: 'sell', kind: 'link', path: 'listing/new', labelKey: 'sell', icon: PlusCircle },
  { key: 'messages', kind: 'link', path: 'messages', labelKey: 'messages', icon: MessageCircle },
  { key: 'app', kind: 'modal', labelKey: 'app', icon: Smartphone },
  { key: 'feedback', kind: 'modal', labelKey: 'feedback', icon: Gauge },
  { key: 'support', kind: 'modal', labelKey: 'support', icon: Headphones },
]

const FloatingMenu = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const lang = getLanguageFromUrl(location.pathname)
  const [openModal, setOpenModal] = useState(null)
  const closeModal = () => setOpenModal(null)

  return (
    <>
      <nav className="sf-fm" data-sf-m="floatmenu" aria-label={t('siteBrand')}>
        {FM_ITEMS.map((item, index) => {
          const Icon = item.icon
          const body = (
            <>
              <Icon className="sf-fm-ic" aria-hidden="true" />
              <span className="sf-fm-label">{t(item.labelKey)}</span>
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

      {/* 反馈弹窗（模板位：表单占位；**不落库**、不发起任何提交请求） */}
      <Modal isOpen={openModal === 'feedback'} onClose={closeModal}>
        <ModalHeader><ModalTitle>{t('feedbackModal.title')}</ModalTitle></ModalHeader>
        <ModalContent>
          <div className="sf-fm-form" data-sf-m="floatmenu-feedback-form">
            <input className="sf-box" data-sf-m="floatmenu-feedback-input" placeholder={t('feedbackModal.formPlaceholder')} readOnly />
            <button type="button" data-sf-m="floatmenu-feedback-submit" disabled>{t('confirm')}</button>
          </div>
          <p className="sf-foot-note">{t('feedbackModal.submitNote')}</p>
        </ModalContent>
        <ModalFooter>
          <button type="button" data-sf-m="floatmenu-modal-close" onClick={closeModal}>{t('feedbackModal.close')}</button>
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
