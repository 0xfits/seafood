#!/usr/bin/env node
/**
 * P7-B · C-1「`ledger.err.*` 回退护栏」· **类级断言**：用户可见文案**不得出现 `x.y.z` 形态的裸键**
 * ============================================================================
 * 立门动机（质检终轮在 p7-A 面上采到，裁定 = 本单 C-1「回退护栏」）：
 *   后端账本错误对外回 `i18n_key = ledger.err.<CODE>`（`R107` 契约；命名法见
 *   `backend-ts/src/ledger-errors.ts` 的 `` `ledger.err.${code}` ``），而四语 locale **没有**
 *   `ledger.err.*` 族键（`docs/data-layer.spec.md` §11.3.1 早已登记「需新增键」）
 *   ⇒ i18next 对**未命中**键**原样回键名本身**（本门实测：`t('ledger.err.LEDGER_AMOUNT_INVALID')`
 *     === `'ledger.err.LEDGER_AMOUNT_INVALID'`）⇒ 任何直接 `t(key)` 的路径都会把**裸键**当文案
 *     输出给用户（`ledger.err.LEDGER_AMOUNT_INVALID`）。本门把「**不得外泄裸键**」落成一条机读判据。
 *
 * ── 判据（可判负）─────────────────────────────────────────────────────────────
 *   A **护栏在场**：`src/auth.js` 必须①具名导出 `looksLikeBareI18nKey`；②定义 `isUsableText`
 *     且其判据用到该谓词；③`resolveI18nMessage` 体内以 `isUsableText(` 收口（≥2 处）。
 *     ⇒ 拆掉护栏（改回「未命中即回键名」）⇒ A 判负。
 *   B **locale 文案面**：四语每个**叶子值**不得是裸键形态（存量命中逐条打印登记；本单新增面零命中）。
 *   C **四语通用兜底齐备**：`auth.err.REQUEST_FAILED` / `auth.err.NO_CREDENTIAL` 四语**都存在**、
 *     非空、非裸键 ⇒ 删任一语的兜底键 ⇒ C 判负（这就是「回退护栏」的落点）。
 *   D **行为节点**：`33 码 × 4 语 = 132` 节点 —— 对每个 (code, lang)：
 *     · `t('ledger.err.<code>')` 逐字回键名 ⇒ 登记「需护栏」；回**裸键形态之外**的文案 ⇒ 登记
 *       「**已本地化 ⇒ 护栏自动让位**」（将来逐码本地化后本门**不红**，只是读数变化）；
 *     · 再按链式决策（镜像 `resolveI18nMessage` 的 6 行，**消费真谓词 `looksLikeBareI18nKey`** +
 *       真 locale 数据 + 真 i18next）算出**用户实际会看到的串**，断言其**非裸键、非空**。
 *   E **判据自证（非空转）**：谓词对 `ledger.err.X` / `auth.err.X` = true，对「正常文案」样本
 *     （中文兜底 / `v1.2` / `Ledger timed out (STATEMENT_TIMEOUT)` / 空串 / 非字符串）= false。
 *
 * ── 口径说明（诚实标注）──────────────────────────────────────────────────────
 *   · 本脚本是**纯 node 门**（无 vite 解析器，故 `src/i18n.js` 的 `./utils` 无扩展名导入在 node 下不可解析）
 *     ⇒ D 采用**链式决策镜像**（6 行）而非真跑 `apiErrorMessage`；镜像的**准入闸 = 真谓词**（从
 *     `src/auth.js` 导入，非重写），且 A 保证真链确实接线到该谓词。
 *     **真跑证据**（真 `i18n` 实例 + 真 `apiErrorMessage` / 真 `ledger-api`）= `src/test/unit/p7b-errfallback.test.js`。
 *   · 只读：不写任何文件。
 *
 * 用法：node scripts/p7b-errfallback-gate.mjs [root]
 *       缺省 root = 本脚本上级目录（仓内 = `frontend/`）；给参可对**仓外镜像**判负
 *       （报告 §5 的判负自证②即用此形，零仓内污染）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '..')
const LANGS = ['zh', 'hk', 'en', 'vn']

/**
 * 关闭集 33 码 · 逐条硬编码（真源 = `backend-ts/src/ledger-errors.ts` 的 `LEDGER_ERROR_TABLE`，
 * 33/33；闭合集纪律见 `docs/ledger.spec.md` §14.1 —— **不新增错误码**）。
 * 门**不连库、不读后端**（跨单文件面），故内联；码集若变，A 之外的三段读数会立刻显示节点数变化。
 */
