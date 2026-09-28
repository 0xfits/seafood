/**
 * P3S-03 · 「非 PG / 无 `code` 错误 ⇒ 折叠成 500 且丢原始信息」的**离线合成复现**（纯函数，零 I/O、零库写）
 * ============================================================================
 * 依据：`src/ledger-errors.ts` 的 `classifyNonPgError` / `normalizeLedgerError` 末尾兜底分支。
 * 目的（不改 src）：
 *   ① 给出**最小复现**：哪些形态的错误对象会被折成 `LEDGER_TRANSACTION_REQUIRED`（status 500）；
 *      ——特别是「像 `ws` 的 `ErrorEvent` 那样**没有 `name`、没有 `code`** 的事件对象」。
 *   ② 判负自证设计（红/绿/恢复）：
 *        红态 = 折叠后 `details` 里查不到原始 `message`/`stack`（判负）；
 *        绿态 = 原始 `message`（或 `stack` 摘录）出现在 `details`/诊断字段里；
 *        恢复 = 修 `src/**`（本单不改，另批）后同一批合成输入转为绿态。
 * 用法：cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only scripts/p3s-03-fold-repro.ts
 * 落盘：`.p3s-artifacts/p3s-03-fold-repro-<RUN>.json`（同名拒写）
 */
import * as fs from 'fs';
import * as path from 'path';
import { normalizeLedgerError, classifyNonPgError } from '../src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ART_DIR = path.resolve(__dirname, '..', '.p3s-artifacts');
const OUT = path.join(ART_DIR, `p3s-03-fold-repro-${RUN}.json`);

interface Case {
  key: string;
  note: string;
  make: () => unknown;
}

/** 形态族：真实世界里「连接层」能吐出来的非 PG 错误对象 */
const CASES: Case[] = [
  { key: 'plain_Error_ws_closed_before_established', note: 'ws 连接被关闭（TLS/握手失败常见原文）', make: () => new Error('WebSocket was closed before the connection was established') },
  { key: 'plain_Error_ws_closed_code_1006', note: 'ws 异常关闭', make: () => new Error('WebSocket was closed abnormally (code 1006)') },
  { key: 'plain_Error_socket_hang_up', note: 'Node http/socket', make: () => new Error('socket hang up') },
  { key: 'plain_Error_fetch_failed', note: 'undici/Node fetch', make: () => new Error('fetch failed') },
  { key: 'plain_Error_no_message', note: '空 message 的裸 Error', make: () => new Error() },
  { key: 'type_error_driver_connectionCallback', note: '本机实测的驱动崩溃形态（ErrorEvent.message 只读）', make: () => new TypeError('Cannot set property message of #<ErrorEvent> which has only a getter') },
  { key: 'error_like_plain_object', note: '没有 name/code 的字面量对象（driver 转手后常见）', make: () => ({ message: 'TLS handshake failed', type: 'error' }) },
  {
    key: 'error_event_like_getter_only_message',
    note: '**关键**：像 ws/lib/event-target.js 的 ErrorEvent —— name/code 均 undefined、message 是 getter-only',
    make: () => {
      const o: Record<string, unknown> = { type: 'error' };
      Object.defineProperty(o, 'message', { get: () => 'stream error: TLS handshake failed', enumerable: true });
      Object.defineProperty(o, 'error', { get: () => new Error('underlying TLS error'), enumerable: true });
      return o;
    },
  },
  { key: 'frozen_object_assign_message_fails', note: '属性只读（复现 `o.message = ...` 抛 TypeError 的前置条件）', make: () => Object.freeze({ type: 'error', code: undefined }) },
  { key: 'pool_timeout_plain', note: '对照组：池拿连接超时 ⇒ 应 503', make: () => new Error('timeout exceeded when trying to connect') },
  { key: 'driver_transient_ECONNRESET', note: '对照组：驱动瞬时码 ⇒ 应 503', make: () => Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) },
  { key: 'pg_sqlstate_22003_control', note: '对照组：PG 22003（本应被 DB 闸收住，不应出现）', make: () => Object.assign(new Error('numeric field overflow'), { code: '22003' }) },
];

interface Outcome {
  key: string; note: string;
  input_name: string | null; input_own_code: boolean; input_code: string | null;
  input_has_stack: boolean; input_message: string | null;
  non_pg_reason: string | null;
  mapped_code: string; mapped_status: number | null; mapped_message: string;
  mapped_details: unknown;
  details_preserves_message: boolean; details_preserves_stack_hint: boolean;
  info_lost: boolean;
}

