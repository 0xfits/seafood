/**
 * P3S-00 · `p1o-00` 500 族红项的**外部探针**（Kong / 单元 D · P3-P1O-500-RCA）
 * ============================================================================
 * 目的（只定位与取证，不改任何 `src/**`）：
 *   1. 五个已知成员各跑 N≥10 次**同输入**，逐次落盘 `thrown / code / status / reason`
 *      ⇒ 同输入稳定 500（确定性）vs 时红时绿（非确定性）。
 *   2. **两分法**：
 *        (i)  套件形态 —— 复刻 `p1o-00` 调该入口时的入参形态（无 tx、amount 原样字符串）；
 *        (ii) 契约形态 —— 用**完全相同的语句文本与参数**（由驱动层截获，非重写）在
 *             `withTransaction()`（R55/R56：事务 + 直连端点）内重放；
 *        (iii) 传输重放 —— 同语句同参数走 `readQuery`（pooler 只读池，与实现同路径）但**绕过**
 *             ledger 代码 ⇒ 分离「实现侧」与「传输侧」；
 *        (ii-b) 类型正确形态 —— 按契约把 amount 传成 `bigint`（最小单位）⇒ 走 TS 形状闸。
 *   3. **原始错误取证**：驱动层（`Pool.prototype.connect/query`）拦截 + WebSocket 生命周期观测，
 *      捕获映射器折叠前的原始错误对象（name / message / code / detail / constraint / stack / cause）。
 *
 * 用法：
 *   cd backend-ts && NODE_PATH=$PWD/node_modules npx ts-node --transpile-only \
 *     scripts/p3s-00-500-rca-probe.ts [--n 10]
 * 落盘：`backend-ts/.p3s-artifacts/p3s-00-500-rca-<RUN>.json`（RUN = UTC 时间戳；**同名拒写**）
 *
 * 不自证清白的地方（见报告 §探针缺陷自曝）：
 *   · WebSocket 只挂 `open` / `close` / `unexpected-response` 监听（**不挂 `error`**）——
 *     挂 `error` 会把「未处理的 error 事件」变成静默，可能掩盖被追查的故障形态；
 *     代价：该类的 error 事件本身不在我读数里（只能由 `pool.*` 拦截兜住）。
 *   · 夹具：uid 窗口 9911xx；幂等键前缀 `cli:kong20-`；symbol 前缀 `P3S`。
 *   · 每次 attempt 都是**拒绝路径**（不写账本行）；脚本首尾自证 `ledger_entry` 行增量。
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const RUN = new Date().toISOString().replace(/\.\d+Z$/, 'Z').replace(/[-:]/g, '');
const ART_DIR = path.resolve(__dirname, '..', '.p3s-artifacts');
const OUT = path.join(ART_DIR, `p3s-00-500-rca-${RUN}.json`);

const argv = process.argv.slice(2);
const argN = ((): number => {
  const i = argv.indexOf('--n');
  return i >= 0 && argv[i + 1] ? Number(argv[i + 1]) : 10;
})();

const DIRECT_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
const POOLED_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL || DIRECT_URL;
const FN_SQL = 'SELECT ledger_post_event($1::jsonb) AS r';

// ------------------------------------------------------------------ 驱动层插桩
interface RawErr {
  where: string;
  tag: string;
  name: string;
  message: string;
  code: string | null;
  has_own_code: boolean;
  detail: unknown;
  constraint: unknown;
  hint: unknown;
  cause: string | null;
  stack: string[];
}
const RAW: RawErr[] = [];
const WS_EVENTS: Array<{ tag: string; event: string; detail: unknown }> = [];
let TAG = 'boot';

const describeErr = (e: unknown, depth = 0): RawErr => {
  const a = (e ?? {}) as Record<string, unknown>;
  const stack = typeof a.stack === 'string' ? a.stack.split('\n').slice(0, 10) : [];
  const cause = depth < 3 && a.cause !== undefined && a.cause !== null
    ? `${String((a.cause as { name?: unknown })?.name ?? 'Error')}: ${String((a.cause as { message?: unknown })?.message ?? a.cause).slice(0, 300)}`
    : null;
  return {
    where: '', tag: TAG,
    name: String(a.name ?? 'Error').slice(0, 64),
    message: String(a.message ?? e).slice(0, 400),
    code: a.code === undefined || a.code === null ? null : String(a.code),
    has_own_code: typeof e === 'object' && e !== null && Object.prototype.hasOwnProperty.call(e, 'code'),
    detail: a.detail ?? null,
    constraint: a.constraint ?? null,
    hint: a.hint ?? null,
    cause,
    stack,
  };
};

const note = (where: string, e: unknown): void => {
  RAW.push({ ...describeErr(e), where });
};

const PROTO: Record<string, unknown> = Pool.prototype as unknown as Record<string, unknown>;
const origQuery = PROTO.query as (...args: unknown[]) => Promise<unknown>;
const origConnect = PROTO.connect as (...args: unknown[]) => Promise<unknown>;

/** 每次 attempt 驱动的语句（用于「同语句同参数」重放，**不重写 payload**） */
interface Sent { tag: string; via: 'pool.query'; text: string; params: { jsonb?: string } | null }
const SENT: Sent[] = [];

