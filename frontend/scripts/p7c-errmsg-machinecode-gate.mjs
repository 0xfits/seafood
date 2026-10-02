#!/usr/bin/env node
/**
 * P7-C · F-1「错误文案面收口 · 护栏扩口径」· **类级断言**：用户可见文案**不得出现「全大写下划线
 * 机读码」**（如 `LEDGER_CURRENCY_INVALID_TRANSITION`）
 * ============================================================================
 * 立门动机（终审质检在 p7-B 面上采到，我裁定 = 本单 F-1）：
 *   退款拒收回执的 **HTTP 真体** = `{ error: { code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
 *   message: 'LEDGER_CURRENCY_INVALID_TRANSITION', i18n_key: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
 *   details: { reason: 'order_not_refundable', … } } }`。因 `ledger.err.*` 四语键缺失（已登记 P6/P7），
 *   `t(i18n_key)` 未命中 ⇒ 旧护栏链落到 ② 服务端原文；而旧护栏**只认「点分裸键 token」**（`x.y.z`），
 *   **不认「下划线机读码」** ⇒ 四语用户可见串 = 英文机读码 `LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)`。
 *   本门把「**不得把全大写下划线机读码当作文案输出**」落成一条机读判据（类级计数必须 = 0）。
 *
 * ── 判据（可判负）─────────────────────────────────────────────────────────────
 *   A **护栏在场（源码）**：`src/auth.js` 必须①具名导出 `MACHINE_CODE_TOKEN_RE` / `containsMachineCode`；
 *     ②`extractApiErrorMessage` 体内以 `containsMachineCode(` 收口（≥ 1 处）⇒ 拆掉扩口径 ⇒ A 判负。
 *   B **locale 文案面**：四语每个**叶子值**不得出现机读码 token（存量命中逐条打印登记；本单新增面零命中）。
 *   C **四语通用兜底齐备**：`auth.err.REQUEST_FAILED` 四语都存在、非空、非裸键、非机读码
 *     ⇒ 删任一语的兜底键 ⇒ C 判负（这就是扩口径后的落点 ③）。
 *   D **行为节点（★ 类级）**：**机读码 message 向量 × 4 语** —— 断言链产出**不含机读码 token**、
 *     不含 `details.reason` 后缀、且**逐字等于该语 `auth.err.REQUEST_FAILED` 真兜底**（F-1 409 真体）。
 *     类级违例计数（「全大写下划线机读码被当作文案输出」形态）必须 = 0。
 *   E **边界样本表自证（非空转）**：谓词正例（`LEDGER_CURRENCY_INVALID_TRANSITION` / `AUTH_UNAUTHORIZED` /
 *     `STATEMENT_TIMEOUT`）⇒ true；反例（`系统繁忙，请稍后重试 (too_many_connections)` / `Request failed (400)` /
 *     普通英文句 / 含小写词 / 空串 / 非字符串）⇒ false。
 *   F **反例面（O-1 边界回归）**：**真人可读**服务端 message（zh 句子 + 小写 reason / 英文句 / 裸 message）
 *     ⇒ 仍走 ② **服务端原文**（不得因本单把 zh 句子也当机读码）。
 *
 * ── 口径说明（诚实标注）──────────────────────────────────────────────────────
 *   · 本脚本是**纯 node 门**（无 vite 解析器，故 `src/i18n.js` 的 `./utils` 无扩展名导入在 node 下不可解析）
 *     ⇒ D/F 采用**链式决策镜像**（与 `resolveI18nMessage` / `extractApiErrorMessage` 逐条同序）而非真跑
 *     `apiErrorMessage`；镜像的**准入闸 = 从 `src/auth.js` 导入的真谓词**（A 已断言真链接线到它），
 *     真 locale 数据 + 真 i18next。**真跑证据**（真 `i18n` 实例 + 真 `apiErrorMessage` + 真 `ledger-api`）
 *     = `src/test/unit/p7c-errmsg-machinecode.test.js`。
 *   · 只读：不写任何文件。
 *
 * 用法：node scripts/p7c-errmsg-machinecode-gate.mjs [root]
 *       缺省 root = 本脚本上级目录（仓内 = `frontend/`）；给参可对**仓外镜像**判负
 *       （报告 §5 的判负自证②即用此形，零仓内污染）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '..')
const LANGS = ['zh', 'hk', 'en', 'vn']

const AUTH_JS = path.join(ROOT, 'src', 'auth.js')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales')

const GENERIC_KEY = 'auth.err.REQUEST_FAILED'

const fails = []
const fail = (msg) => fails.push(msg)

// ── 载入真谓词（从 `src/auth.js` 导入，**不重写**）───────────────────────────────
let containsMachineCode = null
let looksLikeMachineCode = null
let containsBareI18nKey = null
let authSrc = ''
let guardImportError = null
try {
  authSrc = fs.readFileSync(AUTH_JS, 'utf8')
  ;({ containsMachineCode, looksLikeMachineCode, containsBareI18nKey } = await import(pathToFileURL(AUTH_JS).href))
} catch (err) {
  guardImportError = err?.message || String(err)
}

let i18next = null
try {
  i18next = (await import('i18next')).default
} catch (err) {
  guardImportError = guardImportError || `i18next 导入失败：${err?.message || err}`
}

// ── A 护栏在场（源码）──────────────────────────────────────────────────────────
const extractBody = (() => {
  const start = authSrc.indexOf('const extractApiErrorMessage = (payload)')
  if (start < 0) return ''
  const end = authSrc.indexOf('\n}\n', start)
  return authSrc.slice(start, end < 0 ? authSrc.length : end)
})()
const hasMachineTokenExport = /export\s+const\s+MACHINE_CODE_TOKEN_RE\s*=/.test(authSrc)
const hasMachinePredicateExport = /export\s+const\s+containsMachineCode\s*=/.test(authSrc)
const machineCallsInExtract = (extractBody.match(/containsMachineCode\(/g) || []).length

console.log('[P7C-MACHINE-CODE] A 护栏在场（源码）：src/auth.js')
console.log('  ① 具名导出 `MACHINE_CODE_TOKEN_RE`（token 判据） = ' + hasMachineTokenExport)
console.log("  ①' 具名导出 `containsMachineCode`（谓词）        = " + hasMachinePredicateExport)
console.log('  ② `extractApiErrorMessage` 内 `containsMachineCode(` 调用数 = ' + machineCallsInExtract + '（要求 ≥ 1）')
if (!hasMachineTokenExport) fail('A① 缺具名导出 `MACHINE_CODE_TOKEN_RE`')
if (!hasMachinePredicateExport) fail("A①' 缺具名导出 `containsMachineCode`")
if (machineCallsInExtract < 1) fail(`A② 服务端 message 面未以机读码判据收口（containsMachineCode 调用 ${machineCallsInExtract} < 1）`)
const guardWired = hasMachineTokenExport && hasMachinePredicateExport && machineCallsInExtract >= 1

// ── 载入四语 locale ────────────────────────────────────────────────────────────
const locales = {}
const localeErrors = []
for (const lang of LANGS) {
  try {
    locales[lang] = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'))
  } catch (err) {
    localeErrors.push(`${lang}: ${err?.message || err}`)
  }
}
const langsLoaded = Object.keys(locales)

const flatten = (node, prefix = '', out = []) => {
  for (const [k, v] of Object.entries(node || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out.push([key, v])
  }
  return out
}

// ── B locale 文案面：叶子值不得出现机读码 token ────────────────────────────────
console.log('[P7C-MACHINE-CODE] B locale 文案面（四语叶子值机读码扫描）')
let localeNodes = 0
const codeValueHits = []
for (const lang of LANGS) {
  if (!locales[lang]) continue
  const leaves = flatten(locales[lang])
  localeNodes += leaves.length
  const bad = leaves.filter(([, v]) => containsMachineCode?.(v))
  for (const [k, v] of bad) codeValueHits.push(`${lang}:${k} = ${JSON.stringify(v)}`)
  console.log(`  [${lang}] 叶子值 = ${leaves.length}；含机读码 token = ${bad.length}`)
}
if (codeValueHits.length) {
  fail(`B locale 文案面存在机读码值 ${codeValueHits.length} 条`)
  for (const h of codeValueHits) console.log(`    ! ${h}`)
} else {
  console.log('  存量登记 = 0 条（本单新增面零命中；口径 =「不要求一次清完，但不得静默」）')
}

// ── C 四语通用兜底齐备（扩口径后的落点 ③）──────────────────────────────────
console.log('[P7C-MACHINE-CODE] C 四语通用兜底键齐备（扩口径后的落点 ③）')
const getPath = (obj, dotted) => dotted.split('.').reduce((a, k) => (a == null ? a : a[k]), obj)
for (const lang of LANGS) {
  const value = locales[lang] ? getPath(locales[lang], GENERIC_KEY) : undefined
  const ok = typeof value === 'string' && value.length > 0
    && !containsBareI18nKey?.(value) && !containsMachineCode?.(value)
  console.log(`  ${GENERIC_KEY} ⇒ ${lang}:${ok ? 'OK' : '**缺/非法**'}（${JSON.stringify(value)}）`)
  if (!ok) fail(`C 通用兜底键 \`${GENERIC_KEY}\` 在 ${lang} 缺失 / 为空 / 为裸键 / 为机读码（值 = ${JSON.stringify(value)}）`)
}

// ── 载入 i18next（真实例）──────────────────────────────────────────────────────
let t = null
if (i18next) {
  await i18next.init({
    lng: 'zh',
    fallbackLng: false,
    resources: Object.fromEntries(langsLoaded.map((l) => [l, { translation: locales[l] }])),
    interpolation: { escapeValue: false },
    keySeparator: '.',
  })
  t = (lang, key, vars) => i18next.getFixedT(lang)(key, vars)
}

const usable = (value, key) => (
  typeof value === 'string' && value.length > 0 && value !== key && !containsBareI18nKey?.(value)
)

/**
 * 链式决策**镜像**（与 `extractApiErrorMessage` + `resolveI18nMessage` 逐条同序）：
 *   原文 `direct` = 服务端 `message`（**含机读码 ⇒ 视为不可用**）拼 `details.reason`；
 *   ① `t(i18nKey)` 可用 ⇒ 用它（⇒ 逐码本地化后**自动让位**）
 *   ② `direct` 可用 ⇒ 服务端原文
 *   ③ 四语通用兜底 `auth.err.REQUEST_FAILED` ④ ASCII 兜底
 * 准入闸 = 从 `src/auth.js` 导入的**真谓词**。
 */
