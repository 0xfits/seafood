/**
 * P1n · `toCid` 形状闸取证（修前 / 修后 **同一脚本、同一组用例**）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p1n-00-cid-shape.ts --phase before|after|revert
 * 落盘：`.p1f-artifacts/p1n-tocid-shape-<phase>-<RUN>.json`（**只新增**：文件名一律带 run tag，
 *       绝不覆盖任何既有读数文件）
 *
 * 三段读数（本脚本 = 本组读数的**唯一可复跑取证脚本**，保留，不得删除）：
 *   ① 最初的 404（改之前）        ⇒ `.p1f-artifacts/p1n-tocid-shape-before.json`（run I0AUQ）
 *   ② 上一轮被改错的 400          ⇒ `.p1f-artifacts/p1n-tocid-shape-after.json`（run I5JZU）
 *   ③ 回退后的 404（本轮）        ⇒ `.p1f-artifacts/p1n-tocid-shape-revert-<RUN>.json`
 *      （本轮同时重跑 before / after 两个 phase 作为同轮复现：回退后三者读数应一致 = 404）
 *
 * 背景（Zang **重新裁定**（P1n 回退轮））：
 *   标识符参数（cid / uid）——**形状非法**（非十进制整数 / 空 / 超 bigint / 缺失）
 *   ⇒ 400 `LEDGER_AMOUNT_INVALID` + `details.reason` + `details.field`；
 *   **形状合法但该行不存在** ⇒ 404（`cid <= 0` 属这一类，因为 `currency.cid` 是正整数序列）。
 *   ⇒ `toCid` 对 `cid <= 0` 必须是 **404 `LEDGER_CURRENCY_NOT_FOUND` + `{cid}`**，
 *   与 DB 侧 `ledger_cid_arg` **逐字一致**（实测 `LD007`/404，自 0004 起从未是 400）。
 *
 * 取证内容（TS 侧 code+status+details；DB 侧**逐字对照**）：
 *   - `ledger_cid_arg(p_raw)`           = cid 形状闸（形状闸 + `<=0` 归「不存在」）
 *   - `ledger_int_amount(p_raw,'cid')`  = 形状闸原语（NOT_DECIMAL_INTEGER / MISSING / 越界）
 *   - `ledger_post_event($1::jsonb)`    = **全路径**对照（与 TS transfer 同一 op 形状，逐字对拍）
 *
 * 测试数据分区：uid **947xxx** / symbol 前缀 **p1o** / 键前缀 **ops:p1o:***。
 * **本脚本不写账本**：所有用例都在参数校验阶段失败（或只读既有币种），
 * `rows_touched` 恒为 0（脚本自证：末尾回读 ledger_entry 总行数前后一致）。
 * 绝不触碰 cid=1 与平台账户（唯一只读用例 cid=93 为 P1f/P1c 既有测试币）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from '@neondatabase/serverless';
import { mkPool, raw, attempt, pgInfo, FN_SQL } from './p1f-lib';
import {
  getCurrency, transfer, closeLedgerWritePool,
} from '../src/ledger';
import { LEDGER_ERROR_TABLE } from '../src/ledger-errors';

const phaseArg = ((): string => {
  const i = process.argv.indexOf('--phase');
  const v = i >= 0 ? process.argv[i + 1] : '';
  return v === 'before' || v === 'after' || v === 'revert' ? v : 'unspecified';
})();

const RUN = Date.now().toString(36).toUpperCase().slice(-5);
const K = (s: string): string => `ops:p1o:${RUN}:${s}`;
/** 测试数据分区：uid 947xxx（本组专用；绝不触碰 cid=1 与平台账户 0/-1/-2/-3） */
const U1 = '947001';
const U2 = '947002';

type CaseOut = Record<string, unknown>;

