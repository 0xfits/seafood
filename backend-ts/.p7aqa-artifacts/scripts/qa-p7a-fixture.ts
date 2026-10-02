/**
 * qa-p7a-fixture.ts —— **Neng 独立质检（批 7-A）自建夹具**
 * 用途：为 `GET /api/user/ledger` 的 keyset 翻页/过滤实测造一段**全新独占命名空间**的流水。
 * 纪律：
 *   · uid 窗口由仓库**共享分配器** `scripts/ns-alloc.ts` 分配（本脚本不复制扫描逻辑）；uid ≥ 910001。
 *   · 身份表一律写 `users`（绝不写裸 `user`）；SQL 表引用显式 `public.`。
 *   · 夹具不可复位（`ledger_entry` append-only 触发器）⇒ 每跑换新窗口；空间不足 ⇒ exit 3（不静默）。
 *   · 不打印 token / 密钥 / 连接串；产物落 run-tagged JSON。
 * 用法：npx ts-node --transpile-only .p7aqa-artifacts/scripts/qa-p7a-fixture.ts <RUN_TAG>
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { allocUidWindow, allocCurrencySymbol, exitPrecondition } from '../../scripts/ns-alloc';

dotenv.config({ path: '.env.local' });
dotenv.config();

type Row = Record<string, unknown>;
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
const RUN = process.argv[2] || 'P7AQA001';
const OUTDIR = `.p7aqa-artifacts/FIXTURE-${RUN}`;
fs.mkdirSync(OUTDIR, { recursive: true });

/** 位置参数执行器（`$1..$n`）——仅供共享分配器使用；业务 SQL 一律走 neon 标签模板（参数位） */
const rawQuery = async <T = Row>(query: string, params: unknown[] = []): Promise<T[]> => {
  const parts: string[] = [];
  const values: unknown[] = [];
  let buf = '';
  for (let i = 0; i < query.length; i += 1) {
    if (query[i] === '$' && /\d/.test(query[i + 1] ?? '')) {
      let j = i + 1;
      let num = '';
      while (j < query.length && /\d/.test(query[j])) { num += query[j]; j += 1; }
      parts.push(buf); buf = '';
      values.push(params[Number(num) - 1]);
      i = j - 1;
    } else buf += query[i];
  }
  parts.push(buf);
  const strings = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray;
  return (await (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown>)(strings, ...values)) as T[];
};
/** 共享分配器（`scripts/ns-alloc.ts`）要求的 NsQuery 形状 */
const nsq = { query: async (q: string, p: unknown[] = []) => ({ rows: await rawQuery(q, p) as Row[] }) };
const raw = rawQuery;

const evmOf = (seed: string) => '0x' + crypto.createHash('sha256').update(seed).digest('hex').slice(0, 40);

