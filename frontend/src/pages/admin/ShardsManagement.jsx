import React, { useEffect, useState } from 'react'
import { Button, Card, CardContent } from '../../components/ui'
import { RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs'

const formatDateTime = (value) => {
  if (!value) return '—'
  const date = new Date(typeof value === 'number' ? value * 1000 : value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString()
}

const ShardsManagement = () => {
  const { t } = useTranslation()
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })
  const [brands, setBrands] = useState([])
  const [selectedBID, setSelectedBID] = useState(null)
  const [orderbook, setOrderbook] = useState({ buy: [], sell: [] })
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const canManage = hasAdminPermission(access, ['manage_rewards', 'publish_prizes'])

  useEffect(() => {
    loadInit()
  }, [])

  useEffect(() => {
    if (selectedBID) {
      loadOrderbook(selectedBID)
      loadTrades(selectedBID)
    }
  }, [selectedBID])

  const loadInit = async ({ silent = false } = {}) => {
    try {
      if (silent) setRefreshing(true)
      else setLoading(true)
      const currentUser = getStoredUser()
      if (currentUser) {
        setAccess(await fetchAdminAccess(currentUser))
      }
      const data = await fetchApiJson('/api/prize/all')
      const list = data || []
      setBrands(list)
      if (list.length > 0 && !selectedBID) {
        setSelectedBID(list[0].bID)
      }
    } catch (error) {
      toast.error(t('adminShards.loadFailed', { message: error.message }))
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadOrderbook = async (bID) => {
    try {
      const data = await fetchApiJson(`/api/market/${bID}/orderbook`)
      const rows = data || []
      setOrderbook({
        buy: rows.filter((r) => r.side === 'buy').sort((a, b) => b.price - a.price),
        sell: rows.filter((r) => r.side === 'sell').sort((a, b) => a.price - b.price),
      })
    } catch (error) {
      console.warn('Failed to load orderbook:', error)
      setOrderbook({ buy: [], sell: [] })
    }
  }

  const loadTrades = async (bID) => {
    try {
      const data = await fetchApiJson(`/api/market/${bID}/trades`)
      setTrades(data || [])
    } catch (error) {
      console.warn('Failed to load trades:', error)
      setTrades([])
    }
  }

  const handleRefresh = () => loadInit({ silent: true })

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-500">{t('adminCommon.loading')}</div>
  }

  if (!canManage) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-gray-500">
          {t('adminShards.noPermission')}
        </CardContent>
      </Card>
    )
  }

  const BrandSelector = () => (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-sm text-gray-600">{t('adminShards.prizeLabel')}</span>
      <select
        className="border border-gray-300 rounded px-2 py-1 text-sm"
        value={selectedBID ?? ''}
        onChange={(e) => setSelectedBID(Number(e.target.value))}
      >
        {brands.map((b) => (
          <option key={b.bID} value={b.bID}>
            {b.symbol} — {b.name}
          </option>
        ))}
      </select>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">{t('adminNav.shards')}</h2>
        <Button variant="proceed" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
          {t('adminCommon.refresh')}
        </Button>
      </div>

      <Tabs defaultValue="holdings">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="holdings">{t('adminShards.tabHoldings')}</TabsTrigger>
          <TabsTrigger value="orders">{t('adminShards.tabOrders')}</TabsTrigger>
          <TabsTrigger value="trades">{t('adminShards.tabTrades')}</TabsTrigger>
        </TabsList>

        <TabsContent value="holdings" className="mt-4">
          <Card>
            <CardContent className="py-6">
              <p className="text-sm text-gray-500 mb-4">
                {t('adminShards.holdingsNote')}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-gray-600">
                      <th className="py-2 pr-4">{t('adminShards.thPrize')}</th>
                      <th className="py-2 pr-4">Symbol</th>
                      <th className="py-2">{t('adminShards.thStoresCount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {brands.map((b) => (
                      <tr key={b.bID} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-4">{b.name}</td>
                        <td className="py-2 pr-4 font-mono">{b.symbol}</td>
                        <td className="py-2">{b.stores_count ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <BrandSelector />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardContent className="py-4">
                <h3 className="font-medium text-green-700 mb-3">{t('adminShards.buyTitle')}</h3>
                {orderbook.buy.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">{t('adminShards.noOrders')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2">{t('adminShards.thPrice')}</th>
                        <th className="pb-2">{t('adminShards.thVolume')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderbook.buy.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1 text-green-600 font-mono">{row.price}</td>
                          <td className="py-1">{row.volume}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="py-4">
                <h3 className="font-medium text-red-700 mb-3">{t('adminShards.sellTitle')}</h3>
                {orderbook.sell.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">{t('adminShards.noOrders')}</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="pb-2">{t('adminShards.thPrice')}</th>
                        <th className="pb-2">{t('adminShards.thVolume')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orderbook.sell.map((row, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          <td className="py-1 text-red-600 font-mono">{row.price}</td>
                          <td className="py-1">{row.volume}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trades" className="mt-4">
          <BrandSelector />
          <Card>
            <CardContent className="py-4">
              {trades.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">{t('adminShards.noTrades')}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b pb-2">
                      <th className="py-2 pr-4">{t('adminShards.thPrice')}</th>
                      <th className="py-2 pr-4">{t('adminShards.thQty')}</th>
                      <th className="py-2 pr-4">{t('adminShards.thBuyer')}</th>
                      <th className="py-2 pr-4">{t('adminShards.thSeller')}</th>
                      <th className="py-2">{t('adminShards.thTime')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trades.map((t, i) => (
                      <tr key={t.trID ?? i} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-2 pr-4 font-mono text-blue-600">{t.price}</td>
                        <td className="py-2 pr-4">{t.volume}</td>
                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{t.buyer_uID}</td>
                        <td className="py-2 pr-4 text-gray-500 font-mono text-xs">{t.seller_uID}</td>
                        <td className="py-2 text-gray-400 text-xs">
                          {formatDateTime(t.time_created)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default ShardsManagement
