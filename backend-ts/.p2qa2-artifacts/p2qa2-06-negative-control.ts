/**
 * p2qa2-06 · 判负能力（§C apply-time 自检**真能失败**吗）
 * ============================================================================
 * 整场在**一个回滚事务**里（结束即恢复原函数，前后 prosrc md5 自证）。
 * 变体（每个都是「一种真的会把修复弄坏的改法」）：
 *   V0 原样（对照，必须 PASS）
 *   V1 抹掉 BEGIN/END 标记
 *   V2 把整段闸挪到函数末尾（= 余额闸之后）
 *   V3 闸体（BEGIN 标记行**之内**）注入 UPDATE account
 *   V4 R51 的 ON CONFLICT (idempotency_key) DO NOTHING 改成等价但换行（文本消失）
 *   V5 归属谓词写错：t.event_root_key = v_key ⇒ t.event_root_key = v_key || 'zz'
 *   V6 闸体注释抹掉 idx_ledger_event_root_key
 *   V7 闸体清空（只留标记 ⇒ 闸失效）
 * 两趟：
 *   pass=bhv   行为探针**在跑**（原样 §C）
 *   pass=struc 先在事务内占住 §C 保留的探针 uid 960901/960902 ⇒ §C 走「行为探针已跳过」分支，
 *              **只有结构性断言生效** ⇒ 能分开看清「结构性判负」与「行为判负」各自的消息
 * 登记：sqlstate / message / 是否出现 22P02 malformed array literal / 函数是否已恢复。
 */
import * as fs from 'fs';
import * as path from 'path';
import { mkPool, raw1, save, beginTx, md5, pgErr, NET_RETRIES, fnFingerprint, type Qx } from './p2qa2-lib';

const RUN = process.env.P2QA2_RUN ?? 'NONE';
const MIG = path.resolve(__dirname, '..', 'migrations', '0012_replay_pre_gate_before_balance_gate.sql');

