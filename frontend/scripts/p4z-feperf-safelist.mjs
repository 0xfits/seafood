#!/usr/bin/env node
/* p4z-feperf-safelist.mjs — P6-FE-PERF「safelist / 动态类名」单一真源（只读；不写任何文件）
   口径：
   1) SAFELIST = src/styles.css 里 @source inline("...") 的 token 全集（单一真源，非手工抄写）。
   2) DYNAMIC  = 源码里**运行期拼接**出来的类名（构建期静态扫描看不到），逐个带 file:line。
      · src/components/ui/Responsive.jsx  gridClasses[·] × 前缀（md>=2 / lg>=3 / xl>=4 三个守卫决定可达值）
      · src/components/ui/Responsive.jsx  sizeClasses[·]  × 前缀（md !== sm / lg !== md）
      · src/components/ui/MicroInteractions.jsx:14 悬浮缩放（P6-FE-PERF 已改为任意值形态 scale-[1.05]）
   3) 产物核对：dist/assets/*.css 里按 **CSS 转义形态** 匹配（md:grid-cols-2 → .md\:grid-cols-2；
      任意值 scale-[1.05] → .scale-\[1\.05\]）。
   用法：
     node scripts/p4z-feperf-safelist.mjs                  # JSON + VERDICT
     node scripts/p4z-feperf-safelist.mjs --neg=scale-1.05  # 判负：把该 token 从 safelist 里摘掉后再核对
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* —— CSS 选择器转义 / 匹配 —— */
export const cssEscape = (t) => t.replace(/[:.[\]()#%/,]/g, (c) => '\\' + c);
export const cssHasToken = (css, token) => css.includes('.' + cssEscape(token));
export const missingInCss = (css, tokens) => tokens.filter((t) => !cssHasToken(css, t));

/* —— safelist（单一真源 = src/styles.css） —— */
const stylesCss = read('src/styles.css');
const stylesLines = stylesCss.split('\n');
const safelistIdx = stylesLines.findIndex((l) => l.includes('@source inline('));
if (safelistIdx === -1) throw new Error('styles.css 未找到 @source inline(...)');
export const SAFELIST_LINE = { file: 'src/styles.css', line: safelistIdx + 1, text: stylesLines[safelistIdx].trim() };
export const SAFELIST = ((SAFELIST_LINE.text.match(/@source inline\("([^"]*)"\)/) || [])[1] || '')
  .split(/\s+/).filter(Boolean);
if (!SAFELIST.length) throw new Error('safelist 解析为空');

/* —— 运行期拼接可达类名 —— */
const respTxt = read('src/components/ui/Responsive.jsx');
export const RESP_LINES = respTxt.split('\n');
const objOf = (name) => {
  const m = respTxt.match(new RegExp('const\\s+' + name + '\\s*=\\s*\\{([\\s\\S]*?)\\}'));
  if (!m) throw new Error('Responsive.jsx 未找到对象 ' + name);
  const line = respTxt.slice(0, m.index).split('\n').length;
  const entries = [...m[1].matchAll(/(['"]?[A-Za-z0-9-]+['"]?)\s*:\s*'([^']*)'/g)].map((x) => [x[1].replace(/['"]/g, ''), x[2]]);
  if (!entries.length) throw new Error('Responsive.jsx 对象 ' + name + ' 解析为空');
  return { line, map: Object.fromEntries(entries) };
};
const grid = objOf('gridClasses');
const size = objOf('sizeClasses');

const GRID_GUARDS = [['md', 2], ['lg', 3], ['xl', 4]]; // md >= 2 && … / lg >= 3 && … / xl >= 4 && …
const TEXT_PREFIXES = ['md', 'lg'];                    // md !== sm / lg !== md

export const DYNAMIC = [];
for (const [prefix, guard] of GRID_GUARDS) {
  for (const [k, v] of Object.entries(grid.map)) {
    if (!(Number(k) >= guard)) continue;
    DYNAMIC.push({ token: `${prefix}:${v}`, file: 'src/components/ui/Responsive.jsx', line: grid.line, expr: `\`${prefix}:\${gridClasses[${k}]}\`` });
  }
}
for (const prefix of TEXT_PREFIXES) {
  for (const v of Object.values(size.map)) {
    DYNAMIC.push({ token: `${prefix}:${v}`, file: 'src/components/ui/Responsive.jsx', line: size.line, expr: `\`${prefix}:\${sizeClasses[·]}\`` });
  }
}
const microTxt = read('src/components/ui/MicroInteractions.jsx');
const microLine = microTxt.split('\n').findIndex((l) => l.includes('scale-[')) + 1;
const microLegacy = /`scale-\$\{/.test(microTxt);
DYNAMIC.push({ token: 'scale-[1.05]', file: 'src/components/ui/MicroInteractions.jsx', line: microLine, expr: microLegacy ? '`scale-${scale}`（旧·不可构建）' : "'scale-[1.05]'（任意值形态）" });

export const DYNAMIC_TOKENS = [...new Set(DYNAMIC.map((d) => d.token))].sort();

/* —— 产物 CSS —— */
export const DIST = path.join(ROOT, 'dist', 'assets');
export const distCssPath = fs.existsSync(DIST)
  ? (fs.readdirSync(DIST).filter((f) => f.endsWith('.css')).map((f) => path.join(DIST, f))[0] || null)
  : null;
export const distCss = distCssPath ? fs.readFileSync(distCssPath, 'utf8') : null;

/* —— 核对 —— */
export const dynamicMissingFromSafelist = DYNAMIC_TOKENS.filter((t) => !SAFELIST.includes(t));
export const safelistMissingInDist = distCss ? missingInCss(distCss, SAFELIST) : null;
export const dynamicMissingInDist = distCss ? missingInCss(distCss, DYNAMIC_TOKENS) : null;
export const microLegacyLiteralInCss = distCss ? cssHasToken(distCss, 'scale-1.05') : null;

const negArg = (process.argv.find((a) => a.startsWith('--neg=')) || '').slice(6);
if (process.argv[1] && import.meta.url === new URL('file://' + path.resolve(process.argv[1])).href) {
  const safelistUsed = negArg ? SAFELIST.filter((t) => t !== negArg) : SAFELIST;
  const neg = negArg
    ? { dropped: negArg, dist_missing_after_drop: missingInCss(distCss || '', safelistUsed) }
    : null;
  const out = {
    calibre: 'safelist = styles.css @source inline(...) 全集；dynamic = 源码运行期拼接可达类名；产物匹配用 CSS 转义形态',
    safelist_line: SAFELIST_LINE,
    safelist_count: SAFELIST.length,
    dynamic_count: DYNAMIC_TOKENS.length,
    dynamic: DYNAMIC,
    dynamic_missing_from_safelist: dynamicMissingFromSafelist,
    dist_css: distCssPath ? path.relative(ROOT, distCssPath) : null,
    dist_css_bytes: distCss ? Buffer.byteLength(distCss) : null,
    safelist_missing_in_dist: safelistMissingInDist,
    dynamic_missing_in_dist: dynamicMissingInDist,
    micro_legacy_literal_in_css: microLegacyLiteralInCss,
    negative_control: neg,
  };
  const ok = dynamicMissingFromSafelist.length === 0 &&
    (safelistMissingInDist || []).length === 0 && (dynamicMissingInDist || []).length === 0 &&
    microLegacyLiteralInCss === false &&
    (negArg ? neg.dist_missing_after_drop.length > 0 : true);
  console.log(JSON.stringify(out, null, 1));
  console.error('VERDICT=' + (ok ? 'PASS' : 'FAIL'));
  // 批 7-A 修：`process.exit()` 会丢弃未 flush 的管道 stdout（同 `p4z-i18nviol-global.mjs`）⇒ 改设 `exitCode`。
  process.exitCode = ok ? 0 : 1;
}
