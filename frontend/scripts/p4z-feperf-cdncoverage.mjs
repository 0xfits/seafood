#!/usr/bin/env node
/* p4z-feperf-cdncoverage.mjs — 取数脚本（只读，不改任何文件）
   口径：
   1) Tailwind 风格类名全集 = src 下 jsx/js/html 中出现的 class token（空格/引号切分），
      保留变体前缀（md: hover: dark: sm: lg: xl: 2xl: active: group-hover:），
      过滤掉明显非 Tailwind 的自定义类（sf-*、btn、nav-link、is-*、js-* 等）。
   2) 本地 CSS 覆盖集 = styles.css + styles/*.css 里定义过的 class 选择器（含转义 \: ）。
   3) 差集 = 「仅 Tailwind CDN 能提供」的类 ⇒ CDN 挂掉的爆炸半径。
   输出：人读摘要 + JSON（--json 时）。
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');

const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'test' && e.name !== 'images') walk(p, out); }
    else if (/\.(jsx|js|html|css)$/.test(e.name)) out.push(p);
  }
  return out;
};

const files = walk(SRC);
const codeFiles = files.filter((f) => /\.(jsx|js|html)$/.test(f));

// --- 1) class token 全集 -------------------------------------------------
const tokenCount = new Map();
const tokenWhere = new Map();
for (const f of codeFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  // className="..." / className={`...`} / className={cn('...')} 中的字符串字面量都扫
  const re = /className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\}|"([^"]*)")/g;
  let m;
  const grab = (s) => {
    for (const t of (s || '').split(/[\s"'`,{}()[\]]+/)) {
      if (!t || t.includes('${')) continue;
      tokenCount.set(t, (tokenCount.get(t) || 0) + 1);
      if (!tokenWhere.has(t)) tokenWhere.set(t, `${path.relative(ROOT, f)}`);
    }
  };
  while ((m = re.exec(txt))) grab(m[1] || m[2] || m[3] || m[4]);
}
// 兜底：全文件字符串字面量扫描（Tailwind v4 官方扫描器就是全文本扫描）
for (const f of codeFiles) {
  const txt = fs.readFileSync(f, 'utf8');
  for (const mm of txt.matchAll(/'([^'\n]{1,120})'|"([^"\n]{1,120})"|`([^`\n]{1,120})`/g)) {
    const s = mm[1] || mm[2] || mm[3] || '';
    if (!/^[\w:./\[\]#%\- !]+$/.test(s)) continue;
    for (const t of s.split(/\s+/)) {
      if (!t) continue;
      if (!tokenCount.has(t)) { tokenCount.set(t, 0); tokenWhere.set(t, `${path.relative(ROOT, f)}`); }
    }
  }
}

// --- Tailwind 风格判定 ---------------------------------------------------
const LOCAL_PREFIX = /^(sf-|js-|is-|nav-|btn|badge|card|container$|animate-|ripple|fade|slide|stagger)/;
const UTIL = /^(?:((?:sm|md|lg|xl|2xl|hover|focus|active|group-hover|dark|dark:hover|print)\:)+)?([a-z][a-z0-9-]*(?:-[a-z0-9./%[\]#()]+)*)$/;
const KNOWN_ROOT = /^(?:bg|text|p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr|w|h|min-w|max-w|min-h|max-h|flex|grid|gap|space|rounded|border|shadow|opacity|z|top|bottom|left|right|inset|static|fixed|absolute|relative|sticky|block|inline|hidden|overflow|font|leading|tracking|uppercase|lowercase|capitalize|truncate|whitespace|transition|duration|ease|delay|transform|translate|scale|rotate|origin|cursor|select|pointer|resize|outline|ring|divide|col|row|order|basis|grow|shrink|justify|items|content|self|place|object|aspect|position|align|columns|float|clear|isolate|list|line-clamp|backdrop|blur|brightness|contrast|grayscale|invert|saturate|sepia|drop-shadow|from|via|to|fill|stroke|sr-only|not-sr-only|antialiased|subpixel-antialiased|appearance|placeholder|decoration|indent|align|table|border-collapse|border-spacing|filter|backface|perspective|will-change|touch|scroll|snap|accent|caret|box|break|hyphens|text-wrap|size)/;
const isUtility = (t) => {
  if (t.length < 2 || t.includes('${')) return false;
  if (LOCAL_PREFIX.test(t)) return false;
  const m = t.match(UTIL);
  if (!m) return false;
  const body = m[2];
  return KNOWN_ROOT.test(body) || /^(xs|sm|base|lg|xl|2xl|3xl|4xl)$/.test(body);
};

// --- 2) 本地 CSS 覆盖 ----------------------------------------------------
const cssFiles = files.filter((f) => /\.css$/.test(f));
const localClasses = new Set();
const unesc = (s) => s.replace(/\\(.)/g, '$1');
for (const f of cssFiles) {
  const txt = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  for (const mm of txt.matchAll(/\.((?:[\w-]|\\.)+)/g)) localClasses.add(unesc(mm[1]));
}

// --- 3) 差集 -------------------------------------------------------------
const wanted = [...tokenCount.keys()].filter(isUtility).sort();
const covered = wanted.filter((t) => localClasses.has(t));
const missing = wanted.filter((t) => !localClasses.has(t));

const result = {
  calibre: 'src/**/*.{jsx,js,html} 全文本字符串字面量扫描（含 className 属性优先扫）',
  code_files: codeFiles.length,
  css_files: cssFiles.map((f) => path.relative(ROOT, f)),
  utility_tokens_total: wanted.length,
  local_css_covered: covered.length,
  cdn_only_missing: missing.length,
  missing,
  missing_where: Object.fromEntries(missing.map((t) => [t, tokenWhere.get(t)])),
};
console.log(JSON.stringify(result, null, 1));
