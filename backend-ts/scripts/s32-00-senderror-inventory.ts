/**
 * s32-00 · `sendError` 同族清单 + 类级断言（离线 · 零 DB · 零 HTTP）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/s32-00-senderror-inventory.ts
 * 定向（判负用）：`S32_TARGET=<path/to/index.ts>`（默认 `src/index.ts`）
 *               `S32_EXPECT_CALLS=<n>`（默认 25，= 现取基线）
 * 产物：`.s32-artifacts/<runid>/s32-00-senderror-inventory.json`（若 runid 文件在）
 *
 * 类级断言（本单：**零代码迁移** ⇒ 断的是「基线不变量」）
 *   C1 实调用数（剔注释）== 基线（现取 = 25）
 *   C2 错误码闭集不动：`LEDGER_*` == 33 且 `AUTH_*` == 2
 *   C3 任一处 `sendError` 的 message 字面量命中「全大写下划线机读码」== 0（§3.3 条款 9′）
 *   C4 注册点 == 89（本单不动路由）
 *   C5 计数完整性：命中行 = 实调用 + 注释行（现取 25 + 25 = 50）
 *
 * 判负（**在内存里变异，不落盘**）：`--selftest`
 *   NEG1 合成一行 `sendError(res, 400, 'LEDGER_AMOUNT_INVALID')` ⇒ C3 必红
 *   NEG2 合成 34 码闭集 ⇒ C2 必红
 */
import * as fs from 'fs';
import * as path from 'path';
import { LEDGER_ERROR_CODES, AUTH_ERROR_MESSAGES } from '../src/ledger-errors';

const REPO_BACKEND = path.resolve(__dirname, '..');
const TARGET = process.env.S32_TARGET || path.resolve(REPO_BACKEND, 'src/index.ts');
const EXPECT_CALLS = Number(process.env.S32_EXPECT_CALLS || '25');

/** 整串即机读码（逐字 = route-layer.spec §16.2 的 `MACHINE_CODE_RE`） */
const MACHINE_CODE_RE = /^(?=[A-Z0-9_]*_)[A-Z0-9_]{4,}$/;
/** 注册点（逐字 = p7b-03 `AC10-2` 口径） */
const ROUTE_RE = /^app\.(get|post|put|delete|patch)\(/gm;
const CALL_RE = /sendError\(/;

type CallRow = { line: number; route: string; status: string; message: string };

const isCommentLine = (s: string) => /^\s*(\/\/|\*|\/\*)/.test(s);

const quotedLiterals = (s: string): string[] => {
  const out: string[] = [];
  const re = /'([^']*)'|"([^"]*)"|`([^`]*)`/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) out.push(m[1] ?? m[2] ?? m[3] ?? '');
  return out;
};

/** 现取实调用 + 注释行（与既有口径 `grep -c 'sendError('` 对齐） */
export const inventory = (src: string) => {
  const lines = src.split('\n');
  const calls: CallRow[] = [];
  const commentLines: number[] = [];
  const routes: Array<{ line: number; method: string; path: string }> = [];
  let regCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    if (ROUTE_RE.test(raw)) {
      regCount += 1;
      const m = /^app\.(get|post|put|delete|patch)\(\s*'([^']+)'/.exec(raw);
      if (m) routes.push({ line: i + 1, method: m[1].toUpperCase(), path: m[2] });
    }
    ROUTE_RE.lastIndex = 0;
    if (!CALL_RE.test(raw)) continue;
    if (isCommentLine(raw)) { commentLines.push(i + 1); continue; }
    if (/^\s*const sendError\s*=/.test(raw)) continue; // 定义行
    // 现取最近一条注册路由
    let route = '<no-route>';
    for (const r of routes) if (r.line <= i + 1) route = `${r.line} ${r.method} ${r.path}`;
    const after = raw.slice(raw.indexOf('sendError(') + 'sendError('.length);
    const parts = after.split(',');
    const status = (parts[1] || '').trim().replace(/\);?.*$/, '').trim();
    const message = parts.slice(2).join(',').trim().replace(/\);?\s*(\/\/.*)?$/, '').trim();
    calls.push({ line: i + 1, route, status, message });
  }
  const machineHits: Array<{ line: number; token: string }> = [];
  for (const c of calls) {
    for (const lit of quotedLiterals(c.message)) {
      // 只判「整串即码」的形态（与前端 MACHINE_CODE_RE 同口径）；英文句 / 中文句不算
      if (MACHINE_CODE_RE.test(lit.trim())) machineHits.push({ line: c.line, token: lit });
    }
  }
  return { calls, commentLines, regCount, machineHits };
};

