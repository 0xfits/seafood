#!/usr/bin/env node
/**
 * P6-I18N-LIT-B4b · 四语 locale 增量写入（zh / hk / en / vn 同步）
 *
 * 口径：① 既有命名空间只「追加」新键（不覆盖、不改既有取值）；② 新命名空间整块追加；
 *      ③ 键顺序 = 既有顺序 + 追加顺序；④ 缩进 2 空格（与存量一致）；⑤ 写完自检四语键集相等。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LANGS = ['zh', 'hk', 'en', 'vn']

// ── 共享新增：adminCommon（19 键） ──
const ADMIN_COMMON = {
  zh: {
    notLoggedIn: '未登录', noAdminAccess: '当前账号没有后台访问权限', normalUser: '普通用户', adminRole: '管理员',
    colUserId: '用户ID', colWallet: '钱包地址', colPoints: '当前积分', colUpdated: '最后更新', colRole: '角色',
    colActions: '操作', colRegistered: '注册时间', colLastLogin: '最近登录', colBio: '简介',
    noMatchingUsers: '没有找到匹配的用户', saving: '保存中...', readOnlyNotice: '当前账号为只读模式。',
    statUsers: '总用户数', statTotalPoints: '总积分', refreshData: '刷新数据',
  },
  hk: {
    notLoggedIn: '未登入', noAdminAccess: '目前帳號沒有後台存取權限', normalUser: '一般用戶', adminRole: '管理員',
    colUserId: '用戶ID', colWallet: '錢包地址', colPoints: '目前積分', colUpdated: '最後更新', colRole: '角色',
    colActions: '操作', colRegistered: '註冊時間', colLastLogin: '最近登入', colBio: '簡介',
    noMatchingUsers: '沒有找到符合的用戶', saving: '儲存中...', readOnlyNotice: '目前帳號為唯讀模式。',
    statUsers: '總用戶數', statTotalPoints: '總積分', refreshData: '重新整理資料',
  },
  en: {
    notLoggedIn: 'Not signed in', noAdminAccess: 'This account has no admin access', normalUser: 'Regular user', adminRole: 'Administrator',
    colUserId: 'User ID', colWallet: 'Wallet address', colPoints: 'Current points', colUpdated: 'Last updated', colRole: 'Role',
    colActions: 'Actions', colRegistered: 'Registered', colLastLogin: 'Last login', colBio: 'Bio',
    noMatchingUsers: 'No matching users found', saving: 'Saving...', readOnlyNotice: 'This account is in read-only mode.',
    statUsers: 'Total users', statTotalPoints: 'Total points', refreshData: 'Refresh data',
  },
  vn: {
    notLoggedIn: 'Chưa đăng nhập', noAdminAccess: 'Tài khoản này không có quyền truy cập trang quản trị', normalUser: 'Người dùng thường', adminRole: 'Quản trị viên',
    colUserId: 'ID người dùng', colWallet: 'Địa chỉ ví', colPoints: 'Điểm hiện tại', colUpdated: 'Cập nhật lần cuối', colRole: 'Vai trò',
    colActions: 'Thao tác', colRegistered: 'Thời gian đăng ký', colLastLogin: 'Đăng nhập gần nhất', colBio: 'Giới thiệu',
    noMatchingUsers: 'Không tìm thấy người dùng phù hợp', saving: 'Đang lưu...', readOnlyNotice: 'Tài khoản hiện tại ở chế độ chỉ đọc.',
    statUsers: 'Tổng số người dùng', statTotalPoints: 'Tổng điểm', refreshData: 'Làm mới dữ liệu',
  },
}

// ── 共享新增：common.listSeparator（必做①） ──
//   注意：四语值必须是「每语一个对象」的形状；写成裸字符串会让 `Object.entries(', ')` 变成
//   `[['0',','],['1',' ']]` 从而写入 `common['0']` / `common['1']` 垃圾键（已发生过一次）。
const COMMON_SEP = { zh: { listSeparator: '、' }, hk: { listSeparator: '、' }, en: { listSeparator: ', ' }, vn: { listSeparator: ', ' } }

// ── adminPermissions（29 键） ──
const ADMIN_PERMISSIONS = {
  zh: {
    loadFailed: '加载权限数据失败: {{message}}', nameRequired: '权限组名称不能为空', permissionsRequired: '至少填写一个权限标识',
    created: '权限组已创建', updated: '权限组已更新', saveFailed: '保存权限组失败: {{message}}',
    confirmDelete: '确认删除权限组“{{name}}”？', deleted: '权限组已删除', deleteFailed: '删除权限组失败: {{message}}',
    intro: '“管理员访问”组映射完整后台权限；“任务发布组”和“奖品发布组”可单独分配发布能力。', addGroup: '添加权限组',
    readOnly: '只读', editable: '可编辑', userCount: '{{count}} 个用户', noMembers: '暂无分配成员',
    tipNoManagePermission: '当前账号没有 manage_permissions 权限', tipReadonlyEdit: '系统权限组不可编辑', tipEdit: '编辑权限组',
    tipReadonlyDelete: '系统权限组不可删除', tipDelete: '删除权限组', editGroup: '编辑权限组',
    labelName: '名称', namePlaceholder: '例如：内容审核组', labelDescription: '描述',
    descPlaceholder: '说明这组权限负责什么。', labelPermissions: '权限标识',
    permissionsPlaceholder: '逗号分隔，例如：review_tasks, publish_prizes', labelMembers: '分配成员', saveGroup: '保存权限组',
  },
  hk: {
    loadFailed: '載入權限資料失敗: {{message}}', nameRequired: '權限組名稱不能為空', permissionsRequired: '至少填寫一個權限標識',
    created: '權限組已建立', updated: '權限組已更新', saveFailed: '儲存權限組失敗: {{message}}',
    confirmDelete: '確認刪除權限組「{{name}}」？', deleted: '權限組已刪除', deleteFailed: '刪除權限組失敗: {{message}}',
    intro: '「管理員存取」組對應完整後台權限；「任務發布組」和「獎品發布組」可單獨指派發布能力。', addGroup: '新增權限組',
    readOnly: '唯讀', editable: '可編輯', userCount: '{{count}} 個用戶', noMembers: '暫無指派成員',
    tipNoManagePermission: '目前帳號沒有 manage_permissions 權限', tipReadonlyEdit: '系統權限組不可編輯', tipEdit: '編輯權限組',
    tipReadonlyDelete: '系統權限組不可刪除', tipDelete: '刪除權限組', editGroup: '編輯權限組',
    labelName: '名稱', namePlaceholder: '例如：內容審核組', labelDescription: '描述',
    descPlaceholder: '說明這組權限負責什麼。', labelPermissions: '權限標識',
    permissionsPlaceholder: '逗號分隔，例如：review_tasks, publish_prizes', labelMembers: '指派成員', saveGroup: '儲存權限組',
  },
  en: {
    loadFailed: 'Failed to load permission data: {{message}}', nameRequired: 'Permission group name is required',
    permissionsRequired: 'Enter at least one permission key', created: 'Permission group created', updated: 'Permission group updated',
    saveFailed: 'Failed to save permission group: {{message}}', confirmDelete: 'Delete permission group "{{name}}"?',
    deleted: 'Permission group deleted', deleteFailed: 'Failed to delete permission group: {{message}}',
    intro: 'The "Admin access" group maps to full admin permissions; the "Task publisher" and "Prize publisher" groups can be granted publishing rights separately.',
    addGroup: 'Add permission group', readOnly: 'Read-only', editable: 'Editable', userCount: '{{count}} users',
    noMembers: 'No members assigned', tipNoManagePermission: 'This account lacks the manage_permissions permission',
    tipReadonlyEdit: 'System permission groups cannot be edited', tipEdit: 'Edit permission group',
    tipReadonlyDelete: 'System permission groups cannot be deleted', tipDelete: 'Delete permission group',
    editGroup: 'Edit permission group', labelName: 'Name', namePlaceholder: 'e.g. Content review team',
    labelDescription: 'Description', descPlaceholder: 'Describe what this permission group is responsible for.',
    labelPermissions: 'Permission keys', permissionsPlaceholder: 'Comma-separated, e.g. review_tasks, publish_prizes',
    labelMembers: 'Assign members', saveGroup: 'Save permission group',
  },
  vn: {
    loadFailed: 'Tải dữ liệu quyền thất bại: {{message}}', nameRequired: 'Tên nhóm quyền không được để trống',
    permissionsRequired: 'Nhập ít nhất một mã quyền', created: 'Đã tạo nhóm quyền', updated: 'Đã cập nhật nhóm quyền',
    saveFailed: 'Lưu nhóm quyền thất bại: {{message}}', confirmDelete: 'Xóa nhóm quyền "{{name}}"?',
    deleted: 'Đã xóa nhóm quyền', deleteFailed: 'Xóa nhóm quyền thất bại: {{message}}',
    intro: 'Nhóm "Quyền quản trị" ánh xạ toàn bộ quyền quản trị; "Nhóm đăng nhiệm vụ" và "Nhóm đăng giải thưởng" có thể được cấp quyền đăng riêng.',
    addGroup: 'Thêm nhóm quyền', readOnly: 'Chỉ đọc', editable: 'Có thể chỉnh sửa', userCount: '{{count}} người dùng',
    noMembers: 'Chưa gán thành viên', tipNoManagePermission: 'Tài khoản hiện tại không có quyền manage_permissions',
    tipReadonlyEdit: 'Nhóm quyền hệ thống không thể chỉnh sửa', tipEdit: 'Chỉnh sửa nhóm quyền',
    tipReadonlyDelete: 'Nhóm quyền hệ thống không thể xóa', tipDelete: 'Xóa nhóm quyền',
    editGroup: 'Chỉnh sửa nhóm quyền', labelName: 'Tên', namePlaceholder: 'Ví dụ: Nhóm kiểm duyệt nội dung',
    labelDescription: 'Mô tả', descPlaceholder: 'Mô tả nhóm quyền này phụ trách việc gì.',
    labelPermissions: 'Mã quyền', permissionsPlaceholder: 'Phân tách bằng dấu phẩy, ví dụ: review_tasks, publish_prizes',
    labelMembers: 'Gán thành viên', saveGroup: 'Lưu nhóm quyền',
  },
}

// ── adminPoints（27 键） ──
const ADMIN_POINTS = {
  zh: {
    neverUpdated: '从未更新', loadFailed: '加载用户积分失败: {{message}}', invalidForm: '请填写完整的调整信息',
    invalidAmount: '请输入有效的积分数额', statAvg: '平均积分', statZero: '零积分用户', title: '用户积分管理',
    intro: '当前页面使用真实用户和资产积分数据，', introManage: '你可以执行积分调整。', searchPlaceholder: '搜索用户地址或ID...',
    adjustFailed: '积分调整失败: {{message}}', adjustSuccessAdd: '成功为用户 #{{id}} 增加 {{amount}} 积分',
    adjustSuccessSubtract: '成功为用户 #{{id}} 减少 {{amount}} 积分', addPoints: '增加积分', subtractPoints: '减少积分',
    targetUser: '操作用户:', wallet: '钱包地址:', currentPoints: '当前积分:', amountLabelAdd: '增加积分数额',
    amountLabelSubtract: '减少积分数额', amountPlaceholder: '请输入积分数额', reasonLabel: '调整原因',
    reasonPlaceholder: '请输入调整原因...', processing: '处理中...', confirmAdd: '确认增加', confirmSubtract: '确认减少',
    tipNoManagePermission: '当前账号没有 manage_points 权限',
  },
  hk: {
    neverUpdated: '從未更新', loadFailed: '載入用戶積分失敗: {{message}}', invalidForm: '請填寫完整的調整資訊',
    invalidAmount: '請輸入有效的積分數額', statAvg: '平均積分', statZero: '零積分用戶', title: '用戶積分管理',
    intro: '目前頁面使用真實用戶和資產積分資料，', introManage: '你可以執行積分調整。', searchPlaceholder: '搜尋用戶地址或ID...',
    adjustFailed: '積分調整失敗: {{message}}', adjustSuccessAdd: '成功為用戶 #{{id}} 增加 {{amount}} 積分',
    adjustSuccessSubtract: '成功為用戶 #{{id}} 減少 {{amount}} 積分', addPoints: '增加積分', subtractPoints: '減少積分',
    targetUser: '操作用戶:', wallet: '錢包地址:', currentPoints: '目前積分:', amountLabelAdd: '增加積分數額',
    amountLabelSubtract: '減少積分數額', amountPlaceholder: '請輸入積分數額', reasonLabel: '調整原因',
    reasonPlaceholder: '請輸入調整原因...', processing: '處理中...', confirmAdd: '確認增加', confirmSubtract: '確認減少',
    tipNoManagePermission: '目前帳號沒有 manage_points 權限',
  },
  en: {
    neverUpdated: 'Never updated', loadFailed: 'Failed to load user points: {{message}}',
    invalidForm: 'Please fill in all adjustment details', invalidAmount: 'Please enter a valid point amount',
    statAvg: 'Average points', statZero: 'Users with zero points', title: 'User points management',
    intro: 'This page uses real user and points asset data,', introManage: 'you can adjust points.',
    searchPlaceholder: 'Search by wallet address or ID...', adjustFailed: 'Failed to adjust points: {{message}}',
    adjustSuccessAdd: 'Added {{amount}} points to user #{{id}}', adjustSuccessSubtract: 'Removed {{amount}} points from user #{{id}}',
    addPoints: 'Add points', subtractPoints: 'Remove points', targetUser: 'Target user:', wallet: 'Wallet address:',
    currentPoints: 'Current points:', amountLabelAdd: 'Points to add', amountLabelSubtract: 'Points to remove',
    amountPlaceholder: 'Enter the point amount', reasonLabel: 'Reason for adjustment',
    reasonPlaceholder: 'Enter the reason...', processing: 'Processing...', confirmAdd: 'Confirm add',
    confirmSubtract: 'Confirm remove', tipNoManagePermission: 'This account lacks the manage_points permission',
  },
  vn: {
    neverUpdated: 'Chưa cập nhật', loadFailed: 'Tải điểm người dùng thất bại: {{message}}',
    invalidForm: 'Vui lòng điền đầy đủ thông tin điều chỉnh', invalidAmount: 'Vui lòng nhập số điểm hợp lệ',
    statAvg: 'Điểm trung bình', statZero: 'Người dùng không có điểm', title: 'Quản lý điểm người dùng',
    intro: 'Trang này sử dụng dữ liệu người dùng và điểm tài sản thực tế,', introManage: 'bạn có thể điều chỉnh điểm.',
    searchPlaceholder: 'Tìm theo địa chỉ ví hoặc ID...', adjustFailed: 'Điều chỉnh điểm thất bại: {{message}}',
    adjustSuccessAdd: 'Đã thêm {{amount}} điểm cho người dùng #{{id}}',
    adjustSuccessSubtract: 'Đã trừ {{amount}} điểm của người dùng #{{id}}',
    addPoints: 'Thêm điểm', subtractPoints: 'Trừ điểm', targetUser: 'Người dùng thao tác:', wallet: 'Địa chỉ ví:',
    currentPoints: 'Điểm hiện tại:', amountLabelAdd: 'Số điểm thêm', amountLabelSubtract: 'Số điểm trừ',
    amountPlaceholder: 'Nhập số điểm', reasonLabel: 'Lý do điều chỉnh',
    reasonPlaceholder: 'Nhập lý do điều chỉnh...', processing: 'Đang xử lý...', confirmAdd: 'Xác nhận thêm',
    confirmSubtract: 'Xác nhận trừ', tipNoManagePermission: 'Tài khoản hiện tại không có quyền manage_points',
  },
}

// ── adminShards（19 键；`holdingsNote` = 必做② 改写：去掉 `/api/shard` 工程口径） ──
const ADMIN_SHARDS = {
  zh: {
    loadFailed: '加载失败: {{message}}', noPermission: '权限不足，需要 `manage_rewards` 或 `publish_prizes` 权限',
    prizeLabel: '奖品:', tabHoldings: '持仓总览', tabOrders: '挂单管理', tabTrades: '成交记录',
    holdingsNote: '用户个人持仓需由本人登录后在自己的账户页面查看；此处按奖品维度展示流通情况，可结合订单簿与成交记录了解各奖品的碎片分布。',
    thPrize: '奖品', thStoresCount: '库存奖品数', buyTitle: '买单 (Buy)', sellTitle: '卖单 (Sell)',
    noOrders: '暂无挂单', thPrice: '价格', thVolume: '剩余量', noTrades: '暂无成交记录',
    thQty: '数量', thBuyer: '买方', thSeller: '卖方', thTime: '时间',
  },
  hk: {
    loadFailed: '載入失敗: {{message}}', noPermission: '權限不足，需要 `manage_rewards` 或 `publish_prizes` 權限',
    prizeLabel: '獎品:', tabHoldings: '持倉總覽', tabOrders: '掛單管理', tabTrades: '成交記錄',
    holdingsNote: '用戶個人持倉需由本人登入後在自己的帳戶頁面查看；此處按獎品維度展示流通情況，可結合訂單簿與成交記錄了解各獎品的碎片分佈。',
    thPrize: '獎品', thStoresCount: '庫存獎品數', buyTitle: '買單 (Buy)', sellTitle: '賣單 (Sell)',
    noOrders: '暫無掛單', thPrice: '價格', thVolume: '剩餘量', noTrades: '暫無成交記錄',
    thQty: '數量', thBuyer: '買方', thSeller: '賣方', thTime: '時間',
  },
  en: {
    loadFailed: 'Failed to load: {{message}}',
    noPermission: 'Insufficient permissions: the manage_rewards or publish_prizes permission is required',
    prizeLabel: 'Prize:', tabHoldings: 'Holdings overview', tabOrders: 'Open orders', tabTrades: 'Trade history',
    holdingsNote: 'Individual holdings can only be viewed by the user in their own account page. This view shows circulating activity per prize; combine the order book and trade history to gauge how each prize\u2019s shards are distributed.',
    thPrize: 'Prize', thStoresCount: 'Units in prize stock', buyTitle: 'Buy orders', sellTitle: 'Sell orders',
    noOrders: 'No open orders', thPrice: 'Price', thVolume: 'Remaining', noTrades: 'No trades yet',
    thQty: 'Quantity', thBuyer: 'Buyer', thSeller: 'Seller', thTime: 'Time',
  },
  vn: {
    loadFailed: 'Tải thất bại: {{message}}', noPermission: 'Không đủ quyền: cần quyền `manage_rewards` hoặc `publish_prizes`',
    prizeLabel: 'Giải thưởng:', tabHoldings: 'Tổng quan nắm giữ', tabOrders: 'Quản lý lệnh', tabTrades: 'Lịch sử giao dịch',
    holdingsNote: 'Người dùng chỉ có thể xem phần nắm giữ của mình sau khi đăng nhập trong trang tài khoản; tại đây hiển thị tình hình lưu thông theo từng giải thưởng, có thể kết hợp sổ lệnh và lịch sử giao dịch để nắm phân bố mảnh của mỗi giải thưởng.',
    thPrize: 'Giải thưởng', thStoresCount: 'Số lượng tồn kho', buyTitle: 'Lệnh mua (Buy)', sellTitle: 'Lệnh bán (Sell)',
    noOrders: 'Chưa có lệnh', thPrice: 'Giá', thVolume: 'Khối lượng còn lại', noTrades: 'Chưa có giao dịch',
    thQty: 'Số lượng', thBuyer: 'Người mua', thSeller: 'Người bán', thTime: 'Thời gian',
  },
}

// ── adminSettings（24 键；`intro` = 必做② 改写：去掉 §2.4/§5.1/`ops:`/`410`） ──
const ADMIN_SETTINGS = {
  zh: {
    siteDescription: '去中心化社区奖励平台', loadFailed: '加载系统设置失败: {{message}}', saveFailed: '保存失败: {{message}}',
    saved: '设置已保存', intro: '当前页面读取并保存站点设置；「重置为默认值」入口已下线，逐项修改后保存即可。',
    unsavedChanges: '存在未保存修改。', noChanges: '当前内容与已保存设置一致。', cardBasic: '基本设置',
    labelSiteDescription: '网站描述', labelDefaultLanguage: '默认语言', langZh: '中文', langEn: 'English',
    langHk: '繁體中文', langVn: 'Tiếng Việt', maintenance: '维护模式', maintenanceDesc: '启用后用户无法访问网站',
    allowRegistration: '允许注册', allowRegistrationDesc: '新用户可以注册账号', emailNotifications: '邮件通知',
    emailNotificationsDesc: '发送系统邮件通知', cardPoints: '积分设置', labelPointsPerTask: '默认任务积分',
    labelMaxDailyTasks: '每日最大任务数', labelRewardCooldown: '奖励冷却时间(小时)', saveButton: '保存设置',
  },
  hk: {
    siteDescription: '去中心化社群獎勵平台', loadFailed: '載入系統設定失敗: {{message}}', saveFailed: '儲存失敗: {{message}}',
    saved: '設定已儲存', intro: '本頁面讀取並儲存站點設定；「重設為預設值」入口已下線，逐項修改後儲存即可。',
    unsavedChanges: '存在未儲存的修改。', noChanges: '目前內容與已儲存的設定一致。', cardBasic: '基本設定',
    labelSiteDescription: '網站描述', labelDefaultLanguage: '預設語言', langZh: '中文', langEn: 'English',
    langHk: '繁體中文', langVn: 'Tiếng Việt', maintenance: '維護模式', maintenanceDesc: '啟用後用戶無法存取網站',
    allowRegistration: '允許註冊', allowRegistrationDesc: '新用戶可以註冊帳號', emailNotifications: '郵件通知',
    emailNotificationsDesc: '發送系統郵件通知', cardPoints: '積分設定', labelPointsPerTask: '預設任務積分',
    labelMaxDailyTasks: '每日最大任務數', labelRewardCooldown: '獎勵冷卻時間(小時)', saveButton: '儲存設定',
  },
  en: {
    siteDescription: 'Decentralized community rewards platform', loadFailed: 'Failed to load system settings: {{message}}',
    saveFailed: 'Save failed: {{message}}', saved: 'Settings saved',
    intro: 'This page reads and saves site settings. The "Reset to defaults" entry has been retired \u2014 edit individual fields and save.',
    unsavedChanges: 'You have unsaved changes.', noChanges: 'Current content matches the saved settings.', cardBasic: 'Basic settings',
    labelSiteDescription: 'Site description', labelDefaultLanguage: 'Default language', langZh: '中文', langEn: 'English',
    langHk: '繁體中文', langVn: 'Tiếng Việt', maintenance: 'Maintenance mode',
    maintenanceDesc: 'Users cannot access the site while enabled', allowRegistration: 'Allow registration',
    allowRegistrationDesc: 'New users can create accounts', emailNotifications: 'Email notifications',
    emailNotificationsDesc: 'Send system email notifications', cardPoints: 'Points settings',
    labelPointsPerTask: 'Default points per task', labelMaxDailyTasks: 'Max tasks per day',
    labelRewardCooldown: 'Reward cooldown (hours)', saveButton: 'Save settings',
  },
  vn: {
    siteDescription: 'Nền tảng thưởng cộng đồng phi tập trung', loadFailed: 'Tải cài đặt hệ thống thất bại: {{message}}',
    saveFailed: 'Lưu thất bại: {{message}}', saved: 'Đã lưu cài đặt',
    intro: 'Trang này đọc và lưu cài đặt của site; mục "Khôi phục mặc định" đã ngừng hoạt động, hãy sửa từng mục rồi lưu.',
    unsavedChanges: 'Có thay đổi chưa lưu.', noChanges: 'Nội dung hiện tại trùng với cài đặt đã lưu.', cardBasic: 'Cài đặt cơ bản',
    labelSiteDescription: 'Mô tả website', labelDefaultLanguage: 'Ngôn ngữ mặc định', langZh: '中文', langEn: 'English',
    langHk: '繁體中文', langVn: 'Tiếng Việt', maintenance: 'Chế độ bảo trì',
    maintenanceDesc: 'Người dùng không thể truy cập website khi bật', allowRegistration: 'Cho phép đăng ký',
    allowRegistrationDesc: 'Người dùng mới có thể tạo tài khoản', emailNotifications: 'Thông báo email',
    emailNotificationsDesc: 'Gửi thông báo email hệ thống', cardPoints: 'Cài đặt điểm',
    labelPointsPerTask: 'Điểm mặc định mỗi nhiệm vụ', labelMaxDailyTasks: 'Số nhiệm vụ tối đa mỗi ngày',
    labelRewardCooldown: 'Thời gian chờ phần thưởng (giờ)', saveButton: 'Lưu cài đặt',
  },
}

// ── adminUsers（17 键） ──
const ADMIN_USERS = {
  zh: {
    loadFailed: '加载用户数据失败: {{message}}', confirmGrant: '确认将用户 #{{id}} 提升为管理员？',
    confirmRevoke: '确认撤销用户 #{{id}} 的管理员权限？', grantSuccess: '管理员权限已授予', revokeSuccess: '管理员权限已撤销',
    updateFailed: '更新用户失败: {{message}}', statAssets: '有资产记录', intro: '当前页面使用真实用户和积分资产数据。',
    introManage: '你可以调整管理员权限。', introReadOnly: '当前账号为只读模式，可查看用户但不能修改管理员权限。',
    searchPlaceholder: '搜索用户ID、地址或简介...', noBio: '暂无简介',
    tipNoManageUsers: '当前账号没有 manage_users 权限', tipRevoke: '撤销管理员权限', tipGrant: '授予管理员权限',
    tipGoPoints: '前往积分管理', tipNoManagePoints: '当前账号没有 manage_points 权限',
  },
  hk: {
    loadFailed: '載入用戶資料失敗: {{message}}', confirmGrant: '確認將用戶 #{{id}} 提升為管理員？',
    confirmRevoke: '確認撤銷用戶 #{{id}} 的管理員權限？', grantSuccess: '管理員權限已授予', revokeSuccess: '管理員權限已撤銷',
    updateFailed: '更新用戶失敗: {{message}}', statAssets: '有資產記錄', intro: '目前頁面使用真實用戶和積分資產資料。',
    introManage: '你可以調整管理員權限。', introReadOnly: '目前帳號為唯讀模式，可查看用戶但不能修改管理員權限。',
    searchPlaceholder: '搜尋用戶ID、地址或簡介...', noBio: '暫無簡介',
    tipNoManageUsers: '目前帳號沒有 manage_users 權限', tipRevoke: '撤銷管理員權限', tipGrant: '授予管理員權限',
    tipGoPoints: '前往積分管理', tipNoManagePoints: '目前帳號沒有 manage_points 權限',
  },
  en: {
    loadFailed: 'Failed to load user data: {{message}}', confirmGrant: 'Promote user #{{id}} to administrator?',
    confirmRevoke: 'Revoke administrator rights from user #{{id}}?', grantSuccess: 'Administrator rights granted',
    revokeSuccess: 'Administrator rights revoked', updateFailed: 'Failed to update user: {{message}}',
    statAssets: 'With asset records', intro: 'This page uses real user and points asset data.',
    introManage: 'You can change administrator rights.',
    introReadOnly: 'This account is read-only: users are visible but administrator rights cannot be changed.',
    searchPlaceholder: 'Search by user ID, address, or bio...', noBio: 'No bio',
    tipNoManageUsers: 'This account lacks the manage_users permission', tipRevoke: 'Revoke administrator rights',
    tipGrant: 'Grant administrator rights', tipGoPoints: 'Go to points management',
    tipNoManagePoints: 'This account lacks the manage_points permission',
  },
  vn: {
    loadFailed: 'Tải dữ liệu người dùng thất bại: {{message}}', confirmGrant: 'Nâng người dùng #{{id}} lên quản trị viên?',
    confirmRevoke: 'Thu hồi quyền quản trị của người dùng #{{id}}?', grantSuccess: 'Đã cấp quyền quản trị viên',
    revokeSuccess: 'Đã thu hồi quyền quản trị viên', updateFailed: 'Cập nhật người dùng thất bại: {{message}}',
    statAssets: 'Có bản ghi tài sản', intro: 'Trang này sử dụng dữ liệu người dùng và tài sản điểm thực tế.',
    introManage: 'Bạn có thể điều chỉnh quyền quản trị viên.',
    introReadOnly: 'Tài khoản hiện tại ở chế độ chỉ đọc, có thể xem người dùng nhưng không thể thay đổi quyền quản trị viên.',
    searchPlaceholder: 'Tìm theo ID người dùng, địa chỉ hoặc giới thiệu...', noBio: 'Chưa có giới thiệu',
    tipNoManageUsers: 'Tài khoản hiện tại không có quyền manage_users', tipRevoke: 'Thu hồi quyền quản trị viên',
    tipGrant: 'Cấp quyền quản trị viên', tipGoPoints: 'Đến quản lý điểm',
    tipNoManagePoints: 'Tài khoản hiện tại không có quyền manage_points',
  },
}

const NEW_NS = { adminPermissions: ADMIN_PERMISSIONS, adminPoints: ADMIN_POINTS, adminShards: ADMIN_SHARDS, adminSettings: ADMIN_SETTINGS, adminUsers: ADMIN_USERS }
const SHARED = { adminCommon: ADMIN_COMMON, common: COMMON_SEP }

/**
 * 必做② 收口 · B4a 遗留的「用户可见工程口径」文案覆盖表（**显式覆盖语义**，非追加）
 *   原文把 `POST /api/admin/task/*` = `410`、§5.1 行号原文展示给终端用户 ⇒ 改写为不含
 *   编号 / 状态码 / 接口路径的表述，仅保留「已下线」语义。
 */