const chainOutcome = (lang, v) => {
  let direct
  if (v.payloadMessageOnly !== undefined) {
    direct = containsMachineCode?.(v.payloadMessageOnly) ? undefined : v.payloadMessageOnly
  } else if (v.message && !containsMachineCode?.(v.message)) {
    direct = v.reason ? `${v.message} (${v.reason})` : v.message
  }
  const hit = v.i18nKey ? t(lang, v.i18nKey, { status: v.status }) : undefined
  if (usable(hit, v.i18nKey)) return hit
  if (usable(direct, v.i18nKey)) return direct
  const generic = t(lang, GENERIC_KEY, { status: v.status })
  return usable(generic, GENERIC_KEY)
    ? generic
    : (v.status != null ? `Request failed (${v.status})` : 'Request failed')
}

const genericOf = (lang, status) => t(lang, GENERIC_KEY, { status })

/** ★ 类级向量：服务端 `message` **含机读码**（F-1 家族）。 */
const MACHINE_VECTORS = [
  {
    name: 'F-1 · 409 真体（message = 机读码 + reason = order_not_refundable）',
    status: 409,
    message: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    i18nKey: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    reason: 'order_not_refundable',
  },
  {
    name: '服务端自拼（message 已含 `机读码 (reason)`）',
    status: 409,
    message: 'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)',
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    i18nKey: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    reason: undefined,
    forbidden: 'order_not_refundable',
  },
  {
    name: '无 i18n_key 的机读码 message（旧字符串面）',
    status: 401,
    message: 'AUTH_UNAUTHORIZED',
    code: 'AUTH_UNAUTHORIZED',
    i18nKey: undefined,
    reason: undefined,
  },
  {
    name: '机读码 message + 大写 reason（`STATEMENT_TIMEOUT`）',
    status: 503,
    message: 'LEDGER_LOCK_TIMEOUT',
    code: 'LEDGER_LOCK_TIMEOUT',
    i18nKey: 'ledger.err.LEDGER_LOCK_TIMEOUT',
    reason: 'STATEMENT_TIMEOUT',
  },
]

