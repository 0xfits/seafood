// ============================================================================
// /wage 电量卡内【铸造】入口（Kevin 2026-10-24 需求A/D）
// ----------------------------------------------------------------------------
// 为什么单独一个组件：BTTC 铸/解面板（`components/BttcAssetPanel.jsx`）自 2026-10-20 起
//   只在「我的资产」`/profile/assets` 渲染；`/wage` 电量卡内只回归**一个铸造入口**（不是整块资产面板），
//   电量卡与资产面板各自持有自己的读数来源。本组件由 `BattCheckinPanel` 的 children 槽注入 ⇒
//   **复用该卡已取的同一份 `GET /api/batt`**（`batt` / `capBatt` / `bttc` / policy），零新增读口。
//
// 口径（Kevin 已授权的唯一一种判定）：
//   · 可点 = `batt.canMint`（服务端口径 = `batt ≥ policy.mintBattCost` ∧ `$ ≥ policy.mintFeeUsd`）；
//   · 不可点 ⇒ **可见但置灰**（`disabled` + `aria-disabled`）+ 缺口提示
//     「还差 X 电量 / $Y」—— 缺口走 `BttcAssetPanel` 导出的 `mintShortfallOf` **同源减法**，不重写第二份；
//   · 点击 ⇒ `postBttcMint()`（幂等键 `cli:<UUID>` 由 `bttc-api` 内部生成）；
//     成功 ⇒ `toast.success`（资金变动类成功反馈 = Toast，design-system T126，duration 5000）+ 重拉读数；
//     失败 ⇒ **卡内内联**（T126：失败一律内联，不改 Toast 文案）。
//   · 客户端零本地数值计算（承 `R-8-5`）：代价 / 钳制 / 余额全由服务端决定，本组件只展示与置灰。
//
// 钩子：`wage-mint`（铸造钮）/ `wage-mint-shortfall`（缺口容器，内含 `-batt` / `-usd`）/ `wage-mint-err`（失败内联）。
// ============================================================================
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toastCredit } from '../../toast-credit'
import { useAuth } from '../../auth-context'
import { postBttcMint } from '../../bttc-api'
import { mintShortfallOf } from '../../components/BttcAssetPanel'

const WageMintEntry = ({ batt, reload }) => {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // 读数未到（首次加载 / 读口失败）⇒ 不渲染半态（不白屏、不给一个永远置灰的死钮）。
  if (!batt) return null

  const bttc = batt.bttc || null
  // 服务不可用（`status === null`）⇒ 入口整体不渲染（与资产面板同口径：不可用时不给动作钮）。
  if (!bttc || bttc.status === null) return null

  const canMint = Boolean(bttc.canMint)
  const shortfall = mintShortfallOf(batt, bttc)
  const showShortfall = !canMint && (shortfall.batt > 0 || shortfall.usd !== '0')

  const onMint = async (event) => {
    event.preventDefault()
    event.stopPropagation()
    if (busy || !canMint) return
    setBusy(true)
    setError('')
    try {
      await postBttcMint({ user })
      // ★ T126：资金余额变动类成功反馈 = Toast（一条，5s）；卡内不写成功文案。
      // ★ 2026-10-24 Toast 双轨：铸造到账（BTTC +1）= 余额增加类 ⇒ 单一出口 `toastCredit`。
      toastCredit(t('bttcPanel.mintOk'))
      // 重拉同一读口 ⇒ 电量点阵、BTTC 余额与缺口一起刷新（不本地减算）。
      if (typeof reload === 'function') await reload()
    } catch (err) {
      // ★ T126：失败一律卡内内联（不改 Toast）。
      const text = String(err?.message || '').trim() || t('bttcPanel.actionFail')
      setError(text)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="sf-wage-mint" data-sf-m="wage-mint-area">
      <button
        type="button"
        className="sf-wage-btn is-primary sf-wage-mint-btn"
        data-sf-m="wage-mint"
        data-sf-available={batt ? '1' : '0'}
        data-sf-can-mint={canMint ? '1' : '0'}
        disabled={!canMint || busy}
        aria-disabled={!canMint || busy ? 'true' : 'false'}
        onClick={onMint}
      >
        {t('bttcPanel.mintButton')}
      </button>
      {showShortfall ? (
        <span className="sf-wage-hint is-warn" data-sf-m="wage-mint-shortfall">
          {shortfall.batt > 0 ? (
            <span data-sf-m="wage-mint-shortfall-batt">{t('bttcPanel.mintNeedBatt', { n: shortfall.batt })}</span>
          ) : null}
          {shortfall.batt > 0 && shortfall.usd !== '0' ? ' / ' : null}
          {shortfall.usd !== '0' ? (
            <span data-sf-m="wage-mint-shortfall-usd">{t('bttcPanel.mintNeedUsd', { n: shortfall.usd })}</span>
          ) : null}
        </span>
      ) : null}
      {error ? (
        <span className="sf-wage-notice is-err" data-sf-m="wage-mint-err" role="alert">{error}</span>
      ) : null}
    </div>
  )
}

export default WageMintEntry
