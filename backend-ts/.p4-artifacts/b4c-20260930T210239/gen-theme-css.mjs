// 从单一真源 frontend/src/theme/tokens.js 生成 frontend/src/theme/theme-tokens.css。
// 目的：CSS 静态可加载，且 JS/CSS 两份值由 src/test/unit/theme-tokens.test.js 逐键互校（不允许手改 CSS）。
import fs from 'node:fs'
import path from 'node:path'
import { THEME_TOKENS, TOKEN_KEYS, STRUCT, structuralVars } from '/Users/kevin/bistro/seafood/frontend/src/theme/tokens.js'

const OUT = '/Users/kevin/bistro/seafood/frontend/src/theme/theme-tokens.css'
const head = `/* 海鲜市场 · 主题 token 层（生成物，勿手改）
 * 单一真源 = frontend/src/theme/tokens.js（其值提取自 docs/design/style-preview.html 变体 A/B）
 * 生成器 = backend-ts/.p4-artifacts/b4c-20260930T210239/gen-theme-css.mjs
 * 日/夜两档键集合完全相同，只差值；主题差集内只有 颜色 / border-radius / box-shadow。
 */
`
const block = (sel, entries) =>
  `${sel} {\n` + entries.map(([k, v]) => `  ${k}: ${v};`).join('\n') + '\n}\n'

const structEntries = Object.entries(structuralVars())
const dayEntries = TOKEN_KEYS.map((k) => [`--sf-${k}`, THEME_TOKENS.day[k]])
const nightEntries = TOKEN_KEYS.map((k) => [`--sf-${k}`, THEME_TOKENS.night[k]])

// 结构常量只在 :root 声明（两档共用）；主题 token 分别落在 light / dark 两个选择器上。
const css = [
  head,
  block(':root', structEntries),
  '/* 日档「码头大牌」= style-preview.html 变体 A（200–267 行） */',
  block(':root,\n[data-theme="light"]', dayEntries),
  '/* 夜档「夜市行情板」= style-preview.html 变体 B（273–351 行） */',
  block('[data-theme="dark"]', nightEntries),
].join('\n')

fs.writeFileSync(OUT, css)
console.log(JSON.stringify({ out: OUT, bytes: css.length, struct: structEntries.length, day: dayEntries.length, night: nightEntries.length, struct_keys: Object.keys(STRUCT).length }, null, 2))
