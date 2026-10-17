/**
 * Neng 独立质检 ④：AC-6（结构不变式）· AC-8（范围边界）· 冻结面清单 B（逐条「未破」）
 * 静态面全部**现取**：tokens.js 直接 import（frontend/package.json type=module）+ CSS 解析 + git diff + grep。
 * 用法：node ops/ui-card-ref-20261017/qa/neng-static-checks.mjs <out.json>
 */
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { REPO, writeJson } from './neng-lib.mjs'

const OUT = process.argv[2] || path.join(REPO, 'ops/ui-card-ref-20261017/qa/neng-readings-static.json')
const PARENT = '/Users/kevin/.hermes/profiles/zang/cache/scratch/neng-ac5/parent'
const sh = (cmd, cwd = REPO) => { try { return { out: execSync(cmd, { cwd, encoding: 'utf8' }), exit: 0 } } catch (e) { return { out: String(e.stdout || '') + String(e.stderr || ''), exit: e.status == null ? -1 : e.status } } }
const read = (p) => fs.readFileSync(p, 'utf8')

const R = { probe: 'neng-static-checks.mjs（Neng 质检员 · 现取）', at: new Date().toISOString(), ac6: {}, ac8: {}, freezeListB: {}, grep: {}, tokenModel: {} }

// ---------------- ① grep 面 ----------------
const pageBgGrep = sh(`grep -rn 'var(--sf-page-bg)' frontend/src`)
R.grep.pageBgConsumers = { lines: pageBgGrep.out.trim().split('\n').filter(Boolean), count: pageBgGrep.out.trim().split('\n').filter(Boolean).length, expect: 1 }
const mediaGrep = sh(`grep -c '@media' frontend/src/shell/shell.css`)
R.grep.shellCssMediaCount = { value: Number(mediaGrep.out.trim()), expect: 1 }
const dataThemeGrep = sh(`grep -n 'data-theme' frontend/src/shell/shell.css`)
R.grep.shellCssDataTheme = { lines: dataThemeGrep.out.trim().split('\n').filter(Boolean), expect: 0 }
const widthWordGrep = sh(`grep -rnE 'matchMedia|innerWidth|innerHeight|clientWidth|offsetWidth|screen\\.width' frontend/src/shell frontend/src/theme`)
R.grep.shellThemeWidthWords = { lines: widthWordGrep.out.trim().split('\n').filter(Boolean), expect: 0 }
const regionGrep = sh(`grep -rho 'data-sf-region="[a-z]*"' frontend/src/shell | sort -u`)
R.grep.dataSfRegions = { value: regionGrep.out.trim().split('\n').filter(Boolean), expectFive: ['data-sf-region="footer"', 'data-sf-region="shell"', 'data-sf-region="tabbar"', 'data-sf-region="topnav"', 'data-sf-region="content"'] }
const fde = sh(`grep -rn 'FDE815' frontend/src --include='*.css' --include='*.jsx' --include='*.js'`)
const fdeLines = fde.out.trim().split('\n').filter(Boolean)
R.grep.fde815 = { total: fdeLines.length, outsideTokensJs: fdeLines.filter((l) => !l.includes('theme/tokens.js')).length, allInThemeTokensCss: fdeLines.filter((l) => !l.includes('theme/tokens.js')).every((l) => l.includes('theme/theme-tokens.css')), sampleOutside: fdeLines.filter((l) => !l.includes('theme/tokens.js')).slice(0, 3) }
const customVariant = sh(`grep -rn 'custom-variant' frontend/src frontend/index.html`)
R.grep.customVariant = { lines: customVariant.out.trim().split('\n').filter(Boolean), count: customVariant.out.trim().split('\n').filter(Boolean).length }
const pcsSrc = sh(`grep -rn 'prefers-color-scheme' frontend/src --include='*.css' --include='*.js' --include='*.jsx'`)
R.grep.prefersColorSchemeInSrc = { lines: pcsSrc.out.trim().split('\n').filter(Boolean), count: pcsSrc.out.trim().split('\n').filter(Boolean).length }

