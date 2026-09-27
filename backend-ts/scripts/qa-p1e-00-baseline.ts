/**
 * QA-P1E-00 · 基线与环境读数（Neng 独立质检）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/qa-p1e-00-baseline.ts
 *
 * 读数：① 提交指纹 + migrations 1..4 sha256（基座未动核对）
 *       ② schema_version / 表清单 / 行数
 *       ③ §11 判据 1 / 8（ref 形状 + 键族形状）/ 非负 / supply_cap / 发行量对账
 *       ④ 平台账户 0/-1/-2/-3 在 cid=1 的 balance/frozen
 *       ⑤ 服务端超时参数、锁视图
 */
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { withPool, judgementRows, raw, entryCount, deadlocks } from './qa-p1e-lib';

const ROOT = path.resolve(__dirname, '..');

const sha = (rel: string): string =>
  crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

(async () => {
  const out: Record<string, unknown> = {};

  out.files = {
    'migrations/0001_ledger_core.sql': sha('migrations/0001_ledger_core.sql'),
    'migrations/0002_user_identity.sql': sha('migrations/0002_user_identity.sql'),
    'migrations/0003_kind_close_set_20.sql': sha('migrations/0003_kind_close_set_20.sql'),
    'migrations/0004_ledger_post_event.sql': sha('migrations/0004_ledger_post_event.sql'),
    'src/ledger.ts': sha('src/ledger.ts'),
    'src/ledger-errors.ts': sha('src/ledger-errors.ts'),
    'src/db.ts': sha('src/db.ts'),
  };

  await withPool(2, async (p) => {
    out.tables = await raw(p, `
      SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    out.schema_version = await raw(p, `SELECT version, applied_at FROM schema_migration ORDER BY version`);
    out.row_counts = await raw(p, `
      SELECT 'account' AS t, count(*)::text AS n FROM account
      UNION ALL SELECT 'currency', count(*)::text FROM currency
      UNION ALL SELECT 'ledger_entry', count(*)::text FROM ledger_entry
      UNION ALL SELECT 'ledger_owner', count(*)::text FROM ledger_owner
      UNION ALL SELECT 'schema_migration', count(*)::text FROM schema_migration
      UNION ALL SELECT '"user"', count(*)::text FROM "user" ORDER BY 1`);
    out.ledger_functions = await raw(p, `
      SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname LIKE 'ledger%' ORDER BY 1, 2`);
    out.server_settings = await raw(p, `
      SELECT name, setting, unit FROM pg_settings
       WHERE name IN ('lock_timeout','statement_timeout','deadlock_timeout','default_transaction_isolation',
                      'server_version','max_connections') ORDER BY name`);

    out.section11 = await judgementRows(p);
    out.entry_count = await entryCount(p);
    out.deadlocks_cumulative = await deadlocks(p);
    out.test_accounts = await raw(p, `
      SELECT uid, cid, balance, frozen FROM account WHERE uid >= 900000 ORDER BY uid, cid`);
    out.currencies = await raw(p, `
      SELECT cid, symbol, owner_uid, decimals, total_supply, supply_cap, status
        FROM currency ORDER BY cid`);
    out.locks_now = await raw(p, `
      SELECT count(*)::text AS n FROM pg_locks WHERE NOT granted`);
  });

  console.log(JSON.stringify(out, null, 1));
})().catch((e) => { console.error('PROBE FAILED:', (e as Error)?.stack ?? e); process.exit(1); });
