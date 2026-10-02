#!/usr/bin/env node
/**
 * I18N-VIOL-CLOSEOUT · **全量面**类级断言：用户可见文案里不得残留「工程口径 / 开发者黑话」
 *
 * ── 为什么是「全量面」（B4b 根因的正面修法）──────────────────────────────────
 * B4b 的类级断言只扫了**本批写集**（几个 locale 键），于是 `/shard`·`/listing`·`/listing/:id`
 * 三页面上 `GET /api/…`×5 + `POST /api/…`×2 + `403/400` + `base_cid` + `listing.stock`
 * 这些实现细节一路进了 652 集 locale、还被翻成了英/繁/越 —— 不是漏译，是**源头收录**。
 * ⇒ 本脚本的作用域**不是本单写集**，而是：
 *      ① `src/locales/{zh,hk,en,vn}.json` **四文件全部值**（逐键逐语）；
 *      ② `src/pages/**`、`src/components/**`、`src/shell/**` **全部源文件**的用户可见文案面
 *         （JSX 文本节点 + 用户可见属性串）。
 *   并**打印作用域命中的节点数**（命中 0 或明显偏少 ⇒ 断言无效，不得当「零违例」）。
 *
 * ── 口径（§5.7 ⑤：不得把「代码推断」写成「实测」）────────────────────────────
 *   · 用户可见文案面（源侧）**只取**：JSX 文本节点 `>…<`（排除 `{}` 插值）与
 *     `title|placeholder|aria-label|alt|label="…"` 属性串；**代码位与注释行单列登记、不计命中**
 *     （逐条给 `文件:行` 与理由）。数据驱动的原样渲染（如 `row.status`）另列**残余发现**，
 *     不计命中但必须打印 —— 不静默放水。
 *   · 白名单（EXEMPT）**逐条列名 + 理由**，不设通配；任何新增豁免必须在此文件显式登记。
 *
 * 用法：node scripts/p4z-i18nviol-global.mjs   （只读，不写任何文件；退出码 = 是否零违例）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LANGS = ['zh', 'hk', 'en', 'vn']

/** 工程口径 / 黑话（逐条命名，命中即违例） */
const BLACKLIST = [
  ['章节号', /§/],
  ['HTTP 动词+路径', /\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+\//],
  ['接口路径', /\/api\//],
  ['HTTP 状态码', /\b(400|401|402|403|404|405|409|410|418|422|429|500|502|503|504)\b/],
  ['DB 表/列名', /\b(base_cid|quote_cid|listing\.stock|listing_order|job_escrow|task_progress|prize_item)\b/],
  ['SQL/事务', /ON CONFLICT|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE FROM\b/],
  ['幂等键实现', /幂等|冪等|idempotenc|(^|[^a-z])cli:<|\bcli:[a-z0-9-]/],
  ['口径黑话', /读面|讀面|读口|讀口|写口|寫口|写面|寫面|读侧|讀側|换源|換源|派生|直\s*DML|无分录|無分錄/],
  ['注册态口径', /未注册|未註冊|尚未注册|尚未註冊|已注册|已註冊|已登記|已登记/],
  ['服务端/前端口径', /服务端|伺服器端|伺服器取數|伺服器恆|伺服器派生|后端返回|前端提供|前端不/],
  ['轴/字段口径', /买家轴|買家軸|卖家轴|賣家軸|status=|_uid\b|\buID\b|\bbID\b/],
  ['数值口径', /amount\s*[×x*]\s*price|amount[×x]price/],
  ['权限 token', /\b(manage_[a-z]+|review_tasks|publish_prizes|publish_tasks)\b/],
  ['原样枚举值', /^(listed|draft|paid|unpaid|cancelled|canceled|pending|sunset|deprecated)$/],
]

/** 显式豁免（逐条列名 + 理由；不得通配） */
const EXEMPT_LOCALE_KEYS = [
  // 既有（非本单写集）：语言自称 / 粵語口号 —— 产品口径，且不放宽其它键
  ['chinese', '语言自称（endonym）'],
  ['cantonese', '语言自称（endonym）'],
  ['adminSettings.langZh', '语言自称（「中文」）'],
  ['adminSettings.langHk', '语言自称（「粵語」）'],
  ['footer.catSlogan1', '既有粵語口号（非本单写集，产品口径）'],
  ['footer.catSlogan2', '既有粵語口号（非本单写集，产品口径）'],
  ['footer.catSlogan3', '既有粵語口号（非本单写集，产品口径）'],
  ['footer.cloudSlogan', '既有粵語口号（非本单写集，产品口径）'],
  // 管理员面：token 即 UI **输入字面**（删则功能不可用），非给用户看的说明口径
  ['adminPermissions.permissionsPlaceholder', '管理员输入语法示例（token 即要输入的值）'],
]

/** 源侧显式豁免 · 文案节点（逐条：位置 + 命中串 + 理由；不得通配） */
const EXEMPT_SOURCE_NODES = [
  ['components/ui/ErrorHandling.jsx:318', '404', '404 错误页装饰性大数字：业界通用视觉惯例（非实现细节），且同屏已有本地化 `uiError.notFoundTitle/Body`'],
]

/** 源侧显式豁免 · 硬编码字面量（逐条：位置 + 命中串 + 理由；不得通配） */
const EXEMPT_SOURCE_LITERALS = [
  ['pages/theme-preview-demo.js:39', '$410/天', '主题预览页 mock 演示数据：日薪金额字面（`$410/天`），非 HTTP 状态码'],
]

const CJK = /[\u3400-\u9fff]/
const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))