PROTO.query = async function (this: unknown, text: unknown, params?: unknown): Promise<unknown> {
  if (typeof text === 'string' && text.includes('ledger_post_event')) {
    SENT.push({
      tag: TAG, via: 'pool.query', text,
      params: Array.isArray(params) && typeof params[0] === 'string' ? { jsonb: params[0] } : null,
    });
  }
  try {
    return await origQuery.call(this, text, params);
  } catch (e) {
    note('pool.query', e);
    throw e;
  }
};
PROTO.connect = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
  try {
    return await origConnect.apply(this, args);
  } catch (e) {
    note('pool.connect', e);
    throw e;
  }
};

// WebSocket 生命周期（**不挂 error**，见文件头）
const BaseWS = WS as unknown as new (url: string, ...rest: unknown[]) => unknown;
class TracedWS extends (BaseWS as unknown as { new(url: string, ...rest: unknown[]): Record<string, unknown> }) {
  public constructor(url: string, ...rest: unknown[]) {
    super(url, ...rest);
    const safe = String(url).replace(/:\/\/([^:@/]*):[^@/]*@/, '://$1:***@').slice(0, 160);
    (this as Record<string, unknown>).on = ((orig: (...a: unknown[]) => unknown) => (ev: string, fn: (...a: unknown[]) => unknown) => {
      if (ev === 'open' || ev === 'close' || ev === 'unexpected-response') {
        return orig.call(this, ev, (...a: unknown[]) => {
          WS_EVENTS.push({ tag: TAG, event: ev, detail: a.map((x) => (typeof x === 'object' && x !== null ? Object.keys(x).slice(0, 6) : String(x).slice(0, 40))) });
          return fn(...a);
        });
      }
      return orig.call(this, ev, fn);
    })((this as Record<string, unknown>).on as (...a: unknown[]) => unknown);
    WS_EVENTS.push({ tag: TAG, event: 'construct', detail: safe });
  }
}
neonConfig.webSocketConstructor = TracedWS as unknown as typeof neonConfig.webSocketConstructor;

// ------------------------------------------------------------------ 被测实现
import {
  transfer, freeze, unfreeze, settleFrozen, getOrCreateAccount,
} from '../src/ledger';
import { withTransaction, txQuery, readQuery, closePools } from '../src/db';

// ------------------------------------------------------------------ 夹具
const U1 = '991101';
const U2 = '991102';
const KEY_PREFIX = 'cli:kong20-';
const SYM = `P3S${RUN.slice(-8)}`.slice(0, 12);
const OVER_BIGINT_FAR = '99999999999999999999999';
const BIGINT_MAX_PLUS_1 = '9223372036854775808';
const BIGINT_OVER = 99999999999999999999999n;

const admin = new Pool({ connectionString: DIRECT_URL, max: 3, connectionTimeoutMillis: 30_000, idleTimeoutMillis: 15_000 });
const rawq = async <R = Record<string, string>>(sql: string, params: unknown[] = []): Promise<R[]> =>
  (await admin.query(sql, params as never[])).rows as R[];