/** TS 侧：把一次调用收敛成「不掉异常」的读数（code / status / message / details） */
const tsCase = async (label: string, fn: () => Promise<unknown>): Promise<CaseOut> => {
  const t0 = Date.now();
  try {
    const v = await fn();
    const rec = v as { cid?: unknown } | null;
    return {
      label, outcome: 'no_throw', elapsed_ms: Date.now() - t0,
      returned_cid: rec && typeof rec === 'object' && 'cid' in rec ? String(rec.cid) : null,
    };
  } catch (e) {
    const a = e as {
      name?: string; code?: unknown; status?: unknown; message?: unknown;
      details?: unknown; i18nKey?: unknown;
    };
    return {
      label, outcome: 'thrown', elapsed_ms: Date.now() - t0,
      error_name: a?.name ?? null,
      code: (a?.code as string) ?? null,
      http_status: (a?.status as number | null) ?? null,
      message: (a?.message as string) ?? null,
      i18n_key: (a?.i18nKey as string) ?? null,
      details: (a?.details as unknown) ?? null,
    };
  }
};

/** DB 侧：直调函数取原始 SQLSTATE / MESSAGE / DETAIL（逐字对照用） */
const dbCase = async (p: Pool, label: string, sql: string, params: unknown[] = []): Promise<CaseOut> => {
  const t0 = Date.now();
  try {
    const rows = await raw(p, sql, params);
    return { label, sql, ok: true, elapsed_ms: Date.now() - t0, rows };
  } catch (e) {
    return { label, sql, ok: false, elapsed_ms: Date.now() - t0, error: pgInfo(e) };
  }
};

