#!/usr/bin/env node
/**
 * P7-A 收口四（R-4①）· **类级断言**：错误文案必须过 `apiErrorMessage`
 * ============================================================================
 * 立门动机（本地质检在 `09362ad` 上采到的真缺陷，见 `docs/audit/p7-a-ledger-read-fix.md` §1 R-1）：
 *   新增的 `src/ledger-api.js` 错误分支写成
 *     `throw new Error(String(payload?.error?.message || payload?.message || 'HTTP ' + status))`
 *   ⇒ **绕过全站唯一的错误文案出口** `auth.js` `apiErrorMessage`（链路 = `error.i18n_key` → i18n 四语
 *     → 服务端原文映射 → `auth.err.REQUEST_FAILED` 兜底）⇒ 401/503 时用户看到的是服务端**码原文**
 *     （如 `AUTH_UNAUTHORIZED`）而不是四语文案。
 *   同一形态在本仓**既有存量**亦有（下文 BASELINE 逐条登记）—— 单点修复抓不住类，故本门扫**全量面**。
 *
 * ── 判据（可判负）─────────────────────────────────────────────────────────────
 *   ① 受体识别：凡 `const|let|var X = await ….json()`（即**原始响应包**）登记的 `X`；
 *   ② 命中：同一文件内后续行出现 `X.message` / `X?.message` / `X.error.message` / `X.error?.message`
 *      ⇒ 即「**拿原始包里的 message 直接拼 `Error` 或当用户文案**」= 违例；
 *   ③ 判负：命中若**不在 BASELINE（逐条登记 + 理由）**中 ⇒ `VERDICT=FAIL`（退出码 1）。
 *      ⇒ 硬口径 = 「**本单/本次改动新增面零命中**」，存量按条登记、不要求一次清完。
 *   ④ 作用域读数：打印**扫描文件数 / 受体数 / 命中数 / 基线项数**（命中 0 或受体 0 ⇒ 断言无效，
 *      不得当「零违例」—— 与 `p4z-i18nviol-global.mjs` 同一自证口径）。
 *
 * ── 豁免（逐条列名 + 理由，不得通配）───────────────────────────────────────────
 *   · `auth.js` = 错误文案链的**实现本体**（`extractApiErrorMessage` / `apiErrorMessage` 按定义必须
 *     读原始包）；它**就是**全站唯一出口，不是「绕过出口」。
 *
 * ── 残余发现（打印、不计命中，不静默放水）──────────────────────────────────────
 *   · 原始包的 `X.error`（裸读 / `X.error.code`）：可能是对象 ⇒ 直接拼文案会出 `[object Object]`；
 *     当前未计入命中（本门只判 `message` 面），逐条打印供另单收口。
 *
 * 用法：node scripts/p7a-03-errmessage-gate.mjs [srcRoot]
 *       缺省 srcRoot = 本脚本同级的 `../src`（仓内 = `frontend/src`）；
 *       给参可对**仓外镜像**判负（报告 §4 的判负自证即用此形，零仓内污染）。
 * 只读：不写任何文件。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../src')

/** 出口本体（相对 `src/` 的路径）· 逐条列名 + 理由，不得通配 */
const CHAIN_IMPL = [
  ['auth.js', '错误文案链**实现本体**：`extractApiErrorMessage`/`apiErrorMessage` 按定义必须读原始包；本文件即全站唯一出口'],
]

/**
 * 存量基线 · 逐条登记（键 = `相对路径::命中行的去空白原样`）+ 理由。
 * 口径：**不要求一次清完**；但任何**未登记**命中一律判负。基线项若已消失 ⇒ 打印提示（不影响判负，
 * 防白名单变垃圾场，须由改动者同步清理）。
 *
 * ★ 批 7-D（③ 页面级直拼 toast 归护栏）：**基线已清零（3 → 0）**。三条存量全部改走
 * `auth.js` `apiErrorMessage`（全站唯一出口）：
 *   · `components/ActiveTaskModal.jsx`：`data.message` ⇒ `await apiErrorMessage(data, response.status)`；
 *   · `components/ClaimRewardModal.jsx`：`data.error || data.message` ⇒ `await apiErrorMessage(data, resp.status)`；
 *   · `pages/TaskPage.jsx`：模块级 `fetchJson` 的 `data?.message || fallback` ⇒ `await apiErrorMessage(data, response.status)`。
 * ⇒ 本门判负口径随之收紧：**命中数必须 = 0**（不再有「存量登记」缓冲）。逐条见 `docs/audit/p7-d-errmsg-i18n.md`。
 */
const BASELINE = []

