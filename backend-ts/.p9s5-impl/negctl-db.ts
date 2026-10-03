/**
 * P9⑤ 接线 + 库面收口单 · ④ 库面判负（**仓外副本** + 复原回绿 + 主仓零写入 `cmp`）。
 * ============================================================================
 * NC1（去 `0038` 白名单）：仓外副本去掉 `-1` 的 `debit` 白名单（`invite_first_task_reward` ⇒ 回
 *     `ELSE false`），同事务内跑副本 ⇒ `ledger_assert_platform_mutation(-1,'invite_first_task_reward',
 *     'debit')` **必红** `PLATFORM_DEBIT_FORBIDDEN`；复原（跑主仓 0038）⇒ **回绿**。
 * NC2（去幂等键）：同业务事实 **同键** ⇒ 零新增（`R106` 重放）；**换键**（= 去掉共享幂等键）⇒ **双发**
 *     —— 证明「共享幂等键」是唯一的双发闸（判负）。
 * 每轮写库一律**单事务内 + 末尾 `ROLLBACK`**（`0038` 全文经事务内执行）；主仓文件**只读**（`cmp` 证零写入）。
 * 入 `.p9s5-impl/`（探针）/ 仓外 scratch（副本）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT = path.resolve(__dirname, '..', '.p9s5-impl');
const ROOT = path.resolve(__dirname, '..');
const SCRATCH = '/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s5-negctl';
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(SCRATCH, { recursive: true });
const SENT = 'P9S5_NEG_ROLLBACK';
const fp = (p: Array<string | number>) => createHash('sha256').update(p.join('|')).digest('hex');
const strOf = (v: unknown) => (v === null || v === undefined ? '' : String(v));
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const tryTx = async <T>(tx: TxClient, label: string, fn: () => Promise<T>) => {
  const sp = `sp_${Math.random().toString(36).slice(2, 8)}`;
  await tx.query(`SAVEPOINT ${sp}`);
  try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT ${sp}`); return { label, ok: true as const, value: v }; }
  catch (e) {
    await tx.query(`ROLLBACK TO SAVEPOINT ${sp}`).catch(() => undefined);
    const err = e as { code?: string; message?: string; detail?: string };
    let reason: string | null = null;
    try { reason = (JSON.parse(strOf(err.detail)) as { reason?: string })?.reason ?? null; } catch { /* noop */ }
    return { label, ok: false as const, sqlstate: strOf(err.code), message: strOf(err.message).slice(0, 160), reason };
  }
};

/** 单事务内跑一段 SQL（整文件）；末尾 ROLLBACK；返回 exec_err + 探针读数。 */
const runInTx = async (label: string, sql: string, probe: (tx: TxClient) => Promise<unknown>) => {
  let execErr: string | null = null;
  let reading: unknown = null;
  try {
    await withTransaction(async (tx: TxClient) => {
      await tx.query(sql);
      reading = await probe(tx);
      throw new Error(SENT);
    });
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    if (m !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${m.slice(0, 200)}` : m.slice(0, 220);
  }
  return { label, exec_err: execErr, reading };
};

const rewardPayload = (jobId: string, worker: string, parent: string | null, perLeg: number, key: string) => {
  const recips = parent ? [worker, parent] : [worker];
  const total = perLeg * recips.length;
  const entries = [
    { uid: '-1', cid: '1', kind: 'invite_first_task_reward', delta: String(-total), frozen_delta: '0', memo: 'nc' },
    ...recips.map((u) => ({ uid: u, cid: '1', kind: 'invite_first_task_reward', delta: String(perLeg), frozen_delta: '0', memo: 'nc' })),
  ];
  return { op: 'entries', idempotency_key: key, request_fingerprint: fp(['invite.first_task', jobId, worker, parent ?? '-', perLeg]),
    memo: 'nc', ref_type: 'job', ref_id: jobId, entries };
};
const countReward = async (tx: TxClient, key: string) =>
  Number(((await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.ledger_entry
     WHERE split_part(idempotency_key,'#',1) = $1`, [key])).rows[0] ?? {}).n ?? 0);

