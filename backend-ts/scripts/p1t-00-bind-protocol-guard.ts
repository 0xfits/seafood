/**
 * P1t-00 · **绑定协议守卫判负/正向用例**（`0010_referral_bind_protocol_guard.sql` 的可复核读数）
 * ============================================================================
 * 权威口径
 *   · `docs/commission.spec.md` §3.2（`depth = 父.depth + 1` 只校验**新插入的那条边** ⇒
 *     先绑叶、后绑父 ⇒ 既有下级行的 `depth` **就地失效**且（INSERT-only）**无法修正**）+ §3.3 + CR16。
 *   · Zang 裁定（本单）：真实协议 = **注册时绑一次、终身不变** ⇒ 「有下级者不可能之后才获得上级」
 *     ⇒ 把该协议变成**可强制的守卫**（`0010` 的 ④）。
 *
 * 本脚本交付的读数（**每条都给原始读数，不做「已通过」式口述**）
 *   ⓪ **可重跑设计（本次修订）**：本 RUN **独占一个全新 uid 窗口**（见下「uid 窗口」）。
 *   ⓪b **触发器启用态回归断言（本单新增）**：全局 `pg_trigger`（`public`、非 internal）**全部 `tgenabled='O'`**，
 *      否则判红并逐项列出异常项。成因：上一单 `p2d-01` 在事务内 `DISABLE TRIGGER` 后**未复原**，
 *      `trg_referral_append_only` 一度处于禁用态 —— 「不可变前提」必须进常态判据，不能只登记。
 *      判据实现见 `p1v-00-trigger-enablement-guard-assert.ts`（**同一份代码**，本脚本 import 复用；
 *      该文件自带「人为禁用 ⇒ 判红 ⇒ 同一事务内复原 ⇒ 判绿」的红色自证）。
 *   ① **判负（核心）**：先 `A→B`（`B` 是叶）再给 **`B`** 绑上级 `P` ⇒ **必须被拒**
 *      （`LD016` / `LEDGER_AMOUNT_INVALID`(400) + reason `REFERRAL_BIND_WOULD_STALE_DEPTH`）；
 *      且 `referral_bind()` 与**裸 INSERT** 两条路径**都**被拒（防「某个入口漏加锁」）。
 *      + **判负能力自证**：事务内 `DISABLE TRIGGER` 直插同一对边 ⇒ 机读判据 `bad_depth` **变红**
 *        （证明守卫拦的是真缺口，且本判据真的能红）⇒ 事务 `ROLLBACK` 复原。
 *        ⚠️ 该自证**每次运行都必须是「真插入真变红」**（见「可重跑设计」）—— 这是本脚本存在的意义。
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
 *   · 触发器启用态指纹：运行前/运行后 `pg_trigger` 逐字对比（证明本脚本 ROLLBACK 后零残留）。
 *
 * ---------------------------------------------------------------------------
 * uid 窗口（**可重跑设计**，本单修订的核心）
 *   `referral` 是 **INSERT-only**（`trg_referral_append_only`）且 `referral_bind` **幂等** ⇒ 用固定 uid 时
 *   第二次运行会「行已存在」：
 *     · `A→B` 已在 ⇒ 后文「绕开触发器直插两行」会撞 `referral_pk(child_uid)` ⇒ 自证**假红**（撞唯一键被
 *       误当成「判据红了」），或被迫退化成「只插缺的那条边 / 读旧行」的推演 ⇒ 判负原语不再是**真写**；
 *     · 正向/环/改绑用例也全部退化为 idempotent replay（`ok=true` 但**没有真插入**）⇒ 证据强度下降。
 *   两者都违背本脚本的用途。⇒ 采用 **(a) 每次运行独占一个全新 uid 窗口**（优于 (b) 固定 uid + 前置闸）：
 *     · 每 RUN 都是**新鲜夹具** ⇒ 判负自证是「真插 2 行 ⇒ `bad_depth` 真变红 ⇒ ROLLBACK」；
 *     · 无需人工清理（INSERT-only 表本来也删不了），无环境变量也能自动推进；
 *     · 分配是**确定性**的：扫 `users` / `referral.child_uid` / `referral.parent_uid` 找**第一个**
 *       整窗口空闲的基准（步长 10），或由 `P1T_BASE_UID` 显式指定；
 *     · 空间不足 / 指定窗口被占用 ⇒ **不静默、不假绿**：`exit 3` + `PRECONDITION_NOT_MET` 明白话
 *       （stdout + run-tagged 落盘），并说明怎么换窗口。
 *   窗口：基准 `base`，槽位 `base+0..base+8` =
 *     `A,B,P`（判负）/ `L,M,N`（正向）/ `X,Y`（环）/ `REBIND`（改绑对照）。分区 **955xxx**（`955001..955991`，
 *     步长 10 ⇒ 100 个窗口；每 RUN 净增 4 行 referral，无法清理）。
 *
 * 测试数据分区（**绝不越界**）：uid **955xxx**（本 RUN 独占窗口），symbol 前缀 `p1v`（本脚本**不建币**），
 *   幂等键前缀 `ops:p1v:*`（本脚本**不写账本**）⇒ 不可能触碰 `cid = 1` 与任何平台账户余额
 *   （`ledger_entry` / `account` 只读计数）。
 *
 * 用法
 *   cd backend-ts
 *   npx ts-node --transpile-only scripts/p1t-00-bind-protocol-guard.ts            # 只出读数
 *   npx ts-node --transpile-only scripts/p1t-00-bind-protocol-guard.ts --assert   # 任一条红 ⇒ exit 1
 *   P1T_BASE_UID=955011 npx ts-node --transpile-only scripts/p1t-00-... --assert  # 指定窗口（可选）
 *   P1T_RUN=<tag> ...                                                            # 工件标签（可选）
 * ⚠️ **前置：`0010` 必须已应用**（本脚本开头即校验 `referral_cycle_guard` 已含新 reason；未应用会
 *    `exit 3` **且不写任何数据** —— 否则旧守卫不拦，`B→P` 会真的写进不可删的 `referral`）。
 * ⚠️ **前置：`trg_referral_cycle_guard` 必须处于启用态**（0b 判据发现它被禁用 ⇒ 同样 `exit 3` 且不写数据，
 *    理由同上：禁用态下 `B→P` 会真的落库 ⇒ 永久污染 `depth` 不变式）。
 * 退出码：0 全绿 / 1 判红（`--assert`）/ 2 致命 / 3 前置不满足（`PRECONDITION_NOT_MET`，见 stdout 明白话）
 * 落盘：`.p1t-artifacts/p1t-00-bind-protocol-guard-<RUN>.json`（run-tagged，永不写固定名）
 * ============================================================================
 */
