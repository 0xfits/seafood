/**
 * P6-B6-AUDIT · 事务内重建 + A1 编排函数端到端（Kong）
 * ============================================================================
 * 铁律：
 *   · **单连接** `Client({connectionString: DATABASE_URL_UNPOOLED})`；禁 Pool。
 *   · 全流程在**一个显式事务**内：BEGIN → DROP SCHEMA public CASCADE → 重放 0001..0023 →
 *     造 fixture → 跑判据 → **一律 ROLLBACK**（**绝不 COMMIT** ⇒ 真库零位移）。
 *   · 第二连接只用于**跨会话 advisory 锁实测**（其事务同样 ROLLBACK）。
 *   · 退出码：0 全绿 / 3 判据不符 / 4 重放或连接报错（**不取自管道**）。
 *
 * BE-AUDIT-FIX（Zang 2026-10-02 三条裁定）新增判据：
 *   · E2/E3/E5 —— 拒绝分支**留痕**（`result='rejected_daily_cap'`、余额/txid 皆 NULL）+ **零资金分录**；
 *   · E6       —— ★「刷额度」判负：被拒后**日累计读数不增长**（改前口径 vs 改后口径两个数）；
 *   · E7       —— 同键重投被拒 ⇒ **不重复写审计行**（ON CONFLICT DO NOTHING）；
 *   · A2       —— 函数体**不含 RAISE**（异常会回滚同函数内已写的拒绝留痕行）。
 * 用法: npx ts-node --transpile-only scripts/p4z-b6audit-01-e2e.ts
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

const ADMIN = 900001, TARGET = 900002, TARGET2 = 900003, GHOST = 999999;
const key = (seq: number, actor = ADMIN, target = TARGET) => `ops:${actor}:points_adjust:${target}:1:${seq}`;
const fp = (amount: number) => `fp-${amount}`;

(async () => {
  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  const out: any = { unit: 'P6-B6-AUDIT', at: new Date().toISOString() };
  if (!URL) { console.log(JSON.stringify({ ok: false, fatal: 'no DATABASE_URL_UNPOOLED' })); process.exit(2); }
  const c = new Client({ connectionString: URL });
  const c2 = new Client({ connectionString: URL });
  let exitCode = 0;

  // ---------------------------------------------------------------- 工具
  const one = async (cl: Client, sql: string, params: any[] = []): Promise<any> => (await cl.query(sql, params)).rows[0];
  const callFn = async (cl: Client, payload: Record<string, unknown>): Promise<any> => {
    const r = await one(cl, `SELECT public.admin_points_adjust_post_event($1::jsonb) AS r`, [JSON.stringify(payload)]);
    return r ? r.r : null;
  };
  const auditRows = async (cl: Client): Promise<string> => String((await one(cl, `SELECT count(*)::int AS n FROM public.admin_ops_audit_log`)).n);
  const ledgerRows = async (cl: Client): Promise<string> => String((await one(cl, `SELECT count(*)::int AS n FROM public.ledger_entry`)).n);
  // ★ 日累计口径两个数：改后口径（只计成功行）vs 改前口径（含拒绝行 —— 会被反复刷爆）
  const DAY_START = `date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;
  const sumAppliedOnly = async (cl: Client): Promise<string> => String((await one(cl,
    `SELECT coalesce(sum(abs(amount)),0)::text AS s FROM public.admin_ops_audit_log
      WHERE actor_uid=$1 AND result='applied' AND time_created >= ${DAY_START}`, [ADMIN])).s);
  const sumAllRows = async (cl: Client): Promise<string> => String((await one(cl,
    `SELECT coalesce(sum(abs(amount)),0)::text AS s FROM public.admin_ops_audit_log
      WHERE actor_uid=$1 AND time_created >= ${DAY_START}`, [ADMIN])).s);

  const realState = async (cl: Client) => ({
    ledger_entry_rows: await ledgerRows(cl),
    sigma_cid1: String((await one(cl, `SELECT coalesce(sum(balance),0)::text AS s FROM public.account WHERE cid=1`)).s),
    account_rows: String((await one(cl, `SELECT count(*)::int AS n FROM public.account`)).n),
  });

  try {
    await c.connect();
    await c2.connect();

    // ============================================================ 0. 真库前置读数（改后应逐字不变）
    out.pre_real_state = await realState(c);

    await c.query('BEGIN');
    await c.query(`SET LOCAL lock_timeout='20s'`);
    await c.query(`SET LOCAL statement_timeout='600s'`);
    await c.query('DROP SCHEMA public CASCADE');
    await c.query('CREATE SCHEMA public');
    await c.query(`CREATE TABLE IF NOT EXISTS public."schema_migration" (
        id bigserial PRIMARY KEY, version text NOT NULL UNIQUE, name text NOT NULL,
        checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);

    const files = fs.readdirSync(MIG_DIR).filter((f) => f.endsWith('.sql')).sort();
    out.migration_files = files;
    const replayLog: any[] = [];
    for (const f of files) {
      const before = (await one(c, `SELECT count(*)::int AS n FROM public."schema_migration"`)).n;
      try {
        await c.query(fs.readFileSync(path.join(MIG_DIR, f), 'utf8'));
      } catch (e: any) {
        replayLog.push({ file: f, ok: false, error: redact(String(e && e.message ? e.message : e)).slice(0, 500) });
        out.replay_log = replayLog; out.fatal = `replay failed at ${f}`;
        await c.query('ROLLBACK'); await c.end(); await c2.end();
        fs.writeFileSync(path.join(__dirname, '..', '.p4-artifacts', 'p6b6audit-e2e-fail.json'), JSON.stringify(out, null, 2));
        console.log(JSON.stringify(out, null, 2)); process.exit(4);
      }
      const after = (await one(c, `SELECT count(*)::int AS n FROM public."schema_migration"`)).n;
      replayLog.push({ file: f, ok: true, before, after });
    }
    out.replay_log = replayLog;
    // 注：`schema_migration` 行数由 `p3x-00-rebuild-replay.ts --dry-run` 判定（本脚本只重放 SQL 文本、
    // **不写** `schema_migration` 登记行 ⇒ 此处只断言「22 个文件、`0023` 在链尾且重放全通过」）。
    t('R1', files.length === 22 && files[21] === '0023_admin_points_audit_daily_cap.sql',
      '22 个迁移文件，`0023` 在链尾', `${files.length} / tail=${files[21]}`, 'schema_migration 行数期望=22 见 AC③（p3x dry-run）');
    t('R1b', replayLog.length === 22 && replayLog.every((x) => x.ok === true), '22/22 重放无错',
      `${replayLog.filter((x) => x.ok).length}/22`);
    t('R2', (await one(c, `SELECT to_regclass('public.admin_ops_audit_log') IS NOT NULL AS e`)).e === true, true,
      (await one(c, `SELECT to_regclass('public.admin_ops_audit_log') IS NOT NULL AS e`)).e);

    // ============================================================ 1. fixture（事务内，随 ROLLBACK 消失）
    await c.query(`INSERT INTO public.users (uid, evm, bio, is_admin) VALUES
       ($1, '0x' || repeat('a',40), '', true),
       ($2, '0x' || repeat('b',40), '', false),
       ($3, '0x' || repeat('c',40), '', false)`, [ADMIN, TARGET, TARGET2]);

    // ============================================================ 2. 函数体内两者同语句（AC④ 静态取证）
    const def = (await one(c, `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                                WHERE n.nspname='public' AND p.proname='admin_points_adjust_post_event'`)).d as string;
    out.fn_body_evidence = {
      has_advisory: def.indexOf('pg_advisory_xact_lock'),
      has_cap_const: def.indexOf('1000000'),
      has_ledger_call: def.indexOf('public.ledger_post_event(v_envelope)'),
      // ★ 成功路径的审计插入 = **最后**一个 INSERT INTO admin_ops_audit_log（拒绝留痕那个在前）
      has_audit_insert: def.lastIndexOf('INSERT INTO public.admin_ops_audit_log'),
      has_reject_marker: def.indexOf("'rejected_daily_cap'"),
      has_raise: def.indexOf('RAISE'),
      audit_after_ledger: def.lastIndexOf('INSERT INTO public.admin_ops_audit_log') > def.indexOf('public.ledger_post_event(v_envelope)'),
      single_statement: !/\bCOMMIT\b|\bBEGIN\s*;/i.test(def),
      def_bytes: def.length,
    };
    const ev = out.fn_body_evidence;
    t('A1', ev.has_advisory > 0 && ev.has_cap_const > 0 && ev.has_ledger_call > 0 && ev.has_audit_insert > 0
      && ev.audit_after_ledger === true && ev.single_statement === true,
      'advisory+cap+ledger+audit 同体、成功审计插入在 ledger 之后、无内嵌 COMMIT/BEGIN',
      JSON.stringify(ev), '一个函数体 = 一条语句 = 一个隐式事务');
    t('A2', ev.has_reject_marker > 0 && ev.has_raise === -1,
      "函数体含拒绝留痕分支（'rejected_daily_cap'）且**不含 RAISE**（Zang 裁定①：异常会回滚已写的留痕行）",
      JSON.stringify({ has_reject_marker: ev.has_reject_marker, has_raise: ev.has_raise }));

    // ============================================================ 3. 成功路径（mint）——审计行与资金同落
    const l0 = await ledgerRows(c), a0 = await auditRows(c);
    const r1 = await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 400000, reason: 'probe-mint-1', idempotency_key: key(1), request_fingerprint: fp(400000) });
    const l1 = await ledgerRows(c), a1 = await auditRows(c);
    t('B1', r1 && r1.ok === true && r1.op === 'mint' && r1.audit_logged === true && String(r1.idempotent_replay) === 'false',
      'ok/mint/audit_logged', JSON.stringify(r1));
    t('B2', Number(l1) - Number(l0) === 1 && Number(a1) - Number(a0) === 1,
      'ledger_entry +1 且 audit +1（同一次调用）', `ledger ${l0}->${l1} / audit ${a0}->${a1}`);
    const row1 = await one(c, `SELECT op, amount::text AS amount, balance_after::text AS ba, balance_before::text AS bb,
                                      request_fingerprint, idempotency_key, result, txid::text AS txid
                                 FROM public.admin_ops_audit_log WHERE idempotency_key=$1`, [key(1)]);
    t('B3', row1 && row1.op === 'mint' && row1.amount === '400000' && row1.result === 'applied'
      && row1.request_fingerprint === fp(400000) && String(row1.ba) === String(Number(row1.bb) + 400000),
      'op=mint/amount=400000/applied/指纹一致/ba=bb+amount', JSON.stringify(row1));

    // ============================================================ 4. 幂等重投（同键同指纹）⇒ 不重复写审计
    const r2 = await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 400000, reason: 'probe-mint-1', idempotency_key: key(1), request_fingerprint: fp(400000) });
    const l2 = await ledgerRows(c), a2 = await auditRows(c);
    t('C1', r2 && String(r2.idempotent_replay) === 'true' && l2 === l1 && a2 === a1,
      '重放：idempotent_replay=true / ledger 不变 / audit 不变（不重复写审计行）',
      `replay=${r2 && r2.idempotent_replay} / ledger ${l1}->${l2} / audit ${a1}->${a2}`,
      '重放路径走 idempotency_key<>v_key 排除 ⇒ 不被自己顶穿');

    // ============================================================ 5. 第二笔新键（仍在上限内）
    const r3 = await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 400000, reason: 'probe-mint-2', idempotency_key: key(2), request_fingerprint: fp(400001) });
    t('D1', r3 && r3.ok === true && String(r3.daily_used) === '400000',
      'used=400000（上一笔）仍放行', JSON.stringify({ ok: r3 && r3.ok, used: r3 && r3.daily_used, cap: r3 && r3.daily_cap }));

    // ============================================================ 6. ★ 日累计闸判负：拒绝 ⇒ 留痕（零资金分录）
    const l3 = await ledgerRows(c), a3 = await auditRows(c);
    const r4 = await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 400000, reason: 'probe-mint-3', idempotency_key: key(3), request_fingerprint: fp(400002) });
    const l4 = await ledgerRows(c), a4 = await auditRows(c);
    t('E1', r4 && r4.ok === false && r4.reason === 'OVER_MAX_DAILY_AMOUNT' && r4.requested === '400000',
      "ok=false / reason=OVER_MAX_DAILY_AMOUNT / 拒绝回执含 requested + daily_cap + daily_used", JSON.stringify(r4));
    t('E2', l4 === l3 && Number(a4) - Number(a3) === 1,
      '零资金分录 + 恰 1 行拒绝留痕（result=rejected_daily_cap）',
      `ledger ${l3}->${l4} / audit ${a3}->${a4}`,
      'Zang 裁定①：被拒尝试必须留痕；函数不 RAISE（异常会回滚该行）');
    const rejRow = await one(c, `SELECT op, amount::text AS amount, result, balance_before::text AS bb,
                                        balance_after::text AS ba, txid::text AS txid, memo
                                   FROM public.admin_ops_audit_log WHERE idempotency_key=$1`, [key(3)]);
    t('E3', rejRow && rejRow.result === 'rejected_daily_cap' && rejRow.amount === '400000' && rejRow.op === 'mint'
      && rejRow.bb === null && rejRow.ba === null && rejRow.txid === null && rejRow.memo === 'OVER_MAX_DAILY_AMOUNT',
      '留痕行：result=rejected_daily_cap / amount=请求值 / op=mint / 余额与 txid 皆 NULL / memo=OVER_MAX_DAILY_AMOUNT',
      JSON.stringify(rejRow));

    // ---------------------------------------------------------- 6b. ★ 连发 N 笔超限 ⇒ 每笔留痕 + 资金 0 新增
    const NREJ = 5;
    const lN0 = await ledgerRows(c), aN0 = await auditRows(c);
    const rOver: any[] = [];
    for (let i = 0; i < NREJ; i += 1) {
      rOver.push(await callFn(c, {
        actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 400000, reason: `probe-over-${i}`,
        idempotency_key: key(100 + i), request_fingerprint: `fp-over-${i}`,
      }));
    }
    const lN1 = await ledgerRows(c), aN1 = await auditRows(c);
    t('E4', rOver.length === NREJ && rOver.every((r) => r && r.ok === false && r.reason === 'OVER_MAX_DAILY_AMOUNT'),
      `${NREJ} 笔全部被拒且各带机读 reason`, JSON.stringify(rOver.map((r) => r && r.reason)));
    t('E5', lN1 === lN0 && Number(aN1) - Number(aN0) === NREJ,
      `每笔都落 rejected_daily_cap 行（+${NREJ}）且资金分录 0 新增`,
      `ledger ${lN0}->${lN1} / audit ${aN0}->${aN1}`);

    // ---------------------------------------------------------- 6c. ★ 刷额度判负：被拒后日累计读数不得增长
    const sumApplied = await sumAppliedOnly(c);
    const sumAll = await sumAllRows(c);
    t('E6', sumApplied === '800000' && BigInt(sumAll) > BigInt(sumApplied),
      '★ 日累计只计成功行：改后口径 800000 恒定；改前口径（含拒绝行）已膨胀 ⇒ 证明「反复发超限请求刷爆额度」的攻击面被关闭',
      `改后(只计 result=applied)=${sumApplied} / 改前(全部行)=${sumAll} / cap=1000000`,
      '拒绝行 amount 非零 ⇒ 若计入求和，反复超限请求即可把当日额度刷爆（管理员当天再也调不出分）');

    // ---------------------------------------------------------- 6d. 同键再次被拒 ⇒ 不重复写审计行
    const aDup0 = await auditRows(c);
    const rDup = await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 400000, reason: 'probe-mint-3', idempotency_key: key(3), request_fingerprint: fp(400002) });
    const aDup1 = await auditRows(c);
    t('E7', rDup && rDup.ok === false && aDup1 === aDup0,
      '同键重投被拒 ⇒ idempotent_replay 语义下不重复写审计行（ON CONFLICT DO NOTHING）',
      `ok=${rDup && rDup.ok} / audit ${aDup0}->${aDup1}`);

    // ============================================================ 7. ★ 原子性：审计插入失败 ⇒ 资金分录一并回滚（同语句）
    // SAVEPOINT 包裹（否则语句中止会把整个事务置入 aborted）。函数先落资金、后写审计 ⇒ 审计唯一键冲突
    // ⇒ **整条语句回滚** ⇒ 资金分录一并消失 ⇒ 反证「两者同一语句、同生同灭」。
    await c.query(`INSERT INTO public.admin_ops_audit_log
        (actor_uid, action, target_uid, cid, op, amount, request_fingerprint, idempotency_key, result, memo)
        VALUES ($1,'points_adjust',$2,1,'mint',1,'fp-squat',$3,'applied','squat')`, [ADMIN, TARGET2, key(9)]);
    const lA = await ledgerRows(c), aA = await auditRows(c);
    await c.query('SAVEPOINT sp_atomic');
    let atomicErr2: any = null;
    try {
      await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 7, reason: 'probe-atomic', idempotency_key: key(9), request_fingerprint: 'fp-atomic' });
    } catch (e: any) { atomicErr2 = { code: e && e.code, message: redact(String(e && e.message ? e.message : e)).slice(0, 200) }; }
    await c.query('ROLLBACK TO SAVEPOINT sp_atomic');
    const lB = await ledgerRows(c), aB = await auditRows(c);
    t('F1', atomicErr2 !== null && lB === lA && aB === aA,
      '审计唯一键冲突 ⇒ 整条语句回滚 ⇒ 无新增资金分录、无新增审计行',
      `err=${atomicErr2 && atomicErr2.code} / ledger ${lA}->${lB} / audit ${aA}->${aB}`,
      'AC④ 反证：若两者不同语句，资金分录会残留');

    // ============================================================ 8. burn / 幽灵 uid / append-only
    const rBurn = await callFn(c, { actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: -5, reason: 'probe-burn', idempotency_key: key(10), request_fingerprint: 'fp-burn' });
    const burnRow = await one(c, `SELECT op, amount::text AS amount FROM public.admin_ops_audit_log WHERE idempotency_key=$1`, [key(10)]);
    const burnLeg = await one(c, `SELECT count(*)::int AS n FROM public.ledger_entry WHERE kind='burn'`);
    t('G1', rBurn && rBurn.ok === true && rBurn.op === 'burn' && burnRow && burnRow.amount === '-5' && Number(burnLeg.n) === 1,
      'op=burn（单腿 kind=burn，§4.10③；库内 kind=burn 分录恰 1 条）', JSON.stringify({ r: rBurn, row: burnRow, burn_legs: burnLeg.n }));

    const lG = await ledgerRows(c), aG = await auditRows(c);
    const rGhost = await callFn(c, { actor_uid: ADMIN, target_uid: GHOST, cid: 1, amount: 5, reason: 'probe-ghost', idempotency_key: key(11, ADMIN, GHOST), request_fingerprint: 'fp-ghost' });
    t('G2', rGhost && rGhost.ok === false && Number(rGhost.user_found) === 0 && (await ledgerRows(c)) === lG && (await auditRows(c)) === aG,
      'user_found=0 且零残留（不调账本、不写审计）', JSON.stringify(rGhost));

    let upErr: any = null, delErr: any = null;
    await c.query('SAVEPOINT sp_ao');
    try { await c.query(`UPDATE public.admin_ops_audit_log SET memo='x' WHERE log_id=(SELECT min(log_id) FROM public.admin_ops_audit_log)`); }
    catch (e: any) { upErr = { code: e && e.code, message: redact(String(e && e.message ? e.message : e)).slice(0, 120) }; }
    await c.query('ROLLBACK TO SAVEPOINT sp_ao'); await c.query('SAVEPOINT sp_ao2');
    try { await c.query(`DELETE FROM public.admin_ops_audit_log WHERE log_id=(SELECT min(log_id) FROM public.admin_ops_audit_log)`); }
    catch (e: any) { delErr = { code: e && e.code, message: redact(String(e && e.message ? e.message : e)).slice(0, 120) }; }
    await c.query('ROLLBACK TO SAVEPOINT sp_ao2');
    t('G3', upErr !== null && delErr !== null && /append-only/i.test(upErr.message) && /append-only/i.test(delErr.message),
      'UPDATE/DELETE 双双被 append-only 拒', JSON.stringify({ up: upErr && upErr.code, del: delErr && delErr.code }));

    // ============================================================ 9. 跨会话 advisory 锁实测
    const lo = { held_by_self: (await one(c, `SELECT count(*)::int AS n FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND granted`)).n };
    await c2.query('BEGIN');
    await c2.query(`SET LOCAL lock_timeout='2s'`);
    let lockErr: any = null, lockWaitMs = 0;
    const ts = Date.now();
    try { await c2.query(`SELECT pg_advisory_xact_lock(hashtextextended('admin_points_adjust:' || $1::text, 0))`, [String(ADMIN)]); }
    catch (e: any) { lockErr = { code: e && e.code, message: redact(String(e && e.message ? e.message : e)).slice(0, 160) }; }
    lockWaitMs = Date.now() - ts;
    await c2.query('ROLLBACK');
    out.advisory_lock_probe = { self_holds: lo.held_by_self, other_wait_ms: lockWaitMs, other_err: lockErr };
    t('H1', lo.held_by_self >= 1 && lockErr !== null && lockErr.code === '55P03',
      '会话 1 持有该键 advisory 锁 ⇒ 会话 2 同一键 2s 内取不到（55P03 lock_timeout）',
      JSON.stringify(out.advisory_lock_probe),
      '函数体首句即取该锁 ⇒ 跨会话两笔串行（DAILY 闸读已提交行）；端到端「两笔真并发」= 受限于 DDL 仅在事务内，见 NOT_MEASURED');

    // ============================================================ 10. 注册点（静态，本单不变）
    const idxSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
    out.route_registrations = (idxSrc.match(/^app\.(get|post|patch|delete|put)\(/gm) || []).length;
    t('J1', out.route_registrations === 67, '注册点 67（本单不增/不删端点）', out.route_registrations);

    // ============================================================ 11. ROLLBACK + 真库净零
    await c.query('ROLLBACK');
    out.post_real_state = await realState(c);
    out.net_zero = JSON.stringify(out.pre_real_state) === JSON.stringify(out.post_real_state);
    t('I1', out.net_zero === true, '真库 ledger_entry / Σ(account.balance,cid=1) / account 行数 逐字不变',
      JSON.stringify({ pre: out.pre_real_state, post: out.post_real_state }));
  } catch (e: any) {
    out.fatal = redact(String(e && e.message ? e.message : e));
    out.fatal_code = e && e.code ? e.code : null;
    try { await c.query('ROLLBACK'); } catch { /* ignore */ }
    exitCode = 4;
  } finally {
    await c.end().catch(() => undefined);
    await c2.end().catch(() => undefined);
  }

  const failed = checks.filter((x) => x.ok === false);
  out.checks = checks;
  out.total = checks.length; out.passed = checks.length - failed.length; out.failed = failed.length;
  out.not_measured = checks.filter((x) => x.ok === null).map((x) => x.id);
  out.ok = exitCode === 0 && failed.length === 0;
  if (failed.length && exitCode === 0) exitCode = 3;
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const dir = path.join(__dirname, '..', '.p4-artifacts', `p6b6audit-e2e-${stamp}`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'e2e.json'), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  console.log(`SUMMARY total=${out.total} passed=${out.passed} failed=${out.failed} exit=${exitCode} artifact=${dir}/e2e.json`);
  process.exit(exitCode);
})();
