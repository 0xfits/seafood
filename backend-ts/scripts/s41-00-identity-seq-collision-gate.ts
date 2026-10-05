/**
 * s41-00 · ★ 只读巡检门 —— identity/serial 序列「撞号」判据（nextval 是否落在已占用集合内 / gap 阈值）
 * ============================================================================
 * ★ 口径来源（已终审更正，逐字沿用）：
 *   `docs/audit/s38-residual-30-triage.md` §1.2 —— 撞号判据 **不是**「seq ≤ max」，
 *   而是「**nextval 落在已占用集合内**」。
 *     依据：`users` 序列 last_value=41（next=42）而 `uid=42` 现存 0 行（空位）⇒ 取 42 不撞；
 *     但若某表**已占用集合**里存在 ≤ nextval 的位（典型：夹具残差固定号 900001）⇒ 当序列爬到那里就撞。
 *
 * 类级口径：
 *   受体（recipient）= 全库 `public` 中带 identity / serial（nextval 默认值）的**列**。
 *   逐列读数（**全部只读，禁 nextval / setval / INSERT / UPDATE / DELETE / 任何写**）：
 *     ① `pg_sequences.last_value` + `is_called` + `increment_by` ⇒ 推算 `nextval`
 *        （is_called=true ⇒ nextval = last_value + increment_by；false/ NULL ⇒ nextval = last_value|start_value）
 *     ② 下一个已占用位 = `SELECT min(col) FROM <表> WHERE col > :nextval`
 *     ③ gap = 下一个已占用位 − nextval（无上方位 ⇒ null）
 *     ④ 撞号直接证据 = `SELECT 1 FROM <表> WHERE col = :nextval LIMIT 1`（已占用集合内含 nextval）
 *   三态判定（阈值默认 1000，env `S41_GAP_THRESHOLD` 可覆写）：
 *     · nextval 已落在已占用集合内（存在 col = nextval 的行）或 gap ≤ 0  ⇒ **FAIL**
 *     · 0 < gap ≤ 阈值                                                  ⇒ **WARN**
 *     · 否则（gap > 阈值 / 上方无已占用位 / 已占用集合为空）             ⇒ **OK**
 *   类级自证（对齐 `s36-00` / `p4z-i18nviol-global` 家族）：
 *     打印 受体数 / 读数数 / 违例数 / 基线数 / 新增数；**受体 = 0 或 读数 = 0（无任何一列读得出读数）
 *     ⇒ 自标「断言无效」**（EXIT 5），一律不得当「零违例」。
 *   基线 = 首次巡检的 23 列实测读数（含态）；违例列登记在 `flags`。新增违例 = 零容忍 ⇒ 红。
 *
 * 用法：
 *   cd backend-ts && npx ts-node --transpile-only scripts/s41-00-identity-seq-collision-gate.ts
 *     [--json <path>]            落盘报告（含逐列读数）
 *     [--dump-readings <path>]   仅落盘逐列读数（供仓外判负离线回放）
 *     [--readings <path>]        离线回放：从 JSON 读逐列读数（不连库）
 *     [--selftest]               内存合成数据判负（不落盘、不连库、不改仓）
 *   env：S41_GAP_THRESHOLD   gap 预警阈值（默认 1000）
 *   退出码：0 = 绿（全 OK）；3 = 红（存在 FAIL / 新增违例）；4 = 黄（仅 WARN）；
 *           5 = 断言无效（受体=0 / 读数=0 / 基线违例不复现）；2 = 致命错误（连库失败等）。
 */
import * as fs from 'fs';
import * as path from 'path';

const REPO_BACKEND = path.resolve(__dirname, '..');
const BASELINE_PATH = path.resolve(__dirname, 's41-00-identity-seq-collision-gate.baseline.json');
const DEFAULT_THRESHOLD = 1000n;

// ── 类型 ─────────────────────────────────────────────────────────────────────────────
export type State = 'OK' | 'WARN' | 'FAIL' | 'UNKNOWN';

