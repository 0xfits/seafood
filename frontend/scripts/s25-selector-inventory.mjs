#!/usr/bin/env node
/**
 * S25 · B12 —— 零消费选择器**只读盘点**（不改任何代码 / 不写 styles.css）
 *
 * 目的：把 `frontend/src/styles.css` 里的**选择器**与 `frontend/src/**` 的 **JSX/JS 实际类名消费**
 *   对拍，输出「零消费选择器清单」。本脚本**纯只读**：只读 `styles.css` 与源码，只**写 stdout**
 *   与（可选）`--out <dir>` 指定的产物目录；**绝不**写 `styles.css`。
 *
 * ── 口径（写死；处理误报的规则逐条列名）───────────────────────────────────────
 *   · 选择器解析：剥注释（保留换行以对齐行号）→ 花括号配对扫描，取每条规则的前导串（prelude）。
 *     `@media/@supports/@container/@layer` 内的**同名选择器**另记 `ctx`（不改判据，仅标注来源）。
 *     `@keyframes` 内的 `0%/from/to` **不是**选择器 ⇒ 整块跳过。
 *   · class 消费判定 = **整词精确匹配**（区分前缀类）：JSX/HTML 串按空白切词，`.card` **不**由
 *     `sf-card` 命中（`sf-card` 是一个词，不等于 `card`）；`.sf-card-body` 也不等于 `.sf-card`。
 *   · CSS 变量（`--x` / `var(--x)`）**不**参与 class/id 判定。
 *   · `!important` 只影响声明，不影响选择器消费 ⇒ 不参与判定。
 *   · 动态拼接类名（模板串 `` `sf-x-${v}` `` / `clsx(a && 'x')` 变量）**无法静态枚举** ⇒ 若某 class
 *     与任一「模板串静态前缀」互为前缀延长 ⇒ 单列「不确定」，不并入「零消费」。
 *   · `src/**`（**排除 `src/test/`**、**排除 `styles.css` 自身**）；
 *     `html` = `index.html` / `admin.html` / `public` 下的 `*.html`（非 JSX 面）。
 *   · `url(#id)`（内联 SVG `clip-path`/`fill` 图形定义）单独数。
 *
 * 用法：node scripts/s25-selector-inventory.mjs [--out <dir>] [--json]
 *   退出码：恒 0（盘点非门禁）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')          // = frontend/
const SRC = path.join(ROOT, 'src')
const STYLES = path.join(SRC, 'styles.css')

const argv = process.argv.slice(2)
const outDir = (() => { const i = argv.indexOf('--out'); return i >= 0 ? argv[i + 1] : null })()
const asJson = argv.includes('--json')

// ── ① 解析 styles.css 选择器 ───────────────────────────────────────────────
const rawCss = fs.readFileSync(STYLES, 'utf8')
// 剥注释但保留换行（行号对齐）
const cssNoComments = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
const cssLines = cssNoComments.split('\n')

const rules = []            // { selector, line, ctx, keyframeInner }
{
  const stack = []          // 祖先前导串
  let buf = ''
  let bufLine = 0
  let line = 1
  for (let i = 0; i < cssNoComments.length; i++) {
    const c = cssNoComments[i]
    if (c === '{') {
      const pre = buf.trim()
      if (pre) {
        const ancestors = stack.join(' | ')
        const keyframeInner = stack.some((s) => /@keyframes/.test(s))
        const mediaCtx = stack.filter((s) => /@(media|supports|container|layer)/.test(s)).join(' | ')
        rules.push({ selector: pre, line: bufLine, ctx: mediaCtx, keyframeInner })
      }
      stack.push(pre)
      buf = ''
    } else if (c === '}') {
      stack.pop()
      buf = ''
    } else if (c === ';') {
      buf = ''
    } else {
      if (buf.trim() === '') bufLine = line
      buf += c
    }
    if (c === '\n') line += 1
  }
}

const CLASS_RE = /\.[A-Za-z_][\w-]*/g
const ID_RE = /#[A-Za-z_][\w-]*/g
const PSEUDO_ELEM_RE = /::(before|after|placeholder|selection|marker|first-line|first-letter|backdrop|file-selector-button|part|slotted|highlight|cue)/

