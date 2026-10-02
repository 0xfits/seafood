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
 *     不含 `details.reason` 后缀、且**逐字等于该语真兜底 / 真文案**（F-1 409 真体）。
 *     类级违例计数（「全大写下划线机读码被当作文案输出」形态）必须 = 0。
 *   E **边界样本表自证（非空转）**：谓词正例（`LEDGER_CURRENCY_INVALID_TRANSITION` / `AUTH_UNAUTHORIZED` /
 *     `STATEMENT_TIMEOUT`）⇒ true；反例（`系统繁忙，请稍后重试 (too_many_connections)` / `Request failed (400)` /
 *     普通英文句 / 含小写词 / 空串 / 非字符串）⇒ false。
 *   F **反例面（O-1 边界回归）**：**真人可读**服务端 message（zh 句子 + 小写 reason / 英文句 / 裸 message）
 *     ⇒ 仍走 ② **服务端原文**（不得因本单把 zh 句子也当机读码）。
 *   G **★ 批 7-D ②（R1′）类级判据**：**用户可见串中「全大写下划线机读码」出现次数 = 0**
 *     —— 向量集含 409 机读码 message / 409 服务端自拼 / `stateConflict()` 四种 reason /
 *     503 `STATEMENT_TIMEOUT` / `LEDGER_LOCK_TIMEOUT` / O-1 小写 reason（后缀必须保留）。
 *     `details.reason` 与 `message` 施**同一判据**（复用 `containsMachineCode`）⇒ 命中 ⇒ 不附加 `(reason)` 后缀。
 *     ⇒ 把 reason 判据改回旧口径 ⇒ G 判负。
 *
 * ── ★ 批 7-E ③ · D/F/G 已升**真链**（落实 R-7D-3 纪律）────────────────────────
 *   本脚本此前是**纯 node 门**（`src/i18n.js` 的 `./utils` 无扩展名导入 + `./locales/*.json` 在 node 下
 *   不可解析）⇒ D/F/G 走「链式决策**镜像**」，故把 `auth.js` 的 reason 判据改回旧口径时**门不红、只有真链
 *   单测红**（终审质检已独立坐实）。本单把 D/F/G 改为**真链**：
 *     · 用 `esbuild`（仓内现成，vite 依赖）把 `src/auth.js`（连带其**动态导入**的 `src/i18n.js` + 真 locale
 *       JSON）打成**临时 ESM**（`os.tmpdir()` 下，用后即删），`import()` 后**直接调用真 `apiErrorMessage`**；
 *     · 语言切换 = 真实例 `changeLanguage(lang)`；断言 oracle 用同一实例的 `getFixedT(lang)`
 *       —— **不再重写链逻辑**（镜像已删除）。
 *   · 真链不可用（如 esbuild 缺失）时**不再静默**：打印 `【镜像级】` 横幅 + 逐字原因，D/F/G 记「无读数」并判负。
 *   · **必带判负自证**：在**仓外副本**内把 `auth.js` 的 reason 判据改回旧口径（`const suffix = reason ? ' ('+reason+')' : ''`）
 *     ⇒ 升级后的门必红（G 命中机读码）；复原 ⇒ 回绿。用法即下面的 `[root]` 形。
 *
 * ── 口径说明（诚实标注）──────────────────────────────────────────────────────
 *   · A 段仍读**源码文本**（具名导出 / 调用点在场），它与真链**互补**：A 证「接线在场」，D/F/G 证「行为正确」。
 *   · B/C/E 不依赖链（locale 表 + 真谓词），保持原判据。
 *   · 只读（真链临时产物写在 `os.tmpdir()` 下并即时删除；不改仓内任何文件）。
 *
 * 用法：node scripts/p7c-errmsg-machinecode-gate.mjs [root]
 *       缺省 root = 本脚本上级目录（仓内 = `frontend/`）；给参可对**仓外副本**判负
 *       （报告 §5 的判负自证②即用此形，零仓内污染）。仓外副本需能解析 `i18next` 等依赖
 *       （nodePaths 兜底 = `<root>/node_modules` 与 `<本脚本>/../node_modules`）。
 */
import fs from 'node:fs'
import os from 'node:os'
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
let MACHINE_CODE_TOKEN_RE = null
let authSrc = ''
let guardImportError = null
try {
  authSrc = fs.readFileSync(AUTH_JS, 'utf8')
  ;({ containsMachineCode, looksLikeMachineCode, containsBareI18nKey, MACHINE_CODE_TOKEN_RE } = await import(pathToFileURL(AUTH_JS).href))
} catch (err) {
  guardImportError = err?.message || String(err)
}

