/**
 * ★S8 locale 缺键类级守卫（Kong · 本单新增）
 *
 * 目的：把「**被引用的 i18n 键 ⊆ 四语 locale 键集**」写成**可判负断言**，防再犯
 *   （S7 现取到 `jobs.deliverable` 四语皆缺 ⇒ 页面渲染裸键名；类级缺口，点位清单必漏）。
 *
 * 口径（与 `s8_scan.py` 同源，逐字）：
 *   · 源面 = `frontend/src/**`，**排除**任何路径段为 `test` 的文件（不扫测试自身）。
 *   · 「被引用键」三类：
 *       ① 取键调用的**字面首参**：`t('k')` / `t("k")` / `t(`k`)`（无 `${}`）/ `i18n.t('k')` / `translate('k')`；
 *       ② **点号字面量**中首段 ∈ locale 顶层族者（覆盖 `KEY` 映射表值 / 三目字面量 / 常量数组）；
 *       ③ **模板键前缀**（`t(`prefix${var}`)`）—— 无法静态枚举后缀 ⇒ 仅断言「族非空」（四语各有 ≥1 键）。
 *   · 静态可判定（①+②）**必须**四语齐备；③ 单列「族非空」弱断言（不入静态通过面）。
 *
 * 自证（可判负）：`探针` 组的合成源注入一个不存在的键 ⇒ 检测器**必红**（给红点文本）。
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..') // = frontend/src
const LANGS = ['zh', 'en', 'hk', 'vn']
const CJK = /[\u3400-\u9fff]/

// ---------- locale ----------
const readLocale = (l) => JSON.parse(fs.readFileSync(path.join(SRC, `locales/${l}.json`), 'utf8'))
const flatten = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (
  v && typeof v === 'object' && !Array.isArray(v) ? flatten(v, `${p}${k}.`) : [[`${p}${k}`, v]]
))
const TABLES = Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(flatten(readLocale(l)))]))
const KEY_SETS = Object.fromEntries(LANGS.map((l) => [l, new Set(Object.keys(TABLES[l]))]))
const TOP = new Set(Object.keys(readLocale('zh')))

// ---------- 源码遍历（排除 test/） ----------
const walk = (dir, out = []) => {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules') continue
    const fp = path.join(dir, ent.name)
    if (ent.isDirectory()) {
      if (ent.name === 'test') continue
      walk(fp, out)
    } else if (ent.name.endsWith('.js') || ent.name.endsWith('.jsx')) {
      out.push(fp)
    }
  }
  return out
}

// ---------- 注释剔除（保留字符串与换行） ----------
const stripComments = (src) => {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i += 1 }
    } else if (c === '/' && src[i + 1] === '*') {
      out += '  '; i += 2
      while (i + 1 < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i += 1 }
      if (i + 1 < n) { out += '  '; i += 2 }
    } else if (c === "'" || c === '"' || c === '`') {
      const q = c; out += c; i += 1
      while (i < n) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
        out += src[i]
        if (src[i] === q) { i += 1; break }
        i += 1
      }
    } else { out += c; i += 1 }
  }
  return out
}

const CALL_RE = /(?<![\w.])(?:i18n\.t|t|translate)\s*\(/g
const DOTTED_RE = /'([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)'|"([A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z0-9_]+)+)"/g

/** 从源码文本抽取引用：{ literals:[{key,line}], dotted:[], templates:[prefix] } */
const extractRefs = (rawSrc) => {
  const src = stripComments(rawSrc)
  const literals = []
  const templates = []
  CALL_RE.lastIndex = 0
  let m
  while ((m = CALL_RE.exec(src)) !== null) {
    let p = m.index + m[0].length
    while (p < src.length && /\s/.test(src[p])) p += 1
    const line = src.slice(0, m.index).split('\n').length
    const ch = src[p]
    if (ch === "'" || ch === '"') {
      let j = p + 1; let buf = ''
      while (j < src.length && src[j] !== ch && src[j] !== '\n') { buf += src[j]; j += 1 }
      if (src[j] === ch) literals.push({ key: buf, line })
    } else if (ch === '`') {
      let j = p + 1; let buf = ''; let dyn = false
      while (j < src.length && src[j] !== '`') {
        if (src[j] === '\\') { buf += src[j + 1] ?? ''; j += 2; continue }
        if (src[j] === '$' && src[j + 1] === '{') dyn = true
        buf += src[j]; j += 1
      }
      if (dyn) templates.push(buf.split('${')[0])
      else literals.push({ key: buf, line })
    }
    // 非字面量（变量 / 三目 / 映射查表）⇒ 静态不可判定，交由 ② 点号字面量扫描或弱断言覆盖
  }
  const dotted = []
  DOTTED_RE.lastIndex = 0
  let d
  while ((d = DOTTED_RE.exec(src)) !== null) {
    const key = d[1] || d[2]
    if (TOP.has(key.split('.', 1)[0])) {
      dotted.push({ key, line: src.slice(0, d.index).split('\n').length })
    }
  }
  return { literals, dotted, templates }
}

