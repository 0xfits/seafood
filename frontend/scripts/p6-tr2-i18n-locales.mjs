#!/usr/bin/env node
/**
 * TR-2 · 四语 locale 键集读数 + 「翻译中」小标接线静态断言（本单新增几何/断言脚本）
 *
 * 口径（§5.7 ⑤：报数带口径；不得把「代码推断」写成「实测」）：
 *   ① 键数 = **顶层键数** + **拍平键路径数**（逐文件）；
 *   ② 键集相等 = 拍平后的键路径集合逐文件 `===`（排序后逐项对拍）；
 *   ③ 新键 `i18n.translating` 四语齐备、非空串；
 *   ④ 静态断言：新接的 6 个文件里**不得**出现 `_(en|hk|vn)\s*\?\?`（空串会穿透 `??`）；
 *      存量登记 = **空**（B2 已把 `TaskPage.jsx` / `RewardPage.jsx` 单点收口到 `pickLocalized`；
 *      B5 的 D7 最后一项把 `pages/HomePage.jsx` 也改走 `pickLocalized`）⇒ `LEGACY = []`，
 *      名单一旦非空即打印其 `??` 命中，不再有「预期非 0」的行。
 *
 * 用法：node scripts/p6-tr2-i18n-locales.mjs     （只读，不写任何文件）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LANGS = ['zh', 'en', 'hk', 'vn']

const keyPaths = (obj, prefix = '') => Object.entries(obj).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? keyPaths(v, `${prefix}${k}.`) : [`${prefix}${k}`]
)).sort()

const tables = {}
const counts = {}
for (const lang of LANGS) {
  tables[lang] = JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))
  counts[lang] = { top: Object.keys(tables[lang]).length, flat: keyPaths(tables[lang]).length }
}

console.log('[TR-2] 四语 locale 键数（口径：顶层键 / 拍平键路径）')
for (const lang of LANGS) console.log(`  ${lang}: top=${counts[lang].top} flat=${counts[lang].flat}`)

const flatTop = new Set(LANGS.map((l) => counts[l].flat))
const setDiff = []
for (const lang of LANGS.slice(1)) {
  const a = keyPaths(tables.zh)
  const b = keyPaths(tables[lang])
  const onlyZh = a.filter((k) => !b.includes(k))
  const onlyLang = b.filter((k) => !a.includes(k))
  if (onlyZh.length || onlyLang.length) setDiff.push({ lang, onlyZh, onlyLang })
}
console.log(`[TR-2] 键集相等：${setDiff.length === 0 && flatTop.size === 1 ? 'PASS' : 'FAIL'}（四文件拍平键数取值集合 = {${[...flatTop].join(', ')}}）`)
if (setDiff.length) {
  for (const d of setDiff) console.log(`  ! ${d.lang}: only-zh=${JSON.stringify(d.onlyZh)} only-${d.lang}=${JSON.stringify(d.onlyLang)}`)
}

console.log('[TR-2] 新键 i18n.translating 四语读数')
let badgeOk = true
for (const lang of LANGS) {
  const value = tables[lang]?.i18n?.translating
  const ok = typeof value === 'string' && value.trim().length > 0
  if (!ok) badgeOk = false
  console.log(`  ${lang}: ${ok ? JSON.stringify(value) : 'MISSING'}`)
}
const distinct = new Set(LANGS.map((l) => tables[l].i18n.translating)).size
console.log(`[TR-2] 四语齐备=${badgeOk ? 'PASS' : 'FAIL'}；四语互异取值数=${distinct}/4`)

const WIRED = [
  'pages/listings/ListingsPage.jsx',
  'pages/listings/ListingDetailPage.jsx',
  'pages/jobs/JobDetailPage.jsx',
  'pages/jobs/JobReviewPage.jsx',
  'pages/market/MarketPage.jsx',
  'pages/ProfilePage.jsx',
]
// D7 收口（P6-I18N-LIT-B2 + B5）：`TaskPage.jsx` / `RewardPage.jsx` 由 B2 收口，
// `pages/HomePage.jsx` 由 B5 收口（`_en ?? base` 全仓命中已为 0，
// 见 `src/test/unit/i18n-content-wiring.test.jsx` / `i18n-batch-b5.test.jsx`）
// ⇒ 存量名单**清零**。
const LEGACY = []

console.log('[TR-2] 静态断言：新接文件不得用 `??` 取多语列（`||` 方可防空串穿透）')
let guardOk = true
for (const rel of WIRED) {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
  const hits = text.match(/_(en|hk|vn)\s*\?\?/g) || []
  const wired = text.includes('i18n-content')
  if (hits.length || !wired) guardOk = false
  console.log(`  ${rel}: ??命中=${hits.length} 经i18n-content=${wired ? 'yes' : 'NO'}`)
}
console.log(`[TR-2] 新接文件守卫=${guardOk ? 'PASS' : 'FAIL'}`)

console.log(`[TR-2] 存量登记（只核不改）：仍在旧三目链 + \`??\` 上的页面数 = ${LEGACY.length} 页（D7 收口后应为 0 页）`)
for (const rel of LEGACY) {
  const text = fs.readFileSync(path.join(SRC, rel), 'utf8')
  const hits = text.match(/_(en|hk|vn)\s*\?\?/g) || []
  console.log(`  ${rel}: ??命中=${hits.length}（登记；应在下单单点收口）`)
}
const legacyOk = LEGACY.length === 0

const overall = badgeOk && flatTop.size === 1 && setDiff.length === 0 && guardOk && legacyOk
console.log(`[TR-2] 总判：${overall ? 'PASS' : 'FAIL'}`)
// 批 7-A 修：`process.exit()` 会丢弃未 flush 的管道 stdout（同 `p4z-i18nviol-global.mjs`）⇒ 改设 `exitCode`。
process.exitCode = overall ? 0 : 1
