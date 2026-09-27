/**
 * P1v-00 · **全局触发器启用态判据**（可复用库） + **判据红色自证**（本文件自带 CLI）
 * ============================================================================
 * 存在理由（上一单的教训）
 *   `p2d-01` 在**事务内** `ALTER TABLE referral DISABLE TRIGGER trg_referral_append_only` 之后
 *   未复原 ⇒ `referral` 的 append-only **不可变前提**一度处于禁用态。该缺陷当时只被「登记」
 *   （见 p1t-00 的 `pre_existing_observation`），**没有进入常态判据** ⇒ 下次没人会发现。
 *   本文件把「不可变前提」变成**每次运行都执行的回归断言**：
 *     · 全局扫 `pg_trigger`（`nspname='public'` 且 `NOT tgisinternal`）；
 *     · **全部** `tgenabled = 'O'`（enabled）；任一为 `D`(disabled)/`R`(replica)/`A`(always) ⇒ **判红并逐项列出**；
 *     · 扫到 **0 行**视为**真空** ⇒ 同样判红（防止「触发器被删光」骗过恒绿判据）。
 *
 * 复用处（单一实现，避免两份判据漂移）
 *   `p1t-00-bind-protocol-guard.ts` 直接 import 本文件的 `scanTriggerEnablement` / `evaluateTriggerEnablement`
 *   ⇒ 本文件的红色自证**就是** p1t-00 里那条回归断言的红色自证（同一份代码，不是复制品）。
 *
 * 用法（本文件 CLI = 自证）
 *   cd backend-ts
 *   npx ts-node --transpile-only scripts/p1v-00-trigger-enablement-guard-assert.ts
 *   npx ts-node --transpile-only scripts/p1v-00-trigger-enablement-guard-assert.ts --e2e-committed
 *     # ↑ 端到端：**提交态**禁用（referral 的 append-only / cycle_guard）⇒ 真跑 p1t-00 子进程
 *     #    ⇒ 期望 exit 1（判红，异常项列出）/ exit 3（前置闸、零写入）⇒ try/finally 复原 ⇒ 指纹复核
 *     #    （安全性：每个 phase 用 try/finally 复原；`referral` 只有本单探针写；前置闸保证禁用态下不落库）
 *   退出码：0 全部自证通过 / 1 任一条判红 / 2 致命 / 3 前置不满足
 *   默认（不带 --e2e-committed）为**只读**：DISABLE/ENABLE 全部在**同一事务内**完成并 COMMIT（净效果 = 零变更）。
 * 落盘：`.p1v-artifacts/p1v-00-trigger-enablement-guard-assert-<RUN>.json`（run-tagged）
 * 测试数据分区：**本文件零写入**（不碰 uid、不建币、不动账本；`referral` 行数前后逐字对比）。
 * ============================================================================
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { spawnSync } from 'child_process';
import './p1f-lib';                       // ⚠️ 先加载（绝对路径 .env.local），再加载其它
import { mkPool, raw, jstr, sleep } from './p1f-lib';

// ---------------------------------------------------------------- 判据（单一实现）

/** 最小连接契约：`Pool` / `PoolClient` 都满足（后者用于「同一事务内」跑判据） */
export interface SqlConn {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }>;
}

export interface TriggerRow {
  schema: string; table: string; trigger: string; tgenabled: string; state: string;
}
export interface TriggerAnomaly {
  table: string; trigger: string; tgenabled: string; state: string; label: string;
}
export interface TriggerScan {
  sql: string; total: number; enabled: number; vacuous: boolean; ok: boolean;
  anomalies: TriggerAnomaly[]; rows: TriggerRow[];
}

/** 判据 SQL：public 下全部**非 internal**触发器的启用态（含表名，便于定位异常项） */
export const TRIGGER_ENABLEMENT_SQL = `
  SELECT n.nspname AS schema_name,
         c.relname AS table_name,
         t.tgname  AS trigger_name,
         t.tgenabled::text AS tgenabled,
         CASE t.tgenabled
           WHEN 'O' THEN 'enabled' WHEN 'D' THEN 'disabled'
           WHEN 'R' THEN 'replica' WHEN 'A' THEN 'always'
           ELSE 'unknown:' || t.tgenabled::text END AS state
    FROM pg_trigger t
    JOIN pg_class     c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND NOT t.tgisinternal
   ORDER BY c.relname, t.tgname`;