import './p1f-lib';                      // ⚠️ 必须先加载（绝对路径 .env.local），再加载 src/**
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import type { Pool } from '@neondatabase/serverless';
import { mkPool, raw, jstr } from './p1f-lib';
// 本单新增的回归判据（同一份实现，含自带红色自证）——见 scripts/p1v-00-trigger-enablement-guard-assert.ts
import { scanTriggerEnablement, triggerFingerprint, fpMd5, triggerScanReds } from './p1v-00-trigger-enablement-guard-assert';
import { ledgerErrorFromDbError } from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';

const RUN = process.env.P1T_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const OUT_DIR = path.resolve(__dirname, '..', '.p1t-artifacts');
const ASSERT = process.argv.includes('--assert');
const IDEM_PREFIX = 'ops:p1v:';          // 本单幂等键前缀（本脚本不写账本，登记前缀以备扩展）
const SYMBOL_PREFIX = 'p1v';             // 本单 symbol 前缀（本脚本不建币，登记前缀以备扩展）

// ---- uid 窗口（955xxx；本 RUN 独占一个窗口，理由见文件头「可重跑设计」）----
const UID_PARTITION_LO = 955001;                                    // 955xxx（952xxx 归上一单；952991..952998 是迁移自检）
const UID_PARTITION_HI = 955999;
const WINDOW_SLOTS = ['A', 'B', 'P', 'L', 'M', 'N', 'X', 'Y', 'REBIND'] as const;
type SlotName = typeof WINDOW_SLOTS[number];
const WINDOW_SIZE = WINDOW_SLOTS.length;                            // 9 槽
const WINDOW_STRIDE = 10;                                           // 基准步长（对齐好看 + 留 1 槽冗余）
const SLOT_ROLE: Record<SlotName, string> = {
  A: '① 判负：子（先绑 A→B）', B: '① 判负：叶（后绑 B→P 必须被拒）', P: '① 判负：上级',
  L: '② 正向：孙', M: '② 正向：子', N: '② 正向：根', X: '③ 2-环：子', Y: '③ 2-环：父',
  REBIND: '⑥ 改绑冲突对照（409）',
};