const runCase = (c: Case): Outcome => {
  const e = c.make();
  const a = (e ?? {}) as Record<string, unknown>;
  const le = normalizeLedgerError(e);
  const detailsJson = JSON.stringify(le.details ?? {});
  const inputMessage = a.message === undefined ? null : String(a.message);
  const preservesMsg = inputMessage !== null && inputMessage !== '' && detailsJson.includes(inputMessage);
  const preservesStack = JSON.stringify(le.details ?? {}).includes('at ');
  const out: Outcome = {
    key: c.key, note: c.note,
    input_name: a.name === undefined ? null : String(a.name),
    input_own_code: Object.prototype.hasOwnProperty.call(a, 'code'),
    input_code: a.code === undefined || a.code === null ? null : String(a.code),
    input_has_stack: typeof a.stack === 'string',
    input_message: inputMessage,
    non_pg_reason: classifyNonPgError(e),
    mapped_code: le.code,
    mapped_status: (le as unknown as { status?: number | null }).status ?? null,
    mapped_message: le.message,
    mapped_details: le.details,
    details_preserves_message: preservesMsg,
    details_preserves_stack_hint: preservesStack,
    info_lost: !preservesMsg && !preservesStack,
  };
  return out;
};

const outcomes = CASES.map(runCase);

/** 判负三态（红/绿/恢复）判据，写成可机读，供「修 src 后」同一脚本复跑对拍 */
const is500 = (o: Outcome): boolean => o.mapped_status === 500;
const red = outcomes.filter((o) => is500(o) && o.info_lost).map((o) => o.key);
const green = outcomes.filter((o) => o.mapped_status === 503 || o.details_preserves_message).map((o) => o.key);
const three_state = {
  RED_info_lost_500: red,
  GREEN_info_preserved_or_retryable: green,
  RECOVERY_criteria: [
    '修法：`normalizeLedgerError` 的非 PG 兜底分支保留原始信息（`details.error_message`/`details.error_stack_head`/`cause` 链），并把 500 诊断字段接到告警（DL126）；',
    '恢复判据（本脚本复跑即可判）：RED 集合为空 ⇒ 每个 500 形态的 `details` 都能查到原始 message 或 stack 头；',
    '不得改变对外 `code`/`status`（§14 关闭集 33 不动）：仅新增可机读 `details` 字段。',
  ],
};

const out = {
  probe: 'P3S-03 · 非 PG 错误折叠路径的离线合成复现',
  run: RUN, utc: new Date().toISOString(),
  source_refs: {
    classifyNonPgError: 'src/ledger-errors.ts:354-364',
    fold_branch: 'src/ledger-errors.ts:450-456（cause=non_pg_error / reason=NonPgReason / error_name=errName(e) / error_code=code||none）',
    errName_fallback: 'src/ledger-errors.ts:266（e.name ?? \'Error\' ⇒ 无 name 的 ErrorEvent 会被记成 "Error"）',
    pg_message_header: 'src/ledger.ts:50（LEDGER_TRANSACTION_REQUIRED 的 cause/reason 形状登记）',
  },
  outcomes,
  three_state,
  counts: {
    total: outcomes.length,
    become_500: outcomes.filter(is500).length,
    become_503: outcomes.filter((o) => o.mapped_status === 503).length,
    info_lost_among_500: red.length,
  },
};

if (fs.existsSync(OUT)) { console.error(`REFUSE_OVERWRITE ${OUT}`); process.exit(3); }
fs.mkdirSync(ART_DIR, { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

for (const o of outcomes) {
  console.log(`${o.key}\n   input: name=${o.input_name ?? '<none>'} code=${o.input_code ?? '<none>'} own_code=${o.input_own_code} stack=${o.input_has_stack} msg="${o.input_message ?? ''}"`);
  console.log(`   -> non_pg_reason=${o.non_pg_reason} code=${o.mapped_code} status=${o.mapped_status} details=${JSON.stringify(o.mapped_details)}  info_lost=${o.info_lost}`);
}
console.log(`\nRED(info_lost&500)=${JSON.stringify(red)}`);
console.log(`GREEN=${JSON.stringify(green)}`);
console.log(`counts=${JSON.stringify(out.counts)}`);
console.log(`out=${OUT}`);
