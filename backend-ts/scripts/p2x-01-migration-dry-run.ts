/**
 * p2x-01 · 迁移「干跑」：把 `migrations/0012_*.sql` 在**回滚事务**里整份执行一遍（应用前必做）
 * ============================================================================
 * 为什么：`migrations/NNNN*.sql` 一旦被 `migrate.ts` 应用就写入 checksum，之后改文件即「撒谎态」
 *   （重跑报 checksum drift ⇒ exit 3）。故**真应用之前**必须先证明整份文件能被 PG 接受、
 *   且 `ledger_post_event` 的新旧 prosrc 指纹只按预期变化、干跑后**零残留**。
 * 用法：`npx ts-node --transpile-only scripts/p2x-01-migration-dry-run.ts migrations/0012_xxx.sql`
 * 退出码：0 干跑通过 / 1 干跑失败或残留 / 2 致命
 * 落盘：`.p2x-artifacts/p2x-01-migration-dry-run-<RUN>.json`（run-tagged）
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, raw1, inRollbackTx, save, fnFingerprint, REPO_BACKEND, RUN, PHASE } from './p2x-lib';

(async () => {
  const fileArg = process.argv[2] ?? 'migrations/0012_replay_pre_gate_before_balance_gate.sql';
  const file = path.isAbsolute(fileArg) ? fileArg : path.resolve(REPO_BACKEND, fileArg);
  const sql = fs.readFileSync(file, 'utf8');
  const out: Record<string, unknown> = { script: 'scripts/p2x-01-migration-dry-run.ts', phase: PHASE, run: RUN,
    file: path.relative(REPO_BACKEND, file), sql_bytes: sql.length };
  const p = mkPool(2);
  try {
    out.fn_before = await fnFingerprint(p);
    // 关键（Zang 补料 ②/③）：`fn_after` 必须在**同一事务内、执行之后**读。
    //   PG 的 DDL 在本事务内立刻生效；若等 ROLLBACK 之后再读，读到的是回滚后的**旧**函数体
    //   ⇒ before 与 after 逐字段相同（旧版探针的假绿缺陷：据此会误判「迁移没做事」）。
    const run = await inRollbackTx(p, async (c) => {
      await c.query(sql);
      return { executed: true, fn_in_tx: await fnFingerprint(c) };
    });
    const e = run.error as Record<string, unknown> | null;
    // 事务内（执行后）的指纹 = 真正的「after」；从 result 里取出，别混进 dry_run.result
    const inTx = ((run.result as { fn_in_tx?: Record<string, unknown> } | null)?.fn_in_tx) ?? null;
    out.fn_after_in_tx = inTx;
    out.dry_run = {
      result: run.result ? { executed: true } : null,
      error: e ? String(e?.message ?? e).slice(0, 800) : null,
      error_sqlstate: e ? ((e?.code as string) ?? null) : null,
      // 定位用（迁移写坏了要能一眼看出是哪条语句的哪个字符）
      error_position: e ? (e?.position ?? null) : null,
      error_where: e ? String(e?.where ?? '').slice(0, 400) : null,
      error_internal_query: e ? String(e?.internalQuery ?? '').slice(0, 600) : null,
      ms: run.ms, rolled_back: run.rolled_back,
      note: '整份文件在一个事务里执行后 ROLLBACK；DO 自检的探针数据在子事务里，随回滚消失',
    };
    out.fn_after_post_rollback = await fnFingerprint(p);
    out.zero_residue_fn_body = (out.fn_before as Record<string, unknown>).prosrc_md5 === (out.fn_after_post_rollback as Record<string, unknown>).prosrc_md5;
    const gi = inTx as Record<string, unknown> | null;
    out.fn_changed_in_tx = !!gi && gi.prosrc_md5 !== (out.fn_before as Record<string, unknown>).prosrc_md5;
    out.fn_in_tx_asserts = gi ? {
      pre_gate_present: gi.pre_gate_present,
      order_ok_gate_after_lock_before_balance: gi.order_ok_gate_after_lock_before_balance,
      on_conflict_still_after_gate: gi.on_conflict_still_after_gate,
    } : null;
    // 干跑期间的残留核对：0012 DO 自检的探针 uid / symbol / 键必须 0 行
    const residue = await raw<{ probe_users: string; probe_currency: string; probe_ledger: string; probe_accounts: string }>(p, `SELECT
        (SELECT count(*)::text FROM users WHERE uid BETWEEN 960901 AND 960902) AS probe_users,
        (SELECT count(*)::text FROM currency WHERE symbol = 'p2x-zfix-probe') AS probe_currency,
        (SELECT count(*)::text FROM ledger_entry WHERE idempotency_key LIKE 'ops:p2x:zfix:%') AS probe_ledger,
        (SELECT count(*)::text FROM account a JOIN currency c ON c.cid = a.cid WHERE c.symbol = 'p2x-zfix-probe') AS probe_accounts`);
    out.probe_residue = residue[0] ?? null;
    const r = out.probe_residue as Record<string, string> | null;
    out.residue_zero = !!r && r.probe_users === '0' && r.probe_currency === '0' && r.probe_ledger === '0' && r.probe_accounts === '0';
    out.ok = out.dry_run !== null && (out.dry_run as Record<string, unknown>).error === null && out.zero_residue_fn_body === true && out.residue_zero === true
      && out.fn_changed_in_tx === true
      && (out.fn_in_tx_asserts as Record<string, unknown> | null)?.pre_gate_present === true
      && (out.fn_in_tx_asserts as Record<string, unknown> | null)?.order_ok_gate_after_lock_before_balance === true
      && (out.fn_in_tx_asserts as Record<string, unknown> | null)?.on_conflict_still_after_gate === true;
  } finally {
    await p.end();
  }
  const f = save('p2x-01-migration-dry-run', out);
  console.log(JSON.stringify({ saved: f, ok: out.ok, dry_run: out.dry_run,
    zero_residue_fn_body: out.zero_residue_fn_body, probe_residue: out.probe_residue,
    fn_before: out.fn_before, fn_after_in_tx: out.fn_after_in_tx,
    fn_after_post_rollback: out.fn_after_post_rollback, fn_changed_in_tx: out.fn_changed_in_tx,
    fn_in_tx_asserts: out.fn_in_tx_asserts }, null, 1));
  if (out.ok !== true) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
