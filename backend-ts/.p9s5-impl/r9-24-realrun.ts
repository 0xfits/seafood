/**
 * P9⑤ 实现第一步 · 三迁移「单事务内真跑 + ROLLBACK」四项读数探针（R-9-24）。
 * 探针落 .p9s5-impl/（不入 scripts/ 扫面根）。
 *
 * 每份迁移 0035 / 0036 / 0037：
 *   ① 无错（事务内整文件执行无错）；
 *   ② 回滚后新对象不在（结构指纹回退 / 无新行 / 无新分支）；
 *   ③ `schema_migration` 无新行（行数 + max(version) 不变）；
 *   ④ 目标对象复原（迁移前快照 ≡ 回滚后快照，逐字）。
 * 写库一律事务内 + 末尾 ROLLBACK（禁 COMMIT）；不 apply。
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery, withTransaction, closePools, TxClient } from '../src/db';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const ROOT = path.resolve(__dirname, '..'); // backend-ts
const OUT = path.resolve(__dirname, '..', '.p9s5-impl');
fs.mkdirSync(OUT, { recursive: true });

type Snap = {
  fee_rng_def: string;
  policy_rows: string;
  policy_count: number;
  conservation_md5: string;
  conservation_src_len: number;
  post_event_md5: string;
  post_event_len: number;
  conservation_trigger: string;
  schema_migration_rows: number;
  schema_migration_max: string | null;
  base_tables: number;
};

const Q = {
  fee_rng: `SELECT COALESCE(min(pg_get_constraintdef(oid)),'') AS d FROM pg_constraint
             WHERE conrelid='public.commission_policy'::regclass AND conname='commission_policy_fee_rate_rng'`,
  policy_rows: `SELECT COALESCE(string_agg(policy_id::text||'|'||fee_rate_bp::text||'|'||levels::text||'|'||
              weights_bp::text||'|'||effective_from::text||'|'||created_by::text, ',' ORDER BY effective_from), '') AS d
              FROM public.commission_policy`,
  policy_count: `SELECT count(*)::int AS n FROM public.commission_policy`,
  conservation: `SELECT COALESCE(md5(p.prosrc),'') AS md5, COALESCE(length(p.prosrc),0)::int AS len
                 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.proname='ledger_assert_commission_conservation'`,
  post_event: `SELECT COALESCE(md5(p.prosrc),'') AS md5, COALESCE(length(p.prosrc),0)::int AS len
                 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                WHERE n.nspname='public' AND p.proname='ledger_post_event'
                  AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`,
  cons_trigger: `SELECT COALESCE(string_agg(tgenabled::text||'/'||tgdeferrable::text||'/'||tginitdeferred::text||'/'||(tgconstraint<>0)::text, ','), '') AS d
                 FROM pg_trigger WHERE tgrelid='public.ledger_entry'::regclass AND NOT tgisinternal
                  AND tgname='trg_ledger_entry_commission_conservation'`,
  mig: `SELECT count(*)::int AS n, max(version) AS v FROM schema_migration`,
  tables: `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`,
};

const snap = async (q: <T>(s: string) => Promise<T[]>): Promise<Snap> => {
  const fee = await q<{ d: string }>(Q.fee_rng);
  const pr = await q<{ d: string }>(Q.policy_rows);
  const pc = await q<{ n: number }>(Q.policy_count);
  const cs = await q<{ md5: string; len: number }>(Q.conservation);
  const pe = await q<{ md5: string; len: number }>(Q.post_event);
  const ct = await q<{ d: string }>(Q.cons_trigger);
  const m = (await q<{ n: number; v: string | null }>(Q.mig))[0];
  const tb = await q<{ n: number }>(Q.tables);
  return {
    fee_rng_def: fee[0]?.d ?? '',
    policy_rows: pr[0]?.d ?? '',
    policy_count: Number(pc[0]?.n ?? -1),
    conservation_md5: cs[0]?.md5 ?? '',
    conservation_src_len: Number(cs[0]?.len ?? -1),
    post_event_md5: pe[0]?.md5 ?? '',
    post_event_len: Number(pe[0]?.len ?? -1),
    conservation_trigger: ct[0]?.d ?? '',
    schema_migration_rows: Number(m?.n ?? -1),
    schema_migration_max: m?.v ?? null,
    base_tables: Number(tb[0]?.n ?? -1),
  };
};

type Mig = { v: string; file: string; touched: string[]; prereqs: string[]; newAbsent: (after: Snap) => boolean; };
const MIGS: Mig[] = [
  {
    v: '0035', file: 'migrations/0035_fee_rate_range_extend.sql',
    touched: ['commission_policy.commission_policy_fee_rate_rng CHECK 域 100..500 -> 100..10000'],
    prereqs: [],
    newAbsent: (a) => !a.fee_rng_def.includes('10000') && a.fee_rng_def.includes('500'),
  },
  {
    v: '0036', file: 'migrations/0036_commission_policy_p9_5.sql',
    touched: ['commission_policy 新政策行（fee_rate_bp=1000/levels=6）'],
    // ★ 0036 的准入前提 = 0035（fee_rate_bp=1000 ∉ 原域 100..500）⇒ 真跑须先跑 0035（同事务；否则 23514）。
    prereqs: ['migrations/0035_fee_rate_range_extend.sql'],
    newAbsent: (a) => a.policy_count === 3 && !a.policy_rows.includes('|1000|6|') && !a.fee_rng_def.includes('10000'),
  },
  {
    v: '0037', file: 'migrations/0037_commission_conservation_m0.sql',
    touched: ['public.ledger_assert_commission_conservation() 函数体（加 M=0 豁免分支）'],
    prereqs: [],
    newAbsent: (a) => a.conservation_md5 === '27ddc76b842594cb6ee8673c171e6526',
  },
];

(async () => {
  const readQ = <T>(s: string): Promise<T[]> => readQuery<T>(s);
  const results: Record<string, unknown>[] = [];

  for (const m of MIGS) {
    const sql = fs.readFileSync(path.resolve(ROOT, m.file), 'utf8');
    const prereqSql = m.prereqs.map((p) => ({ file: p, sql: fs.readFileSync(path.resolve(ROOT, p), 'utf8') }));
    const before = await snap(readQ);
    let execErr: string | null = null;
    const inTx: Record<string, unknown> = {};
    const SENT = 'P9S5_MIG_ROLLBACK';
    try {
      await withTransaction(async (tx: TxClient) => {
        const q = <T>(s: string) => tx.query<T>(s).then((r) => r.rows);
        for (const p of prereqSql) await tx.query(p.sql);  // 先跑准入前提（同事务，末尾一并回滚）
        await tx.query(sql);                 // 整文件在单事务内执行（真跑）
        const post = await snap(q);          // 事务内迁移后态
        inTx.post_fee_rng_def = post.fee_rng_def;
        inTx.post_policy_count = post.policy_count;
        inTx.post_conservation_md5 = post.conservation_md5;
        inTx.post_conservation_has_m0 = false; // 下面用 prosrc 判（读 src 而非 md5）
        const src = await q<{ s: string }>(
          `SELECT COALESCE(p.prosrc,'') AS s FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
            WHERE n.nspname='public' AND p.proname='ledger_assert_commission_conservation'`);
        inTx.post_conservation_has_m0 = (src[0]?.s ?? '').includes('p9s5_m0_exemption');
        inTx.post_fee_rng_has_10000 = post.fee_rng_def.includes('10000');
        throw new Error(SENT);
      });
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      if (msg !== SENT) execErr = (e as { code?: string }).code ? `${(e as { code?: string }).code}:${msg.slice(0, 160)}` : msg.slice(0, 200);
    }
    const after = await snap(readQ);

    const restored =
      after.fee_rng_def === before.fee_rng_def
      && after.policy_rows === before.policy_rows
      && after.policy_count === before.policy_count
      && after.conservation_md5 === before.conservation_md5
      && after.conservation_src_len === before.conservation_src_len
      && after.post_event_md5 === before.post_event_md5
      && after.post_event_len === before.post_event_len
      && after.conservation_trigger === before.conservation_trigger;

    results.push({
      version: m.v, file: m.file, touched: m.touched,
      reads: {
        '1_no_error': execErr === null,
        exec_err: execErr,
        '2_new_object_absent_after_rollback': m.newAbsent(after),
        '3_schema_migration_no_new_row':
          after.schema_migration_rows === before.schema_migration_rows
          && after.schema_migration_max === before.schema_migration_max,
        schema_migration_rows_before: before.schema_migration_rows,
        schema_migration_rows_after: after.schema_migration_rows,
        schema_migration_max_before: before.schema_migration_max,
        schema_migration_max_after: after.schema_migration_max,
        '4_target_object_restored': restored,
        new_relations_added: after.base_tables - before.base_tables,
      },
      in_tx_post_state: inTx,
      pre: {
        fee_rng_def: before.fee_rng_def, policy_count: before.policy_count,
        policy_rows: before.policy_rows,
        conservation_md5: before.conservation_md5, conservation_src_len: before.conservation_src_len,
        post_event_md5: before.post_event_md5, post_event_len: before.post_event_len,
        conservation_trigger: before.conservation_trigger,
      },
      post_rollback: {
        fee_rng_def: after.fee_rng_def, policy_count: after.policy_count,
        conservation_md5: after.conservation_md5, conservation_src_len: after.conservation_src_len,
        post_event_md5: after.post_event_md5, post_event_len: after.post_event_len,
        conservation_trigger: after.conservation_trigger,
      },
    });
    const r = results[results.length - 1].reads as Record<string, boolean>;
    console.log(`MIG ${m.v} no_error=${r['1_no_error']} new_obj_absent=${r['2_new_object_absent_after_rollback']} mig_rows_same=${r['3_schema_migration_no_new_row']} restored=${r['4_target_object_restored']} in_tx=${JSON.stringify(inTx)}`);
  }

  const body = { unit: 'P9S5-MIG-RUN-ROLLBACK', generated_at: new Date().toISOString(), run: RUN, results };
  fs.writeFileSync(path.join(OUT, `r9-24-${RUN}.json`), JSON.stringify(body, null, 1) + '\n', 'utf8');
  console.log('ARTIFACT', path.join(OUT, `r9-24-${RUN}.json`));
  await closePools();
  const allOk = results.every((x) => {
    const r = x.reads as Record<string, boolean>;
    return r['1_no_error'] && r['2_new_object_absent_after_rollback'] && r['3_schema_migration_no_new_row'] && r['4_target_object_restored'];
  });
  process.exit(allOk ? 0 : 1);
})().catch(async (e) => { console.error('FATAL', String((e as Error)?.stack || e).slice(0, 500)); await closePools().catch(() => undefined); process.exit(2); });