const isExempt = (rel) => CHAIN_IMPL.find(([f]) => rel === f)

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p)
  }
  return out
}

// 受体：`const X = await <expr>.json()`（允许尾随 `.catch(...)`；本仓六处受体均为单行形态）
const RECEPTOR = /^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+[^\n]*?\.json\s*\(\s*\)/

const files = fs.existsSync(SRC) ? walk(SRC) : []
const scanned = []
const receptors = []
const hits = []
const residuals = []

for (const f of files) {
  const rel = path.relative(SRC, f).split(path.sep).join('/')
  if (rel.startsWith('test/')) continue // 测试夹具按契约自造响应体，非产品取数面
  scanned.push(rel)
  const lines = fs.readFileSync(f, 'utf8').split('\n')
  const names = new Set()
  lines.forEach((raw, i) => {
    const m = raw.match(RECEPTOR)
    if (m) {
      names.add(m[1])
      receptors.push({ rel, no: i + 1, name: m[1] })
    }
  })
  if (!names.size) continue
  const re = new RegExp(
    `\\b(?:${[...names].join('|')})\\b\\s*\\??\\.\\s*(?:error\\s*\\??\\.\\s*message|message)\\b`,
  )
  const reErrFace = new RegExp(`\\b(?:${[...names].join('|')})\\b\\s*\\??\\.\\s*error\\b`)
  lines.forEach((raw, i) => {
    const t = raw.trim()
    if (!t || /^(\/\/|\*|\/\*)/.test(t)) return
    if (re.test(raw)) {
      hits.push({
        rel,
        no: i + 1,
        key: `${rel}::${t.replace(/\s+/g, ' ')}`,
        exempt: isExempt(rel),
      })
    } else if (reErrFace.test(raw) && !isExempt(rel)) {
      residuals.push(`${rel}:${i + 1}  ${t}`)
    }
  })
}

const baselineKeys = new Set(BASELINE.map(([k]) => k))
const liveHits = hits.filter((h) => !h.exempt)
const unregistered = liveHits.filter((h) => !baselineKeys.has(h.key))
const stale = BASELINE.filter(([k]) => !liveHits.some((h) => h.key === k))

console.log('[P7A-ERRMSG] 作用域：「frontend/src/**/*.{js,jsx}」（不含 test/）')
console.log(`  srcRoot = ${SRC}`)
console.log(`  扫描文件数 = ${scanned.length}；识别「原始响应包受体」 = ${receptors.length} 个`)
for (const r of receptors) console.log(`    · ${r.rel}:${r.no}  ${r.name} = await ….json()`)

console.log(`[P7A-ERRMSG] 命中（原始包 .message 直用）= ${hits.length}（其中出口本体豁免 ${hits.length - liveHits.length}）`)
for (const h of hits) console.log(`  ${h.exempt ? '~' : '!'} ${h.rel}:${h.no} [${h.exempt ? 'CHAIN_IMPL' : (baselineKeys.has(h.key) ? 'BASELINE' : '未登记')}] ${JSON.stringify(h.key)}`)
if (!liveHits.length) {
  console.log('  （0 命中 —— 作用域读数已给：受体数 > 0 且扫描文件数 > 0 ⇒ 断言非空转）')
}

console.log(`[P7A-ERRMSG] 豁免登记 = ${CHAIN_IMPL.length} 条（逐条列名 + 理由）`)
for (const [f, why] of CHAIN_IMPL) console.log(`  ~ src/${f} :: ${why}`)
console.log(`[P7A-ERRMSG] 存量基线登记 = ${BASELINE.length} 条`)
for (const [k, why] of BASELINE) console.log(`  # ${k} :: ${why}`)
for (const [k] of stale) console.log(`  ^ 基线项已消失（提示，不影响判负；请同步清理）: ${k}`)

console.log(`[P7A-ERRMSG] 残余发现（原始包 X.error 裸读；打印不计命中，另单收口）= ${residuals.length}`)
for (const r of residuals) console.log(`  ? ${r}`)

for (const h of unregistered) console.log(`  ! 未登记命中（必须登记或修掉）: ${h.key}`)
const fail = unregistered.length > 0
console.log(`[P7A-ERRMSG] 总判：${fail ? 'FAIL' : 'PASS'}（未登记命中 ${unregistered.length} 必须 = 0；扫描文件 ${scanned.length} / 受体 ${receptors.length} / 命中 ${liveHits.length} / 基线 ${BASELINE.length}）`)
// 与 p4z-i18nviol-global.mjs 同口径：`process.exit()` 会丢弃未 flush 的管道 stdout ⇒ 只设 exitCode。
process.exitCode = fail ? 1 : 0
