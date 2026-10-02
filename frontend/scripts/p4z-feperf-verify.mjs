#!/usr/bin/env node
/* p4z-feperf-verify.mjs — P6-FE-PERF 验收取数（只读；不写任何文件）
   检查项：
   A) 构建产物 CSS 是否含 safelist 的全部类名（正例）
   B) 关键工具类 / @theme 六色是否落产（正例）
   C) 判负对照 1：`scale-1.05` —— MicroInteractions.jsx:14 运行期拼出的字面量，
      实测 Tailwind v3(CDN)/v4 均**不产出**（scale-<number> 只吃整数）⇒ 期望 0
   D) 判负对照 2：越界动态值 md:grid-cols-8 / xl:grid-cols-8 / md:text-9xl ⇒ 期望 0
   E) 判负对照 3：`xl:grid-cols-4` 在 src 里**不作为字面量**出现（动态拼接独有），
      若它出现在产物 CSS 里，只可能来自 @source inline safelist
   用法：node scripts/p4z-feperf-verify.mjs
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DIST = path.join(ROOT, 'dist', 'assets');
const cssFile = fs.existsSync(DIST)
  ? fs.readdirSync(DIST).filter((f) => f.endsWith('.css')).map((f) => path.join(DIST, f))[0]
  : null;
if (!cssFile) { console.error('NO_DIST_CSS: 先跑 npm run build'); process.exit(2); }
const css = fs.readFileSync(cssFile, 'utf8');

const esc = (t) => t.replace(/:/g, '\\:').replace(/\./g, '\\.').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
const grid = (p) => [1, 2, 3, 4, 6].map((n) => `${p}:grid-cols-${n}`);
const text = (p) => ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl'].map((s) => `${p}:text-${s}`);
const SAFELIST = [...grid('md'), ...grid('lg'), ...grid('xl'), ...text('md'), ...text('lg')];
const EXCEPTION = 'scale-1.05'; // 实测不可生成的动态字面量（见 C）
const KEY = ['bg-white', 'z-50', 'shadow-md', 'sticky', 'border-b', 'max-w-7xl', 'rounded-md', 'text-lg', 'bg-primary', 'text-primary'];
const COLORS = ['primary', 'secondary', 'accent', 'success', 'warning', 'error'];
const NEG = ['scale-1.05', 'md:grid-cols-8', 'xl:grid-cols-8', 'md:text-9xl'];

const has = (tok) => css.includes('.' + esc(tok));

// E) src 字面量普查
const srcFiles = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'test') walk(p); } else if (/\.(jsx|js|html)$/.test(e.name)) srcFiles.push(p);
  }
})(path.join(ROOT, 'src'));
const srcText = srcFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const themeSrc = fs.readFileSync(path.join(ROOT, 'src', 'styles.css'), 'utf8');
const probe = 'xl:grid-cols-4';

const out = {
  css: path.relative(ROOT, cssFile),
  css_bytes: Buffer.byteLength(css),
  A_safelist_count: SAFELIST.length,
  A_missing: SAFELIST.filter((t) => !has(t)),
  B_key_present_missing: KEY.filter((t) => !has(t)),
  B_theme_migration: COLORS.map((c) => {
    const usedAsUtility = new RegExp(`(bg|text|border|ring|from|to|via|fill|stroke|shadow)-${c}(?![\\w-])`).test(srcText);
    return { color: c, declared_in_theme: themeSrc.includes(`--color-${c}:`), used_as_utility_in_src: usedAsUtility, var_in_css: css.includes(`--color-${c}:`) };
  }),
  B_bg_primary_is_tailwind: /\.bg-primary\{background-color:var\(--color-primary\)/.test(css),
  C_exception: { token: EXCEPTION, reason: 'scale-<number> 只接受整数（v3/v4 同），运行期拼接结果无法成为合法工具类', in_css: has(EXCEPTION) },
  D_neg_in_css: Object.fromEntries(NEG.map((t) => [t, has(t)])),
  E_probe_dynamic_only: { token: probe, literal_in_src: srcText.includes(probe), in_css: has(probe) },
};
const ok = out.A_missing.length === 0 && out.B_key_present_missing.length === 0 &&
  out.B_theme_migration.every((r) => r.var_in_css === r.used_as_utility_in_src) &&
  out.C_exception.in_css === false && Object.values(out.D_neg_in_css).every((v) => v === false) &&
  out.E_probe_dynamic_only.in_css === true && out.E_probe_dynamic_only.literal_in_src === false;
console.log(JSON.stringify(out, null, 1));
console.error('VERDICT=' + (ok ? 'PASS' : 'FAIL'));
process.exit(ok ? 0 : 1);
