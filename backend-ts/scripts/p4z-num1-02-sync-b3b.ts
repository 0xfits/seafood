// p4z-num1-02-sync-b3b.ts — NUM-1：把 p4z-b3b-02-e2e.ts 里**硬编码的旧下限夹具金额**同步为新下限
//   · `fee: 1500`（建币/上市费）⇒ `fee: AMT_C1`（= 源码 CURRENCY_CREATE_FEE_FLOOR = 10000）
//   · `deposit_amount: 2000`（保证金）⇒ `deposit_amount: AMT_DEP`（= CURRENCY_LIST_DEPOSIT_FLOOR = 50000）
//   · Σ 基线 `'2000000'` ⇒ `SIGMA_BASE`（现实测 2020100）
// 逐条替换**断言命中数**（数目不符即中止，不静默半改）。只改本文件，零删除 SQL。
// 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-num1-02-sync-b3b.ts
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const TARGET = path.join(REPO, 'scripts', 'p4z-b3b-02-e2e.ts');
const orig = fs.readFileSync(TARGET, 'utf8');
let text = orig;

type Rule = { from: string; to: string; expect: number; note: string };
const rules: Rule[] = [
  {
    from: "const LIST_DEPOSIT_FLOOR = floorOf('CURRENCY_LIST_DEPOSIT_FLOOR');",
    to: "const LIST_DEPOSIT_FLOOR = floorOf('CURRENCY_LIST_DEPOSIT_FLOOR');\n\n// ---- NUM-1（2026-09-30 定值）：夹具金额一律**跟随源码下限**，不再写死旧值 --------------------\nconst AMT_C1 = CREATE_FLOOR; // 建币费 / 上市费下限（= 10000）\nconst AMT_DEP = LIST_DEPOSIT_FLOOR; // 上市保证金下限（= 50000）\nconst SIGMA_BASE = '2020100'; // NUM-1 实测资金基线（原 2000000 为旧库基线，已过时）",
    expect: 1, note: '注入 AMT_C1 / AMT_DEP / SIGMA_BASE 常量',
  },
  { from: 'fee: 1500', to: 'fee: AMT_C1', expect: -1, note: '建币费/上市费夹具 1500 ⇒ AMT_C1' },
  { from: 'deposit_amount: 2000', to: 'deposit_amount: AMT_DEP', expect: -1, note: '保证金夹具 2000 ⇒ AMT_DEP' },
  { from: '(fee=${1500} -> -1)', to: '(fee=${AMT_C1} -> -1)', expect: 1, note: 'C1-T07 用例名' },
  { from: "'C2-T20 HAPPY list (fee 1500 + deposit 2000 -> both to -1)'", to: "'C2-T20 HAPPY list (fee AMT_C1 + deposit AMT_DEP -> both to -1)'", expect: 1, note: 'C2-T20 用例名' },
  { from: "'2000000'", to: "'2020100'", expect: 3, note: 'Σ 基线 2000000 ⇒ 2020100' },
  { from: 'sigma_is_2000000_pre_and_post', to: 'sigma_is_baseline_pre_and_post', expect: 1, note: '字段名去旧值' },
];

const report: Array<Record<string, unknown>> = [];
for (const r of rules) {
  const n = text.split(r.from).length - 1;
  if (n < 1) {
    console.error(`SYNC_ABORT 规则「${r.note}」零命中 ⇒ 中止（未写盘）`);
    process.exit(1);
  }
  if (r.expect > 0 && n !== r.expect) {
    console.error(`SYNC_ABORT 规则「${r.note}」命中 ${n} 次，期望 ${r.expect} 次 ⇒ 中止（未写盘）`);
    process.exit(1);
  }
  text = text.split(r.from).join(r.to);
  report.push({ note: r.note, hits: n, from: r.from, to: r.to });
}
if (text === orig) { console.error('SYNC_NOOP'); process.exit(1); }
fs.writeFileSync(TARGET, text);
console.log('SYNC_OK ' + JSON.stringify(report));
console.log('BYTES ' + orig.length + ' -> ' + text.length);
console.log('RESIDUAL_1500 ' + (text.split('1500').length - 1) + ' RESIDUAL_2000 ' + (text.split('2000').length - 1) + ' RESIDUAL_1000 ' + (text.split(': 1000').length - 1));