const selectorRecords = []
for (const r of rules) {
  if (r.selector.startsWith('@')) continue       // at-rule 前导（@media(...) / @keyframes name / @font-face）
  if (r.keyframeInner) continue                  // 关键帧百分比 / from / to
  const parts = r.selector.split(',').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean)
  for (const sel of parts) {
    const classes = [...new Set((sel.match(CLASS_RE) || []).map((t) => t.slice(1)))]
    const ids = [...new Set((sel.match(ID_RE) || []).map((t) => t.slice(1)))]
    selectorRecords.push({
      selector: sel,
      line: r.line,
      ctx: r.ctx,
      classes,
      ids,
      pseudoElem: PSEUDO_ELEM_RE.test(sel),
      idForm: ids.length > 0,
    })
  }
}

// ── ② 收集消费集（class 整词 / id / url(#id) / 动态前缀）─────────────────────
const CLASS_TOKEN_RE = /^[A-Za-z_][\w-]*$/

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules') continue
    const fp = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'test') continue              // 排除 src/test/
      walk(fp, out)
    } else if (/\.(jsx?|tsx?)$/.test(e.name)) {
      out.push(fp)
    }
  }
  return out
}

// 从一段文本抽「整词」候选：切分符**含 `$`**（使 `${…}` 断开）、含常见标点；**保留 `-`/`_`** 做整词
const tokenize = (text) => text.split(/[\s"'`{}()[\].,;:=>$#+*!?&|~/\\]+/).filter((t) => CLASS_TOKEN_RE.test(t) && t.length >= 2)

const codeFiles = walk(SRC).filter((f) => f !== STYLES)
const codeTokens = new Set()
const dynFragments = new Set()
// ★ 仅从「类名上下文」取消费（避免把 design-token 键 / 普通文案误当类名）：
//   className=/class= 属性 · cn()/clsx()/classnames()/cx() 调用 · classList.add|remove|toggle|contains ·
//   querySelector(All)('.x') / getElementById。每个命中后取一段窗口，抽出其中的字符串/模板字面量。
const CLASS_CTX_RE = /(?:className|class|\bid)\s*=\s*|(?:\bcn|\bclsx|\bclassnames|\bcx)\s*\(|classList\s*\.\s*(?:add|remove|toggle|contains)\s*\(|querySelector(?:All)?\s*\(\s*['"`]?\.?|getElementById\s*\(/g
const LIT_RE = /'([^'\\\n]*)'|"([^"\\\n]*)"|`((?:[^`\\]|\\.)*)`/g
// 类名映射表（如 `variantClass = { primary: 'btn-a', … }` / `sizeClass`）—— 值在模块级、不在 className 窗口内
const MAP_RE = /(?:const|let|var)\s+[A-Za-z_]\w*(?:[Cc]lass|[Vv]ariant|[Ss]ize|[Tt]heme|[Ss]tyle)[A-Za-z_]*\s*=\s*\{/g
for (const fp of codeFiles) {
  const src = fs.readFileSync(fp, 'utf8')
  const blobs = []
  for (const m of src.matchAll(CLASS_CTX_RE)) {
    blobs.push(src.slice(m.index + m[0].length, m.index + m[0].length + 200))
  }
  for (const m of src.matchAll(MAP_RE)) {
    const start = m.index + m[0].length - 1   // 指向 '{'
    let d = 0
    let i = start
    for (; i < src.length; i++) {
      if (src[i] === '{') d += 1
      else if (src[i] === '}') { d -= 1; if (d === 0) { i += 1; break } }
    }
    blobs.push(src.slice(start, i))
  }
  for (const s of blobs) {
    for (const lm of s.matchAll(LIT_RE)) {
      const v = lm[1] ?? lm[2] ?? lm[3] ?? ''
      for (const t of tokenize(v)) codeTokens.add(t)
    }
    if (s.includes('${')) for (const sp of s.split('${')) for (const t of tokenize(sp)) dynFragments.add(t)
  }
}

// html 面（非 JSX）
const htmlFiles = []
for (const cand of ['index.html', 'admin.html']) {
  const p = path.join(ROOT, cand)
  if (fs.existsSync(p)) htmlFiles.push(p)
}
const pub = path.join(ROOT, 'public')
if (fs.existsSync(pub)) {
  for (const e of fs.readdirSync(pub, { withFileTypes: true })) {
    if (e.isFile() && /\.html?$/.test(e.name)) htmlFiles.push(path.join(pub, e.name))
  }
}
const htmlTokens = new Set()
let htmlClassHits = 0
for (const fp of htmlFiles) {
  const src = fs.readFileSync(fp, 'utf8')
  for (const m of src.matchAll(/(?:class|id)=["']([^"']*)["']/g)) {
    htmlClassHits += 1
    for (const t of tokenize(m[1])) htmlTokens.add(t)
  }
}

// url(#id) 内联 SVG 引用（CSS 面 + 代码面 + html 面）
const svgUrlRefs = new Set()
for (const txt of [rawCss, ...codeFiles.map((f) => fs.readFileSync(f, 'utf8')), ...htmlFiles.map((f) => fs.readFileSync(f, 'utf8'))]) {
  for (const m of (txt.match ? txt.matchAll(/url\(#([A-Za-z_][\w-]*)\)/g) : [])) svgUrlRefs.add(m[1])
}

// 动态前缀判定（互为前缀延长 ⇒ 不确定）
const isDynamic = (name) => {
  if (name.length < 3) return false
  for (const f of dynFragments) {
    const stem = f.replace(/-$/, '')
    if (stem.length < 3) continue
    if (name === stem) continue
    if (name.startsWith(stem) || stem.startsWith(name)) return true
  }
  return false
}

// ── ③ 对拍 ⇒ 零消费清单 + 三分类（真残留 / 活跃·非 JSX 面 / 不确定）────────────
// 「同族前缀」证据：该名与某「已消费 token」共享 `-` 分段 ⇒ 疑似「前缀概念存在但类名已换」（真残留细分）
const segs = (n) => n.split('-').filter(Boolean)
const consumedList = [...codeTokens]
const sameFamily = (n) => {
  const s = new Set(segs(n))
  return consumedList.some((t) => t !== n && segs(t).some((x) => s.has(x)))
}
const classifyName = (n) => {
  if (htmlTokens.has(n)) return '活跃·非JSX面(HTML)'
  if (svgUrlRefs.has(n)) return '活跃·非JSX面(内联SVG url(#id))'
  if (isDynamic(n)) return '不确定(动态拼接)'
  return '真残留'
}

const zero = []
for (const rec of selectorRecords) {
  // 相对 **JSX(code) 面** 未消费的 class / id（html / svg 面在 classifyName 内单独判定，不并吞）
  const clsZero = rec.classes.filter((c) => !codeTokens.has(c))
  const idZero = rec.ids.filter((x) => !codeTokens.has(x))
  if (rec.classes.length === 0 && rec.ids.length === 0) continue   // 纯元素/伪类（无类名/id）
  if (clsZero.length === 0 && idZero.length === 0) continue         // JSX 面有消费

  const names = [...clsZero, ...idZero]
  const perName = names.map((n) => ({
    name: n,
    bucket: classifyName(n),
    html: htmlTokens.has(n),
    svgUrl: svgUrlRefs.has(n),
    dyn: isDynamic(n),
    sameFamily: sameFamily(n),
  }))
  const buks = [...new Set(perName.map((p) => p.bucket))]
  const bucket = buks.length === 1 ? buks[0] : `混合(${buks.join('+')})`
  zero.push({
    selector: rec.selector,
    line: rec.line,
    ctx: rec.ctx || '(top)',
    pseudoElem: rec.pseudoElem,
    idForm: rec.idForm,
    bucket,
    names: perName,
  })
}

// 三分类逐类读数（按分片 + 按名）
const bucketCounts = {}
for (const z of zero) bucketCounts[z.bucket] = (bucketCounts[z.bucket] || 0) + 1
const nameBucketCounts = {}
for (const z of zero) for (const p of z.names) nameBucketCounts[p.bucket] = (nameBucketCounts[p.bucket] || 0) + 1

// ── 输出 ───────────────────────────────────────────────────────────────────
const counts = {
  rules: rules.length,
  selectorParts: selectorRecords.length,
  distinctClasses: new Set(selectorRecords.flatMap((r) => r.classes)).size,
  distinctIds: new Set(selectorRecords.flatMap((r) => r.ids)).size,
  codeFiles: codeFiles.length,
  htmlFiles: htmlFiles.length,
  codeTokens: codeTokens.size,
  htmlTokens: htmlTokens.size,
  svgUrlRefs: svgUrlRefs.size,
  zeroConsumptionParts: zero.length,
  bucketCounts,
  nameBucketCounts,
  distinctZeroNames: new Set(zero.flatMap((z) => z.names.map((n) => n.name))).size,
}

if (outDir) fs.mkdirSync(outDir, { recursive: true })

if (asJson) {
  const payload = { styles: path.relative(ROOT, STYLES), counts, zero }
  const txt = JSON.stringify(payload, null, 2)
  if (outDir) fs.writeFileSync(path.join(outDir, 'b12-zero-consumption.json'), txt + '\n')
  process.stdout.write(txt + '\n')
} else {
  const L = []
  L.push('[B12 选择器盘点] 作用域 = src/styles.css（只读，不改）')
  L.push(`  规则前导 = ${counts.rules}；选择器分片 = ${counts.selectorParts}；distinct class = ${counts.distinctClasses}；distinct id = ${counts.distinctIds}`)
  L.push(`  消费面：code 文件 = ${counts.codeFiles}（排除 src/test 与 styles.css）；html 文件 = ${counts.htmlFiles}；code 整词 = ${counts.codeTokens}；html 整词 = ${counts.htmlTokens}；url(#id) 引用 = ${counts.svgUrlRefs}`)
  L.push(`  ★ 零 JSX 消费选择器分片 = ${counts.zeroConsumptionParts}（distinct 名 = ${counts.distinctZeroNames}）`)
  L.push(`  三分类·按分片：${Object.entries(bucketCounts).map(([k, v]) => `${k}=${v}`).join(' ; ')}`)
  L.push(`  三分类·按名  ：${Object.entries(nameBucketCounts).map(([k, v]) => `${k}=${v}`).join(' ; ')}`)
  L.push('')
  for (const z of zero) {
    const tag = [z.pseudoElem ? '伪元素' : '', z.idForm ? 'id形态' : '', z.ctx !== '(top)' ? `ctx=${z.ctx}` : ''].filter(Boolean).join(',')
    const nm = z.names.map((p) => `${p.name}${p.svgUrl ? `[url(#${p.name})]` : ''}${p.sameFamily ? '*' : ''}`).join(',')
    L.push(`  L${String(z.line).padStart(4)} [${z.bucket}] ${z.selector}${tag ? `  {${tag}}` : ''}  ≪${nm}≫`)
  }
  const txt = L.join('\n')
  if (outDir) fs.writeFileSync(path.join(outDir, 'b12-zero-consumption.txt'), txt + '\n')
  process.stdout.write(txt + '\n')
}
process.exit(0)
