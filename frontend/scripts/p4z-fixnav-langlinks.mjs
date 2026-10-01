#!/usr/bin/env node
/**
 * FIX-NAV · 站内链接构造器 + LangShell 路由归属 读数脚本（本单新增，只读）
 *
 * 口径（§5.7 ③④）：
 *   ① 静态命中数 = 去注释后逐文件正则命中数（注释里的旧写法引用不算代码存量）；
 *   ② 契约读数 = 动态 import `src/utils.js` 后**真调**构造函数逐条取值（不是代码推断）；
 *   ③ 每项打印 PASS/FAIL，末行总判；无法测得 ⇒ 打 NOT_MEASURED，**不填 0/空**。
 *
 * 用法：node scripts/p4z-fixnav-langlinks.mjs   （只读，不写任何文件）
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(HERE, '../src')

const stripComments = (text) => text
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|\s)\/\/[^\n]*/g, '')

const walk = (dir, out = []) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) { walk(abs, out); continue }
    if (/\.(js|jsx)$/.test(entry.name)) out.push(abs)
  }
  return out
}

const results = []
const record = (name, ok, detail) => {
  results.push({ name, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
}

console.log('[FIX-NAV] ① F2 同族静态清零：src 下不得再用「undefined 当语言段」的旧构造')
const files = walk(SRC).filter((abs) => !abs.includes(`${path.sep}test${path.sep}`))
const legacyHits = []
for (const abs of files) {
  const text = stripComments(fs.readFileSync(abs, 'utf8'))
  const hits = text.match(/buildLangPath\([^)]*,\s*undefined\s*\)/g) || []
  if (hits.length) legacyHits.push(`${path.relative(SRC, abs)}×${hits.length}`)
}
record('buildLangPath(<path>, undefined) 命中数', legacyHits.length === 0, `命中=${legacyHits.length}${legacyHits.length ? ` [${legacyHits.join(', ')}]` : ''}（口径：去注释后逐文件正则）`)

console.log('[FIX-NAV] ② F1 路由归属：登录/注册必须在 LangShell 内层（相对段），顶层不得再有绝对路径版')
const appSrc = stripComments(fs.readFileSync(path.join(SRC, 'App.jsx'), 'utf8'))
const topLevelLogin = (appSrc.match(/<Route path="\/login"/g) || []).length
const topLevelRegister = (appSrc.match(/<Route path="\/register"/g) || []).length
record('顶层绝对路由 <Route path="/login"> 计数', topLevelLogin === 0, `计数=${topLevelLogin}`)
record('顶层绝对路由 <Route path="/register"> 计数', topLevelRegister === 0, `计数=${topLevelRegister}`)
record('LangShell 内层相对路由 login', appSrc.includes('<Route path="login" element={<AuthPage mode="login" />} />'))
record('LangShell 内层相对路由 register', appSrc.includes('<Route path="register" element={<AuthPage mode="register" />} />'))

console.log('[FIX-NAV] ③ 链接构造器契约：动态 import utils.js 真调逐条取值（判负 = 语言缺失/非法）')
let contractOk = false
try {
  // utils.js 用的是 Vite 风格的无扩展名相对导入（`./auth`），Node ESM 解析不了；
  // 被测的是**纯函数**，故在 TMPDIR 造一份去掉 import 行、补 clsx 桩的等价副本再真调（不是代码推断）。
  const source = fs.readFileSync(path.join(SRC, 'utils.js'), 'utf8')
  const sanitized = `const clsx = (...args) => args.filter(Boolean).join(' ')\n`
    + source.split('\n').filter((line) => !/^\s*import\s/.test(line)).join('\n')
  const tmp = path.join(os.tmpdir(), `fixnav-utils-${process.pid}.mjs`)
  fs.writeFileSync(tmp, sanitized)
  const utils = await import(pathToFileURL(tmp).href)
  fs.rmSync(tmp, { force: true })
  const { buildLocalizedPath, langPathPrefix, buildLangPath } = utils
  const cases = [
    ['zh⇒原样', () => buildLocalizedPath('zh', '/listing/5'), '/listing/5'],
    ['en⇒/en 前缀', () => buildLocalizedPath('en', '/listing/5'), '/en/listing/5'],
    ['hk⇒/hk 前缀', () => buildLocalizedPath('hk', '/listing/5'), '/hk/listing/5'],
    ['vn⇒/vn 前缀', () => buildLocalizedPath('vn', '/listing/5'), '/vn/listing/5'],
    ['缺语言⇒不含 undefined', () => String(buildLocalizedPath(undefined, '/listing/5')).includes('undefined'), false],
    ['非法语言⇒不含 undefined', () => String(buildLocalizedPath('xx', '/listing/5')).includes('undefined'), false],
    ['前缀 zh⇒空串', () => langPathPrefix('zh'), ''],
    ['前缀 en⇒/en', () => langPathPrefix('en'), '/en'],
    ['buildLangPath 兜底非法语言', () => buildLangPath('/listing', undefined), '/listing'],
    ['合法语言行为不变', () => buildLangPath('/vn/listing', 'hk'), '/hk/listing'],
  ]
  const bad = []
  for (const [name, fn, expected] of cases) {
    const got = fn()
    const ok = got === expected
    if (!ok) bad.push(name)
    console.log(`    · ${name}: 实得=${JSON.stringify(got)} 期望=${JSON.stringify(expected)} ${ok ? 'OK' : 'MISMATCH'}`)
  }
  contractOk = bad.length === 0
  record('契约用例逐条对拍（含 2 条判负）', contractOk, `用例=${cases.length} 不符=${bad.length}`)
} catch (error) {
  console.log(`  NOT_MEASURED  动态 import utils.js 失败（node 侧模块副作用）：${String(error?.message || error)}`)
  results.push({ name: '契约用例逐条对拍', ok: false, detail: 'NOT_MEASURED' })
}

const overall = results.every((r) => r.ok)
console.log(`[FIX-NAV] 总判：${overall ? 'PASS' : 'FAIL'}（${results.filter((r) => r.ok).length}/${results.length} 项）`)
process.exit(overall ? 0 : 1)
