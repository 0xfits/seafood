import React, { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui'
import { BarChart3, Plus, Minus, Search, Download } from 'lucide-react'

const PointsManagement = () => {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    loadTransactions()
  }, [])

  const loadTransactions = async () => {
    try {
      // 模拟交易数据
      const mockTransactions = [
        {
          id: 1,
          user: '0x59f9f640d15ebb053c94a816232cf8ce91b209b0',
          type: 'adjust',
          amount: 1000,
          reason: '管理员手动调整',
          timestamp: new Date().toISOString(),
          operator: 'admin'
        },
        {
          id: 2,
          user: '0x1234567890123456789012345678901234567890',
          type: 'task_complete',
          amount: 100,
          reason: '完成任务奖励',
          timestamp: new Date().toISOString(),
          operator: 'system'
        }
      ]
      setTransactions(mockTransactions)
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTransactions = transactions.filter(tx => 
    tx.user?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tx.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">积分管理</h2>
        <div className="flex gap-2">
          <Button variant="secondary">
            <Download className="w-4 h-4 mr-2" />
            导出记录
          </Button>
          <Button variant="primary">
            <Plus className="w-4 h-4 mr-2" />
            调整积分
          </Button>
        </div>
      </div>

      <div className="flex items-center space-x-2">
        <Search className="w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索用户地址或调整原因..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {filteredTransactions.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">
                      {tx.type === 'adjust' ? '手动调整' : '系统自动'}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">用户: {tx.user}</p>
                    <p className="text-sm text-gray-600">原因: {tx.reason}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      时间: {new Date(tx.timestamp).toLocaleString()}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={tx.amount > 0 ? 'success' : 'warning'}>
                        {tx.amount > 0 ? '+' : ''}{tx.amount} 积分
                      </Badge>
                      <Badge variant="secondary">{tx.operator}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Minus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default PointsManagement
