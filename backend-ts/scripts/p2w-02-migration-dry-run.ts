/**
 * p2w-02 · 迁移「干跑」：把某个 migration 文件在**回滚事务**里整份执行一遍
 * ---------------------------------------------------------------------------
 * 用途：`migrations/NNNN*.sql` 一旦被 `migrate.ts` 应用就会写入 checksum，之后改文件即「撒谎态」
 *       （`migrate.ts` 报 checksum drift ⇒ exit 3）。所以在**真应用之前**必须先在回滚事务里整份跑通，
 *       并自证「回滚后函数体/触发器指纹与跑之前逐字一致」（零残留）。
 * 用法：
 *   npx ts-node --transpile-only scripts/p2w-02-migration-dry-run.ts migrations/0011_xxx.sql
 * 读数：run-tagged 落 `.p2w-artifacts/p2w-02-migration-dry-run-<RUN>.json`。
 * 测试数据：本脚本**只读**既有库；干跑期间 0011 的 DO 自检会在子事务里造探针再回滚 ⇒ 零残留。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw, trySql, inRollbackTx, save, md5, REPO_BACKEND } from './p2w-lib';

const FN_NAMES = ['ledger_assert_commission_conservation', 'referral_cycle_guard'];

const fingerprint = async (ex: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }) => {
  const fns = await raw<{ proname: string; prosrc: string }>(ex,
    `SELECT proname, prosrc FROM pg_proc WHERE proname = ANY($1::text[]) ORDER BY proname`, [FN_NAMES]);
  const trg = await raw<{ tgname: string; tgenabled: string; def: boolean }>(ex,
    `SELECT tgname, tgenabled, (tgdeferrable AND tginitdeferred) AS def FROM pg_trigger
      WHERE NOT tgisinternal AND tgname IN ('trg_ledger_entry_commission_conservation','trg_referral_cycle_guard','trg_referral_append_only','trg_ledger_entry_append_only','trg_account_guard')
      ORDER BY tgname`);
  const ver = await raw1v(ex, `SELECT count(*)::text AS n FROM schema_migration`);
  return { functions: fns.map((f) => ({ proname: f.proname, md5: md5(f.prosrc ?? ''), len: (f.prosrc ?? '').length })),
    triggers: trg, schema_migration_rows: ver };
};
const raw1v = async (ex: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }, sql: string, params: unknown[] = []) =>
  (await raw(ex, sql, params))[0]?.n as string ?? '';

(async () => {
  const fileArg = process.argv[2] ?? 'migrations/0011_commission_assert_closure_and_referral_depth_guard.sql';
  const file = path.isAbsolute(fileArg) ? fileArg : path.resolve(REPO_BACKEND, fileArg);
  const sql = fs.readFileSync(file, 'utf8');
  const out: Record<string, unknown> = { script: 'scripts/p2w-02-migration-dry-run.ts', file: path.relative(REPO_BACKEND, file), sql_sha256: md5(sql), sql_bytes: sql.length };
  const p = mkPool(2);
  try {
    out.fingerprint_before = await fingerprint(p);
    // 干跑：整份 SQL 在回滚事务里执行（含 0011 的 DO 自检 ⇒ 自检不通过这里就会红）
    const run = await inRollbackTx(p, async (c) => {
      await c.query(sql);
      return { executed: true };
    });
    out.dry_run = {
      result: run.result, error: run.error ? String((run.error as { message?: string })?.message ?? run.error).slice(0, 600) : null,
      error_sqlstate: run.error ? ((run.error as { code?: string })?.code ?? null) : null,
      rolled_back: run.rolled_back, ms: run.ms,
      note: '整份文件在一个事务里执行后 ROLLBACK；DO 自检的探针数据在子事务里，已随回滚消失',
    };
    out.fingerprint_after = await fingerprint(p);
    out.zero_residue = JSON.stringify(out.fingerprint_before) === JSON.stringify(out.fingerprint_after);
    // 干跑期间的残留核对：探针 uid / 探针 symbol 必须 0 行
    const probe = await trySql(p, `SELECT
        (SELECT count(*)::text FROM users WHERE uid BETWEEN 952981 AND 952990) AS probe_users,
        (SELECT count(*)::text FROM referral WHERE child_uid BETWEEN 952981 AND 952990 OR parent_uid BETWEEN 952981 AND 952990) AS probe_referral,
        (SELECT count(*)::text FROM currency WHERE symbol = 'p0011selfcheck') AS probe_currency,
        (SELECT count(*)::text FROM ledger_entry WHERE idempotency_key LIKE 'p0011:selfcheck:%') AS probe_ledger`);
    out.probe_residue = probe.rows[0] ?? probe.error;
    out.ok = run.error === null && out.zero_residue === true;
  } finally {
    await p.end();
  }
  const f = save('p2w-02-migration-dry-run', out);
  console.log(JSON.stringify({ saved: f, ok: out.ok, dry_run: out.dry_run, zero_residue: out.zero_residue, probe_residue: out.probe_residue }, null, 1));
  if (out.ok !== true) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