/** 反例向量：**真人可读**服务端 message ⇒ 仍走 ②（O-1 边界保留）。 */
const HUMAN_VECTORS = [
  {
    name: 'O-1 · 503 真体（zh 句子 + 小写 reason = too_many_connections）',
    status: 503,
    message: '系统繁忙，请稍后重试',
    i18nKey: 'ledger.err.LEDGER_TX_TIMEOUT',
    reason: 'too_many_connections',
    expectContains: ['系统繁忙，请稍后重试', '(too_many_connections)'],
  },
  {
    name: 'S6 · 410 弃用面（英文句）',
    status: 410,
    message: 'endpoint deprecated: /api/auth/register',
    i18nKey: 'ledger.err.LEDGER_REF_NOT_FOUND',
    reason: undefined,
    expectEquals: 'endpoint deprecated: /api/auth/register',
  },
  {
    name: 'B14③ · 未登记裸 message（无 `error` 对象）',
    status: 503,
    payloadMessageOnly: 'database is unreachable',
    expectEquals: 'database is unreachable',
  },
]

// ── D 行为节点（★ 类级）：机读码 message 向量 × 4 语 ──────────────────────────
console.log('[P7C-MACHINE-CODE] D 行为节点（★ 类级）：机读码 message 向量 × 4 语 = '
  + `${MACHINE_VECTORS.length} × ${LANGS.length} = ${MACHINE_VECTORS.length * LANGS.length}`)
