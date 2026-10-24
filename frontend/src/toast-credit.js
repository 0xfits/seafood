/**
 * 余额增加类 Toast 的**单一出口**（Kevin 2026-10-24 裁定 · design `T126` 双轨 / §40 `T139`）
 * ----------------------------------------------------------------------------
 * 两类 toast，逐条分开、互不借道：
 *   · **普通提示类 + 余额减少类** ⇒ 直接 `toast.success(...)`（右上角、默认字号；`main.jsx` 的
 *     `<Toaster position="top-right" />` 就是它们的家，**一字不改**）；
 *   · **余额增加类**（领工资 / 领奖·单笔 / 领奖·一键全领 / 铸造 / 退款到账 / 收货入账）
 *     ⇒ 只许走本文件的 `toastCredit`：**页面正中**（视觉重心，非贴顶）、字号 18px、5s。
 *
 * 为什么单开一条出口而不是散着写 options：
 *   · 同一条视觉规则只有一处真源（改字号/时长/位置时只改这里，5 处自动同版）；
 *   · 归类是**纪律**而非口味 —— 新增「余额增加类」成功提示必须归入此出口，否则等于
 *     悄悄退回弱提示（见 `docs/design/design-system.spec.md` §40 `T139`）。
 *
 * 实现要点：
 *   · `position: 'top-center'` 是**单条 toast 覆盖**（react-hot-toast 2.6.0 支持 `ToastOptions.position`），
 *     不改全局 `<Toaster position>` ⇒ 普通类零变化的物理前提；
 *   · 纵向重心用 `marginTop: 32vh` 而非 `top: 50%` —— toast 容器是 `position: fixed; top/left/right/bottom: 16px`
 *     的 flex 容器，逐条 toast 只能在该容器内位移；`32vh` 让**实测中心**落在视口 ~37%（区间 25%–55%），
 *     既不在贴顶，也不与页面中部的主操作按钮重合；
 *   · 视觉（字重 / 描边 / 硬阴影 / 缩放入场 / 深色档）全部落 `styles.css` 的 `.sf-toast-credit`，**零新主题 token**；
 *   · 层级：普通 toast 容器仍是 9999（react-hot-toast 内联值，**不动**）；**仅当强化 toast 在场时**
 *     容器降到 50（< 模态框 60，见 `styles.css` 该块注释）。
 */
import toast from 'react-hot-toast'

/** 强化 toast 的专属类名（单测 / 探针 / 样式三处共用的唯一字面）。 */
export const TOAST_CREDIT_CLASS = 'sf-toast-credit'

/** 强化 toast 的默认视觉参数（`opts` 可逐键覆盖，但**不覆盖**位置与类名 —— 那是出口的定义）。 */
export const TOAST_CREDIT_STYLE = Object.freeze({
  marginTop: '32vh',
  fontSize: 18,
  padding: '14px 22px',
  borderRadius: 14,
  maxWidth: 'min(90vw, 560px)',
})

/** 余额增加类成功提示：页面正中 + 18px + 5s。 */
export const toastCredit = (message, opts = {}) =>
  toast.success(String(message ?? ''), {
    position: 'top-center',
    duration: 5000,
    className: TOAST_CREDIT_CLASS,
    style: { ...TOAST_CREDIT_STYLE },
    ...opts,
  })

export default toastCredit