/** 纯函数求值（可单测 / 可用合成输入证伪「恒绿判据」） */
export const evaluateTriggerEnablement = (rowsIn: ReadonlyArray<Partial<TriggerRow>>): TriggerScan => {
  const rows: TriggerRow[] = rowsIn.map((r) => ({
    schema: String(r.schema ?? ''), table: String(r.table ?? ''), trigger: String(r.trigger ?? ''),
    tgenabled: String(r.tgenabled ?? ''), state: String(r.state ?? ''),
  }));
  const anomalies: TriggerAnomaly[] = rows
    .filter((r) => r.tgenabled !== 'O')
    .map((r) => ({
      table: r.table, trigger: r.trigger, tgenabled: r.tgenabled, state: r.state,
      label: `${r.table}.${r.trigger}=${r.state}(${r.tgenabled})`,
    }));
  const vacuous = rows.length === 0;
  return {
    sql: TRIGGER_ENABLEMENT_SQL, total: rows.length,
    enabled: rows.filter((r) => r.tgenabled === 'O').length,
    vacuous, ok: !vacuous && anomalies.length === 0, anomalies, rows,
  };
};

/** 在给定连接上跑判据（`Pool` = 独立会话；`PoolClient` = 该会话所在事务，能看到本事务内的 DDL） */
export const scanTriggerEnablement = async (conn: SqlConn): Promise<TriggerScan> => {
  const res = await conn.query(TRIGGER_ENABLEMENT_SQL);
  return evaluateTriggerEnablement(res.rows.map((r) => ({
    schema: String(r.schema_name), table: String(r.table_name), trigger: String(r.trigger_name),
    tgenabled: String(r.tgenabled), state: String(r.state),
  })));
};

/** 判红时写进 `assertions_failed` 的逐项正文（含异常项清单） */
export const triggerScanReds = (scan: TriggerScan, where: string): string[] => {
  if (scan.vacuous) return [`${where}：pg_trigger 在 public 下扫到 0 条非 internal 触发器（真空绿，判据失效）`];
  return scan.anomalies.map((a) => `${where}：触发器未启用 ⇒ ${a.label}`);
};

/** pg_trigger 指纹（table.trigger → tgenabled），用于证明「禁用后复原」逐字恢复 */
export const triggerFingerprint = async (conn: SqlConn): Promise<Record<string, string>> => {
  const res = await conn.query(`
    SELECT c.relname AS table_name, t.tgname AS trigger_name, t.tgenabled::text AS enabled
      FROM pg_trigger t
      JOIN pg_class     c ON c.oid = t.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND NOT t.tgisinternal
     ORDER BY 1, 2`);
  const out: Record<string, string> = {};
  for (const r of res.rows) out[`${String(r.table_name)}.${String(r.trigger_name)}`] = String(r.enabled);
  return out;
};

export const fpMd5 = (fp: Record<string, string>): string =>
  crypto.createHash('md5').update(JSON.stringify(Object.entries(fp).sort())).digest('hex');

// ---------------------------------------------------------------- 自证 CLI

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/;          // 仅允许裸标识符（防拼接注入）

/** 自证目标：上一单真的出过事的那个触发器 + 相邻的守卫触发器（任一被禁用都必须判红） */
const TARGETS: Array<{ table: string; trigger: string; why: string }> = [
  { table: 'referral', trigger: 'trg_referral_append_only', why: '上一单 p2d-01 事务内 DISABLE 后未复原的正是这一条' },
  { table: 'referral', trigger: 'trg_referral_cycle_guard', why: '绑定守卫；它被禁用则 p1t-00 的判负用例会失去意义' },
];

