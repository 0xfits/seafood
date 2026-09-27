/**
 * p2w-01 · **ns-alloc（共享命名空间分配器）验收探针** —— 本单 ① 的判据，全部给原始读数
 * ============================================================================
 * 被测对象：`scripts/ns-alloc.ts`（本仓库**唯一**的「每跑独占新命名空间」分配器）
 *   · `allocUidWindow`            —— 连续 N 个空闲 uid 的窗口（固定步长、可 env 指定基准）
 *   · `allocCurrencySymbol`       —— 未被占用的 `currency.symbol`
 *   · `allocIdempotencyKeyPrefix` —— 未被占用的幂等键前缀（扫 `ledger_entry`）
 *   · `allocNumericJobTag`        —— 全局唯一的 `biz:job:settle:<job_id>` 号段
 * 判据（逐条对应验收要求）
 *   ①A **连跑多次 ⇒ 每次不同且都空闲**：6 个不同 seed ⇒ 逐个返回的窗口**互不相同**（旋转挑选）且
 *      `occupiedUids(...) === []`（独立复核，不信分配器自述）；币符号 / 键前缀 / job 号段同法，且**逐个**回查
 *      `currency` / `ledger_entry` 确认「确实没人占用」。
 *   ①B **消耗即推进**：把一个窗口真正消耗掉（提交 `users` 行 = 永久占用）⇒ **同一 seed** 再分配**不再**返回它，
 *      且新窗口仍空闲 —— 复现「每跑独占」的关键性质（也解释为什么空间是**消耗品**：分区容量 = 窗口数上限）。
 *   ①C **空间不足不静默**（三条负例，**子进程真跑**，取真退出码）：占用态基准 ⇒ `ENV_BASE_UID_OCCUPIED`；
 *      分区被占满 ⇒ `NO_FREE_UID_WINDOW`；基准越界 ⇒ `ENV_BASE_UID_INVALID`。三者都必须 `exit 3`
 *      （`PRECONDITION_NOT_MET`）+ 明白话（stdout 机读 JSON / stderr 人类可读）。
 *   ①D **只读纪律**：分配前后 `users` / `referral` / `currency` / `ledger_entry` 计数逐项相等（分配本身不写库；
 *      只有 ①B 的「消耗」是本探针**故意**写的，另计）。
 * 附带取证（只读）：解释 `p2w-00` 上一跑 FATAL（`LEDGER_INSUFFICIENT_FROZEN`）的库上现状 ——
 *   同 symbol 名下 `account.balance/frozen` 被上一跑**真落账**花掉（⇒ 复用命名空间必然 `available=0`）。
 * ============================================================================
 * 分区约定（**本仓库全局**，勿越界）
 *   · `959001..959949` —— 探针主分区（`p2w-00` 等用例脚本从这里取窗口）
 *   · `959950..959996` —— 分配器**自测/消耗**块（本探针 ①B 用）
 *   · `959997..959999` —— 分配器**负例**块（本探针 ①C 用，先占满再跑）
 *   · symbol 前缀 `p1y` / 幂等键前缀 `ops:p1y:*`（硬约束）；**绝不触碰** `cid = 1` 与平台账户 0/-1/-2/-3 余额。
 * 用法
 *   npx ts-node --transpile-only scripts/p2w-01-ns-allocator-probe.ts [--assert]
 *   内部子进程模式：`... --exhaustion=env-occupied|no-window|env-invalid`（供 ①C 取真退出码）
 * 退出码：0 全绿 / 1 判红（`--assert`）/ 2 致命 / 3 前置不满足（负例子进程）
 * 落盘：`.p2w-artifacts/p2w-01-ns-allocator-<RUN>.json`（run-tagged）
 * ============================================================================
 */
import { spawnSync } from 'child_process';
import * as path from 'path';
import {
  allocUidWindow, allocCurrencySymbol, allocIdempotencyKeyPrefix, allocNumericJobTag,
  occupiedUids, windowUids, exitPrecondition,
} from './ns-alloc';
import { mkPool, raw, raw1, save, ensureUsers, RUN, type Qx } from './p2w-lib';