const LEGACY_FIX = {
  adminTasks: {
    readOnlyNotice: {
      zh: '当前账号为只读模式：管理员端的招工发布、编辑与删除入口已下线。',
      hk: '目前帳號為唯讀模式：管理員端的招工發布、編輯與刪除入口已下線。',
      en: 'This account is in read-only mode: the admin-side entries for publishing, editing and deleting job posts have been retired.',
      vn: 'Tài khoản hiện tại ở chế độ chỉ đọc: các lối vào đăng, sửa và xóa tin tuyển ở phía quản trị đã ngừng hoạt động.',
    },
  },
  adminRewards: {
    readOnlyNotice: {
      zh: '当前账号为只读模式：管理员端的商品发布、编辑与删除入口已下线。',
      hk: '目前帳號為唯讀模式：管理員端的商品發布、編輯與刪除入口已下線。',
      en: 'This account is in read-only mode: the admin-side entries for publishing, editing and deleting prizes have been retired.',
      vn: 'Tài khoản hiện tại ở chế độ chỉ đọc: các lối vào đăng, sửa và xóa giải thưởng ở phía quản trị đã ngừng hoạt động.',
    },
  },
}

const counts = {}
for (const lang of LANGS) {
  const abs = path.join(SRC, `locales/${lang}.json`)
  const raw = fs.readFileSync(abs, 'utf8')
  const table = JSON.parse(raw)
  const before = { top: Object.keys(table).length, flat: JSON.stringify(table).length }

  // ⓿ 清理上一跑遗留的垃圾数值键（裸字符串被 `Object.entries` 展开成 '0'/'1'）——幂等保证
  for (const stray of ['0', '1']) {
    if (table.common && stray in table.common) {
      console.log(`  ${lang}.common: 清除垃圾键 '${stray}' = ${JSON.stringify(table.common[stray])}`)
      delete table.common[stray]
    }
  }

  // ① 共享命名空间追加（既有键必须存在，且不得被覆盖）
  for (const [ns, table4] of Object.entries(SHARED)) {
    if (typeof table4[lang] !== 'object' || table4[lang] === null || Array.isArray(table4[lang])) {
      console.error(`✗ 脚本错误：SHARED.${ns}.${lang} 不是对象（形状契约）`)
      process.exit(2)
    }
    if (typeof table[ns] !== 'object' || table[ns] === null) {
      console.error(`✗ ${lang}: 命名空间 ${ns} 不存在（本批只做追加，不新建共享空间）`)
      process.exit(1)
    }
    for (const [k, v] of Object.entries(table4[lang])) {
      if (k in table[ns] && table[ns][k] !== v) {
        console.error(`✗ ${lang}.${ns}.${k} 已存在且取值不同：${JSON.stringify(table[ns][k])} vs ${JSON.stringify(v)}`)
        process.exit(1)
      }
      table[ns][k] = v
    }
    console.log(`  ${lang}.${ns}: +${Object.keys(table4[lang]).length} 键`)
  }
  // ② 新命名空间整块追加（已存在 ⇒ 逐键比对，相等即跳过 ⇒ 可重复运行）
  for (const [ns, table4] of Object.entries(NEW_NS)) {
    if (table[ns] !== undefined) {
      const same = JSON.stringify(table[ns]) === JSON.stringify(table4[lang])
      if (!same) {
        console.error(`✗ ${lang}: 命名空间 ${ns} 已存在且内容不同 ⇒ 命名空间铁律冲突，停止`)
        process.exit(1)
      }
      console.log(`  ${lang}.${ns}: 已存在且逐键一致（跳过）`)
      continue
    }
    table[ns] = table4[lang]
    console.log(`  ${lang}.${ns}: 新建 ${Object.keys(table4[lang]).length} 键`)
  }

  // ③ 必做② 收口：B4a 遗留工程口径文案覆盖（显式覆盖 + 打印旧值以便对账）
  for (const [ns, keys] of Object.entries(LEGACY_FIX)) {
    for (const [k, perLang] of Object.entries(keys)) {
      const oldVal = table[ns][k]
      if (oldVal !== perLang[lang]) {
        console.log(`  ${lang}.${ns}.${k}: 覆盖\n      旧 = ${JSON.stringify(oldVal)}\n      新 = ${JSON.stringify(perLang[lang])}`)
        table[ns][k] = perLang[lang]
      }
    }
  }

  fs.writeFileSync(abs, `${JSON.stringify(table, null, 2)}\n`)
  const after = { top: Object.keys(table).length, flat: JSON.stringify(table).length }
  counts[lang] = { before, after }
  console.log(`✓ locales/${lang}.json 已写盘（顶层 ${before.top}→${after.top}）`)
}

// ③ 自检：四语键集逐文件相等
const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
)).sort()
const sets = LANGS.map((l) => JSON.stringify(keyPaths(JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8')))))
const flat = keyPaths(JSON.parse(fs.readFileSync(path.join(SRC, 'locales/zh.json'), 'utf8'))).length
console.log(`[B4b-LOCALES] 自检 四语键集相等 = ${new Set(sets).size === 1 ? 'PASS' : 'FAIL'}；zh flat=${flat}；top=${counts.zh.after.top}`)
process.exit(new Set(sets).size === 1 ? 0 : 1)
