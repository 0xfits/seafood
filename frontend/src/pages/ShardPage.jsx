import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn } from '../components/ui/Motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { fetchApiJson, getAuthHeaders } from '../auth'
import { useAuth } from '../auth-context'
import { createIdempotencyKeyTracker } from '../idempotency'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n ?? 0).toLocaleString()

const normalizeOrderBook = (payload) => {
  if (Array.isArray(payload)) {
    return {
      buy: payload.filter((row) => row?.side === 'buy'),
      sell: payload.filter((row) => row?.side === 'sell'),
    }
  }

  return {
    buy: Array.isArray(payload?.buy) ? payload.buy : [],
    sell: Array.isArray(payload?.sell) ? payload.sell : [],
  }
}

// ─── Market tab ─────────────────────────────────────────────────────────────

const OrderBookPanel = ({ prize, refreshKey }) => {
  const bID = prize?.bID
  const [book, setBook] = useState({ buy: [], sell: [] })
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bID) return
    setLoading(true)
    Promise.all([
      fetchApiJson(`/api/market/${bID}/orderbook`).catch(() => []),
      fetchApiJson(`/api/market/${bID}/trades`).catch(() => []),
    ]).then(([b, t]) => {
      setBook(normalizeOrderBook(b))
      setTrades(t ?? [])
      setLoading(false)
    })
  }, [bID, refreshKey])

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>

  const sellSorted = [...(book.sell ?? [])].sort((a, b) => b.price - a.price)
  const buySorted = [...(book.buy ?? [])].sort((a, b) => b.price - a.price)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {prize?.price_floor_active && (
        <div className="md:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          该奖品已设置市场保底价：
          <span className="ml-2 font-semibold">{fmt(prize.market_floor_points)} J / 1000 碎片</span>
          <span className="ml-3 font-semibold">最低单片价 {fmt(prize.minimum_shard_price)} J</span>
        </div>
      )}
      {/* Order book */}
      <Card>
        <CardHeader><CardTitle className="text-sm">挂单簿</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>卖单 (价格)</span><span>数量</span>
            </div>
            {sellSorted.length === 0
              ? <div className="text-xs text-gray-300 text-center py-2">暂无卖单</div>
              : sellSorted.map((row, i) => (
                <div key={i} className="flex justify-between text-sm text-red-500">
                  <span>{fmt(row.price)} J</span><span>{fmt(row.volume)}</span>
                </div>
              ))
            }
            <div className="border-t my-2" />
            <div className="flex justify-between text-xs text-gray-400 mb-2">
              <span>买单 (价格)</span><span>数量</span>
            </div>
            {buySorted.length === 0
              ? <div className="text-xs text-gray-300 text-center py-2">暂无买单</div>
              : buySorted.map((row, i) => (
                <div key={i} className="flex justify-between text-sm text-green-600">
                  <span>{fmt(row.price)} J</span><span>{fmt(row.volume)}</span>
                </div>
              ))
            }
          </div>
        </CardContent>
      </Card>

      {/* Recent trades */}
      <Card>
        <CardHeader><CardTitle className="text-sm">最近成交</CardTitle></CardHeader>
        <CardContent>
          {trades.length === 0
            ? <div className="text-xs text-gray-300 text-center py-8">暂无成交记录</div>
            : (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-400 mb-2">
                  <span>价格</span><span>数量</span><span>时间</span>
                </div>
                {trades.slice(0, 20).map((t) => (
                  <div key={t.trID} className="flex justify-between text-xs">
                    <span className="text-gray-700">{fmt(t.price)} J</span>
                    <span className="text-gray-500">{fmt(t.volume)}</span>
                    <span className="text-gray-400">
                      {t.time_created ? new Date(t.time_created * 1000).toLocaleTimeString() : '--'}
                    </span>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Brand selector ──────────────────────────────────────────────────────────

const BrandSelector = ({ brands, selected, onSelect }) => (
  <div className="flex flex-wrap gap-2 mb-4">
    {brands.map((b) => (
      <button
        key={b.bID}
        onClick={() => onSelect(b.bID)}
        className={[
          'px-3 py-1 rounded-full text-sm border transition-colors',
          selected === b.bID
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400',
        ].join(' ')}
      >
        {b.symbol ?? b.name}
      </button>
    ))}
  </div>
)

// ─── Trade tab ───────────────────────────────────────────────────────────────

const TradePanel = ({ brands, user, onTraded }) => {
  const [bID, setBID] = useState(brands[0]?.bID ?? null)
  const [side, setSide] = useState('buy')
  const [price, setPrice] = useState('')
  const [volume, setVolume] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const selectedPrize = brands.find((brand) => brand.bID === bID) || null
  const minimumShardPrice = selectedPrize?.price_floor_active ? (selectedPrize.minimum_shard_price || 1) : 1
  // §2.4 S-b3e-1（§9.B **B11**）：`POST /api/order` 的 `create_key` **必填 fail-loud**（无自然键 ⇒ 不派生）。
  // 载具 = `createIdempotencyKeyTracker`：**同一份表单内容重试 ⇒ 复用同一个键**（= replay，不会变新订单）；
  // 内容变了 / 上一单已成功 ⇒ 新键（= 新实体）。
  const idempotencyRef = useRef(createIdempotencyKeyTracker('cli'))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const p = parseInt(price, 10)
    const v = parseInt(volume, 10)
    if (!bID || isNaN(p) || isNaN(v) || p <= 0 || v <= 0) {
      toast.error('请填写正确的价格和数量')
      return
    }
    if (!selectedPrize?.market_is_open) {
      toast.error('当前奖品不在流通期，暂不可交易')
      return
    }
    if (selectedPrize?.price_floor_active && p < minimumShardPrice) {
      toast.error(`该奖品最低成交价为 ${minimumShardPrice} J/片`)
      return
    }
    setSubmitting(true)
    try {
      // §2.4 S-b3e-1 / §9.B **B11**：补 `cli:` 前缀的 `create_key`
      //   （真源 = 后端 `src/index.ts:745`「`create_key` **必填 fail-loud**」+ §4.5 挂单行 `market_order.create_key`）。
      // 键取 `keyFor(内容指纹)`：**同一次用户操作重试 ⇒ 同一个键**；成功后 `reset()` ⇒ 下一次挂单 = 新实体。
      const payload = { bID, side, price: p, volume: v }
      const createKey = idempotencyRef.current.keyFor(JSON.stringify(payload))
      await fetchApiJson('/api/order', {
        method: 'POST',
        headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, create_key: createKey }),
      })
      idempotencyRef.current.reset()
      toast.success('挂单成功')
      setPrice('')
      setVolume('')
      onTraded()
    } catch (error) {
      toast.error(error?.message || '网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <BrandSelector brands={brands} selected={bID} onSelect={setBID} />
      {selectedPrize && (
        <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
          <div className="font-semibold text-gray-900">{selectedPrize.name || selectedPrize.symbol}</div>
          <div className="mt-1">1000 碎片 = 1 份奖品</div>
          {selectedPrize.price_floor_enabled ? (
            <div className="mt-2 text-amber-700">
              保底积分值 {fmt(selectedPrize.market_floor_points)} J，最低单片成交价 {fmt(selectedPrize.minimum_shard_price)} J。
            </div>
          ) : (
            <div className="mt-2">当前未设置保底成交价，默认按市场价格成交。</div>
          )}
          {!selectedPrize.market_is_open && (
            <div className="mt-2 text-red-600">当前奖品已进入清算期或已过期，不能继续挂单。</div>
          )}
        </div>
      )}
      <Card>
        <CardHeader><CardTitle className="text-base">限价挂单</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Side toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-200">
              <button
                type="button"
                onClick={() => setSide('buy')}
                className={[
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  side === 'buy' ? 'bg-green-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                买入
              </button>
              <button
                type="button"
                onClick={() => setSide('sell')}
                className={[
                  'flex-1 py-2 text-sm font-medium transition-colors',
                  side === 'sell' ? 'bg-red-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
                ].join(' ')}
              >
                卖出
              </button>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">价格 (dashJ)</label>
              <input
                type="number"
                min={minimumShardPrice}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={minimumShardPrice > 1 ? `最低 ${minimumShardPrice}` : '每份价格'}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">数量 (碎片份数)</label>
              <input
                type="number"
                min="1"
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="挂单份数"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            {price && volume && !isNaN(parseInt(price)) && !isNaN(parseInt(volume)) && (
              <div className="text-sm text-gray-500 bg-gray-50 rounded px-3 py-2">
                合计：{fmt(parseInt(price) * parseInt(volume))} J
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !bID}
              className={[
                'w-full',
                side === 'buy' ? 'bg-green-500 hover:bg-green-600' : 'bg-red-500 hover:bg-red-600',
                'text-white',
              ].join(' ')}
            >
              {submitting ? '提交中...' : side === 'buy' ? '买入挂单' : '卖出挂单'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── My tab ──────────────────────────────────────────────────────────────────

const MyPanel = ({ user, refreshKey, onRefresh }) => {
  const [holdings, setHoldings] = useState([])
  const [orders, setOrders] = useState([])
  const [transfers, setTransfers] = useState([])
  const [loading, setLoading] = useState(true)
  const [cancellingAll, setCancellingAll] = useState(false)

  useEffect(() => {
    if (!user) return
    setLoading(true)
    const h = getAuthHeaders(user)
    Promise.all([
      // §5.1「碎片读口 ①②」= **保留路径 + 保持空态 + 顶层 `deprecated:true`**（读口**不返回错** ⇒ 不属 `400`/`410` 面）。
      // 迁移目标 = `GET /api/user/points` / `GET /api/user/ledger?kind=transfer`，但**该两读口尚未注册**
      // （本单现取：`grep -n "user/points\|user/ledger" backend-ts/src/index.ts` = **0 命中**）⇒ §5.1 的
      // 迁移前置（§5.4 第 3 阶段「规范读口已上线」）**未满足** ⇒ 本单**不迁**（登记：报告 §2 「已弃用面处置」）。
      fetchApiJson('/api/shard', { headers: h }).catch(() => []),
      fetchApiJson('/api/order', { headers: h }).catch(() => []),
      fetchApiJson('/api/shard/transfer', { headers: h }).catch(() => []),
    ]).then(([sh, ord, tr]) => {
      setHoldings(sh ?? [])
      setOrders((ord ?? []).filter((o) => o.status === 'open' || o.status === 'partial'))
      setTransfers(tr ?? [])
      setLoading(false)
    })
  }, [user, refreshKey])

  const cancelOrder = async (oID) => {
    try {
      await fetchApiJson(`/api/order/${oID}`, {
        method: 'DELETE',
        headers: getAuthHeaders(user),
      })
      toast.success('已撤单')
      onRefresh()
    } catch {
      toast.error('网络错误')
    }
  }

  const cancelAll = async () => {
    setCancellingAll(true)
    try {
      // §2.4 **S4** / §9.B **B12**（`S-b3e-2`）：**入参一律走 query、不得读 body**（§1 #27 逐字；
      //   真源 = 后端 `src/index.ts:777`）⇒ 旧「带 `body: JSON.stringify({})` 的全撤」已删：
      //   后端 `cancelAllMarketOrders` 只读 `req.query`（无 query ⇒ 全撤），响应的 `cancelled` 键保留。
      const res = await fetchApiJson('/api/order', {
        method: 'DELETE',
        headers: getAuthHeaders(user),
      })
      toast.success(`已撤销 ${res?.cancelled ?? 0} 笔挂单`)
      onRefresh()
    } catch {
      toast.error('网络错误')
    } finally {
      setCancellingAll(false)
    }
  }

  if (!user) return <div className="text-center py-12 text-gray-400">请先登录</div>
  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>

  return (
    <div className="space-y-6">
      {/* Holdings */}
      <Card>
        <CardHeader><CardTitle className="text-sm">我的持仓</CardTitle></CardHeader>
        <CardContent>
          {holdings.length === 0
            ? <div className="text-sm text-gray-400 text-center py-4">暂无持仓</div>
            : (
              <div className="space-y-2">
                {holdings.map((h) => (
                  <div key={h.sID} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-700">{h.symbol ?? `Brand #${h.bID}`}</span>
                    <span className="text-indigo-600 font-semibold">{fmt(h.volume)} 碎片</span>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>

      {/* Open orders */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm">我的挂单</CardTitle>
          {orders.length > 0 && (
            <button
              onClick={cancelAll}
              disabled={cancellingAll}
              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
            >
              {cancellingAll ? '撤销中...' : '全部撤销'}
            </button>
          )}
        </CardHeader>
        <CardContent>
          {orders.length === 0
            ? <div className="text-sm text-gray-400 text-center py-4">暂无有效挂单</div>
            : (
              <div className="space-y-2">
                {orders.map((o) => (
                  <div key={o.oID} className="flex justify-between items-center text-sm border-b pb-2 last:border-0">
                    <div>
                      <Badge className={o.side === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}>
                        {o.side === 'buy' ? '买' : '卖'}
                      </Badge>
                      <span className="ml-2 text-gray-600">{fmt(o.price)} J × {fmt(o.volume_total - o.volume_filled)}</span>
                    </div>
                    <button
                      onClick={() => cancelOrder(o.oID)}
                      className="text-xs text-gray-400 hover:text-red-500"
                    >
                      撤单
                    </button>
                  </div>
                ))}
              </div>
            )
          }
        </CardContent>
      </Card>

      {/* Transfer history */}
      <Card>
        <CardHeader><CardTitle className="text-sm">流水记录</CardTitle></CardHeader>
        <CardContent>
          {transfers.length === 0
            ? <div className="text-sm text-gray-400 text-center py-4">暂无记录</div>
            : (
              <div className="space-y-2">
                {transfers.slice(0, 30).map((t) => {
                  const isIn = t.to_uID === user.uID
                  return (
                    <div key={t.txID} className="flex justify-between items-center text-xs border-b pb-1 last:border-0">
                      <div className="text-gray-500">
                        <span className="mr-2">{t.reason}</span>
                        <span>{t.brand_symbol ?? `#${t.bID}`}</span>
                      </div>
                      <span className={isIn ? 'text-green-600 font-medium' : 'text-red-500'}>
                        {isIn ? '+' : '-'}{fmt(t.volume)}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          }
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────────

const ShardPage = () => {
  const location = useLocation()
  const { user, isAuthenticated } = useAuth()
  const [brands, setBrands] = useState([])
  const [selectedBID, setSelectedBID] = useState(null)
  const [activeTab, setActiveTab] = useState('market')
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  useEffect(() => {
    fetchApiJson('/api/prize/all')
      .then((rows) => {
        setBrands(rows ?? [])
        if (rows?.length) setSelectedBID(rows[0].bID)
      })
      .catch(() => setBrands([]))
      .finally(() => setLoading(false))
  }, [])

  const selectedPrize = brands.find((brand) => brand.bID === selectedBID) || null

  if (loading) return <LoadingPage />

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">碎片市场</h1>
          <p className="text-sm text-gray-500 mt-1">持有 1000 碎片可兑换 1 份奖品</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="market">市场</TabsTrigger>
            <TabsTrigger value="trade">交易</TabsTrigger>
            <TabsTrigger value="mine">我的</TabsTrigger>
          </TabsList>

          <TabsContent value="market">
            <BrandSelector brands={brands} selected={selectedBID} onSelect={setSelectedBID} />
            {selectedBID
              ? <OrderBookPanel prize={selectedPrize} refreshKey={refreshKey} />
              : <div className="text-center py-12 text-gray-400">暂无奖品数据</div>
            }
          </TabsContent>

          <TabsContent value="trade">
            {!isAuthenticated
              ? <div className="text-center py-12 text-gray-400">请先登录后交易</div>
              : <TradePanel brands={brands} user={user} onTraded={refresh} />
            }
          </TabsContent>

          <TabsContent value="mine">
            <MyPanel user={isAuthenticated ? user : null} refreshKey={refreshKey} onRefresh={refresh} />
          </TabsContent>
        </Tabs>
      </div>
    </FadeIn>
  )
}

export default ShardPage
