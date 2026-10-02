/**
 * BE-AUDIT-FIX2 · 幂等键不得被「拒绝」消费：`UNIQUE(key)` ⇒ `UNIQUE(key,result)`（Kong）
 * ============================================================================
 * 铁律：
 *   · **单连接** `Client({connectionString: DATABASE_URL_UNPOOLED})`；禁 Pool。
 *   · 全流程在**一个显式事务**内：BEGIN → DROP SCHEMA public CASCADE → 重放 0001..0023 →
 *     fixture → 三向实测 → **改回旧写法自证** → **一律 ROLLBACK**（**绝不 COMMIT** ⇒ 真库零位移）。
 *   · 退出码：0 全绿 / 3 判据不符 / 4 重放或连接报错（**不取自管道**）。
 *
 * 三向（AC①，逐条给 ledger/audit 行数变化 + 响应形状）：
 *   ① 同键被拒两次  ⇒ 冲突 ⇒ `DO NOTHING`（**拒绝行不放大**）
 *   ② 同键先拒后成  ⇒ `result` 不同 ⇒ **允许成功**（既有拒绝行保留）
 *   ③ 同键成功两次  ⇒ 冲突 ⇒ **拦住**（真幂等保护不弱化）
 *
 * 二次自证（AC②）：把新索引**临时改回**旧写法（`UNIQUE(idempotency_key)` + 函数 `ON CONFLICT
 *   (idempotency_key)`），跑同样三向 ⇒ **第②向必然失败（23505）**，证明改动确实承重。
 *   自证在**事务内**完成、随 ROLLBACK 消失；迁移文件本身**留在复合写法**（不改回去）。
 *
 * 用法: npx ts-node --transpile-only scripts/p4z-b6audit-02-idemkey.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const redact = (s: string) => String(s).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');
const MIG_DIR = path.join(__dirname, '..', 'migrations');
const checks: Array<{ id: string; ok: boolean | null; expect: string; actual: string; note?: string }> = [];
const t = (id: string, ok: boolean | null, expect: unknown, actual: unknown, note?: string) =>
  checks.push({ id, ok, expect: String(expect), actual: String(actual), ...(note ? { note } : {}) });

// 每向用**独立操作人**（日累计按操作人隔离，互不干扰）
const A1 = 910001, A2 = 910002, A3 = 910003;          // 复合（新）写法三向
const B1 = 910011, B2 = 910012, B3 = 910013;          // 旧写法复跑三向（自证）
const TG = 920001, TG2 = 920002;
const k = (actor: number, target: number, seq: string) => `ops:${actor}:points_adjust:${target}:1:${seq}`;

(async () => {
  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  const out: any = { unit: 'BE-AUDIT-FIX2', at: new Date().toISOString() };
  if (!URL) { console.log(JSON.stringify({ ok: false, fatal: 'no DATABASE_URL_UNPOOLED' })); process.exit(2); }
  const c = new Client({ connectionString: URL });
  let exitCode = 0;

  const one = async (sql: string, params: any[] = []): Promise<any> => (await c.query(sql, params)).rows[0];
  const callFn = async (payload: Record<string, unknown>): Promise<any> => {
    const r = await one(`SELECT public.admin_points_adjust_post_event($1::jsonb) AS r`, [JSON.stringify(payload)]);
    return r ? r.r : null;
  };
  const auditN = async (): Promise<number> => Number((await one(`SELECT count(*)::int AS n FROM public.admin_ops_audit_log`)).n);
  const ledgerN = async (): Promise<number> => Number((await one(`SELECT count(*)::int AS n FROM public.ledger_entry`)).n);
  const rowsForKey = async (key: string): Promise<any[]> =>
    (await c.query(`SELECT result, op, amount::text AS amount, balance_before::text AS bb,
                           balance_after::text AS ba, txid::text AS txid, memo
                      FROM public.admin_ops_audit_log WHERE idempotency_key=$1 ORDER BY log_id`, [key])).rows;
  const realState = async () => ({
    ledger_entry_rows: String(await ledgerN()),
    sigma_cid1: String((await one(`SELECT coalesce(sum(balance),0)::text AS s FROM public.account WHERE cid=1`)).s),
    account_rows: String((await one(`SELECT count(*)::int AS n FROM public.account`)).n),
  });
  const constraintDef = async (): Promise<string> =>
    String((await one(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint
                        WHERE conrelid='public.admin_ops_audit_log'::regclass AND conname='admin_ops_audit_log_idem_uniq'`)).d);
  /** 捕获 23505 的**纯探针**：无论成败都 ROLLBACK TO SAVEPOINT（不留副作用，保住整个事务）。 */
  const probe = async (fn: () => Promise<any>): Promise<any> => {
    const sp = 'sp_' + Math.random().toString(36).slice(2, 8);
    await c.query(`SAVEPOINT ${sp}`);
    try { const v = await fn(); await c.query(`ROLLBACK TO SAVEPOINT ${sp}`); return { ok: true, val: v }; }
    catch (e: any) { await c.query(`ROLLBACK TO SAVEPOINT ${sp}`); return { ok: false, err: { code: e && e.code, message: redact(String(e && e.message ? e.message : e)).slice(0, 200) } }; }
  };
  /** 成功即 RELEASE（**保留副作用**）、失败即 ROLLBACK TO（保住事务）。 */
  const guarded = async (fn: () => Promise<any>): Promise<any> => {
    const sp = 'sp_' + Math.random().toString(36).slice(2, 8);
    await c.query(`SAVEPOINT ${sp}`);
    try { const v = await fn(); await c.query(`RELEASE SAVEPOINT ${sp}`); return { ok: true, val: v }; }
    catch (e: any) { await c.query(`ROLLBACK TO SAVEPOINT ${sp}`); return { ok: false, err: { code: e && e.code, message: redact(String(e && e.message ? e.message : e)).slice(0, 200) } }; }
  };
  const probeDupApplied = (actor: number, target: number, key: string) =>
    c.query(`INSERT INTO public.admin_ops_audit_log
               (actor_uid, action, target_uid, cid, op, amount, request_fingerprint, idempotency_key, result)
             VALUES ($1,'points_adjust',$2,1,'mint',1000,'fp-dup',$3,'applied')`, [actor, target, key]);
  const probeNewRejected = (actor: number, target: number, key: string) =>
    c.query(`INSERT INTO public.admin_ops_audit_log
               (actor_uid, action, target_uid, cid, op, amount, request_fingerprint, idempotency_key, result, memo)
             VALUES ($1,'points_adjust',$2,1,'mint',1000,'fp-rej',$3,'rejected_daily_cap','OVER_MAX_DAILY_AMOUNT')`, [actor, target, key]);

  // ---------------------------------------------------------------- 三向公共流程
  const dir1 = async (actor: number, target: number, label: string) => {
    const key = k(actor, target, 'r1');
    const a0 = await auditN(), l0 = await ledgerN();
    const r1 = await callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 2000000, reason: 'idem-r1', idempotency_key: key, request_fingerprint: 'fp-r1' });
    const a1 = await auditN(), l1 = await ledgerN();
    const r2 = await callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 2000000, reason: 'idem-r1', idempotency_key: key, request_fingerprint: 'fp-r1' });
    const a2 = await auditN(), l2 = await ledgerN();
    const rows = await rowsForKey(key);
    return {
      label, key, first_resp: r1, second_resp: r2,
      ledger: `${l0}->${l1}->${l2}`, audit: `${a0}->${a1}->${a2}`,
      rows_for_key: rows,
      pass: r1 && r1.ok === false && r1.reason === 'OVER_MAX_DAILY_AMOUNT'
        && r2 && r2.ok === false && r2.reason === 'OVER_MAX_DAILY_AMOUNT'
        && Number(a1) - Number(a0) === 1 && Number(a2) - Number(a1) === 0   // 拒绝行不放大
        && l1 === l0 && l2 === l0                                            // 零资金分录
        && rows.length === 1 && rows[0].result === 'rejected_daily_cap',
    };
  };
  const dir2 = async (actor: number, target: number, label: string) => {
    const kFill = k(actor, target, 'f0');
    const key = k(actor, target, 'r2');
    const fill = await callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 500000, reason: 'idem-fill', idempotency_key: kFill, request_fingerprint: 'fp-fill' });
    const aA = await auditN(), lA = await ledgerN();
    const rFirst = await callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 900000, reason: 'idem-r2', idempotency_key: key, request_fingerprint: 'fp-r2a' }); // 500000+900000>cap ⇒ 拒
    const aB = await auditN(), lB = await ledgerN();
    const g = await guarded(() => callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 400000, reason: 'idem-r2', idempotency_key: key, request_fingerprint: 'fp-r2b' })); // 500000+400000≤cap ⇒ 应成功
    const rSecond = g.ok ? g.val : null;
    const aC = await auditN(), lC = await ledgerN();
    const rows = await rowsForKey(key);
    const results = rows.map((x) => x.result).sort().join(',');
    return {
      label, key, fill_resp: fill, first_resp: rFirst, second_resp: rSecond, second_error: g.ok ? null : g.err,
      ledger: `${lA}->${lB}->${lC}`, audit: `${aA}->${aB}->${aC}`,
      rows_for_key: rows,
      pass: fill && fill.ok === true
        && rFirst && rFirst.ok === false && rFirst.reason === 'OVER_MAX_DAILY_AMOUNT'
        && Number(aB) - Number(aA) === 1 && lB === lA                        // 先拒：+1 审计 / 零资金
        && g.ok === true && rSecond && rSecond.ok === true && rSecond.op === 'mint'
        && Number(aC) - Number(aB) === 1 && lC === lB + 1                     // 后成：+1 审计 / +1 资金
        && rows.length === 2 && results === 'applied,rejected_daily_cap',     // 拒绝行保留 + 成功行共存
    };
  };
  const dir3 = async (actor: number, target: number, label: string, form: 'new' | 'old') => {
    const key = k(actor, target, 'r3');
    const a0 = await auditN(), l0 = await ledgerN();
    const r1 = await callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 1000, reason: 'idem-r3', idempotency_key: key, request_fingerprint: 'fp-r3' });
    const a1 = await auditN(), l1 = await ledgerN();
    const r2 = await callFn({ actor_uid: actor, target_uid: target, cid: 1, amount: 1000, reason: 'idem-r3', idempotency_key: key, request_fingerprint: 'fp-r3' });
    const a2 = await auditN(), l2 = await ledgerN();
    const dup = await probe(() => probeDupApplied(actor, target, key));      // 同键同结果 ⇒ 必须 23505（两种写法皆拦）
    const coexist = await probe(() => probeNewRejected(actor, target, key)); // 同键异结果：新写法允许；旧写法必 23505
    const coexistOk = form === 'new'
      ? (coexist.ok === true)
      : (coexist.ok === false && coexist.err && coexist.err.code === '23505');
    const rows = await rowsForKey(key);
    return {
      label, form, key, first_resp: r1, replay_resp: r2,
      ledger: `${l0}->${l1}->${l2}`, audit: `${a0}->${a1}->${a2}`,
      dup_applied_probe: dup.ok ? { ok: true, err: null } : dup.err,
      coexist_rejected_probe: coexist.ok ? { ok: true, err: null } : coexist.err,
      rows_for_key: rows,
      pass: r1 && r1.ok === true && String(r1.idempotent_replay) === 'false'
        && r2 && String(r2.idempotent_replay) === 'true' && Number(a2) - Number(a1) === 0 && l2 === l1 // 函数层拦住
        && dup.ok === false && dup.err && dup.err.code === '23505'                                      // 约束层拦住
        && coexistOk && rows.length === 1,
    };
  };

  try {
    await c.connect();
    out.pre_real_state = await realState();

    await c.query('BEGIN');
    await c.query(`SET LOCAL lock_timeout='20s'`);
    await c.query(`SET LOCAL statement_timeout='600s'`);
    await c.query('DROP SCHEMA public CASCADE');
    await c.query('CREATE SCHEMA public');
    await c.query(`CREATE TABLE IF NOT EXISTS public."schema_migration" (
        id bigserial PRIMARY KEY, version text NOT NULL UNIQUE, name text NOT NULL,
        checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);

    const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
    const replayLog: any[] = [];
    for (const f of files) {
      try { await c.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8')); replayLog.push({ file: f, ok: true }); }
      catch (e: any) {
        replayLog.push({ file: f, ok: false, error: redact(String(e && e.message ? e.message : e)).slice(0, 500) });
        out.replay_log = replayLog; out.fatal = `replay failed at ${f}`;
        await c.query('ROLLBACK'); await c.end();
        console.log(JSON.stringify(out, null, 2)); process.exit(4);
      }
    }
    out.replay_log = replayLog;
    out.replay_ok = replayLog.length === files.length && replayLog.every((x) => x.ok);

    await c.query(`INSERT INTO public.users (uid, evm, bio, is_admin) VALUES
       ($1,'0x'||repeat('a',40),'',true), ($2,'0x'||repeat('b',40),'',false), ($3,'0x'||repeat('c',40),'',false),
       ($4,'0x'||repeat('d',40),'',true), ($5,'0x'||repeat('e',40),'',false), ($6,'0x'||repeat('f',40),'',false)`,
      [A1, A2, A3, B1, B2, B3]);
    await c.query(`INSERT INTO public.users (uid, evm, bio, is_admin) VALUES
       ($1,'0x'||repeat('1',40),'',false), ($2,'0x'||repeat('2',40),'',false)`, [TG, TG2]);

    // ============================================================ 结构存在性（DDL 取证，非源码推断）
    const cdefNew = await constraintDef();
    out.constraint_def_new = cdefNew;
    t('S1', /UNIQUE \(idempotency_key, result\)/.test(cdefNew),
      '约束定义 = UNIQUE (idempotency_key, result)（复合）', cdefNew);
    const idx = await one(`SELECT i.indnkeyatts::int AS nkeys, (i.indpred IS NULL) AS not_partial,
                                  pg_get_indexdef(i.indexrelid) AS def
                             FROM pg_index i JOIN pg_class ic ON ic.oid=i.indexrelid
                            WHERE i.indrelid='public.admin_ops_audit_log'::regclass AND ic.relname='admin_ops_audit_log_idem_uniq'`);
    out.idem_index = idx;
    t('S2', idx && Number(idx.nkeys) === 2 && idx.not_partial === true && /\(idempotency_key, result\)/.test(idx.def),
      '复合唯一索引在场且非部分索引（键位=2）', JSON.stringify(idx));

    // ============================================================ ① 同键被拒两次（复合写法）
    out.dir1_new = await dir1(A1, TG, 'new');
    t('D1-1', out.dir1_new.pass, '同键被拒两次 ⇒ 只 1 行拒绝留痕 / 零资金 / 两次均拒',
      JSON.stringify({ ledger: out.dir1_new.ledger, audit: out.dir1_new.audit, rows: out.dir1_new.rows_for_key.length, r1: out.dir1_new.first_resp, r2: out.dir1_new.second_resp }));

    // ============================================================ ② 同键先拒后成（复合写法）
    out.dir2_new = await dir2(A2, TG, 'new');
    t('D2-1', out.dir2_new.pass, '同键先拒后成 ⇒ 允许成功；拒绝行保留（2 行：rejected_daily_cap + applied）；资金 +1',
      JSON.stringify({ ledger: out.dir2_new.ledger, audit: out.dir2_new.audit, rows: out.dir2_new.rows_for_key, second: out.dir2_new.second_resp }));

    // ============================================================ ③ 同键成功两次（复合写法）
    out.dir3_new = await dir3(A3, TG, 'new', 'new');
    t('D3-1', out.dir3_new.pass, '同键成功两次 ⇒ replay 不重复写 + 裸插同键同结果被 23505 拦住',
      JSON.stringify({ ledger: out.dir3_new.ledger, audit: out.dir3_new.audit, dup: out.dir3_new.dup_applied_probe }));

    // ============================================================ 二次自证：改回旧写法（事务内，随 ROLLBACK 消失）
    const fnDef = String((await one(`SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                                      WHERE n.nspname='public' AND p.proname='admin_points_adjust_post_event'`)).d);
    const fnOld = fnDef.replace('ON CONFLICT (idempotency_key, result) DO NOTHING', 'ON CONFLICT (idempotency_key) DO NOTHING');
    out.fn_oldform_rewritten = fnOld !== fnDef;
    t('S3', out.fn_oldform_rewritten, '旧写法改写成功（函数体 ON CONFLICT 目标可从复合替换回单列）', out.fn_oldform_rewritten);

    // 自证前置：清空审计表（**仅事务内，随 ROLLBACK 消失**）。缘由：新写法下 dir2 已**合法**写下
    //   「同键、异 result」两行 ⇒ 直接在既有数据上建单列唯一索引**会因重复键失败**（这本身就是复合语义的证据）。
    //   清空走 TRUNCATE：append-only 触发器为 BEFORE UPDATE OR DELETE（FOR EACH ROW），不拦 TRUNCATE ——
    //   该边界已在 `0023` 表注释内登记。
    await c.query(`TRUNCATE public.admin_ops_audit_log`);
    await c.query(`ALTER TABLE public.admin_ops_audit_log DROP CONSTRAINT admin_ops_audit_log_idem_uniq`);
    await c.query(`ALTER TABLE public.admin_ops_audit_log ADD CONSTRAINT admin_ops_audit_log_idem_uniq UNIQUE (idempotency_key)`);
    await c.query(fnOld);
    out.constraint_def_old = await constraintDef();
    t('S4', /UNIQUE \(idempotency_key\)$/.test(out.constraint_def_old) && out.fn_oldform_rewritten,
      '已临时改回旧写法：约束 UNIQUE(idempotency_key) + 函数 ON CONFLICT(idempotency_key)', `${out.constraint_def_old}`);

    out.dir1_old = await dir1(B1, TG2, 'old');
    t('O1', out.dir1_old.pass, '旧写法下 ① 同键被拒两次 ⇒ 仍只 1 行（DO NOTHING 命中单列唯一）',
      JSON.stringify({ ledger: out.dir1_old.ledger, audit: out.dir1_old.audit, rows: out.dir1_old.rows_for_key.length }));

    out.dir2_old = await dir2(B2, TG2, 'old');
    t('O2', out.dir2_old.pass === false && out.dir2_old.second_error && out.dir2_old.second_error.code === '23505',
      '★ 旧写法下 ② 同键先拒后成 ⇒ **必然失败 23505**（既有拒绝行占用单列唯一键 ⇒ 整条语句回滚）',
      JSON.stringify({ ledger: out.dir2_old.ledger, audit: out.dir2_old.audit, second_error: out.dir2_old.second_error, second_resp: out.dir2_old.second_resp, rows: out.dir2_old.rows_for_key.map((x: any) => x.result) }),
      '证明复合索引确实**承重**：只有 (key,result) 才允许「先拒后成」');

    out.dir3_old = await dir3(B3, TG2, 'old', 'old');
    t('O3', out.dir3_old.pass, '旧写法下 ③ 同键成功两次 ⇒ 仍被拦住（replay + 裸插 23505）+ 同键异结果**也**被 23505 拦（旧写法无共存放行）',
      JSON.stringify({ ledger: out.dir3_old.ledger, audit: out.dir3_old.audit, dup: out.dir3_old.dup_applied_probe, coexist: out.dir3_old.coexist_rejected_probe }));

    // 自证收尾：把约束**改回**复合写法（**留在新写法**，不改回去）
    await c.query(`ALTER TABLE public.admin_ops_audit_log DROP CONSTRAINT admin_ops_audit_log_idem_uniq`);
    await c.query(`ALTER TABLE public.admin_ops_audit_log ADD CONSTRAINT admin_ops_audit_log_idem_uniq UNIQUE (idempotency_key, result)`);
    await c.query(fnDef);
    out.constraint_def_restored = await constraintDef();
    t('S5', /UNIQUE \(idempotency_key, result\)/.test(out.constraint_def_restored),
      '自证后约束改回复合写法（未留在旧写法）', out.constraint_def_restored);

    // ============================================================ 注册点（静态，本单不变）
    const idxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
    out.route_registrations = (idxSrc.match(/^app\.(get|post|patch|delete|put)\(/gm) || []).length;
    t('J1', out.route_registrations === 67, '注册点 67（本单不增/不删端点）', out.route_registrations);

    // ============================================================ 收尾：ROLLBACK + 真库净零
    await c.query('ROLLBACK');
    out.post_real_state = await realState();
    out.net_zero = JSON.stringify(out.pre_real_state) === JSON.stringify(out.post_real_state);
    t('I1', out.net_zero === true, '真库 ledger_entry / Σ(account.balance,cid=1) / account 行数 逐字不变',
      JSON.stringify({ pre: out.pre_real_state, post: out.post_real_state }), 'AC⑦ 账本零位移（两个数）');
  } catch (e: any) {
    out.fatal = redact(String(e && e.message ? e.message : e));
    out.fatal_code = e && e.code ? e.code : null;
    try { await c.query('ROLLBACK'); } catch { /* ignore */ }
    exitCode = 4;
  } finally {
    await c.end().catch(() => undefined);
  }

  const failed = checks.filter((x) => x.ok === false);
  out.checks = checks;
  out.total = checks.length; out.passed = checks.length - failed.length; out.failed = failed.length;
  out.ok = exitCode === 0 && failed.length === 0;
  if (failed.length && exitCode === 0) exitCode = 3;
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const dir = path.join(__dirname, '..', '.p4-artifacts', `p6b6audit-idemkey-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'idemkey.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  console.log(`SUMMARY total=${out.total} passed=${out.passed} failed=${out.failed} exit=${exitCode} artifact=${dir}/idemkey.json`);
  process.exit(exitCode);
})();
