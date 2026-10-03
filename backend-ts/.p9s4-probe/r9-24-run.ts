/**
 * P9④ · `R-9-24` 迁移真跑自证（Kong · 探针不落 scripts/ 扫面根）
 * ---------------------------------------------------------------------------
 * 对 0032 / 0033 / 0034 **各自**：单事务内 `BEGIN; <文件全文>; <读四项读数>; ROLLBACK;`（**禁 COMMIT**）。
 * 四项读数（逐文件）：
 *   ① 无错（文件全文在事务内执行成功）
 *   ② 回滚后 `to_regclass`/对象面复原（本批零新关系；另给「目标对象复原」= 指纹 after==before）
 *   ③ `schema_migration` 无新行（count before==after；本探针**从不** INSERT 版本行）
 *   ④ 目标对象复原（after==before）＋ 事务内生效（inside!=before，证明确真跑）
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s4-probe/r9-24-run.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';
import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config();
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const MIG = path.resolve(__dirname, '..', 'migrations');
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const OUT_DIR = path.resolve(__dirname, '..', '.p9s4-artifacts');
const sha = (v: unknown) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 16);

const txUrl = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';

const FILES = [
  '0032_kind_close_set_23.sql',
  '0033_currency_platform_coin_flag.sql',
  '0034_ledger_op_burn_and_supply.sql',
];

const fingerprintSql: Array<[string, string]> = [
  ['kindEnum', `SELECT COALESCE(pg_get_constraintdef(oid),'') AS v FROM pg_constraint WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`],
  ['kindOk', `SELECT COALESCE(prosrc,'') AS v FROM pg_proc WHERE proname='ledger_kind_ok' AND pronamespace='public'::regnamespace`],
  ['platformMutation', `SELECT COALESCE(prosrc,'') AS v FROM pg_proc WHERE proname='ledger_assert_platform_mutation' AND pronamespace='public'::regnamespace`],
  ['ledgerPostEvent', `SELECT COALESCE(prosrc,'') AS v FROM pg_proc WHERE proname='ledger_post_event' AND pronamespace='public'::regnamespace AND pg_get_function_identity_arguments(oid)='payload jsonb'`],
  ['platformCol', `SELECT COALESCE(data_type||'|'||is_nullable||'|'||COALESCE(column_default,'-'),'<ABSENT>') AS v FROM information_schema.columns WHERE table_schema='public' AND table_name='currency' AND column_name='is_platform_coin'`],
  ['currencyConstraints', `SELECT COALESCE(string_agg(conname||':'||contype::text, ',' ORDER BY conname),'') AS v FROM pg_constraint WHERE conrelid='public.currency'::regclass`],
  ['schemaMigration', `SELECT COALESCE(count(*)::text||'|'||COALESCE(max(version),'-'),'-') AS v FROM public.schema_migration`],
];

(async () => {
  if (!txUrl) throw new Error('missing DATABASE_URL');
  const pool = new Pool({ connectionString: txUrl, max: 1 });
  const client = await pool.connect();
  const results: Array<Record<string, unknown>> = [];
  try {
    const readFp = async (): Promise<Record<string, string>> => {
      const out: Record<string, string> = {};
      for (const [k, sql] of fingerprintSql) {
        const r = await client.query(sql);
        out[k] = sha((r.rows[0]?.v ?? '') as string);
      }
      // 关系面（to_regclass 抽查：本批零新关系）
      const rel = await client.query(`SELECT
        to_regclass('public.battc_probe_shadow') IS NULL AS a,
        to_regclass('public.currency') IS NOT NULL AS currency_present,
        to_regclass('public.batt_account') IS NOT NULL AS batt_present`);
      out.relShadowNull = sha(JSON.stringify(rel.rows[0]));
      return out;
    };

    for (const f of FILES) {
      const sql = fs.readFileSync(path.join(MIG, f), 'utf8');
      const before = await readFp();
      let noError = false, errMsg: string | null = null, inside: Record<string, string> | null = null;
      await client.query('BEGIN');
      try {
        await client.query(sql);
        noError = true;
        inside = await readFp();
      } catch (e) {
        errMsg = String((e as Error)?.message || e).slice(0, 300);
      } finally {
        await client.query('ROLLBACK');
      }
      const after = await readFp();

      const changedInside: string[] = [];
      const restoredAfter: string[] = [];
      for (const k of Object.keys(before)) {
        if (inside && inside[k] !== before[k]) changedInside.push(k);
        restoredAfter.push(after[k] === before[k] ? `${k}:OK` : `${k}:DIFF`);
      }
      const allRestored = Object.values(restoredAfter).every((s) => s.endsWith(':OK'));
      const row: Record<string, unknown> = {
        file: f,
        bytes: sql.length,
        sha256: crypto.createHash('sha256').update(sql, 'utf8').digest('hex'),
        r1_no_error: noError,
        r1_error: errMsg,
        r2a_rel_shadow_null: after.relShadowNull === before.relShadowNull,
        r2b_inside_effect_keys: changedInside,
        r3_schema_migration_unchanged: after.schemaMigration === before.schemaMigration,
        r4_target_objects_restored: allRestored,
        r4_detail: restoredAfter,
        inside_moved: changedInside.length > 0,
      };
      results.push(row);
    }

    const out = { run: RUN, script: '.p9s4-probe/r9-24-run.ts', discipline: 'BEGIN;<file>;read;ROLLBACK (no COMMIT)', results };
    fs.mkdirSync(OUT_DIR, { recursive: true });
    const p = path.join(OUT_DIR, `r9-24-${RUN}.json`);
    fs.writeFileSync(p, JSON.stringify(out, null, 2));
    console.log(JSON.stringify({ saved: p, results }, null, 1));
  } finally {
    client.release();
    await pool.end().catch(() => undefined);
  }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