let fail = false

// ── ① 全量 locale 面 ───────────────────────────────────────────────────────
const tables = {}
for (const lang of LANGS) {
  tables[lang] = Object.fromEntries(flat(JSON.parse(fs.readFileSync(path.join(SRC, `locales/${lang}.json`), 'utf8'))))
}
const keys = Object.keys(tables.zh)
const LOCALE_NODES = keys.length * LANGS.length
console.log('[I18N-VIOL] ① 全量 locale 面（作用域 = 四文件 × 全部值）')
console.log(`  作用域命中节点数 = ${LOCALE_NODES}（键 ${keys.length} × 语 ${LANGS.length}）`)
const exemptSet = new Set(EXEMPT_LOCALE_KEYS.map(([k]) => k))
const localeHits = []
for (const k of keys) {
  for (const lang of LANGS) {
    const v = tables[lang][k]
    if (typeof v !== 'string' || exemptSet.has(k)) continue
    for (const [name, re] of BLACKLIST) {
      if (re.test(v)) localeHits.push({ k, lang, name, v })
    }
  }
}
console.log(`  裸命中 = ${localeHits.length}`)
for (const h of localeHits) console.log(`  ! ${h.lang} ${h.k} [${h.name}] ${JSON.stringify(h.v)}`)
if (localeHits.length) fail = true
console.log(`  显式豁免登记 = ${EXEMPT_LOCALE_KEYS.length} 条`)
for (const [k, why] of EXEMPT_LOCALE_KEYS) {
  const vals = LANGS.map((l) => String(tables[l][k] ?? 'MISSING'))
  console.log(`    ~ ${k} :: ${why} :: zh=${JSON.stringify(vals[0])} en=${JSON.stringify(vals[2])}`)
}

// 四语互异 / 键集（键名与键集不得变）
const flatCounts = new Set(LANGS.map((l) => Object.keys(tables[l]).length))
console.log(`[I18N-VIOL] ① 键集读数：四文件拍平键数取值集合 = {${[...flatCounts].join(', ')}}（应单值）`)
if (flatCounts.size !== 1) fail = true

// en/vn 不得残留中文（除语言自称等显式豁免）
const cjkHits = []
for (const lang of ['en', 'vn']) {
  for (const k of keys) {
    const v = tables[lang][k]
    if (typeof v === 'string' && CJK.test(v) && !exemptSet.has(k)) cjkHits.push(`${lang}.${k}`)
  }
}
console.log(`[I18N-VIOL] ① en/vn 残留中文（豁免外）= ${cjkHits.length} ${JSON.stringify(cjkHits)}`)
if (cjkHits.length) fail = true

