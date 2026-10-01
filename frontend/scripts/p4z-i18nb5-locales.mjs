#!/usr/bin/env node
/**
 * P6-I18N-LIT-B5 · 四语 locale 增量写入（组件库 + 预览页收尾批）
 *
 * 口径（§5.7 ③：报数带口径；与 `p4z-i18nb4b-locales.mjs` 同形，可重复运行）：
 *   ① 只新增/覆盖**本批两个命名空间**：`uiCommon`（12 键）/ `uiError`（23 键）；
 *   ② 命名空间铁律：写入前先断言顶层无**字符串**同名键（既有 `common`/`home`/`task`/
 *      `reward`/`page`/`login`/`register`/`auth` 等一律不碰）；
 *   ③ 幂等：同键重复运行 ⇒ 取值相同、键集不变、四文件自检仍 PASS；
 *   ④ 收尾自检：四文件拍平键路径集合逐文件相等 + en/vn 本批键零 CJK 表意文字。
 *
 * 用法：node scripts/p4z-i18nb5-locales.mjs [--dry]   （--dry = 只校验不落盘）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LANGS = ['zh', 'hk', 'en', 'vn']
const DRY = process.argv.includes('--dry')
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/

// ── 本批新增命名空间（④ 幂等：逐键覆盖；既非同名前缀键，也不动其它命名空间）────────────
const SHARED = {
  uiCommon: {
    zh: {
      searchPlaceholder: '搜索...',
      selectDate: '选择日期',
      filter: '筛选',
      clearFilters: '清除筛选',
      applyFilters: '应用筛选',
      progress: '进度',
      dashJPoints: 'dashJ 社区积分',
      pleaseWait: '请稍候...',
      noMoreData: '没有更多数据了',
      loadFailed: '加载失败',
      renderTime: '渲染时间',
      memoryUsage: '内存使用',
    },
    hk: {
      searchPlaceholder: '搜尋...',
      selectDate: '選擇日期',
      filter: '篩選',
      clearFilters: '清除篩選',
      applyFilters: '套用篩選',
      progress: '進度',
      dashJPoints: 'dashJ 社區積分',
      pleaseWait: '請稍候...',
      noMoreData: '冇更多資料喇',
      loadFailed: '載入失敗',
      renderTime: '渲染時間',
      memoryUsage: '記憶體用量',
    },
    en: {
      searchPlaceholder: 'Search...',
      selectDate: 'Select date',
      filter: 'Filter',
      clearFilters: 'Clear filters',
      applyFilters: 'Apply filters',
      progress: 'Progress',
      dashJPoints: 'dashJ community points',
      pleaseWait: 'Please wait...',
      noMoreData: 'No more data',
      loadFailed: 'Failed to load',
      renderTime: 'Render time',
      memoryUsage: 'Memory usage',
    },
    vn: {
      searchPlaceholder: 'Tìm kiếm...',
      selectDate: 'Chọn ngày',
      filter: 'Bộ lọc',
      clearFilters: 'Xoá bộ lọc',
      applyFilters: 'Áp dụng bộ lọc',
      progress: 'Tiến độ',
      dashJPoints: 'dashJ điểm cộng đồng',
      pleaseWait: 'Vui lòng đợi...',
      noMoreData: 'Đã hết dữ liệu',
      loadFailed: 'Tải thất bại',
      renderTime: 'Thời gian render',
      memoryUsage: 'Bộ nhớ dùng',
    },
  },
  uiError: {
    zh: {
      problemTitle: '出现了一些问题',
      problemBody: '应用程序遇到了意外错误。我们已经记录了这个问题，请稍后再试。',
      retry: '重试',
      backHome: '返回首页',
      hide: '隐藏',
      show: '显示',
      errorDetails: '错误详情',
      errorInfo: '错误信息:',
      componentStack: '组件堆栈:',
      networkTitle: '网络连接异常',
      networkBody: '请检查您的网络连接，然后重试。',
      unknown: '发生未知错误',
      badRequest: '请求参数错误',
      unauthorized: '未授权访问',
      forbidden: '权限不足',
      notFound: '请求的资源不存在',
      serverError: '服务器内部错误',
      serverErrorStatus: '服务器错误 ({{status}})',
      networkFailed: '网络连接失败',
      toastTitle: '错误',
      details: '详细信息',
      notFoundTitle: '页面未找到',
      notFoundBody: '您访问的页面不存在或已被移动。',
    },
    hk: {
      problemTitle: '出現咗啲問題',
      problemBody: '應用程式遇到意外錯誤。我哋已經記錄咗呢個問題，請遲啲再試。',
      retry: '重試',
      backHome: '返回首頁',
      hide: '隱藏',
      show: '顯示',
      errorDetails: '錯誤詳情',
      errorInfo: '錯誤資訊:',
      componentStack: '組件堆疊:',
      networkTitle: '網絡連線異常',
      networkBody: '請檢查你嘅網絡連線，然後再試。',
      unknown: '發生未知錯誤',
      badRequest: '請求參數錯誤',
      unauthorized: '未授權存取',
      forbidden: '權限不足',
      notFound: '請求嘅資源唔存在',
      serverError: '伺服器內部錯誤',
      serverErrorStatus: '伺服器錯誤 ({{status}})',
      networkFailed: '網絡連線失敗',
      toastTitle: '錯誤',
      details: '詳細資料',
      notFoundTitle: '搵唔到頁面',
      notFoundBody: '你訪問嘅頁面唔存在或者已經搬咗。',
    },
    en: {
      problemTitle: 'Something went wrong',
      problemBody: 'The app ran into an unexpected error. We have logged the issue, please try again later.',
      retry: 'Retry',
      backHome: 'Back to home',
      hide: 'Hide',
      show: 'Show',
      errorDetails: 'error details',
      errorInfo: 'Error:',
      componentStack: 'Component stack:',
      networkTitle: 'Network problem',
      networkBody: 'Please check your network connection and try again.',
      unknown: 'An unknown error occurred',
      badRequest: 'Invalid request parameters',
      unauthorized: 'Unauthorized access',
      forbidden: 'Insufficient permission',
      notFound: 'The requested resource does not exist',
      serverError: 'Internal server error',
      serverErrorStatus: 'Server error ({{status}})',
      networkFailed: 'Network request failed',
      toastTitle: 'Error',
      details: 'Details',
      notFoundTitle: 'Page not found',
      notFoundBody: 'The page you are looking for does not exist or has been moved.',
    },
    vn: {
      problemTitle: 'Đã xảy ra sự cố',
      problemBody: 'Ứng dụng gặp lỗi ngoài dự kiến. Chúng tôi đã ghi nhận sự cố, vui lòng thử lại sau.',
      retry: 'Thử lại',
      backHome: 'Về trang chủ',
      hide: 'Ẩn',
      show: 'Hiện',
      errorDetails: 'chi tiết lỗi',
      errorInfo: 'Lỗi:',
      componentStack: 'Ngăn xếp component:',
      networkTitle: 'Sự cố kết nối mạng',
      networkBody: 'Vui lòng kiểm tra kết nối mạng rồi thử lại.',
      unknown: 'Đã xảy ra lỗi không rõ',
      badRequest: 'Tham số yêu cầu không hợp lệ',
      unauthorized: 'Truy cập chưa được xác thực',
      forbidden: 'Không đủ quyền',
      notFound: 'Tài nguyên yêu cầu không tồn tại',
      serverError: 'Lỗi máy chủ nội bộ',
      serverErrorStatus: 'Lỗi máy chủ ({{status}})',
      networkFailed: 'Kết nối mạng thất bại',
      toastTitle: 'Lỗi',
      details: 'Chi tiết',
      notFoundTitle: 'Không tìm thấy trang',
      notFoundBody: 'Trang bạn truy cập không tồn tại hoặc đã được di chuyển.',
    },
  },
}

const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
)).sort()

// ① 形状契约：必须是「对象 → 语言 → 对象」，否则 exit 2（防止 `Object.entries(', ')` 类事故重演）
for (const [ns, byLang] of Object.entries(SHARED)) {
  if (typeof byLang !== 'object' || byLang === null) { console.error(`!! SHARED.${ns} 非对象`); process.exit(2) }
  for (const lang of LANGS) {
    const row = byLang[lang]
    if (typeof row !== 'object' || row === null || Array.isArray(row)) { console.error(`!! SHARED.${ns}.${lang} 非对象`); process.exit(2) }
    for (const [k, v] of Object.entries(row)) {
      if (typeof v !== 'string' || !v.trim()) { console.error(`!! SHARED.${ns}.${lang}.${k} 非非空字符串`); process.exit(2) }
    }
  }
}

const tables = {}
for (const lang of LANGS) tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))

// ② 命名空间铁律：不得与既有顶层**字符串**键同名
for (const ns of Object.keys(SHARED)) {
  for (const lang of LANGS) {
    const existing = tables[lang][ns]
    if (existing !== undefined && (typeof existing !== 'object' || existing === null)) {
      console.error(`!! 命名空间冲突：${lang}.${ns} 已存在且非对象（既有顶层字符串键）`)
      process.exit(2)
    }
  }
}

let written = 0
for (const lang of LANGS) {
  for (const [ns, byLang] of Object.entries(SHARED)) {
    const before = tables[lang][ns] || {}
    tables[lang][ns] = { ...before, ...byLang[lang] }
    written += Object.keys(byLang[lang]).length
  }
}

// ③ 收尾自检（写盘前算，写盘后再复算一次）
let fail = 0
const counts = {}
for (const lang of LANGS) counts[lang] = { top: Object.keys(tables[lang]).length, flat: keyPaths(tables[lang]).length }
const zhSet = keyPaths(tables.zh)
for (const lang of LANGS.slice(1)) {
  const s = keyPaths(tables[lang])
  if (JSON.stringify(s) !== JSON.stringify(zhSet)) { console.error(`!! 键集不等：${lang} vs zh`); fail += 1 }
}
if (new Set(LANGS.map((l) => counts[l].flat)).size !== 1) { console.error('!! 四文件拍平键数取值集合不为单元素'); fail += 1 }

// ④ en/vn 本批键零 CJK
let lcjk = 0
for (const ns of Object.keys(SHARED)) {
  for (const lang of ['en', 'vn']) {
    for (const [k, v] of Object.entries(tables[lang][ns])) {
      if (CJK.test(v)) { console.error(`!! CJK ${lang}.${ns}.${k} = ${v}`); lcjk += 1 }
    }
  }
}

console.log('[B5-locales] 命名空间 =', Object.keys(SHARED).join(' / '),
  '（键数 =', Object.entries(SHARED).map(([ns, byLang]) => `${ns}:${Object.keys(byLang.zh).length}`).join(' / '), `共 ${written / LANGS.length} 键 × 4 语）`)
for (const lang of LANGS) console.log(`  ${lang}: top=${counts[lang].top} flat=${counts[lang].flat}`)
console.log(`[B5-locales] 键集相等：${fail === 0 ? 'PASS' : 'FAIL'}；en/vn 本批键残留 CJK = ${lcjk}（断言 == 0）`)

if (fail || lcjk) { console.error('[B5-locales] 自检未过 ⇒ 不落盘'); process.exit(1) }

if (DRY) { console.log('[B5-locales] --dry：仅校验，未写盘'); process.exit(0) }

for (const lang of LANGS) {
  fs.writeFileSync(path.join(SRC, `locales/${lang}.json`), `${JSON.stringify(tables[lang], null, 2)}\n`, 'utf8')
}
console.log('[B5-locales] 已写盘：', LANGS.map((l) => `locales/${l}.json`).join(' / '))
process.exit(0)
