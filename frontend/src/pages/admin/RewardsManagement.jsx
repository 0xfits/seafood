import React, { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '../../components/ui'
import { Gift, Plus, Edit, Trash2, Eye } from 'lucide-react'

const RewardsManagement = () => {
  const [rewards, setRewards] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadRewards()
  }, [])

  const loadRewards = async () => {
    try {
      const response = await fetch('/api/brand/all')
      const data = await response.json()
      if (data.success) {
        setRewards(data.data || [])
      }
    } catch (error) {
      console.error('Error loading rewards:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">奖励管理</h2>
        <Button variant="primary">
          <Plus className="w-4 h-4 mr-2" />
          添加奖励
        </Button>
      </div>

      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid gap-4">
          {rewards.map((reward) => (
            <Card key={reward.brandID}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{reward.name}</h3>
                    <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="primary">{reward.points} 积分</Badge>
                      <Badge variant="secondary">库存: {reward.stock}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Trash2 className="w-4 h-4" />
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

export default RewardsManagement
