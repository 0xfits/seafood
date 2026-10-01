#!/usr/bin/env node
/**
 * P6-I18N-LIT-B5 · 类级断言（与 `p4z-i18nb4b-cjk.mjs` 同形，逐条可比）
 *
 * 口径（§5.7 ③：报数带口径；不得把「代码推断」写成「实测」）：
 *   ① 产品可见面写集 = 本批 9 个文件（组件库 6 + `pages/ThemePreviewPage.jsx` +
 *      `pages/HomePage.jsx` 必做② 落点 + `pages/admin/SystemSettings.jsx` 必做① 落点）；
 *   ② 先剥注释（字符级状态机；字符串内斜杠不误伤），只对**剥注释后**的面统计；
 *   ③ CJK = U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF（表意文字；纯标点/全角括号不计）；
 *   ④ 工程口径 token = § / 410 / R107 / api/ / sunset，只对**用户可见文案面**成立：
 *      含 fetchApiJson( / fetch( / import / require( / from ' 的行判为**代码位**（接口路径本来就必须写），
 *      命中只登记、不计入断言（同 B4b §3.3 口径）。
 *   ⑤ **批内非产品面登记（豁免，逐条给理由，不是放宽断言）**：
 *      · `pages/theme-preview-demo.js` —— `/theme-preview` 开发/比选预览页的**演示数据**
 *        （language 不变式：四语档下取值逐字相同；翻成四语会改文本推进宽度、破坏本页要证明的
 *        「几何逐值相等」判据）⇒ 见 recon 表②-c 与 demo 模块头部；
 *      · `theme/tokens.js` 的 `EXCLUDED_FROM_THEME` —— 主题 token **开发登记表**（含 文件:行号 与理由），
 *        **仅被 `src/test/unit/theme-tokens.test.js` 消费，任何 UI 都不渲染**（全仓 grep 佐证）。
 *      二者按「注释等价物」处置：逐行登记、不计入 ① 的命中。
 *   ⑥ locale 面 = 本批新增 `uiCommon` / `uiError` 全键 + 本批**复用**的既有顶层键
 *      `prev` / `next` / `noData` / `error` / `loading`（(a) 已有键未用一档）。
 *
 * 用法：node scripts/p4z-i18nb5-cjk.mjs [--list]   （退出码：全项 0 => 0）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LIST = process.argv.includes('--list')
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/
const ENG = [/§/, /410/, /R107/, /api\//, /sunset/]
const CODE_LINE = /fetchApiJson\(|fetch\(|import\s|require\(|from\s+['"]/

// ① 产品可见面写集（本批）
const WRITE_SET = [
  'components/ui/Advanced.jsx',
  'components/ui/DashJ.jsx',
  'components/ui/DataDisplay.jsx',
  'components/ui/ErrorHandling.jsx',
  'components/ui/Loading.jsx',
  'components/ui/Performance.jsx',
  'pages/ThemePreviewPage.jsx',
  'pages/HomePage.jsx',
  'pages/admin/SystemSettings.jsx',
]

// ⑤ 批内非产品面（登记豁免；`range` = 该文件内允许保留 CJK 的闭区间标记）
const REGISTERED = [
  {
    rel: 'pages/theme-preview-demo.js',
    why: '演示/校验用数据（非产品发布面；language 不变式）',
    range: null, // 整文件
  },
  {
    rel: 'theme/tokens.js',
    why: 'EXCLUDED_FROM_THEME 开发登记表（仅测试消费，UI 零渲染）',
    range: ['export const EXCLUDED_FROM_THEME = [', ']'],
  },
]

// ⑥ locale 面
const LOCALE_KEYS = { uiCommon: '*', uiError: '*' }
const LOCALE_PLAIN = ['prev', 'next', 'noData', 'error', 'loading']
const LANGS = ['zh', 'hk', 'en', 'vn']

const stripComments = (text) => {
  let out = ''
  let i = 0
  const n = text.length
  let state = null // null | "'" | '"' | '`' | '//' | '/*'
  while (i < n) {
    const ch = text[i]
    const nx = i + 1 < n ? text[i + 1] : ''
    if (state === null) {
      if (ch === '/' && nx === '/') { state = '//'; out += '  '; i += 2; continue }
      if (ch === '/' && nx === '*') { state = '/*'; out += '  '; i += 2; continue }
      if (ch === '"' || ch === "'" || ch === '`') { state = ch; out += ch; i += 1; continue }
      out += ch; i += 1; continue
    }
    if (state === '//') { if (ch === '\n') { state = null; out += '\n' } else { out += ' ' } i += 1; continue }
    if (state === '/*') {
      if (ch === '*' && nx === '/') { state = null; out += '  '; i += 2; continue }
      out += ch === '\n' ? '\n' : ' '; i += 1; continue
    }
    if (ch === '\\') { out += ch + nx; i += 2; continue }
    if (ch === state) { state = null }
    out += ch; i += 1
  }
  return out
}

const scan = (rel, range) => {
  const abs = path.join(SRC, rel)
  const raw = fs.readFileSync(abs, 'utf8')
  const bare = stripComments(raw)
  if (bare.length !== raw.length) { console.log(`  !! ${rel}: 剥离后长度不一致（${raw.length} vs ${bare.length}）`); process.exit(2) }
  const rawLines = raw.split('\n')
  const bareLines = bare.split('\n')
  let from = 1
  let to = bareLines.length
  if (range) {
    const [open, close] = range
    from = bareLines.findIndex((l) => l.includes(open)) + 1
    if (!from) { console.log(`  !! ${rel}: 找不到区间起始 '${open}'`); process.exit(2) }
    const rel2 = bareLines.slice(from).findIndex((l) => l.trim() === close)
    if (rel2 < 0) { console.log(`  !! ${rel}: 找不到区间结束 '${close}'`); process.exit(2) }
    to = from + rel2
  }
  const cjkHits = []
  const engHits = []
  const codeLines = []
  const comments = []
  const exempt = []
  bareLines.forEach((line, idx) => {
    const ln = idx + 1
    const inRange = ln >= from && ln <= to
    const isCjk = CJK.test(line)
    const rawEng = ENG.some((re) => re.test(line))
    const isCode = CODE_LINE.test(line)
    const isEng = rawEng && !isCode
    if (isCjk || isEng) {
      if (inRange) exempt.push(ln)
      else if (isCjk) cjkHits.push(ln)
      else engHits.push(ln)
    }
    if (rawEng && isCode && !inRange) codeLines.push(ln)
    if (!isCjk && !rawEng && (CJK.test(rawLines[idx]) || ENG.some((re) => re.test(rawLines[idx])))) comments.push(ln)
  })
  return { cjkHits, engHits, codeLines, comments, exempt, rawLines }
}

let cjkTotal = 0
let engTotal = 0
let codeTotal = 0
let commentTotal = 0
console.log('[B5-CJK] ① 产品可见面写集（9 文件）；口径 = 剥注释后残留 CJK（表意文字）')
for (const rel of WRITE_SET) {
  const { cjkHits, engHits, codeLines, comments, rawLines } = scan(rel, null)
  cjkTotal += cjkHits.length
  engTotal += engHits.length
  codeTotal += codeLines.length
  commentTotal += comments.length
  console.log(`  ${rel}: CJK 命中=${cjkHits.length}${cjkHits.length ? ' @L' + cjkHits.join(',L') : ''}；工程口径(文案面)命中=${engHits.length}${engHits.length ? ' @L' + engHits.join(',L') : ''}；代码位登记=${codeLines.length}；注释登记行=${comments.length}`)
  if (LIST) {
    for (const ln of cjkHits) console.log(`      CJK L${ln}: ${rawLines[ln - 1].trim()}`)
    for (const ln of engHits) console.log(`      ENG L${ln}: ${rawLines[ln - 1].trim()}`)
  }
}
console.log(`[B5-CJK] ① 写集：CJK 字面量命中 = ${cjkTotal}（断言 == 0）；工程口径(用户可见文案面)命中 = ${engTotal}（断言 == 0）；代码位登记 = ${codeTotal}；注释登记行 = ${commentTotal}`)

let exemptTotal = 0
let exemptUnexpected = 0
console.log('[B5-CJK] ⑤ 批内**非产品面**登记（豁免，逐条给理由；不计入 ① 的命中）')
for (const { rel, why, range } of REGISTERED) {
  const { exempt, cjkHits, engHits } = scan(rel, range)
  exemptTotal += exempt.length
  exemptUnexpected += cjkHits.length + engHits.length
  console.log(`  ${rel}: 登记保留行 = ${exempt.length}${exempt.length ? ' @L' + exempt.join(',L') : ''}；区间外命中 = ${cjkHits.length + engHits.length}（断言 == 0）—— 理由：${why}`)
  if (LIST) for (const ln of exempt) console.log(`      登记 L${ln}: ${fs.readFileSync(path.join(SRC, rel), 'utf8').split('\n')[ln - 1].trim()}`)
}

const locales = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))]))
let lcjk = 0
let leng = 0
const bad = []
for (const lang of LANGS) {
  const table = locales[lang]
  const targets = []
  for (const [ns, spec] of Object.entries(LOCALE_KEYS)) {
    const obj = table[ns]
    if (typeof obj !== 'object' || obj === null) { console.log(`  !! ${lang}.${ns} 缺失`); process.exit(2) }
    for (const k of (spec === '*' ? Object.keys(obj) : spec)) targets.push([`${ns}.${k}`, obj[k]])
  }
  for (const k of LOCALE_PLAIN) targets.push([k, table[k]])
  for (const [key, v] of targets) {
    if (typeof v !== 'string') { console.log(`  !! ${lang}.${key} 非字符串`); process.exit(2) }
    if (CJK.test(v) && (lang === 'en' || lang === 'vn')) { lcjk += 1; bad.push(`CJK ${lang}.${key} = ${v}`) }
    for (const re of ENG) if (re.test(v)) { leng += 1; bad.push(`ENG ${lang}.${key} = ${v}`) }
  }
}
console.log('[B5-CJK] ③ locale 面（本批新增 uiCommon/uiError 全键 + 复用键 prev/next/noData/error/loading）：'
  + 'en/vn 残留 CJK = ' + lcjk + '（断言 == 0）；四语工程口径残留 = ' + leng + '（断言 == 0）')
if (bad.length) for (const b of bad) console.log(`      ${b}`)

const overall = cjkTotal === 0 && engTotal === 0 && lcjk === 0 && leng === 0 && exemptUnexpected === 0
console.log(`[B5-CJK] 总判：${overall ? 'PASS' : 'FAIL'}（产品可见面代码 CJK=${cjkTotal} / 代码工程口径=${engTotal} / locale CJK(en,vn)=${lcjk} / locale 工程口径=${leng} / 非产品面区间外命中=${exemptUnexpected}，全项 == 0；**登记豁免** = ${exemptTotal} 行，逐条理由见上）`)
process.exit(overall ? 0 : 1)