interface ProbeWindow { base: number; source: string; slots: Record<SlotName, number>; all: number[]; }

const windowUids = (base: number): number[] => WINDOW_SLOTS.map((_, i) => base + i);
const windowSlots = (base: number): Record<SlotName, number> => {
  const s = {} as Record<SlotName, number>;
  WINDOW_SLOTS.forEach((name, i) => { s[name] = base + i; });
  return s;
};

/** 窗口内有占用迹象的 uid（`references` 三处任一出现即视为占用；用 `users`，绝不写裸 `FROM user`） */
const occupiedInWindow = async (pool: Pool, base: number): Promise<string[]> =>
  (await raw<{ uid: string }>(pool, `
     SELECT u::text AS uid FROM unnest($1::bigint[]) AS u
      WHERE u IN (SELECT uid FROM users)
         OR u IN (SELECT child_uid FROM referral)
         OR u IN (SELECT parent_uid FROM referral)
      ORDER BY 1`, [windowUids(base).map(String)])).map((r) => r.uid);

/** 自动扫描：955xxx 内**第一个**整窗口空闲的基准（确定性；与 DB 现状一致 ⇒ 天然幂等推进） */
const AUTO_SCAN_SQL = `
  WITH cand(base) AS (SELECT generate_series($1::int, $2::int, $3::int))
  SELECT c.base::text AS base
    FROM cand c
   WHERE NOT EXISTS (
     SELECT 1 FROM generate_series(c.base, c.base + $4::int - 1) AS g(u)
      WHERE g.u IN (SELECT uid FROM users)
         OR g.u IN (SELECT child_uid FROM referral)
         OR g.u IN (SELECT parent_uid FROM referral))
   ORDER BY c.base LIMIT 1`;