/** 计算「被引用的静态键 ∉ 四语 locale」清单 */
const computeMissing = (rawSrc) => {
  const { literals, dotted } = extractRefs(rawSrc)
  const refs = new Map() // key -> first line
  for (const { key, line } of [...literals, ...dotted]) if (!refs.has(key)) refs.set(key, line)
  const problems = []
  for (const [key, line] of refs) {
    const miss = LANGS.filter((l) => !KEY_SETS[l].has(key))
    if (miss.length) problems.push(`${key} 缺 [${miss.join(',')}] (L${line})`)
  }
  return problems
}

// ============================================================================
describe('S8① 被引用静态键 ⊆ 四语 locale 键集（可判负）', () => {
  const files = walk(SRC)

  it('源面非空（探针：确认扫到工程文件，含已知面 pages/jobs/JobDetailPage.jsx）', () => {
    expect(files.length).toBeGreaterThan(80)
    const rel = files.map((f) => path.relative(SRC, f))
    expect(rel).toContain('pages/jobs/JobDetailPage.jsx')
    expect(rel.some((r) => r.startsWith('test'))).toBe(false)
  })

  it('逐文件：字面取键 + 点号字面量键 ∈ 四语（en/hk/vn/zh 全含）', () => {
    const violations = []
    for (const fp of files) {
      const problems = computeMissing(fs.readFileSync(fp, 'utf8'))
      for (const p of problems) violations.push(`${path.relative(SRC, fp)}: ${p}`)
    }
    expect(violations).toEqual([])
  })

  it('模板键前缀族非空（四语各有 ≥1 键；弱断言，不枚举后缀）', () => {
    const prefixes = new Set()
    for (const fp of files) {
      for (const pre of extractRefs(fs.readFileSync(fp, 'utf8')).templates) prefixes.add(pre)
    }
    const problems = []
    for (const pre of prefixes) {
      for (const l of LANGS) {
        if (![...KEY_SETS[l]].some((k) => k.startsWith(pre))) problems.push(`'${pre}' 在 ${l} 无任何键`)
      }
    }
    expect(problems).toEqual([])
  })
})

// ============================================================================
describe('S8① 首个缺键 jobs.deliverable 四语齐备', () => {
  it('四语存在、非空、en/vn 零 CJK', () => {
    const problems = []
    for (const l of LANGS) {
      const v = TABLES[l]['jobs.deliverable']
      if (typeof v !== 'string' || !v.trim()) { problems.push(`${l} 空/缺`); continue }
      if ((l === 'en' || l === 'vn') && CJK.test(v)) problems.push(`${l} 残留中文 ${v}`)
    }
    expect(problems).toEqual([])
    expect(TABLES.en['jobs.deliverable']).toBe('Deliverable')
    expect(TABLES.vn['jobs.deliverable']).toBe('Sản phẩm bàn giao')
  })

  it('键计数前推：顶层 119 / 拍平 1059 / 四语节点 4236（S9 +4 ledger.kind 键/语）', () => {
    for (const l of LANGS) {
      expect(Object.keys(readLocale(l)).length, `${l} top`).toBe(119)
      expect(Object.keys(TABLES[l]).length, `${l} flat`).toBe(1059)
    }
    expect(Object.keys(TABLES.zh).length * LANGS.length).toBe(4236)
  })
})

// ============================================================================
describe('S8② 检测器自证（注入不存在键 ⇒ 必红）', () => {
  it('合成源含 t(\'s8.__injected_missing__\') ⇒ computeMissing 命中', () => {
    const injected = "const a = t('s8.__injected_missing__')\n"
    const problems = computeMissing(injected)
    expect(problems.length).toBe(1)
    expect(problems[0]).toContain('s8.__injected_missing__')
    expect(problems[0]).toContain('缺 [zh,en,hk,vn]')
  })

  it('同一合成源剔除注入键 ⇒ 无命中（判定可逆）', () => {
    expect(computeMissing("const a = t('jobs.deliverable')\n")).toEqual([])
  })
})