(async () => {
  const out: Row = { run: RUN, probe: 'qa-p7a-fixture', started_at: new Date().toISOString() };

  // ① uid 窗口：**先查本 RUN 是否已有夹具**（脚本可续跑，避免失败后重复建身份/币种）；无 ⇒ 走共享分配器
  const evmA = evmOf(`${RUN}:a`);
  const prev = await sql`SELECT uid::text AS uid FROM public.users WHERE evm = ${evmA}` as Row[];
  let A: number;
  let B: number;
  if (prev.length > 0) {
    A = Number(prev[0].uid);
    B = A + 1;
    out.window = { uid_a: A, uid_b: B, source: 'resume:evm-lookup', partition: [910001, 910999], occupied_recheck: [] };
  } else {
    const ns = await allocUidWindow(nsq, {
      count: 2, tagPrefix: 'p7aqa', partitions: [[910001, 910999]], seed: RUN,
      purpose: '批 7-A 账本读口质检夹具：ledger_entry append-only ⇒ 每跑独占全新 uid 窗口',
    });
    if (!ns.ok) exitPrecondition(ns.fatal, () => fs.writeFileSync(path.join(OUTDIR, `fixture-${RUN}.json`), JSON.stringify({ ...out, fatal: ns.fatal }, null, 1)));
    A = Number(ns.uids[0]);
    B = Number(ns.uids[1]);
    out.window = { uid_a: A, uid_b: B, source: ns.source, partition: ns.partition, occupied_recheck: ns.occupied_recheck };
    // ② 身份行（users；uid > 0；evm ^0x[0-9a-f]{40}$）
    await sql`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last)
              VALUES (${A}, ${evmA}, ${'qa-p7a fixture'}, ${false}, now(), now())`;
  }

  // ③ 两个币种（owner = 夹具 uid ⇒ 可 mint；status=listed）；已存在则复用
  const existing = await sql`SELECT cid::text AS cid, symbol FROM public.currency WHERE owner_uid = ${A} ORDER BY cid` as Row[];
  const mk = async (symbol: string): Promise<number> => {
    const r = await sql`INSERT INTO public.currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
                        VALUES (${symbol}, ${'QA p7-a fixture ' + symbol}, ${A}, ${0}, ${0}, ${null}, ${'listed'}, now())
                        RETURNING cid::text AS cid`;
    return Number((r as Row[])[0].cid);
  };
  const symOf = async (prefix: string, seed: string): Promise<string> => {
    const s = await allocCurrencySymbol(nsq, { prefix, seed, tagPrefix: 'p7aqa' });
    if (!s.ok) exitPrecondition(s.fatal, () => fs.writeFileSync(path.join(OUTDIR, `fixture-${RUN}.json`), JSON.stringify({ ...out, fatal: s.fatal }, null, 1)));
    return s.symbol;
  };
  let cidX: number; let cidY: number; let symX: string; let symY: string;
  if (existing.length >= 2) {
    cidX = Number(existing[0].cid); symX = String(existing[0].symbol);
    cidY = Number(existing[1].cid); symY = String(existing[1].symbol);
  } else {
    symX = await symOf('qap7a', `${RUN}:x`); cidX = await mk(symX);
    symY = await symOf('qap7b', `${RUN}:y`); cidY = await mk(symY);
  }

  const key = (s: string) => `ops:qap7a:${RUN}:${s}`;
  const postFn = async (payload: Record<string, unknown>): Promise<Row> => {
    const r = await sql`SELECT public.ledger_post_event(${JSON.stringify(payload)}::jsonb) AS r` as Row[];
    const v = r[0].r;
    return (typeof v === 'string' ? JSON.parse(v) : v) as Row;
  };

  const calls: Row[] = [];
  // ④ mint X：1 条（kind=mint, cid=X）
  const m1 = await postFn({ op: 'mint', uid: String(A), cid: String(cidX), amount_units: '10000',
    idempotency_key: key('mintX'), ref_type: 'currency', ref_id: String(cidX), memo: 'qa p7a fixture mint X' });
  calls.push({ call: 'mintX', txid: m1.txid, entries: (m1.entries as unknown[])?.length, replay: m1.idempotent_replay });

  // ⑤ op=entries on X：两批 × 12 对（A -1 / B +1 ⇒ 事件净额 0；单事件 ≤32 分录）
  for (const batch of [1, 2]) {
    const entries: Row[] = [];
    for (let i = 0; i < 12; i += 1) {
      entries.push({ uid: String(A), cid: String(cidX), delta: '-1', kind: 'transfer' });
      entries.push({ uid: String(B), cid: String(cidX), delta: '1', kind: 'transfer' });
    }
    const r = await postFn({ op: 'entries', entries, idempotency_key: key(`xferX${batch}`),
      ref_type: 'system', ref_id: '1', memo: `qa p7a fixture transfer batch ${batch}` });
    calls.push({ call: `entriesX${batch}`, txid: r.txid, entries: (r.entries as unknown[])?.length, replay: r.idempotent_replay });
  }

  // ⑥ mint Y ×3：3 条（kind=mint, cid=Y）
  for (let i = 1; i <= 3; i += 1) {
    const r = await postFn({ op: 'mint', uid: String(A), cid: String(cidY), amount_units: '10',
      idempotency_key: key(`mintY${i}`), ref_type: 'currency', ref_id: String(cidY), memo: `qa p7a fixture mint Y ${i}` });
    calls.push({ call: `mintY${i}`, txid: r.txid, entries: (r.entries as unknown[])?.length, replay: r.idempotent_replay });
  }

  // ⑦ 读数：夹具 uid 的流水（含全字段，供后续逐字对拍）
  const rowsA = await sql`SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
                                 frozen_delta::text AS frozen_delta, balance_after::text AS balance_after,
                                 frozen_after::text AS frozen_after, kind, ref_type, ref_id::text AS ref_id,
                                 reversal_of_txid::text AS reversal_of_txid, memo, time_created
                            FROM public.ledger_entry WHERE uid = ${A} ORDER BY public.ledger_entry.txid DESC` as Row[];
  const byCid = await sql`SELECT cid::text AS cid, COUNT(1)::int AS n, MIN(txid)::text AS min_tx, MAX(txid)::text AS max_tx
                            FROM public.ledger_entry WHERE uid = ${A} GROUP BY cid ORDER BY cid` as Row[];
  const byKind = await sql`SELECT kind, COUNT(1)::int AS n FROM public.ledger_entry WHERE uid = ${A} GROUP BY kind ORDER BY kind` as Row[];
  const bRows = await sql`SELECT txid::text AS txid FROM public.ledger_entry WHERE uid = ${B} ORDER BY txid` as Row[];

  out.fixture = { uids: { A, B }, evm_a: evmA, symbols: { X: symX, Y: symY }, cids: { X: cidX, Y: cidY },
    keys: { mintX: key('mintX'), entriesX1: key('xferX1'), entriesX2: key('xferX2'), mintY1: key('mintY1') } };
  out.posts = calls;
  out.counts = { a_rows: rowsA.length, a_by_cid: byCid, a_by_kind: byKind, b_rows: bRows.length };
  out.a_txids_desc = rowsA.map((r) => Number(r.txid));
  out.a_rows_full = rowsA;
  // 残留登记（append-only 不可复位 ⇒ 逐项登记）
  out.residual_registry = {
    note: '本 run 自建、不可删（ledger_entry append-only / account 与 currency 无删除路径）',
    users_rows: [A], currency_rows: [{ cid: cidX, symbol: symX }, { cid: cidY, symbol: symY }],
    account_rows: [{ uid: A, cid: cidX }, { uid: A, cid: cidY }, { uid: B, cid: cidX }],
    ledger_rows: { 'uid_a': rowsA.length, 'uid_b': bRows.length, keys: Object.values(out.fixture as Row).length ? [key('mintX'), key('xferX1'), key('xferX2'), key('mintY1'), key('mintY2'), key('mintY3')] : [] },
  };
  out.finished_at = new Date().toISOString();
  fs.writeFileSync(path.join(OUTDIR, `fixture-${RUN}.json`), JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ ok: true, counts: out.counts, window: out.window, cids: out.cids, posts: calls }, null, 1));
  process.exitCode = rowsA.length === 28 ? 0 : 1;
})().catch((e) => { console.error('FIXTURE-FAILED', String(e).slice(0, 600)); process.exit(2); });
