/**
 * p2qa2-08 · 修前对照（**在库内 byte-exact 还原 0005 的实现**）+ 断言 9a 的独立证/伪
 * ============================================================================
 * 事实基础（先在本脚本内自证）：
 *   · 0012 的函数体相对 0005 **只有两处纯插入**（DECLARE 两个变量 + C4.5 闸整段）；
 *     把这两段从 0012 体里删掉 ⇒ 逐字等于 git 里 0005 的函数体（sha256 相等）。
 *   · 于是可以在**一个回滚事务**里把「0005 实现」装进库里跑，得到真正的修前读数（不需要另一个库）。
 * 用例
 *   PHASE=after （库内现役 0012） 托管花光后同键重试 ⇒ 期望 200 重放
 *   PHASE=before（byte-exact 0005） 同形状 ⇒ 期望 **LD002**（修前缺陷复现）
 *   PHASE=before 另一形状（重试时托管**仍足额**）⇒ 期望 200 重放（**这是 C7 路径**，闸不存在）
 *        ⇒ 登记 C7 路径的 `extra` 形状 —— 用于独立证/伪「extra 不一致早于 0012」。
 * 全程在回滚事务内（零残留）；结束时函数 md5 必须回到原值。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw1, save, beginTx, sha256, pgErr, obs, tryFnSp, acct, ensureUsers,
  ensureCurrency, ledgerRowsFor, fnFingerprint, NET_RETRIES, moneyGuard, type Qx } from './p2qa2-lib';
import { allocNamespace, exitPrecondition } from '../scripts/ns-alloc';

const RUN = process.env.P2QA2_RUN ?? 'NONE';
const MIGDIR = path.resolve(__dirname, '..', 'migrations');
interface Check { id: string; name: string; ok: boolean; detail?: unknown; }
const checks: Check[] = [];
const judge = (id: string, name: string, ok: boolean, detail?: unknown) => checks.push({ id, name, ok, detail });

(async () => {
  const p = mkPool(3);
  const fpBefore = await fnFingerprint(p);
  try {
    // ---------------------------------------------------------------- 0. 事实基础
    const grabBody = (txt: string) => { const i = txt.indexOf('AS $fn$'); return txt.slice(i + 8, txt.indexOf('$fn$;', i + 7)); };
    const body12 = grabBody(fs.readFileSync(path.join(MIGDIR, '0012_replay_pre_gate_before_balance_gate.sql'), 'utf8'));
    const body05 = grabBody(fs.readFileSync(path.join(MIGDIR, '0005_ledger_event_root_key.sql'), 'utf8'));

    const INS_DECL = '  -- 0012：重放前置闸（只读；C4 账户加锁之后、C5 余额/冻结闸之前）\n  v_gate_txid     bigint;\n  v_gate_fp       text;\n';
    const gs = body12.indexOf('  -- ================================================================ C4.5 重放前置闸');
    let end = body12.indexOf('\n', body12.indexOf('-- 0012-REPLAY-PRE-GATE-END')) + 1;
    let INS_GATE = body12.slice(gs, end);
    const strip2 = (s: string) => s.split(INS_DECL).join('').split(INS_GATE).join('');
    let guard = 0;
    while (strip2(body12) !== body05 && end < body12.length && guard++ < 8) { end++; INS_GATE = body12.slice(gs, end); }
    const reconFileBody = strip2(body12);
    judge('0a', '「删掉两处插入」⇒ 0012 文件函数体**逐字**等于 0005 文件函数体（sha256 相等）', reconFileBody === body05,
      { recon_sha256: sha256(reconFileBody), file_0005_sha256: sha256(body05), lens: [reconFileBody.length, body05.length],
        ins_decl_len: INS_DECL.length, ins_gate_len: INS_GATE.length, ins_gate_tail: JSON.stringify(INS_GATE.slice(-40)) });

    const live = fpBefore.src;
    judge('0b', '库内现役 prosrc 与 0012 文件函数体只在**尾部空白**上不同',
      live.replace(/\s+$/, '') === body12.replace(/\s+$/, ''), { live_len: live.length, file_len: body12.length });
    const reconLive = strip2(live).replace(/\s+$/, '');
    judge('0c', '库内 prosrc 删掉同样两处 ⇒ 逐字等于 0005 文件函数体 ⇒ 可在库内 byte-exact 还原修前实现',
      reconLive === body05.replace(/\s+$/, ''), { recon_live_sha256: sha256(reconLive), file_0005_sha256: sha256(body05) });

    const defRow = await raw1<{ def: string }>(p, `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_post_event'
        AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`);
    const def = String((defRow as { def: string }).def);
    const withBody = (d: string, body: string): string => {
      const asIdx = d.indexOf('AS $');
      const dStart = d.indexOf('$', asIdx + 3);
      const dEnd = d.indexOf('$', dStart + 1) + 1;
      const tag = d.slice(dStart, dEnd);
      const close = d.lastIndexOf(tag);
      return d.slice(0, dStart) + tag + '\n' + body + '\n' + tag + d.slice(close + tag.length);
    };

    // ---------------------------------------------------------------- 1. 命名空间
    const ns = await allocNamespace(p, {
      tagPrefix: 'p2qa2', seed: RUN + ':before', uidCount: 8, uidPartitions: [[961001, 961999]], uidStride: 8,
      symbolPrefix: 'p2qa2', keyPrefix: 'ops:p2qa2:bf', jobDigits: 9,
      purpose: '0012 独立质检·修前对照：需全新 uid/币/键（账本 append-only，不可复位）',
    });
    if (!ns.ok) { save('p2qa2-08-before-state-FATAL', { fatal: ns.fatal }); console.error(JSON.stringify(ns.fatal)); exitPrecondition(ns.fatal); }
    const [EA, WA, EB, WB] = ns.uids;
    const K = (s: string) => `${ns.key_prefix}${s}`;
    const JP = ns.job_tag;

    const moneyBefore = await moneyGuard(p, []);
    const t = await beginTx(p, 300_000);
    let out: Record<string, any> = {};
    try {
      const mk = (cid: string, uid: string, amt: string, key: string) =>
        tryFnSp(t.q, { op: 'mint', uid, cid, amount_units: amt, kind: 'mint', idempotency_key: key });
      const hd = (cid: string, uid: string, amt: string, key: string) =>
        tryFnSp(t.q, { op: 'hold', uid, cid, amount_units: amt, kind: 'hold', ref_type: 'job', ref_id: JP,
          request_fingerprint: key + ':fp', idempotency_key: key });
      const evt = (cid: string, from: string, to: string, amt: string, key: string) => ({ op: 'entries', idempotency_key: key,
        request_fingerprint: key + ':fp', ref_type: 'job', ref_id: JP,
        entries: [
          { uid: from, cid, kind: 'job_payout', delta: '0', frozen_delta: `-${amt}` },
          { uid: to, cid, kind: 'job_payout', delta: amt, frozen_delta: '0' },
        ] });

      // ---- PHASE after（现役 0012）：托管恰花光 ⇒ 重试必须 200 重放
      await ensureUsers(t.q, [EA, WA]);
      const cidA = await ensureCurrency(t.q, `${ns.symbol}a`, EA, 6);
      await mk(cidA, EA, '500000', K('a:mint'));
      await hd(cidA, EA, '120000', K('a:hold'));
      const P_A = evt(cidA, EA, WA, '120000', K('a:evt'));
      const a1 = await tryFnSp(t.q, P_A);
      const aAcct1 = await acct(t.q, EA, cidA);
      const a2 = await tryFnSp(t.q, P_A);
      const aRows = await ledgerRowsFor(t.q, K('a:evt'));
      out.after = { first: obs(a1), retry: obs(a2), acct_after_first: aAcct1, rows: aRows,
        retry_is_replay: a2.ok && a2.replay, retry_txid_same: obs(a2).txid !== null && obs(a2).txid === obs(a1).txid };

      // ---- PHASE before（byte-exact 还原 0005）
      await t.q.query('SAVEPOINT s_pre');
      await t.q.query(withBody(def, reconLive));
      await ensureUsers(t.q, [EB, WB]);
      const cidB = await ensureCurrency(t.q, `${ns.symbol}b`, EB, 6);
      await mk(cidB, EB, '500000', K('b:mint'));
      await hd(cidB, EB, '120000', K('b:hold'));
      const P_B = evt(cidB, EB, WB, '120000', K('b:evt'));
      const b1 = await tryFnSp(t.q, P_B);
      const bAcct1 = await acct(t.q, EB, cidB);
      const b2 = await tryFnSp(t.q, P_B);                       // 期望：LD002（修前缺陷复现）
      const bRows = await ledgerRowsFor(t.q, K('b:evt'));
      const bAcct2 = await acct(t.q, EB, cidB);

      // 修前另一形状：重试时托管**仍足额** ⇒ 走 **C7 重放路径**（闸不存在）
      await hd(cidB, EB, '200000', K('b:hold2'));
      const P_C = evt(cidB, EB, WB, '50000', K('b:evt2'));
      const c1 = await tryFnSp(t.q, P_C);
      const cAcct1 = await acct(t.q, EB, cidB);
      const c2 = await tryFnSp(t.q, P_C);
      const c3 = await tryFnSp(t.q, P_C);
      const cRows = await ledgerRowsFor(t.q, K('b:evt2'));
      const cAcct2 = await acct(t.q, EB, cidB);
      out.before = { first: obs(b1), retry: obs(b2), acct_after_first: bAcct1, acct_after_retry: bAcct2, rows: bRows,
        retry_sqlstate: obs(b2).sqlstate, retry_message: obs(b2).err_message,
        c7_path: { first: obs(c1), replay: obs(c2), replay_again: obs(c3), rows: cRows,
          acct_after_first: cAcct1, acct_after_replay: cAcct2,
          extra_first: c1.raw?.extra ?? null, extra_replay: c2.raw?.extra ?? null,
          replay_txid_same: obs(c2).txid !== null && obs(c2).txid === obs(c1).txid,
          replay_json_equals_second: obs(c3).raw_json === obs(c2).raw_json } };
      await t.q.query('ROLLBACK TO SAVEPOINT s_pre');           // 撤销 0005 函数 + before 夹具/分录
      const restored = await fnFingerprint(t.q as Qx);
      out.after_restore_md5 = restored.prosrc_md5;
      out.after_restore_ok = restored.prosrc_md5 === fpBefore.prosrc_md5;
    } finally { await t.rollback(); }

    const fpAfter = await fnFingerprint(p);
    judge('0d', '全程结束后库内函数 prosrc md5 == 原值（回滚事务零副作用）', fpAfter.prosrc_md5 === fpBefore.prosrc_md5,
      { before: fpBefore.prosrc_md5, after: fpAfter.prosrc_md5, mid_restore_ok: out.after_restore_ok });
    const moneyAfter = await moneyGuard(p, []);
    judge('0e', 'cid=1 / 平台账户前后哈希一致', JSON.stringify(moneyBefore.cid1) === JSON.stringify(moneyAfter.cid1)
      && JSON.stringify(moneyBefore.platform_other_cids) === JSON.stringify(moneyAfter.platform_other_cids), { moneyBefore, moneyAfter });

    const A = out.after ?? {}; const B = out.before ?? {};
    judge('9a-1', '断言 9a（前件）：**修前（0005）C7 重放路径**返回的 extra = {}，而首写 extra 非空'
      + ' ⇒ 「extra 不逐字」在 0005 的 C7 已存在',
      Object.keys(B?.c7_path?.extra_first ?? {}).length > 0 && Object.keys(B?.c7_path?.extra_replay ?? {}).length === 0,
      B?.c7_path && { extra_first: B.c7_path.extra_first, extra_replay: B.c7_path.extra_replay });
    judge('9a-2', '断言 9a（形状一致）：0012 闸路径重放的 extra == 0005 C7 路径重放的 extra（都是 {}）',
      JSON.stringify(A?.retry?.extra) === JSON.stringify(B?.c7_path?.extra_replay),
      { gate_path_extra: A?.retry?.extra, c7_path_extra: B?.c7_path?.extra_replay });
    judge('9a-3', '断言 9a（同单未改 C7）：0005 与 0012 的 C7 段**逐字相同**（由 0a 的纯插入差分蕴含）', reconFileBody === body05);
    judge('FIX-1', '修前复现：托管花光后同键重试 ⇒ **LD002**（不是 200 重放）⇒ 缺陷为真、0012 确有修复',
      B?.retry_sqlstate === 'LD002' && B?.first?.ok === true && B?.first?.idempotent_replay === false,
      { first: B?.first, retry_sqlstate: B?.retry_sqlstate, retry_message: B?.retry_message, acct_after_first: B?.acct_after_first });
    judge('FIX-2', '修后同形状 ⇒ 200 重放 + 同 txid + 零新增（对照成立）',
      A?.retry_is_replay === true && A?.retry_txid_same === true && A?.rows === 2,
      { retry: A?.retry, rows: A?.rows, retry_txid_same: A?.retry_txid_same });
    judge('FIX-3', '修前 C7 路径本身工作正常（重试时托管足额 ⇒ 200 重放 + 同 txid + 零新增 + 不双扣）',
      B?.c7_path?.replay?.ok === true && B?.c7_path?.replay?.idempotent_replay === true && B?.c7_path?.replay_txid_same === true
      && B?.c7_path?.rows === 2 && JSON.stringify(B?.c7_path?.acct_after_first) === JSON.stringify(B?.c7_path?.acct_after_replay),
      B?.c7_path && { replay: B.c7_path.replay, rows: B.c7_path.rows, txid_same: B.c7_path.replay_txid_same });

    const reds = checks.filter((c) => !c.ok);
    const fout = { run: RUN, ns, fn_before: { len: fpBefore.prosrc_len, md5: fpBefore.prosrc_md5 },
      fn_after: { len: fpAfter.prosrc_len, md5: fpAfter.prosrc_md5 },
      sha_0005_body: sha256(body05), sha_recon_file_body: sha256(reconFileBody), sha_recon_live: sha256(reconLive),
      ins_decl_len: INS_DECL.length, ins_gate_len: INS_GATE.length,
      checks, reds: reds.map((r) => r.id), readings: out, net_retries: NET_RETRIES,
      note: '全程在一个已回滚事务内 ⇒ users/currency/ledger_entry 零残留（函数已还原）' };
    const f = save('p2qa2-08-before-state', fout);
    console.log(JSON.stringify({ file: f, reds: reds.map((r) => r.id),
      checks: checks.map((c) => `${c.ok ? 'GREEN' : 'RED  '} [${c.id}] ${c.name}`),
      after: { first_extra: A?.first?.extra, retry_extra: A?.retry?.extra, retry_txid: A?.retry?.txid, rows: A?.rows },
      before: { retry_sqlstate: B?.retry_sqlstate, retry_message: B?.retry_message,
        c7_extra_first: B?.c7_path?.extra_first, c7_extra_replay: B?.c7_path?.extra_replay,
        c7_retry_txid: B?.c7_path?.replay?.txid, c7_rows: B?.c7_path?.rows },
      fn_restored: fpAfter.prosrc_md5 === fpBefore.prosrc_md5, net_retries: NET_RETRIES }, null, 1));
    process.exit(reds.length ? 1 : 0);
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
