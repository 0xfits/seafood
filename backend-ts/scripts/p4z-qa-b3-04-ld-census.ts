/**
 * p4z-qa-b3-04-ld-census.ts — QA-B3 腿6：`LDxxx` 全键普查 LD001–LD033（真值表独立普查）
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p4z-qa-b3-04-ld-census.ts <outDir>
 * 三源对拍（**只读**，不连库）：
 *   ① `src/ledger.ts`  LEDGER_SQLSTATE_TO_CODE（LD → 码名）
 *   ② `src/ledger-errors.ts` LEDGER_ERROR_TABLE（码名 → HTTP 状态）
 *   ③ `docs/route-layer.spec.md`  全部 `LD0nn` 出现处 + 其**所属状态格**（同一状态标记后、下一个状态标记前的键）
 * 判据：spec 中每个 (状态, LD 键) 对必须与 ①×② 推导的状态一致；不一致逐条登记。
 */
import fs from 'fs';
import path from 'path';

const outDir = path.resolve(process.argv[2] || '');
const label = process.argv[3] || 'main';
if (!process.argv[2]) throw new Error('usage: <outDir> [label]');
fs.mkdirSync(outDir, { recursive: true });
const RUN = path.basename(outDir);

const ROOT = process.cwd();
const ledgerSrc = fs.readFileSync(path.join(ROOT, 'src/ledger.ts'), 'utf8');
const errSrc = fs.readFileSync(path.join(ROOT, 'src/ledger-errors.ts'), 'utf8');
const specPath = path.join(ROOT, '..', 'docs/route-layer.spec.md');
const spec = fs.readFileSync(specPath, 'utf8');
const specLines = spec.split('\n');

// ① LD → 码名
const map: Record<string, string> = {};
for (const m of ledgerSrc.matchAll(/^\s*(LD0\d\d):\s*'([A-Z_]+)'/gm)) map[m[1]] = m[2];

