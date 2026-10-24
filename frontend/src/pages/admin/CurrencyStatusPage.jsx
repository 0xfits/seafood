import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, Coins, Hash, Lock, RefreshCw, Snowflake } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission,
} from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'
import { buildLocalizedPath, getLanguageFromUrl } from '../../utils'

/**
 * 「币种管理」tab（交易所管理第④面 · `route-layer.spec` v2.52 §49.25 + §49.25.11 ·
 *   `design-system.spec` v1.35 §36 规则 `T135` / `T135-a` / `T135-b` / `T135-c`）。
 *
 * 数据面（**只读**）：`GET /api/admin/currency/status`（闸 `manage_settings`）
 *   `data` = 行数组，**恰 4 键** `{ cid, symbol, status, listed_at }`（`cid` = 十进制串、`listed_at` 可 `null`）。
 * 动作面（**唯一写口**）：`POST /api/admin/currency/:cid/status`
 *   body = `{ status, create_key }`（`memo` 留空 ⇒ **不带该键**；本页不提供 memo 输入 ⇒ 恒不带）。
 *   `create_key` 形如 `ops:<admin_uid>:currency_status:<cid>:<to>`（与后端 `resolveAdminOpsKey` 同形，
 *   §49.25.7 幂等键 = `ops:<admin_uid>:currency_status:<cid>:<to_status>`）。
 *
 * UI 硬口径（§36，逐条落到本文件）：
 *   ① 列**恰 4 项** = cid / 符号 / 状态 / 上线时间；
 *   ② **状态列直接读 `status`**（`ledger.spec` R10 原文），只做四态 → 本地化词条的**一一映射**，零派生；
 *   ③ 行操作按 `CURRENCY_TRANSITIONS`（`ledger.ts:656-661` = R27 实现面）**逐行决定渲染哪些按钮**；
 *      不可达的动作**不渲染**（不是灰按钮，`T135-a`）；
 *   ④ `$`（`cid = 1`）整行**禁操作**（R26：`$` 恒 `listed`）—— 渲染不可点的守卫标记 + 提示，**零可点控件**；
 *   ⑤ 危险操作（`frozen` / `delisted`）**必须二次确认**（`T135-c`），确认文案含符号 + 目标动作 +
 *      「未成交挂单将被撤销」「下架不可恢复」（R30）。
 *
 * 失败口径：**内联**在列表上方（含机读 `reason` → 人话映射），不弹错误 toast
 *   （`error.code` / `error.details.reason` 由 `auth.js:fetchApiJson` 附在抛出的 Error 上；
 *   §14.3 v0.7(A)：调用方只准按 `code` 分支，`reason` 仅供诊断与文案）。
 * 成功口径：**默认 toast**（后台配置类，**不经**余额增强出口）+ 就地重拉列表。
 */

/** 状态机（**前端镜像**，真源 = `backend-ts/src/ledger.ts:656-661` `CURRENCY_TRANSITIONS`）。
 *
 * `T135-b` 例外：`draft` 行**不渲「上市」**。后端 `draft → listed` 恒 409
 * `LISTING_REQUIRES_FEE_PATH`（上市带资金链，必须走建币审核），渲一个必错的按钮是坏 UX
 * ⇒ UI 侧只给 `delisted`，并就地一句只读提示（复用 `adminCurrencyStatus.reasonFeePath`）。
 * 其余三态（`listed` / `frozen` / `delisted`）与后端矩阵逐格一致。 */
const CURRENCY_TRANSITIONS = {
  draft: ['delisted'],
  listed: ['frozen', 'delisted'],
  frozen: ['listed', 'delisted'],
  delisted: [],
}

const CURRENCY_STATUSES = ['draft', 'listed', 'frozen', 'delisted']

/** 四态 → 本地化词条（**复用现役** `adminCurrencyReview.status*`，不另造词）。 */
const STATUS_LABEL_KEY = {
  draft: 'adminCurrencyReview.statusDraft',
  listed: 'adminCurrencyReview.statusListed',
  frozen: 'adminCurrencyReview.statusFrozen',
  delisted: 'adminCurrencyReview.statusDelisted',
}

/** 目标状态 → 动词键（按钮文案 + 二次确认里的 `{{action}}`）。 */
const ACTION_LABEL_KEY = {
  listed: 'adminCurrencyStatus.actList',
  frozen: 'adminCurrencyStatus.actFreeze',
  delisted: 'adminCurrencyStatus.actDelist',
}

const ACTION_ICON = { listed: ArrowUpCircle, frozen: Snowflake, delisted: ArrowDownCircle }

/** 危险动作（下架 / 冻结）⇒ 二次确认；`frozen → listed` 是解冻，不套确认层（`T135-c`）。 */
const DANGEROUS_TARGETS = new Set(['frozen', 'delisted'])

/** `$`（cid = 1）恒 `listed` 且禁止改态（R26）。 */
const SYSTEM_CURRENCY_CID = '1'