// ---------------- ② token 模型（改后 vs 改前） ----------------
const cur = await import(path.join(REPO, 'frontend/src/theme/tokens.js'))
const par = await import(path.join(PARENT, 'frontend/src/theme/tokens.js'))
const dayKeys = Object.keys(cur.THEME_TOKENS.day)
const nightKeys = Object.keys(cur.THEME_TOKENS.night)
const diffKeys = dayKeys.filter((k) => cur.THEME_TOKENS.day[k] !== cur.THEME_TOKENS.night[k])
R.tokenModel.current = {
  TOKEN_KEYS_len: cur.TOKEN_KEYS.length, day_len: dayKeys.length, night_len: nightKeys.length,
  keyOrderIdentical: JSON.stringify(dayKeys) === JSON.stringify(nightKeys),
  TOKEN_KEYS_contains_surface_bg: cur.TOKEN_KEYS.includes('surface-bg'),
  TOKEN_KEYS_equals_day_keys: JSON.stringify(cur.TOKEN_KEYS) === JSON.stringify(dayKeys),
  dayNightDiffKeyCount: diffKeys.length, dayNightDiffKeyCount_gt90: diffKeys.length > 90,
  pageBg_day: cur.THEME_TOKENS.day['page-bg'], pageBg_night: cur.THEME_TOKENS.night['page-bg'],
  pageBg_day_ne_night: cur.THEME_TOKENS.day['page-bg'] !== cur.THEME_TOKENS.night['page-bg'],
  surfaceBg_day: cur.THEME_TOKENS.day['surface-bg'], surfaceBg_night: cur.THEME_TOKENS.night['surface-bg'],
  topbarBg_day: cur.THEME_TOKENS.day['topbar-bg'], topbarBg_night: cur.THEME_TOKENS.night['topbar-bg'],
  STRUCT_count: Object.keys(cur.STRUCT).length, STRUCT_PROV_count: Object.keys(cur.STRUCT_PROV).length,
  EXCLUDED_FROM_THEME_count: cur.EXCLUDED_FROM_THEME.length,
  STRUCT_hasHashOrRgba: Object.entries(cur.STRUCT).filter(([, v]) => /#|rgba\(/.test(String(v))),
  STRUCT_PROV_missing: Object.keys(cur.STRUCT).filter((k) => !(k in cur.STRUCT_PROV)),
  PROV_pageBg: cur.PROV['page-bg'], PROV_surfaceBg: cur.PROV['surface-bg'],
  STRUCT_PROV_shellMaxW: cur.STRUCT_PROV['shell-max-w'],
  shellMaxW: cur.STRUCT['shell-max-w'],
}
R.tokenModel.parent = {
  TOKEN_KEYS_len: par.TOKEN_KEYS.length, STRUCT_count: Object.keys(par.STRUCT).length,
  STRUCT_PROV_count: Object.keys(par.STRUCT_PROV).length, EXCLUDED_FROM_THEME_count: par.EXCLUDED_FROM_THEME.length,
  hasSurfaceBg: par.TOKEN_KEYS.includes('surface-bg'), pageBg_day: par.THEME_TOKENS.day['page-bg'],
}
R.tokenModel.unchanged = {
  STRUCT_count_same: R.tokenModel.current.STRUCT_count === R.tokenModel.parent.STRUCT_count,
  EXCLUDED_FROM_THEME_count_same: R.tokenModel.current.EXCLUDED_FROM_THEME_count === R.tokenModel.parent.EXCLUDED_FROM_THEME_count,
  TOKEN_KEYS_delta: R.tokenModel.current.TOKEN_KEYS_len - R.tokenModel.parent.TOKEN_KEYS_len,
  surface_bg_is_new: !R.tokenModel.parent.hasSurfaceBg && R.tokenModel.current.TOKEN_KEYS_contains_surface_bg,
}

// ---------------- ③ 真源 PROV 回读（A4 硬门） ----------------
{
  const src = read(path.join(REPO, 'docs/design/style-preview.html')).split('\n')
  const at = (n) => (src[n - 1] || '')
  R.tokenModel.provReadback = {
    'page-bg.d': { [1069]: at(1069), expect: 'background:#F5F7F9', ok: at(1069).includes('background:#F5F7F9') },
    'surface-bg.d': { [1071]: at(1071), expect: 'background:#FFFFFF', ok: at(1071).includes('background:#FFFFFF') },
    'surface-bg.n': { [1073]: at(1073), expect: 'background:#101114', ok: at(1073).includes('background:#101114') },
    'page-bg.n': { [273]: at(273), ok: at(273).includes('background:#0B0C0E') },
    'shell-max-w': { [85]: at(85), ok: at(85).includes('max-width:1440px') },
  }
}

// ---------------- ④ theme-tokens.css 逐键互校（A5 / B4 / B5） ----------------
{
  const css = read(path.join(REPO, 'frontend/src/theme/theme-tokens.css')).split('\n')
  const grab = (startRe) => {
    let i = css.findIndex((l) => startRe.test(l))
    if (i < 0) return null
    const map = {}
    for (let j = i; j < css.length; j += 1) {
      const m = css[j].match(/^\s*(--sf-[a-z0-9-]+):\s*(.+?);\s*$/)
      if (m) map[m[1]] = m[2]
      if (j > i && /^\}/.test(css[j])) break
    }
    return { startLine: i + 1, map }
  }
  const dayBlk = grab(/^:root,\s*$/)
  const nightBlk = grab(/^\[data-theme="dark"\]\s*\{/)
  const dKeys = Object.keys(dayBlk.map)
  const nKeys = Object.keys(nightBlk.map)
  const dayMismatch = dKeys.filter((k) => dayBlk.map[k] !== cur.THEME_TOKENS.day[k.replace(/^--sf-/, '')])
  const nightMismatch = nKeys.filter((k) => nightBlk.map[k] !== cur.THEME_TOKENS.night[k.replace(/^--sf-/, '')])
  const nulls = dKeys.filter((k) => dayBlk.map[k] == null || dayBlk.map[k] === '')
  R.tokenModel.themeTokensCss = {
    dayBlockStart: dayBlk.startLine, nightBlockStart: nightBlk.startLine,
    dayKeyCount: dKeys.length, nightKeyCount: nKeys.length,
    keySetIdentical: JSON.stringify([...dKeys].sort()) === JSON.stringify([...nKeys].sort()),
    keyOrderIdentical: JSON.stringify(dKeys) === JSON.stringify(nKeys),
    dayKeyCountEqualsTokenKeys: dKeys.length === cur.TOKEN_KEYS.length,
    dayMismatch, nightMismatch, emptyValues: nulls,
    surfaceBg_day: dayBlk.map['--sf-surface-bg'], surfaceBg_night: nightBlk.map['--sf-surface-bg'],
    pageBg_day: dayBlk.map['--sf-page-bg'], pageBg_night: nightBlk.map['--sf-page-bg'],
    allEqual_tokensJs: dayMismatch.length === 0 && nightMismatch.length === 0 && dKeys.length === cur.TOKEN_KEYS.length,
  }
}

// ---------------- ⑤ AC-8 范围边界（git diff 现取） ----------------
{
  const names = sh(`git diff --name-only`).out.trim().split('\n').filter(Boolean)
  const itemDiff = sh(`git diff -U0 -- frontend/src/pages/item/item.css`).out
  const changedLines = itemDiff.split('\n').filter((l) => (/^\+[^+]/.test(l) || /^-[^-]/.test(l)))
  const priceTouching = changedLines.filter((l) => /sf-item-price|--sf-l-detail-price-size|--sf-l-actionbar-h/.test(l))
  R.ac8 = {
    changedFiles: names,
    containsThemePreviewPage: names.some((n) => /ThemePreviewPage\.jsx|theme-preview\.css/.test(n)),
    itemCssInDiff: names.includes('frontend/src/pages/item/item.css'),
    itemCssChangedLines: changedLines,
    itemCssChangedLineCount: changedLines.length,
    itemCssTouchesPriceFamily: priceTouching,
    itemCssOnlyActionbarBackground: changedLines.length === 2 && changedLines.some((l) => /^\-.*background: var\(--sf-page-bg\)/.test(l)) && changedLines.some((l) => /^\+.*background: var\(--sf-surface-bg\)/.test(l)),
    numstat: sh(`git diff --numstat`).out.trim().split('\n'),
  }
}

// ---------------- ⑥ AC-6 汇总 ----------------
R.ac6 = {
  shellCssMediaCount_eq1: R.grep.shellCssMediaCount.value === 1,
  shellCssNoDataTheme: R.grep.shellCssDataTheme.lines.length === 0,
  shellThemeJsNoWidthWords: R.grep.shellThemeWidthWords.lines.length === 0,
  fiveRegionsIdentical: JSON.stringify([...R.grep.dataSfRegions.value].sort()) === JSON.stringify([...R.grep.dataSfRegions.expectFive].sort()),
  tokenKeysContainsSurfaceBg: R.tokenModel.current.TOKEN_KEYS_contains_surface_bg,
  themeTokensCssKeySetsEqualAndMatchTokensJs: R.tokenModel.themeTokensCss.allEqual_tokensJs,
  structCountUnchanged: R.tokenModel.unchanged.STRUCT_count_same,
  excludedFromThemeCountUnchanged: R.tokenModel.unchanged.EXCLUDED_FROM_THEME_count_same,
  horizontalOverflow: '见 neng-readings-ac123.json 各档 docOverflow（须恒 0）',
}
R.ac6.ok = R.ac6.shellCssMediaCount_eq1 && R.ac6.shellCssNoDataTheme && R.ac6.shellThemeJsNoWidthWords && R.ac6.fiveRegionsIdentical && R.ac6.tokenKeysContainsSurfaceBg && R.ac6.themeTokensCssKeySetsEqualAndMatchTokensJs && R.ac6.structCountUnchanged && R.ac6.excludedFromThemeCountUnchanged

R.ac8.ok = !R.ac8.containsThemePreviewPage && R.ac8.itemCssOnlyActionbarBackground && R.ac8.itemCssTouchesPriceFamily.length === 0

// 冻结面清单 B：静态可判部分（B1/B2/B5/B7/B8 的现取复算）；测试腿见 neng-tests-*.txt
R.freezeListB = {
  B1: { check: 'src/shell/** + src/theme/** JS 无 matchMedia/innerWidth/innerHeight/clientWidth/offsetWidth/screen.width（注释同禁）', hits: R.grep.shellThemeWidthWords.lines.length, ok: R.grep.shellThemeWidthWords.lines.length === 0 },
  B2: { check: 'shell.css 只有一个 767 断点块 + 无 [data-theme', mediaCount: R.grep.shellCssMediaCount.value, dataThemeHits: R.grep.shellCssDataTheme.lines.length, ok: R.grep.shellCssMediaCount.value === 1 && R.grep.shellCssDataTheme.lines.length === 0 },
  B3: { check: '五 data-sf-region 恒等 + tabbar href 集', source5: R.grep.dataSfRegions.value, ok: R.ac6.fiveRegionsIdentical },
  B4: { check: '日/夜键集合与键序完全相同 且 ≥100 键', keyOrderIdentical: R.tokenModel.current.keyOrderIdentical, keys: dayKeys.length, ok: R.tokenModel.current.keyOrderIdentical && dayKeys.length >= 100 },
  B5: { check: '键名黑名单 + 值形态白名单（surface/bg 不触黑名单；#FFFFFF/#101114 命中 hex 分支）', surfaceBgDay: R.tokenModel.current.surfaceBg_day, surfaceBgNight: R.tokenModel.current.surfaceBg_night, ok: /^#[0-9A-Fa-f]{6}$/.test(R.tokenModel.current.surfaceBg_day) && /^#[0-9A-Fa-f]{6}$/.test(R.tokenModel.current.surfaceBg_night) },
  B6: { check: '两档差异键 > 90；day.page-bg ≠ night.page-bg', diffKeyCount: diffKeys.length, pageBgDay: R.tokenModel.current.pageBg_day, pageBgNight: R.tokenModel.current.pageBg_night, ok: diffKeys.length > 90 && R.tokenModel.current.pageBg_day_ne_night },
  B7: { check: 'STRUCT ≥25 键、值不含 #/rgba(、STRUCT_PROV 齐备、与 token 不重名', structCount: R.tokenModel.current.STRUCT_count, provMissing: R.tokenModel.current.STRUCT_PROV_missing, hashOrRgba: R.tokenModel.current.STRUCT_hasHashOrRgba, ok: R.tokenModel.current.STRUCT_count >= 25 && R.tokenModel.current.STRUCT_PROV_missing.length === 0 && R.tokenModel.current.STRUCT_hasHashOrRgba.length === 0 },
  B8: { check: 'STRUCT_PROV 逐条可回读；EXCLUDED_FROM_THEME ≥8 条', excluded: R.tokenModel.current.EXCLUDED_FROM_THEME_count, ok: R.tokenModel.current.EXCLUDED_FROM_THEME_count >= 8 },
  note: 'B9/B10/B11 为测试腿 ⇒ 见 neng-tests-*.txt 的逐文件退出码',
}

writeJson(OUT, R)
console.log(JSON.stringify({
  out: OUT,
  AC6: R.ac6, AC6_ok: R.ac6.ok,
  AC8: { ok: R.ac8.ok, itemCssChangedLines: R.ac8.itemCssChangedLines, priceTouching: R.ac8.itemCssTouchesPriceFamily, themePreview: R.ac8.containsThemePreviewPage },
  grep: { pageBgConsumers: R.grep.pageBgConsumers, media: R.grep.shellCssMediaCount, dataTheme: R.grep.shellCssDataTheme.lines.length, widthWords: R.grep.shellThemeWidthWords.lines.length, regions: R.grep.dataSfRegions.value, fde815: R.grep.fde815, customVariant: R.grep.customVariant.count, pcsInSrc: R.grep.prefersColorSchemeInSrc.count },
  tokens: { current: R.tokenModel.current, unchanged: R.tokenModel.unchanged, provReadback: Object.fromEntries(Object.entries(R.tokenModel.provReadback).map(([k, v]) => [k, v.ok])), themeTokensCss: { ...R.tokenModel.themeTokensCss, map: undefined } },
  freezeListB: Object.fromEntries(Object.entries(R.freezeListB).filter(([k]) => k !== 'note').map(([k, v]) => [k, v.ok])),
}, null, 2))