export interface Reading {
  table: string;
  column: string;
  generation: string;             // BY DEFAULT / ALWAYS / serial/nextval
  is_identity: string;            // YES / NO
  seq: string | null;             // owned sequence (schema.name)
  last_value: string | null;
  is_called: boolean | null;
  increment_by: string | null;
  nextval: string | null;
  hit_at_nextval: boolean;        // 已占用集合中存在 col = nextval
  next_occupied: string | null;   // min(col) where col > nextval（无 ⇒ null）
  gap: string | null;             // next_occupied - nextval（无 ⇒ null）
  error: string | null;
  state: State;
  reason: string;
}

export interface BaselineFile {
  meta: Record<string, unknown>;
  columns: Array<Pick<Reading, 'table' | 'column' | 'generation' | 'is_identity' | 'seq' | 'nextval' | 'next_occupied' | 'gap' | 'state'>>;
  column_count: number;
  flags: Array<{ table: string; column: string; state: State; reason: string }>;
  gap_threshold?: number;
}

const qident = (s: string) => '"' + s.replace(/"/g, '""') + '"';
const big = (s: string | null): bigint | null => (s === null || s === undefined ? null : BigInt(s));

// ── 纯判定核（可被 selftest / 离线回放复用）────────────────────────────────────────────
export function classify(r: Omit<Reading, 'state' | 'reason'>, threshold: bigint): { state: State; reason: string } {
  if (r.error) return { state: 'UNKNOWN', reason: `读数失败：${r.error}` };
  if (r.nextval === null) return { state: 'UNKNOWN', reason: '无法推算 nextval（无 last_value/start_value）' };
  const nv = big(r.nextval)!;
  if (r.hit_at_nextval) return { state: 'FAIL', reason: `nextval=${nv} 已落在已占用集合内（存在 ${r.table}.${r.column}=${nv} 的行）` };
  const gap = big(r.gap);
  if (gap !== null && gap <= 0n) return { state: 'FAIL', reason: `gap=${gap} ≤ 0（已占用位 ${r.next_occupied} ≤ nextval ${nv}）` };
  if (gap !== null && gap <= threshold) return { state: 'WARN', reason: `gap=${gap} ≤ 阈值 ${threshold}（下一个已占用位 ${r.next_occupied} 逼近 nextval ${nv}）` };
  if (gap === null) return { state: 'OK', reason: `已占用集合在 nextval=${nv} 上方为空 ⇒ 不撞（gap=null）` };
  return { state: 'OK', reason: `gap=${gap} > 阈值 ${threshold}（下一个已占用位 ${r.next_occupied} 距 nextval ${nv} 尚远）` };
}

export interface Verdict {
  recipients: number;                 // 受体数 = 枚举到的 identity/serial 列数
  readings_ok: number;                // 读数数 = 成功读得读数（非 UNKNOWN）的受体列数
  fail: Reading[];                    // 态 = FAIL
  warn: Reading[];                    // 态 = WARN
  unknown: Reading[];
  baseline_count: number;             // 基线列数
  baseline_fail_keys: Set<string>;    // 基线登记的违例（FAIL/UNKNOWN）
  new_fail: Reading[];                // 新增违例（不在基线违例名单）
  stale_baseline: string[];           // 基线登记但库中已无此列
  added_receptors: string[];          // 库中存在但基线未登记的列
  threshold: string;
  invalid: boolean;
  invalid_reason: string | null;
  red: boolean;
  yellow: boolean;
}

const colKey = (t: string, c: string) => `${t}.${c}`;

export function evaluate(readings: Reading[], baseline: BaselineFile, threshold: bigint): Verdict {
  const recipients = readings.length;
  const readingsOk = readings.filter((r) => r.state !== 'UNKNOWN');
  const fail = readings.filter((r) => r.state === 'FAIL');
  const warn = readings.filter((r) => r.state === 'WARN');
  const unknown = readings.filter((r) => r.state === 'UNKNOWN');
  const baselineFailKeys = new Set(
    (baseline.flags ?? []).filter((f) => f.state === 'FAIL' || f.state === 'UNKNOWN').map((f) => colKey(f.table, f.column)),
  );
  const newFail = fail.filter((r) => !baselineFailKeys.has(colKey(r.table, r.column)));
  const baseKeys = new Set(baseline.columns.map((c) => colKey(c.table, c.column)));
  const nowKeys = new Set(readings.map((r) => colKey(r.table, r.column)));
  const stale = [...baseKeys].filter((k) => !nowKeys.has(k)).sort();
  const added = [...nowKeys].filter((k) => !baseKeys.has(k)).sort();

  let invalid = false;
  let invalidReason: string | null = null;
  if (recipients === 0) { invalid = true; invalidReason = '受体数=0（identity/serial 列枚举为空 ⇒ 扫描面失效）'; }
  else if (readingsOk.length === 0) { invalid = true; invalidReason = '读数数=0（无任何一列读得出读数 ⇒ 断言无效，不得当「零违例」）'; }
  else if (baselineFailKeys.size > 0 && fail.length + unknown.length === 0) {
    invalid = true; invalidReason = `基线登记的 ${baselineFailKeys.size} 个违例列在本次巡检中一个都不复现（判据未生效 ⇒ 断言无效）`;
  }

  return {
    recipients, readings_ok: readingsOk.length, fail, warn, unknown,
    baseline_count: baseline.columns.length, baseline_fail_keys: baselineFailKeys,
    new_fail: newFail, stale_baseline: stale, added_receptors: added,
    threshold: threshold.toString(),
    invalid, invalid_reason: invalidReason,
    red: !invalid && (newFail.length > 0 || unknown.length > 0),
    yellow: !invalid && newFail.length === 0 && unknown.length === 0 && warn.length > 0,
  };
}

// ── 只读连库（进程内 dotenv；绝对路径 .env.local；不打印密钥）────────────────────────────
function loadEnvInline(): string {
  const envPath = path.resolve(REPO_BACKEND, '.env.local');
  const txt = fs.readFileSync(envPath, 'utf8');
  for (const raw of txt.split('\n')) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(raw);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '';
  if (!url) throw new Error('no DATABASE_URL_UNPOOLED in .env.local');
  return url;
}

export interface DbMeta { db: string; addr: string; pgver: string; host: string }

async function collectReadings(threshold: bigint): Promise<{ readings: Reading[]; meta: DbMeta }> {
  const url = loadEnvInline();
  // 动态 require（避免 tsconfig.scripts.json 在无 @types 情形的硬失败面）
  const { Pool, neonConfig } = require('@neondatabase/serverless') as typeof import('@neondatabase/serverless');
  const WS = require('ws') as { default?: unknown };
  (neonConfig as unknown as { webSocketConstructor: unknown }).webSocketConstructor = (WS as { default?: unknown }).default ?? WS;
  const pool = new Pool({ connectionString: url, max: 1, connectionTimeoutMillis: 30000 });
  const readings: Reading[] = [];
  let meta: DbMeta = { db: '', addr: '', pgver: '', host: url.replace(/:[^:@/]*@/, ':***@') };
  try {
    const srv = (await pool.query(
      `SELECT current_database() AS db, coalesce(inet_server_addr()::text,'(neon-proxy)') AS addr, current_setting('server_version') AS pgver`,
    )).rows[0] as DbMeta;
    meta = { ...meta, db: srv.db, addr: srv.addr, pgver: srv.pgver };

    // ① 受体枚举：public BASE TABLE 上的 identity / serial(nextval) 列
    const cols = (await pool.query(
      `SELECT c.table_name, c.column_name,
              CASE WHEN c.is_identity='YES' THEN c.identity_generation ELSE 'serial/nextval' END AS generation,
              c.is_identity,
              pg_get_serial_sequence('public.'||quote_ident(c.table_name), c.column_name) AS seq
         FROM information_schema.columns c
         JOIN information_schema.tables t
           ON t.table_schema=c.table_schema AND t.table_name=c.table_name AND t.table_type='BASE TABLE'
        WHERE c.table_schema='public'
          AND (c.is_identity='YES' OR c.column_default LIKE 'nextval(%')
        ORDER BY c.table_name, c.column_name`,
    )).rows as Array<{ table_name: string; column_name: string; generation: string; is_identity: string; seq: string | null }>;

    // ② pg_sequences（increment_by；★ PG 的 pg_sequences 视图**无** is_called 列）＋ 直查序列视图取 last_value/is_called（只读 SELECT，不耗 nextval）
    const seqRows = (await pool.query(
      `SELECT sequencename,
              coalesce(increment_by,1)::text AS increment_by,
              coalesce(start_value,1)::text AS start_value
         FROM pg_sequences WHERE schemaname='public'`,
    )).rows as Array<{ sequencename: string; increment_by: string; start_value: string }>;
    const seqMap = new Map(seqRows.map((r) => [r.sequencename, r]));

    for (const c of cols) {
      const tbl = `public.${qident(c.table_name)}`;
      const col = qident(c.column_name);
      const seqName = c.seq ? c.seq.replace(/^public\./, '').replace(/"/g, '') : null;
      const sq = seqName ? seqMap.get(seqName) : undefined;
      const increment = sq ? BigInt(sq.increment_by || '1') : 1n;
      let lastValue: string | null = null;
      let isCalled: boolean | null = null;
      let nextval: bigint | null = null;
      if (seqName) {
        try {
          // ★ 只读 SELECT on the sequence relation（返回 last_value/log_cnt/is_called；**不消耗** nextval）
          const sr = (await pool.query(`SELECT last_value::text AS last_value, is_called FROM public.${qident(seqName)}`)).rows[0] as { last_value: string | null; is_called: boolean } | undefined;
          if (sr) { lastValue = sr.last_value; isCalled = sr.is_called; }
        } catch (e) {
          lastValue = null; isCalled = null;
          void e;
        }
        if (lastValue !== null) nextval = isCalled ? BigInt(lastValue) + increment : BigInt(lastValue);
        else if (sq) nextval = BigInt(sq.start_value || '1');   // 序列从未被读过 ⇒ nextval = start_value
      }
      const rec: Omit<Reading, 'state' | 'reason'> = {
        table: c.table_name, column: c.column_name, generation: c.generation, is_identity: c.is_identity,
        seq: c.seq, last_value: lastValue, is_called: isCalled,
        increment_by: sq ? sq.increment_by : null, nextval: nextval === null ? null : nextval.toString(),
        hit_at_nextval: false, next_occupied: null, gap: null, error: null,
      };
      try {
        if (nextval !== null) {
          const hit = await pool.query(`SELECT 1 AS one FROM ${tbl} WHERE ${col} = $1::numeric LIMIT 1`, [nextval.toString()]);
          rec.hit_at_nextval = hit.rows.length > 0;
          const nxt = (await pool.query(`SELECT min(${col})::text AS m FROM ${tbl} WHERE ${col} > $1::numeric`, [nextval.toString()])).rows[0] as { m: string | null };
          rec.next_occupied = nxt.m;
          rec.gap = nxt.m === null ? null : (BigInt(nxt.m) - nextval).toString();
        } else {
          rec.error = 'no owned sequence found in pg_sequences';
        }
      } catch (e) {
        rec.error = e instanceof Error ? e.message : String(e);
      }
      const { state, reason } = classify(rec, threshold);
      readings.push({ ...rec, state, reason });
    }
  } finally {
    await pool.end();
  }
  return { readings, meta };
}

// ── 基线读写 ──────────────────────────────────────────────────────────────────────────
const loadBaseline = (): BaselineFile => JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile;

// ── 内存判负（合成数据，不连库 / 不落盘）────────────────────────────────────────────────
function synth(k: Partial<Reading> & { table: string; column: string }): Reading {
  const r: Omit<Reading, 'state' | 'reason'> = {
    table: k.table, column: k.column, generation: k.generation ?? 'BY DEFAULT', is_identity: k.is_identity ?? 'YES',
    seq: k.seq ?? `public.${k.table}_${k.column}_seq`, last_value: k.last_value ?? null, is_called: k.is_called ?? null,
    increment_by: k.increment_by ?? '1', nextval: k.nextval ?? null, hit_at_nextval: k.hit_at_nextval ?? false,
    next_occupied: k.next_occupied ?? null, gap: k.gap ?? null, error: k.error ?? null,
  };
  const { state, reason } = classify(r, DEFAULT_THRESHOLD);
  return { ...r, state, reason };
}

function runSelftest(): number {
  const base: BaselineFile = { meta: {}, columns: [], column_count: 0, flags: [] };
  const B = (cols: Reading[]): BaselineFile => ({ ...base, columns: cols.map((c) => ({ table: c.table, column: c.column, generation: c.generation, is_identity: c.is_identity, seq: c.seq, nextval: c.nextval, next_occupied: c.next_occupied, gap: c.gap, state: c.state })), column_count: cols.length });
  const empty = B([]);

  // ① gap 极小 ⇒ WARN
  const ex1 = synth({ table: 't', column: 'c', nextval: '100', next_occupied: '150', gap: '50' });
  const v1 = evaluate([ex1], empty, DEFAULT_THRESHOLD);
  // ② nextval 已在已占集合内 ⇒ FAIL
  const ex2 = synth({ table: 't', column: 'c', nextval: '42', hit_at_nextval: true, next_occupied: '900001', gap: '899959' });
  const v2 = evaluate([ex2], empty, DEFAULT_THRESHOLD);
  // ③ gap 很大 ⇒ OK
  const ex3 = synth({ table: 'users', column: 'uid', nextval: '42', next_occupied: '900001', gap: '899959' });
  const v3 = evaluate([ex3], empty, DEFAULT_THRESHOLD);
  // ④ 已占用集合为空 ⇒ OK 且不得 FAIL
  const ex4 = synth({ table: 't', column: 'c', nextval: '500', next_occupied: null, gap: null });
  const v4 = evaluate([ex4], empty, DEFAULT_THRESHOLD);
  // ⑤ 受体 = 0 ⇒ 无效（非绿）
  const v5 = evaluate([], empty, DEFAULT_THRESHOLD);
  // ⑥ 读数数 = 0（全部读数失败）⇒ 无效（非绿）
  const ex6 = synth({ table: 't', column: 'c', error: 'relation does not exist' });
  const v6 = evaluate([ex6], empty, DEFAULT_THRESHOLD);

  const checks: Array<[string, boolean, string]> = [
    ['① gap 极小 ⇒ WARN', v1.yellow && v1.warn.length === 1 && !v1.red && !v1.invalid, `state=${ex1.state} gap=${ex1.gap} yellow=${v1.yellow} red=${v1.red}`],
    ['② nextval 已在已占集合内 ⇒ FAIL', v2.red && v2.fail.length === 1 && !v2.invalid, `state=${ex2.state} hit=${ex2.hit_at_nextval} red=${v2.red}`],
    ['③ gap 很大 ⇒ OK', ex3.state === 'OK' && !v3.red && !v3.yellow && !v3.invalid, `state=${ex3.state} gap=${ex3.gap} (${ex3.reason})`],
    ['④ 已占用集合为空 ⇒ OK（不得 FAIL）', ex4.state === 'OK' && !v4.red && !v4.invalid, `state=${ex4.state} next_occupied=${ex4.next_occupied}`],
    ['⑤ 受体=0 ⇒ 断言无效（非绿）', v5.invalid && v5.recipients === 0 && !v5.red && !v5.yellow, `recipients=${v5.recipients} invalid=${v5.invalid}`],
    ['⑥ 读数数=0 ⇒ 断言无效（非绿）', v6.invalid && v6.readings_ok === 0 && !v6.red, `readings_ok=${v6.readings_ok} invalid=${v6.invalid}`],
  ];
  for (const [id, pass, r] of checks) console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${id}  [${r}]`);
  const ok = checks.every(([, p]) => p);
  console.log(`SELFTEST ${ok ? 'PASS' : 'FAIL'} (${checks.filter(([, p]) => p).length}/${checks.length})`);
  return ok ? 0 : 1;
}

// ── main ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<number> {
  if (process.argv.includes('--selftest')) return runSelftest();
  const threshold = process.env.S41_GAP_THRESHOLD ? BigInt(process.env.S41_GAP_THRESHOLD) : DEFAULT_THRESHOLD;
  const baseline = loadBaseline();

  const ri = process.argv.indexOf('--readings');
  let readings: Reading[];
  let meta: DbMeta | Record<string, never> = {};
  if (ri >= 0 && process.argv[ri + 1]) {
    // 离线回放：从 JSON 读逐列读数，并**按当前阈值重新判定态**（不信任 JSON 里的 state）
    const raw = JSON.parse(fs.readFileSync(path.resolve(process.argv[ri + 1]), 'utf8')) as Reading[];
    readings = raw.map((r) => ({ ...r, ...classify(r, threshold) }));
  } else {
    const got = await collectReadings(threshold);
    readings = got.readings; meta = got.meta;
  }
  const v = evaluate(readings, baseline, threshold);

  const report = {
    gate: 'scripts/s41-00-identity-seq-collision-gate.ts',
    ts: new Date().toISOString(),
    criterion: '撞号判据 = nextval 落在已占用集合内（存在 col=nextval 的行）或 gap≤0 ⇒ FAIL；0<gap≤阈值 ⇒ WARN；否则 OK（S38 §1.2 纠偏）',
    self_proof: {
      recipients: v.recipients,
      readings_ok: v.readings_ok,
      fail: v.fail.length, warn: v.warn.length, unknown: v.unknown.length,
      baseline: v.baseline_count, baseline_flags: v.baseline_fail_keys.size,
      new_fail: v.new_fail.length,
      gap_threshold: v.threshold,
      invalid: v.invalid, invalid_reason: v.invalid_reason,
    },
    db: meta,
    state_summary: {
      OK: readings.filter((r) => r.state === 'OK').length,
      WARN: v.warn.length, FAIL: v.fail.length, UNKNOWN: v.unknown.length,
    },
    fail_columns: v.fail.map((r) => ({ key: colKey(r.table, r.column), nextval: r.nextval, next_occupied: r.next_occupied, gap: r.gap, reason: r.reason })),
    warn_columns: v.warn.map((r) => ({ key: colKey(r.table, r.column), nextval: r.nextval, next_occupied: r.next_occupied, gap: r.gap, reason: r.reason })),
    new_fail_columns: v.new_fail.map((r) => colKey(r.table, r.column)),
    stale_baseline: v.stale_baseline,
    added_receptors: v.added_receptors,
    readings,
    verdict: v.invalid ? 'INVALID' : v.red ? 'RED' : v.yellow ? 'WARN' : 'GREEN',
    exit_code: v.invalid ? 5 : v.red ? 3 : v.yellow ? 4 : 0,
  };

  const di = process.argv.indexOf('--dump-readings');
  if (di >= 0 && process.argv[di + 1]) {
    const p = path.resolve(process.argv[di + 1]);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(readings, null, 2));
    console.log(`[dump-readings] ${p}`);
  }
  const ji = process.argv.indexOf('--json');
  if (ji >= 0 && process.argv[ji + 1]) {
    const p = path.resolve(process.argv[ji + 1]);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(report, null, 2));
    console.log(`[json] ${p}`);
  }

  console.log(JSON.stringify({ ...report, readings: undefined }, null, 1));
  console.log(
    `\n[自证] 受体数=${v.recipients}  读数数=${v.readings_ok}  违例数=${v.fail.length + v.warn.length + v.unknown.length}  基线数=${v.baseline_count}  新增=${v.new_fail.length}  阈值=${v.threshold}`,
  );
  if (v.invalid) console.log(`[INVALID] ${v.invalid_reason} ⇒ 断言无效，不得当「零违例」。`);
  else if (v.red) for (const r of v.new_fail) console.log(`[NEW-FAIL] ${colKey(r.table, r.column)} nextval=${r.nextval} next_occupied=${r.next_occupied} gap=${r.gap} :: ${r.reason}`);
  else if (v.yellow) for (const r of v.warn) console.log(`[WARN] ${colKey(r.table, r.column)} nextval=${r.nextval} next_occupied=${r.next_occupied} gap=${r.gap} :: ${r.reason}`);
  if (v.stale_baseline.length) console.log(`[STALE-WARN] 基线登记但库中已无：${v.stale_baseline.join(', ')}`);
  if (v.added_receptors.length) console.log(`[ADDED] 库中存在但基线未登记：${v.added_receptors.join(', ')}`);
  return v.invalid ? 5 : v.red ? 3 : v.yellow ? 4 : 0;
}

if (require.main === module) {
  main().then((c) => process.exit(c)).catch((e) => { console.error('FATAL', e); process.exit(2); });
}
