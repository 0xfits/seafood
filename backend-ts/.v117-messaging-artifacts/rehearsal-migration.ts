/**
 * v117 迁移预演（A5 收口 · 0045/0046）—— 事务内 apply 全链 + 末尾 ROLLBACK（净写 0）。
 * 读数：DDL 全落 · 45 行/0046（模拟版本行）· 触发器/函数/索引/FK 逐项在场 ·
 *       0001–0044 checksum 与 schema_migration 逐行相等（一字不动）· 回滚后零残留。
 * 用法：cd backend-ts && npx ts-node --transpile-only .v117-messaging-artifacts/rehearsal-migration.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const MIG_DIR = path.resolve(__dirname, '..', 'migrations');
const results: Record<string, unknown> = {};
const fails: string[] = [];
const ok = (id: string, pass: boolean, detail: unknown) => {
  results[id] = { pass, detail };
  if (!pass) fails.push(id);
};

(async () => {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
  if (!url) throw new Error('no database url');
  const pool = new Pool({ connectionString: url, max: 1 });
  const client = await pool.connect();

  try {
    // ---- ① 0001–0044 checksum 一字不动（文件 sha256 vs schema_migration.checksum 逐行相等）
    const applied = (await client.query(`SELECT version, name, checksum FROM public.schema_migration ORDER BY version`)).rows;
    const before = { rows: applied.length, max: applied[applied.length - 1]?.version ?? null };
    results.baseline = before;
    let checksumDrift: string[] = [];
    for (const row of applied) {
      const file = path.join(MIG_DIR, String(row.name));
      if (!fs.existsSync(file)) { checksumDrift.push(`${row.version}:file-missing`); continue; }
      const sha = crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8'), 'utf8').digest('hex');
      if (sha !== row.checksum) checksumDrift.push(String(row.version));
    }
    ok('S1_checksum_0001_0044_unchanged', before.rows === 43 && before.max === '0044' && checksumDrift.length === 0,
      { baseline: before, drift: checksumDrift, file_count_0044era: fs.readdirSync(MIG_DIR).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f <= '0044').length });

    // ---- ② 事务内 apply 0045 + 0046
    await client.query('BEGIN');
    let applyErr: string | null = null;
    try {
      await client.query(fs.readFileSync(path.join(MIG_DIR, '0045_message_conversation.sql'), 'utf8'));
      await client.query(fs.readFileSync(path.join(MIG_DIR, '0046_telegram_binding.sql'), 'utf8'));
      // 模拟 migrate.ts 的版本行落库（仅本事务内，末尾回滚）
      for (const [v, name] of [['0045', '0045_message_conversation.sql'], ['0046', '0046_telegram_binding.sql']] as const) {
        const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(MIG_DIR, name), 'utf8'), 'utf8').digest('hex');
        await client.query(`INSERT INTO public.schema_migration (version, name, checksum) VALUES ($1, $2, $3)`, [v, name, sha]);
      }
    } catch (e) {
      applyErr = String((e as { message?: string }).message ?? e);
    }
    ok('S2_apply_in_tx_no_error', applyErr === null, { applyErr });

    if (applyErr === null) {
      const sm = (await client.query(`SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`)).rows[0];
      ok('S3_schema_migration_45_0046', Number(sm.n) === 45 && String(sm.mx) === '0046', sm);

      // ---- ③ DDL 全落逐项在场
      const tbl = (await client.query(`SELECT string_agg(table_name, ',' ORDER BY table_name) AS t FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('conversation','message')`)).rows[0].t;
      ok('S4_tables_present', tbl === 'conversation,message', { tables: tbl });

      const trg = (await client.query(`
        SELECT tg.tgname, tg.tgenabled, tg.tgtype::int AS tgtype, p.proname AS fn, c.relname AS tbl
          FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          LEFT JOIN pg_proc p ON p.oid = tg.tgfoid
         WHERE n.nspname='public' AND NOT tg.tgisinternal AND tg.tgname LIKE 'trg_%' AND tg.tgname NOT LIKE '%_append_only%'
           AND c.relname IN ('conversation','message') ORDER BY tg.tgname`)).rows;
      const wantTrg: Record<string, { tgenabled: string; tgtype: number; fn: string }> = {
        trg_conversation_no_delete: { tgenabled: 'O', tgtype: 11, fn: 'conversation_no_delete' },          // ROW(1)+BEFORE(2)+DELETE(8)=11
        trg_conversation_read_mark_only: { tgenabled: 'O', tgtype: 19, fn: 'conversation_read_mark_only' },// ROW(1)+BEFORE(2)+UPDATE(16)=19
        trg_conversation_no_truncate: { tgenabled: 'O', tgtype: 34, fn: 'conversation_no_truncate' },      // BEFORE(2)+TRUNCATE(32)=34
        trg_message_no_update_or_delete: { tgenabled: 'O', tgtype: 27, fn: 'message_no_update_or_delete' },// BEFORE(2)+UPDATE(1)+DELETE(4)+ROW(16)? 0043 §35.2: 27
        trg_message_no_truncate: { tgenabled: 'O', tgtype: 34, fn: 'message_no_truncate' },
      };
      const trgDetail: Record<string, unknown> = {};
      let trgOk = trg.length === 5;
      for (const row of trg) {
        trgDetail[row.tgname] = { tgenabled: row.tgenabled, tgtype: row.tgtype, fn: row.fn, tbl: row.tbl };
        const want = wantTrg[row.tgname];
        if (!want || row.tgenabled !== want.tgenabled || row.fn !== want.fn) trgOk = false;
        // tgtype：TRUNCATE 闸必须含 32；UPDATE/DELETE 闸必须 27（0043 §35.2 判据）
        if (row.tgname.endsWith('no_truncate') && (row.tgtype & 32) !== 32) trgOk = false;
        if (row.tgname.endsWith('no_update_or_delete') && row.tgtype !== 27) trgOk = false;
      }
      ok('S5_triggers_5_present', trgOk && trg.length === 5, { count: trg.length, detail: trgDetail });

      const fns = (await client.query(`
        SELECT string_agg(p.proname, ',' ORDER BY p.proname) AS f FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
         WHERE n.nspname='public' AND p.proname IN ('conversation_no_delete','conversation_read_mark_only','conversation_no_truncate','message_no_update_or_delete','message_no_truncate')`)).rows[0].f;
      ok('S6_functions_5_present', String(fns).split(',').length === 5, { functions: fns });

      const idx = (await client.query(`
        SELECT string_agg(indexname, ',' ORDER BY indexname) AS i FROM pg_indexes
         WHERE schemaname='public' AND indexname IN ('idx_conversation_buyer','idx_conversation_seller','idx_message_conversation','idx_message_from_day')`)).rows[0].i;
      ok('S7_indexes_4_present', String(idx).split(',').length === 4, { indexes: idx });

      const fk = (await client.query(`
        SELECT string_agg(con.conname, ',' ORDER BY con.conname) AS f FROM pg_constraint con
         JOIN pg_class c ON c.oid = con.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname='public' AND con.contype='f'
          AND con.conname IN ('conversation_listing_fk','conversation_buyer_fk','conversation_seller_fk','message_conversation_fk','message_from_fk')`)).rows[0].f;
      ok('S8_fks_5_present', String(fk).split(',').length === 5, { fks: fk });

      const cols = (await client.query(`
        SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name='users' AND column_name LIKE 'tg\\_%' ORDER BY column_name`)).rows;
      ok('S9_users_tg_columns_2', cols.length === 2 && cols.every((c: any) => c.is_nullable === 'YES')
        && cols.some((c: any) => c.column_name === 'tg_user_id' && c.data_type === 'bigint')
        && cols.some((c: any) => c.column_name === 'tg_linked_at' && c.data_type === 'timestamp with time zone'), cols);

      const pui = (await client.query(`
        SELECT indexname FROM pg_indexes
         WHERE schemaname='public' AND indexname='idx_users_tg_user_id'`)).rows;
      const puiDef = (await client.query(`SELECT pg_get_indexdef('idx_users_tg_user_id'::regclass) AS def`)).rows[0].def;
      ok('S10_partial_unique_index', pui.length === 1 && /UNIQUE.*tg_user_id.*WHERE.*IS NOT NULL|UNIQUE.*WHERE \(tg_user_id IS NOT NULL\)/.test(puiDef), { def: puiDef });

      // 隐私红线反向断言（A5-DL-P1）：users 上不得出现白名单外的 tg_* 列
      const bad = cols.filter((c: any) => !['tg_user_id', 'tg_linked_at'].includes(c.column_name));
      ok('S11_privacy_no_public_tg_columns', bad.length === 0, { bad });

      // code 不入库（A5-DL-P4）：不得出现任何 code 存储表/键
      const codeTables = (await client.query(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND (table_name LIKE '%bind_code%' OR table_name LIKE '%tg_code%')`)).rows[0].n;
      ok('S12_no_code_storage', Number(codeTables) === 0, { codeTables });
    }

    // ---- ④ 事务内负对照（会话不可删闸 / 受限更新闸）
    if (applyErr === null) {
      const probe = async (label: string, sql: string): Promise<string> => {
        try { await client.query(sql); return 'NO_GUARD'; }
        catch (e) { return String((e as { code?: string }).code ?? 'ERR'); }
      };
      // 先造一行会话（事务内，回滚清零）· buyer ≠ seller（§38.2 CHECK conversation_parties_distinct）
      const buyer = (await client.query(`INSERT INTO public.users (evm) VALUES ('0x' || repeat('a', 40)) RETURNING uid`)).rows[0].uid;
      const seller = (await client.query(`INSERT INTO public.users (evm) VALUES ('0x' || repeat('b', 40)) RETURNING uid`)).rows[0].uid;
      const l = (await client.query(`INSERT INTO public.listing (seller_uid, cid, price, stock, title, create_key, status) VALUES ($1, (SELECT min(cid) FROM public.currency), 1, 1, 'v117-rehearsal', 'cli:v117-rehearsal-listing', 'listed') RETURNING listing_id`, [seller])).rows[0].listing_id;
      const conv = (await client.query(`INSERT INTO public.conversation (listing_id, buyer_uid, seller_uid, create_key) VALUES ($1, $2, $3, $4)`, [l, buyer, seller, `open:${l}:${buyer}`]));
      void conv;
      ok('S13_conversation_insert_ok', true, { listing: l });
      const del = await probe('delete', `DELETE FROM public.conversation WHERE listing_id = ${l}`);
      ok('S14_conversation_delete_blocked', del !== 'NO_GUARD', { sqlstate: del });
      const badUpd = await probe('bad-update', `UPDATE public.conversation SET create_key = 'x' WHERE listing_id = ${l}`);
      ok('S15_conversation_restricted_update_blocked', badUpd !== 'NO_GUARD', { sqlstate: badUpd });
      const truncMsg = await probe('truncate-msg', `TRUNCATE public.message`);
      ok('S16_message_truncate_blocked', truncMsg !== 'NO_GUARD', { sqlstate: truncMsg });
      const updMsg = await probe('update-msg', `UPDATE public.message SET body = 'x'`);
      ok('S17_message_update_blocked', updMsg !== 'NO_GUARD', { sqlstate: updMsg });
    }

    // ---- ⑤ 回滚 + 残留核验
    await client.query('ROLLBACK');
    const after = (await client.query(`SELECT count(*)::int AS n, max(version) AS mx FROM public.schema_migration`)).rows[0];
    ok('S18_rollback_schema_migration_43_0044', Number(after.n) === 43 && String(after.mx) === '0044', after);
    const leftover = (await client.query(`
      SELECT (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('conversation','message')) AS tables,
             (SELECT count(*)::int FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name LIKE 'tg\\_%') AS tg_cols,
             (SELECT count(*)::int FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('conversation_no_delete','message_no_truncate')) AS fns`)).rows[0];
    ok('S19_rollback_zero_residue', Number(leftover.tables) === 0 && Number(leftover.tg_cols) === 0 && Number(leftover.fns) === 0, leftover);

    console.log(JSON.stringify({ gate: 'v117-migration-rehearsal', results, fails }, null, 2));
    process.exitCode = fails.length === 0 ? 0 : 1;
  } finally {
    client.release();
    await pool.end();
  }
})().catch((e) => { console.error('REHEARSAL FATAL:', e); process.exit(2); });