const allocateProbeWindow = async (pool: Pool): Promise<{ win: ProbeWindow } | { fatal: Record<string, unknown> }> => {
  const forcedRaw = process.env.P1T_BASE_UID;
  if (forcedRaw !== undefined && forcedRaw !== '') {
    const forced = Number(forcedRaw);
    if (!Number.isInteger(forced) || forced < UID_PARTITION_LO || forced + WINDOW_SIZE - 1 > UID_PARTITION_HI) {
      return { fatal: { fatal: 'PRECONDITION_NOT_MET',
        detail: `P1T_BASE_UID=${forcedRaw} 非法：必须是整数且整个窗口 [base, base+${WINDOW_SIZE - 1}] 落在 955xxx 分区 [${UID_PARTITION_LO}, ${UID_PARTITION_HI}] 内`,
        hint: `例：P1T_BASE_UID=955011 ⇒ 窗口 955011..955019` } };
    }
    const occ = await occupiedInWindow(pool, forced);
    if (occ.length > 0) {
      return { fatal: { fatal: 'PRECONDITION_NOT_MET',
        detail: `P1T_BASE_UID=${forced} 的窗口内有已占用 uid（窗口必须**全新**）`,
        occupied_uids: occ,
        why: 'referral 是 INSERT-only 且 referral_bind 幂等：窗口不新鲜时「绕开触发器直插两行」会撞 referral_pk(child_uid)，判负自证会失真（假红）',
        hint: '换一个空闲窗口（步长 10，如 955011 / 955021 / …），或**不要**设 P1T_BASE_UID 让脚本自动扫描下一个空闲窗口' } };
    }
    return { win: { base: forced, source: 'env:P1T_BASE_UID', slots: windowSlots(forced), all: windowUids(forced) } };
  }
  const row = (await raw<{ base: string }>(pool, AUTO_SCAN_SQL,
    [String(UID_PARTITION_LO), String(UID_PARTITION_HI - WINDOW_SIZE + 1), String(WINDOW_STRIDE), String(WINDOW_SIZE)]))[0];
  if (!row) {
    return { fatal: { fatal: 'PRECONDITION_NOT_MET',
      detail: `uid 窗口耗尽：955xxx 分区内已无「连续 ${WINDOW_SIZE} 个全空闲 uid」的窗口（扫描基准 ${UID_PARTITION_LO}..${UID_PARTITION_HI - WINDOW_SIZE + 1}，步长 ${WINDOW_STRIDE}）`,
      why: 'referral 是 INSERT-only（append-only 触发器）且 referral_bind 幂等 ⇒ 每次运行必须换新 uid 窗口，否则判负自证会撞已存在的行而失真',
      hint: `确认无外部引用后清理 955xxx 探针行，或显式指定 P1T_BASE_UID=<空闲窗口基准>（窗口 ${WINDOW_SIZE} 槽、步长 ${WINDOW_STRIDE}）` } };
  }
  const base = Number(row.base);
  const occ = await occupiedInWindow(pool, base);      // 硬复核（防「扫描 → 占用」竞态）
  if (occ.length > 0) {
    return { fatal: { fatal: 'PRECONDITION_NOT_MET',
      detail: `自动扫描选中的窗口 ${base} 复核时已被占用（并发运行同一脚本？）`, occupied_uids: occ } };
  }
  return { win: { base, source: 'auto-scan', slots: windowSlots(base), all: windowUids(base) } };
};

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
  const writeArtifact = (): string => {
    out['assertions_failed'] = reds;
    out['ok'] = reds.length === 0;
    const f = path.join(OUT_DIR, `p1t-00-bind-protocol-guard-${RUN}.json`);
    fs.writeFileSync(f, JSON.stringify(out, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, `p1t-00-stdout-${RUN}.txt`), jstr(out));
    return f;
  };

  const guardFp = (await raw<{ prosrc: string }>(pool, `SELECT prosrc FROM pg_proc WHERE proname = 'referral_cycle_guard'`))[0]?.prosrc ?? '';

  // ⚠️ 前置闸 1：0010 **必须已应用**。否则本脚本的 ① 会真的把「B→P」写进不可删的 `referral`
  //    （旧守卫不拦）⇒ 永久污染 `depth` 不变式。⇒ 缺守卫时**立即退出，不写任何数据**。
  if (!guardFp.includes(REASON_NEW)) {
    const fatal = { fatal: 'PRECHECK_FAILED', run: RUN,
      detail: 'referral_cycle_guard 不含 REFERRAL_BIND_WOULD_STALE_DEPTH ⇒ 0010 未应用；运行本脚本会污染 referral.depth（INSERT-only），已中止',
      installed_guard_md5: crypto.createHash('md5').update(guardFp).digest('hex') };
    out['fatal'] = fatal;
    console.log(JSON.stringify(fatal, null, 1));
    await pool.end();
    process.exit(3);
  }

  // ---------- 前置闸 2：分配本 RUN 的 uid 窗口（**无写**；失败即 exit 3 + 明白话）----------
  const alloc = await allocateProbeWindow(pool);
  if ('fatal' in alloc) {
    out['fatal'] = alloc.fatal;
    out['uid_window_allocation'] = { partition: `[${UID_PARTITION_LO}, ${UID_PARTITION_HI}]`, window_size: WINDOW_SIZE, stride: WINDOW_STRIDE, requested_env: process.env.P1T_BASE_UID ?? null };
    const file = writeArtifact();
    console.log(JSON.stringify({ ...alloc.fatal, run: RUN, file, assertions_failed: reds }, null, 1));
    console.error(`PRECONDITION_NOT_MET：${String((alloc.fatal as { detail?: string }).detail ?? '')}`);
    await pool.end();
    process.exit(3);
  }
  const win = alloc.win;
  const { A, B, P, L, M, N, X, Y, REBIND } = win.slots;
  const ALL_UIDS = win.all;
  out['uid_window'] = {
    base: win.base, source: win.source, size: WINDOW_SIZE, stride: WINDOW_STRIDE,
    partition: `[${UID_PARTITION_LO}, ${UID_PARTITION_HI}]`,
    slots: Object.fromEntries(WINDOW_SLOTS.map((n) => [n, { uid: win.slots[n], role: SLOT_ROLE[n] }])),
    fresh_verified_occupied: await occupiedInWindow(pool, win.base),
    note: '每次运行独占一个全新窗口（referral 是 INSERT-only + 绑定幂等 ⇒ 固定 uid 的第二次运行会让「绕开触发器直插」撞 referral_pk，判负自证失真）',
  };
  if ((out['uid_window'] as { fresh_verified_occupied: string[] }).fresh_verified_occupied.length > 0) {
    reds.push('uid 窗口分配后复核发现占用 ⇒ 夹具不新鲜（判负自证会失真）');
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
    symbol_prefix_reserved: SYMBOL_PREFIX,
    guard_code_borrowed: (await raw(pool, `SELECT ledger_error_for_sqlstate($1::text) AS j, ledger_sqlstate_of('LEDGER_AMOUNT_INVALID') AS projection`, [STATE_BORROWED]))[0],
    closed_set_size: LEDGER_ERROR_CODES.length,
  };

  // ---------- 0b **本单新增判据**：全局 public 非 internal 触发器必须全部 tgenabled='O' ----------
  //    成因：上一单 p2d-01 在事务内 DISABLE trg_referral_append_only 后未复原，append-only「不可变前提」
  //    一度被削弱却无人判红 ⇒ 纳入常态判据。判据实现与红色自证见 scripts/p1v-00-*（同一份代码）。
  const trigPre = await scanTriggerEnablement(pool);
  const fpTrigPre = await triggerFingerprint(pool);
  out['0b_trigger_enablement_precheck'] = {
    ...trigPre, fingerprint_md5: fpMd5(fpTrigPre), fingerprint: fpTrigPre,
    rule: `public 下全部非 internal 触发器 tgenabled='O'（enabled）；任一 D(disabled)/R(replica)/A(always) ⇒ 判红并逐项列出`,
    vacuous_rule: '扫到 0 条 ⇒ 视为真空 ⇒ 同样判红（防「触发器被删光」骗过判据）',
    why: '上一单事务内 DISABLE 后未复原；不可变前提必须进常态判据，不能只登记',
  };
  reds.push(...triggerScanReds(trigPre, '0b 触发器启用态'));
  const guardTriggerDisabled = trigPre.anomalies.some((a) => a.table === 'referral' && a.trigger === 'trg_referral_cycle_guard');
  if (guardTriggerDisabled) {
    const fatal = { fatal: 'PRECONDITION_NOT_MET', run: RUN,
      detail: 'trg_referral_cycle_guard 处于禁用态 ⇒ 继续跑会把「已有下级者绑上级」的 stale-depth 边**真的写进** INSERT-only 的 referral（不可改、不可删）⇒ 永久污染 depth 不变式',
      anomalies: trigPre.anomalies,
      remedy: 'ALTER TABLE public.referral ENABLE TRIGGER trg_referral_cycle_guard;（若在事务内禁用，请在**同一事务内**复原）后重跑；判据与红色自证见 scripts/p1v-00-trigger-enablement-guard-assert.ts',
      assertions_failed: reds };
    out['fatal'] = fatal;
    const file = writeArtifact();
    console.log(JSON.stringify({ ...fatal, file }, null, 1));
    console.error('PRECONDITION_NOT_MET：trg_referral_cycle_guard 被禁用（见 stdout 的 anomalies）');
    await pool.end();
    process.exit(3);
  }

  // ---------- 1 前置：测试用户（本 RUN 窗口 = 全新 uid）----------
  await raw(pool, `INSERT INTO users (uid, evm) SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0')
                     FROM unnest($1::bigint[]) AS u ON CONFLICT (uid) DO NOTHING`, [ALL_UIDS.map(String)]);
  out['1_users'] = await raw(pool, `SELECT count(*)::text n FROM users WHERE uid = ANY($1::bigint[])`, [ALL_UIDS.map(String)]);

  // ---------- 2 判负能力自证：绕过守卫（事务内）直插「先绑叶、后绑父」⇒ bad_depth 必须变红 ----------
  //    这一条证明 ① 的判据**真的能红**（不是「恒绿判据」），且 spec §3.2 的现象在本库可复现。
  //    ⚠️ 必须**真插入真变红**：故前置断言窗口新鲜（占用行 = 0），并回读落库行数与 depth 读数。
  const bc = await pool.connect();
  let bypass: Record<string, unknown> = {};
  const countProbeRows = async (c: { query: (sql: string, p?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> }): Promise<number> =>
    Number(String((await c.query(`SELECT count(*)::text AS n FROM referral
       WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`, [[A, B, P].map(String)])).rows[0].n));
  try {
    await bc.query('BEGIN');
    const preRows = await countProbeRows(bc);
    await bc.query('ALTER TABLE referral DISABLE TRIGGER trg_referral_cycle_guard');
    const ins = await bc.query(`INSERT INTO referral (child_uid, parent_uid, depth) VALUES ($1,$2,1),($2,$3,1)`,
      [String(A), String(B), String(P)]);       // A→B (depth 1)、B→P (depth 1，应为 2)
    const mx = async (sql: string) => (await bc.query(sql)).rows[0] as Record<string, string>;
    const readback = await bc.query(`SELECT child_uid::text, parent_uid::text, depth::text FROM referral
        WHERE child_uid = ANY($1::bigint[]) ORDER BY child_uid`, [[A, B, P].map(String)]);
    bypass = { pre_existing_rows_in_window: preRows, inserted_rowcount: ins.rowCount ?? null,
      rows_after_bypass_insert: await countProbeRows(bc), injected_edges: [`${A}->${B}`, `${B}->${P}`],
      injected_edges_readback: readback.rows, depth_of_B_must_be_2_but_is: readback.rows.find((r) => String(r.child_uid) === String(B))?.depth ?? null,
      cycles: (await mx(MX_CYCLES)).cycles, bad_depth: (await mx(MX_BADDEPTH)).bad_depth,
      expected: 'bad_depth >= 1（叶/父顺序被追溯破坏：B 的 depth 应为 2）' };
    await bc.query('ROLLBACK');
  } catch (e) { await bc.query('ROLLBACK').catch(() => undefined); bypass = { error: errRec(e) }; }
  finally { bc.release(); }
  out['2_falsification_bypass_rolled_back'] = { ...bypass,
    note: '事务内 DISABLE TRIGGER + **真插 2 行** ⇒ 测量后 ROLLBACK，零残留；用于证明 ① 的判据可红' };
  if (bypass.error) {
    reds.push(`判负能力自证失败：绕开守卫的事务抛错 ⇒ ${JSON.stringify(bypass.error)}`);
  } else {
    if (Number(bypass.pre_existing_rows_in_window) !== 0) {
      reds.push(`判负能力自证前置失败：窗口内已有 ${String(bypass.pre_existing_rows_in_window)} 行（夹具不新鲜 ⇒ 自证不可信；请换 uid 窗口）`);
    }
    if (Number(bypass.inserted_rowcount) !== 2 || Number(bypass.rows_after_bypass_insert) !== Number(bypass.pre_existing_rows_in_window) + 2) {
      reds.push(`判负能力自证失败：绕开触发器的直插未落 2 行（rowcount=${String(bypass.inserted_rowcount)}）⇒ 该步没在「真插入」上成立`);
    }
    if (String(bypass.depth_of_B_must_be_2_but_is) !== '1') {
      reds.push(`判负能力自证失真：直插后 B 的 depth = ${String(bypass.depth_of_B_must_be_2_but_is)} ≠ 1（stale-depth 场景未构造出来）`);
    }
    if (String(bypass.bad_depth ?? '0') === '0') reds.push('判负能力自证失败：绕过守卫后 bad_depth 未变红');
  }
  const afterBypass = { cycles: (await raw<{ cycles: string }>(pool, MX_CYCLES))[0].cycles,
    bad_depth: (await raw<{ bad_depth: string }>(pool, MX_BADDEPTH))[0].bad_depth };
  const rowsForProbe = await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral
      WHERE child_uid = ANY($1::bigint[]) OR parent_uid = ANY($1::bigint[])`, [[A, B, P].map(String)]);
  out['2b_referral_after_bypass'] = { ...afterBypass, rows_for_probe_uids: rowsForProbe[0],
    note: 'ROLLBACK 后本 RUN 窗口内应当 0 行（零残留）' };
  if (rowsForProbe[0].n !== '0') reds.push(`绕过自证 ROLLBACK 后有残留行（${rowsForProbe[0].n} 行）`);

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
    note: '全局（含既有历史行）cycles=0 且 bad_depth=0 ⇒ 新守卫与既有行相容、未引入追溯破坏',
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

  // ---------- 9 尾：指纹复核（含**本单新增**的触发器启用态收尾复核）----------
  const guardFp3 = (await raw<{ prosrc: string }>(pool, `SELECT prosrc FROM pg_proc WHERE proname = 'referral_cycle_guard'`))[0]?.prosrc ?? '';
  const trigPost = await scanTriggerEnablement(pool);
  const fpTrigPost = await triggerFingerprint(pool);
  out['9_post'] = {
    guard_fingerprint_md5: crypto.createHash('md5').update(guardFp3).digest('hex'),
    guard_unchanged_during_run: crypto.createHash('md5').update(guardFp3).digest('hex')
      === crypto.createHash('md5').update(guardFp).digest('hex'),
    schema_version: (await raw(pool, `SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1`))[0] ?? null,
    trigger_enablement_after: { ...trigPost, fingerprint_md5: fpMd5(fpTrigPost) },
    trigger_fingerprint_unchanged_by_this_run: fpMd5(fpTrigPost) === fpMd5(fpTrigPre),
    trigger_fingerprint_diff: Object.keys({ ...fpTrigPre, ...fpTrigPost })
      .filter((k) => fpTrigPre[k] !== fpTrigPost[k]).map((k) => `${k}: ${fpTrigPre[k]} -> ${fpTrigPost[k]}`),
    note: '自证那一步在事务内 DISABLE 了 trg_referral_cycle_guard 并 ROLLBACK ⇒ 此处复核「本 RUN 结束后 pg_trigger 指纹与运行前逐字一致」',
    referral_rows_created_by_this_run: await raw(pool, `SELECT child_uid::text, parent_uid::text, depth::text FROM referral
                                                          WHERE child_uid = ANY($1::bigint[]) ORDER BY child_uid`, [ALL_UIDS.map(String)]),
  };
  reds.push(...triggerScanReds(trigPost, '9 尾复核'));
  if (!out['9_post'] || !(out['9_post'] as { trigger_fingerprint_unchanged_by_this_run: boolean }).trigger_fingerprint_unchanged_by_this_run) {
    reds.push('尾复核：本 RUN 结束后 pg_trigger 指纹与运行前不一致（本脚本必须零残留，含自证事务的 DISABLE 复原）');
  }

  out['uid_window_base'] = win.base;
  const file = writeArtifact();
  console.log(JSON.stringify({ file, run: RUN, uid_window_base: win.base, uid_window_source: win.source,
    assertions_failed: reds, main_reads: {
      case1: c1.reads, case2: c2.reads, case3: c3.reads,
      case4: out['7_case4_depth_invariant'],
      bypass_selfproof: { inserted_rowcount: bypass.inserted_rowcount, bad_depth: bypass.bad_depth, rolled_back: !bypass.error },
      trigger_enablement: { total: trigPre.total, enabled: trigPre.enabled, anomalies: trigPre.anomalies,
        post_total: trigPost.total, post_enabled: trigPost.enabled, post_anomalies: trigPost.anomalies },
    }, ...({ ok: out['ok'] }) }, null, 1));
  await pool.end();
  if (ASSERT && reds.length > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
