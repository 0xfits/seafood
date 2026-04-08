import React, { useState, useEffect, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'

import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../components/ui'
import { LoadingPage } from '../components/ui/Loading'
import { FadeIn } from '../components/ui/Motion'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs'
import { fetchApiJson, getAuthHeaders } from '../auth'
import { useAuth } from '../auth-context'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (n) => Number(n ?? 0).toLocaleString()

// ─── Market tab ─────────────────────────────────────────────────────────────

const OrderBookPanel = ({ bID, refreshKey }) => {
  const [book, setBook] = useState({ buy: [], sell: [] })
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!bID) return
    setLoading(true)
    Promise.all([
      fetchApiJson(`/api/market/${bID}/orderbook`).catch(() => ({ buy: [], sell: [] })),
      fetchApiJson(`/api/market/${bID}/trades`).catch(() => []),
    ]).then(([b, t]) => {
      setBook(b ?? { buy: [], sell: [] })
      setTrades(t ?? [])
      setLoading(false)
    })
  }, [bID, refreshKey])

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>

  const sellSorted = [...(book.sell ?? [])].sort((a, b) => b.price - a.price)
  const buySorted = [...(book.buy ?? [])].sort((a, b) => b.price - a.price)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    const p = parseInt(price, 10)
    const v = parseInt(volume, 10)
    if (!bID || isNaN(p) || isNaN(v) || p <= 0 || v <= 0) {
      toast.error('请填写正确的价格和数量')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetchApiJson('/api/order', {
        method: 'POST',
        headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bID, side, price: p, volume: v }),
      })
      if (res?.success) {
        toast.success('挂单成功')
        setPrice('')
        setVolume('')
        onTraded()
      } else {
        toast.error(res?.message ?? '挂单失败')
      }
    } catch {
      toast.error('网络错误，请重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <BrandSelector brands={brands} selected={bID} onSelect={setBID} />
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
                min="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="每份价格"
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
      const res = await fetchApiJson(`/api/order/${oID}`, {
        method: 'DELETE',
        headers: getAuthHeaders(user),
      })
      if (res?.success) {
        toast.success('已撤单')
        onRefresh()
      } else {
        toast.error(res?.message ?? '撤单失败')
      }
    } catch {
      toast.error('网络错误')
    }
  }

  const cancelAll = async () => {
    setCancellingAll(true)
    try {
      const res = await fetchApiJson('/api/order', {
        method: 'DELETE',
        headers: { ...getAuthHeaders(user), 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (res?.success) {
        toast.success(`已撤销 ${res.data?.cancelled ?? 0} 笔挂单`)
        onRefresh()
      } else {
        toast.error(res?.message ?? '批量撤单失败')
      }
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
    fetchApiJson('/api/brand/all')
      .then((rows) => {
        setBrands(rows ?? [])
        if (rows?.length) setSelectedBID(rows[0].bID)
      })
      .catch(() => setBrands([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingPage />

  return (
    <FadeIn>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">碎片市场</h1>
          <p className="text-sm text-gray-500 mt-1">持有 1000 碎片可兑换 1 份 Gift</p>
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
              ? <OrderBookPanel bID={selectedBID} refreshKey={refreshKey} />
              : <div className="text-center py-12 text-gray-400">暂无品牌数据</div>
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