// ------------------------------------------------------------------ attempt
type Form = 'i_suite' | 'ii_contract_in_tx' | 'iii_transport_replay' | 'ii_b_ts_units';
interface Attempt {
  member: string; form: Form; seq: number; thrown: boolean; code: string | null; status: number | null;
  reason: string | null; cause: string | null; message: string | null; details: unknown;
  returned_kind: string | null; elapsed_ms: number; raw_errors: RawErr[]; sent: Sent[]; raw_sig: string | null;
}

const ATTEMPTS: Attempt[] = [];

const runOne = async (member: string, form: Form, seq: number, fn: () => Promise<unknown>): Promise<Attempt> => {
  TAG = `${member}|${form}|${seq}`;
  const rawBefore = RAW.length;
  const sentBefore = SENT.length;
  const wsBefore = WS_EVENTS.length;
  const t0 = Date.now();
  let thrown = false; let err: unknown = null; let ret: unknown = undefined;
  try { ret = await fn(); } catch (e) { thrown = true; err = e; }
  const a = (err ?? {}) as Record<string, unknown>;
  const details = thrown && a.details && typeof a.details === 'object' ? a.details : null;
  const mine = RAW.slice(rawBefore);
  const rec: Attempt = {
    member, form, seq, thrown,
    code: thrown ? String(a.code ?? '') || null : null,
    status: thrown && typeof a.status === 'number' ? (a.status as number) : null,
    reason: details ? String((details as Record<string, unknown>).reason ?? '') || null : null,
    cause: details ? String((details as Record<string, unknown>).cause ?? '') || null : null,
    message: thrown ? String(a.message ?? '').slice(0, 200) : null,
    details,
    returned_kind: !thrown
      ? (ret === null || ret === undefined ? String(ret)
        : Array.isArray(ret) ? `array(${ret.length})`
          : typeof ret === 'object' ? `object(${Object.keys(ret as Record<string, unknown>).slice(0, 5).join(',')})` : String(ret).slice(0, 40))
      : null,
    elapsed_ms: Date.now() - t0,
    raw_errors: mine,
    sent: SENT.slice(sentBefore),
    raw_sig: mine.length ? `${mine[0].name}|${mine[0].message.slice(0, 60)}` : null,
  };
  if (WS_EVENTS.length !== wsBefore) rec.raw_errors = rec.raw_errors;
  ATTEMPTS.push(rec);
  return rec;
};

const replayInTx = async (text: string, jsonb: string): Promise<unknown> =>
  withTransaction(async (tx) => txQuery(tx, text, [jsonb]));

// ------------------------------------------------------------------ 成员定义
interface Member {
  id: string; entry: string; shape: string; value: string; spec_value: unknown;
  callSuite: () => Promise<unknown>;
  callContractInTx: (text: string, jsonb: string) => Promise<unknown>;
  callTransportReplay: (text: string, jsonb: string) => Promise<unknown>;
  callTsUnits: (() => Promise<unknown>) | null;
}

const key = (s: string): string => `${KEY_PREFIX}${SYM}-${s}`;

