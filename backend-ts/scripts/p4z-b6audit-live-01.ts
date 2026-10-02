/**
 * BE-AUDIT-LIVE · 0023 审计留痕 + 日累计闸的线上实证（Kong）
 * ============================================================================
 * 本单是**线上实证**：服务经面板单路重启 load 新代码后，用**真 HTTP**
 * (`http://127.0.0.1:5788`) 逐件验：
 *   ① 真 admin 极小额度 ⇒ 200 + 一行 ledger_entry + 一行 audit(result='applied') 的行级证据
 *   ② 同键同内容重投 ⇒ replay、两份表均不新增、txid 逐字相同
 *   ③ 单次上限回归 ⇒ amount=100001 ⇒ 400 LD016 + reason=OVER_MAX_SINGLE_AMOUNT；
 *      amount=-1（burn 支路）随后 +1 回补 ⇒ Σ 零净位移
 *   ④ 非 admin ⇒ 403 / 无 token ⇒ 401 ⇒ 零残留（不写审计行、不写资金分录）
 *   ⑤ ★ 日累计闸：**不得为测试造百万点** ⇒
 *      ① 只读给出函数内阈值常量与求和判据（result='applied'）的逐字证据；
 *      ② 事务内（合成一行当日 applied 行占用额度）+ 直接调函数 ⇒ 复现拒绝 ⇒ ROLLBACK；
 *      ③ 真库 live **未**触发日累计拒绝（理由见报告）。
 *
 * 红线（逐字遵守）：
 *   · 退出码**不取自管道之后**（本脚本内部 computed，直接 process.exit）；
 *   · **不造大额点数**（本单最大写额度 = ±1 点）；
 *   · 夹具只限本单新增 uid/键窗口（新 uid 行 + 新 ops: 键），收尾回补 ⇒ 资金净位移 0；
 *   · 只读探针 0 位移；密钥绝不打印（.env.local 只以变量方式使用）。
 * 用法: cd backend-ts && npx ts-node --transpile-only scripts/p4z-b6audit-live-01.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execSync } from 'child_process';

const REPO = path.resolve(__dirname, '..');

// .env.local 只读加载（**绝不打印任何值**）
for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}

import { Client, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';
neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const API = 'http://127.0.0.1:5788';
const PANEL = 'http://127.0.0.1:5555';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RED = (s: string) => String(s).replace(/postgres(?:ql)?:\/\/\S+/gi, '[REDACTED]');
const clip = (s: string, n = 700) => (s.length > n ? `${s.slice(0, n)}…[+${s.length - n}]` : s);

const out: any = { unit: 'BE-AUDIT-LIVE', role: 'Kong', at: new Date().toISOString(), api: API };
const checks: Array<{ id: string; ok: boolean | null; expect: string; actual: string }> = [];
const t = (id: string, ok: boolean | null, expect: string, actual: string) => checks.push({ id, ok, expect, actual });
const notMeasured: string[] = [];

const DAY_START = `date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`;

(async () => {
  const URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || '';
  if (!URL) { console.log(JSON.stringify({ ok: false, fatal: 'missing DATABASE_URL_UNPOOLED' })); process.exit(2); }
  const c = new Client({ connectionString: URL });
  const c2 = new Client({ connectionString: URL });
  let exitCode = 0;

  const one = async (cl: Client, sql: string, params: any[] = []): Promise<any> => (await cl.query(sql, params)).rows[0];
  const state = async (cl: Client) => ({
    ledger_entry_rows: String((await one(cl, `SELECT count(*)::int AS n FROM public.ledger_entry`)).n),
    audit_rows: String((await one(cl, `SELECT count(*)::int AS n FROM public.admin_ops_audit_log`)).n),
    sigma_balance_cid1: String((await one(cl, `SELECT coalesce(sum(balance),0)::text AS s FROM public.account WHERE cid=1`)).s),
    account_rows: String((await one(cl, `SELECT count(*)::int AS n FROM public.account`)).n),
  });

  const mint = (uID: number, evm: string): string => {
    const key = String(process.env.SECRET_KEY || '');
    if (!key) throw new Error('SECRET_KEY missing');
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const h = b64({ alg: 'HS256', typ: 'JWT' });
    const p = b64({ sub: String(uID), evm, exp: Math.floor(Date.now() / 1000) + 1800 });
    return `${h}.${p}.${crypto.createHmac('sha256', key).update(`${h}.${p}`).digest('base64url')}`;
  };

  const http = async (url: string, init?: any) => {
    try {
      const r = await fetch(url, init);
      const txt = await r.text();
      return { status: r.status, body: clip(txt, 900), raw: txt };
    } catch (e) { return { status: -1, body: `FETCH_ERROR:${e instanceof Error ? e.message : String(e)}`, raw: '' }; }
  };
  const adjust = (body: any, token?: string) => http(`${API}/api/admin/points/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const pidOn5788 = () => {
    try { return execSync(`lsof -nP -iTCP:5788 -sTCP:LISTEN -t`).toString().trim().split('\n')[0]; } catch { return null; }
  };

  let ADMIN = 0, TARGET = 0;
  const K: Record<string, string> = {};

  try {
    await c.connect();
    await c2.connect();

    // ======================================================= 0. 只读前置
    out.recon = {
      table_present: (await one(c, `SELECT to_regclass('public.admin_ops_audit_log') IS NOT NULL AS e`)).e,
      admin_candidates: (await c.query(`SELECT uid, is_admin, left(evm,6)||'…' AS evm_head FROM public.users WHERE is_admin = true ORDER BY uid LIMIT 5`)).rows,
      fixture_uid_window_used: (await c.query(`SELECT uid FROM public.users WHERE uid >= 900000 ORDER BY uid`)).rows.map((r: any) => String(r.uid)),
      schema_version_row: (await c.query(`SELECT version FROM public.schema_migration ORDER BY id DESC LIMIT 1`)).rows,
      migration_rows: String((await one(c, `SELECT count(*)::int AS n FROM public.schema_migration`)).n),
      rejected_rows_existing: String((await one(c, `SELECT count(*)::int AS n FROM public.admin_ops_audit_log WHERE result='rejected_daily_cap'`)).n),
      code_path_adjustPoints: (fs.readFileSync(path.join(REPO, 'src', 'database.ts'), 'utf8')
        .split('\n').filter((l) => l.includes('admin_points_adjust_post_event')).map((l) => l.trim()).slice(0, 4)),
      ld016_map: (fs.readFileSync(path.join(REPO, 'src', 'ledger.ts'), 'utf8')
        .split('\n').filter((l) => /LD016\s*:/.test(l)).map((l) => l.trim()).slice(0, 2)),
    };

    out.pre_state = await state(c);

    // ======================================================= 1. 单路重启 + 新 PID
    const pidBefore = pidOn5788();
    const rs = await http(`${PANEL}/api/restart`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sid: 'seafood-api' }),
    });
    out.restart = { response_status: rs.status, response_body: rs.body.slice(0, 200), pid_before: pidBefore };
    let health: any = null, ready = false;
    for (let i = 0; i < 40; i += 1) {
      await sleep(2000);
      const h = await http(`${API}/health`);
      if (h.status === 200) { health = JSON.parse(h.raw); ready = health.schema_version === '0023'; break; }
    }
    out.health_after_restart = { ready, pid_after: pidOn5788(), health };
    t('S1', ready === true && out.health_after_restart.pid_after !== pidBefore,
      '重启后 /health 200 且 schema_version=0023，PID 变化（新代码已 load）',
      JSON.stringify({ ready, pid_before: pidBefore, pid_after: out.health_after_restart.pid_after }));
    if (!ready) throw new Error('service not ready after restart');

    // ======================================================= 2. 主体与夹具（新窗口）
    const adm = (await c.query(`SELECT uid, evm FROM public.users WHERE is_admin = true AND coalesce(evm,'') <> '' ORDER BY uid LIMIT 1`)).rows[0];
    ADMIN = adm.uid;
    const hasRoleTable = (await one(c, `SELECT to_regclass('public.admin_user_role') IS NOT NULL AS e`)).e;
    const nonadm = hasRoleTable
      ? (await c.query(`SELECT u.uid, u.evm FROM public.users u WHERE u.is_admin = false AND coalesce(u.evm,'') <> ''
                          AND NOT EXISTS (SELECT 1 FROM public.admin_user_role r WHERE r.uid = u.uid) ORDER BY u.uid LIMIT 1`)).rows[0]
      : (await c.query(`SELECT u.uid, u.evm FROM public.users u WHERE u.is_admin = false AND coalesce(u.evm,'') <> '' ORDER BY u.uid LIMIT 1`)).rows[0];

    const usedWindow = out.recon.fixture_uid_window_used.map((x: string) => Number(x));
    const base = usedWindow.length ? Math.max(...usedWindow) : 0;
    TARGET = Math.max(971100, Math.ceil((base + 1) / 100) * 100 + 13);
    K.mint = `ops:${ADMIN}:points_adjust:${TARGET}:1:live-mint-a`;
    K.burn = `ops:${ADMIN}:points_adjust:${TARGET}:1:live-burn-a`;
    K.replayProbe = `ops:${ADMIN}:points_adjust:${TARGET}:1:live-caprepro`;

    FAILSAFE: {
      if (!adm || !nonadm) { out.fatal = 'missing admin/non-admin subject'; throw new Error('missing subjects'); }
      await c.query(`INSERT INTO public.users (uid, evm, bio, is_admin) VALUES ($1, $2, $3, false)`,
        [TARGET, '0x' + crypto.createHash('sha256').update(`b6audit-live:${TARGET}`).digest('hex').slice(0, 40), 'b6audit-live fixture (BE-AUDIT-LIVE)']);
    }
    out.subjects = {
      admin_uid: ADMIN, admin_is_admin: true,
      nonadmin_uid: nonadm.uid, nonadmin_has_role_row: false,
      fixture_target_uid: TARGET, fixture_uid_is_new_window: !usedWindow.includes(TARGET),
      keys_used: Object.values(K), token_present: { admin: !!mint(ADMIN, adm.evm), nonadmin: !!mint(nonadm.uid, nonadm.evm) },
    };
    const tokAdmin = mint(ADMIN, adm.evm), tokNon = mint(nonadm.uid, nonadm.evm);
    t('S2', out.subjects.fixture_uid_is_new_window === true && TARGET > base,
      '夹具 uid 为**新窗口**（不得复用历史夹具）', `target=${TARGET} > 历史最大 ${base}`);

    // ======================================================= 3. 件① 成功路径（真 HTTP，amount=1）
    const s0 = await state(c);
    const r1 = await adjust({ uID: TARGET, amount: 1, reason: 'b6audit-live mint', idempotency_key: K.mint }, tokAdmin);
    const b1 = JSON.parse(r1.raw || '{}');
    const s1 = await state(c);
    out.item1_success_http = { request: { uID: TARGET, amount: 1, reason: 'b6audit-live mint', idempotency_key: K.mint }, status: r1.status, body: b1 };
    const txid1 = String(b1?.data?.txid ?? '');
    out.item1_rows = {
      ledger_entry: (await c.query(`SELECT row_to_json(e) AS r FROM public.ledger_entry e WHERE e.uid=$1 ORDER BY e.txid`, [TARGET])).rows.map((x: any) => x.r),
      audit: (await c.query(`SELECT row_to_json(a) AS r FROM public.admin_ops_audit_log a WHERE a.idempotency_key=$1`, [K.mint])).rows.map((x: any) => x.r),
      delta_vs_pre: { ledger: Number(s1.ledger_entry_rows) - Number(s0.ledger_entry_rows), audit: Number(s1.audit_rows) - Number(s0.audit_rows) },
    };
    const le1 = out.item1_rows.ledger_entry[0], au1 = out.item1_rows.audit[0];
    t('①', r1.status === 200 && b1?.success === true && b1?.data?.op === 'mint' && b1?.data?.new_points === 1
      && out.item1_rows.delta_vs_pre.ledger === 1 && out.item1_rows.delta_vs_pre.audit === 1
      && !!le1 && le1.kind === 'mint' && String(le1.txid) === txid1
      && !!au1 && au1.result === 'applied' && String(au1.amount) === '1' && String(au1.txid) === txid1
      && au1.op === 'mint' && String(au1.actor_uid) === String(ADMIN) && String(au1.target_uid) === String(TARGET)
      && !!au1.request_fingerprint && Number(au1.balance_before) === 0 && Number(au1.balance_after) === 1,
      '200 + 回执齐 + ledger_entry×1(kind=mint,txid 同) + audit×1(applied,op=mint,金额/操作人/目标 uid/指纹齐)',
      JSON.stringify({ status: r1.status, ret_txid: txid1, ledger: le1, audit: au1 }));

    // ======================================================= 4. 件② 幂等重投
    const r2 = await adjust({ uID: TARGET, amount: 1, reason: 'b6audit-live mint', idempotency_key: K.mint }, tokAdmin);
    const b2 = JSON.parse(r2.raw || '{}');
    const s2 = await state(c);
    out.item2_replay = {
      status: r2.status, body: b2, txid_first: txid1, txid_replay: String(b2?.data?.txid ?? ''),
      idempotent_replay_flag: b2?.idempotent_replay ?? null,
      ledger_delta: Number(s2.ledger_entry_rows) - Number(s1.ledger_entry_rows),
      audit_delta: Number(s2.audit_rows) - Number(s1.audit_rows),
    };
    t('②', r2.status === 200 && b2?.idempotent_replay === true && String(b2?.data?.txid) === txid1
      && out.item2_replay.ledger_delta === 0 && out.item2_replay.audit_delta === 0,
      '200 replay + txid 逐字相同 + ledger/audit 均不新增',
      JSON.stringify(out.item2_replay));

    // ======================================================= 5. 件③ 单次上限（回归）+ burn 支路
    const sPreOver = await state(c);
    const rOver = await adjust({ uID: TARGET, amount: 100001, reason: 'b6audit-live oversize', idempotency_key: `ops:${ADMIN}:points_adjust:${TARGET}:1:live-over-a` }, tokAdmin);
    const bOver = JSON.parse(rOver.raw || '{}');
    const sPostOver = await state(c);
    out.item3_over_single = {
      status: rOver.status, body: bOver,
      code: bOver?.error?.code, details: bOver?.error?.details,
      zero_residue: { ledger_delta: Number(sPostOver.ledger_entry_rows) - Number(sPreOver.ledger_entry_rows), audit_delta: Number(sPostOver.audit_rows) - Number(sPreOver.audit_rows) },
    };
    const rBurn = await adjust({ uID: TARGET, amount: -1, reason: 'b6audit-live burn (回补)', idempotency_key: K.burn }, tokAdmin);
    const bBurn = JSON.parse(rBurn.raw || '{}');
    const sBurn = await state(c);
    out.item3_burn = {
      status: rBurn.status, body: bBurn,
      ledger_entry: (await c.query(`SELECT row_to_json(e) AS r FROM public.ledger_entry e WHERE e.uid=$1 AND e.kind='burn' ORDER BY e.txid DESC LIMIT 1`, [TARGET])).rows.map((x: any) => x.r),
      audit: (await c.query(`SELECT row_to_json(a) AS r FROM public.admin_ops_audit_log a WHERE a.idempotency_key=$1`, [K.burn])).rows.map((x: any) => x.r),
      balance_after_target: (await one(c, `SELECT coalesce(balance,0)::text AS b FROM public.account WHERE uid=$1 AND cid=1`, [TARGET]))?.b,
    };
    t('③a', rOver.status === 400 && out.item3_over_single.code === 'LEDGER_AMOUNT_INVALID'
      && out.item3_over_single.details?.reason === 'OVER_MAX_SINGLE_AMOUNT' && out.item3_over_single.details?.max === 100000
      && out.item3_over_single.zero_residue.ledger_delta === 0 && out.item3_over_single.zero_residue.audit_delta === 0,
      '400 + LD016(LEDGER_AMOUNT_INVALID) + reason=OVER_MAX_SINGLE_AMOUNT，且零残留',
      JSON.stringify(out.item3_over_single));
    t('③b', rBurn.status === 200 && bBurn?.data?.op === 'burn' && bBurn?.data?.new_points === 0
      && out.item3_burn.ledger_entry[0]?.kind === 'burn' && String(out.item3_burn.ledger_entry[0]?.delta) === '-1'
      && out.item3_burn.audit[0]?.op === 'burn' && String(out.item3_burn.audit[0]?.amount) === '-1'
      && out.item3_burn.balance_after_target === '0',
      'burn 支路可用（op=burn、单腿 kind=burn、余额回 0 ⇒ Σ 零净位移）',
      JSON.stringify({ status: rBurn.status, body: bBurn, burn: out.item3_burn.ledger_entry[0], audit: out.item3_burn.audit[0], bal: out.item3_burn.balance_after_target }));

    // ======================================================= 6. 件④ 非 admin 403 / 无 token 401
    const sAuthPre = await state(c);
    const rNon = await adjust({ uID: TARGET, amount: 1, reason: 'b6audit-live nonadmin', idempotency_key: `ops:${ADMIN}:points_adjust:${TARGET}:1:live-nonadm` }, tokNon);
    const rNone = await adjust({ uID: TARGET, amount: 1, reason: 'b6audit-live notoken', idempotency_key: `ops:${ADMIN}:points_adjust:${TARGET}:1:live-notok` });
    const sAuthPost = await state(c);
    const bNon = JSON.parse(rNon.raw || '{}'), bNone = JSON.parse(rNone.raw || '{}');
    out.item4_auth = {
      nonadmin: { status: rNon.status, code: bNon?.error?.code, reason: bNon?.error?.details?.reason },
      no_token: { status: rNone.status, code: bNone?.error?.code },
      zero_residue: {
        ledger_delta: Number(sAuthPost.ledger_entry_rows) - Number(sAuthPre.ledger_entry_rows),
        audit_delta: Number(sAuthPost.audit_rows) - Number(sAuthPre.audit_rows),
        audit_rows_with_those_keys: String((await one(c, `SELECT count(*)::int AS n FROM public.admin_ops_audit_log WHERE idempotency_key IN ($1,$2)`,
          [`ops:${ADMIN}:points_adjust:${TARGET}:1:live-nonadm`, `ops:${ADMIN}:points_adjust:${TARGET}:1:live-notok`])).n),
      },
    };
    t('④', rNon.status === 403 && bNon?.error?.code === 'AUTH_FORBIDDEN' && bNon?.error?.details?.reason === 'NOT_ADMIN'
      && rNone.status === 401 && bNone?.error?.code === 'AUTH_UNAUTHORIZED'
      && out.item4_auth.zero_residue.ledger_delta === 0 && out.item4_auth.zero_residue.audit_delta === 0
      && out.item4_auth.zero_residue.audit_rows_with_those_keys === '0',
      '非 admin=403(NOT_ADMIN) / 无 token=401(AUTH_UNAUTHORIZED) ⇒ 零残留（无审计行、无资金分录）',
      JSON.stringify(out.item4_auth));

    // ======================================================= 7. 件⑤① 只读逐字证据（阈值 + 求和判据）
    const def = (await one(c, `SELECT pg_get_functiondef(p.oid) AS d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                                WHERE n.nspname='public' AND p.proname='admin_points_adjust_post_event'`)).d as string;
    const lines = def.split('\n');
    const pick = (re: RegExp) => lines.map((l) => l.trim()).filter((l) => re.test(l)).slice(0, 3);
    const sumBlock = def.slice(def.indexOf('SELECT COALESCE(sum(abs(a.amount)), 0)::bigint INTO v_used'),
      def.indexOf('AND a.idempotency_key <> v_key;') + 'AND a.idempotency_key <> v_key;'.length);
    out.item5_static = {
      threshold_constant_line: pick(/v_daily_cap\s+CONSTANT\s+bigint\s*:=\s*1000000/),
      sum_predicate_lines: pick(/result\s*=\s*'applied'/),
      gate_condition_line: pick(/v_used\s*\+\s*abs\(v_amount\)\s*>\s*v_daily_cap/),
      sum_block_verbatim: sumBlock,
      no_raise_in_body: !/RAISE/.test(def),
      reject_branch_marker: pick(/rejected_daily_cap/).length > 0,
    };
    const liveUsed = String((await one(c, `SELECT coalesce(sum(abs(amount)),0)::text AS s FROM public.admin_ops_audit_log
        WHERE actor_uid=$1 AND result='applied' AND time_created >= ${DAY_START}`, [ADMIN])).s);
    out.item5_live_readings = {
      actor_daily_used_applied_only: liveUsed,
      actor_daily_used_all_rows: String((await one(c, `SELECT coalesce(sum(abs(amount)),0)::text AS s FROM public.admin_ops_audit_log
        WHERE actor_uid=$1 AND time_created >= ${DAY_START}`, [ADMIN])).s),
      daily_cap_constant: '1000000',
      rejected_daily_cap_rows_in_real_db: String((await one(c, `SELECT count(*)::int AS n FROM public.admin_ops_audit_log WHERE result='rejected_daily_cap'`)).n),
    };
    t('⑤①', out.item5_static.threshold_constant_line.length === 1 && out.item5_static.sum_predicate_lines.length >= 1
      && out.item5_static.gate_condition_line.length === 1 && out.item5_static.no_raise_in_body === true
      && out.item5_static.sum_block_verbatim.includes(`a.result     = 'applied'`),
      '只读取证：阈值常量 1000000 + 求和判据 result=\'applied\' 逐字在场 + 函数体无 RAISE',
      JSON.stringify(out.item5_static));

    // ======================================================= 8. 件⑤② 事务内复现日累计拒绝（+ROLLBACK ⇒ 零残留）
    await c2.query('BEGIN');
    const capPre = await state(c2);
    const synthKey = `ops:${ADMIN}:points_adjust:${TARGET}:1:live-cap-synth`;
    await c2.query(`INSERT INTO public.admin_ops_audit_log
        (actor_uid, action, target_uid, cid, op, amount, request_fingerprint, idempotency_key, result, memo)
        VALUES ($1,'points_adjust',$2,1,'mint',1000000,'fp-live-cap-synth',$3,'applied','live-cap-synth')`,
      [ADMIN, TARGET, synthKey]);
    const capRec = await one(c2, `SELECT public.admin_points_adjust_post_event($1::jsonb) AS r`, [JSON.stringify({
      actor_uid: ADMIN, target_uid: TARGET, cid: 1, amount: 1, reason: 'live-cap-repro',
      idempotency_key: K.replayProbe, request_fingerprint: 'fp-live-cap',
    })]).then((x) => x.r);
    const capMid = await state(c2);
    const capRejectRow = (await c2.query(`SELECT row_to_json(a) AS r FROM public.admin_ops_audit_log a WHERE a.idempotency_key=$1`, [K.replayProbe])).rows.map((x: any) => x.r)[0];
    await c2.query('ROLLBACK');
    const capPost = await state(c2);
    out.item5_intx_repro = {
      synthetic_used_row: { amount: '1000000', result: 'applied', note: '仅事务内合成，ROLLBACK 后消失' },
      reject_receipt: capRec,
      rejected_audit_row: capRejectRow,
      ledger_delta_in_tx: Number(capMid.ledger_entry_rows) - Number(capPre.ledger_entry_rows),
      audit_delta_in_tx: Number(capMid.audit_rows) - Number(capPre.audit_rows),
      after_rollback: { pre: capPre, post: capPost, zero_residue: JSON.stringify(capPre) === JSON.stringify(capPost) },
    };
    t('⑤②', capRec && String(capRec.ok) === 'false' && capRec.reason === 'OVER_MAX_DAILY_AMOUNT'
      && Number(capRec.daily_used) === Number(liveUsed) + 1000000 && Number(capRec.daily_used) > Number(capRec.daily_cap)
      && String(capRec.requested) === '1'
      && capRejectRow && capRejectRow.result === 'rejected_daily_cap' && capRejectRow.txid === null
      && capRejectRow.balance_after === null && capRejectRow.memo === 'OVER_MAX_DAILY_AMOUNT'
      && out.item5_intx_repro.ledger_delta_in_tx === 0 && out.item5_intx_repro.audit_delta_in_tx === 2
      && out.item5_intx_repro.after_rollback.zero_residue === true,
      '事务内复现：ok=false/reason=OVER_MAX_DAILY_AMOUNT/used=1000000 + 留痕行(result=rejected_daily_cap, txid/余额 NULL) + 零资金分录 + ROLLBACK 零残留',
      JSON.stringify(out.item5_intx_repro));

    // ======================================================= 9. 收尾：净位移读数
    out.post_state = await state(c);
    out.net_displacement = {
      ledger_entry_rows: { pre: out.pre_state.ledger_entry_rows, post: out.post_state.ledger_entry_rows },
      sigma_balance_cid1: { pre: out.pre_state.sigma_balance_cid1, post: out.post_state.sigma_balance_cid1 },
      sigma_equal: out.pre_state.sigma_balance_cid1 === out.post_state.sigma_balance_cid1,
      fixture_target_balance: (await one(c, `SELECT coalesce(balance,0)::text AS b FROM public.account WHERE uid=$1 AND cid=1`, [TARGET])).b,
      own_audit_rows: (await c.query(`SELECT log_id, result, op, amount::text AS amount, txid FROM public.admin_ops_audit_log WHERE target_uid=$1 ORDER BY log_id`, [TARGET])).rows,
      rejected_daily_cap_rows_in_real_db_final: String((await one(c, `SELECT count(*)::int AS n FROM public.admin_ops_audit_log WHERE result='rejected_daily_cap'`)).n),
    };
    t('Σ', out.net_displacement.sigma_equal === true && out.net_displacement.fixture_target_balance === '0'
      && Number(out.net_displacement.ledger_entry_rows.post) - Number(out.net_displacement.ledger_entry_rows.pre) === 2,
      '资金净位移 0：Σ(account.balance,cid=1) 改前=改后；夹具余额 0（ledger_entry +2 = mint/burn 成对，append-only 账本不可删）',
      JSON.stringify(out.net_displacement));

    out.item5_live_not_triggered = {
      statement: '真库 live 未触发日累计拒绝（业务路径未产生 result=rejected_daily_cap 行）',
      reason: '触发需操作人当日 applied 额度 ≥1,000,000 点；为测试真造百万点会污染真账本（红线②）⇒ 只在事务内复现（见 item5_intx_repro）',
      evidence_rejected_rows_zero: out.net_displacement.rejected_daily_cap_rows_in_real_db_final,
      live_daily_used_by_this_admin_today: liveUsed,
    };
    notMeasured.push('日累计拒绝的 HTTPS 面（route 回 400 + reason=OVER_MAX_DAILY_AMOUNT）：未在真库触发（不得造百万点）；DB 编排函数层已在事务内复现（item5_intx_repro），route 映射线为静态取证（index.ts:1310-1322 读源码）+ 单元/离线层（p4z-b6audit-01-e2e.ts）');
    notMeasured.push('两笔真并发同时卡阈值下的端到端竞态：真库不可造百万点；DB 层并发闸已有跨会话 advisory 锁实测（p4z-b6audit-01-e2e.ts H1）');

    // ---- 单级基线：把「本单所有真 HTTP 跑之前」的读数（最早 artifact 的 pre_state）带进本 artifact
    {
      const adir = path.join(REPO, '.p4-artifacts', 'p6b6audit-live');
      const names = fs.existsSync(adir) ? fs.readdirSync(adir).filter((f) => /^live-.*\.json$/.test(f)) : [];
      const prevs = names.map((f) => { try { return JSON.parse(fs.readFileSync(path.join(adir, f), 'utf8')); } catch { return null; } })
        .filter(Boolean).sort((a: any, b: any) => String(a.at).localeCompare(String(b.at)));
      out.unit_run_history = prevs.map((p: any) => ({
        at: p.at, target_uid: p.subjects?.fixture_target_uid,
        txid_mint: p.item1_success_http?.body?.data?.txid, txid_burn: p.item3_burn?.body?.data?.txid, exit_ok: p.ok,
      }));
      out.unit_baseline_before_all_runs = prevs[0]?.pre_state ?? out.pre_state;
      out.unit_net_displacement = {
        ledger_entry_rows: { pre: out.unit_baseline_before_all_runs.ledger_entry_rows, post: out.post_state.ledger_entry_rows },
        sigma_balance_cid1: { pre: out.unit_baseline_before_all_runs.sigma_balance_cid1, post: out.post_state.sigma_balance_cid1 },
        sigma_equal: out.unit_baseline_before_all_runs.sigma_balance_cid1 === out.post_state.sigma_balance_cid1,
      };
      t('Σ_unit', out.unit_net_displacement.sigma_equal === true,
        '本单全部真 HTTP 跑之前的 Σ(account.balance,cid=1) == 最终值（资金净位移 0）',
        JSON.stringify(out.unit_net_displacement));
    }
  } catch (e: any) {
    out.fatal = RED(String(e && e.message ? e.message : e));
    exitCode = 4;
    try { await c.query('ROLLBACK'); } catch { /* ignore */ }
    try { await c2.query('ROLLBACK'); } catch { /* ignore */ }
  } finally {
    await c.end().catch(() => undefined);
    await c2.end().catch(() => undefined);
  }

  const failed = checks.filter((x) => x.ok === false);
  out.checks = checks; out.total = checks.length; out.passed = checks.length - failed.length; out.failed = failed.length;
  out.not_measured = notMeasured;
  out.ok = exitCode === 0 && failed.length === 0;
  if (failed.length && exitCode === 0) exitCode = 3;
  const stamp = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 15);
  const dir = path.join(REPO, '.p4-artifacts', 'p6b6audit-live');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `live-${stamp}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out, null, 2));
  console.log(`SUMMARY total=${out.total} passed=${out.passed} failed=${out.failed} exit=${exitCode} artifact=${dir}/live-${stamp}.json`);
  process.exit(exitCode);
})();