// ② 码名 → 状态
const status: Record<string, number | null> = {};
for (const m of errSrc.matchAll(/^\s*([A-Z]{3,}[A-Z0-9_]*):\s*\{\s*status:\s*(null|\d+)/gm)) {
  status[m[1]] = m[2] === 'null' ? null : Number(m[2]);
}

const truth: Record<string, { code: string; status: number | null }> = {};
for (const ld of Object.keys(map)) truth[ld] = { code: map[ld], status: status[map[ld]] ?? null };

// ③ spec：(状态, LD) 对
const pairs: Array<{ line: number; status: number; ld: string; text: string }> = [];
const STATUS_RE = /`(400|401|403|404|409|410|422|423|500|503)`/g;
specLines.forEach((ln, i) => {
  if (!/LD0\d\d/.test(ln)) return;
  const marks: Array<{ idx: number; status: number }> = [];
  for (const m of ln.matchAll(STATUS_RE)) marks.push({ idx: m.index ?? 0, status: Number(m[1]) });
  for (const m of ln.matchAll(/LD0\d\d/g)) {
    const at = m.index ?? 0;
    // 取该 LD 之前**最近的**状态标记
    const before = marks.filter((k) => k.idx < at).sort((a, b) => b.idx - a.idx);
    if (!before.length) continue;
    pairs.push({ line: i + 1, status: before[0].status, ld: m[0], text: ln.trim().slice(0, 220) });
  }
});

// 去重（同 (line, ld)）
const seen = new Set<string>();
const uniqPairs = pairs.filter((p) => {
  const k = `${p.line}:${p.ld}:${p.status}`;
  if (seen.has(k)) return false;
  seen.add(k); return true;
});

// ③b spec：**显式码名配对**（`LD0nn(`CODE_NAME`)` / `LD0nn: 'CODE_NAME'`）—— 状态类之外的第二个不一致面
const namePairs: Array<{ line: number; ld: string; spec_code: string; truth_code: string; ok: boolean; text: string }> = [];
specLines.forEach((ln, i) => {
  for (const m of ln.matchAll(/LD0(\d\d)[^A-Za-z\n]{0,45}(LEDGER_[A-Z][A-Z_]+)/g)) {
    const ld = 'LD0' + m[1];
    if (!truth[ld]) continue;
    namePairs.push({
      line: i + 1, ld, spec_code: m[2], truth_code: truth[ld].code,
      ok: m[2] === truth[ld].code, text: ln.trim().slice(0, 200),
    });
  }
});
const nameMismatches = namePairs.filter((p) => !p.ok);

// ③c 真值表 `status: null` 的键在 spec 里被写成具体状态（`500` 等）⇒ 张力登记
const nullStatusKeys = Object.keys(truth).filter((k) => truth[k].status === null);
const nullStatusInSpec = uniqPairs.filter((p) => nullStatusKeys.includes(p.ld))
  .map((p) => ({ line: p.line, ld: p.ld, spec_status: p.status, truth_status: null, text: p.text.slice(0, 160) }));

const mismatches = uniqPairs.filter((p) => truth[p.ld] && truth[p.ld].status !== null && truth[p.ld].status !== p.status);

// 全键普查表
const census = Object.keys(truth).sort().map((ld) => {
  const inSpec = spec.includes(ld);
  const used = uniqPairs.filter((p) => p.ld === ld);
  return {
    ld, code: truth[ld].code, truth_status: truth[ld].status,
    mentioned_in_spec: inSpec,
    spec_status_classes: [...new Set(used.map((u) => u.status))].sort((a, b) => a - b),
    spec_occurrences: used.length,
    consistent: used.every((u) => truth[ld].status === u.status),
  };
});

// §4.7.1 真值表覆盖到的键
const sec471 = specLines.slice(660, 700).join('\n');
const covered471 = Object.keys(truth).filter((ld) => sec471.includes('`' + ld + '`')).sort();

// spec 中「400 LD022」4 处是否已订正为 LD021
const badLd022 = specLines.map((l, i) => ({ line: i + 1, l }))
  .filter((x) => /`400`[^|]*LD022/.test(x.l));

const out = {
  run: RUN, at: new Date().toISOString(), probe: 'p4z-qa-b3-04-ld-census',
  sources: { truth_map_keys: Object.keys(map).length, error_table_keys: Object.keys(status).length, spec_path: specPath },
  lds_in_map_not_in_error_table: Object.keys(map).filter((k) => !(map[k] in status)),
  census,
  coverage: {
    lds_mentioned_in_spec: census.filter((c) => c.mentioned_in_spec).map((c) => c.ld),
    lds_absent_from_spec: census.filter((c) => !c.mentioned_in_spec).map((c) => c.ld),
    sec_4_7_1_covered: covered471,
    sec_4_7_1_missing: Object.keys(truth).sort().filter((ld) => !covered471.includes(ld)),
  },
  mismatches: mismatches.map((p) => ({
    line: p.line, ld: p.ld, spec_status: p.status, truth_status: truth[p.ld].status, code: truth[p.ld].code, text: p.text,
  })),
  ld022_in_400_lists: badLd022.map((x) => ({ line: x.line, text: x.l.trim().slice(0, 200) })),
  name_pairs_total: namePairs.length,
  name_mismatches: nameMismatches.map((p) => ({ line: p.line, ld: p.ld, spec_code: p.spec_code, truth_code: p.truth_code, text: p.text })),
  null_status_keys: nullStatusKeys,
  null_status_in_spec: nullStatusInSpec,
};
const file = path.join(outDir, `qa-b3-04-ld-census-${label}.json`);
if (fs.existsSync(file)) throw new Error('refuse to overwrite: ' + file);
fs.writeFileSync(file, JSON.stringify(out, null, 2));

console.log('WROTE ' + file);
console.log('map_keys=' + out.sources.truth_map_keys + ' error_table_keys=' + out.sources.error_table_keys);
console.log('lds_in_map_not_in_error_table=' + JSON.stringify(out.lds_in_map_not_in_error_table));
console.log('absent_from_spec=' + JSON.stringify(out.coverage.lds_absent_from_spec));
console.log('sec_4_7_1_covered=' + JSON.stringify(covered471));
console.log('sec_4_7_1_missing_count=' + out.coverage.sec_4_7_1_missing.length);
console.log('MISMATCHES=' + out.mismatches.length);
for (const m of out.mismatches) console.log(`  L${m.line} ${m.ld} spec_status=${m.spec_status} truth=${m.truth_status} (${m.code}) :: ${m.text.slice(0, 150)}`);
console.log('LD022_in_400_lists=' + badLd022.length);
for (const m of badLd022) console.log(`  L${m.line} :: ${m.l.trim().slice(0, 160)}`);
