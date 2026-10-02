#!/usr/bin/env node
/* p4z-feperf-cssorder.mjs — P6-FE-PERF：产物 CSS 里「safelist 类到底落在哪个 @layer / @media 里」的定位取数（只读）
   用途：回答「构建期生成的 lg:/xl: 工具类是否被 styles/tailwind-compat.css 的**手写无层规则**压过」。
   口径：把 CSS 文本按花括号做深度扫描，记录每个出现位置的**外层 at-rule 链**（@layer / @media / @supports），
        以及该选择器在文件里的字符序位（同一层内后者胜；无层规则 > 任何 @layer 规则）。
   用法：node scripts/p4z-feperf-cssorder.mjs [token...]
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'assets');
const cssFile = fs.existsSync(DIST) ? fs.readdirSync(DIST).filter((f) => f.endsWith('.css')).map((f) => path.join(DIST, f))[0] : null;
if (!cssFile) { console.error('NO_DIST_CSS'); process.exit(2); }
const css = fs.readFileSync(cssFile, 'utf8');

// 深度扫描：在每个 '{' 处压栈当前 at-rule 文本，'}' 处弹栈，记录每个选择器的 at-rule 链
const stack = [];
const hits = [];
let buf = '';
for (let i = 0; i < css.length; i++) {
  const ch = css[i];
  if (ch === '{') { stack.push(buf.trim().slice(-60)); buf = ''; continue; }
  if (ch === '}') { buf = ''; stack.pop(); continue; }
  if (ch === ';' && stack.length === 0) { buf = ''; continue; }
  buf += ch;
  if (buf.startsWith('.') && buf.length < 90) {
    // 判定是否是一个选择器起点（前一个字符是 } 或 ; 或文件头）
    const prev = css[i - buf.length];
    if (prev === '}' || prev === ';' || i - buf.length < 0) {
      hits.push({ at: i - buf.length, sel: buf.replace(/\s+/g, ' '), chain: stack.join(' < '), layered: stack.some((s) => s.startsWith('@layer')) });
      buf = '';
    }
  } else if (buf.length > 90) buf = buf.slice(-40);
}

const ESC = (t) => t.replace(/[:.[\]()#%/,]/g, (c) => '\\' + c);
const tokens = process.argv.slice(2).length ? process.argv.slice(2)
  : ['lg:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-4', 'md:grid-cols-2', 'md:text-2xl', 'lg:text-3xl', 'scale-[1.05]', 'scale-1.05'];
const out = { css: path.relative(ROOT, cssFile), css_bytes: Buffer.byteLength(css), tokens: {} };
for (const t of tokens) {
  const needle = '.' + ESC(t);
  const found = hits.filter((h) => h.sel.startsWith(needle) && !/^[\w-]/.test(h.sel[needle.length] || ' '));
  out.tokens[t] = {
    occurrences_in_cssom_scan: found.length,
    positions: found.map((h) => ({ char_pos: h.at, layered: h.layered, at_rule_chain: h.chain || '(unlayered/root)' })),
  };
}
// 无层（unlayered）规则总数 vs 分层规则总数，用于证明 compat 层是无层的
out.unlayered_selector_hits = hits.filter((h) => !h.layered).length;
out.layered_selector_hits = hits.filter((h) => h.layered).length;
out.compat_unlayered_grid_rules = hits.filter((h) => !h.layered && /grid-cols/.test(h.sel)).map((h) => ({ sel: h.sel.slice(0, 60), pos: h.at })).slice(0, 12);
console.log(JSON.stringify(out, null, 1));