const MEMBERS: Member[] = [
  {
    id: 'E-W1_transfer/amount/over_bigint_far', entry: 'E-W1_transfer', shape: 'over_bigint_far', value: OVER_BIGINT_FAR, spec_value: OVER_BIGINT_FAR,
    callSuite: () => transfer({ fromUid: U1, toUid: U2, cid: CID, amount: OVER_BIGINT_FAR, idempotencyKey: key('w1-amt-over_bigint_far') }),
    callContractInTx: replayInTx,
    callTransportReplay: async (text, jsonb) => readQuery(text, [jsonb]),
    callTsUnits: () => transfer({ fromUid: U1, toUid: U2, cid: CID, amount: BIGINT_OVER as unknown as string, idempotencyKey: key('w1-amt-units-over') }),
  },
  {
    id: 'E-W1_transfer/amount/bigint_max_plus_1', entry: 'E-W1_transfer', shape: 'bigint_max_plus_1', value: BIGINT_MAX_PLUS_1, spec_value: BIGINT_MAX_PLUS_1,
    callSuite: () => transfer({ fromUid: U1, toUid: U2, cid: CID, amount: BIGINT_MAX_PLUS_1, idempotencyKey: key('w1-amt-bigint_max_plus_1') }),
    callContractInTx: replayInTx,
    callTransportReplay: async (text, jsonb) => readQuery(text, [jsonb]),
    callTsUnits: () => transfer({ fromUid: U1, toUid: U2, cid: CID, amount: 9223372036854775808n as unknown as string, idempotencyKey: key('w1-amt-units-max_plus_1') }),
  },
  {
    id: 'E-W3_freeze/amount/over_bigint_far', entry: 'E-W3_freeze', shape: 'over_bigint_far', value: OVER_BIGINT_FAR, spec_value: OVER_BIGINT_FAR,
    callSuite: () => freeze({ uid: U1, cid: CID, amount: OVER_BIGINT_FAR, refType: 'job', refId: '1', idempotencyKey: key('w3-amt-over_bigint_far') }),
    callContractInTx: replayInTx,
    callTransportReplay: async (text, jsonb) => readQuery(text, [jsonb]),
    callTsUnits: () => freeze({ uid: U1, cid: CID, amount: BIGINT_OVER as unknown as string, refType: 'job', refId: '1', idempotencyKey: key('w3-amt-units-over') }),
  },
  {
    id: 'E-W4_unfreeze/amount/scientific_1e5', entry: 'E-W4_unfreeze', shape: 'scientific_1e5', value: '1e5', spec_value: '1e5',
    callSuite: () => unfreeze({ uid: U1, cid: CID, amount: '1e5', refType: 'job', refId: '1', idempotencyKey: key('w4-amt-scientific_1e5') }),
    callContractInTx: replayInTx,
    callTransportReplay: async (text, jsonb) => readQuery(text, [jsonb]),
    callTsUnits: null,
  },
  {
    id: 'E-W5_settleFrozen/amount/undefined', entry: 'E-W5_settleFrozen', shape: 'undefined', value: '<undefined>', spec_value: undefined,
    callSuite: () => settleFrozen({
      fromUid: U1, toUid: U2, cid: CID, amount: undefined as unknown as string, kind: 'job_payout',
      refType: 'job', refId: '1', idempotencyKey: key('w5-amt-undefined'),
    }),
    callContractInTx: replayInTx,
    callTransportReplay: async (text, jsonb) => readQuery(text, [jsonb]),
    callTsUnits: null,
  },
];

let CID = '0';

// ------------------------------------------------------------------ 主流程
interface Series { member: string; form: Form; n: number; thrown: number; expected_400: number; unexpected_500: number; other: number[]; codes: Record<string, number>; raw_sigs: Record<string, number>; }

const classify = (a: Attempt): 'expected_400' | 'unexpected_500' | 'other' => {
  if (a.code === 'LEDGER_AMOUNT_INVALID' && a.status === 400) return 'expected_400';
  if (a.status === 500) return 'unexpected_500';
  return 'other';
};

