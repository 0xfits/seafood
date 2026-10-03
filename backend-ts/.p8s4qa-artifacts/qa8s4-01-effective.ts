/**
 * QA 8④ 终审质检 · 自写探针 01：四段真链路 + C2 闸双读数（Neng 自写 / 自造 fixture）。
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only .p8s4qa-artifacts/qa8s4-01-effective.ts
 * ★ 硬约束：单 withTransaction + 末尾哨兵 ⇒ ROLLBACK（绝不 COMMIT）；生产库零净写。
 * ★ fixture 自造：cid 窗口 920000000+（区别于交付方 900000000+）；symbol 前缀 qa8s4。
 *   全程只打印 uid / cid / 计数 / 机读字段，不打印任何密钥 / 连接串。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { withTransaction, closePools, txQuery, readQuery, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { parseReviewInput, parseStatusFilter } from '../src/currency-review-service';
import { assertCurrencyOperable, type CurrencyRecord, type CurrencyStatus } from '../src/ledger';
import { LEDGER_ERROR_CODES } from '../src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const OUT_DIR = path.join(__dirname, `qa8s4-01-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

const FEE = 10000;
const DEPOSIT = 50000;
const SENTINEL = 'qa8s4-rollback-01';

interface Check { id: string; group: string; pass: boolean; detail: unknown; neg_rule: string; }
const checks: Check[] = [];
const rec = (id: string, group: string, pass: boolean, detail: unknown, neg: string): void => {
  checks.push({ id, group, pass: Boolean(pass), detail, neg_rule: neg });
};
const judge = (id: string, group: string, actual: unknown, expected: unknown, neg: string): boolean => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  rec(id, group, ok, { actual, expected }, neg);
  return ok;
};

const fp = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const tok = (i: number): string => createHash('sha256').update(`${RUN}:${i}`).digest('hex').slice(0, 5);

// 事务内只读小工具
const nReview = async (tx: TxClient, cid: number): Promise<number> =>
  Number((await txQuery<{ n: string }>(tx, `SELECT count(*)::text AS n FROM public.currency_review_log WHERE cid=$1::bigint`, [String(cid)]))[0]?.n ?? '0');
const nSlog = async (tx: TxClient, cid: number): Promise<number> =>
  Number((await txQuery<{ n: string }>(tx, `SELECT count(*)::text AS n FROM public.currency_status_log WHERE cid=$1::bigint`, [String(cid)]))[0]?.n ?? '0');
const nLegs = async (tx: TxClient, key: string): Promise<number> =>
  Number((await txQuery<{ n: string }>(tx, `SELECT count(*)::text AS n FROM public.ledger_entry WHERE idempotency_key=$1::text OR idempotency_key LIKE $1::text || '#%'`, [key]))[0]?.n ?? '0');
const curStatus = async (tx: TxClient, cid: number): Promise<string> =>
  String((await txQuery<{ status: string }>(tx, `SELECT status FROM public.currency WHERE cid=$1::bigint`, [String(cid)]))[0]?.status ?? '');
const insertDraft = async (tx: TxClient, cid: number, symbol: string, owner: number): Promise<void> => {
  await txQuery(tx,
    `INSERT INTO public.currency (cid, symbol, name, owner_uid, decimals, status, deposit_cid)
     VALUES ($1::bigint, $2::text, $3::text, $4::bigint, 0, 'draft', 1)`,
    [String(cid), symbol, `qa8s4 probe ${symbol}`, String(owner)]);
};

const r28 = (status: CurrencyStatus): { hold: { ok: boolean; code: string | null }; price: { ok: boolean; code: string | null } } => {
  const cur = { cid: '999999001', symbol: 'QA8S4R28', name: 'r28', icon_url: '', owner_uid: '1', decimals: 0,
    total_supply: '0', supply_cap: null, status, deposit_amount: '0', deposit_cid: '1',
    listed_at: null, time_created: null, time_updated: null } as CurrencyRecord;
  const one = (op: 'hold' | 'price') => { try { assertCurrencyOperable(cur, op); return { ok: true, code: null }; }
    catch (e) { return { ok: false, code: String((e as { code?: unknown })?.code ?? 'unknown') }; } };
  return { hold: one('hold'), price: one('price') };
};

const summary: Record<string, unknown> = {};

const main = async (): Promise<void> => {
  try {
    await withTransaction(async (tx) => {
      // ---- 0 夹具
      const ownerRow = (await txQuery<{ uid: string; balance: string }>(tx,
        `SELECT a.uid::text AS uid, a.balance::text AS balance FROM public.account a
          WHERE a.cid=1 AND a.uid>0 AND a.balance >= ${FEE + DEPOSIT} ORDER BY a.balance DESC, a.uid ASC LIMIT 1`))[0];
      const adminRow = (await txQuery<{ uid: string }>(tx,
        `SELECT uid::text AS uid FROM public.users WHERE is_admin=true ORDER BY uid ASC LIMIT 1`))[0];
      if (!ownerRow || !adminRow) throw new Error('PRECONDITION: no funded owner / no admin');
      const owner = Number(ownerRow.uid), admin = Number(adminRow.uid);
      summary.fixture = { owner_uid: owner, admin_uid: admin, owner_balance_cid1: Number(ownerRow.balance) };

      const base = 920000000 + (parseInt(createHash('sha256').update(RUN).digest('hex').slice(0, 6), 16) % 100000) * 10;
      const cidA = base + 1, cidB = base + 2, cidC = base + 3, cidD = base + 4;
      const cids = [cidA, cidB, cidC, cidD];
      const taken = (await txQuery<{ cid: string }>(tx, `SELECT cid::text AS cid FROM public.currency WHERE cid = ANY($1::bigint[])`, [cids.map(String)])).map((r) => r.cid);
      if (taken.length) throw new Error(`PRECONDITION: cid window taken ${JSON.stringify(taken)}`);
      const symA = `qa8s4${tok(1)}`, symB = `qa8s4${tok(2)}`, symC = `qa8s4${tok(3)}`, symD = `qa8s4${tok(4)}`;
      summary.fixture.cids = { a: cidA, b: cidB, c: cidC, d: cidD };
      summary.fixture.symbols = { a: symA, b: symB, c: symC, d: symD };
      const opsA = `ops:${admin}:currency_review:${cidA}`, opsB = `ops:${admin}:currency_review:${cidB}`,
            opsC = `ops:${admin}:currency_review:${cidC}`, opsD = `ops:${admin}:currency_review:${cidD}`;
      const listKey = (cid: number, sfx = '') => `biz:currency:list:${cid}${sfx}`;

      // ============ 段 A · 未审 C2（④ 有闸读数） + approve 四段 ============
      await insertDraft(tx, cidA, symA, owner);
      const pre = await DatabaseService.listCurrencyWithDeposit({
        cid: cidA, actorUid: owner, fee: FEE, depositAmount: DEPOSIT,
        idempotencyKey: listKey(cidA), requestFingerprint: fp(['list', cidA, owner, FEE, DEPOSIT]), memo: `list:${cidA}`,
      }, tx);
      const preApplied = Number(pre.applied ?? 0);
      const preStatus = String(pre.cur_status ?? '');
      const prePost = await curStatus(tx, cidA);
      const preLegs = await nLegs(tx, listKey(cidA));
      const preSlog = await nSlog(tx, cidA);
      summary.unreviewed_c2 = { applied: preApplied, cur_status_snapshot: preStatus, status_post: prePost, ledger_legs: preLegs, status_log_rows: preSlog };
      judge('A1', 'unreviewedC2', preApplied, 0, '未审 C2 必 applied=0（有闸态）⇒ 产行 ⇒ 判负');
      judge('A2', 'unreviewedC2', prePost, 'draft', '未审 C2 后 status 仍 draft ⇒ 变 ⇒ 判负');
      judge('A3', 'unreviewedC2', preLegs, 0, '未审 C2 零账本分录 ⇒ 有 ⇒ 判负');
      judge('A4', 'unreviewedC2', preSlog, 0, '未审 C2 不写状态日志 ⇒ 有 ⇒ 判负');

      const ap = await DatabaseService.currencyReviewPostEvent({
        cid: cidA, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidA, 'approve', 'qa approve']), idempotencyKey: opsA, memo: 'qa approve',
      }, tx);
      const apReceipt = { cur_found: Number(ap.cur_found ?? 0), prior_count: Number(ap.prior_count ?? 0), applied: Number(ap.applied ?? 0), slogged: Number(ap.slogged ?? 0), reviewed: Number(ap.reviewed ?? 0) };
      summary.approve_receipt = apReceipt;
      judge('B1', 'approve', { f: apReceipt.cur_found, a: apReceipt.applied, s: apReceipt.slogged, r: apReceipt.reviewed },
        { f: 1, a: 1, s: 1, r: 1 }, '通过回执须 1/1/1/1 ⇒ 任一不等 ⇒ 判负');
      const revA = (await txQuery<Record<string, unknown>>(tx,
        `SELECT result, actor_uid::text AS actor, cid::text AS cid, memo, (time_created IS NOT NULL) AS has_time FROM public.currency_review_log WHERE cid=$1::bigint`, [String(cidA)]));
      judge('B2', 'approve', { n: await nReview(tx, cidA), result: revA[0]?.result ?? null, actor: revA[0]?.actor ?? null, has_time: revA[0]?.has_time ?? null },
        { n: 1, result: 'approved', actor: String(admin), has_time: true }, '通过 ⇒ 台账恰 1 行 approved / actor=admin ⇒ 无行 / 记 owner ⇒ 判负');
      const listedAt = (await txQuery<{ s: string; l: string | null }>(tx, `SELECT status AS s, listed_at::text AS l FROM public.currency WHERE cid=$1::bigint`, [String(cidA)]))[0];
      judge('B3', 'approve', { status: listedAt?.s ?? null, listed: listedAt?.l != null }, { status: 'listed', listed: true }, '通过 ⇒ draft→listed + listed_at 非空 ⇒ 未变 ⇒ 判负');
      const slogA = (await txQuery<Record<string, unknown>>(tx,
        `SELECT from_status, to_status, actor_uid::text AS actor, memo FROM public.currency_status_log WHERE cid=$1::bigint`, [String(cidA)]));
      judge('B4', 'approve', { n: await nSlog(tx, cidA), from: slogA[0]?.from_status ?? null, to: slogA[0]?.to_status ?? null, actor: slogA[0]?.actor ?? null },
        { n: 1, from: 'draft', to: 'listed', actor: String(admin) }, '通过 ⇒ 状态日志恰 1 行 draft→listed / actor=admin ⇒ 少/多/非此边 ⇒ 判负');
      const readPort = (await txQuery<{ status: string }>(tx, `SELECT status FROM public.currency WHERE cid=$1::bigint`, [String(cidA)]))[0];
      summary.read_port = { cid: cidA, status: readPort?.status ?? null, anchor: 'database.ts:2349 listCurrenciesForAdmin 同 SELECT 列 status' };
      judge('B5', 'readPort', readPort?.status ?? null, 'listed', '业务读口须读新值 listed ⇒ 仍旧 ⇒ 判负');

      // ============ 段 B · 驳回路径 ============
      await insertDraft(tx, cidB, symB, owner);
      const rj = await DatabaseService.currencyReviewPostEvent({
        cid: cidB, actorUid: admin, result: 'rejected',
        requestFingerprint: fp(['currency_review', cidB, 'reject', 'qa reason']), idempotencyKey: opsB, memo: 'qa reason',
      }, tx);
      summary.reject_receipt = { cur_found: Number(rj.cur_found ?? 0), applied: Number(rj.applied ?? 0), slogged: Number(rj.slogged ?? 0), reviewed: Number(rj.reviewed ?? 0) };
      const revB = (await txQuery<Record<string, unknown>>(tx,
        `SELECT result, actor_uid::text AS actor, memo FROM public.currency_review_log WHERE cid=$1::bigint`, [String(cidB)]));
      judge('C1', 'reject', { n: await nReview(tx, cidB), result: revB[0]?.result ?? null, actor: revB[0]?.actor ?? null, memo: revB[0]?.memo ?? null },
        { n: 1, result: 'rejected', actor: String(admin), memo: 'qa reason' }, '★ 驳回必须落台账恰 1 行 ⇒ 无行 ⇒ 判负');
      judge('C2', 'reject', await curStatus(tx, cidB), 'draft', '驳回 ⇒ status 仍 draft ⇒ 变 ⇒ 判负');
      judge('C3', 'reject', await nSlog(tx, cidB), 0, '驳回 ⇒ 0 状态日志 ⇒ 有 ⇒ 判负');
      const preB = await DatabaseService.listCurrencyWithDeposit({
        cid: cidB, actorUid: owner, fee: FEE, depositAmount: DEPOSIT,
        idempotencyKey: listKey(cidB), requestFingerprint: fp(['list', cidB, owner, FEE, DEPOSIT]), memo: `list:${cidB}`,
      }, tx);
      summary.rejected_c2 = { applied: Number(preB.applied ?? 0), cur_status: String(preB.cur_status ?? '') };
      judge('C4', 'reject', { a: Number(preB.applied ?? 0), st: String(preB.cur_status ?? '') }, { a: 0, st: 'draft' }, '驳回后 C2 仍拒 ⇒ 驳回后可上市 ⇒ 判负');

      // ============ 段 C · ④ 行为随之（R28）+ 已 listed 再调 C2 ============
      const rDraft = r28('draft'), rListed = r28('listed');
      summary.r28 = { draft: rDraft, listed: rListed };
      judge('D1', 'behavior', { hold: rDraft.hold.ok, price: rDraft.price.ok }, { hold: false, price: false }, '未审 draft R28 挂单/标价 ⇒ 须拒 ⇒ 放行 ⇒ 判负');
      judge('D2', 'behavior', rDraft.hold.code, 'LEDGER_CURRENCY_NOT_LISTED', '未审 draft R28 拒码 = LD008 ⇒ 其它码 ⇒ 判负');
      judge('D3', 'behavior', { hold: rListed.hold.ok, price: rListed.price.ok }, { hold: true, price: true }, '通过后 listed R28 放行 ⇒ 拒 ⇒ 判负');
      const postApprove = await DatabaseService.listCurrencyWithDeposit({
        cid: cidA, actorUid: owner, fee: FEE, depositAmount: DEPOSIT,
        idempotencyKey: listKey(cidA, ':again'), requestFingerprint: fp(['list', cidA, owner, FEE, DEPOSIT, 'again']), memo: `list:${cidA}:again`,
      }, tx);
      summary.c2_on_approved = { applied: Number(postApprove.applied ?? 0), cur_status: String(postApprove.cur_status ?? '') };
      judge('D4', 'behavior', { a: Number(postApprove.applied ?? 0), st: String(postApprove.cur_status ?? '') }, { a: 0, st: 'listed' }, '已 listed 再调 C2 ⇒ 自然拒（applied=0）⇒ 产行 ⇒ 判负');

      // ============ 段 D · 幂等三向 ============
      const reAp = await DatabaseService.currencyReviewPostEvent({
        cid: cidA, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidA, 'approve', 'qa approve']), idempotencyKey: opsA, memo: 'qa approve',
      }, tx);
      summary.idem_same = { prior_count: Number(reAp.prior_count ?? 0), reviewed: Number(reAp.reviewed ?? 0), rows: await nReview(tx, cidA) };
      judge('E1', 'idempotency', { prior: Number(reAp.prior_count ?? 0), reviewed: Number(reAp.reviewed ?? 0), rows: await nReview(tx, cidA) },
        { prior: 1, reviewed: 0, rows: 1 }, '同键同 result ⇒ prior 命中 / 不增行（rows 仍 1）⇒ 增行 ⇒ 判负');

      await insertDraft(tx, cidC, symC, owner);
      await DatabaseService.currencyReviewPostEvent({
        cid: cidC, actorUid: admin, result: 'rejected',
        requestFingerprint: fp(['currency_review', cidC, 'reject', 'first']), idempotencyKey: opsC, memo: 'first reject',
      }, tx);
      const rowsAfterReject = await nReview(tx, cidC);
      const second = await DatabaseService.currencyReviewPostEvent({
        cid: cidC, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidC, 'approve', 'then']), idempotencyKey: opsC, memo: 'then approve',
      }, tx);
      summary.idem_diff = { after_reject_rows: rowsAfterReject, second: { prior: Number(second.prior_count ?? 0), applied: Number(second.applied ?? 0), reviewed: Number(second.reviewed ?? 0) }, final_rows: await nReview(tx, cidC), status: await curStatus(tx, cidC) };
      judge('E2a', 'idempotency', { applied: Number(second.applied ?? 0), reviewed: Number(second.reviewed ?? 0) }, { applied: 1, reviewed: 1 }, '同键异 result（先驳后成）⇒ 第二次成功 ⇒ 被幂等挡 ⇒ 判负');
      judge('E2b', 'idempotency', { rows: await nReview(tx, cidC), status: await curStatus(tx, cidC) }, { rows: 2, status: 'listed' }, '同键异 result ⇒ 各留一行（rows=2）+ listed ⇒ 不符 ⇒ 判负');

      await insertDraft(tx, cidD, symD, owner);
      await DatabaseService.currencyReviewPostEvent({
        cid: cidD, actorUid: admin, result: 'approved',
        requestFingerprint: fp(['currency_review', cidD, 'approve', 'fresh']), idempotencyKey: opsD, memo: 'fresh approve',
      }, tx);
      summary.idem_new = { rows: await nReview(tx, cidD), status: await curStatus(tx, cidD) };
      judge('E3', 'idempotency', { rows: await nReview(tx, cidD), status: await curStatus(tx, cidD) }, { rows: 1, status: 'listed' }, '异键 ⇒ 新行（rows=1）⇒ 被幂等挡 ⇒ 判负');

      // ============ 段 E · 非法入参 ≥6（纯函数） ============
      const mk = (cidRaw: unknown, body: Record<string, unknown>) => parseReviewInput({ cidRaw, actorUid: admin, body, opsKey: `ops:${admin}:currency_review:x` });
      const cases: Array<[string, string, ReturnType<typeof parseReviewInput>, number, string]> = [
        ['F1', 'cid 非数字', mk('abc', { action: 'approve', reason: 'x' }), 404, 'LEDGER_CURRENCY_NOT_FOUND'],
        ['F2', 'cid=0', mk('0', { action: 'reject', reason: 'x' }), 404, 'LEDGER_CURRENCY_NOT_FOUND'],
        ['F3', 'action 缺失', mk('5', { reason: 'x' }), 400, 'LEDGER_AMOUNT_INVALID'],
        ['F4', 'action 非枚举', mk('5', { action: 'maybe', reason: 'x' }), 400, 'LEDGER_AMOUNT_INVALID'],
        ['F5', 'reason 缺失', mk('5', { action: 'reject' }), 400, 'LEDGER_AMOUNT_INVALID'],
        ['F6', 'reason 空白', mk('5', { action: 'reject', reason: '   ' }), 400, 'LEDGER_AMOUNT_INVALID'],
      ];
      const used: string[] = [];
      for (const [id, label, r, status, code] of cases) {
        const got = r.ok ? { ok: true } : { code: (r as { err: { code: string; status: number } }).err.code, status: (r as { err: { code: string; status: number } }).err.status };
        if (!r.ok) used.push((r as { err: { code: string } }).err.code);
        judge(id, 'illegalInput', got, { code, status }, `${label} ⇒ ${status} ${code}（不得静默）⇒ 不符 ⇒ 判负`);
      }
      const sBad = parseStatusFilter('nope');
      judge('F7', 'illegalInput', sBad.ok ? 'ok' : sBad.err.status, 400, '非法 ?status ⇒ 400 ⇒ 静默 ⇒ 判负');
      judge('F8', 'illegalInput', used.every((c) => LEDGER_ERROR_CODES.includes(c as never)), true, '非法入参码 ⊆ 33 码闭集 ⇒ 新码 ⇒ 判负');
      judge('F9', 'illegalInput', LEDGER_ERROR_CODES.length, 33, '错误码闭集 = 33 ⇒ 变 ⇒ 判负');

      // ---- 哨兵
      throw new Error(SENTINEL);
    }, { statementTimeoutMs: 30000 });
    rec('Z', 'rollback', false, { note: 'no sentinel thrown' }, '探针须以哨兵结束并回滚');
  } catch (e) {
    if ((e as Error)?.message === SENTINEL) rec('Z', 'rollback', true, { rolled_back: true }, '末尾哨兵 ⇒ withTransaction catch ⇒ ROLLBACK');
    else rec('Z', 'rollback', false, { error: (e as Error)?.message }, '探针内异常 ⇒ 已回滚但属失败');
  }

  // ---- 回滚后残渣（独立只读句）
  const residue = (await readQuery<Record<string, unknown>>(
    `SELECT
       (SELECT count(*)::int FROM public.currency_review_log) AS review_rows,
       (SELECT count(*)::int FROM public.currency WHERE cid BETWEEN 920000000 AND 930000000) AS probe_cur,
       (SELECT count(*)::int FROM public.currency WHERE symbol LIKE 'qa8s4%') AS probe_sym,
       (SELECT count(*)::int FROM public.currency_status_log WHERE cid BETWEEN 920000000 AND 930000000) AS probe_slog,
       (SELECT count(*)::int FROM public.ledger_entry WHERE idempotency_key LIKE 'biz:currency:list:9%' OR idempotency_key LIKE 'ops:%:currency_review:9%') AS probe_ledger,
       (SELECT max(cid)::text FROM public.currency) AS max_cid,
       (SELECT count(*)::int FROM public.ledger_entry) AS ledger_total`))[0];
  summary.residue_after = residue;
  judge('R1', 'residue', Number(residue?.probe_cur ?? -1) + Number(residue?.probe_sym ?? -1) + Number(residue?.probe_slog ?? -1) + Number(residue?.review_rows ?? -1) + Number(residue?.probe_ledger ?? -1), 0,
    '回滚后探针残渣 = 0（review_rows + probe cur/sym/slog + probe ledger）⇒ 非 0 ⇒ 判负');

  const failed = checks.filter((c) => !c.pass);
  const report = { unit: 'QA8S4-01-EFFECTIVE', run: RUN, mode: 'single-tx + ROLLBACK', total: checks.length, passed: checks.length - failed.length, failed: failed.length, summary, checks };
  fs.writeFileSync(path.join(OUT_DIR, 'effective.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify({ run: RUN, total: report.total, passed: report.passed, failed: report.failed, failed_ids: failed.map((f) => f.id), summary }, null, 1));
  console.log(`ARTIFACT ${path.join(OUT_DIR, 'effective.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
};

main().catch(async (e) => { console.error('FAIL', (e as Error)?.message); await closePools(); process.exit(2); });