const LEDGER_CODES = [
  'LEDGER_INSUFFICIENT_BALANCE', 'LEDGER_INSUFFICIENT_FROZEN', 'LEDGER_IDEMPOTENCY_REPLAY',
  'LEDGER_IDEMPOTENCY_CONFLICT', 'LEDGER_IDEMPOTENCY_KEY_REQUIRED', 'LEDGER_IDEMPOTENCY_KEY_INVALID',
  'LEDGER_CURRENCY_NOT_FOUND', 'LEDGER_CURRENCY_NOT_LISTED', 'LEDGER_CURRENCY_FROZEN',
  'LEDGER_CURRENCY_DELISTED', 'LEDGER_CURRENCY_INVALID_TRANSITION', 'LEDGER_CURRENCY_SYMBOL_TAKEN',
  'LEDGER_CURRENCY_MISMATCH', 'LEDGER_SUPPLY_CAP_EXCEEDED', 'LEDGER_UNAUTHORIZED_MINT',
  'LEDGER_HOLD_NOT_ALLOWED', 'LEDGER_AMOUNT_INVALID', 'LEDGER_AMOUNT_NOT_POSITIVE',
  'LEDGER_DECIMALS_OVERFLOW', 'LEDGER_SELF_TRANSFER', 'LEDGER_ACCOUNT_NOT_FOUND',
  'LEDGER_RESERVED_UID', 'LEDGER_REF_NOT_FOUND', 'LEDGER_UNKNOWN_KIND', 'LEDGER_TRANSACTION_REQUIRED',
  'LEDGER_LOCK_TIMEOUT', 'LEDGER_TX_TIMEOUT', 'LEDGER_DEADLOCK_RETRY_EXHAUSTED',
  'LEDGER_NEGATIVE_BALANCE_GUARD', 'LEDGER_APPEND_ONLY_VIOLATION', 'LEDGER_ACCOUNT_GUARD_VIOLATION',
  'LEDGER_FEE_RATE_INVALID', 'LEDGER_RECONCILE_MISMATCH',
]

/** 四语通用兜底键（本单 C-1 的落点；「一族」= 既有 `auth.err.REQUEST_FAILED` / `NO_CREDENTIAL`）。 */
const GENERIC_FALLBACK_KEYS = ['auth.err.REQUEST_FAILED', 'auth.err.NO_CREDENTIAL']

const AUTH_JS = path.join(ROOT, 'src', 'auth.js')
const LOCALES_DIR = path.join(ROOT, 'src', 'locales')

const fails = []
const fail = (msg) => fails.push(msg)