// ══ ★ 批 7-E ③ · **真链**载入（真 `apiErrorMessage` + 真 `i18n` 实例）══════════════
//   手法：esbuild 把 `src/auth.js`（连带动态导入的 `src/i18n.js` + 四语 JSON）打成一个临时 ESM，
//   设好 `window` 垫片后 `import()`，取真 `apiErrorMessage` 与真 `i18n` 实例。
const REAL_CHAIN_ENTRY = "export * from './auth.js'\nexport { default as i18n } from './i18n.js'\n"
let realChain = null
let realChainError = null
let tempDir = null
try {
  const esbuildMod = await import('esbuild')
  const esbuild = esbuildMod.build ? esbuildMod : esbuildMod.default
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'p7c-realchain-'))
  const outfile = path.join(tempDir, 'auth-chain.mjs')
  await esbuild.build({
    stdin: {
      contents: REAL_CHAIN_ENTRY,
      resolveDir: path.join(ROOT, 'src'),
      loader: 'js',
      sourcefile: 'p7c-realchain-entry.js',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile,
    logLevel: 'silent',
    // 仓外副本兜底：依赖（i18next / react-i18next / react）从这两处解析
    nodePaths: [path.join(ROOT, 'node_modules'), path.join(HERE, '..', 'node_modules')],
  })
  // `src/i18n.js` 在**导入期**读 `window.location.pathname` ⇒ 先设垫片（默认语 zh）
  globalThis.window = globalThis.window ?? { location: { pathname: '/zh/' }, addEventListener() {} }
  const mod = await import(pathToFileURL(outfile).href)
  if (typeof mod.apiErrorMessage !== 'function' || typeof mod.i18n?.t !== 'function') {
    throw new Error('真链导出面缺失：apiErrorMessage / i18n.t')
  }
  realChain = { apiErrorMessage: mod.apiErrorMessage, i18n: mod.i18n }
} catch (err) {
  realChainError = err?.message || String(err)
} finally {
  if (tempDir) { try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch { /* 忽略清理失败 */ } }
}

const chainReady = Boolean(realChain)
console.log('[P7C-MACHINE-CODE] ★ 批 7-E ③ 链路体制（D/F/G）')
if (chainReady) {
  console.log('  【真链】真 `import` `src/auth.js#apiErrorMessage` + 真 `i18n` 实例（esbuild 临时 ESM 载入；不再镜像重写链逻辑）')
} else {
  console.log(`  【镜像级】真链不可用 ⇒ D/F/G 无读数（不得读作「零违例」）。原因：${realChainError}`)
  fail(`D/F/G 真链不可用（升级后的门**不得**在镜像级下静默判绿）：${realChainError}`)
}

/** 真链入口（**唯一**求值路径；语言 = 真实例 `changeLanguage`）：
 *  ① `t(i18nKey)` 命中 ⇒ 真文案；② 服务端原文（机读码 reason 不附后缀）；③ 四语通用兜底；④ ASCII 兜底。 */
const chainOutcome = async (lang, v) => {
  await realChain.i18n.changeLanguage(lang)
  return realChain.apiErrorMessage(payloadOf(v), v.status)
}

/** 断言 oracle：同实例 `getFixedT(lang)` —— 键命中 ⇒ 真文案；未命中 ⇒ 该语通用兜底。 */
const t = (lang, key, vars) => realChain.i18n.getFixedT(lang)(key, vars)

