import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent } from '../../components/ui'
import { RefreshCw, ChevronLeft, ChevronRight, ScrollText, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'

/**
 * 审计台（批 8⑥ · 统一只读检索台 · 14 面）。
 * 契约 = `route-layer.spec` v2.21 §32；读口 `GET /api/admin/audit/:table`（**只读**）。
 * 权限 = `manage_audit`。五类过滤（执行者 / 对象 / 动作 / 时间窗 / 关联 id）逐表分派；
 * 页面**不内嵌任何工程口径**（表名 / 列名为**数据驱动**渲染，非文案面）。
 * **只读**：无写按钮、无导出按钮（§32.9 X1/X2）。
 */

// 14 面白名单 + 逐表支持的过滤维度（与后端 `audit-console.ts` 同源；门内做逐表相等对拍）。
const AUDIT_TABLES = [
  { id: 'admin_ops_audit_log', filters: ['actor', 'target', 'action', 'from', 'to', 'refId'] },
  { id: 'admin_refund_audit_log', filters: ['actor', 'target', 'from', 'to', 'refId'] },
  { id: 'ledger_entry', filters: ['from', 'to', 'refId'] },
  { id: 'currency_review_log', filters: ['actor', 'target', 'from', 'to', 'refId'] },
  { id: 'currency_status_log', filters: ['actor', 'target', 'action', 'from', 'to', 'refId'] },
  { id: 'listing_review_log', filters: ['actor', 'target', 'from', 'to', 'refId'] },
  { id: 'job_arbitration_log', filters: ['actor', 'target', 'from', 'to', 'refId'] },
  { id: 'batt_entry', filters: ['from', 'to', 'refId'] },
  { id: 'checkin_log', filters: ['from', 'to'] },
  { id: 'checkin_makeup_log', filters: ['from', 'to', 'refId'] },
  { id: 'rating', filters: ['actor', 'target', 'action', 'from', 'to', 'refId'] },
  { id: 'listing_order_event', filters: ['actor', 'target', 'action', 'from', 'to', 'refId'] },
  { id: 'referral', filters: ['target', 'from', 'to'] },
  { id: 'commission_policy', filters: ['actor', 'from', 'to'] },
]

const FILTER_PARAMS = ['actor', 'target', 'action', 'from', 'to', 'refId']
const LIMIT = 50

const camel = (s) => s.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
const labelKeyOf = (id) => `auditConsole.tbl${camel(id)}`

const AuditConsolePage = () => {
  const { t } = useTranslation()

  const [table, setTable] = useState(AUDIT_TABLES[0].id)
  const [filters, setFilters] = useState({})
  const [rows, setRows] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [cursorStack, setCursorStack] = useState([]) // [] = 第一页；push 前进游标以支持「上一页」
  const [loading, setLoading] = useState(false)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  const spec = useMemo(() => AUDIT_TABLES.find((x) => x.id === table) || AUDIT_TABLES[0], [table])
  const supported = spec.filters
  const canRead = hasAdminPermission(access, 'manage_audit')

  useEffect(() => {
    const currentUser = getStoredUser()
    if (currentUser) {
      // 权限面仅用于 UI 呈现；服务端仍为唯一闸
      setAccess({ is_admin: Boolean(currentUser?.is_admin), permissions: [], can_access_admin: true })
    }
  }, [])

  const buildQuery = (cursor) => {
    const params = new URLSearchParams()
    params.set('limit', String(LIMIT))
    for (const p of FILTER_PARAMS) {
      if (!supported.includes(p)) continue
      const v = String(filters[p] ?? '').trim()
      if (v) params.set(p, p === 'from' || p === 'to' ? new Date(v).toISOString() : v)
    }
    if (cursor) params.set('cursor', cursor)
    return params.toString()
  }

  const loadPage = async (cursor) => {
    setLoading(true)
    try {
      const currentUser = getStoredUser()
      const data = await fetchApiJson(`/api/admin/audit/${table}?${buildQuery(cursor)}`, {
        headers: getAuthHeaders(currentUser),
      })
      const page = data && typeof data === 'object' ? data : {}
      setRows(Array.isArray(page.rows) ? page.rows : [])
      setNextCursor(page.nextCursor || null)
      setCursorStack((prev) => (cursor ? [...prev, cursor] : []))
    } catch (error) {
      console.error('Error loading audit page:', error)
      toast.error(t('auditConsole.loadFailed', { message: error.message }))
      setRows([])
      setNextCursor(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setFilters({})
    loadPage(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table])

  const next = () => { if (nextCursor) loadPage(nextCursor) }
  const prev = () => {
    const stack = cursorStack.slice(0, -1)
    const target = stack[stack.length - 1]
    setCursorStack(stack)
    loadPage(target)
  }
  const apply = () => loadPage(undefined)
  const reset = () => { setFilters({}); loadPage(undefined) }

  // 动态列（数据驱动 · 非文案面）：并集列序，稳定呈现
  const columns = useMemo(() => {
    const set = []
    for (const row of rows) for (const k of Object.keys(row || {})) if (!set.includes(k)) set.push(k)
    return set
  }, [rows])

  const cell = (v) => {
    if (v === null || v === undefined) return '—'
    if (typeof v === 'object') return JSON.stringify(v)
    return String(v)
  }

  const filterInput = (p) => {
    const isDate = p === 'from' || p === 'to'
    return (
      <label key={p} className="flex flex-col gap-1 text-xs text-gray-600">
        <span>{t(`auditConsole.filter${camel(p)}`)}</span>
        <input
          type={isDate ? 'datetime-local' : p === 'action' ? 'text' : 'text'}
          value={filters[p] ?? ''}
          onChange={(e) => setFilters((prev) => ({ ...prev, [p]: e.target.value }))}
          className="px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <ScrollText className="w-6 h-6 text-blue-600" />
            {t('auditConsole.pageTitle')}
          </h2>
          <p className="text-sm text-gray-600 mt-1">{t('auditConsole.pageSubtitle')}</p>
        </div>
        <Button variant="ghost" onClick={() => loadPage(cursorStack[cursorStack.length - 1])} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('auditConsole.refresh')}
        </Button>
      </div>

      {/* 表切换（14 面）+ 机读标识 data-audit-table（排查用） */}
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <label className="text-gray-600">{t('auditConsole.tableLabel')}</label>
        <select
          value={table}
          data-audit-table={table}
          onChange={(e) => setTable(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
        >
          {AUDIT_TABLES.map((x) => (
            <option key={x.id} value={x.id}>{t(labelKeyOf(x.id))}</option>
          ))}
        </select>
      </div>

      {/* 五类过滤控件（逐表按支持维度呈现） */}
      <Card>
        <CardContent className="py-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {FILTER_PARAMS.filter((p) => supported.includes(p)).map(filterInput)}
            <Button variant="primary" onClick={apply} disabled={loading}>
              <Search className="w-4 h-4 mr-1" />{t('auditConsole.apply')}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={loading}>{t('auditConsole.reset')}</Button>
          </div>
          <p className="text-xs text-gray-400">{t('auditConsole.filtersHint')}</p>
        </CardContent>
      </Card>

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">{t('auditConsole.loading')}</p>
        </div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-gray-500">{t('auditConsole.empty')}</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="py-4">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    {columns.map((c) => <th key={c} className="py-2 pr-4 font-mono text-xs">{c}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} className="border-b align-top">
                      {columns.map((c) => <td key={c} className="py-2 pr-4 whitespace-nowrap">{cell(row[c])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* keyset 分页（前进 / 后退） */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{t('auditConsole.rowCount', { count: rows.length })}</span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={prev} disabled={loading || cursorStack.length === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" />{t('auditConsole.prev')}
          </Button>
          <Button variant="ghost" onClick={next} disabled={loading || !nextCursor}>
            {t('auditConsole.next')}<ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AuditConsolePage
