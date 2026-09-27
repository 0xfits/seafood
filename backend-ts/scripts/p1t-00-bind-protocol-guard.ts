/**
 * P1t-00 · **绑定协议守卫判负/正向用例**（`0010_referral_bind_protocol_guard.sql` 的可复核读数）
 * ============================================================================
 * 权威口径
 *   · `docs/commission.spec.md` §3.2（`depth = 父.depth + 1` 只校验**新插入的那条边** ⇒
 *     先绑叶、后绑父 ⇒ 既有下级行的 `depth` **就地失效**且（INSERT-only）**无法修正**）+ §3.3 + CR16。
 *   · Zang 裁定（本单）：真实协议 = **注册时绑一次、终身不变** ⇒ 「有下级者不可能之后才获得上级」
 *     ⇒ 把该协议变成**可强制的守卫**（`0010` 的 ④）。
 *
 * 本脚本交付的四条读数（**每条都给原始读数，不做「已通过」式口述**）
 *   ① **判负（核心）**：先 `A→B`（`B` 是叶）再给 **`B`** 绑上级 `P` ⇒ **必须被拒**
 *      （`LD016` / `LEDGER_AMOUNT_INVALID`(400) + reason `REFERRAL_BIND_WOULD_STALE_DEPTH`）；
 *      且 `referral_bind()` 与**裸 INSERT** 两条路径**都**被拒（防「某个入口漏加锁」）。
 *      + **判负能力自证**：事务内 `DISABLE TRIGGER` 直插同一对边 ⇒ 机读判据 `bad_depth` **变红**
 *        （证明守卫拦的是真缺口，且本判据真的能红）⇒ 事务 `ROLLBACK` 复原。
 *   ② **正向（正常协议）**：**先绑父、再绑子**（链长 3）⇒ 两次绑定都通过，且逐行 `depth` 正确
 *      （`M=1` / `L=2`）—— 守卫不误伤合法调用。
 *   ③ **既有 2-环判负不回归**：`X→Y` 后 `Y→X` ⇒ 仍拒 `REFERRAL_CYCLE_REJECTED`（**码与 reason 逐字不变**）。
 *      这条同时**钉住检查顺序**（环检查必须在「已有下级」守卫之前；否则 `B→A` 会改报新 reason）。
 *   ④ **`depth` 不变式复核**：本脚本全部写入后，全局 `cycles = 0` **且** `bad_depth = 0`。
 *
 * 附带取证（同轮、只读）
 *   · 借码纪律：`ledger_error_for_sqlstate('LD016')` ⇒ `bucket = input` ⇒ **400**；闭集仍 33 码。
 *   · TS 侧端到端：合成的 `LD016` 错误对象 ⇒ `LedgerError{code=LEDGER_AMOUNT_INVALID, httpStatus=400,
 *     details.reason=REFERRAL_BIND_WOULD_STALE_DEPTH}`。
 *   · 函数指纹：`referral_cycle_guard` 的 `prosrc` 哈希 + 是否含新 reason；迁移版本行。
 *   · **既往状态登记（本单不改，仅上报）**：`trg_referral_append_only` 的 `tgenabled` 读数。
 *
 * 测试数据分区（**绝不越界**）：uid **952xxx**，幂等键前缀 `ops:p1t:*`，本脚本**不建币、不动账本**
 *   ⇒ 不可能触碰 `cid = 1` 与任何平台账户余额（`ledger_entry` 只读计数）。
 *
 * 用法
 *   cd backend-ts
 *   npx ts-node --transpile-only scripts/p1t-00-bind-protocol-guard.ts            # 只出读数
 *   npx ts-node --transpile-only scripts/p1t-00-bind-protocol-guard.ts --assert   # 任一条红 ⇒ exit 1
 * ⚠️ **前置：`0010` 必须已应用**（本脚本开头即校验 `referral_cycle_guard` 已含新 reason；
 *    未应用会 `exit 3` **且不写任何数据** —— 否则旧守卫不拦，`B→P` 会真的写进不可删的 `referral`）。
 * 落盘：`.p1t-artifacts/p1t-00-bind-protocol-guard-<RUN>.json`（run-tagged，永不写固定名）
 * ============================================================================
 */