let machineNodes = 0
let classViolations = 0
if (!t) {
  fail('D 无法求值：i18next 未就绪')
  console.log('  !! i18next 未就绪，D 段无读数（不得读作「零违例」）')
} else {
  for (const v of MACHINE_VECTORS) {
    console.log(`  · ${v.name}（status=${v.status}）`)
    for (const lang of LANGS) {
      machineNodes += 1
      const shown = chainOutcome(lang, v)
      const generic = genericOf(lang, v.status)
      const problems = []
      if (typeof shown !== 'string' || shown.length === 0) problems.push(`空/非串 ${JSON.stringify(shown)}`)
      if (containsMachineCode?.(shown)) problems.push('产出含机读码 token')
      if (shown.includes(v.code)) problems.push(`产出含码原文 ${v.code}`)
      if (v.reason && shown.includes(v.reason)) problems.push(`产出含 reason 后缀 ${v.reason}`)
      if (v.forbidden && shown.includes(v.forbidden)) problems.push(`产出含 reason 后缀 ${v.forbidden}`)
      if (shown !== generic) problems.push(`产出 ≠ 该语兜底（实际 ${JSON.stringify(shown)}）`)
      if (problems.length) {
        classViolations += 1
        fail(`D 机读码被当作文案输出：${v.name} · ${lang} ⇒ ${JSON.stringify(shown)}（${problems.join('；')}）`)
      }
      console.log(`      [${lang}] ⇒ ${JSON.stringify(shown)}${problems.length ? '  ! ' + problems.join('；') : ''}`)
    }
  }
  console.log(`  ★ 类级违例计数（「全大写下划线机读码被当作文案输出」形态）= ${classViolations} / 节点 ${machineNodes}（必须 = 0）`)
}

// ── F 反例面（O-1 边界回归）：真人可读 message ⇒ 仍走 ② ──────────────────────
console.log('[P7C-MACHINE-CODE] F 反例面（O-1 边界回归）：真人可读服务端 message ⇒ 仍走 ② 服务端原文')
let humanNodes = 0
let humanViolations = 0
if (!t) {
  fail('F 无法求值：i18next 未就绪')
} else {
  for (const v of HUMAN_VECTORS) {
    console.log(`  · ${v.name}（status=${v.status}）`)
    for (const lang of LANGS) {
      humanNodes += 1
      const shown = chainOutcome(lang, v)
      const problems = []
      if (v.expectEquals !== undefined && shown !== v.expectEquals) problems.push(`应 = 服务端原文 ${JSON.stringify(v.expectEquals)}，实际 ${JSON.stringify(shown)}`)
      for (const frag of v.expectContains || []) if (!String(shown).includes(frag)) problems.push(`应含 ${JSON.stringify(frag)}，实际 ${JSON.stringify(shown)}`)
      if (problems.length) {
        humanViolations += 1
        fail(`F 反例面被误判为机读码（O-1 边界回归）：${v.name} · ${lang} ⇒ ${JSON.stringify(shown)}（${problems.join('；')}）`)
      }
      console.log(`      [${lang}] ⇒ ${JSON.stringify(shown)}${problems.length ? '  ! ' + problems.join('；') : ''}`)
    }
  }
  console.log(`  ★ 反例面违例 = ${humanViolations} / 节点 ${humanNodes}（必须 = 0）`)
}

