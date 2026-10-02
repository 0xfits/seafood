/**
 * 批 8④ 补漏（`route-layer.spec` v2.8 §23.5 · `data-layer.spec` v0.15 §26）·
 * **C2 审核闸 + 四段真链路**（通过 / 驳回 / 幂等 / 非法入参）真生效读数探针。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s4-01-effective.ts
 * 产物：backend-ts/.p8s4-artifacts/p8s4-effective-<RUN>/effective.json
 *
 * ★ `R-8-15` / `R-8-18`（**逐字执行**）：本探针**全部**在**一个** `withTransaction` 事务内完成，
 *   末尾抛哨兵 ⇒ 回调异常 ⇒ `withTransaction` 走 catch ⇒ **`ROLLBACK`（绝不 COMMIT）**。
 *   · **零生产 HTTP 写**（不跑真 POST）⇒ 报告登记「HTTP 写面 = `NOT_MEASURED`」；
 *   · 造 `currency` 行 / 写台账 / 读 `ledger_entry` / `currency_status_log` / `currency_review_log`
 *     一律**事务内**，取证后整体回滚 ⇒ **生产库零净写**；
 *   · `currency_review_log` / `currency_status_log` 均 append-only ⇒ **禁生产落真写**（本探针靠 ROLLBACK）。
 *
 * 四段（§23.5 按变体 Ⅱ）：
 *   ① 后台动作 → ② 库内落值（台账 / `currency.status` / `currency_status_log`）→
 *   ③ 业务读口取数（`文件:行`）→ ④ 行为随之（**改动前 / 改动后两读数**：未审 C2 拒 ⇄ 通过后放行）。
 *   两读数另一半（**改动前** = 无闸 ⇒ 未审可上市）由**仓外副本**（去掉闸）跑**同一探针**取得。
 *
 * ⚠️ 只打印 uid / cid / 计数 / 金额 / 机读字段，**不打印任何密钥 / 连接串 / `.env` 内容**。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { withTransaction, closePools, txQuery, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { parseReviewInput } from '../src/currency-review-service';
import { assertCurrencyOperable, type CurrencyRecord, type CurrencyStatus } from '../src/ledger';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const OUT_DIR = path.join(HERE, '..', '.p8s4-artifacts', `p8s4-effective-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const FEE = 10000;   // = CURRENCY_LIST_FEE_FLOOR（服务端下限；仅作探针入参）
const DEPOSIT = 50000; // = listing_deposit 现取下限（仅作探针入参）

interface Check { id: string; group: string; pass: boolean; detail: unknown; neg_rule: string; }
const checks: Check[] = [];
const rec = (id: string, group: string, pass: boolean, detail: unknown, negRule: string): void => {
  checks.push({ id, group, pass, detail, neg_rule: negRule });
};
const judge = (id: string, group: string, actual: unknown, expected: unknown, negRule: string): boolean => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  rec(id, group, ok, { actual, expected }, negRule);
  return ok;
};

const fp = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const token = (seed: string, i: number): string =>
  BigInt('0x' + createHash('sha256').update(`${seed}:${i}`).digest('hex').slice(0, 16)).toString(36).padStart(6, '0').slice(0, 6);

class RollbackSentinel extends Error {
  constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); }
}

// ---------------------------------------------------------------- DB 只读小工具（事务内）
const countReview = async (tx: TxClient, cid: number): Promise<number> =>
  Number((await txQuery<{ n: string }>(tx, `SELECT count(*)::text AS n FROM public.currency_review_log WHERE cid = $1::bigint`, [String(cid)]))[0]?.n ?? '0');
const countStatusLog = async (tx: TxClient, cid: number): Promise<number> =>
  Number((await txQuery<{ n: string }>(tx, `SELECT count(*)::text AS n FROM public.currency_status_log WHERE cid = $1::bigint`, [String(cid)]))[0]?.n ?? '0');
const countLegs = async (tx: TxClient, key: string): Promise<number> =>
  Number((await txQuery<{ n: string }>(tx, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key = $1::text OR idempotency_key LIKE $1::text || '#%'`, [key]))[0]?.n ?? '0');
const currencyRow = async (tx: TxClient, cid: number): Promise<Record<string, unknown> | null> =>
  (await txQuery<Record<string, unknown>>(tx,
    `SELECT cid::text AS cid, symbol, name, icon_url, owner_uid::text AS owner_uid, decimals,
            total_supply::text AS total_supply, supply_cap::text AS supply_cap, status,
            deposit_amount::text AS deposit_amount, deposit_cid::text AS deposit_cid,
            listed_at::text AS listed_at, time_created::text AS time_created, time_updated::text AS time_updated
       FROM public.currency WHERE cid = $1::bigint`, [String(cid)]))[0] ?? null;
const insertDraft = async (tx: TxClient, cid: number, symbol: string, ownerUid: number): Promise<void> => {
  await txQuery(tx,
    `INSERT INTO public.currency (cid, symbol, name, owner_uid, decimals, status, deposit_cid)
     VALUES ($1::bigint, $2::text, $3::text, $4::bigint, 0, 'draft', 1)`,
    [String(cid), symbol, `p8s4 review gate probe ${symbol}`, String(ownerUid)]);
};

/** ④ 行为随之：R28 —— `hold`（挂单）/ `price`（标价 / 计酬）在 `status` 下是否可操作（不抛）。 */
const r28 = (status: CurrencyStatus, op: 'hold' | 'price'): { ok: boolean; code: string | null } => {
  const cur = { cid: '999999001', symbol: 'P8S4R28', name: 'r28', icon_url: '', owner_uid: '1', decimals: 0,
    total_supply: '0', supply_cap: null, status, deposit_amount: '0', deposit_cid: '1',
    listed_at: null, time_created: null, time_updated: null } as CurrencyRecord;
  try { assertCurrencyOperable(cur, op); return { ok: true, code: null }; }
  catch (e) { return { ok: false, code: String((e as { code?: unknown })?.code ?? (e as Error)?.message ?? 'unknown') }; }
};