import './p1f-lib';                      // ⚠️ 必须先加载（绝对路径 .env.local），再加载 src/**
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { mkPool, raw, jstr } from './p1f-lib';
import { ledgerErrorFromDbError } from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';

const RUN = process.env.P1T_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const OUT_DIR = path.resolve(__dirname, '..', '.p1t-artifacts');
const ASSERT = process.argv.includes('--assert');
const IDEM_PREFIX = 'ops:p1t:';          // 本单幂等键前缀（本脚本不写账本，登记前缀以备扩展）

// ---- uid 分区（952xxx；与本迁移自检探针的 952991..952998 **不重叠**）----
const A = 952001, B = 952002, P = 952003;               // ① 判负：先 A→B，再 B→P
const L = 952011, M = 952012, N = 952013;               // ② 正向：先 M→N 再 L→M
const X = 952021, Y = 952022;                           // ③ 既有 2-环判负
const REBIND = 952031;                                  // ④ 改绑冲突对照（409，回归）
const ALL_UIDS = [A, B, P, L, M, N, X, Y, REBIND];

const REASON_NEW = 'REFERRAL_BIND_WOULD_STALE_DEPTH';
const REASON_CYCLE = 'REFERRAL_CYCLE_REJECTED';
const STATE_BORROWED = 'LD016';                         // = ledger_sqlstate_of('LEDGER_AMOUNT_INVALID')

interface ErrRec { state: string | null; message: string; reason: string | null; ts_code: string | null; ts_status: number | null; }
const errRec = (e: unknown): ErrRec => {
  const a = e as Record<string, unknown>;
  let detail: Record<string, unknown> = {};
  try { detail = JSON.parse(String(a?.detail ?? '{}')); } catch { /* noop */ }
  let ts: { code: string | null; status: number | null } = { code: null, status: null };
  try { const le = ledgerErrorFromDbError(e); ts = le ? { code: le.code, status: le.status } : ts; } catch { /* noop */ }
  return { state: (a?.code as string) ?? null, message: String(a?.message ?? e).slice(0, 200),
    reason: (detail as Record<string, unknown>)?.reason as string | undefined ?? null,
    ts_code: ts.code, ts_status: ts.status };
};

const MX_CYCLES = `WITH RECURSIVE up AS (
    SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
    UNION ALL SELECT u.start, r.parent_uid, u.d + 1 FROM referral r JOIN up u ON r.child_uid = u.cur WHERE u.d < 100)
  SELECT count(*)::text AS cycles FROM up WHERE cur = start`;
