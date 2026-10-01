#!/usr/bin/env node
/**
 * P6-I18N-LIT-B4b · ① 本批写集「用户可见面 CJK 字面量」类级断言
 *                     ② 本批写集「用户可见面 工程口径残留」类级断言（§ / 410 / R107 / api/ / sunset）
 *                     ③ B4a 既有后台面只读登记（供总收尾对账）
 *
 * 口径（§5.7 ②：报数带口径；与 `p4z-i18nb4a-cjk.mjs` 同形，逐条可比）：
 *   ① 写集 = B4b 的 5 个后台页面 + `pages/DashboardPage.jsx`（必做① 分隔符落点）；
 *   ② 先用字符级状态机剥离注释（行注释 + 块注释；字符串内的斜杠不误伤），保留字符串与 JSX 文本；
 *   ③ CJK = U+4E00–9FFF / U+3400–4DBF / U+F900–FAFF（表意文字；纯标点如「、」「：」「。」不计）；
 *   ④ 剥离注释后仍含 CJK ⇒ 命中（写集应收敛为 0）；注释里的 CJK 逐行登记（不计命中）；
 *   ⑤ 工程口径 token = § / 410 / R107 / api/ / sunset（**小写敏感匹配 `api/`**），同样只在剥注释后的
 *      用户可见面统计；注释内命中逐行登记（`§5.1` / `410` 等实现细节允许留在注释里，不计入）；
 *   ⑥ ④/⑤ 同为硬门（== 0），任一非 0 ⇒ 退出码 1。
 * 用法：node scripts/p4z-i18nb4b-cjk.mjs [--list]   （退出码：两项全 0 => 0）
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')
const LIST = process.argv.includes('--list')
const CJK = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF]/
const ENG = [/§/, /410/, /R107/, /api\//, /sunset/]
// 「工程口径」token 只对**用户可见文案面**成立，不对代码调用位成立：
//   `fetchApiJson('/api/admin/permissions')` 是接口调用（本来就必须写路径），不是给用户看的文案。
//   ⇒ 含下列形态的行判为「代码位」，其 token 命中只登记、不计入断言（口径见报告）。
const CODE_LINE = /fetchApiJson\(|fetch\(|import\s|require\(|from\s+['"]/
// 语言选择器内的语言名按**母语自书**（endonym）⇒ en/vn 档出现 `中文` / `繁體中文` 属预期，
//   逐键登记豁免（其余 en/vn 文案一律不得含 CJK）。
const ENDONYM_ALLOWLIST = new Set(['adminSettings.langZh', 'adminSettings.langHk'])

// 本批写集（B4b 范围 + 必做① 落点）
const WRITE_SET = [
  'pages/admin/PermissionsManagement.jsx',
  'pages/admin/PointsManagement.jsx',
  'pages/admin/ShardsManagement.jsx',
  'pages/admin/SystemSettings.jsx',
  'pages/admin/UsersManagement.jsx',
  'pages/DashboardPage.jsx',
]
// 本批同步改写的 locale 键（用户可见文案面）——同样纳入类级断言
const LOCALE_KEYS = {
  adminCommon: ['notLoggedIn', 'noAdminAccess', 'normalUser', 'adminRole', 'colUserId', 'colWallet', 'colPoints',
    'colUpdated', 'colRole', 'colActions', 'colRegistered', 'colLastLogin', 'colBio', 'noMatchingUsers', 'saving',
    'readOnlyNotice', 'statUsers', 'statTotalPoints', 'refreshData'],
  adminPermissions: '*', adminPoints: '*', adminShards: '*', adminSettings: '*', adminUsers: '*',
  adminTasks: ['readOnlyNotice'], adminRewards: ['readOnlyNotice'], // 必做② 收口（B4a 遗留工程口径）
  common: ['listSeparator'],
}
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

const scan = (rel) => {
  const abs = path.join(SRC, rel)
  const raw = fs.readFileSync(abs, 'utf8')
  const bare = stripComments(raw)
  if (bare.length !== raw.length) { console.log(`  !! ${rel}: 剥离后长度不一致（${raw.length} vs ${bare.length}）`); process.exit(2) }
  const rawLines = raw.split('\n')
  const bareLines = bare.split('\n')
  const cjkHits = []
  const engHits = []
  const codeLines = []
  const comments = []
  bareLines.forEach((line, idx) => {
    const isCjk = CJK.test(line)
    const rawEng = ENG.some((re) => re.test(line))
    const isCode = CODE_LINE.test(line)
    const isEng = rawEng && !isCode
    if (isCjk) cjkHits.push(idx + 1)
    if (isEng) engHits.push(idx + 1)
    if (rawEng && isCode) codeLines.push(idx + 1)
    if (!isCjk && !rawEng && (CJK.test(rawLines[idx]) || ENG.some((re) => re.test(rawLines[idx])))) comments.push(idx + 1)
  })
  return { cjkHits, engHits, codeLines, comments, rawLines }
}

let cjkTotal = 0
let engTotal = 0
let codeTotal = 0
let commentTotal = 0
console.log('[B4b-CJK] ① 写集 = 后台剩余 5 面 + DashboardPage；口径 = 剥注释后残留 CJK（表意文字）')
for (const rel of WRITE_SET) {
  const { cjkHits, engHits, codeLines, comments, rawLines } = scan(rel)
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
console.log(`[B4b-CJK] ① 代码写集：CJK 字面量命中 = ${cjkTotal}（断言 == 0）；工程口径(用户可见文案面)命中 = ${engTotal}（断言 == 0）；代码位登记 = ${codeTotal}（接口调用路径，非文案面）；注释登记行 = ${commentTotal}`)

// ② locale 文案面（本批改写键）同类断言
const locales = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))]))
let lcjk = 0
let leng = 0
const endonyms = []
const bad = []
for (const lang of LANGS) {
  const table = locales[lang]
  for (const [ns, spec] of Object.entries(LOCALE_KEYS)) {
    const obj = table[ns]
    if (typeof obj !== 'object' || obj === null) { console.log(`  !! ${lang}.${ns} 缺失`); process.exit(2) }
    const keys = spec === '*' ? Object.keys(obj) : spec
    for (const k of keys) {
      const v = obj[k]
      if (typeof v !== 'string') { console.log(`  !! ${lang}.${ns}.${k} 非字符串`); process.exit(2) }
      if (CJK.test(v) && (lang === 'en' || lang === 'vn')) {
        if (ENDONYM_ALLOWLIST.has(`${ns}.${k}`)) endonyms.push(`${lang}.${ns}.${k} = ${v}`)
        else { lcjk += 1; bad.push(`CJK ${lang}.${ns}.${k} = ${v}`) }
      }
      for (const re of ENG) if (re.test(v)) { leng += 1; bad.push(`ENG ${lang}.${ns}.${k} = ${v}`) }
    }
  }
}
console.log('[B4b-CJK] ② locale 文案面（本批改写键）：en/vn 残留 CJK = ' + lcjk + '（断言 == 0）；四语工程口径残留 = ' + leng + '（断言 == 0）')
console.log(`[B4b-CJK] ② 登记豁免（语言选择器 endonym，不计入）：${endonyms.length} 处 —— ${endonyms.join('；')}`)
if (bad.length) for (const b of bad) console.log(`      ${b}`)

const overall = cjkTotal === 0 && engTotal === 0 && lcjk === 0 && leng === 0
console.log(`[B4b-CJK] 总判：${overall ? 'PASS' : 'FAIL'}（代码 CJK=${cjkTotal} / 代码工程口径=${engTotal} / locale CJK(en,vn)=${lcjk} / locale 工程口径=${leng}，全项 == 0）`)
process.exit(overall ? 0 : 1)