const main = async (): Promise<void> => {
  if (fs.existsSync(OUT)) { console.error(`REFUSE_OVERWRITE ${OUT}`); process.exit(3); }
  fs.mkdirSync(ART_DIR, { recursive: true });

  const before = await rawq<{ t: string; n: string }>(`
    SELECT 'users' AS t, count(*)::text AS n FROM public.users
    UNION ALL SELECT 'account', count(*)::text FROM public.account
    UNION ALL SELECT 'ledger_entry', count(*)::text FROM public.ledger_entry
    UNION ALL SELECT 'currency', count(*)::text FROM public.currency
    UNION ALL SELECT 'referral', count(*)::text FROM public.referral`);

  // 夹具：自建测试币（owner = 991101）+ 受款方账户（不写账本行）
  const cur = await rawq<{ cid: string }>(
    `INSERT INTO public.currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
     VALUES ($1, $2, $3, 2, 0, '1000000000', 'listed', now()) RETURNING cid`,
    [SYM, `P3S ${SYM}`, U1]);
  CID = cur[0].cid;
  await getOrCreateAccount(U2, CID).catch((e) => ({ err: String(e) }));

  // 控制格：合法小额转账 ⇒ 期望 409 INSUFFICIENT_BALANCE（证明账户链正常，且不写账本行）
  const control = await runOne('CONTROL/E-W1_transfer/amount/valid_1', 'i_suite', 0,
    () => transfer({ fromUid: U1, toUid: U2, cid: CID, amount: '1', idempotencyKey: key('control-valid-1') }));

  const series: Series[] = [];
  const push = (s: Series, a: Attempt): void => {
    s.n += 1;
    if (a.thrown) s.thrown += 1;
    const c = classify(a);
    if (c === 'expected_400') s.expected_400 += 1;
    else if (c === 'unexpected_500') s.unexpected_500 += 1;
    else s.other.push(a.status ?? 0);
    s.codes[`${a.code}|${a.status}`] = (s.codes[`${a.code}|${a.status}`] ?? 0) + 1;
    if (a.raw_sig) s.raw_sigs[a.raw_sig] = (s.raw_sigs[a.raw_sig] ?? 0) + 1;
  };
  const newSeries = (member: string, form: Form): Series => {
    const s: Series = { member, form, n: 0, thrown: 0, expected_400: 0, unexpected_500: 0, other: [], codes: {}, raw_sigs: {} };
    series.push(s); return s;
  };

  for (const m of MEMBERS) {
    // ---- (i) 套件形态
    const si = newSeries(m.id, 'i_suite');
    let captured: Sent | null = null;
    for (let i = 1; i <= argN; i += 1) {
      const a = await runOne(m.id, 'i_suite', i, m.callSuite);
      push(si, a);
      if (!captured && a.sent.length) captured = a.sent[a.sent.length - 1];
    }
    if (!captured || !captured.params) { continue; }

    // ---- (ii) 契约形态：同语句、同参数、事务内（直连端点）
    const st = newSeries(m.id, 'ii_contract_in_tx');
    for (let i = 1; i <= argN; i += 1) push(st, await runOne(m.id, 'ii_contract_in_tx', i, () => m.callContractInTx(captured.text, captured.params!.jsonb!)));

    // ---- (iii) 传输重放：同语句同参数，走 pooler 只读池、绕过 ledger 代码
    const sr = newSeries(m.id, 'iii_transport_replay');
    for (let i = 1; i <= argN; i += 1) push(sr, await runOne(m.id, 'iii_transport_replay', i, () => m.callTransportReplay(captured.text, captured.params!.jsonb!)));

    // ---- (ii-b) 类型正确形态（TS 最小单位闸；无 I/O）
    if (m.callTsUnits) {
      const su = newSeries(m.id, 'ii_b_ts_units');
      for (let i = 1; i <= Math.min(3, argN); i += 1) push(su, await runOne(m.id, 'ii_b_ts_units', i, m.callTsUnits));
    }
  }

  const after = await rawq<{ t: string; n: string }>(`
    SELECT 'users' AS t, count(*)::text AS n FROM public.users
    UNION ALL SELECT 'account', count(*)::text FROM public.account
    UNION ALL SELECT 'ledger_entry', count(*)::text FROM public.ledger_entry
    UNION ALL SELECT 'currency', count(*)::text FROM public.currency
    UNION ALL SELECT 'referral', count(*)::text FROM public.referral`);

  const delta: Record<string, number> = {};
  for (const b of before) {
    const a = after.find((x) => x.t === b.t);
    delta[b.t] = Number(a?.n ?? '0') - Number(b.n);
  }

  const wsClose = WS_EVENTS.filter((e) => e.event === 'close');

  // ---- (iv) 折叠路径的**离线合成复现**（纯函数，无 I/O）：证明「非 PG / 无 code 错误 ⇒ 500 且丢原始信息」
  const { normalizeLedgerError } = require('../src/ledger-errors') as typeof import('../src/ledger-errors');
  const synthetic: Array<{ key: string; err: unknown }> = [
    { key: 'plain_Error_ws_closed', err: new Error('WebSocket was closed before the connection was established') },
    { key: 'plain_Error_socket_hang_up', err: new Error('socket hang up') },
    { key: 'plain_Error_fetch_failed', err: new Error('fetch failed') },
    { key: 'error_like_object_no_name_no_code', err: { message: 'TLS handshake failed', type: 'error' } },
    { key: 'ErrorEvent_like_getter_only_message', err: Object.defineProperty({ type: 'error' }, 'message', { get: () => 'stream error', enumerable: true }) },
    { key: 'type_error_driver_connectionCallback', err: new TypeError('Cannot set property message of #<ErrorEvent> which has only a getter') },
    { key: 'pool_timeout_plain', err: new Error('timeout exceeded when trying to connect') },
    { key: 'driver_transient_ECONNRESET', err: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) },
  ];
  const foldRepro = synthetic.map((s) => {
    const le = normalizeLedgerError(s.err);
    const a = s.err as Record<string, unknown>;
    return {
      input_key: s.key,
      input_name: String(a?.name ?? '<no name>'),
      input_own_code: Object.prototype.hasOwnProperty.call(a ?? {}, 'code'),
      input_has_stack: typeof a?.stack === 'string',
      input_message_kept: String(a?.message ?? ''),
      mapped_code: le.code,
      mapped_status: (le as unknown as { status?: number | null }).status ?? null,
      mapped_details: le.details,
      original_message_survived_to_details: JSON.stringify(le.details).includes(String(a?.message ?? '\u0000')),
      original_stack_survived_to_details: JSON.stringify(le.details).includes('at '),
    };
  });
  const out = {
    probe: 'P3S-00 · p1o-00 500 族红项 RCA（外部探针 · 驱动层插桩）',
    run: RUN, started_tag: RUN, utc: new Date().toISOString(),
    symbols: { SYM, CID, U1, U2, key_prefix: KEY_PREFIX },
    n_per_series: argN,
    env: {
      write_driver: process.env.SEAFOOD_LEDGER_WRITE_DRIVER ?? 'pool(default)',
      tx_pool_max: process.env.SEAFOOD_TX_POOL_MAX ?? '4(default)',
      read_pool_max: process.env.SEAFOOD_READ_POOL_MAX ?? '4(default)',
      direct_url_host: (DIRECT_URL.match(/@([^/?]+)/) ?? [])[1] ?? null,
      pooled_url_host: (POOLED_URL.match(/@([^/?]+)/) ?? [])[1] ?? null,
    },
    control: control,
    series,
    attempts: ATTEMPTS,
    raw_errors: RAW,
    raw_error_count: RAW.length,
    ws_events: WS_EVENTS,
    ws_constructs: WS_EVENTS.filter((e) => e.event === 'construct').length,
    ws_closes: wsClose.length,
    ws_close_details: wsClose.slice(0, 20),
    db_rows_before: before, db_rows_after: after, db_rows_delta: delta,
    finished_at: new Date().toISOString(),
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));

  // ---- 控制台摘要
  console.log(`RUN=${RUN} CID=${CID} out=${OUT}`);
  console.log(`CONTROL valid '1' -> ${control.code}|${control.status}|${control.reason} (期望 409 LEDGER_INSUFFICIENT_BALANCE)`);
  for (const s of series) {
    console.log(`  ${s.member.padEnd(42)} ${s.form.padEnd(20)} n=${s.n} thrown=${s.thrown} 期望400=${s.expected_400} 非期望500=${s.unexpected_500} other=${JSON.stringify(s.other)} codes=${JSON.stringify(s.codes)} raw=${JSON.stringify(s.raw_sigs)}`);
  }
  console.log(`RAW_ERRORS=${RAW.length} kinds=${JSON.stringify(RAW.reduce((o: Record<string, number>, r) => { const k = `${r.name}|${r.code ?? 'no-code'}|${r.message.slice(0, 40)}`; o[k] = (o[k] ?? 0) + 1; return o; }, {}))}`);
  console.log(`WS constructs=${out.ws_constructs} closes=${out.ws_closes}`);
  console.log(`DB delta=${JSON.stringify(delta)}`);

  for (const r of RAW.slice(0, 6)) {
    console.log(`  RAW[${r.where}] ${r.name} code=${r.code ?? 'null'} own_code=${r.has_own_code} msg=${r.message.slice(0, 160)}`);
    for (const f of r.stack.slice(0, 5)) console.log(`     ${f.trim().slice(0, 140)}`);
  }

  await closePools();
  await admin.end().catch(() => undefined);
};

main().catch(async (e) => {
  console.error('PROBE_FAILED', describeErr(e));
  try { await closePools(); await admin.end(); } catch { /* ignore */ }
  process.exit(1);
});