const main = async (): Promise<void> => {
  const admin = mkPool(2);
  const out: Record<string, unknown> = {
    probe: 'P1N-00 · toCid 形状闸', phase: phaseArg, run: RUN,
    started_at: new Date().toISOString(),
    note: '同一组用例的修前/修后对照；本脚本不写账本（全部用例在参数校验阶段失败或只读）',
  };

  const entriesBefore = String((await raw<{ n: string }>(admin,
    'SELECT count(*)::text AS n FROM ledger_entry'))[0].n);

  // ---------------------------------------------------------------- 环境自证
  out.env = {
    schema_version: await raw(admin, "SELECT value AS v FROM schema_version WHERE key = 'schema_version'")
      .catch(async () => await raw(admin, 'SELECT version AS v FROM schema_migration ORDER BY version DESC LIMIT 1')),
    schema_migration_rows: await raw(admin, 'SELECT version, checksum AS ck FROM schema_migration ORDER BY version'),
  };

  // ---------------------------------------------------------------- TS 侧用例（公开 API 路径）
  const ts: Record<string, CaseOut> = {};
  ts['A1_getCurrency_cid_0_number'] = await tsCase('getCurrency(0)（JSON number 0）', () => getCurrency(0));
  ts['A2_getCurrency_cid_0_string'] = await tsCase("getCurrency('0')", () => getCurrency('0'));
  ts['A3_getCurrency_cid_neg5'] = await tsCase("getCurrency('-5')", () => getCurrency('-5'));
  ts['A4_getCurrency_cid_min'] = await tsCase("getCurrency('-9223372036854775808')", () => getCurrency('-9223372036854775808'));
  ts['A5_getCurrency_cid_abc'] = await tsCase("getCurrency('abc')（形状非法·控制组）", () => getCurrency('abc'));
  ts['A6_getCurrency_cid_93_absent'] = await tsCase("getCurrency('93')（形状合法但当前库无此币 ⇒ 返回 null，不抛）", () => getCurrency('93'));
  ts['A7_getCurrency_cid_absent'] = await tsCase("getCurrency('999999999999')（形状合法但不存在）", () => getCurrency('999999999999'));
  ts['A8_transfer_cid_0'] = await tsCase(`transfer({cid:'0', uid ${U1}→${U2}, key ops:p1o:<run>:cid0})`,
    () => transfer({ fromUid: U1, toUid: U2, cid: '0', amount: '1', idempotencyKey: K('cid0') }));
  ts['A9_transfer_cid_abc'] = await tsCase("transfer({cid:'abc'})（形状非法·控制组）",
    () => transfer({ fromUid: U1, toUid: U2, cid: 'abc', amount: '1', idempotencyKey: K('cidabc') }));
  // 「形状合法但币种不存在」的 404 主干路径：形状闸放行 ⇒ 一路到 DB 函数 ⇒ LD007/404（不写任何行）
  ts['A10_transfer_cid_absent'] = await tsCase("transfer({cid:'999999999999'})（形状合法·币种不存在 ⇒ 期望 404 不变）",
    () => transfer({ fromUid: U1, toUid: U2, cid: '999999999999', amount: '1', idempotencyKey: K('cidabsent') }));
  ts['A11_getCurrency_cid_empty'] = await tsCase("getCurrency('')（空串 ⇒ 形状非法）", () => getCurrency(''));
  ts['A12_transfer_cid_empty'] = await tsCase("transfer({cid:''})（空串·形状非法）",
    () => transfer({ fromUid: U1, toUid: U2, cid: '', amount: '1', idempotencyKey: K('cidempty') }));
  ts['A13_getCurrency_cid_missing'] = await tsCase('getCurrency(undefined)（缺失 ⇒ 形状非法；登记 TS/DB 的 reason 差异）',
    () => getCurrency(undefined as never));
  ts['A14_transfer_cid_neg5'] = await tsCase("transfer({cid:'-5'})（负数 = 形状合法但不存在 ⇒ 404，与 DB ledger_cid_arg 同口径）",
    () => transfer({ fromUid: U1, toUid: U2, cid: '-5', amount: '1', idempotencyKey: K('cidneg5') }));
  out.ts_cases = ts;

  // ---------------------------------------------------------------- 错误码表（status 逐字）
  // ★ S32b（台账 B15）：原为 4 条**整对象**（含 message）—— 随 S31 的 message 契约改造（中文句 ⇒ 稳定英文句）漂移。
  //   message 文本与「cid 形状闸」无关 ⇒ 只钉稳定量 `status`（本段原注释即「status 逐字」）。
  //   message 出处 = `src/ledger-errors.ts#LEDGER_ERROR_TABLE[<CODE>].message`（S31 英文句），不在此对拍面。
  out.error_table = {
    LEDGER_AMOUNT_INVALID: { status: LEDGER_ERROR_TABLE.LEDGER_AMOUNT_INVALID.status },
    LEDGER_AMOUNT_NOT_POSITIVE: { status: LEDGER_ERROR_TABLE.LEDGER_AMOUNT_NOT_POSITIVE.status },
    LEDGER_CURRENCY_NOT_FOUND: { status: LEDGER_ERROR_TABLE.LEDGER_CURRENCY_NOT_FOUND.status },
    LEDGER_RESERVED_UID: { status: LEDGER_ERROR_TABLE.LEDGER_RESERVED_UID.status },
  };
  out.error_table_note = 'status 为与 cid 形状闸相关的稳定量；message 文本属 S31 契约（src/ledger-errors.ts#LEDGER_ERROR_TABLE），不在本对拍面';

  // ---------------------------------------------------------------- DB 侧（分类器逐字对照）
  const db: Record<string, CaseOut> = {};
  db['B1_ledger_cid_arg_0'] = await dbCase(admin, "ledger_cid_arg('0')（DB 侧 cid<=0 的现有分支）", 'SELECT ledger_cid_arg($1) AS c', ['0']);
  db['B2_ledger_cid_arg_neg5'] = await dbCase(admin, "ledger_cid_arg('-5')", 'SELECT ledger_cid_arg($1) AS c', ['-5']);
  db['B3_ledger_cid_arg_abc'] = await dbCase(admin, "ledger_cid_arg('abc')（DB 侧形状闸）", 'SELECT ledger_cid_arg($1) AS c', ['abc']);
  db['B4_ledger_int_amount_abc'] = await dbCase(admin, "ledger_int_amount('abc','cid')（DB 侧形状闸原语）",
    'SELECT ledger_int_amount($1, $2) AS c', ['abc', 'cid']);
  db['B5_ledger_parse_user_amount_0'] = await dbCase(admin, "ledger_parse_user_amount('0',2,'cid','93')（DB 侧非正分支：**注意与 cid 闸无关**，仅作对照）",
    'SELECT ledger_parse_user_amount($1, $2, $3, $4) AS v', ['0', 2, 'cid', '93']);
  db['B6_classifier_23503'] = await dbCase(admin, "ledger_error_for_sqlstate('23503','fk_account_cid')（FK ⇒ 404 类）",
    'SELECT ledger_error_for_sqlstate($1, $2) AS j', ['23503', 'fk_account_cid']);
  db['B7_db_ledger_entry_rows'] = await dbCase(admin, '当前库 ledger_entry 行数（返修期间不写账本的自证）',
    'SELECT count(*)::text AS n FROM ledger_entry');
  // -------------------------------------------------------------- 本轮新增：'' / 越界 / 不存在的 cid（逐字对拍用）
  db['B8_ledger_cid_arg_empty'] = await dbCase(admin, "ledger_cid_arg('')（空串）", 'SELECT ledger_cid_arg($1) AS c', ['']);
  db['B9_ledger_cid_arg_absent'] = await dbCase(admin, "ledger_cid_arg('999999999999')（形状合法 ⇒ 闸放行，返回原值；存在性由后续查询判）",
    'SELECT ledger_cid_arg($1) AS c', ['999999999999']);
  db['B10_ledger_cid_arg_neg_min'] = await dbCase(admin, "ledger_cid_arg('-9223372036854775808')（bigint 下界）",
    'SELECT ledger_cid_arg($1) AS c', ['-9223372036854775808']);
  db['B11_ledger_cid_arg_out_of_bigint'] = await dbCase(admin, "ledger_cid_arg('99999999999999999999999')（超 bigint）",
    'SELECT ledger_cid_arg($1) AS c', ['99999999999999999999999']);
  out.db_cases = db;

  // ---------------------------------------------------------------- DB 侧「全路径」逐字对拍（与 TS transfer 同一 op 形状）
  // 全部在参数/存在性校验阶段失败 ⇒ 不写任何行（rows_touched 自证）
  const dbPath: Record<string, CaseOut> = {};
  const pathCases: Array<[string, string | undefined]> = [
    ['P1_dbpath_cid_0', '0'],
    ['P2_dbpath_cid_neg5', '-5'],
    ['P3_dbpath_cid_abc', 'abc'],
    ['P4_dbpath_cid_empty', ''],
    ['P5_dbpath_cid_absent', '999999999999'],
    ['P6_dbpath_cid_missing', undefined],
  ];
  for (const [k, v] of pathCases) {
    const payload: Record<string, unknown> = {
      op: 'transfer', idempotency_key: K(`dbpath:${k}`), from_uid: U1, to_uid: U2, amount_units: '1',
    };
    if (v !== undefined) payload.cid = v;
    const a = await attempt(admin, payload);
    dbPath[k] = {
      label: `ledger_post_event transfer cid=${v === undefined ? '<缺失>' : `'${v}'`}`,
      sql: FN_SQL, ok: a.ok, error: a.error ?? null, txid: a.txid ?? null, elapsed_ms: a.elapsed_ms ?? null,
    };
  }
  out.db_path_cases = dbPath;

  // ---------------------------------------------------------------- 不写账本自证
  const entriesAfter = String((await raw<{ n: string }>(admin,
    'SELECT count(*)::text AS n FROM ledger_entry'))[0].n);
  out.rows_touched = {
    ledger_entry_before: entriesBefore,
    ledger_entry_after: entriesAfter,
    wrote_nothing: entriesBefore === entriesAfter,
  };
  out.finished_at = new Date().toISOString();

  const dir = path.resolve(__dirname, '..', '.p1f-artifacts');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `p1n-tocid-shape-${phaseArg}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`WROTE ${file}`);
  console.log(JSON.stringify({
    phase: phaseArg, run: RUN,
    ts: Object.fromEntries(Object.entries(ts).map(([k, v]) => [k, {
      outcome: (v as CaseOut).outcome, code: (v as CaseOut).code ?? null, status: (v as CaseOut).http_status ?? null,
      details: (v as CaseOut).details ?? null,
    }])),
    db_path: Object.fromEntries(Object.entries(dbPath).map(([k, v]) => [k, {
      ok: v.ok, error_code: (v.error as { code?: string } | null)?.code ?? null,
      error_message: (v.error as { message?: string } | null)?.message ?? null,
      error_detail: (v.error as { detail?: string } | null)?.detail ?? null,
    }])),
    rows_touched: out.rows_touched,
  }, null, 1));

  await admin.end().catch(() => undefined);
};

process.on('unhandledRejection', (r) => { console.error('UNHANDLED_REJECTION(ignored):', String(r).slice(0, 200)); });

main()
  .then(async () => { await closeLedgerWritePool().catch(() => undefined); process.exit(0); })
  .catch(async (e) => {
    console.error('P1N-00 FAILED:', (e as Error)?.stack ?? e);
    await closeLedgerWritePool().catch(() => undefined);
    process.exit(1);
  });