// ── E 边界样本表自证（非空转）────────────────────────────────────────────────
console.log('[P7C-MACHINE-CODE] E 边界样本表自证（谓词非空转）')
const TRUE_CASES = [
  'LEDGER_CURRENCY_INVALID_TRANSITION', 'AUTH_UNAUTHORIZED', 'STATEMENT_TIMEOUT',
  'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)',
]
const FALSE_CASES = [
  '系统繁忙，请稍后重试 (too_many_connections)', 'Request failed (400)', 'database is unreachable',
  'v1.2', 'endpoint deprecated: /api/auth/register', 'Invalid wallet signature', 'too_many_connections',
  '请求失败 (500)', 'no-dots-here', '',
]
console.log('  样本                                    | containsMachineCode | looksLikeMachineCode')
for (const v of TRUE_CASES) {
  const c = containsMachineCode?.(v)
  console.log(`  [正例] ${JSON.stringify(v).padEnd(52)} | ${String(c).padEnd(19)} | ${looksLikeMachineCode?.(v)}`)
  if (c !== true) fail(`E 谓词漏判机读码：${JSON.stringify(v)}`)
}
for (const v of FALSE_CASES) {
  const c = containsMachineCode?.(v)
  console.log(`  [反例] ${JSON.stringify(v).padEnd(52)} | ${String(c).padEnd(19)} | ${looksLikeMachineCode?.(v)}`)
  if (c !== false) fail(`E 谓词误判正常文案为机读码：${JSON.stringify(v)}`)
}
for (const v of [undefined, null, 42, {}, ['A_B']]) {
  if (containsMachineCode?.(v) !== false) fail(`E 谓词对非字符串应为 false：${JSON.stringify(v)}`)
  if (looksLikeMachineCode?.(v) !== false) fail(`E 整串谓词对非字符串应为 false：${JSON.stringify(v)}`)
}
// 整串判据 vs token 判据的差异面（本单采到的真缺陷形态）
const SPLICED = 'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)'
if (looksLikeMachineCode?.(SPLICED) !== false) fail(`E ${JSON.stringify(SPLICED)} 不应触发整串判据`)
if (containsMachineCode?.(SPLICED) !== true) fail(`E token 判据必须命中拼接面 ${JSON.stringify(SPLICED)}`)
console.log(`  正例 ${TRUE_CASES.length} 条 ⇒ containsMachineCode=true；反例 ${FALSE_CASES.length} 条 + 非字符串 5 条 ⇒ false；`
  + `拼接面 ${JSON.stringify(SPLICED)} ⇒ 整串=false / token=true`)

if (guardImportError) fail(`护栏模块导入失败：${guardImportError}`)
for (const e of localeErrors) fail(`locale 载入失败：${e}`)

console.log(`[P7C-MACHINE-CODE] 作用域读数：root = ${ROOT}；locale 叶子值 = ${localeNodes}；`
  + `机读码向量节点 = ${machineNodes}；反例向量节点 = ${humanNodes}；扫描文件 = 1（src/auth.js）+ ${langsLoaded.length}（locale）`)
if (fails.length) {
  console.log(`[P7C-MACHINE-CODE] 判负 ${fails.length} 条（必须 = 0）：`)
  for (const f of fails) console.log(`  ! ${f}`)
}
console.log(`[P7C-MACHINE-CODE] 总判：${fails.length ? 'FAIL' : 'PASS'}（判负 ${fails.length} 必须 = 0；`
  + `A=${guardWired ? 'PASS' : 'FAIL'} / B 含机读码值=${codeValueHits.length} / C 兜底键=${LANGS.length} / `
  + `D 类级违例=${classViolations}/${machineNodes} / F 反例违例=${humanViolations}/${humanNodes} / `
  + `E 样本=${TRUE_CASES.length + FALSE_CASES.length + 5}）`)
// 与同族门同口径：`process.exit()` 会丢弃未 flush 的管道 stdout ⇒ 只设 exitCode。
process.exitCode = fails.length ? 1 : 0
