/**
 * P9④ 三迁移「单事务内真跑 + ROLLBACK」四项读数探针。
 * 每份迁移：① 无错（事务内整文件执行无错）；② 回滚后新对象不在（结构指纹回退 / 无新关系）；
 *            ③ `schema_migration` 无新行（行数 + max(version) 不变）；④ 目标对象复原（迁移前 ≡ 回滚后逐字）。
 * 写库一律事务内 + 末尾 ROLLBACK（禁 COMMIT）；不 apply。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ROOT = path.resolve(__dirname, '..'); // backend-ts
const OUT = path.resolve(__dirname, '..', '.p9s4-artifacts');
fs.mkdirSync(OUT, { recursive: true });

type Snap = {
  kind_enum: string; kind_ok: string; assert_platform: string; post_event: string;
  is_platform_coin_cols: number; schema_migration_rows: number; schema_migration_max: string | null;
  base_tables: number;
};

const Q = {
  kind_enum: `SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conname='ledger_kind_enum'`,
  kind_ok: `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p WHERE p.proname='ledger_kind_ok' LIMIT 1`,
  assert_platform: `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p WHERE p.proname='ledger_assert_platform_mutation' LIMIT 1`,
  post_event: `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p WHERE p.proname='ledger_post_event' AND pg_get_function_identity_arguments(oid)='payload jsonb' LIMIT 1`,
  col: `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='currency' AND column_name='is_platform_coin'`,
  mig: `SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`,
  tables: `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
};

const snap = async (q: <T>(s: string) => Promise<T[]>): Promise<Snap> => {
  const kind_enum = (await q<{ d: string }>(Q.kind_enum))[0]?.d ?? '';
  const kind_ok = (await q<{ d: string }>(Q.kind_ok))[0]?.d ?? '';
  const assert_platform = (await q<{ d: string }>(Q.assert_platform))[0]?.d ?? '';
  const post_event = (await q<{ d: string }>(Q.post_event))[0]?.d ?? '';
  const is_platform_coin_cols = Number((await q<{ n: number }>(Q.col))[0]?.n ?? -1);
  const m = (await q<{ n: number; v: string | null }>(Q.mig))[0];
  const base_tables = Number((await q<{ n: number }>(Q.tables))[0]?.n ?? -1);
  return { kind_enum, kind_ok, assert_platform, post_event, is_platform_coin_cols, schema_migration_rows: Number(m?.n ?? -1), schema_migration_max: m?.v ?? null, base_tables };
};

const kindsOf = (def: string): string[] => (def.match(/'([a-z_]+)'/g) || []).map((s) => s.slice(1, -1));
const opWhitelistHasBurn = (def: string): boolean => {
  const m = def.match(/v_op NOT IN\s*\(([^)]*)\)/);
  return m !== null && /'burn'/.test(m[1]);
};

const MIGS = [
  { v: '0032', file: 'migrations/0032_kind_close_set_23.sql', touched: ['ledger_kind_enum 约束', 'ledger_kind_ok 函数', 'ledger_assert_platform_mutation 函数'] },
  { v: '0033', file: 'migrations/0033_currency_platform_coin_flag.sql', touched: ['currency.is_platform_coin 列'] },
  { v: '0034', file: 'migrations/0034_ledger_op_burn_and_supply.sql', touched: ['ledger_post_event 函数'] },
];

(async () => {
  const readQ = <T>(s: string): Promise<T[]> => readQuery<T>(s);
  const results: Record<string, unknown>[] = [];

  for (const m of MIGS) {
    const sql = fs.readFileSync(path.resolve(ROOT, m.file), 'utf8');
    const before = await snap(readQ);
    let execErr: string | null = null;
    const inTx: Record<string, unknown> = {};
    const SENT = 'P9S4_MIG_ROLLBACK';
    try {
      await withTransaction(async (tx: TxClient) => {
        const q = <T>(s: string) => tx.query<T>(s).then((r) => r.rows);
        await tx.query(sql);                         // 整文件在单事务内执行（真跑）
        const post = await snap(q);                  // 事务内迁移后态
        inTx.post_kind_enum_n = kindsOf(post.kind_enum).length;
        inTx.post_kind_enum_has_bttc = kindsOf(post.kind_enum).filter((k) => k.startsWith('bttc_'));
        inTx.post_kind_ok_n = kindsOf(post.kind_ok).length;
        inTx.post_op_whitelist_has_burn = opWhitelistHasBurn(post.post_event);
        inTx.post_is_platform_coin_cols = post.is_platform_coin_cols;
        throw new Error(SENT);
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 120)}` : msg.slice(0, 160);
    }
    const after = await snap(readQ);

    // ② 回滚后「新对象不在」：以结构指纹判定（三项迁移均不建关系 ⇒ to_regclass 对新关系 N/A）
    let newObjectAbsent: boolean;
    if (m.v === '0032') newObjectAbsent = kindsOf(after.kind_enum).length === 21 && /checkin_makeup_fee/.test(after.kind_enum) && !/bttc_mint_fee/.test(after.kind_enum);
    else if (m.v === '0033') newObjectAbsent = after.is_platform_coin_cols === 0;
    else newObjectAbsent = opWhitelistHasBurn(after.post_event) === false;

    // ④ 目标对象复原：迁移前快照 ≡ 回滚后快照（逐字）
    const restored =
      after.kind_enum === before.kind_enum && after.kind_ok === before.kind_ok
      && after.assert_platform === before.assert_platform && after.post_event === before.post_event
      && after.is_platform_coin_cols === before.is_platform_coin_cols;

    results.push({
      version: m.v,
      file: m.file,
      touched: m.touched,
      reads: {
        '1_no_error': execErr === null,
        exec_err: execErr,
        '2_new_object_absent_after_rollback': newObjectAbsent,
        '2_note': '三项迁移均不新建关系 ⇒ to_regclass 对新关系 N/A；判据以结构指纹承担（约束值集/列在场/op 白名单）',
        '3_schema_migration_no_new_row': after.schema_migration_rows === before.schema_migration_rows && after.schema_migration_max === before.schema_migration_max,
        schema_migration_rows_before: before.schema_migration_rows,
        schema_migration_rows_after: after.schema_migration_rows,
        schema_migration_max_before: before.schema_migration_max,
        schema_migration_max_after: after.schema_migration_max,
        '4_target_object_restored': restored,
        new_relations_added: after.base_tables - before.base_tables,
      },
      in_tx_post_state: inTx,
      pre_kind_enum_n: kindsOf(before.kind_enum).length,
      post_rollback_kind_enum_n: kindsOf(after.kind_enum).length,
      pre_is_platform_coin_cols: before.is_platform_coin_cols,
      post_rollback_is_platform_coin_cols: after.is_platform_coin_cols,
      pre_op_whitelist_has_burn: opWhitelistHasBurn(before.post_event),
      post_rollback_op_whitelist_has_burn: opWhitelistHasBurn(after.post_event),
    });
    console.log(`MIG ${m.v} no_error=${execErr === null} new_obj_absent=${newObjectAbsent} mig_rows_same=${after.schema_migration_rows === before.schema_migration_rows} restored=${restored}`);
  }

  const body = { unit: 'P9S4-MIG-RUN-ROLLBACK', generated_at: new Date().toISOString(), run: RUN, results };
  fs.writeFileSync(path.join(OUT, `mig-realrun-${RUN}.json`), JSON.stringify(body, null, 1) + '\n', 'utf8');
  console.log('ARTIFACT', path.join(OUT, `mig-realrun-${RUN}.json`));
  await closePools();
  const allOk = results.every((r) => (r.reads as Record<string, boolean>)['1_no_error'] && (r.reads as Record<string, boolean>)['2_new_object_absent_after_rollback'] && (r.reads as Record<string, boolean>)['3_schema_migration_no_new_row'] && (r.reads as Record<string, boolean>)['4_target_object_restored']);
  process.exit(allOk ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 400)); await closePools().catch(() => undefined); process.exit(2); });
