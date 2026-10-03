// P9② 极小修复单 · R-9-24 真跑自证（不 apply / 不 COMMIT）
// 手法与 backend-ts/scripts/migrate.ts 同款 Pool（@neondatabase/serverless + ws）。
// 对 0028 / 0029 各自单独：BEGIN; <文件全文>; (读事务内态); ROLLBACK;  —— 禁 COMMIT。
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const MIG_DIR = path.resolve(__dirname, '..', 'migrations');
const txUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';

const BASELINE_Q = {
  sm_rows: `select count(*)::int as n from public.schema_migration`,
  sm_max: `select max(version) as v from public.schema_migration`,
  sm_has_new: `select count(*)::int as n from public.schema_migration where version in ('0028','0029')`,
  kind_def: `select pg_get_constraintdef(oid) as d from pg_constraint where conrelid='public.ledger_entry'::regclass and conname='ledger_kind_enum' and contype='c'`,
  kind_ok_src: `select prosrc as s, length(prosrc)::int as n from pg_proc where proname='ledger_kind_ok' and pronargs=2`,
  plat_src: `select prosrc as s, length(prosrc)::int as n from pg_proc where proname='ledger_assert_platform_mutation'`,
  regclass: `select to_regclass('public.batt_account')::text a, to_regclass('public.batt_entry')::text b, to_regclass('public.checkin_log')::text c, to_regclass('public.checkin_makeup_log')::text d`,
  regproc: `select to_regprocedure('public.batt_account_touch_updated()')::text a, to_regprocedure('public.batt_entry_append_only()')::text b, to_regprocedure('public.checkin_log_append_only()')::text c, to_regprocedure('public.checkin_makeup_log_append_only()')::text d`,
  batt_triggers: `select count(*)::int as n from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal and c.relname in ('batt_account','batt_entry','checkin_log','checkin_makeup_log')`,
};

(async () => {
  if (!txUrl) throw new Error('缺少 DATABASE_URL_UNPOOLED / DATABASE_URL');
  const pool = new Pool({ connectionString: txUrl, max: 2 });
  const client = await pool.connect();
  const out: Record<string, unknown> = {};

  const one = async (q: string) => (await client.query(q)).rows[0];
  const snap = async () => {
    const r: Record<string, any> = {};
    for (const [k, q] of Object.entries(BASELINE_Q)) r[k] = await one(q);
    return r;
  };

  try {
    out.baseline = await snap();

    for (const ver of ['0028', '0029'] as const) {
      const fname = fs.readdirSync(MIG_DIR).find((f) => f.startsWith(ver) && f.endsWith('.sql'))!;
      const file = path.join(MIG_DIR, fname);
      const sql = fs.readFileSync(file, 'utf8');
      const res: Record<string, any> = { file: fname, bytes: Buffer.byteLength(sql), began: false, file_ok: false };

      await client.query('BEGIN');
      res.began = true;
      try {
        await client.query(sql);
        res.file_ok = true;
        // 事务内态（证明文件已把对象建成/改到位；仍不提交）
        const inTx: Record<string, any> = { regclass: await one(BASELINE_Q.regclass), batt_triggers: (await one(BASELINE_Q.batt_triggers)).n };
        inTx.kind_def = (await one(BASELINE_Q.kind_def)).d;
        inTx.kind_ok_src = await one(BASELINE_Q.kind_ok_src);
        res.in_tx = inTx;
      } catch (e: any) {
        res.error_message = String(e?.message || e).slice(0, 400);
        res.error_code = e?.code ?? null;
      } finally {
        await client.query('ROLLBACK'); // ★ 禁 COMMIT
        res.rolled_back = true;
      }

      // 回滚后读数（四项中的 b/c/d）
      const post: Record<string, any> = {};
      for (const [k, q] of Object.entries(BASELINE_Q)) post[k] = await one(q);
      res.post = post;

      const base = out.baseline as Record<string, any>;
      res.restored = {
        kind_def_identical: post.kind_def.d === base.kind_def.d,
        kind_ok_src_identical: post.kind_ok_src.s === base.kind_ok_src.s && post.kind_ok_src.n === base.kind_ok_src.n,
        plat_src_identical: post.plat_src.s === base.plat_src.s,
      };
      res.schema_migration_unchanged = post.sm_rows.n === base.sm_rows.n
        && post.sm_max.v === base.sm_max.v
        && post.sm_has_new.n === 0;
      res.to_regclass_all_null = ['a', 'b', 'c', 'd'].every((x) => post.regclass[x] === null);
      res.to_regprocedure_all_null = ['a', 'b', 'c', 'd'].every((x) => post.regproc[x] === null);
      res.batt_triggers_after = post.batt_triggers.n;
      out[ver] = res;
    }
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})().catch((e) => { console.error('REALRUN_FATAL', String(e?.message || e).slice(0, 300)); process.exit(2); });
