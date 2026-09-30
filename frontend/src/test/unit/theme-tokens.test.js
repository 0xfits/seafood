import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  EXCLUDED_FROM_THEME,
  PROV,
  STRUCT,
  STRUCT_PROV,
  THEME_ATTR_VALUES,
  THEME_ORDER,
  THEME_TOKENS,
  TOKEN_KEYS,
  TOKEN_SOURCE_FILE,
} from '../../theme/tokens'

// 从仓库根读比选页真源（frontend/src/test/unit → ../../../../docs/design/...）
const here = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(here, '../../../..')
const SOURCE_PATH = path.join(REPO_ROOT, TOKEN_SOURCE_FILE)
const CSS_PATH = path.join(here, '../../theme/theme-tokens.css')

const sourceLines = fs.readFileSync(SOURCE_PATH, 'utf8').split('\n')
const cssText = fs.readFileSync(CSS_PATH, 'utf8')

const norm = (s) => s.replace(/\s+/g, '').toLowerCase()
const lineAt = (n) => sourceLines[n - 1]

// 把生成物 CSS 切成 { selector, decls:Map } 块
const parseCss = (text) => {
  const out = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m
  while ((m = re.exec(text)) !== null) {
    const selector = m[1].trim()
    const decls = new Map()
    for (const piece of m[2].split(';')) {
      const idx = piece.indexOf(':')
      if (idx === -1) continue
      decls.set(piece.slice(0, idx).trim(), piece.slice(idx + 1).trim())
    }
    out.push({ selector, decls })
  }
  return out
}

