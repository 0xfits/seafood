#!/usr/bin/env node
/**
 * MISC-FIX ② · 乙族「硬编码绝对站内链接」现取清单（只读，本单手写扫描器）
 *
 * 口径（§5.7 ③④）：
 *   · 命中 = **去注释后**的代码里，`to="/…"` / `to='/…'` / `navigate('/…'` / `navigate("/…"` 的**字面量**写法；
 *     `/api/…`（取数）与 `//`（协议相对）**不计**，另列计数。注释行里的旧写法引用不计。
 *   · 每行给 `文件:行` 与代码；语言前缀已由 `buildLocalizedPath` 构造的行不计命中。
 *   · 残留清单必须**逐条落在已登记待办集合**（本文件 REGISTERED_TODO，逐条列名 + 理由）⇒ 否则 FAIL。
 *   · 无法测得 ⇒ NOT_MEASURED，不填 0/空。
 * 用法：node scripts/p4z-miscfix-links.mjs [srcRoot]     退出码 = 残留是否全部已登记
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(HERE, '../src')
const CTOR = /buildLocalizedPath\(|langPathPrefix\(/

/** 已登记待办（本单「只录不改」的残留；逐条：文件 + 形态 + 路径 + 理由，不得通配） */
const REGISTERED_TODO = [
  ['src/components/ActiveTaskModal.jsx', 'navigate', '/login', '会话失效跳登录 ×3：弹窗组件无 useLocation 上下文，改动牵入四语导航回归 ⇒ 另单'],
  ['src/pages/DashboardPage.jsx', 'navigate', '/login', '登录回落 ×1：页面只引 useNavigate，同上'],
  ['src/pages/DashboardPage.jsx', 'to=', '/', '返回首页 ×1：同上'],
  ['src/pages/admin/PointsManagement.jsx', 'navigate', '/login', '管理面会话失效跳登录 ×1：admin 守卫链为 zh 单语，改动须连权限链回归 ⇒ 另单'],
  ['src/pages/admin/PermissionsManagement.jsx', 'navigate', '/login', '同上 ×2'],
  ['src/pages/admin/UsersManagement.jsx', 'navigate', '/login', '同上 ×1'],
  ['src/pages/admin/SystemSettings.jsx', 'navigate', '/login', '同上 ×1'],
]

const stripComments = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*/gm, '').replace(/(\s)\/\/[^\n]*/g, '$1')
const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name)
    if (e.isDirectory()) walk(abs, out)
    else if (/\.(js|jsx)$/.test(e.name) && !abs.includes(`${path.sep}test${path.sep}`)) out.push(abs)
  }
  return out
}

const PATTERNS = [
  ['to=', /\bto=("|\')(\/[^"\']*)\1/g],
  ['navigate', /\bnavigate\(\s*("|\')(\/[^"\']*)\1/g],
]
const HREF = /\bhref=("|\')(\/[^"\']*)\1/g

const hits = []
const counts = { api: 0, proto: 0, href: 0 }
let scanned = 0
for (const abs of walk(SRC)) {
  const rel = path.relative(path.dirname(SRC), abs)
  const lines = stripComments(fs.readFileSync(abs, 'utf8')).split('\n')
  scanned++
  lines.forEach((line, i) => {
    for (const [kind, re] of PATTERNS) {
      re.lastIndex = 0
      let m
      while ((m = re.exec(line))) {
        const p = m[2]
        if (p.startsWith('/api/')) { counts.api++; continue }
        if (p.startsWith('//')) { counts.proto++; continue }
        hits.push({ kind, rel, line: i + 1, path: p, code: line.trim().slice(0, 100), ctor: CTOR.test(line) })
      }
    }
    HREF.lastIndex = 0
    if (HREF.test(line)) counts.href++
  })
}

const residual = hits.filter((h) => !h.ctor)
console.log(`[MISC-FIX-LINKS] 作用域 = ${SRC}`)
console.log(`  扫描源文件数 = ${scanned}；命中行数 = ${hits.length}（/api 字面量 ${counts.api}、协议相对 ${counts.proto}、\`href="/…"\` 行 ${counts.href} 另一类）`)
console.log(`  已由唯一构造器 buildLocalizedPath 构造 = ${hits.length - residual.length}；**残留 = ${residual.length}**`)
const byFile = {}
for (const h of residual) { (byFile[h.rel] ||= []).push(h) }
for (const [f, list] of Object.entries(byFile)) {
  console.log(`  · ${f} ×${list.length}`)
  for (const h of list) console.log(`      ${h.line}: ${h.code}`)
}
const key = (h) => `${h.rel}|${h.kind}|${h.path}`
const todoSet = new Set(REGISTERED_TODO.map(([f, k, p]) => `${f}|${k}|${p}`))
const unregistered = residual.filter((h) => !todoSet.has(key(h)))
console.log(`  已登记待办 = ${REGISTERED_TODO.length} 条；**未登记残留 = ${unregistered.length}**`)
for (const h of unregistered) console.log(`  ! ${key(h)} :: ${h.code}`)
console.log(`[MISC-FIX-LINKS] 总判：${unregistered.length === 0 ? 'PASS（残留全部已登记）' : 'FAIL（存在未登记残留）'}`)
process.exit(unregistered.length === 0 ? 0 : 1)