/**
 * 机读 `details.reason` → 人话键（只覆盖 UI 有专门口径的几条；其余回落 `code` 或服务端 `message`）。
 * 错误文案一律走既有 i18n（`ledger.err.<CODE>` 是 `R104` 的唯一来源），本页不自造错误码文案。
 */
const REASON_MESSAGE_KEY = {
  SYSTEM_CURRENCY_IMMUTABLE: 'adminCurrencyStatus.locked',
  ACTIVE_ORDERS_REMAIN: 'adminCurrencyStatus.reasonActiveOrders',
  LISTING_REQUIRES_FEE_PATH: 'adminCurrencyStatus.reasonFeePath',
  LEDGER_CURRENCY_INVALID_TRANSITION: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
}

/** 行操作集合（**纯函数**，供渲染与单测共用）：`$` 行 / 终态 / 未知态 ⇒ 空集。
 *  `draft` ⇒ 仅 `delisted`（`T135-b`：不渲必 409 的「上市」）。 */
export const actionsForRow = (row) => {
  const cid = String(row?.cid ?? '')
  if (cid === SYSTEM_CURRENCY_CID) return []
  const status = String(row?.status ?? '')
  return CURRENCY_TRANSITIONS[status] || []
}

const isSystemCurrency = (row) => String(row?.cid ?? '') === SYSTEM_CURRENCY_CID

const CurrencyStatusPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [rows, setRows] = useState([])
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [busyCid, setBusyCid] = useState(null)
  const [inlineError, setInlineError] = useState(null) // { text, reason, cid }

  useEffect(() => {
    loadRows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRows = async () => {
    try {
      setInitialLoading(true)
      const currentUser = getStoredUser()
      if (!currentUser) {
        throw new Error(t('adminCommon.notLoggedIn'))
      }
      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) {
        throw new Error(t('adminCommon.noAdminAccess'))
      }
      setAccess(accessInfo)

      const data = await fetchApiJson('/api/admin/currency/status', {
        headers: getAuthHeaders(currentUser),
      })
      setRows(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error loading currency status list:', error)
      toast.error(t('adminCurrencyReview.loadFailed', { message: error.message }))
    } finally {
      setInitialLoading(false)
    }
  }

  const refresh = async () => {
    setRefreshing(true)
    await loadRows()
    toast.success(t('adminCommon.refresh'))
    setRefreshing(false)
  }

  const canManage = hasAdminPermission(access, 'manage_settings')
  const statusLabel = (status) => (STATUS_LABEL_KEY[status] ? t(STATUS_LABEL_KEY[status]) : status)
  const actionLabel = (target) => t(ACTION_LABEL_KEY[target])

  /** 失败 → 人话（404/400/409/503 均落在既有码上；403 走权限文案）。 */
  const inlineTextOf = (error) => {
    if (error?.status === 403) return t('adminCommon.noAdminAccess')
    const reason = error?.details?.reason
    if (reason && REASON_MESSAGE_KEY[reason]) return t(REASON_MESSAGE_KEY[reason])
    const code = error?.code
    if (code) {
      const key = `ledger.err.${code}`
      const text = t(key)
      // i18next 缺键时原样回传键名 ⇒ 用「回传值 ≠ 键」判存在，避免把键名当文案渲染
      if (text && text !== key) return text
    }
    return error?.message || t('ledger.err.LEDGER_TRANSACTION_REQUIRED')
  }

  const submitStatus = async (row, target) => {
    if (!canManage || isSystemCurrency(row)) return
    if (!actionsForRow(row).includes(target)) return

    // 二次确认（危险动作）：未确认 ⇒ **不发请求**（拦在提交之前，`T135-c`）
    if (DANGEROUS_TARGETS.has(target)) {
      const ok = window.confirm(t('adminCurrencyStatus.confirm', {
        symbol: row.symbol,
        action: actionLabel(target),
      }))
      if (!ok) return
    }

    setBusyCid(String(row.cid))
    setInlineError(null)
    try {
      const currentUser = getStoredUser()
      const headers = {
        ...getAuthHeaders(currentUser),
        'Content-Type': 'application/json',
      }
      if (!headers.Authorization) {
        toast.error(t('adminCommon.sessionExpired'))
        navigate(buildLocalizedPath(getLanguageFromUrl(window.location.pathname), '/login'))
        return
      }
      await fetchApiJson(`/api/admin/currency/${row.cid}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          status: target,
          create_key: adminOpsKey(currentUser?.uID, 'currency_status', `${row.cid}:${target}`),
        }),
      })
      toast.success(t('adminCurrencyStatus.done'))
      await loadRows()
    } catch (error) {
      console.error('Error updating currency status:', error)
      setInlineError({
        text: inlineTextOf(error),
        reason: error?.details?.reason || error?.code || 'UNKNOWN',
        cid: String(row.cid),
      })
    } finally {
      setBusyCid(null)
    }
  }

  const orderedRows = useMemo(
    () => [...rows].sort((a, b) => Number(a.cid) - Number(b.cid)),
    [rows]
  )

  const renderAction = (row, target) => {
    const Icon = ACTION_ICON[target]
    const busy = busyCid === String(row.cid)
    const danger = DANGEROUS_TARGETS.has(target)
    return (
      <Button
        key={target}
        variant={danger ? 'ghost' : 'primary'}
        size="sm"
        disabled={!canManage || busy}
        data-sf-m={`currency-status-action-${target}`}
        data-cid={row.cid}
        onClick={() => submitStatus(row, target)}
      >
        <Icon className="w-4 h-4 mr-1" />
        {actionLabel(target)}
      </Button>
    )
  }

  return (
    <div className="space-y-6" data-sf-m="currency-status-panel">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">{t('adminNav.currencyStatus')}</h2>
          <p className="text-sm text-gray-600 mt-1">
            {t('adminNav.currencyReviewDesc')}
            {!canManage && ` ${t('adminCommon.readOnlyNotice')}`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}
          </Button>
        </div>
      </div>

      {/* 失败 ⇒ 列表上方内联（不弹错误 toast）；`data-reason` 留机读值供探针/诊断 */}
      {inlineError && (
        <div
          role="alert"
          data-sf-m="currency-status-error"
          data-reason={inlineError.reason}
          data-cid={inlineError.cid}
          className="sf-curstatus-error"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{inlineError.text}</span>
          <button
            type="button"
            className="sf-curstatus-error-close"
            onClick={() => setInlineError(null)}
            aria-label={t('adminCommon.close')}
          >
            {t('adminCommon.close')}
          </button>
        </div>
      )}

      {initialLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">{t('adminCommon.loading')}</p>
        </div>
      ) : orderedRows.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">{t('noData')}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Coins className="w-5 h-5" />
              {t('adminNav.currencyStatus')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="sf-curstatus-wrap">
              <table className="sf-curstatus-table">
                <thead>
                  <tr>
                    <th scope="col">{t('adminCurrencyReview.colId')}</th>
                    <th scope="col">{t('adminCurrencyReview.colSymbol')}</th>
                    <th scope="col">{t('adminCurrencyReview.colStatus')}</th>
                    <th scope="col">{t('adminCurrencyStatus.colListedAt')}</th>
                    <th scope="col">{t('adminCommon.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {orderedRows.map((row) => {
                    const actions = actionsForRow(row)
                    const locked = isSystemCurrency(row)
                    return (
                      <tr key={row.cid} data-sf-m="currency-status-row" data-cid={row.cid} data-status={row.status}>
                        <td data-label={t('adminCurrencyReview.colId')} className="font-mono">{row.cid}</td>
                        <td data-label={t('adminCurrencyReview.colSymbol')} className="font-mono">{row.symbol}</td>
                        {/* 状态列**直接读 `status`**（R10）：只做四态 → 词条的一一映射，零派生 */}
                        <td data-label={t('adminCurrencyReview.colStatus')}>
                          <span
                            className={`sf-curstatus-status${row.status === 'delisted' ? ' is-final' : ''}`}
                            data-sf-m="currency-status-status"
                            data-status={row.status}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </td>
                        <td data-label={t('adminCurrencyStatus.colListedAt')} className="text-gray-500">
                          {row.listed_at ? String(row.listed_at) : '—'}
                        </td>
                        <td data-label={t('adminCommon.colActions')}>
                          <div className="sf-curstatus-actions">
                            {locked ? (
                              /* `$` 行：**零可点控件**（R26），只有不可点的守卫标记 + 提示 */
                              <span
                                data-sf-m="currency-status-locked"
                                className="sf-curstatus-locked"
                                title={t('adminCurrencyStatus.locked')}
                                aria-label={t('adminCurrencyStatus.locked')}
                              >
                                <Lock className="w-3.5 h-3.5" />
                                {t('adminCurrencyStatus.locked')}
                              </span>
                            ) : (
                              actions.length === 0 ? (
                                <span data-sf-m="currency-status-final" className="text-xs text-gray-400">
                                  —
                                </span>
                              ) : (
                                actions.map((target) => renderAction(row, target))
                              )
                            )}
                            {/* `draft` 行只读提示（`T135-b`）：上市必须走建币审核，本页无此动作 */}
                            {row.status === 'draft' && (
                              <span
                                data-sf-m="currency-status-draft-hint"
                                className="sf-curstatus-hint"
                                title={t('adminCurrencyStatus.reasonFeePath')}
                              >
                                {t('adminCurrencyStatus.reasonFeePath')}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <Hash className="w-3.5 h-3.5" />
              {CURRENCY_STATUSES.map((status) => statusLabel(status)).join(' / ')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CurrencyStatusPage