// ── ② 全量页面源文件（用户可见文案面）────────────────────────────────────────
const SRC_DIRS = ['pages', 'components', 'shell']
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p)
  }
  return out
}
const files = SRC_DIRS.flatMap((d) => (fs.existsSync(path.join(SRC, d)) ? walk(path.join(SRC, d)) : []))
const isComment = (t) => /^(\/\/|\*|\/\*|\*\/)/.test(t)
const TEXT_NODE = />([^<>{}]+)</g
const ATTR = /(?:title|placeholder|aria-label|alt|label)\s*=\s*"([^"]*)"/g
const CJK_LITERAL = /(['"`])((?:(?!\1).)*[\u3400-\u9fff](?:(?!\1).)*)\1/g

let textNodes = 0
let codePositions = 0
let cjkLiterals = 0
const hardcodedCjkHits = []
const sourceHits = []
const commentReg = []
const codeReg = []
for (const f of files) {
  const rel = path.relative(SRC, f)
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  lines.forEach((raw, i) => {
    const t = raw.trim()
    const no = i + 1
    if (isComment(t)) {
      // 注释行：单列登记（只登记「本可命中」的行，逐条给理由），不计命中
      for (const [, re] of BLACKLIST) {
        if (re.test(raw)) { commentReg.push(`${rel}:${no}`); break }
      }
      return
    }
    if (/\/api\//.test(raw) || /fetchApiJson\(\s*[`'"]/.test(raw)) {
      codePositions++
      codeReg.push(`${rel}:${no} 真实接口调用路径（代码位，非文案）`)
      return
    }
    for (const m of raw.matchAll(CJK_LITERAL)) {
      // 子面 ③：**硬编码中文文案**（非注释行里含 CJK 的引号字面量）——硬编码用户文案的经典违规面
      cjkLiterals++
      const s = m[2]
      const exemptedLit = EXEMPT_SOURCE_LITERALS.some(([w, hit]) => w === `${rel}:${no}` && hit === s)
      if (!exemptedLit) for (const [name, re] of BLACKLIST) if (re.test(s)) hardcodedCjkHits.push(`${rel}:${no} [${name}] ${JSON.stringify(s)}`)
    }
    for (const m of raw.matchAll(TEXT_NODE)) {
      const s = m[1].trim()
      if (!s) continue
      textNodes++
      const exemptedNode = EXEMPT_SOURCE_NODES.some(([w, hit]) => w === `${rel}:${no}` && hit === s)
      if (!exemptedNode) for (const [name, re] of BLACKLIST) if (re.test(s)) sourceHits.push({ where: `${rel}:${no}`, name, s })
    }
    for (const m of raw.matchAll(ATTR)) {
      const s = m[1].trim()
      if (!s) continue
      textNodes++
      const exemptedAttr = EXEMPT_SOURCE_NODES.some(([w, hit]) => w === `${rel}:${no}` && hit === s)
      if (!exemptedAttr) for (const [name, re] of BLACKLIST) if (re.test(s)) sourceHits.push({ where: `${rel}:${no}`, name, s })
    }
  })
}
console.log('[I18N-VIOL] ② 全量页面源文件面（作用域 = pages/components/shell 全部 .js/.jsx）')
console.log(`  扫描文件数 = ${files.length}；提取用户可见文案节点数 = ${textNodes}（JSX 文本节点 + 可见属性串）`)
console.log(`  裸命中 = ${sourceHits.length}`)
for (const h of sourceHits) console.log(`  ! ${h.where} [${h.name}] ${JSON.stringify(h.s)}`)
if (sourceHits.length) fail = true
console.log(`  注释行登记（本可命中，不计命中）= ${commentReg.length} 条 —— 理由：注释非用户可见面`)
console.log(`    ${commentReg.join(', ') || '(empty)'}`)
console.log(`  代码位登记（真实接口调用，不计命中）= ${codePositions} 条 —— 理由：代码位非文案`)
console.log(`    ${codeReg.slice(0, 6).join(' | ') || '(empty)'}${codeReg.length > 6 ? ` … 共 ${codeReg.length} 条` : ''}`)

console.log(`  子面③ 硬编码中文文案字面量（非注释行内的引号字面量）= ${cjkLiterals} 个；其中命中工程口径 = ${hardcodedCjkHits.length} 个 ${JSON.stringify(hardcodedCjkHits)} —— 理由：硬编码文案面，命中即违例`)
if (cjkHits.length) fail = true

// ── ③ 残余发现（**现取** —— 不计命中，但必须打印，不静默放水）─────────────────
//   原登记（批 6）：`ListingsPage.jsx` 状态标签 `String(row.status ?? t('listings.listed'))` 把
//     **数据里的**枚举（`draft`/`listed`）原样渲染给用户，当时「键集内无 draft 等标签键」⇒ 另单收口。
//   本单（小尾巴批 ①）核验收口：该页已实装 `listings.statusLabel.<value>` 查表
//     （取值域现取真源 = `backend-ts/migrations/0015_listing.sql:137`
//      `CHECK (status IN ('draft','listed','delisted','frozen'))`，DEFAULT `draft`；
//      `backend-ts/src/listing-service.ts:135-139` 同集）+ **未知取值本地化兜底**（`statusLabel.unknown`，
//      原值留 `title`/`data-sf-status`）⇒ 原登记项**作废**。
//   此处改为**现取**源码（不静默）：若「tag 内原样渲染 `row.status`」形态**重新出现**、
//     或查表 / 未知兜底被移除 ⇒ 重新登记为残余（读数即刻 > 0）。
const LISTINGS_PAGE_REL = 'pages/listings/ListingsPage.jsx'
const RESIDUAL = []
{
  const abs = path.join(SRC, LISTINGS_PAGE_REL)
  const raw = fs.existsSync(abs) ? fs.readFileSync(abs, 'utf8') : ''
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
  const RAW_RENDER = /sf-listings-tag[\s\S]{0,240}?String\(row\.status/   // 旧形态：tag 内直出枚举
  const LOOKUP = /listings\.statusLabel\./                               // 收口形态：查表在场
  const FALLBACK = /listings\.statusLabel\.unknown/                      // 未知值本地化兜底在场
  if (!raw) RESIDUAL.push([`src/${LISTINGS_PAGE_REL}`, '文件缺失 —— 无法核验状态枚举收口'])
  else if (RAW_RENDER.test(code) || !LOOKUP.test(code) || !FALLBACK.test(code)) {
    RESIDUAL.push([`src/${LISTINGS_PAGE_REL}`, '状态枚举又出现原样渲染 / 查表或未知兜底缺失（P6-MISC-FIX ① 收口被回退）'])
  }
}
console.log('[I18N-VIOL] ③ 残余发现（**现取**；不计命中，另单收口）')
console.log(`  现取核验：${LISTINGS_PAGE_REL} 状态标签收口 ⇒ 残留登记 = ${RESIDUAL.length} 条（原 1 条已由小尾巴批 ① 收口）`)
for (const [where, why] of RESIDUAL) console.log(`  ? ${where} :: ${why}`)

console.log(`[I18N-VIOL] 总判：${fail ? 'FAIL' : 'PASS'}（locale 裸命中 ${localeHits.length} + 源面裸命中 ${sourceHits.length} 必须 = 0；作用域节点数 locale=${LOCALE_NODES} / source=${textNodes}）`)
// 批 7-A 修：`process.exit()` 会**丢弃尚未 flush 的管道 stdout**（vitest worker 并发时实测截断 ⇒
//   包装用例读到「无 总判 行」的残缺输出而误报）。改设 `exitCode` 让 Node 自然退出（退出码不变，判据不变）。
process.exitCode = fail ? 1 : 0
