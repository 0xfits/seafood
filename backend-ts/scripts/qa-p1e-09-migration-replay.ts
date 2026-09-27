/**
 * QA-P1E-09 · 0001→0004 **从零重演**（干净 schema）+ 端到端最小验证（Neng）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-09-migration-replay.ts
 *
 * 补齐实现方自报未验证面 ④（「0004 未在干净库上从 0 跑到 0004 重演」）。
 *
 * 方法：在**新 schema**（`qae_mig_<run>`）里按序执行 migrations/0001..0004 的**原文**，
 *       验证：4 张表 + schema_migration 建立、函数建立、并能真的跑一笔 mint+transfer。
 *       完成后 `DROP SCHEMA ... CASCADE` 清除（不留残留）。
 *
 * ⚠️ 安全闸（必须）：每个文件执行**前**断言 `current_schema()` 仍是本 schema，
 *    否则立刻中止 —— 0003 含 `ALTER TABLE … DROP CONSTRAINT`，若 search_path 丢失
 *    会打到真 public 表上。本探针绝不碰 public。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, pgInfo, raw } from './qa-p1e-lib';

const ROOT = path.resolve(__dirname, '..');
const SCHEMA = `qae_mig_${Date.now().toString(36).slice(-6)}`;
const FILES = ['0001_ledger_core.sql', '0002_user_identity.sql', '0003_kind_close_set_20.sql', '0004_ledger_post_event.sql'];

(async () => {
  const out: Record<string, unknown> = { schema: SCHEMA, files: FILES };
  const p = mkPool(1);            // 单连接：SET search_path 必须在同一会话内持续生效
  await p.query('SELECT 1');
  const steps: Array<Record<string, unknown>> = [];

  const curSchema = async (): Promise<string> =>
    (await raw<{ s: string }>(p, 'SELECT current_schema() AS s'))[0].s;

  try {
    await raw(p, `CREATE SCHEMA ${SCHEMA}`);
    await raw(p, `SET search_path = ${SCHEMA}`);
    out.search_path_after_set = await curSchema();

    for (const f of FILES) {
      const sql = fs.readFileSync(path.join(ROOT, 'migrations', f), 'utf8');
      const guard = await curSchema();
      if (guard !== SCHEMA) {
        steps.push({ file: f, aborted: true, reason: `search_path 丢失（current_schema=${guard}）⇒ 拒绝执行` });
        throw new Error(`SAFETY ABORT before ${f}: current_schema=${guard}`);
      }
      const t0 = Date.now();
      try {
        await p.query(sql);
        steps.push({ file: f, ok: true, bytes: sql.length, ms: Date.now() - t0 });
      } catch (e) {
        const i = pgInfo(e);
        steps.push({ file: f, ok: false, bytes: sql.length, ms: Date.now() - t0,
          sqlstate: i.code, message: (i.message ?? '').slice(0, 300), where: (i.where ?? '').slice(0, 200) });
        throw e;
      }
    }
    out.steps = steps;

    out.tables = await raw(p, `
      SELECT tablename FROM pg_tables WHERE schemaname = $1 ORDER BY tablename`, [SCHEMA]);
    out.functions = await raw(p, `
      SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = $1 ORDER BY 1`, [SCHEMA]);
    // 注：`schema_migration` 由 scripts/migrate.ts 自举，不在 4 个 SQL 文件内 ⇒ 干净 schema 里本就不该有
    out.schema_migration_present = await raw(p, `
      SELECT (to_regclass($1) IS NOT NULL)::text AS present`, [`${SCHEMA}.schema_migration`]);
    out.kind_constraint_present = await raw(p, `
      SELECT conname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = $1 AND t.relname = 'ledger_entry' AND c.conname = 'ledger_kind_enum'`, [SCHEMA]);
    out.triggers = await raw(p, `
      SELECT t.tgname, c.relname FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND NOT t.tgisinternal ORDER BY 1`, [SCHEMA]);

    // 端到端最小验证：在**这个刚建出来的 schema** 里跑一笔 mint + transfer
    await raw(p, `
      INSERT INTO ledger_owner (uid, owner_type, name) VALUES (0, 'platform', 'platform'), (-1, 'platform', 'fee')
      ON CONFLICT DO NOTHING`);
    const cur = await raw<{ cid: string }>(p, `
      INSERT INTO currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
      VALUES ('qaeMIG', 'clean replay', 0, 0, 0, NULL, 'listed', now()) RETURNING cid`);
    const cid = cur[0].cid;
    out.replay_currency_cid = cid;
    const call = async (payload: unknown) => {
      const rows = await raw<{ r: unknown }>(p, 'SELECT ledger_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
      const r = rows[0].r;
      return (typeof r === 'string' ? JSON.parse(r) : r) as Record<string, unknown>;
    };
    out.replay_mint = await call({ op: 'mint', uid: '950001', cid, amount_units: '100', idempotency_key: 'ops:qae:mig:mint', platform: true });
    out.replay_transfer = await call({ op: 'transfer', from_uid: '950001', to_uid: '950002', cid, amount_units: '40', idempotency_key: 'ops:qae:mig:xfer' });
    out.replay_accounts = await raw(p, `SELECT uid, cid, balance, frozen FROM account ORDER BY uid, cid`);
    out.replay_drift = await raw(p, `
      SELECT a.uid, a.cid, a.balance, COALESCE(s.d,0) AS sum_delta
        FROM account a LEFT JOIN (SELECT uid, cid, SUM(delta) d FROM ledger_entry GROUP BY 1,2) s
          ON s.uid = a.uid AND s.cid = a.cid
       WHERE a.balance <> COALESCE(s.d,0)`);
  } catch (e) {
    out.error = pgInfo(e);
  } finally {
    // 清理：无论如何都删掉本 schema（只删自己建的）
    try {
      await raw(p, `SET search_path = public`);
      await raw(p, `DROP SCHEMA IF EXISTS ${SCHEMA} CASCADE`);
      out.cleanup = 'DROPPED';
      out.schema_left = (await raw<{ n: string }>(p,
        'SELECT count(*)::text AS n FROM information_schema.schemata WHERE schema_name = $1', [SCHEMA]))[0].n;
    } catch (e) { out.cleanup = `FAILED: ${pgInfo(e).message}`; }
  }

  out.public_still_intact = await raw(p, `
    SELECT count(*)::text AS n FROM pg_tables WHERE schemaname = 'public'`);
  out.public_ledger_entry_rows = (await raw(p, `SELECT count(*)::text AS n FROM public.ledger_entry`))[0].n;

  console.log(JSON.stringify(out, null, 1));
  await p.end().catch(() => undefined);
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
