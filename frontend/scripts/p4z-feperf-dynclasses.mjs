#!/usr/bin/env node
/* p4z-feperf-dynclasses.mjs — 现取「运行期拼接出来的 Tailwind 类名」(P6-FE-PERF)
   口径（不改任何文件，只读）：
   1) 扫描 src 下 .jsx/.js，取所有**模板字符串**（反引号）中带 ${...} 的片段。
   2) 只保留「拼接结果可能落在 Tailwind 工具类命名空间」的片段：
      - 静态前缀命中变体前缀（sm: md: lg: xl: 2xl: hover: focus: active: dark:）
      - 或静态前缀命中 Tailwind 工具根（scale- text- grid- bg- p- m- w- h- rounded- ...）
   3) 把 ${expr} 解析成具体字面量：
      - ${Obj[key]} → 该文件内 Obj 对象字面量的全部字符串取值
      - ${cond ? 'a' : 'b'} → 'a' 与 'b'
      - 其余（组件 props 等）→ 记为 OPEN（运行期任意值，无法穷举）
   4) 输出 concrete 类名清单 + file:line。
*/
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'src');
const walk = (d, out = []) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== 'test' && e.name !== 'images') walk(p, out); }
    else if (/\.(jsx|js)$/.test(e.name)) out.push(p);
  }
  return out;
};

const VARIANT = /(^|\s)(sm|md|lg|xl|2xl|hover|focus|active|dark|group-hover):/;
const UTILROOT = /(^|\s)(scale|text|grid|bg|border|rounded|p|px|py|m|mx|my|w|h|gap|flex|items|justify|shadow|ring|opacity|translate|col|row)-/;

const lines = {};
const files = walk(SRC);
const found = [];
for (const f of files) {
  const txt = fs.readFileSync(f, 'utf8');
  lines[f] = txt.split('\n');
  // 模板字符串（含换行）
  for (const m of txt.matchAll(/`([^`]*)`/gs)) {
    const tpl = m[1];
    if (!tpl.includes('${')) continue;
    const lineNo = txt.slice(0, m.index).split('\n').length;
    // 拆成静态段与表达式段
    const parts = tpl.split(/\$\{([^}]*)\}/g); // 偶数下标=静态, 奇数下标=表达式
    const statics = parts.filter((_, i) => i % 2 === 0);
    const exprs = parts.filter((_, i) => i % 2 === 1);
    const staticAll = statics.join(' ');
    const looksTw = VARIANT.test(staticAll) || UTILROOT.test(staticAll) ||
      exprs.some((e) => /Obj[key]|\[/.test(e) === false && /^[a-z]/.test(e) === false);
    if (!looksTw) continue;
    // 解析表达式
    const resolved = [];
    let open = false;
    exprs.forEach((e0) => {
      const e = e0.trim();
      const tern = [...e.matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]);
      if (tern.length && /[?:]/.test(e)) { resolved.push(...tern); return; }
      const idx = e.match(/^([A-Z][\w]*)\[[^\]]+\]$/); // X[key]
      if (idx) {
        const objName = idx[1];
        const objRe = new RegExp('const\\s+' + objName + '\\s*=\\s*\\{([\\s\\S]*?)\\}', 'm');
        const om = txt.match(objRe);
        if (om) {
          const vals = [...om[1].matchAll(/'([^']*)'|"([^"]*)"/g)].map((x) => x[1] ?? x[2]);
          resolved.push(...vals);
          return;
        }
      }
      open = true;
    });
    // 用解析值替换表达式，生成具体类名（只保留含变体前缀或工具根的 token）
    const concrete = new Set();
    const stat0 = statics[0] || '';
    if (resolved.length) {
      for (const v of resolved) {
        const joined = [stat0, v, ...statics.slice(1)].join('');
        for (const tok of joined.split(/[\s'"`]+/)) {
          if (VARIANT.test(tok + ' ') || /^(scale|text|grid|bg|p|m|w|h|rounded|gap|col)-/.test(tok)) concrete.add(tok);
        }
      }
    }
    found.push({
      file: path.relative(ROOT, f),
      line: lineNo,
      tpl: tpl.replace(/\s+/g, ' ').slice(0, 90),
      resolved_values: [...new Set(resolved)],
      concrete: [...concrete],
      OPEN: open,
    });
  }
}

const concreteAll = [...new Set(found.flatMap((x) => x.concrete))].sort();
console.log(JSON.stringify({
  calibre: 'src 下 jsx/js 的反引号模板字符串中带 ${} 的片段；静态前缀按 Tailwind 变体/工具根过滤；X[key] 展开为同文件对象字面量取值',
  hits: found,
  concrete_class_literals: concreteAll,
  concrete_count: concreteAll.length,
  open_dynamic: found.filter((x) => x.OPEN).map((x) => `${x.file}:${x.line}`),
}, null, 1));
