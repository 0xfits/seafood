// ============================================================================
// BTTC 资产块（Kevin 2026-10-20 需求①②：自 `/wage#batt-checkin` 签到场迁入「我的资产」）
// ----------------------------------------------------------------------------
// 依据：docs/route-layer.spec.md §30.7（读口 = 既有 `GET /api/batt` 的 `data.bttc` 子对象 ⇒ 零新 GET）；
//   `POST /api/bttc/mint` / `POST /api/bttc/burn` 两个动作口（bttc-api.js）。
// 口径：
//   · 文案命名空间 = `bttcPanel`（余额 / 铸造 / 分解 / 缺口 / 不可用），六类工程口径泄漏 = 0；
//   · **整块资产面板**只在这里渲染（形态 = 余额 + 【铸造】+【分解】+ 缺口提示），签到场不再留半套；
//   · 派生布尔（`canMint` / `canBurn`）**不落库**，每次由读口即时取；客户端永不决定金额 / 电量
//     （承 `R-8-5`）；铸造缺额只做减法（与后端 `getBttcState` 同源口径），**不进**任何提交载荷。
//   · 钩子（§质检探针）：`bttc-asset`（面板根）/ `bttc-asset-batt`（电量摘要）/
//     `bttc-mint-shortfall`（+ `-batt` / `-usd`）。
// ============================================================================
import React, { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Button, Card, CardHeader, CardTitle, CardContent } from './ui'
import { FadeIn } from './ui/Motion'
import { useAuth } from '../auth-context'
import { fetchBatt } from '../batt-checkin'
import { postBttcMint, postBttcBurn } from '../bttc-api'

/** 面板根钩子（含余额 / 铸造 / 分解 / 缺口提示）—— 独立导出，供探针与单测按名引用。 */
export const BTTC_ASSET_HOOK = 'bttc-asset'

/** 铸造缺额：`batt ≥ policy.mintBattCost` ∧ `$ ≥ policy.mintFeeUsd`（纯展示 · 只做减法）。 */
const mintShortfallOf = (batt, bttc) => {
  if (!bttc || bttc.status === null || bttc.canMint) return { batt: 0, usd: '0' }
  const policy = bttc.policy || {}
  const positiveInt = (v, fallback) => {
    const n = Number(v)
    return Number.isSafeInteger(n) && n > 0 ? n : fallback
  }
  // 缺键 ⇒ 回落后端同款常量（`MINT_BURN_POLICY_DEFAULTS` 100 / 1），保证「显示缺额」优先于静默。
  const battCost = positiveInt(policy.mintBattCost, 100)
  const feeUsd = positiveInt(policy.mintFeeUsd, 1)
  const battNow = Number(batt?.batt ?? 0) || 0
  const toBig = (v) => {
    try {
      return BigInt(String(v ?? '0').trim() || '0')
    } catch {
      return null
    }
  }
  const usdNow = toBig(bttc.usdBalance ?? 0)
  const fee = BigInt(feeUsd)
  const needUsd = usdNow === null ? '0' : fee > usdNow ? String(fee - usdNow) : '0'
  return { batt: Math.max(0, battCost - battNow), usd: needUsd }
}

const BttcAssetPanel = () => {
  const { t } = useTranslation()
  const { isAuthenticated, user } = useAuth()
  const [batt, setBatt] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setBatt(null)
      return
    }
    try {
      setBatt(await fetchBatt({ user }))
    } catch {
      // 读口失败 = 静默（不阻塞「我的资产」其余面）；动作口失败才回吐错误（见 runAction）。
      setBatt(null)
    }
  }, [isAuthenticated, user])

  useEffect(() => {
    load()
  }, [load])

  if (!isAuthenticated) return null

  const runAction = async (action) => {
    if (busy) return
    setBusy(true)
    try {
      await action()
      await load()
    } catch (error) {
      toast.error(String(error?.message || '').trim() || t('error'))
    } finally {
      setBusy(false)
    }
  }

  const bttc = batt?.bttc || null
  const bttcBalance = bttc ? bttc.balance : '—'
  const bttcAvailable = bttc && bttc.status !== null
  const shortfall = mintShortfallOf(batt, bttc)
  const showMintShortfall = bttcAvailable && !bttc.canMint && (shortfall.batt > 0 || shortfall.usd !== '0')
  const battNow = batt?.batt

  return (
    <FadeIn>
      <Card variant="secondary" data-sf-m="bttc-asset-card">
        <CardHeader>
          <CardTitle className="text-2xl">{t('bttcPanel.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3" data-sf-m={BTTC_ASSET_HOOK}>
          <div className="flex items-baseline gap-3">
            <span className="text-sm text-gray-700">{t('bttcPanel.symbol')}</span>
            <span className="text-2xl font-semibold">{bttcBalance}</span>
            <span className="text-sm text-gray-500">{t('bttcPanel.balanceLabel')}</span>
          </div>

          {/* 电量摘要：直读读口值（`batt`），本面板不做任何本地换算。 */}
          {battNow != null && (
            <div className="flex items-baseline gap-2" data-sf-m="bttc-asset-batt">
              <span className="text-sm text-gray-700">{t('battCard.title')}</span>
              <span className="text-sm font-medium">{battNow}{t('battCard.unit')}</span>
            </div>
          )}

          {bttc && !bttcAvailable && (
            <p className="text-sm text-gray-500">{t('bttcPanel.unavailable')}</p>
          )}

          {bttcAvailable && (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => runAction(() => postBttcMint({ user }))}
                disabled={busy || !bttc.canMint}
              >
                {t('bttcPanel.mintButton')}
              </Button>
              <Button
                variant="outline"
                onClick={() => runAction(() => postBttcBurn({ user }))}
                disabled={busy || !bttc.canBurn}
              >
                {t('bttcPanel.burnButton')}
              </Button>
              <span className="text-sm text-gray-500">{t('bttcPanel.mintHint')}</span>
              {showMintShortfall && (
                <div className="flex flex-wrap items-center gap-2" data-sf-m="bttc-mint-shortfall">
                  {shortfall.batt > 0 && (
                    <span className="text-sm text-red-600" data-sf-m="bttc-mint-shortfall-batt">
                      {t('bttcPanel.mintNeedBatt', { n: shortfall.batt })}
                    </span>
                  )}
                  {shortfall.usd !== '0' && (
                    <span className="text-sm text-red-600" data-sf-m="bttc-mint-shortfall-usd">
                      {t('bttcPanel.mintNeedUsd', { n: shortfall.usd })}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}

export default BttcAssetPanel
