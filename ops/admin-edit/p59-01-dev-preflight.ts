// 只读 preflight：dev 库现取（项目 id 自证 / schema_migration 顶 / listing_edit_log 是否已建 / listing 列）
import * as path from 'path';
import { mkPool, raw1, raw } from '../../backend-ts/scripts/p7b-lib';
(async () => {
  const pool = mkPool(1);
  const c = await pool.connect();
  try {
    const who = await raw1(c as never, "SELECT current_setting('neon.project_id', true) AS project, current_setting('neon.branch_id', true) AS branch");
    const top = await raw1(c as never, 'SELECT version, name FROM schema_migration ORDER BY version DESC LIMIT 1');
    const n = await raw1(c as never, 'SELECT count(*)::int AS n FROM schema_migration');
    const t = await raw1(c as never, "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='listing_edit_log'");
    const cols = await raw(c as never, `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('title','description','item_type','item_condition','price','stock') ORDER BY column_name`);
    console.log(JSON.stringify({ who, top, migrations: n?.n, edit_log_exists: Number(t?.n) === 1, listing_cols: cols }, null, 1));
  } finally { c.release(); await pool.end(); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
