// P3V · 生成「变异副本」：把修复的那一行分支删掉（判负用）
// 禁止原地改 src；本文件只从 src 读、向 .p3v-artifacts/_impl 写。
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const SRC = path.join(ROOT, 'src', 'ledger-errors.ts');
const OUT = path.join(__dirname, 'mutated-ledger-errors.ts');
const NEEDLE = "  if (isEventObjectFamily(e)) return 'driver_connection_error';\n";
const s = fs.readFileSync(SRC, 'utf8');
if (!s.includes(NEEDLE)) throw new Error('[p3v-mutate] 未找到待删除的分支行 —— 副本与 src 已漂移');
const m = s.replace(NEEDLE, '');
if (m === s) throw new Error('[p3v-mutate] 替换未生效');
fs.writeFileSync(OUT, m);
console.log(`[p3v-mutate] removed ${s.length - m.length} chars -> ${OUT}`);
