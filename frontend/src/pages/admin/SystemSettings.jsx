import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Card, CardHeader, CardTitle, CardContent } from '../../components/ui'
import { Settings, Save, RefreshCw, Database, Globe } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'
import { adminOpsKey } from '../../idempotency'

const DEFAULT_SETTINGS = {
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

      // §2.4 **S1** / §9.B **B1**（DL36）：`POST /api/admin/settings` 现为**请求侧强校验** ——
      //   无 `ops:` 前缀的幂等键 ⇒ `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`
      //   （真源 = `backend-ts/src/admin-service.ts:63-72`；前缀硬闸 `:76-78`）。
      //   键形态 = §4.5 的 `ops:<admin_uid>:<action>:<key>`（服务端**只校验前缀、不落库** ⇒ 形状契约，
      //   非重放机制；同一操作的键**确定性相同** ⇒ 重试不会引入新语义）。
      const saved = await fetchApiJson('/api/admin/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          ...normalized,
          create_key: adminOpsKey(currentUser?.uID, 'setting', 'system_settings'),
        }),
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

  // ── 弃用面下线（P4-B4b-i · §2.4 **S5** / §5.1「一键重置设置」行；C3 ② 终审「删除」）───────
  // 原 `resetSettings`（`POST /api/admin/settings/reset`，原 `:123`）已由后端落为 **`410` + `R107` +
  // `details.sunset`**（无 token 亦 `410`，**不伪装 401**）⇒ 前端**零调用**（判据 = §9.B B5）；
  // 该端点 = 「无审计的批量破坏写」⇒ 处置 = **删按钮 + 删调用**（逐项改走 `POST /api/admin/settings`，
  // 每条一键 + 一条留痕）。

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
            当前页面使用持久化后台设置状态，支持读取与保存
            （保存按 §2.4 S1/DL36 带 `ops:` 幂等键）；「重置为默认值」入口已下线（§5.1 = `410`）。
            {!canManageSettings && ' 当前账号为只读模式。'}
          </p>
        </div>
        <div className="flex gap-2">
          {/* §2.4 S5：`POST /api/admin/settings/reset` 已 410 ⇒ 「重置」按钮删除（页面只读化+逐项保存） */}
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