(async () => {
  const p = mkPool(2);
  const fpBefore = await fnFingerprint(p);
  try {
    const defRow = await raw1<{ def: string }>(p, `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='ledger_post_event'
        AND pg_get_function_identity_arguments(p.oid)='payload jsonb'`);
    const def = String((defRow as { def: string }).def);
    const migSrc = fs.readFileSync(MIG, 'utf8');
    const doBlock = migSrc.slice(migSrc.indexOf('DO $chk$'));

    const BM = '0012-REPLAY-PRE-GATE-BEGIN';
    const EM = '0012-REPLAY-PRE-GATE-END';
    const nlAfter = (s: string, pos: number) => s.indexOf('\n', pos);   // 该行行尾的 \n 位置
    const defs: Array<{ id: string; what: string; sql: string; expect: string }> = [];

    defs.push({ id: 'V0', what: '原样（对照）', sql: def, expect: 'PASS' });
    defs.push({ id: 'V1', what: '抹掉闸 BEGIN/END 标记', sql: def.split(BM).join('X-GATE-BEGIN').split(EM).join('X-GATE-END'), expect: 'FAIL:标记缺失或错位' });
    {
      const bm = def.indexOf(BM);
      const em = def.indexOf(EM);
      const lineStart = def.lastIndexOf('\n', bm) + 1;            // BEGIN 标记行**行首**
      const emLineEnd = def.indexOf('\n', em) + 1;                 // END 标记行**行尾 \n 之后**
      const region = def.slice(lineStart, emLineEnd);              // 整段闸（含 BEGIN/END 两个标记行）
      const rest = def.slice(0, lineStart) + def.slice(emLineEnd);
      const asIdx = def.indexOf('AS $');
      const dStart = def.indexOf('$', asIdx + 3);
      const tag = def.slice(dStart, def.indexOf('$', dStart + 1) + 1);
      const close = rest.lastIndexOf(tag);
      const endIdx = rest.lastIndexOf('END;', close);
      if (em < 0 || endIdx < 0 || close < 0) {
        save('p2qa2-06-negative-control-FATAL', { reason: 'V2/V3 变体构造失败', bm, em, lineStart, emLineEnd, endIdx, close });
        process.exit(2);
      }
      defs.push({ id: 'V2', what: '整段闸（含两标记）挪到函数末尾（= 余额闸之后）',
        sql: rest.slice(0, endIdx) + region + rest.slice(endIdx), expect: 'FAIL:不在 C5/R80 之前' });
      defs.push({ id: 'V3', what: '闸体内（BEGIN 标记行之后）注入 UPDATE account',
        sql: def.slice(0, def.indexOf('\n', bm) + 1) + '  UPDATE account SET balance = balance WHERE false;\n'
             + def.slice(def.indexOf('\n', bm) + 1),
        expect: 'FAIL:闸体出现写/加锁关键字' });
    }
    defs.push({ id: 'V4', what: 'R51 探针改写为等价但换行（文本消失）',
      sql: def.replace('ON CONFLICT (idempotency_key) DO NOTHING', 'ON CONFLICT (idempotency_key) DO\n    NOTHING'),
      expect: 'FAIL:ON CONFLICT 探针消失了' });
    {
      const i = def.indexOf('t.event_root_key = v_key');
      defs.push({ id: 'V5', what: '闸的归属谓词**语义改坏但逐字保留**（t.event_root_key = v_key ⇒ ... OR TRUE）',
        sql: i < 0 ? def : def.slice(0, i) + 't.event_root_key = v_key OR TRUE' + def.slice(i + 't.event_root_key = v_key'.length),
        expect: 'struc:可能逃过文本断言（登记为限制）／bhv:行为探针必须判负' });
    }
    defs.push({ id: 'V6', what: '闸体注释抹掉 idx_ledger_event_root_key',
      sql: def.split('idx_ledger_event_root_key').join('IDX_EVENT_ROOT_KEY'), expect: 'FAIL:未标注既有索引用途' });
    {
      const bm = def.indexOf(BM);
      const bmEnd = bm + BM.length;                                 // BEGIN 标记文本之后
      const emStart = def.indexOf(EM);                              // END 标记文本之前
      defs.push({ id: 'V7', what: '闸体**清空**（BEGIN/END 两标记都保留 ⇒ 闸失效但位置看起来对）',
        sql: def.slice(0, bmEnd) + '\n  -- （闸体已清空 · 0012 变体）\n  -- ' + def.slice(emStart),
        expect: 'FAIL:⑤ 四支全缺（只读/位置断言都还"看起来"成立）' });
    }

    interface VRun { pass: string; id: string; what: string; expect: string; verdict: string; raised: boolean;
      sqlstate: string | null; message: string | null; self_check_message: boolean; msg_has_array_literal: boolean;
      fn_restored_md5_ok: boolean | null; ms: number; }
    const runs: VRun[] = [];

    const t = await beginTx(p, 900_000);
    const runOne = async (pass: string, v: { id: string; what: string; sql: string; expect: string }): Promise<VRun> => {
      await t.q.query('SAVEPOINT sp_v');
      if (v.id !== 'V0') await t.q.query(v.sql);
      await t.q.query('SAVEPOINT sp_c');
      const t0 = Date.now();
      let raised = false; let err: ReturnType<typeof pgErr> | null = null;
      try { await t.q.query(doBlock); } catch (e) { raised = true; err = pgErr(e); }
      await t.q.query('ROLLBACK TO SAVEPOINT sp_c');
      await t.q.query('ROLLBACK TO SAVEPOINT sp_v');
      const back = await fnFingerprint(t.q as Qx);
      const msg = err?.message ?? null;
      const isSelf = !!(msg && /^0012 self-check failed:/.test(msg));
      const verdict = v.expect === 'PASS' ? (raised ? 'UNEXPECTED_FAIL' : 'PASS')
        : (!raised ? 'NOT_RAISED' : (isSelf ? 'FAIL_SELFCHECK_MSG' : 'FAIL_OTHER_MSG'));
      return { pass, id: v.id, what: v.what, expect: v.expect, verdict, raised, sqlstate: err?.sqlstate ?? null,
        message: msg, self_check_message: isSelf, msg_has_array_literal: !!(msg && /malformed array literal/i.test(msg)),
        fn_restored_md5_ok: md5(back.src) === fpBefore.prosrc_md5, ms: Date.now() - t0 };
    };
    try {
      for (const v of defs) runs.push(await runOne('bhv', v));      // 行为探针在跑
      // 占住 §C 保留的探针 uid ⇒ §C 走「行为探针已跳过」分支（结构性断言仍在）
      await t.q.query(`INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u),40,'0')
                         FROM unnest(ARRAY[960901,960902]) AS u ON CONFLICT (uid) DO NOTHING`);
      for (const v of defs) runs.push(await runOne('struc', v));    // 只有结构性断言
    } finally { await t.rollback(); }

    const fpAfter = await fnFingerprint(p);
    const restored = fpAfter.prosrc_md5 === fpBefore.prosrc_md5;
    const strucFails = runs.filter((r) => r.pass === 'struc' && r.id !== 'V0');
    const bhvFails = runs.filter((r) => r.pass === 'bhv' && r.id !== 'V0');
    const strucNonV5 = strucFails.filter((r) => r.id !== 'V5');
    const okAll = runs.filter((r) => r.id === 'V0').every((r) => r.verdict === 'PASS')
      && strucNonV5.every((r) => r.raised) && bhvFails.every((r) => r.raised) && restored;
    const out = { run: RUN, fn_before: { len: fpBefore.prosrc_len, md5: fpBefore.prosrc_md5 },
      fn_after: { len: fpAfter.prosrc_len, md5: fpAfter.prosrc_md5 }, fn_restored_to_original: restored,
      do_block_bytes: doBlock.length, variants: runs,
      summary: { structural_only_all_raised: strucFails.every((r) => r.raised),
        structural_only_all_selfcheck_msg: strucFails.every((r) => r.self_check_message),
        behavioral_pass_all_raised: bhvFails.every((r) => r.raised),
        behavioral_pass_selfcheck_msg_ids: bhvFails.filter((r) => r.self_check_message).map((r) => r.id),
        behavioral_pass_other_msg_ids: bhvFails.filter((r) => !r.self_check_message).map((r) => `${r.id}:${r.sqlstate}:${(r.message ?? '').slice(0, 60)}`),
        any_malformed_array_literal: runs.some((r) => r.msg_has_array_literal) },
      all_as_expected: okAll, net_retries: NET_RETRIES };
    const f = save('p2qa2-06-negative-control', out);
    console.log(JSON.stringify({ file: f, fn_restored_to_original: restored, all_as_expected: okAll, summary: out.summary,
      variants: runs.map((r) => `${r.verdict === 'PASS' || r.verdict === 'FAIL_SELFCHECK_MSG' ? 'OK  ' : (r.verdict === 'FAIL_OTHER_MSG' ? 'WARN' : 'BAD ')} [${r.pass}][${r.id}] raised=${r.raised} sqlstate=${r.sqlstate} restored=${r.fn_restored_md5_ok} msg=${(r.message ?? '').slice(0, 200)}`) }, null, 1));
    process.exit(okAll ? 0 : 1);
  } finally { await p.end().catch(() => undefined); }
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
