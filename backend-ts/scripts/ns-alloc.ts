/**
 * ns-alloc —— **共享的「每跑独占新命名空间」分配器**（本仓库唯一实现）
 * ============================================================================
 * 为什么需要它（**结构性**根因，不是「脚本没写好」）
 *   · `ledger_entry` 是 append-only（`idempotency_key` 唯一、事件根键不可删）⇒ **夹具不可复位**；
 *   · `referral` 是 INSERT-only（`trg_referral_append_only`）+ `referral_bind` 幂等 ⇒ 固定 uid 的第二跑
 *     要么「行已存在」⇒ 判负原语退化成 idempotent replay（**假绿**），要么撞 `referral_pk`（**假红**）；
 *   · `currency.symbol` 唯一 ⇒ 固定 symbol 的第二跑复用**同一条**币行，而它名下的 `account.balance/frozen`
 *     已被上一跑的**真落账**花掉 ⇒ `LEDGER_INSUFFICIENT_FROZEN`（本仓库已因此报废两个探针：`p1t-00` 旧版、`p2w-00`）。
 *   ⇒ 结论：探针的可重跑性**只能**靠「每跑独占一段全新命名空间」（uid 窗口 / 币符号 / 幂等键前缀 / job 号段），
 *     不能靠「清理」或「复位」。本文件是**唯一实现**：`p1t-00`、`p2w-00` 都 **import** 它，
 *     各脚本**不得**再复制一份扫描逻辑（复制出来的那份迟早与这份漂移）。
 *
 * 纪律（逐字遵守）
 *   · 分配是**纯只读**：只扫 `users` ∪ `referral.child_uid` ∪ `referral.parent_uid` / `currency` /
 *     `ledger_entry`；**不 INSERT/UPDATE/DELETE 任何行**。身份表名一律 `users`（**绝不写裸 `FROM user`**）。
 *   · 空间不足 / env 非法 / 指定窗口已占用 ⇒ **不静默、不假绿**：返回
 *     `{ ok: false, fatal: { fatal: 'PRECONDITION_NOT_MET', detail, hint, ... } }`，
 *     由调用方 `exitPrecondition()` 落盘 + `exit 3` + 明白话（stdout 机读 JSON / stderr 人类可读）。
 *   · 分配后**硬复核**一次（防「扫描 → 占用」竞态：同一脚本被并发跑）。
 *   · 命名空间候选是**确定性**的：由 `seed`（run tag）派生，逐个候选验证「未被占用」，用尽候选即失败。
 *
 * 用法（典型）
 *   const ns = await allocNamespace(pool, { tagPrefix: 'p2w', seed: RUN, uidCount: 45, uidStride: 50,
 *     uidPartitions: [[959001, 959999]], symbolPrefix: 'p1y', keyPrefix: 'ops:p1y' });
 *   if (!ns.ok) await exitPrecondition(ns.fatal);      // 落盘 + exit 3（绝不继续跑）
 *   ns.uids / ns.symbol / ns.key_prefix / ns.uid_base
 * 环境变量（**总是**可显式覆盖，便于换窗口/扩分区）
 *   · `<TAG>_BASE_UID`      指定窗口基准（必须整窗落在分区内且**全空闲**；不新鲜 ⇒ exit 3）
 *   · `<TAG>_UID_PARTITION` 覆盖扫描分区，形如 `959001-959999` 或 `958001-958999,959001-959999`
 * ============================================================================
 */
import * as crypto from 'crypto';