const ASSERT = process.argv.includes('--assert');
const EXH = (process.argv.find((a) => a.startsWith('--exhaustion=')) ?? '').split('=')[1] || null;

// 分区（见文件头约定）
const PART_MAIN: readonly [number, number] = [959001, 959949];
const PART_CONSUME: readonly [number, number] = [959950, 959996];
const PART_EXH: readonly [number, number] = [959997, 959999];
const SAFE_CEIL = 959999;                     // 本单分区上界（越界即判红）
const UID_COUNT = Number(process.env.P2W_PROBE_UID_COUNT ?? 45);
const SEEDS = ['probe#1', 'probe#2', 'probe#3', 'probe#4', 'probe#5', 'probe#6'];
const SYM_PREFIX = 'p1y';
const KEY_PREFIX = 'ops:p1y';

const reds: string[] = [];
const judge = (name: string, ok: boolean, extra?: unknown) => {
  if (!ok) reds.push(extra === undefined ? name : `${name} :: ${JSON.stringify(extra)}`);
};

(async () => {
  // ============================================================ 子进程模式：负例（真退出码）
  if (EXH) {
    const p = mkPool(2);
    const r = await allocUidWindow(p, { count: UID_COUNT, tagPrefix: 'p2w', partitions: [PART_EXH],
      envBase: process.env.P2W_BASE_UID ?? null, seed: `exhaustion:${EXH}` });
    if (r.ok) {
      console.log(JSON.stringify({ unexpected: 'ALLOC_SUCCEEDED_IN_NEGATIVE_CASE', base: r.uid_base, mode: EXH }));
      await p.end();
      process.exit(9);                            // 负例不该成功 ⇒ 明确非 0/3 的码，父进程判红
    }
    await p.end();
    exitPrecondition(r.fatal);                    // 打印机读 JSON + 明白话 + exit 3
    return;
  }

  const p = mkPool(4);
  const out: Record<string, unknown> = { run: RUN, ts: new Date().toISOString(),
    script: 'scripts/p2w-01-ns-allocator-probe.ts', partition_convention: {
      main: `${PART_MAIN[0]}..${PART_MAIN[1]}`, consume_block: `${PART_CONSUME[0]}..${PART_CONSUME[1]}`,
      negative_block: `${PART_EXH[0]}..${PART_EXH[1]}` }, uid_count: UID_COUNT, seeds: SEEDS };

  // ------------------------------------------------------------ 0 现状（只读）
  const counts = async () => ({
    users: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM users`))?.n,
    referral: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM referral`))?.n,
    currency: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM currency`))?.n,
    ledger_entry: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry`))?.n,
    occupied_959xxx: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM users WHERE uid BETWEEN 959000 AND 959999`))?.n,
    occupied_956xxx: (await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM users WHERE uid BETWEEN 956000 AND 956999`))?.n,
  });
  const before = await counts();
  out['0_before'] = before;
  out['0_db_facts_for_p2w00_fatal'] = {
    why: '解释 p2w-00 上一跑 FATAL LEDGER_INSUFFICIENT_FROZEN{cid,uid:956001,required:99000,available:0}',
    p1w_currencies: await raw(p, `SELECT symbol, cid::text AS cid, owner_uid::text AS owner, total_supply::text AS supply
        FROM currency WHERE symbol LIKE 'p1w%' ORDER BY cid::text::int`),
    emp_956001_accounts_in_p1w: await raw(p, `SELECT c.symbol, a.uid::text AS uid, a.cid::text AS cid,
        a.balance::text AS balance, a.frozen::text AS frozen, a.version::text AS version
      FROM account a JOIN currency c ON c.cid = a.cid
      WHERE a.uid = 956001 AND c.symbol LIKE 'p1w%' ORDER BY c.cid::text::int`),
    ledger_rows_under_p1w_keys: await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE 'ops:p1w:%'`),
    cid1_platform_accounts_untouched_check: await raw(p, `SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
      FROM account WHERE uid IN (-1,-2,-3) AND cid = 1 ORDER BY uid`),
  };

  // ------------------------------------------------------------ ①A 连跑多次 ⇒ 每次不同且空闲（只读）
  const uidRuns: Array<Record<string, unknown>> = [];
  for (const seed of SEEDS) {
    const a = await allocUidWindow(p, { count: UID_COUNT, tagPrefix: 'p2w', partitions: [PART_MAIN], seed });
    if (!a.ok) { reds.push(`①A uid 窗口分配失败（seed=${seed}）: ${JSON.stringify(a.fatal)}`); continue; }
    const indep = await occupiedUids(p, a.uids);                       // 独立复核（不信自述）
    uidRuns.push({ seed, base: a.uid_base, source: a.source, first: a.uids[0], last: a.uids[a.uids.length - 1],
      self_recheck: a.occupied_recheck, independent_occupied: indep,
      in_main_partition: a.uid_base >= PART_MAIN[0] && a.uid_base + UID_COUNT - 1 <= PART_MAIN[1],
      within_959xxx: a.uid_base >= 959000 && a.uid_base + UID_COUNT - 1 <= SAFE_CEIL });
    judge(`①A seed=${seed} 的窗口必须空闲（独立复核）`, indep.length === 0, indep);
    judge(`①A seed=${seed} 的窗口必须落在主分区内`, a.uid_base >= PART_MAIN[0] && a.uid_base + UID_COUNT - 1 <= PART_MAIN[1], a.uid_base);
  }
  const bases = uidRuns.map((r) => r.base);
  const distinct = new Set(bases).size;
  out['A1_uid_windows'] = { uid_count: UID_COUNT, runs: uidRuns, distinct_bases: distinct,
    all_free: uidRuns.every((r) => (r.independent_occupied as string[]).length === 0),
    note: '分配器**只读**：同一 DB 现状下，不同 seed 用「旋转挑选」返回不同窗口（否则 6 次会返回同一个）' };
  judge('①A 6 个 seed 至少给出 2 个**不同且都空闲**的窗口', distinct >= 2, bases);
  judge('①A 每个返回窗口的独立占用复核都为空', uidRuns.every((r) => (r.independent_occupied as string[]).length === 0), uidRuns);

  // 币符号 / 键前缀 / job 号段（同一批判据）
  const symRuns: Array<Record<string, unknown>> = [];
  const keyRuns: Array<Record<string, unknown>> = [];
  const jobRuns: Array<Record<string, unknown>> = [];
  for (const seed of SEEDS) {
    const s = await allocCurrencySymbol(p, { prefix: SYM_PREFIX, seed, tagPrefix: 'p2w' });
    const k = await allocIdempotencyKeyPrefix(p, { prefix: KEY_PREFIX, seed, tagPrefix: 'p2w' });
    const j = await allocNumericJobTag(p, { seed, tagPrefix: 'p2w' });
    if (!s.ok) { reds.push(`①A symbol 分配失败（seed=${seed}）: ${JSON.stringify(s.fatal)}`); continue; }
    if (!k.ok) { reds.push(`①A 键前缀分配失败（seed=${seed}）: ${JSON.stringify(k.fatal)}`); continue; }
    if (!j.ok) { reds.push(`①A job 号段分配失败（seed=${seed}）: ${JSON.stringify(j.fatal)}`); continue; }
    const symUsed = Number((await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM currency WHERE symbol = $1`, [s.symbol]))?.n) > 0;
    const keyUsed = Number((await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE $1`, [`${k.key_prefix}%`]))?.n) > 0;
    const jobUsed = Number((await raw1<{ n: string }>(p, `SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE $1`, [`biz:job:settle:${j.tag}%`]))?.n) > 0;
    symRuns.push({ seed, symbol: s.symbol, used: symUsed });
    keyRuns.push({ seed, key_prefix: k.key_prefix, used: keyUsed });
    jobRuns.push({ seed, tag: j.tag, used: jobUsed });
    judge(`①A seed=${seed} 的 symbol 必须未被占用`, !symUsed, s.symbol);
    judge(`①A seed=${seed} 的键前缀必须未被占用`, !keyUsed, k.key_prefix);
    judge(`①A seed=${seed} 的 job 号段必须未被占用`, !jobUsed, j.tag);
  }
  out['A2_symbol_suffix_keyprefix_jobtag'] = { symbols: symRuns, key_prefixes: keyRuns, job_tags: jobRuns,
    distinct_symbols: new Set(symRuns.map((r) => r.symbol)).size,
    distinct_key_prefixes: new Set(keyRuns.map((r) => r.key_prefix)).size,
    distinct_job_tags: new Set(jobRuns.map((r) => r.tag)).size };
  judge('①A 6 个 seed 的 symbol 互不相同且都未被占用',
    new Set(symRuns.map((r) => r.symbol)).size === symRuns.length && symRuns.every((r) => r.used === false), symRuns);
  judge('①A 6 个 seed 的键前缀互不相同且都未被占用',
    new Set(keyRuns.map((r) => r.key_prefix)).size === keyRuns.length && keyRuns.every((r) => r.used === false), keyRuns);
  judge('①A 6 个 seed 的 job 号段互不相同且都未被占用',
    new Set(jobRuns.map((r) => r.tag)).size === jobRuns.length && jobRuns.every((r) => r.used === false), jobRuns);
  judge('①A symbol 前缀必须是 p1y（硬约束）', symRuns.every((r) => String(r.symbol).startsWith('p1y')), symRuns);
  judge('①A 键前缀必须是 ops:p1y:（硬约束）', keyRuns.every((r) => String(r.key_prefix).startsWith('ops:p1y:')), keyRuns);

  // ------------------------------------------------------------ ①B 消耗 ⇒ 推进（本探针**故意**写 users 行，仅 3 个 uid）
  const SEED_C = 'consume-advance#1';
  const c1 = await allocUidWindow(p, { count: 3, tagPrefix: 'p2w', partitions: [PART_CONSUME], stride: 3, seed: SEED_C });
  if (!c1.ok) { reds.push(`①B 首次分配失败: ${JSON.stringify(c1.fatal)}`); }
  let c2: Record<string, unknown> | null = null;
  if (c1.ok) {
    const freeBefore = await occupiedUids(p, c1.uids);
    judge('①B 消耗前该窗口空闲', freeBefore.length === 0, freeBefore);
    await ensureUsers(p, c1.uids);                                   // ← 唯一的写：永久占用（users 行）
    const consumed = await occupiedUids(p, c1.uids);
    judge('①B 消耗后该窗口已被占用（users 行已落）', consumed.length === c1.uids.length, consumed);
    const a2 = await allocUidWindow(p, { count: 3, tagPrefix: 'p2w', partitions: [PART_CONSUME], stride: 3, seed: SEED_C });
    if (!a2.ok) reds.push(`①B 同 seed 再分配失败: ${JSON.stringify(a2.fatal)}`);
    else {
      const indep2 = await occupiedUids(p, a2.uids);
      c2 = { base: a2.uid_base, uids: a2.uids, independent_occupied: indep2 };
      judge('①B 同 seed 再分配**不再**返回已消耗窗口', a2.uid_base !== c1.uid_base, { first: c1.uid_base, second: a2.uid_base });
      judge('①B 新窗口仍空闲', indep2.length === 0, indep2);
      judge('①B 新窗口不与该种子原窗口重叠',
        a2.uids.every((u) => !c1.uids.includes(u)), { first: c1.uids, second: a2.uids });
    }
  }
  out['B_consume_advances'] = { seed: SEED_C, first_window: c1.ok ? { base: c1.uid_base, uids: c1.uids } : c1.fatal,
    second_window: c2, written: c1.ok ? c1.uids : [],
    note: '本探针唯一的写：3 个 users 行（959950..959996 保留块）；用于证明「消耗 ⇒ 窗口推进」' };

  // ------------------------------------------------------------ ①C 三条负例（子进程真跑，取真退出码）
  await ensureUsers(p, windowUids(PART_EXH[0], 3));                  // 先占满负例块（3 个 uid）
  const exChild = (mode: string, env: Record<string, string>) => {
    const bin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'ts-node');
    const r = spawnSync(bin, ['--transpile-only', __filename, `--exhaustion=${mode}`],
      { cwd: path.resolve(__dirname, '..'), encoding: 'utf8', env: { ...process.env, ...env } });
    let json: Record<string, unknown> | null = null;
    try { json = JSON.parse(r.stdout.trim().split('\n').slice(-12).filter((l) => l.trim().startsWith('{')).join('\n') || 'null'); }
    catch { /* noop */ }
    return { mode, env, status: r.status, stdout: (r.stdout ?? '').slice(0, 4000), stderr: (r.stderr ?? '').slice(0, 1200), json };
  };
  const negOccupiedBase = exChild('env-occupied', { P2W_BASE_UID: String(PART_EXH[0]), P2W_PROBE_UID_COUNT: '3' });
  const negNoWindow = exChild('no-window', { P2W_UID_PARTITION: `${PART_EXH[0]}-${PART_EXH[1]}`, P2W_PROBE_UID_COUNT: '3' });
  const negInvalidBase = exChild('env-invalid', { P2W_BASE_UID: '1', P2W_PROBE_UID_COUNT: '3' });
  out['C_negative_cases'] = { occupied_base: negOccupiedBase, no_window: negNoWindow, invalid_base: negInvalidBase };
  judge('①C 占用态基准 ⇒ exit 3 + ENV_BASE_UID_OCCUPIED',
    negOccupiedBase.status === 3 && negOccupiedBase.json?.kind === 'ENV_BASE_UID_OCCUPIED',
    { status: negOccupiedBase.status, kind: negOccupiedBase.json?.kind });
  judge('①C 分区占满 ⇒ exit 3 + NO_FREE_UID_WINDOW',
    negNoWindow.status === 3 && negNoWindow.json?.kind === 'NO_FREE_UID_WINDOW',
    { status: negNoWindow.status, kind: negNoWindow.json?.kind });
  judge('①C 基准越界 ⇒ exit 3 + ENV_BASE_UID_INVALID',
    negInvalidBase.status === 3 && negInvalidBase.json?.kind === 'ENV_BASE_UID_INVALID',
    { status: negInvalidBase.status, kind: negInvalidBase.json?.kind });
  judge('①C 负例的明白话里必须有 detail + hint',
    [negOccupiedBase, negNoWindow, negInvalidBase].every((c) => typeof c.json?.detail === 'string' && typeof c.json?.hint === 'string'),
    [negOccupiedBase.json, negNoWindow.json, negInvalidBase.json]);

  // ------------------------------------------------------------ ①D 只读纪律（分配前后计数：只允许 ①B 的 3+3 个 users 行净增）
  const after = await counts();
  out['D_after'] = after;
  const deltaUsers = Number(after.users) - Number(before.users);
  judge('①D 分配器本身不写库（users 净增 = ①B 的 3 + ①C 占满负例块的 3 = 6）', deltaUsers === 6, { before: before.users, after: after.users });
  judge('①D 分配不改 referral', after.referral === before.referral, { before: before.referral, after: after.referral });
  judge('①D 分配不改 currency', after.currency === before.currency, { before: before.currency, after: after.currency });
  judge('①D 分配不改 ledger_entry', after.ledger_entry === before.ledger_entry, { before: before.ledger_entry, after: after.ledger_entry });
  judge('①D 未触碰 cid=1 平台账户也不在本探针关注面（读数登记）', true);

  out['assertions_failed'] = reds;
  out['ok'] = reds.length === 0;
  const file = save('p2w-01-ns-allocator', out);
  console.log(JSON.stringify({ file, run: RUN, ok: out.ok, reds_count: reds.length, reds,
    uid_windows: bases, distinct_bases: distinct, negative_cases:
      [negOccupiedBase, negNoWindow, negInvalidBase].map((c) => ({ mode: c.mode, status: c.status, kind: c.json?.kind })) }, null, 1));
  await p.end();
  process.exit(ASSERT && reds.length > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
