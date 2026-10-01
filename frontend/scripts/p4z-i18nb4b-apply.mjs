#!/usr/bin/env node
/**
 * P6-I18N-LIT-B4b · 后台剩余 5 面四语化「逐条锚点替换」执行器 + 四语 locale 增量写入
 *
 * 口径（§5.7 ②）：每段替换先断言命中数，命中数不符 ⇒ 立即报错退出（不静默）；逐文件落盘。
 * 用法：node scripts/p4z-i18nb4b-apply.mjs            （写盘）
 *       node scripts/p4z-i18nb4b-apply.mjs --dry       （只校验锚点，不写盘）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const DRY = process.argv.includes('--dry')

const L = (...lines) => lines.join('\n')
const edits = []
const E = (f, old, neu, n = 1) => edits.push({ f, old, neu, n })

// ─────────────────────────── PermissionsManagement.jsx ───────────────────────────
const PERM = 'pages/admin/PermissionsManagement.jsx'
E(PERM,
  L("import { useNavigate } from 'react-router-dom'"),
  L("import { useNavigate } from 'react-router-dom'", "import { useTranslation } from 'react-i18next'"))
E(PERM,
  L('const PermissionsManagement = () => {', '  const navigate = useNavigate()'),
  L('const PermissionsManagement = () => {', '  const { t } = useTranslation()', '  const navigate = useNavigate()'))
E(PERM, L("        throw new Error('未登录')"), L("        throw new Error(t('adminCommon.notLoggedIn'))"))
E(PERM, L("        throw new Error('当前账号没有后台访问权限')"), L("        throw new Error(t('adminCommon.noAdminAccess'))"))
E(PERM, L('      toast.error(`加载权限数据失败: ${error.message}`)'), L("      toast.error(t('adminPermissions.loadFailed', { message: error.message }))"))
E(PERM, L("      toast.error('登录状态已失效，请重新登录')"), L("      toast.error(t('adminCommon.sessionExpired'))"), 2)
E(PERM, L("      toast.error('权限组名称不能为空')"), L("      toast.error(t('adminPermissions.nameRequired'))"))
E(PERM, L("      toast.error('至少填写一个权限标识')"), L("      toast.error(t('adminPermissions.permissionsRequired'))"))
E(PERM, L("      toast.success(editingGroupId ? '权限组已更新' : '权限组已创建')"),
  L("      toast.success(editingGroupId ? t('adminPermissions.updated') : t('adminPermissions.created'))"))
E(PERM, L('      toast.error(`保存权限组失败: ${error.message}`)'), L("      toast.error(t('adminPermissions.saveFailed', { message: error.message }))"))
E(PERM, L("    const confirmed = window.confirm(`确认删除权限组“${group.name}”？`)"),
  L("    const confirmed = window.confirm(t('adminPermissions.confirmDelete', { name: group.name }))"))
E(PERM, L("      toast.success('权限组已删除')"), L("      toast.success(t('adminPermissions.deleted'))"))
E(PERM, L('      toast.error(`删除权限组失败: ${error.message}`)'), L("      toast.error(t('adminPermissions.deleteFailed', { message: error.message }))"))
E(PERM, L('          <h2 className="text-2xl font-bold">权限管理</h2>'), L('          <h2 className="text-2xl font-bold">{t(\'adminNav.permissions\')}</h2>'))
E(PERM,
  L('            “管理员访问”组映射完整后台权限；“任务发布组”和“奖品发布组”可单独分配发布能力。',
    "            {!canManagePermissions && ' 当前账号为只读模式。'}"),
  L("            {t('adminPermissions.intro')}",
    "            {!canManagePermissions && ` ${t('adminCommon.readOnlyNotice')}`}"))
E(PERM, L("            {refreshing ? '刷新中...' : '刷新'}"),
  L("            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refresh')}"))
E(PERM, L('            <Plus className="w-4 h-4 mr-2" />', '            添加权限组'),
  L('            <Plus className="w-4 h-4 mr-2" />', "            {t('adminPermissions.addGroup')}"))
E(PERM, L('          <p className="mt-2 text-gray-600">加载中...</p>'), L('          <p className="mt-2 text-gray-600">{t(\'adminCommon.loading\')}</p>'))
E(PERM, L('                          <Lock className="w-3 h-3" />', '                          只读'),
  L('                          <Lock className="w-3 h-3" />', "                          {t('adminPermissions.readOnly')}"))
E(PERM, L('                        <Badge variant="secondary" size="sm">可编辑</Badge>'),
  L('                        <Badge variant="secondary" size="sm">{t(\'adminPermissions.editable\')}</Badge>'))
E(PERM, L("                    <p className=\"text-sm text-gray-600 mt-1\">{group.description || '暂无描述'}</p>"),
  L("                    <p className=\"text-sm text-gray-600 mt-1\">{group.description || t('adminCommon.noDescription')}</p>"))
E(PERM, L('                        {group.user_ids?.length || 0} 个用户'),
  L("                        {t('adminPermissions.userCount', { count: group.user_ids?.length || 0 })}"))
E(PERM, L('                          <span className="text-xs text-gray-400">暂无分配成员</span>'),
  L('                          <span className="text-xs text-gray-400">{t(\'adminPermissions.noMembers\')}</span>'))
E(PERM, L("                      title={!canManagePermissions ? '当前账号没有 manage_permissions 权限' : group.readonly ? '系统权限组不可编辑' : '编辑权限组'}"),
  L("                      title={!canManagePermissions ? t('adminPermissions.tipNoManagePermission') : group.readonly ? t('adminPermissions.tipReadonlyEdit') : t('adminPermissions.tipEdit')}"))
E(PERM, L("                      title={!canManagePermissions ? '当前账号没有 manage_permissions 权限' : group.readonly ? '系统权限组不可删除' : '删除权限组'}"),
  L("                      title={!canManagePermissions ? t('adminPermissions.tipNoManagePermission') : group.readonly ? t('adminPermissions.tipReadonlyDelete') : t('adminPermissions.tipDelete')}"))
E(PERM, L("          <ModalTitle>{editingGroupId ? '编辑权限组' : '添加权限组'}</ModalTitle>"),
  L("          <ModalTitle>{editingGroupId ? t('adminPermissions.editGroup') : t('adminPermissions.addGroup')}</ModalTitle>"))
E(PERM, L('            <label className="block text-sm font-medium mb-2">名称</label>'), L('            <label className="block text-sm font-medium mb-2">{t(\'adminPermissions.labelName\')}</label>'))
E(PERM, L('              placeholder="例如：内容审核组"'), L("              placeholder={t('adminPermissions.namePlaceholder')}"))
E(PERM, L('            <label className="block text-sm font-medium mb-2">描述</label>'), L('            <label className="block text-sm font-medium mb-2">{t(\'adminPermissions.labelDescription\')}</label>'))
E(PERM, L('              placeholder="说明这组权限负责什么。"'), L("              placeholder={t('adminPermissions.descPlaceholder')}"))
E(PERM, L('            <label className="block text-sm font-medium mb-2">权限标识</label>'), L('            <label className="block text-sm font-medium mb-2">{t(\'adminPermissions.labelPermissions\')}</label>'))
E(PERM, L('              placeholder="逗号分隔，例如：review_tasks, publish_prizes"'), L("              placeholder={t('adminPermissions.permissionsPlaceholder')}"))
E(PERM, L('            <label className="block text-sm font-medium mb-2">分配成员</label>'), L('            <label className="block text-sm font-medium mb-2">{t(\'adminPermissions.labelMembers\')}</label>'))
E(PERM, L('            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>', '              取消'),
  L('            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>', "              {t('cancel')}"))
E(PERM, L("              {saving ? '保存中...' : '保存权限组'}"),
  L("              {saving ? t('adminCommon.saving') : t('adminPermissions.saveGroup')}"))

// ─────────────────────────── PointsManagement.jsx ───────────────────────────
const PTS = 'pages/admin/PointsManagement.jsx'
E(PTS, L("import { useNavigate, useSearchParams } from 'react-router-dom'"),
  L("import { useNavigate, useSearchParams } from 'react-router-dom'", "import { useTranslation } from 'react-i18next'"))
E(PTS, L('const formatDateTime = (value) => {', "  if (!value) return '从未更新'"),
  L('const formatDateTime = (value, t) => {', "  if (!value) return t('adminPoints.neverUpdated')"))
E(PTS, L("  return Number.isNaN(date.getTime()) ? '从未更新' : date.toLocaleString()"),
  L("  return Number.isNaN(date.getTime()) ? t('adminPoints.neverUpdated') : date.toLocaleString()"))
E(PTS, L('const PointsManagement = () => {', '  const navigate = useNavigate()'),
  L('const PointsManagement = () => {', '  const { t } = useTranslation()', '  const navigate = useNavigate()'))
E(PTS, L("        throw new Error('未登录')"), L("        throw new Error(t('adminCommon.notLoggedIn'))"))
E(PTS, L("        throw new Error('当前账号没有后台访问权限')"), L("        throw new Error(t('adminCommon.noAdminAccess'))"))
E(PTS, L('      toast.error(`加载用户积分失败: ${error.message}`)'), L("      toast.error(t('adminPoints.loadFailed', { message: error.message }))"))
E(PTS, L("      toast.error('请填写完整的调整信息')"), L("      toast.error(t('adminPoints.invalidForm'))"))
E(PTS, L("      toast.error('请输入有效的积分数额')"), L("      toast.error(t('adminPoints.invalidAmount'))"))
E(PTS, L("      toast.error('登录状态已失效，请重新登录')"), L("      toast.error(t('adminCommon.sessionExpired'))"))
E(PTS, L("      toast.success(`成功为用户 #${selectedUser.uID}${adjustType === 'add' ? '增加' : '减少'} ${amount} 积分`)"),
  L("      toast.success(t(adjustType === 'add' ? 'adminPoints.adjustSuccessAdd' : 'adminPoints.adjustSuccessSubtract', { id: selectedUser.uID, amount }))"))
E(PTS, L('      toast.error(`积分调整失败: ${error.message}`)'), L("      toast.error(t('adminPoints.adjustFailed', { message: error.message }))"))
E(PTS, L('                <p className="text-sm text-gray-600">总用户数</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminCommon.statUsers\')}</p>'))
E(PTS, L('                <p className="text-sm text-gray-600">总积分</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminCommon.statTotalPoints\')}</p>'))
E(PTS, L('                <p className="text-sm text-gray-600">平均积分</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminPoints.statAvg\')}</p>'))
E(PTS, L('                <p className="text-sm text-gray-600">零积分用户</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminPoints.statZero\')}</p>'))
E(PTS, L('          <h2 className="text-2xl font-bold">用户积分管理</h2>'), L('          <h2 className="text-2xl font-bold">{t(\'adminPoints.title\')}</h2>'))
E(PTS, L('            当前页面使用真实用户和资产积分数据，', "            {canManagePoints ? '你可以执行积分调整。' : '当前账号为只读模式。'}"),
  L("            {t('adminPoints.intro')}", "            {canManagePoints ? t('adminPoints.introManage') : t('adminCommon.readOnlyNotice')}"))
E(PTS, L('              placeholder="搜索用户地址或ID..."'), L("              placeholder={t('adminPoints.searchPlaceholder')}"))
E(PTS, L("            {refreshing ? '刷新中...' : '刷新数据'}"), L("            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refreshData')}"))
E(PTS, L('          <p className="mt-2 text-gray-600">加载中...</p>'), L('          <p className="mt-2 text-gray-600">{t(\'adminCommon.loading\')}</p>'))
E(PTS, L('                    用户ID', '                  </th>'), L('                    {t(\'adminCommon.colUserId\')}', '                  </th>'))
E(PTS, L('                    钱包地址', '                  </th>'), L('                    {t(\'adminCommon.colWallet\')}', '                  </th>'))
E(PTS, L('                    当前积分', '                  </th>'), L('                    {t(\'adminCommon.colPoints\')}', '                  </th>'))
E(PTS, L('                    最后更新', '                  </th>'), L('                    {t(\'adminCommon.colUpdated\')}', '                  </th>'))
E(PTS, L('                    角色', '                  </th>'), L('                    {t(\'adminCommon.colRole\')}', '                  </th>'))
E(PTS, L('                    操作', '                  </th>'), L('                    {t(\'adminCommon.colActions\')}', '                  </th>'))
E(PTS, L('                        <span className="ml-2 text-sm text-gray-500">积分</span>'), L('                        <span className="ml-2 text-sm text-gray-500">{t(\'common.points\')}</span>'))
E(PTS, L("                        {user.is_admin ? '管理员' : '普通用户'}"),
  L("                        {user.is_admin ? t('adminCommon.adminRole') : t('adminCommon.normalUser')}"))
E(PTS, L('                      {formatDateTime(user.asset_updated_at)}'), L('                      {formatDateTime(user.asset_updated_at, t)}'))
E(PTS, L("                          title={canManagePoints ? '增加积分' : '当前账号没有 manage_points 权限'}"),
  L("                          title={canManagePoints ? t('adminPoints.addPoints') : t('adminPoints.tipNoManagePermission')}"))
E(PTS, L("                          title={canManagePoints ? '减少积分' : '当前账号没有 manage_points 权限'}"),
  L("                          title={canManagePoints ? t('adminPoints.subtractPoints') : t('adminPoints.tipNoManagePermission')}"))
E(PTS, L('              <p className="text-gray-500">没有找到匹配的用户</p>'), L('              <p className="text-gray-500">{t(\'adminCommon.noMatchingUsers\')}</p>'))
E(PTS, L("          <ModalTitle>{`${adjustType === 'add' ? '增加' : '减少'}积分`}</ModalTitle>"),
  L("          <ModalTitle>{t(adjustType === 'add' ? 'adminPoints.addPoints' : 'adminPoints.subtractPoints')}</ModalTitle>"))
E(PTS, L('                操作用户: <span className="font-medium">#{selectedUser.uID}</span>'),
  L("                {t('adminPoints.targetUser')} <span className=\"font-medium\">#{selectedUser.uID}</span>"))
E(PTS, L('                钱包地址:'), L("                {t('adminPoints.wallet')}"))
E(PTS, L('                当前积分: <span className="font-bold">{selectedUser.points || 0}</span>'),
  L("                {t('adminPoints.currentPoints')} <span className=\"font-bold\">{selectedUser.points || 0}</span>"))
E(PTS, L("              {adjustType === 'add' ? '增加' : '减少'}积分数额"),
  L("              {t(adjustType === 'add' ? 'adminPoints.amountLabelAdd' : 'adminPoints.amountLabelSubtract')}"))
E(PTS, L('              placeholder="请输入积分数额"'), L("              placeholder={t('adminPoints.amountPlaceholder')}"))
E(PTS, L('              调整原因'), L("              {t('adminPoints.reasonLabel')}"))
E(PTS, L('              placeholder="请输入调整原因..."'), L("              placeholder={t('adminPoints.reasonPlaceholder')}"))
E(PTS, L('            >', '              取消', '            </Button>'), L('            >', "              {t('cancel')}", '            </Button>'))
E(PTS, L("              {adjusting ? '处理中...' : `确认${adjustType === 'add' ? '增加' : '减少'}`}"),
  L("              {adjusting ? t('adminPoints.processing') : t(adjustType === 'add' ? 'adminPoints.confirmAdd' : 'adminPoints.confirmSubtract')}"))

// ─────────────────────────── ShardsManagement.jsx ───────────────────────────
const SHD = 'pages/admin/ShardsManagement.jsx'
E(SHD, L("import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'"),
  L("import { useTranslation } from 'react-i18next'", "import { fetchAdminAccess, fetchApiJson, getAuthHeaders, getStoredUser, hasAdminPermission } from '../../admin-utils'"))
E(SHD, L('const ShardsManagement = () => {', '  const [access, setAccess]'),
  L('const ShardsManagement = () => {', '  const { t } = useTranslation()', '  const [access, setAccess]'))
E(SHD, L('      toast.error(`加载失败: ${error.message}`)'), L("      toast.error(t('adminShards.loadFailed', { message: error.message }))"))
E(SHD, L('    return <div className="flex items-center justify-center h-64 text-gray-500">加载中...</div>'),
  L('    return <div className="flex items-center justify-center h-64 text-gray-500">{t(\'adminCommon.loading\')}</div>'))
E(SHD, L('          权限不足，需要 `manage_rewards` 或 `publish_prizes` 权限'), L("          {t('adminShards.noPermission')}"))
E(SHD, L('      <span className="text-sm text-gray-600">奖品:</span>'), L('      <span className="text-sm text-gray-600">{t(\'adminShards.prizeLabel\')}</span>'))
E(SHD, L('        <h2 className="text-xl font-semibold text-gray-800">碎片管理</h2>'), L('        <h2 className="text-xl font-semibold text-gray-800">{t(\'adminNav.shards\')}</h2>'))
E(SHD, L("          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />", '          刷新'),
  L("          <RefreshCw className={`w-4 h-4 mr-1 ${refreshing ? 'animate-spin' : ''}`} />", "          {t('adminCommon.refresh')}"))
E(SHD, L('          <TabsTrigger value="holdings">持仓总览</TabsTrigger>'), L('          <TabsTrigger value="holdings">{t(\'adminShards.tabHoldings\')}</TabsTrigger>'))
E(SHD, L('          <TabsTrigger value="orders">挂单管理</TabsTrigger>'), L('          <TabsTrigger value="orders">{t(\'adminShards.tabOrders\')}</TabsTrigger>'))
E(SHD, L('          <TabsTrigger value="trades">成交记录</TabsTrigger>'), L('          <TabsTrigger value="trades">{t(\'adminShards.tabTrades\')}</TabsTrigger>'))
E(SHD, L('                用户个人持仓可通过 <code className="bg-gray-100 px-1 rounded">/api/shard</code> 查询（需认证）。暂无管理员聚合接口，各用户持仓请通过奖品维度订单簿和成交记录推断。'),
  L("                {t('adminShards.holdingsNote')}"))
E(SHD, L('                      <th className="py-2 pr-4">奖品</th>'), L('                      <th className="py-2 pr-4">{t(\'adminShards.thPrize\')}</th>'))
E(SHD, L('                      <th className="py-2">库存奖品数</th>'), L('                      <th className="py-2">{t(\'adminShards.thStoresCount\')}</th>'))
E(SHD, L('                <h3 className="font-medium text-green-700 mb-3">买单 (Buy)</h3>'), L('                <h3 className="font-medium text-green-700 mb-3">{t(\'adminShards.buyTitle\')}</h3>'))
E(SHD, L('                <h3 className="font-medium text-red-700 mb-3">卖单 (Sell)</h3>'), L('                <h3 className="font-medium text-red-700 mb-3">{t(\'adminShards.sellTitle\')}</h3>'))
E(SHD, L('                  <p className="text-sm text-gray-400 text-center py-4">暂无挂单</p>'),
  L('                  <p className="text-sm text-gray-400 text-center py-4">{t(\'adminShards.noOrders\')}</p>'), 2)
E(SHD, L('                        <th className="pb-2">价格</th>'), L('                        <th className="pb-2">{t(\'adminShards.thPrice\')}</th>'), 2)
E(SHD, L('                        <th className="pb-2">剩余量</th>'), L('                        <th className="pb-2">{t(\'adminShards.thVolume\')}</th>'), 2)
E(SHD, L('                <p className="text-sm text-gray-400 text-center py-8">暂无成交记录</p>'),
  L('                <p className="text-sm text-gray-400 text-center py-8">{t(\'adminShards.noTrades\')}</p>'))
E(SHD, L('                      <th className="py-2 pr-4">价格</th>'), L('                      <th className="py-2 pr-4">{t(\'adminShards.thPrice\')}</th>'))
E(SHD, L('                      <th className="py-2 pr-4">数量</th>'), L('                      <th className="py-2 pr-4">{t(\'adminShards.thQty\')}</th>'))
E(SHD, L('                      <th className="py-2 pr-4">买方</th>'), L('                      <th className="py-2 pr-4">{t(\'adminShards.thBuyer\')}</th>'))
E(SHD, L('                      <th className="py-2 pr-4">卖方</th>'), L('                      <th className="py-2 pr-4">{t(\'adminShards.thSeller\')}</th>'))
E(SHD, L('                      <th className="py-2">时间</th>'), L('                      <th className="py-2">{t(\'adminShards.thTime\')}</th>'))

// ─────────────────────────── SystemSettings.jsx ───────────────────────────
const SET = 'pages/admin/SystemSettings.jsx'
E(SET, L("import { useNavigate } from 'react-router-dom'"),
  L("import { useNavigate } from 'react-router-dom'", "import { useTranslation } from 'react-i18next'"))
E(SET, L('const DEFAULT_SETTINGS = {', "  siteDescription: '去中心化社区奖励平台',"),
  L('const DEFAULT_SETTINGS = {', "  siteDescription: '',"))
E(SET, L('const SystemSettings = () => {', '  const navigate = useNavigate()',
  '  const [settings, setSettings] = useState(DEFAULT_SETTINGS)', '  const [savedSettings, setSavedSettings] = useState(DEFAULT_SETTINGS)'),
  L('const SystemSettings = () => {', '  const { t } = useTranslation()', '  const navigate = useNavigate()',
    "  const defaults = { ...DEFAULT_SETTINGS, siteDescription: t('adminSettings.siteDescription') }",
    '  const [settings, setSettings] = useState(() => ({ ...defaults }))',
    '  const [savedSettings, setSavedSettings] = useState(() => ({ ...defaults }))'))
E(SET, L("        throw new Error('未登录')"), L("        throw new Error(t('adminCommon.notLoggedIn'))"))
E(SET, L("        throw new Error('当前账号没有后台访问权限')"), L("        throw new Error(t('adminCommon.noAdminAccess'))"))
E(SET, L('      toast.error(`加载系统设置失败: ${error.message}`)'), L("      toast.error(t('adminSettings.loadFailed', { message: error.message }))"))
E(SET, L('      const normalized = {', '        ...DEFAULT_SETTINGS,', '        ...data,'),
  L('      const normalized = {', '        ...defaults,', '        ...data,'))
E(SET, L("        toast.error('登录状态已失效，请重新登录')"), L("        toast.error(t('adminCommon.sessionExpired'))"))
E(SET, L('      const nextSettings = {', '        ...DEFAULT_SETTINGS,', '        ...saved,'),
  L('      const nextSettings = {', '        ...defaults,', '        ...saved,'))
E(SET, L("      toast.success('设置已保存')"), L("      toast.success(t('adminSettings.saved'))"))
E(SET, L('      toast.error(`保存失败: ${error.message}`)'), L("      toast.error(t('adminSettings.saveFailed', { message: error.message }))"))
E(SET, L('          <h2 className="text-2xl font-bold">系统设置</h2>'), L('          <h2 className="text-2xl font-bold">{t(\'adminNav.settings\')}</h2>'))
E(SET, L('            当前页面使用持久化后台设置状态，支持读取与保存',
  '            （保存按 §2.4 S1/DL36 带 `ops:` 幂等键）；「重置为默认值」入口已下线（§5.1 = `410`）。',
  "            {!canManageSettings && ' 当前账号为只读模式。'}"),
  L("            {t('adminSettings.intro')}", "            {!canManageSettings && ` ${t('adminCommon.readOnlyNotice')}`}"))
E(SET, L("            {loading ? '保存中...' : '保存设置'}"),
  L("            {loading ? t('adminCommon.saving') : t('adminSettings.saveButton')}"))
E(SET, L('          <p className="mt-2 text-gray-600">加载中...</p>'), L('          <p className="mt-2 text-gray-600">{t(\'adminCommon.loading\')}</p>'))
E(SET, L("            {hasChanges ? '存在未保存修改。' : '当前内容与已保存设置一致。'}"),
  L("            {hasChanges ? t('adminSettings.unsavedChanges') : t('adminSettings.noChanges')}"))
E(SET, L('              基本设置'), L("              {t('adminSettings.cardBasic')}"))
E(SET, L('              <label className="block text-sm font-medium mb-2">网站描述</label>'), L('              <label className="block text-sm font-medium mb-2">{t(\'adminSettings.labelSiteDescription\')}</label>'))
E(SET, L('              <label className="block text-sm font-medium mb-2">默认语言</label>'), L('              <label className="block text-sm font-medium mb-2">{t(\'adminSettings.labelDefaultLanguage\')}</label>'))
E(SET, L('                <option value="zh">中文</option>'), L('                <option value="zh">{t(\'adminSettings.langZh\')}</option>'))
E(SET, L('                <option value="hk">繁體中文</option>'), L('                <option value="hk">{t(\'adminSettings.langHk\')}</option>'))
E(SET, L('                <option value="vn">Tiếng Việt</option>'), L('                <option value="vn">{t(\'adminSettings.langVn\')}</option>'))
E(SET, L('              系统设置', '            </CardTitle>'), L("              {t('adminNav.settings')}", '            </CardTitle>'))
E(SET, L('                <h4 className="font-medium">维护模式</h4>'), L('                <h4 className="font-medium">{t(\'adminSettings.maintenance\')}</h4>'))
E(SET, L('                <p className="text-sm text-gray-600">启用后用户无法访问网站</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminSettings.maintenanceDesc\')}</p>'))
E(SET, L('                <h4 className="font-medium">允许注册</h4>'), L('                <h4 className="font-medium">{t(\'adminSettings.allowRegistration\')}</h4>'))
E(SET, L('                <p className="text-sm text-gray-600">新用户可以注册账号</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminSettings.allowRegistrationDesc\')}</p>'))
E(SET, L('                <h4 className="font-medium">邮件通知</h4>'), L('                <h4 className="font-medium">{t(\'adminSettings.emailNotifications\')}</h4>'))
E(SET, L('                <p className="text-sm text-gray-600">发送系统邮件通知</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminSettings.emailNotificationsDesc\')}</p>'))
E(SET, L('              积分设置'), L("              {t('adminSettings.cardPoints')}"))
E(SET, L('              <label className="block text-sm font-medium mb-2">默认任务积分</label>'), L('              <label className="block text-sm font-medium mb-2">{t(\'adminSettings.labelPointsPerTask\')}</label>'))
E(SET, L('              <label className="block text-sm font-medium mb-2">每日最大任务数</label>'), L('              <label className="block text-sm font-medium mb-2">{t(\'adminSettings.labelMaxDailyTasks\')}</label>'))
E(SET, L('              <label className="block text-sm font-medium mb-2">奖励冷却时间(小时)</label>'), L('              <label className="block text-sm font-medium mb-2">{t(\'adminSettings.labelRewardCooldown\')}</label>'))

// ─────────────────────────── UsersManagement.jsx ───────────────────────────
const USR = 'pages/admin/UsersManagement.jsx'
E(USR, L("import { useNavigate } from 'react-router-dom'"),
  L("import { useNavigate } from 'react-router-dom'", "import { useTranslation } from 'react-i18next'"))
E(USR, L('const formatDateTime = (value) => {', "  if (!value) return '未知'"),
  L('const formatDateTime = (value, t) => {', "  if (!value) return t('unknown')"))
E(USR, L("  return Number.isNaN(date.getTime()) ? '未知' : date.toLocaleString()"),
  L("  return Number.isNaN(date.getTime()) ? t('unknown') : date.toLocaleString()"))
E(USR, L('const UsersManagement = () => {', '  const navigate = useNavigate()'),
  L('const UsersManagement = () => {', '  const { t } = useTranslation()', '  const navigate = useNavigate()'))
E(USR, L("        throw new Error('未登录')"), L("        throw new Error(t('adminCommon.notLoggedIn'))"))
E(USR, L("        throw new Error('当前账号没有后台访问权限')"), L("        throw new Error(t('adminCommon.noAdminAccess'))"))
E(USR, L('      toast.error(`加载用户数据失败: ${error.message}`)'), L("      toast.error(t('adminUsers.loadFailed', { message: error.message }))"))
E(USR, L("      toast.error('登录状态已失效，请重新登录')"), L("      toast.error(t('adminCommon.sessionExpired'))"))
E(USR, L('      nextAdmin', "        ? `确认将用户 #${user.uID} 提升为管理员？`", '        : `确认撤销用户 #${user.uID} 的管理员权限？`'),
  L('      nextAdmin', "        ? t('adminUsers.confirmGrant', { id: user.uID })", "        : t('adminUsers.confirmRevoke', { id: user.uID })"))
E(USR, L("      toast.success(nextAdmin ? '管理员权限已授予' : '管理员权限已撤销')"),
  L("      toast.success(nextAdmin ? t('adminUsers.grantSuccess') : t('adminUsers.revokeSuccess'))"))
E(USR, L('      toast.error(`更新用户失败: ${error.message}`)'), L("      toast.error(t('adminUsers.updateFailed', { message: error.message }))"))
E(USR, L('                <p className="text-sm text-gray-600">总用户数</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminCommon.statUsers\')}</p>'))
E(USR, L('                <p className="text-sm text-gray-600">管理员</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminCommon.adminRole\')}</p>'))
E(USR, L('                <p className="text-sm text-gray-600">有资产记录</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminUsers.statAssets\')}</p>'))
E(USR, L('                <p className="text-sm text-gray-600">总积分</p>'), L('                <p className="text-sm text-gray-600">{t(\'adminCommon.statTotalPoints\')}</p>'))
E(USR, L('          <h2 className="text-2xl font-bold">用户管理</h2>'), L('          <h2 className="text-2xl font-bold">{t(\'adminNav.users\')}</h2>'))
E(USR, L('            当前页面使用真实用户和积分资产数据。',
  "            {canManageUsers ? '你可以调整管理员权限。' : '当前账号为只读模式，可查看用户但不能修改管理员权限。'}"),
  L("            {t('adminUsers.intro')}", "            {canManageUsers ? t('adminUsers.introManage') : t('adminUsers.introReadOnly')}"))
E(USR, L('              placeholder="搜索用户ID、地址或简介..."'), L("              placeholder={t('adminUsers.searchPlaceholder')}"))
E(USR, L("            {refreshing ? '刷新中...' : '刷新数据'}"), L("            {refreshing ? t('adminCommon.refreshing') : t('adminCommon.refreshData')}"))
E(USR, L('          <p className="mt-2 text-gray-600">加载中...</p>'), L('          <p className="mt-2 text-gray-600">{t(\'adminCommon.loading\')}</p>'))
E(USR, L('                    用户ID', '                  </th>'), L('                    {t(\'adminCommon.colUserId\')}', '                  </th>'))
E(USR, L('                    钱包地址', '                  </th>'), L('                    {t(\'adminCommon.colWallet\')}', '                  </th>'))
E(USR, L('                    简介', '                  </th>'), L('                    {t(\'adminCommon.colBio\')}', '                  </th>'))
E(USR, L('                    积分', '                  </th>'), L('                    {t(\'common.points\')}', '                  </th>'))
E(USR, L('                    角色', '                  </th>'), L('                    {t(\'adminCommon.colRole\')}', '                  </th>'))
E(USR, L('                    注册时间', '                  </th>'), L('                    {t(\'adminCommon.colRegistered\')}', '                  </th>'))
E(USR, L('                    最近登录', '                  </th>'), L('                    {t(\'adminCommon.colLastLogin\')}', '                  </th>'))
E(USR, L('                    操作', '                  </th>'), L('                    {t(\'adminCommon.colActions\')}', '                  </th>'))
E(USR, L("                      {user.bio || '暂无简介'}"), L("                      {user.bio || t('adminUsers.noBio')}"))
E(USR, L("                        {user.is_admin ? '管理员' : '普通用户'}"),
  L("                        {user.is_admin ? t('adminCommon.adminRole') : t('adminCommon.normalUser')}"))
E(USR, L('                      {formatDateTime(user.time_reg)}'), L('                      {formatDateTime(user.time_reg, t)}'))
E(USR, L('                      {formatDateTime(user.time_login_last)}'), L('                      {formatDateTime(user.time_login_last, t)}'))
E(USR, L("                          title={!canManageUsers ? '当前账号没有 manage_users 权限' : user.is_admin ? '撤销管理员权限' : '授予管理员权限'}"),
  L("                          title={!canManageUsers ? t('adminUsers.tipNoManageUsers') : user.is_admin ? t('adminUsers.tipRevoke') : t('adminUsers.tipGrant')}"))
E(USR, L("                          title={canManagePoints ? '前往积分管理' : '当前账号没有 manage_points 权限'}"),
  L("                          title={canManagePoints ? t('adminUsers.tipGoPoints') : t('adminUsers.tipNoManagePoints')}"))
E(USR, L('              <p className="text-gray-500">没有找到匹配的用户</p>'), L('              <p className="text-gray-500">{t(\'adminCommon.noMatchingUsers\')}</p>'))

// ─────────────────────────── DashboardPage.jsx（必做① 分隔符）───────────────────────────
const DASH = 'pages/DashboardPage.jsx'
E(DASH, L("      toast.error(t('dashPage.partialLoadFailed', { list: errors.join('、') }))"),
  L("      toast.error(t('dashPage.partialLoadFailed', { list: errors.join(t('common.listSeparator')) }))"))

// ─────────────────────────── 执行 ───────────────────────────
let ok = 0
const byFile = new Map()
for (const e of edits) {
  byFile.set(e.f, [...(byFile.get(e.f) || []), e])
}
for (const [rel, list] of byFile) {
  const abs = path.join(SRC, rel)
  let text = fs.readFileSync(abs, 'utf8')
  let changed = 0
  for (const [i, e] of list.entries()) {
    const hit = text.split(e.old).length - 1
    if (hit !== e.n) {
      console.error(`✗ ${rel} #${i + 1}: 期望命中 ${e.n}，实际 ${hit}\n    锚点: ${JSON.stringify(e.old).slice(0, 160)}`)
      process.exit(1)
    }
    text = text.split(e.old).join(e.neu)
    changed += hit
    ok += 1
  }
  if (!DRY) fs.writeFileSync(abs, text)
  console.log(`✓ ${rel}: ${list.length} 段 / ${changed} 处替换 ${DRY ? '(dry-run 未写盘)' : '已落盘'}`)
}
console.log(`[B4b-APPLY] 合计 ${ok}/${edits.length} 段全部命中${DRY ? '（dry-run）' : ''}`)