/** 只读查询执行器（`Pool` / `tx client` 都满足；本库不关心连接方式） */
export interface NsQuery {
  query(sql: string, params?: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** 前置不满足（空间不足 / env 非法 / 窗口被占用）⇒ 调用方 `exitPrecondition()` ⇒ `exit 3` */
export interface NsFatal {
  fatal: 'PRECONDITION_NOT_MET';
  /** 机读细分：NO_FREE_UID_WINDOW / ENV_BASE_UID_INVALID / ENV_BASE_UID_OCCUPIED / RACE_WINDOW_TAKEN / NO_FREE_SYMBOL / NO_FREE_KEY_PREFIX / NO_FREE_JOB_TAG */
  kind: string;
  detail: string;
  hint: string;
  [k: string]: unknown;
}

export type Alloc<T> = ({ ok: true } & T) | { ok: false; fatal: NsFatal };

// ---------------------------------------------------------------- 小工具
const sha256 = (v: unknown): string => crypto.createHash('sha256').update(String(v)).digest('hex');

/** 由 `seed + 序号` 派生**确定性**候选 token（base36 小写数字；同一 seed ⇒ 同一候选序列） */
export const token = (seed: string, i: number, len = 6): string =>
  BigInt('0x' + sha256(`${seed}:${i}`).slice(0, 16)).toString(36).padStart(len, '0').slice(0, len);

export const windowUids = (base: number, count: number): string[] =>
  Array.from({ length: count }, (_, i) => String(base + i));

export const fmtPartitions = (parts: ReadonlyArray<readonly [number, number]>): string =>
  parts.map(([lo, hi]) => `${lo}..${hi}`).join(',');

/** 分区（+可选步长/槽数）的**容量**（用于「空间不足」的明白话：说清还剩几个窗口） */
export const windowCapacity = (parts: ReadonlyArray<readonly [number, number]>, count: number, stride: number): number =>
  parts.reduce((a, [lo, hi]) => a + (hi - count + 1 < lo ? 0 : Math.floor((hi - count + 1 - lo) / stride) + 1), 0);

/** env 覆盖分区：`"959001-959999"` / `"958001-958999,959001-959999"`；非法 ⇒ 抛错（调用方转 fatal） */
export const parsePartitions = (raw: string): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (const seg of raw.split(',').map((s) => s.trim()).filter((s) => s !== '')) {
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(seg);
    if (!m) throw new Error(`分区段「${seg}」非法（形如 959001-959999）`);
    const lo = Number(m[1]); const hi = Number(m[2]);
    if (!Number.isInteger(lo) || !Number.isInteger(hi) || lo > hi) throw new Error(`分区段「${seg}」非法（要求 lo ≤ hi 且为整数）`);
    out.push([lo, hi]);
  }
  if (out.length === 0) throw new Error('分区为空');
  return out;
};

// ---------------------------------------------------------------- ① uid 窗口
const UID_OCCUPIED_SQL = `
  SELECT u::text AS uid FROM unnest($1::bigint[]) AS u
   WHERE u IN (SELECT uid FROM users)
      OR u IN (SELECT child_uid FROM referral)
      OR u IN (SELECT parent_uid FROM referral)
   ORDER BY 1`;

/** 窗口内**已被占用**的 uid（`users` ∪ `referral.child_uid` ∪ `referral.parent_uid`；只读） */
export const occupiedUids = async (ex: NsQuery, uids: ReadonlyArray<string>): Promise<string[]> =>
  (await ex.query(UID_OCCUPIED_SQL, [uids.slice()])).rows.map((r) => String(r.uid));

/** 自动扫描：**按 run tag 旋转**选一个「连续 count 个全空闲」的基准（步长 stride；确定性、只挑空闲窗口）
 *  旋转而非「永远取第一个」的理由：本函数**只读**，若恒取第一个空闲窗口，则「同一 DB 现状下的两次分配」
 *  会返回同一个窗口；旋转让不同 seed ⇒ 不同窗口（**每次运行拿到不同且空闲的窗口**是可验收性质），
 *  而占用集合始终排除已用窗口 ⇒ 每个 run 仍独占一段全新空间、不重叠、不浪费容量。 */
const AUTO_SCAN_SQL = `
  WITH part(lo, hi) AS (SELECT * FROM unnest($1::int[], $2::int[])),
       cand(base)  AS (SELECT generate_series(p.lo, p.hi - $3::int + 1, $4::int) FROM part p),
       free(base)  AS (SELECT c.base FROM cand c
                        WHERE NOT EXISTS (
                          SELECT 1 FROM generate_series(c.base, c.base + $3::int - 1) AS g(u)
                           WHERE g.u IN (SELECT uid FROM users)
                              OR g.u IN (SELECT child_uid FROM referral)
                              OR g.u IN (SELECT parent_uid FROM referral))),
       numbered AS (SELECT f.base, (row_number() OVER (ORDER BY f.base)) - 1 AS idx, count(*) OVER () AS n FROM free f)
  SELECT base::text AS base, n::text AS n, idx::text AS idx
    FROM numbered WHERE idx = ($5::bigint % n)`;

export interface UidWindowOpts {
  /** 连续槽位数（一个 run 独占这一段） */
  count: number;
  /** 本单分区标签（例 `p2w`）⇒ env `<TAG>_BASE_UID` / `<TAG>_UID_PARTITION`（大写） */
  tagPrefix: string;
  /** 允许扫描的分区（按序尝试；第一个有整窗空闲的分区胜出） */
  partitions: ReadonlyArray<readonly [number, number]>;
  /** 窗口基准步长（默认 = count，即紧排；对齐好看可设更大值） */
  stride?: number;
  /** run tag：决定「选哪一个空闲窗口」（旋转）；缺省用 tagPrefix ⇒ 同一进程内可复现 */
  seed?: string;
  envBase?: string | number | null;
  /** 为什么本 run 必须独占全新窗口（写进 fatal 的明白话；不同脚本理由不同，故由调用方给） */
  purpose?: string;
  hint?: string;
}

export interface UidWindow {
  ok: true;
  uid_base: number;
  uids: string[];
  source: string;
  partition: [number, number];
  stride: number;
  /** 分配后硬复核读到的占用（必须为空数组；非空 ⇒ 竞态，判红） */
  occupied_recheck: string[];
}

export const allocUidWindow = async (ex: NsQuery, o: UidWindowOpts): Promise<Alloc<UidWindow>> => {
  const TAG = o.tagPrefix.toUpperCase();
  const stride = o.stride ?? o.count;
  const base = (why: string, extra: Record<string, unknown>, hint: string): Alloc<UidWindow> =>
    ({ ok: false, fatal: { fatal: 'PRECONDITION_NOT_MET', kind: why, detail: String(extra.detail ?? ''), hint, ...extra } as NsFatal });
  let partitions: Array<[number, number]>;
  try {
    const rawParts = process.env[`${TAG}_UID_PARTITION`];
    partitions = rawParts ? parsePartitions(rawParts) : o.partitions.map(([a, b]) => [a, b] as [number, number]);
  } catch (e) {
    return base('ENV_UID_PARTITION_INVALID',
      { detail: `${TAG}_UID_PARTITION="${String(process.env[`${TAG}_UID_PARTITION`])}" 非法：${String((e as Error).message)}`, partitions_requested: o.partitions },
      `例：${TAG}_UID_PARTITION=959001-959999（多段用逗号）`);
  }
  const partText = fmtPartitions(partitions);
  const cap = windowCapacity(partitions, o.count, stride);
  const purpose = o.purpose ?? '夹具不可复位（append-only 账本 / INSERT-only referral / 唯一 symbol）⇒ 每一跑必须换新命名空间';

  // ---- 显式基准（env）：整窗必须落在分区内，且**全空闲**
  const forcedRaw = o.envBase ?? process.env[`${TAG}_BASE_UID`];
  if (forcedRaw !== undefined && forcedRaw !== null && String(forcedRaw) !== '') {
    const forced = Number(forcedRaw);
    const inside = partitions.some(([lo, hi]) => forced >= lo && forced + o.count - 1 <= hi);
    if (!Number.isInteger(forced) || !inside) {
      return base('ENV_BASE_UID_INVALID',
        { detail: `${TAG}_BASE_UID=${String(forcedRaw)} 非法：必须是整数且整个窗口 [base, base+${o.count - 1}] 落在分区 ${partText} 内`, partitions, window_count: o.count, stride },
        `例：${TAG}_BASE_UID=${partitions[0][0]} ⇒ 窗口 ${partitions[0][0]}..${partitions[0][0] + o.count - 1}`);
    }
    const occ = await occupiedUids(ex, windowUids(forced, o.count));
    if (occ.length > 0) {
      return base('ENV_BASE_UID_OCCUPIED',
        { detail: `${TAG}_BASE_UID=${forced} 的窗口内有已占用 uid（窗口必须**全新**）`, occupied_uids: occ, window: [forced, forced + o.count - 1], why: purpose },
        o.hint ?? `换一个空闲窗口（步长 ${stride}），或**不要**设 ${TAG}_BASE_UID 让脚本自动扫描下一个空闲窗口`);
    }
    return { ok: true, uid_base: forced, uids: windowUids(forced, o.count), source: `env:${TAG}_BASE_UID`,
      partition: partitions.find(([lo, hi]) => forced >= lo && forced + o.count - 1 <= hi)!, stride, occupied_recheck: occ };
  }

  // ---- 自动扫描：按 seed 旋转选一个整窗空闲的基准（见 AUTO_SCAN_SQL 注释）
  let row: Record<string, unknown> | undefined;
  const rotate = BigInt('0x' + sha256(`${o.seed ?? o.tagPrefix}:rotate`).slice(0, 15)).toString();
  try {
    row = (await ex.query(AUTO_SCAN_SQL, [partitions.map(([lo]) => String(lo)), partitions.map(([, hi]) => String(hi)),
      String(o.count), String(stride), rotate])).rows[0];
  } catch (e) {
    return base('SCAN_FAILED', { detail: `扫描分区失败：${String((e as Error).message)}`, partitions }, '检查分区是否为空/参数是否为整数');
  }
  if (!row) {
    return base('NO_FREE_UID_WINDOW',
      { detail: `uid 空间不足：分区 ${partText} 内已无「连续 ${o.count} 个全空闲 uid」的窗口（扫描基准步长 ${stride}，理论上限 ${cap} 个窗口）`,
        partitions, window_count: o.count, stride, capacity_windows: cap, why: purpose,
        note: '每个 run 都会永久占用若干 uid（users 行 + 已提交的 referral 行），故窗口是**消耗品**' },
      o.hint ?? `扩大分区后重跑（例：export ${TAG}_UID_PARTITION="958001-958999,959001-959999"），或确认无外部引用后人工登记清理该分区`);
  }
  const uidBase = Number(row.base);
  const occ = await occupiedUids(ex, windowUids(uidBase, o.count));   // 硬复核（防「扫描 → 占用」竞态）
  if (occ.length > 0) {
    return base('RACE_WINDOW_TAKEN',
      { detail: `自动扫描选中的窗口 ${uidBase} 在复核时已被占用（同一脚本并发在跑？）`, occupied_uids: occ, window: [uidBase, uidBase + o.count - 1] },
      '等对方跑完再重跑（本库不做加锁，因为夹具本身不可复位）');
  }
  return { ok: true, uid_base: uidBase, uids: windowUids(uidBase, o.count), source: 'auto-scan',
    partition: partitions.find(([lo, hi]) => uidBase >= lo && uidBase + o.count - 1 <= hi)!, stride, occupied_recheck: occ };
};

// ---------------------------------------------------------------- ② 币符号
export interface SymbolOpts {
  /** 前缀（本项目分区约定：`p1y`） */
  prefix: string;
  /** run tag（同一次运行内三件命名空间用同一 seed） */
  seed: string;
  maxCandidates?: number;
  tagPrefix?: string;
  purpose?: string;
  hint?: string;
}
export interface SymbolAlloc { ok: true; symbol: string; candidate_index: number; checked: string[]; }

export const allocCurrencySymbol = async (ex: NsQuery, o: SymbolOpts): Promise<Alloc<SymbolAlloc>> => {
  const TAG = (o.tagPrefix ?? 'NS').toUpperCase();
  const n = o.maxCandidates ?? 8;
  const cands = Array.from({ length: n }, (_, i) => `${o.prefix}${token(o.seed, i)}`);
  const bad = cands.find((c) => !/^[^\s]{1,16}$/.test(c));
  if (bad) {
    return { ok: false, fatal: { fatal: 'PRECONDITION_NOT_MET', kind: 'SYMBOL_FORMAT_INVALID',
      detail: `候选 symbol「${bad}」违反 currency.symbol 的 CHECK（^[^[:space:]]{1,16}$）`,
      hint: `缩短前缀或 tag 长度（当前前缀「${o.prefix}」+ 6 字符 token）` } };
  }
  const taken = (await ex.query(`SELECT symbol FROM currency WHERE symbol = ANY($1::text[])`, [cands]))
    .rows.map((r) => String(r.symbol));
  const idx = cands.findIndex((c) => !taken.includes(c));
  if (idx < 0) {
    return { ok: false, fatal: { fatal: 'PRECONDITION_NOT_MET', kind: 'NO_FREE_SYMBOL',
      detail: `currency.symbol 空间不足：前缀「${o.prefix}」的 ${n} 个确定性候选全部已被占用`,
      checked: cands, taken,
      why: o.purpose ?? 'symbol 唯一且其名下 account.balance/frozen 会被真落账消耗 ⇒ 复用同一 symbol 的一跑会 LEDGER_INSUFFICIENT_FROZEN',
      hint: o.hint ?? `换一个 seed（例：${TAG}_RUN=<新 tag>）或换前缀；symbol 全局唯一且永不删除，故候选是**消耗品**` } };
  }
  return { ok: true, symbol: cands[idx], candidate_index: idx, checked: cands.slice(0, idx + 1) };
};

// ---------------------------------------------------------------- ③ 幂等键前缀
export interface KeyPrefixOpts {
  /** 形如 `ops:p1y`（本库补尾冒号） */
  prefix: string;
  seed: string;
  maxCandidates?: number;
  tagPrefix?: string;
  purpose?: string;
  hint?: string;
}
export interface KeyPrefixAlloc { ok: true; key_prefix: string; candidate_index: number; checked: string[]; }

export const allocIdempotencyKeyPrefix = async (ex: NsQuery, o: KeyPrefixOpts): Promise<Alloc<KeyPrefixAlloc>> => {
  const TAG = (o.tagPrefix ?? 'NS').toUpperCase();
  const n = o.maxCandidates ?? 8;
  const cands = Array.from({ length: n }, (_, i) => `${o.prefix}:${token(o.seed, i)}:`);
  const hits = new Set<string>();
  for (const c of cands) {
    const r = (await ex.query(`SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE $1`, [`${c}%`])).rows[0];
    if (Number(r?.n ?? '0') > 0) hits.add(c);
  }
  const idx = cands.findIndex((c) => !hits.has(c));
  if (idx < 0) {
    return { ok: false, fatal: { fatal: 'PRECONDITION_NOT_MET', kind: 'NO_FREE_KEY_PREFIX',
      detail: `幂等键前缀空间不足：前缀「${o.prefix}:」的 ${n} 个确定性候选在 ledger_entry 里全部已有行`,
      checked: cands, taken: [...hits],
      why: o.purpose ?? 'ledger_entry 是 append-only 且 idempotency_key 唯一 ⇒ 复用前缀会把「首写」变成「重放」（假绿）',
      hint: o.hint ?? `换一个 seed（例：${TAG}_RUN=<新 tag>）` } };
  }
  return { ok: true, key_prefix: cands[idx], candidate_index: idx, checked: cands.slice(0, idx + 1) };
};

// ---------------------------------------------------------------- ④ job 号段（`biz:job:settle:<job_id>`）
export interface JobTagOpts { seed: string; digits?: number; maxCandidates?: number; tagPrefix?: string; purpose?: string; hint?: string; }
export interface JobTagAlloc { ok: true; tag: string; candidate_index: number; checked: string[]; }

/**
 * `jobSettleKey(jobId) = 'biz:job:settle:<job_id>'` 是**全局**键（不带脚本分区前缀）⇒ job id 必须全局新。
 * 返回 `digits` 位十进制号段（例 `812345678`），调用方取 `tag + k`（k = 1..9）作为各 job id。
 */
export const allocNumericJobTag = async (ex: NsQuery, o: JobTagOpts): Promise<Alloc<JobTagAlloc>> => {
  const TAG = (o.tagPrefix ?? 'NS').toUpperCase();
  const digits = o.digits ?? 9;
  const n = o.maxCandidates ?? 8;
  const span = 10n ** BigInt(digits) - 10n ** BigInt(digits - 1);
  const cands = Array.from({ length: n }, (_, i) =>
    (BigInt('0x' + sha256(`${o.seed}:job:${i}`).slice(0, 15)) % span + 10n ** BigInt(digits - 1)).toString());
  const hits = new Set<string>();
  for (const c of cands) {
    const r = (await ex.query(`SELECT count(*)::text AS n FROM ledger_entry WHERE idempotency_key LIKE $1`, [`biz:job:settle:${c}%`])).rows[0];
    if (Number(r?.n ?? '0') > 0) hits.add(c);
  }
  const idx = cands.findIndex((c) => !hits.has(c));
  if (idx < 0) {
    return { ok: false, fatal: { fatal: 'PRECONDITION_NOT_MET', kind: 'NO_FREE_JOB_TAG',
      detail: `job 号段空间不足：${digits} 位候选 ${n} 个在 ledger_entry 里全部已有 'biz:job:settle:<tag>%' 行`,
      checked: cands, taken: [...hits],
      why: o.purpose ?? 'job 结算键不带脚本分区前缀（biz:job:settle:<job_id>）⇒ 撞号会让首写退化成重放',
      hint: o.hint ?? `换 seed（例：${TAG}_RUN=<新 tag>）` } };
  }
  return { ok: true, tag: cands[idx], candidate_index: idx, checked: cands.slice(0, idx + 1) };
};

// ---------------------------------------------------------------- 组合：一次拿全
export interface NamespaceOpts {
  tagPrefix: string;
  seed: string;
  uidCount: number;
  uidPartitions: ReadonlyArray<readonly [number, number]>;
  uidStride?: number;
  envBase?: string | number | null;
  symbolPrefix: string;
  keyPrefix: string;
  jobDigits?: number;
  purpose?: string;
  hint?: string;
}
export interface Namespace {
  ok: true;
  tag_prefix: string;
  seed: string;
  uid_base: number;
  uids: string[];
  uid_source: string;
  uid_partition: [number, number];
  uid_stride: number;
  occupied_recheck: string[];
  symbol: string;
  key_prefix: string;
  job_tag: string;
}

/** 一把拿全四件（uid 窗口 / symbol / 幂等键前缀 / job 号段）；任一失败 ⇒ 整体失败（**不静默**） */
export const allocNamespace = async (ex: NsQuery, o: NamespaceOpts): Promise<Alloc<Namespace>> => {
  const uid = await allocUidWindow(ex, { count: o.uidCount, tagPrefix: o.tagPrefix, partitions: o.uidPartitions,
    stride: o.uidStride, seed: o.seed, envBase: o.envBase, purpose: o.purpose, hint: o.hint });
  if (!uid.ok) return uid;
  const sym = await allocCurrencySymbol(ex, { prefix: o.symbolPrefix, seed: o.seed, tagPrefix: o.tagPrefix, purpose: o.purpose, hint: o.hint });
  if (!sym.ok) return sym;
  const key = await allocIdempotencyKeyPrefix(ex, { prefix: o.keyPrefix, seed: o.seed, tagPrefix: o.tagPrefix, purpose: o.purpose, hint: o.hint });
  if (!key.ok) return key;
  const job = await allocNumericJobTag(ex, { seed: o.seed, digits: o.jobDigits ?? 9, tagPrefix: o.tagPrefix, purpose: o.purpose, hint: o.hint });
  if (!job.ok) return job;
  return { ok: true, tag_prefix: o.tagPrefix, seed: o.seed,
    uid_base: uid.uid_base, uids: uid.uids, uid_source: uid.source, uid_partition: uid.partition, uid_stride: uid.stride,
    occupied_recheck: uid.occupied_recheck,
    symbol: sym.symbol, key_prefix: key.key_prefix, job_tag: job.tag };
};

// ---------------------------------------------------------------- 退出
/**
 * 前置不满足 ⇒ **明白话** + `exit 3`（`PRECONDITION_NOT_MET`）。调用方负责先落盘（run-tagged）再调本函数。
 * 绝不「静默继续」或「换个夹具凑合跑」——那正是本项目报废两个探针的成因。
 */
export const exitPrecondition: (fatal: NsFatal | Alloc<unknown>, after?: () => void) => never = (fatal, after) => {
  const f: NsFatal = typeof (fatal as { kind?: unknown }).kind === 'string'
    ? (fatal as NsFatal)                                  // 已经是 fatal 对象
    : (fatal as { fatal: NsFatal }).fatal;                // Alloc 的失败分支
  try { after?.(); } catch { /* noop */ }
  console.log(JSON.stringify(f, null, 1));
  console.error(`PRECONDITION_NOT_MET [${f.kind}]：${f.detail}\n  ⇒ ${f.hint}`);
  process.exit(3);
};

/** 断言式取值（`--assert` 之外的地方也别用 `!` 糊过去；失败即明白话 + exit 2） */
export const must = <T>(a: Alloc<T>, what: string): T => {
  if (!a.ok) { console.error(`[ns-alloc] ${what} 分配失败：${JSON.stringify(a.fatal)}`); process.exit(2); }
  return a as T;
};