const MX_BADDEPTH = `WITH RECURSIVE anc AS (
    SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
    UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
  SELECT count(*)::text AS bad_depth FROM referral x
    JOIN (SELECT start, max(d) AS mx FROM anc GROUP BY 1) t ON t.start = x.child_uid WHERE x.depth <> t.mx`;

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pool = mkPool(4);
  const out: Record<string, unknown> = { run: RUN, ts: new Date().toISOString(), script: 'scripts/p1t-00-bind-protocol-guard.ts' };
  const reds: string[] = [];

  const guardFp = (await raw<{ prosrc: string }>(pool, `SELECT prosrc FROM pg_proc WHERE proname = 'referral_cycle_guard'`))[0]?.prosrc ?? '';

  // ⚠️ 前置闸：0010 **必须已应用**。否则本脚本的 ① 会真的把「B→P」写进不可删的 `referral`
  //    （旧守卫不拦）⇒ 永久污染 `depth` 不变式。⇒ 缺守卫时**立即退出，不写任何数据**。
  if (!guardFp.includes(REASON_NEW)) {
    console.error(JSON.stringify({ fatal: 'PRECHECK_FAILED',
      detail: 'referral_cycle_guard 不含 REFERRAL_BIND_WOULD_STALE_DEPTH ⇒ 0010 未应用；运行本脚本会污染 referral.depth（INSERT-only），已中止',
      installed_guard_md5: crypto.createHash('md5').update(guardFp).digest('hex') }));
    await pool.end();
    process.exit(3);
  }

  // ---------- 0 前置：真库指纹 + 现状基线 ----------
  out['0_pre'] = {
    schema_migration: await raw(pool, `SELECT version, name, left(checksum, 12) AS checksum12 FROM schema_migration ORDER BY version`),
    guard_fingerprint: { md5_prosrc: crypto.createHash('md5').update(guardFp).digest('hex'),
      has_new_reason: guardFp.includes(REASON_NEW), has_cycle_reason: guardFp.includes(REASON_CYCLE) },
    referral_count: (await raw(pool, `SELECT count(*)::text n FROM referral`))[0],
    ledger_entry_count_readonly: (await raw(pool, `SELECT count(*)::text n FROM ledger_entry`))[0],
    baseline: { cycles: (await raw<{ cycles: string }>(pool, MX_CYCLES))[0].cycles, bad_depth: (await raw<{ bad_depth: string }>(pool, MX_BADDEPTH))[0].bad_depth },
    idempotency_key_prefix_reserved: IDEM_PREFIX,
    guard_code_borrowed: (await raw(pool, `SELECT ledger_error_for_sqlstate($1::text) AS j, ledger_sqlstate_of('LEDGER_AMOUNT_INVALID') AS projection`, [STATE_BORROWED]))[0],
    closed_set_size: LEDGER_ERROR_CODES.length,
    pre_existing_observation: {
      note: '**本单不改**，仅登记：referral 的 append-only 触发器当前处于禁用态（上一单 p2d-01 事务内 DISABLE 后未复原）。',
      triggers: await raw(pool, `SELECT tgname, tgenabled::text, tgdeferrable::text FROM pg_trigger
                                  WHERE tgrelid = 'public.referral'::regclass AND NOT tgisinternal ORDER BY tgname`),
    },
  };

  // ---------- 1 前置：测试用户 ----------
  await raw(pool, `INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                     FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [ALL_UIDS.map(String)]);
  out['1_users'] = await raw(pool, `SELECT count(*)::text n FROM users WHERE uid = ANY($1::bigint[])`, [ALL_UIDS.map(String)]);

  // ---------- 2 判负能力自证：绕过守卫（事务内）直插「先绑叶、后绑父」⇒ bad_depth 必须变红 ----------
  //    这一条证明 ① 的判据**真的能红**（不是「恒绿判据」），且 spec §3.2 的现象在本库可复现。
  const bc = await pool.connect();
  let bypass: Record<string, unknown> = {};
  try {
    await bc.query('BEGIN');
    await bc.query('ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard');
    await bc.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$3,1)`,
      [String(A), String(B), String(P)]);       // A→B (depth 1)、B→P (depth 1，应为 2)
    const mx = async (sql: string) => (await bc.query(sql)).rows[0] as Record<string, string>;
    bypass = { injected_edges: [`${A}->${B}`, `${B}->${P}`], cycles: (await mx(MX_CYCLES)).cycles,
      bad_depth: (await mx(MX_BADDEPTH)).bad_depth, expected: 'bad_depth >= 1（叶/父顺序被追溯破坏：B 的 depth 应为 2）' };
    await bc.query('ROLLBACK');
  } catch (e) { await bc.query('ROLLBACK').catch(() => undefined); bypass = { error: errRec(e) }; }
  finally { bc.release(); }
  out['2_falsification_bypass_rolled_back'] = { ...bypass,
    note: '事务内 DISABLE TRIGGER + 直插 ⇒ 测量后 ROLLBACK，零残留；用于证明 ① 的判据可红' };
  if (bypass.error || String(bypass.bad_depth ?? '0') === '0') reds.push('判负能力自证失败：绕过守卫后 bad_depth 未变红');
  const afterBypass = { cycles: (await raw<{ cycles: string }>(pool, MX_CYCLES))[0].cycles,
    bad_depth: (await raw<{ bad_depth: string }>(pool, MX_BADDEPTH))[0].bad_depth };
  out['2b_referral_after_bypass'] = { ...afterBypass, rows_for_probe_uids: (await raw(pool,
    `SELECT count(*)::text n FROM referral WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`,
    [[A, B, P].map(String)]))[0] };

  // ---------- 绑定入口（走池 = 每条语句独立隐式事务；预期拒绝不会污染后续语句）----------
  const bindFn = async (child: number, parent: number) => {
    try {
      const r = await raw<{ j: Record<string, unknown> }>(pool, 'SELECT referral_bind($1::bigint,$2::bigint) AS j',
        [String(child), String(parent)]);
      return { path: 'referral_bind', ok: true, result: r[0]?.j ?? null };
    } catch (e) { return { path: 'referral_bind', ok: false, ...errRec(e) }; }
  };
  const bindRaw = async (child: number, parent: number, depthPlaceholder = 0) => {
    try {
      await raw(pool, `INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,$3)`,
        [String(child), String(parent), String(depthPlaceholder)]);
      return { path: 'raw_insert', threw: false, note: '未被拒 = 缺陷（触发器没拦住）' };
    } catch (e) { return { path: 'raw_insert', threw: true, ...errRec(e) }; }
  };

  // ---------- 3 用例①：判负（先 A→B，再给 B 绑上级 P）----------
  const c1a = await bindFn(A, B);                    // A→B：B 是叶 ⇒ 合法
  const c1b = await bindFn(B, P);                    // B→P：B **已有下级 A** ⇒ 必须被拒
  const c1c = await bindRaw(B, P);                   // 裸 INSERT 路径同样必须被拒
  const c1d = await bindFn(B, B);                    // 自指禁令对照（不回归）
  const c1 = {
    '1a_bind_A_to_B_ok': c1a,
    '1b_bind_B_to_P_MUST_REJECT_STALE_DEPTH': c1b,
    '1c_raw_insert_B_to_P_MUST_REJECT': c1c,
    '1d_self_bind_still_rejected': c1d,
    reads: {
      rejected: c1b.ok === false, state: (c1b as ErrRec).state ?? null, reason: (c1b as ErrRec).reason ?? null,
      reason_is_new_guard: (c1b as ErrRec).reason === REASON_NEW,
      code_is_borrowed_ld016: (c1b as ErrRec).state === STATE_BORROWED,
      ts_code: (c1b as ErrRec).ts_code ?? null, ts_status: (c1b as ErrRec).ts_status ?? null,
      raw_path_rejected_too: (c1c as { threw?: boolean }).threw === true,
      rows_landed_for_B: (await raw(pool, `SELECT count(*)::text n FROM referral WHERE child_uid = $1`, [String(B)]))[0],
      depth_of_A: (await raw(pool, `SELECT depth::text FROM referral WHERE child_uid = $1`, [String(A)]))[0] ?? null,
      depth_of_B: (await raw(pool, `SELECT depth::text FROM referral WHERE child_uid = $1`, [String(B)]))[0] ?? null,
    },
  };
  out['3_case1_leaf_first_bind_parent_MUST_REJECT'] = c1;
  if (!c1.reads.rejected) reds.push('用例①：已有下级者绑上级未被拒');
  if (!c1.reads.reason_is_new_guard) reds.push(`用例①：reason ≠ ${REASON_NEW}（实为 ${String(c1.reads.reason)}）`);
  if (!c1.reads.code_is_borrowed_ld016) reds.push(`用例①：拒绝码 ≠ ${STATE_BORROWED}`);
  if (!c1.reads.raw_path_rejected_too) reds.push('用例①：裸 INSERT 路径未被拒');
  if (c1.reads.depth_of_A?.depth !== '1') reds.push('用例①：A 的 depth ≠ 1');

  // ---------- 4 用例②：正向（先绑父、再绑子；链长 3）----------
  const c2a = await bindFn(M, N);                    // M→N（N 是根，M 是叶）⇒ 通过
  const c2b = await bindFn(L, M);                    // L→M（M 已有上级、L 是叶）⇒ 通过
  const c2 = {
    '2a_bind_M_to_N_ok_parent_first': c2a,
    '2b_bind_L_to_M_ok_child_after': c2b,
    reads: {
      both_ok: c2a.ok === true && c2b.ok === true,
      depth_M: (await raw(pool, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [String(M)]))[0] ?? null,
      depth_L: (await raw(pool, `SELECT depth::text AS depth FROM referral WHERE child_uid = $1`, [String(L)]))[0] ?? null,
      expected: { depth_M: '1', depth_L: '2' },
    },
  };
  out['4_case2_normal_protocol_parent_first_PASS'] = c2;
  if (!c2.reads.both_ok) reds.push('用例②：正常协议（先绑父再绑子）被误伤');
  if (c2.reads.depth_M?.depth !== '1') reds.push(`用例②：M 的 depth = ${String(c2.reads.depth_M?.depth)} ≠ 1`);
  if (c2.reads.depth_L?.depth !== '2') reds.push(`用例②：L 的 depth = ${String(c2.reads.depth_L?.depth)} ≠ 2`);

  // ---------- 5 用例③：既有 2-环判负不回归（钉住检查顺序）----------
  const c3a = await bindFn(X, Y);                    // X→Y ⇒ 通过
  const c3b = await bindFn(Y, X);                    // Y→X ⇒ 必须拒，且 reason 仍是 CYCLE（不是新守卫）
  const c3c = await bindRaw(Y, X);                   // 裸 INSERT 路径
  const c3 = {
    '3a_bind_X_to_Y_ok': c3a,
    '3b_bind_Y_to_X_MUST_REJECT_CYCLE': c3b,
    '3c_raw_insert_Y_to_X_MUST_REJECT': c3c,
    reads: {
      rejected: c3b.ok === false, state: (c3b as ErrRec).state ?? null, reason: (c3b as ErrRec).reason ?? null,
      reason_is_cycle_not_new_guard: (c3b as ErrRec).reason === REASON_CYCLE,
      ts_code: (c3b as ErrRec).ts_code ?? null, ts_status: (c3b as ErrRec).ts_status ?? null,
      check_order_note: 'C=Y 同时「已有下级(X)」且「成环」⇒ reason 仍是 REFERRAL_CYCLE_REJECTED ⇒ 环检查在 ④ 之前（顺序未被改动）',
    },
  };
  out['5_case3_existing_2cycle_negative_no_regression'] = c3;
  if (!c3.reads.rejected) reds.push('用例③：2-环未被拒（防环回归）');
  if (!c3.reads.reason_is_cycle_not_new_guard) reds.push(`用例③：reason 漂移为 ${String(c3.reads.reason)}（期望 ${REASON_CYCLE}）`);

  // ---------- 6 回归对照：改绑冲突 409 + 幂等 replay（referral_bind 语义未变）----------
  const c4replay = await bindFn(A, B);               // 同 (C,P) ⇒ idempotent_replay
  const c4conflict = await bindFn(A, REBIND);        // C 已绑他人 ⇒ 409 借码
  out['6_referral_bind_semantics_unchanged'] = {
    '4a_idempotent_replay': c4replay, '4b_rebind_conflict_409': c4conflict,
    reads: { replay_ok: c4replay.ok === true && (c4replay.result as Record<string, unknown>)?.idempotent_replay === true,
      conflict_code: (c4conflict as ErrRec).state ?? null, conflict_reason: (c4conflict as ErrRec).reason ?? null },
  };
  if (!out['6_referral_bind_semantics_unchanged'] ||
      !(out['6_referral_bind_semantics_unchanged'] as { reads: { replay_ok: boolean } }).reads.replay_ok) {
    reds.push('回归对照：幂等 replay 语义变了');
  }

  // ---------- 7 用例④：depth 不变式复核（全局）----------
  const g = { cycles: (await raw<{ cycles: string }>(pool, MX_CYCLES))[0].cycles,
    bad_depth: (await raw<{ bad_depth: string }>(pool, MX_BADDEPTH))[0].bad_depth };
  const perRow = await raw(pool, `WITH RECURSIVE anc AS (
      SELECT child_uid AS start, parent_uid AS cur, 1 AS d FROM referral
      UNION ALL SELECT a.start, r.parent_uid, a.d + 1 FROM referral r JOIN anc a ON r.child_uid = a.cur WHERE a.d < 100)
    SELECT start::text, max(d)::text AS expected_depth,
           (SELECT depth::text FROM referral z WHERE z.child_uid = start) AS actual_depth
      FROM anc WHERE start = ANY($1::bigint[]) GROUP BY start ORDER BY start`, [ALL_UIDS.map(String)]);
  out['7_case4_depth_invariant'] = {
    global: g, per_row_for_this_run: perRow,
    expected: { cycles: '0', bad_depth: '0' },
    note: '全局（含既有 21 行历史）cycles=0 且 bad_depth=0 ⇒ 新守卫与既有行相容、未引入追溯破坏',
  };
  if (g.cycles !== '0') reds.push(`用例④：全局 cycles = ${g.cycles} ≠ 0`);
  if (g.bad_depth !== '0') reds.push(`用例④：全局 bad_depth = ${g.bad_depth} ≠ 0`);
  if (perRow.some((r) => r.expected_depth !== r.actual_depth)) reds.push('用例④：本 RUN 写入行中存在 depth ≠ 期望');

  // ---------- 8 TS 端到端（合成 LD016 错误对象 ⇒ 借码语义，不写库）----------
  const synth = (reason: string) => {
    const le = ledgerErrorFromDbError({ code: STATE_BORROWED, message: 'LEDGER_AMOUNT_INVALID', detail: JSON.stringify({ reason }) });
    return le ? { code: le.code, status: le.status, httpStatus: le.httpStatus, reason: le.details.reason ?? null } : null;
  };
  out['8_ts_end_to_end_borrowed_code'] = { new_guard: synth(REASON_NEW), cycle: synth(REASON_CYCLE) };

  // ---------- 9 尾：指纹复核（本脚本只读，不改库结构）----------
  const guardFp3 = (await raw<{ prosrc: string }>(pool, `SELECT prosrc FROM pg_proc WHERE proname = 'referral_cycle_guard'`))[0]?.prosrc ?? '';
  out['9_post'] = {
    guard_fingerprint_md5: crypto.createHash('md5').update(guardFp3).digest('hex'),
    guard_unchanged_during_run: crypto.createHash('md5').update(guardFp3).digest('hex')
      === crypto.createHash('md5').update(guardFp).digest('hex'),
    schema_version: (await raw(pool, `SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1`))[0] ?? null,
    referral_rows_created_by_this_run: await raw(pool, `SELECT child_uid::text, parent_uid::text, depth::text FROM referral
                                                          WHERE child_uid = ANY($1::bigint[]) ORDER BY child_uid`, [ALL_UIDS.map(String)]),
  };

  out['assertions_failed'] = reds;
  out['ok'] = reds.length === 0;
  const file = path.join(OUT_DIR, `p1t-00-bind-protocol-guard-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ file, assertions_failed: reds, main_reads: {
    case1: c1.reads, case2: c2.reads, case3: c3.reads, case4: out['7_case4_depth_invariant'] }, ...({ ok: out['ok'] }) }, null, 1));
  const log = path.join(OUT_DIR, `p1t-00-stdout-${RUN}.txt`);
  fs.writeFileSync(log, jstr(out));
  await pool.end();
  if (ASSERT && reds.length > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