/** 把向量还原成 `R107` **真体形状**（`{ error: { code, message, i18n_key, details.reason } }`）。 */
const payloadOf = (v) => {
  if (v.payloadMessageOnly !== undefined) return { success: false, message: v.payloadMessageOnly }
  const error = {}
  if (v.code !== undefined) error.code = v.code
  error.message = v.message
  if (v.i18nKey !== undefined) error.i18n_key = v.i18nKey
  if (v.reason !== undefined) error.details = { reason: v.reason }
  return { success: false, error }
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

const usable = (value, key) => (
  typeof value === 'string' && value.length > 0 && value !== key && !containsBareI18nKey?.(value)
)

/** 该 (语, 向量) 的**期望可见串**：键命中 ⇒ 真文案（让位）；未命中 ⇒ 该语通用兜底。 */
const expectedFor = (lang, i18nKey, status) => {
  const hit = i18nKey ? t(lang, i18nKey, { status }) : undefined
  return usable(hit, i18nKey) ? hit : t(lang, GENERIC_KEY, { status })
}

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

/**
 * 反例向量：**真人可读**服务端 message ⇒ 仍走 ②（O-1 边界保留）。
 * ★ 批 7-D：`ledger.err.*` 四语键补齐后，**带已本地化 `i18n_key`** 的真体会走 ① 让位
 *   （⇒ 不再走 ②）—— 故 O-1 边界改用**无 `i18n_key` / 未登记键**的向量继续钉住 ② 通路；
 *   同时补一条「已本地化键 ⇒ ① 让位」的正向锚。
 */
const HUMAN_VECTORS = [
  {
    name: 'O-1 · ② 边界（无 i18n_key：zh 句子 + 小写 reason = too_many_connections）⇒ 原文 + 后缀保留',
    status: 503,
    message: '系统繁忙，请稍后重试',
    i18nKey: undefined,
    reason: 'too_many_connections',
    expectContains: ['系统繁忙，请稍后重试', '(too_many_connections)'],
  },
  {
    name: 'O-1′ · 503 真体（i18n_key 已本地化 ledger.err.LEDGER_TX_TIMEOUT）⇒ ① 让位（真文案）',
    status: 503,
    message: '系统繁忙，请稍后重试',
    i18nKey: 'ledger.err.LEDGER_TX_TIMEOUT',
    reason: 'too_many_connections',
    expectLocalized: 'ledger.err.LEDGER_TX_TIMEOUT',
  },
  {
    name: 'S6 · 410 弃用面（**未登记** i18n_key）⇒ ② 服务端原文保留（既有面回归锚）',
    status: 410,
    message: 'endpoint deprecated: /api/auth/register',
    i18nKey: 'ledger.err.LEDGER_LEGACY_UNREGISTERED_ANCHOR',
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
console.log('[P7C-MACHINE-CODE] D 行为节点（★ 类级 · 真链）：机读码 message 向量 × 4 语 = '
  + `${MACHINE_VECTORS.length} × ${LANGS.length} = ${MACHINE_VECTORS.length * LANGS.length}`)
let machineNodes = 0
let classViolations = 0
if (!chainReady) {
  console.log('  !! 真链未就绪，D 段无读数（不得读作「零违例」）')
} else {
  for (const v of MACHINE_VECTORS) {
    console.log(`  · ${v.name}（status=${v.status}）`)
    for (const lang of LANGS) {
      machineNodes += 1
      const shown = await chainOutcome(lang, v)
      const expected = expectedFor(lang, v.i18nKey, v.status)
      const problems = []
      if (typeof shown !== 'string' || shown.length === 0) problems.push(`空/非串 ${JSON.stringify(shown)}`)
      if (containsMachineCode?.(shown)) problems.push('产出含机读码 token')
      if (v.code && shown.includes(v.code)) problems.push(`产出含码原文 ${v.code}`)
      if (v.reason && shown.includes(v.reason)) problems.push(`产出含 reason 后缀 ${v.reason}`)
      if (v.forbidden && shown.includes(v.forbidden)) problems.push(`产出含 reason 后缀 ${v.forbidden}`)
      // ★ 批 7-D：期望值 = 「键命中 ⇒ 该语真文案（① 让位）/ 键未命中 ⇒ 该语通用兜底（③）」
      if (shown !== expected) problems.push(`产出 ≠ 期望（期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(shown)}）`)
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
console.log('[P7C-MACHINE-CODE] F 反例面（O-1 边界回归 · 真链）：真人可读服务端 message ⇒ 仍走 ② 服务端原文')
let humanNodes = 0
let humanViolations = 0
if (!chainReady) {
  console.log('  !! 真链未就绪，F 段无读数（不得读作「零违例」）')
} else {
  for (const v of HUMAN_VECTORS) {
    console.log(`  · ${v.name}（status=${v.status}）`)
    for (const lang of LANGS) {
      humanNodes += 1
      const shown = await chainOutcome(lang, v)
      const problems = []
      if (v.expectEquals !== undefined && shown !== v.expectEquals) problems.push(`应 = 服务端原文 ${JSON.stringify(v.expectEquals)}，实际 ${JSON.stringify(shown)}`)
      if (v.expectLocalized !== undefined) {
        const truth = t(lang, v.expectLocalized, { status: v.status })
        if (shown !== truth) problems.push(`应 = 该语真文案 ${JSON.stringify(truth)}（① 让位），实际 ${JSON.stringify(shown)}`)
      }
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

// ── G ★ 类级判据（批 7-D ② · R1′）：用户可见串中「全大写下划线机读码」出现次数 = 0 ────────
//   向量集（必含，Zang 裁定逐字）：① 409 机读码 message（F-1 真体）；② 409 服务端自拼；
//     ③ `stateConflict()` 四种 reason（`LISTING_STATE_INVALID` / `JOB_STATE_INVALID` /
//        `JOB_APPLICATION_STATE_INVALID` / `CURRENCY_STATE_INVALID` —— 出处逐字：
//        `listing-service.ts:55` / `job-service.ts:122` / `job-funds-service.ts:61` / `currency-service.ts:59`）；
//     ④ 503 `STATEMENT_TIMEOUT`；⑤ `LEDGER_LOCK_TIMEOUT`；⑥ O-1 小写 reason（后缀必须保留）。
//   判据：逐 (向量, 语) 求链产出 ⇒ 机读码 token **出现次数**累加必须 = 0；
//        且带大写 reason 的向量**不得**出现 `(REASON)` 后缀；O-1 向量**必须**保留后缀。
//   ★ 本段是 R1′ 的**可判负落点**：把 `auth.js` 的 reason 判据改回旧口径（真链）⇒ 本段必红。
const R1P_VECTORS = [
  {
    name: '① 409 机读码 message（F-1 真体；键已本地化 ⇒ ① 让位）',
    status: 409,
    message: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    i18nKey: 'ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION',
    reason: 'order_not_refundable',
    forbidden: 'order_not_refundable',
  },
  {
    name: '② 409 服务端自拼 `机读码 (reason)`（无键 ⇒ ③ 兜底）',
    status: 409,
    message: 'LEDGER_CURRENCY_INVALID_TRANSITION (order_not_refundable)',
    i18nKey: undefined,
    forbidden: 'order_not_refundable',
  },
  {
    name: '③ stateConflict() · reason=LISTING_STATE_INVALID（`listing-service.ts:55`）⇒ 不得附加后缀',
    status: 409,
    message: 'Business state transition rejected',
    i18nKey: undefined,
    reason: 'LISTING_STATE_INVALID',
    forbidden: 'LISTING_STATE_INVALID',
    expectEquals: 'Business state transition rejected',
  },
  {
    name: '③ stateConflict() · reason=JOB_STATE_INVALID（`job-service.ts:122`）⇒ 不得附加后缀',
    status: 409,
    message: 'Business state transition rejected',
    i18nKey: undefined,
    reason: 'JOB_STATE_INVALID',
    forbidden: 'JOB_STATE_INVALID',
    expectEquals: 'Business state transition rejected',
  },
  {
    name: '③ stateConflict() · reason=JOB_APPLICATION_STATE_INVALID（`job-service.ts:122`）⇒ 不得附加后缀',
    status: 409,
    message: 'Business state transition rejected',
    i18nKey: undefined,
    reason: 'JOB_APPLICATION_STATE_INVALID',
    forbidden: 'JOB_APPLICATION_STATE_INVALID',
    expectEquals: 'Business state transition rejected',
  },
  {
    name: '③ stateConflict() · reason=CURRENCY_STATE_INVALID（`currency-service.ts:59`）⇒ 不得附加后缀',
    status: 409,
    message: 'Business state transition rejected',
    i18nKey: undefined,
    reason: 'CURRENCY_STATE_INVALID',
    forbidden: 'CURRENCY_STATE_INVALID',
    expectEquals: 'Business state transition rejected',
  },
  {
    name: '④ 503 STATEMENT_TIMEOUT（大写机读 reason）⇒ 不得附加后缀',
    status: 503,
    message: 'Ledger statement timed out',
    i18nKey: undefined,
    reason: 'STATEMENT_TIMEOUT',
    forbidden: 'STATEMENT_TIMEOUT',
    expectEquals: 'Ledger statement timed out',
  },
  {
    name: '⑤ LEDGER_LOCK_TIMEOUT（已本地化键 + 大写机读 reason）⇒ ① 让位，无后缀',
    status: 503,
    message: 'Ledger statement timed out',
    i18nKey: 'ledger.err.LEDGER_LOCK_TIMEOUT',
    reason: 'STATEMENT_TIMEOUT',
    forbidden: 'STATEMENT_TIMEOUT',
  },
  {
    name: '⑥ O-1（无键 + 小写 reason）⇒ 后缀**必须保留**（边界不回归）',
    status: 503,
    message: '系统繁忙，请稍后重试',
    i18nKey: undefined,
    reason: 'too_many_connections',
    expectContains: ['(too_many_connections)'],
  },
]

console.log('[P7C-MACHINE-CODE] G ★ 类级判据（批 7-D ② · R1′ · 真链）：用户可见串中机读码出现次数 = 0'
  + `（${R1P_VECTORS.length} 向量 × ${LANGS.length} 语 = ${R1P_VECTORS.length * LANGS.length} 节点）`)
const TOKEN_RE_G = new RegExp(MACHINE_CODE_TOKEN_RE?.source || '$^', 'g')
let r1pNodes = 0
let r1pOccurrences = 0
let r1pViolations = 0
if (!chainReady) {
  console.log('  !! 真链未就绪，G 段无读数（不得读作「零违例」）')
} else {
  for (const v of R1P_VECTORS) {
    console.log(`  · ${v.name}`)
    for (const lang of LANGS) {
      r1pNodes += 1
      const shown = await chainOutcome(lang, v)
      const occ = typeof shown === 'string' ? (shown.match(TOKEN_RE_G) || []).length : 1
      r1pOccurrences += occ
      const problems = []
      if (occ > 0) problems.push(`机读码出现 ${occ} 次`)
      if (containsMachineCode?.(shown)) problems.push('谓词判定含机读码')
      if (v.forbidden && String(shown).includes(v.forbidden)) problems.push(`产出含后缀/码 ${v.forbidden}`)
      if (v.expectEquals !== undefined && shown !== v.expectEquals) problems.push(`应 = ${JSON.stringify(v.expectEquals)}，实际 ${JSON.stringify(shown)}`)
      for (const frag of v.expectContains || []) if (!String(shown).includes(frag)) problems.push(`应含 ${JSON.stringify(frag)}，实际 ${JSON.stringify(shown)}`)
      if (problems.length) {
        r1pViolations += 1
        fail(`G 用户可见串含机读码：${v.name} · ${lang} ⇒ ${JSON.stringify(shown)}（${problems.join('；')}）`)
      }
      console.log(`      [${lang}] ⇒ ${JSON.stringify(shown)}${problems.length ? '  ! ' + problems.join('；') : ''}`)
    }
  }
  console.log(`  ★ 机读码出现次数合计 = ${r1pOccurrences}（必须 = 0）/ 节点 ${r1pNodes}；违例向量-语 = ${r1pViolations}（必须 = 0）`)
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

console.log(`[P7C-MACHINE-CODE] 作用域读数：root = ${ROOT}；链路体制 = ${chainReady ? '真链' : '镜像级'}；locale 叶子值 = ${localeNodes}；`
  + `机读码向量节点 = ${machineNodes}；反例向量节点 = ${humanNodes}；扫描文件 = 1（src/auth.js）+ ${langsLoaded.length}（locale）`)
if (fails.length) {
  console.log(`[P7C-MACHINE-CODE] 判负 ${fails.length} 条（必须 = 0）：`)
  for (const f of fails) console.log(`  ! ${f}`)
}
console.log(`[P7C-MACHINE-CODE] 总判：${fails.length ? 'FAIL' : 'PASS'}（判负 ${fails.length} 必须 = 0；`
  + `链=${chainReady ? '真链' : '镜像级'} / A=${guardWired ? 'PASS' : 'FAIL'} / B 含机读码值=${codeValueHits.length} / C 兜底键=${LANGS.length} / `
  + `D 类级违例=${classViolations}/${machineNodes} / F 反例违例=${humanViolations}/${humanNodes} / `
  + `G 机读码出现次数=${r1pOccurrences}/${r1pNodes} 违例=${r1pViolations} / `
  + `E 样本=${TRUE_CASES.length + FALSE_CASES.length + 5}）`)
// 与同族门同口径：`process.exit()` 会丢弃未 flush 的管道 stdout ⇒ 只设 exitCode。
process.exitCode = fails.length ? 1 : 0