const blocks = parseCss(cssText.replace(/\/\*[\s\S]*?\*\//g, ''))
const structBlock = blocks.find((b) => b.selector === ':root')
const dayBlock = blocks.find((b) => b.selector.includes('[data-theme="light"]'))
const nightBlock = blocks.find((b) => b.selector.includes('[data-theme="dark"]'))

describe('主题 token 层 · 提取自 docs/design/style-preview.html', () => {
  it('真源文件存在且行数可读', () => {
    expect(fs.existsSync(SOURCE_PATH)).toBe(true)
    expect(sourceLines.length).toBeGreaterThan(400)
  })

  it('日/夜两档键集合完全相同（只差值）', () => {
    const dayKeys = Object.keys(THEME_TOKENS.day)
    const nightKeys = Object.keys(THEME_TOKENS.night)
    expect(dayKeys.length).toBe(TOKEN_KEYS.length)
    expect([...nightKeys].sort()).toEqual([...dayKeys].sort())
    // 键顺序也必须一致（保证 CSS 两档块形同构）
    expect(nightKeys).toEqual(dayKeys)
    expect(TOKEN_KEYS.length).toBeGreaterThanOrEqual(100)
  })

  it('每个 token 都有 文件:行号 提取证据，且该行确实含该值（禁发明）', () => {
    const failures = []
    for (const key of TOKEN_KEYS) {
      const prov = PROV[key]
      if (!prov) {
        failures.push(`${key}: 缺 PROV`)
        continue
      }
      for (const [which, themeName] of [['d', 'day'], ['n', 'night']]) {
        const entry = prov[which]
        if (!entry) {
          failures.push(`${key}.${which}: 缺证据`)
          continue
        }
        const [lineNo, needle, mustNot] = entry
        if (typeof THEME_TOKENS[themeName][key] !== 'string') failures.push(`${key}.${which}: 值表缺档`)
        const raw = lineAt(lineNo)
        if (raw === undefined) {
          failures.push(`${key}.${which}: 行号 ${lineNo} 越界`)
          continue
        }
        if (!norm(raw).includes(norm(needle))) failures.push(`${key}.${which}: L${lineNo} 不含「${needle}」`)
        if (mustNot && norm(raw).includes(norm(mustNot))) failures.push(`${key}.${which}: L${lineNo} 不该含「${mustNot}」`)
      }
    }
    expect(failures).toEqual([])
  })

  it('主题差集内只有 颜色 / border-radius / box-shadow（键名不得含几何属性词）', () => {
    // 按「连字符分段精确匹配」判，避免 topbar 被 top 误伤
    const forbiddenSegments = new Set([
      'padding', 'pad', 'margin', 'gap', 'width', 'height', 'size', 'cols', 'rows', 'flex',
      'order', 'display', 'position', 'inset', 'top', 'left', 'right', 'bottom', 'font',
      'spacing', 'line', 'overflow', 'z', 'min', 'max', 'grid', 'align', 'justify',
    ])
    const bad = TOKEN_KEYS.filter((key) => key.split('-').some((seg) => forbiddenSegments.has(seg)))
    expect(bad).toEqual([])
    // 值的形态也只允许：颜色 / none / transparent / inherit / 圆角 px / 阴影（含颜色）/ 渐变
    const shape = /^(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|transparent|none|inherit|currentColor|\d+px|linear-gradient\([^)]*\)|\d+px \d+px [^;]+)$/
    const badValues = TOKEN_KEYS.filter((key) => !shape.test(THEME_TOKENS.day[key]) || !shape.test(THEME_TOKENS.night[key]))
    expect(badValues).toEqual([])
  })

  it('两档确有差异（否则「几何 0 差」可能只是压根没换肤）', () => {
    const changed = TOKEN_KEYS.filter((key) => THEME_TOKENS.day[key] !== THEME_TOKENS.night[key])
    expect(changed.length).toBeGreaterThan(90)
    expect(THEME_TOKENS.day['page-bg']).not.toBe(THEME_TOKENS.night['page-bg'])
    expect(THEME_TOKENS.day['card-radius']).not.toBe(THEME_TOKENS.night['card-radius'])
    expect(THEME_TOKENS.day['card-shadow']).not.toBe(THEME_TOKENS.night['card-shadow'])
  })

  it('结构常量（几何）两档同值，且不含颜色', () => {
    const keys = Object.keys(STRUCT)
    expect(keys.length).toBeGreaterThanOrEqual(25)
    for (const key of keys) {
      expect(typeof STRUCT[key]).toBe('string')
      expect(STRUCT[key]).not.toMatch(/#|rgba?\(/)
      expect(STRUCT_PROV[key]).toBeTruthy()
    }
    // 结构常量与主题 token 不得重名（两套命名空间互不串）
    expect(keys.filter((k) => TOKEN_KEYS.includes(k))).toEqual([])
  })

  it('结构常量的提取证据逐条可回读', () => {
    const failures = []
    for (const key of Object.keys(STRUCT)) {
      const prov = STRUCT_PROV[key]
      for (const which of ['d', 'n']) {
        const [lineNo, needle, mustNot] = prov[which]
        const raw = lineAt(lineNo)
        if (!raw || !norm(raw).includes(norm(needle))) failures.push(`${key}.${which}: L${lineNo} 不含「${needle}」`)
        if (mustNot && norm(raw).includes(norm(mustNot))) failures.push(`${key}.${which}: L${lineNo} 不该含「${mustNot}」`)
      }
    }
    expect(failures).toEqual([])
  })

  it('几何相关的档间差异已登记在 EXCLUDED_FROM_THEME（含文件:行号 与理由）', () => {
    expect(EXCLUDED_FROM_THEME.length).toBeGreaterThanOrEqual(8)
    for (const row of EXCLUDED_FROM_THEME) {
      expect(row.what.length).toBeGreaterThan(0)
      expect(row.why.length).toBeGreaterThan(10)
      expect(`${row.day} ${row.night}`).toMatch(/style-preview\.html:\d+/)
    }
  })

  it('主题名 → <html data-theme> 取值沿用既有口径（light/dark）', () => {
    expect(THEME_ATTR_VALUES).toEqual({ day: 'light', night: 'dark' })
    expect(THEME_ORDER).toEqual(['day', 'night'])
  })
})

describe('主题 token 层 · 生成物 CSS 与 JS 单一真源逐键一致', () => {
  it('CSS 三个块齐备（结构常量 / 日档 / 夜档）', () => {
    expect(structBlock).toBeTruthy()
    expect(dayBlock).toBeTruthy()
    expect(nightBlock).toBeTruthy()
  })

  it('日档块逐键等于 JS day 表，夜档块逐键等于 JS night 表', () => {
    const mismatches = []
    for (const key of TOKEN_KEYS) {
      const varName = `--sf-${key}`
      if (dayBlock.decls.get(varName) !== THEME_TOKENS.day[key]) {
        mismatches.push(`day ${varName}: css=${dayBlock.decls.get(varName)} js=${THEME_TOKENS.day[key]}`)
      }
      if (nightBlock.decls.get(varName) !== THEME_TOKENS.night[key]) {
        mismatches.push(`night ${varName}: css=${nightBlock.decls.get(varName)} js=${THEME_TOKENS.night[key]}`)
      }
    }
    expect(mismatches).toEqual([])
  })

  it('日/夜两块的 CSS 变量键集合完全相同（只有值变）', () => {
    const dayVars = [...dayBlock.decls.keys()].sort()
    const nightVars = [...nightBlock.decls.keys()].sort()
    expect(nightVars).toEqual(dayVars)
    expect(dayVars.length).toBe(TOKEN_KEYS.length)
  })

  it('结构常量只出现在 :root 块（不随主题块重声明）', () => {
    const structVars = [...structBlock.decls.keys()]
    expect(structVars.length).toBe(Object.keys(STRUCT).length)
    const leaked = structVars.filter((v) => dayBlock.decls.has(v) || nightBlock.decls.has(v))
    expect(leaked).toEqual([])
  })
})