(async () => {
  const repo38 = fs.readFileSync(path.join(ROOT, 'migrations/0038_kind_close_set_24.sql'), 'utf8');
  const repoMd5 = sha256(repo38);
  const out: Record<string, unknown> = {
    unit: 'P9S5-NEGCTL-DB', generated_at: new Date().toISOString(), run: RUN,
    note: '仓外副本变异 + 复原回绿 + 主仓只读（cmp）；全部库面写事务内 + ROLLBACK。',
    repo_0038_md5: repoMd5, repo_0038_bytes: Buffer.byteLength(repo38, 'utf8'),
  };

  // ---------- 构造 NC1 仓外变异副本（去 -1 debit 白名单） ----------
  const POS = `ELSE p_kind IN ('invite_first_task_reward') END`;
  const SELF_POS = `  PERFORM ledger_assert_platform_mutation(-1::bigint, 'invite_first_task_reward', 'debit');`;
  let mut = repo38;
  const c1 = mut.split(POS).length - 1;
  mut = mut.replace(POS, 'ELSE false END');
  const c2 = mut.split(SELF_POS).length - 1;
  mut = mut.replace(SELF_POS, `  PERFORM 1; -- mutation: positive assert removed`);
  const mutPath = path.join(SCRATCH, '0038.mut.sql');
  fs.writeFileSync(mutPath, mut, 'utf8');
  out.nc1_mutation = { occurrences_whitelist: c1, occurrences_selfcheck_positive: c2, mut_path: mutPath,
    mut_md5: sha256(mut), differs_from_repo: sha256(mut) !== repoMd5 };

  // ---------- NC1：变异副本 ⇒ 必红 ----------
  out.nc1_mutated_red = await runInTx('nc1-mut', mut, async (tx) =>
    tryTx(tx, 'assert_minus1_debit_invite', () =>
      tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint, 'invite_first_task_reward', 'debit')`).then((r) => r.rows[0])));

  // ---------- NC1 复原（主仓 0038）⇒ 回绿 ----------
  out.nc1_restored_green = await runInTx('nc1-restore', repo38, async (tx) =>
    tryTx(tx, 'assert_minus1_debit_invite', () =>
      tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint, 'invite_first_task_reward', 'debit')`).then((r) => r.rows[0])));

  // ---------- NC2：去幂等键 ⇒ 双发（同键重放 ⇄ 换键双发） ----------
  const K = 'biz:invite:firsttask:nc2worker';
  const K2 = 'biz:invite:firsttask:nc2worker:variant';
  out.nc2_idempotency = await runInTx('nc2-idem', repo38, async (tx) => {
    const post = (payload: unknown) => tx.query(`SELECT ledger_post_event($1::jsonb) AS r`, [JSON.stringify(payload)])
      .then((r) => (r.rows[0]?.r ?? {}) as Record<string, unknown>);
    const p1 = rewardPayload('99000', '99000', '99001', 10, K);
    const r1 = await post(p1);
    const n1 = await countReward(tx, K);
    const r2 = await post(p1);                       // 同键 ⇒ 重放
    const n2 = await countReward(tx, K);
    const r3 = await post(rewardPayload('99000', '99000', '99001', 10, K2));  // 换键 ⇒ 双发
    const n3 = await countReward(tx, K) + await countReward(tx, K2);
    return { same_key_first: { replay: r1.idempotent_replay, rows: n1 },
      same_key_replay: { replay: r2.idempotent_replay, rows: n2 },
      different_key: { replay: r3.idempotent_replay, rows_total_k_plus_k2: n3 },
      double_issue_when_key_changes: n3 > n2 };
  });

  // ---------- 主仓零写入：cmp 副本 vs 主仓 ----------
  const restorePath = path.join(SCRATCH, '0038.restore.sql');
  fs.writeFileSync(restorePath, repo38, 'utf8');           // 「复原」= 从主仓读回原字节写入副本
  const repoNow = fs.readFileSync(path.join(ROOT, 'migrations/0038_kind_close_set_24.sql'), 'utf8');
  out.cmp = {
    repo_unchanged_after_all: sha256(repoNow) === repoMd5,
    restore_copy_equals_repo: sha256(fs.readFileSync(restorePath, 'utf8')) === repoMd5,
    mutated_differs_from_repo: sha256(fs.readFileSync(mutPath, 'utf8')) !== repoMd5,
  };

  fs.writeFileSync(path.join(OUT, `negctl-db-${RUN}.json`), JSON.stringify(out, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(out, null, 1));
  await closePools().catch(() => undefined);
  process.exit(0);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 1200)); await closePools().catch(() => undefined); process.exit(2); });
