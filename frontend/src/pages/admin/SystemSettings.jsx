import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Settings, Save, RefreshCw, Database, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'

const DEFAULT_SETTINGS = {
  siteName: 'Jinli Club',
  siteDescription: '去中心化社区奖励平台',
  maintenance: false,
  allowRegistration: true,
  emailNotifications: true,
  defaultLanguage: 'zh',
  pointsPerTask: 100,
  maxDailyTasks: 10,
  rewardCooldown: 24,
}

const SystemSettings = () => {
  const navigate = useNavigate()
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS)
  const [initialLoading, setInitialLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [access, setAccess] = useState({ is_admin: false, permissions: [], can_access_admin: false })

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setInitialLoading(true)
      const currentUser = getStoredUser()
      if (!currentUser) {
        throw new Error('未登录')
      }

      const accessInfo = await fetchAdminAccess(currentUser)
      if (!accessInfo.can_access_admin) {
        throw new Error('当前账号没有后台访问权限')
      }

      setAccess(accessInfo)
      const data = await fetchApiJson('/api/admin/settings', {
        headers: getAuthHeaders(currentUser),
      })

      const normalized = {
        ...DEFAULT_SETTINGS,
        ...data,
      }
      setSettings(normalized)
      setSavedSettings(normalized)
    } catch (error) {
      console.error('Error loading settings:', error)
      toast.error(`加载系统设置失败: ${error.message}`)
    } finally {
      setInitialLoading(false)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      const currentUser = getStoredUser()
      const headers = {
        ...getAuthHeaders(currentUser),
        'Content-Type': 'application/json',
      }
      if (!headers.Authorization) {
        toast.error('登录状态已失效，请重新登录')
        navigate('/login')
        return
      }

      const normalized = {
        ...settings,
        pointsPerTask: Number(settings.pointsPerTask) || 0,
        maxDailyTasks: Number(settings.maxDailyTasks) || 0,
        rewardCooldown: Number(settings.rewardCooldown) || 0,
      }

      const saved = await fetchApiJson('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(normalized),
      })

      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...saved,
      }
      setSettings(nextSettings)
      setSavedSettings(nextSettings)
      toast.success('设置已保存')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(`保存失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const resetSettings = async () => {
    const currentUser = getStoredUser()
    const headers = {
      ...getAuthHeaders(currentUser),
      'Content-Type': 'application/json',
    }
    if (!headers.Authorization) {
      toast.error('登录状态已失效，请重新登录')
      navigate('/login')
      return
    }

    const confirmed = window.confirm('确认将系统设置重置为默认值？')
    if (!confirmed) return

    setRefreshing(true)
    try {
      const reset = await fetchApiJson('/api/admin/settings/reset', {
        method: 'POST',
        headers,
      })
      const nextSettings = {
        ...DEFAULT_SETTINGS,
        ...reset,
      }
      setSettings(nextSettings)
      setSavedSettings(nextSettings)
      toast.success('系统设置已重置')
    } catch (error) {
      console.error('Error resetting settings:', error)
      toast.error(`重置失败: ${error.message}`)
    } finally {
      setRefreshing(false)
    }
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(savedSettings)
  const canManageSettings = hasAdminPermission(access, 'manage_settings')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">系统设置</h2>
          <p className="text-sm text-gray-600 mt-1">
            当前页面使用持久化后台设置状态，支持读取、保存和重置默认值。
            {!canManageSettings && ' 当前账号为只读模式。'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={resetSettings} disabled={refreshing || loading || !canManageSettings}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {refreshing ? '重置中...' : '重置'}
          </Button>
          <Button variant="primary" onClick={saveSettings} disabled={loading || !hasChanges || !canManageSettings}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? '保存中...' : '保存设置'}
          </Button>
        </div>
      </div>

      {initialLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">加载中...</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-gray-600">
            {hasChanges ? '存在未保存修改。' : '当前内容与已保存设置一致。'}
          </div>

          <div className="grid gap-6">
        {/* 基本设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              基本设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">网站名称</label>
              <input
                type="text"
                value={settings.siteName}
                onChange={(e) => handleSettingChange('siteName', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">网站描述</label>
              <textarea
                value={settings.siteDescription}
                onChange={(e) => handleSettingChange('siteDescription', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">默认语言</label>
              <select
                value={settings.defaultLanguage}
                onChange={(e) => handleSettingChange('defaultLanguage', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
                <option value="hk">繁體中文</option>
                <option value="vn">Tiếng Việt</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* 系统设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              系统设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">维护模式</h4>
                <p className="text-sm text-gray-600">启用后用户无法访问网站</p>
              </div>
              <input
                type="checkbox"
                checked={settings.maintenance}
                onChange={(e) => handleSettingChange('maintenance', e.target.checked)}
                className="w-4 h-4"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">允许注册</h4>
                <p className="text-sm text-gray-600">新用户可以注册账号</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowRegistration}
                onChange={(e) => handleSettingChange('allowRegistration', e.target.checked)}
                className="w-4 h-4"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">邮件通知</h4>
                <p className="text-sm text-gray-600">发送系统邮件通知</p>
              </div>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => handleSettingChange('emailNotifications', e.target.checked)}
                className="w-4 h-4"
              />
            </div>
          </CardContent>
        </Card>

        {/* 积分设置 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              积分设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">默认任务积分</label>
              <input
                type="number"
                value={settings.pointsPerTask}
                onChange={(e) => handleSettingChange('pointsPerTask', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">每日最大任务数</label>
              <input
                type="number"
                value={settings.maxDailyTasks}
                onChange={(e) => handleSettingChange('maxDailyTasks', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">奖励冷却时间(小时)</label>
              <input
                type="number"
                value={settings.rewardCooldown}
                onChange={(e) => handleSettingChange('rewardCooldown', Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>
          </div>
        </>
      )}
    </div>
  )
}

export default SystemSettings
