import React, { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { User, Mail, Calendar, Trophy, Star, Edit3, Save, X, Copy, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import UnifiedModal, { ModalHeader, ModalContent, ModalFooter, MODAL_TYPES } from './ui/UnifiedModal'
import { Button } from './ui/Button'
import { Badge } from './ui/Badge'
import DashJ from './ui/DashJ'
import { formatEvmAddress } from '../utils'

const ProfileModal = ({ isOpen, onClose }) => {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [userAssets, setUserAssets] = useState(null)
  const [taskStats, setTaskStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    pendingRewards: 0,
    totalPoints: 0
  })
  const [loading, setLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [bio, setBio] = useState('')
  const [tempBio, setTempBio] = useState('')

  useEffect(() => {
    if (isOpen) {
      loadUserInfo()
    }
  }, [isOpen])

  const loadUserInfo = async () => {
    setLoading(true)
    try {
      const storedUser = localStorage.getItem('user')
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser)
        setUser(parsedUser)
        setBio(parsedUser.bio || '')
        setTempBio(parsedUser.bio || '')
        
        // 加载用户资产
        await loadUserAssets(parsedUser.uID)
        // 加载用户任务统计
        await loadTaskStats(parsedUser.uID)
      }
    } catch (error) {
      console.error('Error loading user info:', error)
      toast.error('加载用户信息失败')
    } finally {
      setLoading(false)
    }
  }

  const loadUserAssets = async (uID) => {
    try {
      const response = await fetch(`/api/asset/${uID}`)
      const data = await response.json()
      if (data.success && data.data) {
        setUserAssets(data.data)
      } else {
        // 模拟数据
        setUserAssets({
          points: Math.floor(Math.random() * 10000) + 1000,
          lucks: Math.floor(Math.random() * 100) + 50,
          gIDs: [],
          sIDs: []
        })
      }
    } catch (error) {
      // 模拟数据
      setUserAssets({
        points: Math.floor(Math.random() * 10000) + 1000,
        lucks: Math.floor(Math.random() * 100) + 50,
        gIDs: [],
        sIDs: []
      })
    }
  }

  const loadTaskStats = async (uID) => {
    try {
      const response = await fetch(`/api/tasklist/user/${uID}`)
      const data = await response.json()
      if (data.success) {
        const stats = {
          totalTasks: 0,
          completedTasks: 0,
          pendingTasks: 0,
          pendingRewards: 0,
          totalPoints: 0
        }
        
        // 计算统计数据
        if (data.data.pendingVerification) {
          stats.pendingTasks += data.data.pendingVerification.length
          stats.totalTasks += data.data.pendingVerification.length
        }
        if (data.data.pendingRewards) {
          stats.pendingRewards += data.data.pendingRewards.length
          stats.totalTasks += data.data.pendingRewards.length
        }
        if (data.data.pendingTasks) {
          stats.pendingTasks += data.data.pendingTasks.length
          stats.totalTasks += data.data.pendingTasks.length
        }
        if (data.data.completedTasks) {
          stats.completedTasks += data.data.completedTasks.length
          stats.totalTasks += data.data.completedTasks.length
          stats.totalPoints = data.data.completedTasks.reduce((sum, task) => {
            return sum + (task.points_claimed || 0)
          }, 0)
        }
        
        setTaskStats(stats)
      }
    } catch (error) {
      // 模拟数据
      setTaskStats({
        totalTasks: Math.floor(Math.random() * 20) + 5,
        completedTasks: Math.floor(Math.random() * 10) + 2,
        pendingTasks: Math.floor(Math.random() * 5) + 1,
        pendingRewards: Math.floor(Math.random() * 3),
        totalPoints: Math.floor(Math.random() * 5000) + 500
      })
    }
  }

  const saveBio = async () => {
    try {
      // 模拟保存
      localStorage.setItem(`user_${user.uID}_bio`, tempBio)
      setBio(tempBio)
      setIsEditing(false)
      toast.success('简介保存成功')
    } catch (error) {
      toast.error('保存失败')
    }
  }

  const cancelEdit = () => {
    setTempBio(bio)
    setIsEditing(false)
  }

  const copyAddress = () => {
    if (user?.EVM) {
      navigator.clipboard.writeText(user.EVM)
      toast.success('地址已复制到剪贴板')
    }
  }

  const openExplorer = () => {
    if (user?.EVM) {
      window.open(`https://etherscan.io/address/${user.EVM}`, '_blank')
    }
  }

  return (
    <UnifiedModal
      isOpen={isOpen}
      onClose={onClose}
      type={MODAL_TYPES.INFO}
      title="个人资料"
      size="lg"
      showIcon={true}
    >
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      ) : !user ? (
        <div className="text-center py-8">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-lg text-gray-600 mb-4">请先登录</p>
          <Button variant="primary">去登录</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* 用户基本信息 */}
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full flex items-center justify-center text-white text-xl font-bold">
              {user.EVM ? user.EVM.slice(2, 4).toUpperCase() : 'U'}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user.EVM ? formatEvmAddress(user.EVM) : '未知用户'}
                </h3>
                {user.is_admin && (
                  <Badge variant="warning" size="sm">管理员</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {user.time_reg ? new Date(user.time_reg).toLocaleDateString() : '未知'}
                </div>
              </div>
            </div>
          </div>

          {/* 钱包地址 */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-2">钱包地址</h4>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="flex-1 font-mono text-sm text-gray-800 dark:text-gray-200">
                {user.EVM || '未设置'}
              </span>
              <Button
                variant="proceed"
                size="sm"
                onClick={copyAddress}
                className="flex items-center gap-1"
              >
                <Copy className="w-3 h-3" />
                复制
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={openExplorer}
                className="flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                查看
              </Button>
            </div>
          </div>

          {/* 用户资产 */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">我的资产</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-1">
                  {userAssets?.points || 0}
                </div>
                <div className="flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                  <DashJ size="sm" />
                </div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {userAssets?.lucks || 0}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">幸运值</div>
              </div>
            </div>
          </div>

          {/* 任务统计 */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">任务成就</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">
                  {taskStats.totalTasks}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">总任务</div>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">
                  {taskStats.completedTasks}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">已完成</div>
              </div>
            </div>
          </div>

          {/* 成就徽章 */}
          <div>
            <h4 className="font-semibold text-sm text-gray-700 dark:text-gray-300 mb-3">成就徽章</h4>
            <div className="flex flex-wrap gap-2">
              {taskStats.completedTasks >= 1 && (
                <Badge variant="success" className="flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  新手
                </Badge>
              )}
              {taskStats.completedTasks >= 5 && (
                <Badge variant="primary" className="flex items-center gap-1">
                  <Star className="w-3 h-3" />
                  达人
                </Badge>
              )}
              {taskStats.totalPoints >= 1000 && (
                <Badge variant="warning" className="flex items-center gap-1">
                  <DashJ size="sm" />
                  积分达人
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}

      <ModalFooter>
        <Button variant="secondary" onClick={onClose}>
          关闭
        </Button>
        <Button variant="primary" onClick={() => window.open('/profile', '_blank')}>
          查看完整资料
        </Button>
      </ModalFooter>
    </UnifiedModal>
  )
}

export default ProfileModal