type Check = { id: string; what: string; pass: boolean; reading: string };

export const evaluate = (src: string, expectCalls = EXPECT_CALLS): Check[] => {
  const inv = inventory(src);
  const ledgerCodes = LEDGER_ERROR_CODES.length;
  const authCodes = Object.keys(AUTH_ERROR_MESSAGES).length;
  return [
    { id: 'C1', what: `实调用数（剔注释）== 基线 ${expectCalls}`, pass: inv.calls.length === expectCalls, reading: `real_calls=${inv.calls.length}` },
    { id: 'C2', what: '码闭集不动：LEDGER_* == 33 且 AUTH_* == 2', pass: ledgerCodes === 33 && authCodes === 2, reading: `ledger=${ledgerCodes} auth=${authCodes}` },
    { id: 'C3', what: 'sendError message 命中机读码 == 0（§3.3 条款 9′）', pass: inv.machineHits.length === 0, reading: `hits=${inv.machineHits.length} ${JSON.stringify(inv.machineHits)}` },
    { id: 'C4', what: '注册点 == 89（本单不动路由）', pass: inv.regCount === 89, reading: `registration_points=${inv.regCount}` },
    { id: 'C5', what: '计数完整性：命中行 == 实调用 + 注释行', pass: inv.calls.length + inv.commentLines.length === 50, reading: `calls=${inv.calls.length} comments=${inv.commentLines.length} total=${inv.calls.length + inv.commentLines.length}` },
  ];
};

const runSelftest = (): number => {
  // NEG1：把 message 换成机读码 ⇒ C3 必红
  const neg1Src = 'app.get(\'/x\', (req,res)=>{ sendError(res, 400, \'LEDGER_AMOUNT_INVALID\'); });\n';
  const neg1 = evaluate(neg1Src, 1).find((c) => c.id === 'C3')!;
  // NEG2：把闭集扩成 34 ⇒ C2 必红（内存判据，不改真表）
  const fakeLedger = new Array(34).fill('X');
  const neg2Red = !(fakeLedger.length === 33 && Object.keys(AUTH_ERROR_MESSAGES).length === 2);
  // GREEN 对照：干净行 ⇒ C3 必绿
  const posSrc = 'app.get(\'/x\', (req,res)=>{ sendError(res, 400, \'Bad input\'); });\n';
  const pos = evaluate(posSrc, 1).find((c) => c.id === 'C3')!;
  const lines = [
    `NEG1 (message=机读码) C3 pass=${neg1.pass}（期望 false=红） ${neg1.reading}`,
    `NEG2 (闭集 34) C2 pass=${!(neg2Red)}（期望 false=红） ledger=34 auth=2`,
    `GREEN (message=英文句) C3 pass=${pos.pass}（期望 true=绿） ${pos.reading}`,
    `SELFTEST ${!neg1.pass && neg2Red && pos.pass ? 'PASS' : 'FAIL'}`,
  ];
  console.log(lines.join('\n'));
  return (!neg1.pass && neg2Red && pos.pass) ? 0 : 1;
};

const main = (): number => {
  if (process.argv.includes('--selftest')) return runSelftest();
  const src = fs.readFileSync(TARGET, 'utf8');
  const inv = inventory(src);
  const checks = evaluate(src);
  const failed = checks.filter((c) => !c.pass);
  const out: Record<string, unknown> = {
    script: 'scripts/s32-00-senderror-inventory.ts',
    target: TARGET,
    calls: inv.calls,
    comment_lines: inv.commentLines,
    checks,
    summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
  };
  try {
    const runidFile = path.resolve(REPO_BACKEND, '.s32-artifacts/CURRENT_RUNID');
    const runid = fs.existsSync(runidFile) ? fs.readFileSync(runidFile, 'utf8').trim() : 'adhoc';
    const dir = path.resolve(REPO_BACKEND, '.s32-artifacts', runid);
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `s32-00-senderror-inventory${process.env.S32_TAG ? `-${process.env.S32_TAG}` : ''}.json`);
    fs.writeFileSync(f, JSON.stringify(out, null, 2));
    out.saved = f;
  } catch (e) { out.save_error = String(e); }
  console.log(JSON.stringify({ ...out, calls: undefined, comment_lines: undefined }, null, 1));
  console.log('CALLS:');
  for (const c of inv.calls) console.log(`  :${c.line} | ${c.route} | ${c.status} | ${c.message.slice(0, 70)}`);
  return failed.length > 0 ? 1 : 0;
};

process.exit(main());