async function main(): Promise<void> {
  const RUN = process.env.P1V_RUN || new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const OUT_DIR = path.resolve(__dirname, '..', '.p1v-artifacts');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const pool = mkPool(2);
  const out: Record<string, unknown> = {
    run: RUN, ts: new Date().toISOString(),
    script: 'scripts/p1v-00-trigger-enablement-guard-assert.ts',
    purpose: '证明「全局 public 非 internal 触发器必须全部 tgenabled=O」这条判据**真的能红**（不是恒绿判据），且禁用后能逐字复原',
  };
  const reds: string[] = [];

  // ---------- A 基线（独立会话）：此刻应当全绿 ----------
  const rowsBefore = await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral`);
  const baseline = await scanTriggerEnablement(pool);
  out['A_baseline_scan'] = { total: baseline.total, enabled: baseline.enabled, ok: baseline.ok,
    anomalies: baseline.anomalies, rows: baseline.rows,
    note: '独立会话读到的当前真相；若此处已判红 ⇒ 库里已经有人留下禁用态（本判据的存在意义）' };
  reds.push(...triggerScanReds(baseline, 'A 基线'));

  // ---------- A2 合成输入证伪（证明「判据本身」不是恒绿，且真空不算过）----------
  const synthOne = evaluateTriggerEnablement([
    { schema: 'public', table: 'referral', trigger: 'trg_referral_append_only', tgenabled: 'D', state: 'disabled' },
    { schema: 'public', table: 'referral', trigger: 'trg_referral_cycle_guard', tgenabled: 'O', state: 'enabled' },
  ]);
  out['A2_synthetic_evaluator_falsification'] = {
    input: [{ 'referral.trg_referral_append_only': 'D' }, { 'referral.trg_referral_cycle_guard': 'O' }],
    ok: synthOne.ok, anomalies: synthOne.anomalies,
    expected: 'ok=false 且 anomalies=[referral.trg_referral_append_only=disabled(D)]',
  };
  if (synthOne.ok) reds.push('A2：合成输入 tgenabled=D 未判红 ⇒ 判据是恒绿判据');
  if (synthOne.anomalies.length !== 1 || synthOne.anomalies[0].label !== 'referral.trg_referral_append_only=disabled(D)') {
    reds.push(`A2：异常项定位错误 ⇒ ${JSON.stringify(synthOne.anomalies)}`);
  }
  const synthEmpty = evaluateTriggerEnablement([]);
  out['A2b_synthetic_vacuous'] = { ok: synthEmpty.ok, vacuous: synthEmpty.vacuous,
    expected: 'ok=false（0 行 = 真空，不得算通过）' };
  if (synthEmpty.ok) reds.push('A2b：真空输入（0 行）被判绿 ⇒ 判据可被「触发器被删光」骗过');

  // ---------- B 事务内人为禁用 → 判红 → 同一事务内复原 → 判绿 ----------
  const conn = await pool.connect();
  const inTx: Record<string, unknown> = { targets: TARGETS.map((t) => `${t.table}.${t.trigger}`), steps: [] };
  let fpInTxBefore: Record<string, string> = {};
  let fpInTxAfter: Record<string, string> = {};
  try {
    await conn.query('BEGIN');
    fpInTxBefore = await triggerFingerprint(conn);
    inTx['fingerprint_before_md5'] = fpMd5(fpInTxBefore);
    const steps: Array<Record<string, unknown>> = [];
    for (const t of TARGETS) {
      if (!SAFE_IDENT.test(t.table) || !SAFE_IDENT.test(t.trigger)) throw new Error(`非法标识符：${t.table}.${t.trigger}`);
      const green0 = await scanTriggerEnablement(conn);
      await conn.query(`ALTER TABLE public.${t.table} DISABLE TRIGGER ${t.trigger}`);
      const rawRow = (await conn.query(
        `SELECT tgenabled::text AS e FROM pg_trigger WHERE tgname = $1 AND tgrelid = ('public.' || $2)::regclass`,
        [t.trigger, t.table])).rows[0];
      const red1 = await scanTriggerEnablement(conn);
      await conn.query(`ALTER TABLE public.${t.table} ENABLE TRIGGER ${t.trigger}`);
      const green2 = await scanTriggerEnablement(conn);
      steps.push({
        target: `${t.table}.${t.trigger}`, why: t.why,
        '1_scan_before_disable_ok': green0.ok,
        '2_raw_tgenabled_after_disable': rawRow ? String(rawRow.e) : null,
        '3_scan_after_disable': { ok: red1.ok, anomalies: red1.anomalies },
        '4_scan_after_enable': { ok: green2.ok, anomalies: green2.anomalies },
        '5_raw_tgenabled_after_enable': String(((await conn.query(
          `SELECT tgenabled::text AS e FROM pg_trigger WHERE tgname = $1 AND tgrelid = ('public.' || $2)::regclass`,
          [t.trigger, t.table])).rows[0] ?? {}).e ?? ''),
      });
      if (!green0.ok) reds.push(`B：禁用前判据就不是绿的（${t.trigger}）—— 环境异常`);
      if (String(rawRow?.e) !== 'D') reds.push(`B：DISABLE 后 pg_trigger 读数为 ${String(rawRow?.e)} ≠ 'D'（DDL 未生效）`);
      if (red1.ok) reds.push(`B：人为禁用 ${t.table}.${t.trigger} 后判据**未变红** ⇒ 该回归断言是恒绿判据（无效）`);
      const want = `${t.table}.${t.trigger}=disabled(D)`;
      if (!red1.anomalies.some((a) => a.label === want)) {
        reds.push(`B：禁用后异常项未列出 ${want} ⇒ 实为 ${JSON.stringify(red1.anomalies)}`);
      }
      if (!green2.ok) reds.push(`B：同一事务内 ENABLE 后判据仍红 ⇒ ${JSON.stringify(green2.anomalies)}`);
      if (steps[steps.length - 1]['5_raw_tgenabled_after_enable'] !== 'O') reds.push(`B：ENABLE 后 tgenabled ≠ 'O'`);
    }
    fpInTxAfter = await triggerFingerprint(conn);
    inTx['fingerprint_after_md5'] = fpMd5(fpInTxAfter);
    inTx['fingerprint_restored_in_tx'] = fpMd5(fpInTxAfter) === fpMd5(fpInTxBefore);
    inTx['fingerprint_diff_in_tx'] = Object.keys({ ...fpInTxBefore, ...fpInTxAfter })
      .filter((k) => fpInTxBefore[k] !== fpInTxAfter[k]).map((k) => `${k}: ${fpInTxBefore[k]} -> ${fpInTxAfter[k]}`);
    if (fpMd5(fpInTxAfter) !== fpMd5(fpInTxBefore)) reds.push('B：同一事务内 ENABLE 后指纹未逐字恢复');
    inTx['steps'] = steps;
    await conn.query('COMMIT');
    inTx['committed'] = true;
  } catch (e) {
    await conn.query('ROLLBACK').catch(() => undefined);
    inTx['committed'] = false;
    inTx['error'] = String((e as Error)?.message ?? e).slice(0, 300);
    reds.push(`B：事务内自证抛错 ⇒ ${inTx['error']}（已 ROLLBACK，库里不会有残留禁用态）`);
  } finally { conn.release(); }
  out['B_in_tx_disable_falsification'] = { ...inTx,
    note: '同一会话同一事务：DISABLE ⇒ 判据变红（异常项逐条列出）⇒ ENABLE ⇒ 判据变绿；事务 COMMIT 前已复原' };

  // ---------- C 提交后（新会话）复核：库里不得留下禁用态 ----------
  const post = await scanTriggerEnablement(pool);
  const fpPost = await triggerFingerprint(pool);
  const rowsAfter = await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral`);
  const ledger = await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM ledger_entry`);
  out['C_post_commit_verify'] = {
    scan_ok: post.ok, enabled: post.enabled, total: post.total, anomalies: post.anomalies,
    fingerprint_md5: fpMd5(fpPost), equals_baseline_fingerprint: fpMd5(fpPost) === fpMd5(fpInTxBefore),
    diff_vs_baseline: Object.keys({ ...fpInTxBefore, ...fpPost }).filter((k) => fpInTxBefore[k] !== fpPost[k])
      .map((k) => `${k}: ${fpInTxBefore[k]} -> ${fpPost[k]}`),
    referral_count_before: rowsBefore[0].n, referral_count_after: rowsAfter[0].n,
    ledger_entry_count: ledger[0].n,
    zero_writes_by_this_script: rowsBefore[0].n === rowsAfter[0].n,
  };
  reds.push(...triggerScanReds(post, 'C 提交后复核'));
  if (!out['C_post_commit_verify']) {
    reds.push('C：无读数');
  } else {
    const c = out['C_post_commit_verify'] as { equals_baseline_fingerprint: boolean; zero_writes_by_this_script: boolean };
    if (!c.equals_baseline_fingerprint) reds.push('C：提交后指纹 ≠ 基线指纹 ⇒ 本脚本留下了 pg_trigger 变更');
    if (!c.zero_writes_by_this_script) reds.push('C：referral 行数变化 ⇒ 本脚本不干净（应零写入）');
  }

  // ---------- D 端到端（提交态，`--e2e-committed` 才跑）：禁用 ⇒ **直接跑 p1t-00 子进程** ⇒ 必须判红/前置退出 ⇒ 复原 ----------
  //    这是「那条回归断言能变红」的最强形式：不是喂合成输入，而是**真的禁用**后跑真正的判据脚本。
  //    安全性：`referral` 只有本单探针写；每个 phase 用 try/finally 复原，并在 phase 后复核指纹。
  if (process.argv.includes('--e2e-committed')) {
    const ROOT = path.resolve(__dirname, '..');
    const refBeforeAll = Number((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral`))[0].n);
    const phases: Array<Record<string, unknown>> = [];
    for (const ph of [
      { name: 'e2e-1-append-only-disabled', table: 'referral', trigger: 'trg_referral_append_only', expect_exit: 1,
        why: '禁用态下 p1t-00 必须**判红**（异常项逐条列出），而不是静默绿' },
      { name: 'e2e-2-cycle-guard-disabled', table: 'referral', trigger: 'trg_referral_cycle_guard', expect_exit: 3,
        why: '禁用态下 p1t-00 必须在前置闸 exit 3 且**不写任何数据**（否则会把 stale-depth 边写进 INSERT-only 表）' },
    ]) {
      const rec: Record<string, unknown> = { phase: ph.name, disabled: `${ph.table}.${ph.trigger}`, expected_exit: ph.expect_exit, why: ph.why };
      const refBefore = Number((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral`))[0].n);
      try {
        await pool.query(`ALTER TABLE public.${ph.table} DISABLE TRIGGER ${ph.trigger}`);
        const mid = await scanTriggerEnablement(pool);
        rec['scan_while_disabled'] = { ok: mid.ok, anomalies: mid.anomalies };
        // 子进程：p1t-00 真跑。exit 2 = FATAL（**含 Neon websocket ECONNRESET 这类基础设施抖动**）
        // ⇒ 重试（最多 3 次），**每次尝试的退出码都落盘**，绝不把 exit 2 当成「判红」蒙混过去。
        const attempts: Array<Record<string, unknown>> = [];
        let child: ReturnType<typeof spawnSync> | null = null;
        for (let i = 1; i <= 3; i++) {
          child = spawnSync('npx', ['ts-node', '--transpile-only', 'scripts/p1t-00-bind-protocol-guard.ts', '--assert'],
            { cwd: ROOT, env: { ...process.env, P1T_RUN: `p1v-${ph.name}-${RUN}-try${i}` }, encoding: 'utf8', timeout: 300_000 });
          attempts.push({ attempt: i, exit: child.status, uid_window_from_stdout: (() => {
            try { return (JSON.parse(String(child?.stdout ?? '').trim()) as Record<string, unknown>)['uid_window_base'] ?? null; } catch { return null; }
          })() });
          if (child.status !== 2) break;
          await sleep(2000);
        }
        rec['child_attempts'] = attempts;
        if (!child) throw new Error('spawnSync 未执行（内部错误）');
        const ch = child;
        const childFile = path.join(OUT_DIR, `${ph.name}-p1t-00-stdout.txt`);
        fs.writeFileSync(childFile, `# cmd: npx ts-node --transpile-only scripts/p1t-00-bind-protocol-guard.ts --assert\n# attempts(exit)=${JSON.stringify(attempts.map((a) => a.exit))}\n# exit=${String(ch.status)}\n${String(ch.stdout ?? '')}\n# ---- stderr ----\n${String(ch.stderr ?? '')}`);
        let parsed: Record<string, unknown> = {};
        try { parsed = JSON.parse(String(ch.stdout ?? '').trim()) as Record<string, unknown>; } catch { /* 见落盘文件 */ }
        rec['child_exit'] = ch.status;
        rec['child_stdout_file'] = childFile;
        rec['child_assertions_failed'] = parsed['assertions_failed'] ?? null;
        rec['child_uid_window_base'] = parsed['uid_window_base'] ?? null;
        rec['child_fatal'] = parsed['fatal'] ?? null;
      } finally {
        await pool.query(`ALTER TABLE public.${ph.table} ENABLE TRIGGER ${ph.trigger}`);
      }
      const refAfter = Number((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral`))[0].n);
      const reScan = await scanTriggerEnablement(pool);
      rec['referral_rows_before_phase'] = refBefore;
      rec['referral_rows_after_phase'] = refAfter;
      rec['scan_after_reenable'] = { ok: reScan.ok, anomalies: reScan.anomalies };
      rec['fingerprint_restored_after_reenable'] = fpMd5(await triggerFingerprint(pool)) === fpMd5(fpInTxBefore);
      // 判据
      if (rec['child_exit'] !== ph.expect_exit) {
        reds.push(`D[${ph.name}]：p1t-00 退出码 = ${String(rec['child_exit'])} ≠ 期望 ${ph.expect_exit}`);
      }
      if (!reScan.ok) reds.push(`D[${ph.name}]：ENABLE 后判据仍红 ⇒ ${JSON.stringify(reScan.anomalies)}`);
      if (rec['fingerprint_restored_after_reenable'] !== true) reds.push(`D[${ph.name}]：复原后指纹 ≠ 基线指纹`);
      if (ph.expect_exit === 1) {
        const redsChild = JSON.stringify(rec['child_assertions_failed'] ?? []);
        if (!redsChild.includes(`${ph.table}.${ph.trigger}=disabled(D)`)) {
          reds.push(`D[${ph.name}]：p1t-00 的 assertions_failed 未列出 ${ph.table}.${ph.trigger}=disabled(D) ⇒ 实为 ${redsChild}`);
        }
      } else {
        const fatalTxt = JSON.stringify(rec['child_fatal'] ?? null);
        if (!fatalTxt.includes('PRECONDITION_NOT_MET')) reds.push(`D[${ph.name}]：p1t-00 未给出 PRECONDITION_NOT_MET ⇒ ${fatalTxt}`);
        if (refAfter !== refBefore) reds.push(`D[${ph.name}]：前置退出却写了 ${refAfter - refBefore} 行 referral ⇒ 前置闸没拦住`);
      }
      phases.push(rec);
    }
    const refAfterAll = Number((await raw<{ n: string }>(pool, `SELECT count(*)::text n FROM referral`))[0].n);
    out['D_e2e_committed_disable'] = { phases,
      referral_rows_before_all: refBeforeAll, referral_rows_after_all: refAfterAll,
      fingerprint_md5_after_all: fpMd5(await triggerFingerprint(pool)),
      note: '提交态禁用 + 真跑 p1t-00 子进程；每个 phase 用 try/finally 复原并复核指纹。本阶段自身零写入 referral' };
  }

  out['assertions_failed'] = reds;
  out['ok'] = reds.length === 0;
  const file = path.join(OUT_DIR, `p1v-00-trigger-enablement-guard-assert-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(OUT_DIR, `p1v-00-stdout-${RUN}.txt`), jstr(out));
  console.log(JSON.stringify({
    file, run: RUN, ok: out['ok'], assertions_failed: reds,
    main_reads: {
      A_baseline: { ok: baseline.ok, total: baseline.total, anomalies: baseline.anomalies },
      A2_synthetic: out['A2_synthetic_evaluator_falsification'],
      B_in_tx: (out['B_in_tx_disable_falsification'] as Record<string, unknown>)['steps'],
      C_post: out['C_post_commit_verify'],
    },
  }, null, 1));
  await pool.end();
  if (reds.length > 0) process.exit(1);
}

if (require.main === module) {
  main().catch((e) => { console.error('FATAL', e); process.exit(2); });
}
