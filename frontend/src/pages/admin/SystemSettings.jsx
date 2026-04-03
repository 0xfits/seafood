import React, { useState, useEffect } from 'react'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Settings, Save, RefreshCw, Database, Globe, Shield } from 'lucide-react'

const SystemSettings = () => {
  const [settings, setSettings] = useState({
    siteName: 'Jinli Club',
    siteDescription: '去中心化社区奖励平台',
    maintenance: false,
    allowRegistration: true,
    emailNotifications: true,
    defaultLanguage: 'zh',
    pointsPerTask: 100,
    maxDailyTasks: 10,
    rewardCooldown: 24
  })

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      // 模拟加载设置
      console.log('Loading system settings...')
    } catch (error) {
      console.error('Error loading settings:', error)
    }
  }

  const saveSettings = async () => {
    setLoading(true)
    try {
      // 模拟保存设置
      console.log('Saving settings:', settings)
      alert('设置已保存')
    } catch (error) {
      console.error('Error saving settings:', error)
      alert('保存失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">系统设置</h2>
        <div className="flex gap-2">
          <Button variant="secondary">
            <RefreshCw className="w-4 h-4 mr-2" />
            重置
          </Button>
          <Button variant="primary" onClick={saveSettings} disabled={loading}>
            <Save className="w-4 h-4 mr-2" />
            {loading ? '保存中...' : '保存设置'}
          </Button>
        </div>
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
                onChange={(e) => handleSettingChange('pointsPerTask', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">每日最大任务数</label>
              <input
                type="number"
                value={settings.maxDailyTasks}
                onChange={(e) => handleSettingChange('maxDailyTasks', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">奖励冷却时间(小时)</label>
              <input
                type="number"
                value={settings.rewardCooldown}
                onChange={(e) => handleSettingChange('rewardCooldown', parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default SystemSettings