// ── 载入真谓词（从 `src/auth.js` 导入，**不重写**）───────────────────────────────
let looksLikeBareI18nKey = null
let containsBareI18nKey = null
let authSrc = ''
let guardImportError = null
try {
  authSrc = fs.readFileSync(AUTH_JS, 'utf8')
  ;({ looksLikeBareI18nKey, containsBareI18nKey } = await import(pathToFileURL(AUTH_JS).href))
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
const resolveBody = (() => {
  const start = authSrc.indexOf('const resolveI18nMessage = async')
  if (start < 0) return ''
  const end = authSrc.indexOf('\n}\n', start)
  return authSrc.slice(start, end < 0 ? authSrc.length : end)
})()
const hasExportPredicate = /export\s+const\s+looksLikeBareI18nKey\s*=/.test(authSrc)
const hasContainsPredicate = /export\s+const\s+containsBareI18nKey\s*=/.test(authSrc)
const hasUsableGate = /const\s+isUsableText\s*=/.test(authSrc)
  && /isUsableText[\s\S]{0,300}containsBareI18nKey\(/.test(authSrc)
const usableCallsInResolver = (resolveBody.match(/isUsableText\(/g) || []).length
// ★ 批 7-C（F-1）扩口径：`src/auth.js` 必须①具名导出 `containsMachineCode`；②服务端 message 面
//   （`extractApiErrorMessage` 体内）以该谓词收口 ⇒ 拆掉扩口径 ⇒ 本单 A 判负（与 `p7c` 门同源判据）。
const hasMachineExport = /export\s+const\s+containsMachineCode\s*=/.test(authSrc)
const hasMachineWiring = /const\s+extractApiErrorMessage[\s\S]{0,1400}containsMachineCode\(/.test(authSrc)

console.log('[P7B-ERRFB] A 护栏在场（源码）：src/auth.js')
console.log("  ① 具名导出 `looksLikeBareI18nKey`（整串判据）   = " + hasExportPredicate)
console.log("  ①' 具名导出 `containsBareI18nKey`（token 判据）   = " + hasContainsPredicate)
console.log("  ② `isUsableText` 定义且用到 token 判据          = " + hasUsableGate)
console.log("  ③ `resolveI18nMessage` 内 `isUsableText(` 调用数 = " + usableCallsInResolver + "（要求 ≥ 2）")
console.log("  ④ 具名导出 `containsMachineCode`（机读码判据 · 批 7-C） = " + hasMachineExport)
console.log("  ⑤ `extractApiErrorMessage` 内以机读码判据收口（批 7-C） = " + hasMachineWiring)
if (!hasExportPredicate) fail('A① 缺具名导出 `looksLikeBareI18nKey`')
if (!hasContainsPredicate) fail("A①' 缺具名导出 `containsBareI18nKey`")
if (!hasUsableGate) fail('A② `isUsableText` 未定义 / 未用 token 判据')
if (usableCallsInResolver < 2) fail(`A③ \`resolveI18nMessage\` 未以闸收口（isUsableText 调用 ${usableCallsInResolver} < 2）`)
if (!hasMachineExport) fail('A④ 缺具名导出 `containsMachineCode`（批 7-C F-1 扩口径）')
if (!hasMachineWiring) fail('A⑤ 服务端 message 面未以机读码判据收口（批 7-C F-1 扩口径）')
const guardWired = hasExportPredicate && hasContainsPredicate && hasUsableGate
  && usableCallsInResolver >= 2 && hasMachineExport && hasMachineWiring

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

// ── B locale 文案面：叶子值不得是裸键形态 ──────────────────────────────────────
const flatten = (node, prefix = '', out = []) => {
  for (const [k, v] of Object.entries(node || {})) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object') flatten(v, key, out)
    else out.push([key, v])
  }
  return out
}

console.log('[P7B-ERRFB] B locale 文案面（四语叶子值裸键扫描）')
let localeNodes = 0
const bareValueHits = []
for (const lang of LANGS) {
  if (!locales[lang]) continue
  const leaves = flatten(locales[lang])
  localeNodes += leaves.length
  const bad = leaves.filter(([, v]) => containsBareI18nKey?.(v))
  for (const [k, v] of bad) bareValueHits.push(`${lang}:${k} = ${JSON.stringify(v)}`)
  console.log(`  [${lang}] 叶子值 = ${leaves.length}；含裸键 token = ${bad.length}`)
}
if (bareValueHits.length) {
  fail(`B locale 文案面存在裸键值 ${bareValueHits.length} 条`)
  console.log('  ! 存量登记（须逐条登记或修掉）：')
  for (const h of bareValueHits) console.log(`    ! ${h}`)
} else {
  console.log('  存量登记 = 0 条（本单新增面零命中；口径 = 「不要求一次清完，但不得静默」）')
}

// ── C 四语通用兜底齐备 ────────────────────────────────────────────────────────
console.log('[P7B-ERRFB] C 四语通用兜底键齐备（回退护栏的落点）')
const getPath = (obj, dotted) => dotted.split('.').reduce((a, k) => (a == null ? a : a[k]), obj)
for (const key of GENERIC_FALLBACK_KEYS) {
  const cells = []
  for (const lang of LANGS) {
    const value = locales[lang] ? getPath(locales[lang], key) : undefined
    const ok = typeof value === 'string' && value.length > 0 && !containsBareI18nKey?.(value)
    cells.push(`${lang}:${ok ? 'OK' : '**缺/非法**'}`)
    if (!ok) fail(`C 通用兜底键 \`${key}\` 在 ${lang} 缺失 / 为空 / 为裸键（值 = ${JSON.stringify(value)}）`)
  }
  console.log(`  ${key} ⇒ ${cells.join('  ')}`)
}

// ── D 行为节点：33 码 × 4 语 ─────────────────────────────────────────────────
const usable = (value, key) => (
  typeof value === 'string' && value.length > 0 && value !== key && !containsBareI18nKey?.(value)
)

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

/**
 * 链式决策**镜像**（6 行）· 与 `src/auth.js` 的 `resolveI18nMessage` 逐条同序：
 *   ① `t(key)` 若可用 ⇒ 用它（⇒ 逐码本地化后**自动让位**）
 *   ② 服务端原文（真服务端文案面；本门取 `undefined` = 「后端只给了键、没给文案」的最坏面）
 *   ③ 四语通用兜底 `auth.err.REQUEST_FAILED` ④ ASCII 兜底
 * 准入闸 = 从 `src/auth.js` 导入的**真谓词**（A 已断言真链接线到它）。
 */
const chainOutcome = (lang, i18nKey, fallback, vars) => {
  const hit = i18nKey ? t(lang, i18nKey, vars) : undefined
  if (usable(hit, i18nKey)) return hit
  if (usable(fallback, i18nKey)) return fallback
  const generic = t(lang, 'auth.err.REQUEST_FAILED', vars)
  return usable(generic, 'auth.err.REQUEST_FAILED')
    ? generic
    : (vars?.status != null ? `Request failed (${vars.status})` : 'Request failed')
}

console.log('[P7B-ERRFB] D 行为节点：33 码 × 4 语 = 132（“后端只给 i18n_key、无 message”的最坏面）')
let nodes = 0
let requiresGuard = 0
const localizedHits = []
const leakHits = []
if (!t) {
  fail('D 无法求值：i18next 未就绪')
  console.log('  !! i18next 未就绪，D 段无读数（不得读作「零违例」）')
} else {
  for (const lang of LANGS) {
    for (const code of LEDGER_CODES) {
      nodes += 1
      const key = `ledger.err.${code}`
      const raw = t(lang, key)
      if (raw === key) requiresGuard += 1
      else if (containsBareI18nKey?.(raw)) leakHits.push(`${lang}:${key} ⇒ ${JSON.stringify(raw)}`)
      else localizedHits.push(`${lang}:${key}`)

      const shown = chainOutcome(lang, key, undefined, { status: 400 })
      if (typeof shown !== 'string' || shown.length === 0 || containsBareI18nKey?.(shown)) {
        leakHits.push(`${lang}:${key} ⇒ 链产出 ${JSON.stringify(shown)}`)
      }
    }
  }
  const sample = chainOutcome('zh', 'ledger.err.LEDGER_AMOUNT_INVALID', undefined, { status: 400 })
  console.log(`  节点 = ${nodes}；「未命中 ⇒ 依赖护栏」= ${requiresGuard}；「已本地化 ⇒ 护栏让位」= ${localizedHits.length}`)
  console.log(`  例：zh · ledger.err.LEDGER_AMOUNT_INVALID ⇒ ${JSON.stringify(sample)}（真链同类产出见单测 ②）`)
  if (localizedHits.length) {
    console.log(`  ^ 已本地化登记（${localizedHits.length} 条 ⇒ 护栏自动让位，门不红）：`)
    for (const h of localizedHits.slice(0, 10)) console.log(`    # ${h}`)
  }
  if (leakHits.length) {
    fail(`D 链产出裸键 / 空串 ${leakHits.length} 条`)
    for (const h of leakHits) console.log(`  ! ${h}`)
  }
}

// ── E 判据自证（非空转）──────────────────────────────────────────────────────
console.log('[P7B-ERRFB] E 判据自证（谓词非空转）')
const TRUE_CASES = ['ledger.err.LEDGER_AMOUNT_INVALID', 'auth.err.AUTH_UNAUTHORIZED', 'a.b.c', 'ledger.err.X']
const FALSE_CASES = [
  '请求失败 (500)', 'Request failed (400)', 'Ledger statement timed out (STATEMENT_TIMEOUT)',
  'v1.2', 'deprecated endpoint', 'endpoint deprecated: /api/auth/register', '', 'no-dots-here',
]
for (const v of TRUE_CASES) {
  if (looksLikeBareI18nKey?.(v) !== true) fail(`E 整串判据漏判裸键：${JSON.stringify(v)}`)
  if (containsBareI18nKey?.(v) !== true) fail(`E token 判据漏判裸键：${JSON.stringify(v)}`)
}
for (const v of FALSE_CASES) {
  if (looksLikeBareI18nKey?.(v) !== false) fail(`E 整串判据误判正常文案：${JSON.stringify(v)}`)
  if (containsBareI18nKey?.(v) !== false) fail(`E token 判据误判正常文案：${JSON.stringify(v)}`)
}
// token 判据**强于**整串判据的证明面（本单自测采到的真缺陷形态）
const SPLICED = 'ledger.err.LEDGER_AMOUNT_INVALID (NOT_DECIMAL_STRING)'
if (looksLikeBareI18nKey?.(SPLICED) !== false) fail(`E ${JSON.stringify(SPLICED)} 不应触发整串判据`)
if (containsBareI18nKey?.(SPLICED) !== true) fail(`E token 判据必须命中拼接面 ${JSON.stringify(SPLICED)}`)
for (const v of [undefined, null, 42, {}, ['a.b']]) {
  if (looksLikeBareI18nKey?.(v) !== false) fail(`E 整串判据对非字符串应为 false：${JSON.stringify(v)}`)
  if (containsBareI18nKey?.(v) !== false) fail(`E token 判据对非字符串应为 false：${JSON.stringify(v)}`)
}
console.log(`  整串判据 / token 判据：裸键样本 ${TRUE_CASES.length} 条 ⇒ true；正常文案样本 ${FALSE_CASES.length} 条 + 非字符串 5 条 ⇒ false`)
console.log(`  拼接面差异：${JSON.stringify(SPLICED)} ⇒ 整串=false / token=true（token 判据更强，本单采到的真缺陷）`)

if (guardImportError) fail(`护栏模块导入失败：${guardImportError}`)
for (const e of localeErrors) fail(`locale 载入失败：${e}`)

console.log(`[P7B-ERRFB] 作用域读数：root = ${ROOT}；locale 叶子值 = ${localeNodes}；行为节点 = ${nodes}；`
  + `扫描文件 = 1（src/auth.js）+ ${langsLoaded.length}（locale）`)
if (fails.length) {
  console.log(`[P7B-ERRFB] 判负 ${fails.length} 条（必须 = 0）：`)
  for (const f of fails) console.log(`  ! ${f}`)
}
console.log(`[P7B-ERRFB] 总判：${fails.length ? 'FAIL' : 'PASS'}（判负 ${fails.length} 必须 = 0；`
  + `A=${guardWired ? 'PASS' : 'FAIL'} / `
  + `B 含裸键值=${bareValueHits.length} / C 兜底键=${GENERIC_FALLBACK_KEYS.length}×${LANGS.length} / `
  + `D 节点=${nodes} 需护栏=${requiresGuard} 已本地化=${localizedHits.length} / E 样本=${TRUE_CASES.length + FALSE_CASES.length + 5}）`)
// 与同族门同口径：`process.exit()` 会丢弃未 flush 的管道 stdout ⇒ 只设 exitCode。
process.exitCode = fails.length ? 1 : 0