const summary: Record<string, unknown> = {};

const main = async (): Promise<void> => {
  try {
    await withTransaction(async (tx) => {
      // ---- 0 · 夹具（只读复用既有 owner / admin；cids / symbols / keys 本跑独占新值）
      const ownerRow = (await txQuery<{ uid: string; balance: string }>(tx,
        `SELECT a.uid::text AS uid, a.balance::text AS balance FROM public.account a
          WHERE a.cid = 1 AND a.uid > 0 AND a.balance >= ${FEE + DEPOSIT} ORDER BY a.balance DESC, a.uid ASC LIMIT 1`))[0];
      const adminRow = (await txQuery<{ uid: string }>(tx,
        `SELECT uid::text AS uid FROM public.users WHERE is_admin = true ORDER BY uid ASC LIMIT 1`))[0];
      if (!ownerRow || !adminRow) throw new Error('PRECONDITION: no funded owner / no admin user');
      const owner = Number(ownerRow.uid);
      const admin = Number(adminRow.uid);
      summary.fixture = { owner_uid: owner, admin_uid: admin, owner_balance_cid1: Number(ownerRow.balance) };

      const base = 900000000 + (parseInt(createHash('sha256').update(RUN).digest('hex').slice(0, 6), 16) % 100000) * 10;
      const cidA = base + 1, cidB = base + 2, cidC = base + 3;
      const taken = (await txQuery<{ cid: string }>(tx, `SELECT cid::text AS cid FROM public.currency WHERE cid IN ($1,$2,$3)`, [String(cidA), String(cidB), String(cidC)])).map((r) => r.cid);
      if (taken.length) throw new Error(`PRECONDITION: cid window taken ${JSON.stringify(taken)}`);
      const symA = `p8s4${token(RUN, 1)}`, symB = `p8s4${token(RUN, 2)}`, symC = `p8s4${token(RUN, 3)}`;
      const keyA = `biz:currency:list:${cidA}`, keyB = `biz:currency:list:${cidB}`, keyC = `biz:currency:list:${cidC}`;
      const opsA = `ops:${admin}:currency_review:${cidA}`;
      const opsB = `ops:${admin}:currency_review:${cidB}`;
      const opsC = `ops:${admin}:currency_review:${cidC}`;
      summary.fixture.cids = { a: cidA, b: cidB, c: cidC };
      summary.fixture.symbols = { a: symA, b: symB, c: symC };

      // =========================================================================================
      // 段 A · 通过路径（① 后台动作 → ② 库内落值三处 → ③ 业务读口 → ④ 行为随之两读数）
      // =========================================================================================
      await insertDraft(tx, cidA, symA, owner);

      // ①-a 未审时 C2（④ 行为之「改动后」读数：无已通过台账行 ⇒ 拒）
      const pre = await DatabaseService.listCurrencyWithDeposit({
        cid: cidA, actorUid: owner, fee: FEE, depositAmount: DEPOSIT,
        idempotencyKey: keyA, requestFingerprint: fp(['list', cidA, owner, FEE, DEPOSIT]), memo: `currency_list_deposit:${cidA}`,
      }, tx);
      const preApplied = Number(pre.applied ?? 0);
      const preStatus = String(pre.cur_status ?? '');
      const preRow = await currencyRow(tx, cidA);           // 事后真读（非 SQL 快照列）
      const preStatusPost = String(preRow?.status ?? '');
      const preLegs = await countLegs(tx, keyA);
      const preSlog = await countStatusLog(tx, cidA);
      summary.unreviewed_c2 = { applied: preApplied, cur_status_snapshot: preStatus, status_post: preStatusPost, ledger_legs: preLegs, status_log_rows: preSlog };
      judge('A1', 'listGate', preApplied, 0, '未审（无 approved 台账行）C2 必须不产行（applied=0）⇒ 未审可上市 ⇒ 判负');
      judge('A2', 'listGate', preStatusPost, 'draft', '未审 C2 后 currency.status 仍 draft（事后真读）⇒ 变了 ⇒ 判负');
      judge('A3', 'listGate', preLegs, 0, '未审 C2 零账本分录 ⇒ 有分录 ⇒ 判负');
      judge('A4', 'listGate', preSlog, 0, '未审 C2 不写 currency_status_log ⇒ 有行 ⇒ 判负');
      // 服务层映射（同 §23.5 ④ 锚点 @ currency-service.ts:454）：applied=0 + 非本人外 + 无键命中 ⇒ stateConflict 409
      rec('A5', 'listGate', preApplied === 0 && preStatus === 'draft' && preLegs === 0,
        { maps_to: "stateConflict('currency.status','CURRENCY_STATE_INVALID',{required_from:'draft'}) @ currency-service.ts:454 → 409 LD011", applied: preApplied },
        '服务层须落既有 409 LD011 / reason=CURRENCY_STATE_INVALID（零新增码 / 零新增 reason 常量）');

      // ①-b 后台动作：approve
      const ap = await DatabaseService.currencyReviewPostEvent({
        cid: cidA, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidA, 'approve', 'probe approved']),
        idempotencyKey: opsA, memo: 'probe approved',
      }, tx);
      summary.approve_receipt = { cur_found: Number(ap.cur_found ?? 0), prior_count: Number(ap.prior_count ?? 0), applied: Number(ap.applied ?? 0), slogged: Number(ap.slogged ?? 0), reviewed: Number(ap.reviewed ?? 0) };
      judge('A6', 'approvePath', { f: Number(ap.cur_found ?? 0), a: Number(ap.applied ?? 0), s: Number(ap.slogged ?? 0), r: Number(ap.reviewed ?? 0) },
        { f: 1, a: 1, s: 1, r: 1 }, '通过路径须 cur_found=1 / applied=1 / slogged=1 / reviewed=1 ⇒ 任一不等 ⇒ 判负');

      // ② 库内落值三处
      const revA = (await txQuery<Record<string, unknown>>(tx,
        `SELECT result, actor_uid::text AS actor_uid, cid::text AS cid, memo, (time_created IS NOT NULL) AS has_time
           FROM public.currency_review_log WHERE cid = $1::bigint`, [String(cidA)]));
      const rowA = await currencyRow(tx, cidA);
      const slogA = (await txQuery<Record<string, unknown>>(tx,
        `SELECT from_status, to_status, actor_uid::text AS actor_uid, memo FROM public.currency_status_log WHERE cid = $1::bigint`, [String(cidA)]));
      summary.approve_db = {
        review_rows: revA, review_count: await countReview(tx, cidA),
        currency_status: String(rowA?.status ?? ''), listed_at_present: rowA?.listed_at != null,
        status_log_rows: slogA, status_log_count: await countStatusLog(tx, cidA),
      };
      judge('A7', 'approvePath', { n: await countReview(tx, cidA), result: revA[0]?.result ?? null, actor: revA[0]?.actor_uid ?? null },
        { n: 1, result: 'approved', actor: String(admin) },
        '通过 ⇒ 台账恰 1 行 result=approved / actor_uid=admin ⇒ 无行 / 记成 owner ⇒ 判负');
      judge('A8', 'approvePath', { status: String(rowA?.status ?? ''), listed: rowA?.listed_at != null },
        { status: 'listed', listed: true }, '通过 ⇒ currency.status draft→listed + listed_at 非空 ⇒ 未变 ⇒ 判负');
      judge('A9', 'approvePath', { n: await countStatusLog(tx, cidA), from: slogA[0]?.from_status ?? null, to: slogA[0]?.to_status ?? null, actor: slogA[0]?.actor_uid ?? null },
        { n: 1, from: 'draft', to: 'listed', actor: String(admin) },
        '通过 ⇒ currency_status_log 恰 1 行 draft→listed / actor=admin ⇒ 少行 / 多行 / 非此边 ⇒ 判负');

      // ③ 业务读口取数（DB 直取 + 后台读口同一 SELECT）
      const readPort = (await txQuery<{ cid: string; status: string }>(tx,
        `SELECT c.cid::text AS cid, c.status AS status FROM public.currency AS c WHERE c.cid = $1::bigint`, [String(cidA)]))[0];
      summary.read_port = { cid: readPort?.cid ?? null, status: readPort?.status ?? null, anchor: 'backend-ts/src/database.ts:2338 listCurrenciesForAdmin（读口同一 SELECT）；ledger.ts:644 assertCurrencyOperable（R28）' };
      judge('A10', 'readPort', readPort?.status ?? null, 'listed', '业务读口须读新值 listed ⇒ 仍 draft ⇒ 判负');

      // ④ 行为随之（两读数：未审 ⇒ R28 拒（LD008）；通过后 status=listed ⇒ R28 放行）
      const r28Draft = r28('draft', 'hold');
      const r28ListedHold = r28('listed', 'hold');
      const r28ListedPrice = r28('listed', 'price');
      summary.r28 = { unreviewed_draft_hold: r28Draft, approved_listed_hold: r28ListedHold, approved_listed_price: r28ListedPrice };
      judge('A11', 'behaviorFollows', { draft_hold: r28Draft.ok, listed_hold: r28ListedHold.ok, listed_price: r28ListedPrice.ok },
        { draft_hold: false, listed_hold: true, listed_price: true },
        '④ 行为随之：未审 draft 挂单/标价 ⇒ LD008 拒；通过后 listed ⇒ 放行 ⇒ 与预期不符 ⇒ 判负');
      judge('A12', 'behaviorFollows', r28Draft.code, 'LEDGER_CURRENCY_NOT_LISTED', '未审 draft 的 R28 拒码须 = LD008 LEDGER_CURRENCY_NOT_LISTED ⇒ 其它码 ⇒ 判负');

      // ④ 附：已 listed 单位再调 C2 ⇒ 自然拒（required_from='draft'），非绕过口
      const postApprove = await DatabaseService.listCurrencyWithDeposit({
        cid: cidA, actorUid: owner, fee: FEE, depositAmount: DEPOSIT,
        idempotencyKey: `biz:currency:list:${cidA}:again`, requestFingerprint: fp(['list', cidA, owner, FEE, DEPOSIT, 'again']), memo: `currency_list_deposit:${cidA}:again`,
      }, tx);
      summary.c2_on_approved = { applied: Number(postApprove.applied ?? 0), cur_status: String(postApprove.cur_status ?? '') };
      judge('A13', 'behaviorFollows', { a: Number(postApprove.applied ?? 0), st: String(postApprove.cur_status ?? '') }, { a: 0, st: 'listed' },
        'approve 已把 status 迁 listed ⇒ 再调 C2 自然拒（applied=0 / required_from=draft）⇒ 意外产行 ⇒ 判负');

      // =========================================================================================
      // 段 B · 驳回路径
      // =========================================================================================
      await insertDraft(tx, cidB, symB, owner);
      const rj = await DatabaseService.currencyReviewPostEvent({
        cid: cidB, actorUid: admin, result: 'rejected',
        requestFingerprint: fp(['currency_review', cidB, 'reject', 'probe reason']),
        idempotencyKey: opsB, memo: 'probe reason',
      }, tx);
      const rowB = await currencyRow(tx, cidB);
      const revB = (await txQuery<Record<string, unknown>>(tx,
        `SELECT result, actor_uid::text AS actor_uid, memo FROM public.currency_review_log WHERE cid = $1::bigint`, [String(cidB)]));
      summary.reject_receipt = { cur_found: Number(rj.cur_found ?? 0), applied: Number(rj.applied ?? 0), slogged: Number(rj.slogged ?? 0), reviewed: Number(rj.reviewed ?? 0) };
      summary.reject_db = { review_rows: revB, review_count: await countReview(tx, cidB), currency_status: String(rowB?.status ?? ''), status_log_count: await countStatusLog(tx, cidB) };
      judge('B1', 'rejectPath', { n: await countReview(tx, cidB), result: revB[0]?.result ?? null, actor: revB[0]?.actor_uid ?? null, memo: revB[0]?.memo ?? null },
        { n: 1, result: 'rejected', actor: String(admin), memo: 'probe reason' },
        '★ 驳回必须落台账恰 1 行（result=rejected / actor=admin / memo=reason）⇒ 驳回后台账无行 ⇒ 判负');
      judge('B2', 'rejectPath', String(rowB?.status ?? ''), 'draft', '驳回 ⇒ currency.status 仍 draft ⇒ 变了 ⇒ 判负');
      judge('B3', 'rejectPath', await countStatusLog(tx, cidB), 0, '驳回 ⇒ 不写 currency_status_log ⇒ 有行 ⇒ 判负');
      const preB = await DatabaseService.listCurrencyWithDeposit({
        cid: cidB, actorUid: owner, fee: FEE, depositAmount: DEPOSIT,
        idempotencyKey: keyB, requestFingerprint: fp(['list', cidB, owner, FEE, DEPOSIT]), memo: `currency_list_deposit:${cidB}`,
      }, tx);
      summary.rejected_c2 = { applied: Number(preB.applied ?? 0), cur_status: String(preB.cur_status ?? '') };
      judge('B4', 'rejectPath', { a: Number(preB.applied ?? 0), st: String(preB.cur_status ?? '') }, { a: 0, st: 'draft' },
        '驳回后 C2 仍拒（不可上市）⇒ 驳回后仍可上市 ⇒ 判负');

      // =========================================================================================
      // 段 C · 幂等（同键同 result 不增行；同键异 result 各留一行）
      // =========================================================================================
      // C1：approve 同键同 result 重投（cidA 已 approved）
      const reAp = await DatabaseService.currencyReviewPostEvent({
        cid: cidA, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidA, 'approve', 'probe approved']),
        idempotencyKey: opsA, memo: 'probe approved',
      }, tx);
      summary.idem_same = { prior_count: Number(reAp.prior_count ?? 0), applied: Number(reAp.applied ?? 0), reviewed: Number(reAp.reviewed ?? 0), review_rows_cidA: await countReview(tx, cidA) };
      judge('C1', 'idempotency', { prior: Number(reAp.prior_count ?? 0), reviewed: Number(reAp.reviewed ?? 0), rows: await countReview(tx, cidA) },
        { prior: 1, reviewed: 0, rows: 1 }, '同键同 result 重投 ⇒ prior 命中 / 不增行（rows 仍 1）⇒ 增行 ⇒ 判负');

      // C2：同键异 result（cidC 先驳后成）
      await insertDraft(tx, cidC, symC, owner);
      await DatabaseService.currencyReviewPostEvent({
        cid: cidC, actorUid: admin, result: 'rejected',
        requestFingerprint: fp(['currency_review', cidC, 'reject', 'first reject']),
        idempotencyKey: opsC, memo: 'first reject',
      }, tx);
      const revAfterReject = await countReview(tx, cidC);
      const second = await DatabaseService.currencyReviewPostEvent({
        cid: cidC, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidC, 'approve', 'then approve']),
        idempotencyKey: opsC, memo: 'then approve',
      }, tx);
      const rowC = await currencyRow(tx, cidC);
      summary.idem_diff = { after_reject_rows: revAfterReject, second_receipt: { prior_count: Number(second.prior_count ?? 0), applied: Number(second.applied ?? 0), reviewed: Number(second.reviewed ?? 0) }, final_rows: await countReview(tx, cidC), currency_status: String(rowC?.status ?? '') };
      judge('C2a', 'idempotency', { second_applied: Number(second.applied ?? 0), second_reviewed: Number(second.reviewed ?? 0) },
        { second_applied: 1, second_reviewed: 1 }, '同键异 result（先驳后成）⇒ 第二次可成功（applied=1 / reviewed=1）⇒ 被幂等挡 ⇒ 判负');
      judge('C2b', 'idempotency', { rows: await countReview(tx, cidC), status: String(rowC?.status ?? '') },
        { rows: 2, status: 'listed' }, '同键异 result ⇒ 各留一行（rows=2）+ 通过 ⇒ status=listed ⇒ 不符 ⇒ 判负');

      // =========================================================================================
      // 段 D · 非法入参 ≥6 条（纯函数面，零 DB）+ 零新增码
      // =========================================================================================
      const mk = (cidRaw: unknown, body: Record<string, unknown>) =>
        parseReviewInput({ cidRaw, actorUid: admin, body, opsKey: `ops:${admin}:currency_review:x` });
      const cases = [
        ['D1', 'cid 非数字', mk('abc', { action: 'approve', reason: 'x' }), 404, 'LEDGER_CURRENCY_NOT_FOUND'],
        ['D2', 'cid = 0', mk('0', { action: 'reject', reason: 'x' }), 404, 'LEDGER_CURRENCY_NOT_FOUND'],
        ['D3', 'action 缺失', mk('5', { reason: 'x' }), 400, 'LEDGER_AMOUNT_INVALID'],
        ['D4', 'action 非枚举', mk('5', { action: 'maybe', reason: 'x' }), 400, 'LEDGER_AMOUNT_INVALID'],
        ['D5', 'reason 缺失（驳回）', mk('5', { action: 'reject' }), 400, 'LEDGER_AMOUNT_INVALID'],
        ['D6', 'reason 空白（驳回）', mk('5', { action: 'reject', reason: '   ' }), 400, 'LEDGER_AMOUNT_INVALID'],
      ] as const;
      const used: string[] = [];
      for (const [id, label, r, status, code] of cases) {
        const got = r.ok ? { ok: true } : { code: (r as { err: { code: string; status: number } }).err.code, status: (r as { err: { code: string; status: number } }).err.status };
        if (!r.ok) used.push((r as { err: { code: string } }).err.code);
        judge(id, 'illegalInput', got, { code, status }, `${label} ⇒ ${status} ${code}（不得静默放行）⇒ 不符 ⇒ 判负`);
      }
      rec('D7', 'illegalInput', used.every((c) => ['LEDGER_CURRENCY_NOT_FOUND', 'LEDGER_CURRENCY_INVALID_TRANSITION', 'LEDGER_AMOUNT_INVALID'].includes(c)),
        { used }, '非法入参只用既有码 LD007/LD011/LD016（零新增码）⇒ 出现新码 ⇒ 判负');

      // =========================================================================================
      // 段 E · 库面判负（事务内形态自证；真变异判负在仓外副本）
      // =========================================================================================
      rec('E1', 'negRules', (await countReview(tx, cidB)) === 1, { reject_rows: await countReview(tx, cidB) }, '「驳回后台账无行 ⇒ 判负」（B1 已断言恰 1 行）');
      rec('E2', 'negRules', (await countStatusLog(tx, cidB)) === 0, { reject_status_log: await countStatusLog(tx, cidB) }, '「驳回分支也改 status / 写状态日志 ⇒ 判负」（B2/B3 已断言）');
      rec('E3', 'negRules', Number(ap.reviewed ?? 0) === 1 && (await countReview(tx, cidA)) === 1, { approve_reviewed: Number(ap.reviewed ?? 0), approve_rows: await countReview(tx, cidA) }, '「通过但台账无行 ⇒ 判负」（A7 已断言恰 1 行）');

      // ---- 末尾哨兵 ⇒ ROLLBACK
      throw new RollbackSentinel('p8s4-effective');
    }, { statementTimeoutMs: 30000 });
    // 到此处 = 未抛哨兵（异常）⇒ 视为失败
    rec('Z', 'rollback', false, { note: 'no sentinel thrown' }, '探针必须以哨兵结束并回滚');
  } catch (e) {
    if (e instanceof RollbackSentinel) {
      rec('Z', 'rollback', true, { rolled_back: true, tag: e.tag }, '末尾哨兵 ⇒ withTransaction catch ⇒ ROLLBACK（绝不 COMMIT）');
    } else {
      rec('Z', 'rollback', false, { error: (e as Error)?.message ?? String(e), code: (e as { code?: unknown })?.code ?? null }, '探针内异常 ⇒ 已回滚，但属失败');
    }
  }
};

main().then(async () => {
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S4-EFFECTIVE-CURRENCY-REVIEW', generated_at: new Date().toISOString(), run: RUN,
    mode: 'single-transaction + ROLLBACK (R-8-15 / R-8-18)', http_calls: 0,
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    summary, checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'effective.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, failed_ids: failed.map((f) => f.id), summary }, null, 1));
  console.log(`ARTIFACT ${path.join(OUT_DIR, 'effective.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
}).catch(async (e) => {
  console.error('EFFECTIVE FAIL:', (e as Error)?.message);
  await closePools();
  process.exit(2);
});
