/**
 * 批 8⑤ 收口（第二步）· 四段真链路 + 库面判负（**事务内 + 哨兵 ROLLBACK**）
 * ============================================================================
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/p8-s5-01-real-chains.ts
 * 产物：backend-ts/.p8s5-artifacts/p8s5-<RUN>/real-chains.json（**RUN-tagged**）
 *
 * ★ 纪律（红线）：
 *   · **一切写面（造 listing/job 夹具、写两台账、资金腿）全部在 `withTransaction` 内，末尾抛哨兵 ⇒ ROLLBACK**
 *     （`R-8-15` / `R-8-18`；生产库零净写）。
 *   · **禁跑真 HTTP 写面**（真 POST 审核 / 仲裁 / buy 会 COMMIT · 不可回滚 `§5.197`）⇒ 走**同路径服务层 verb**
 *     + **tx 绑定的 DB 函数**（`listingTakedownPostEvent(i, tx)` / `jobArbitrationPostEvent(i, tx)`）。
 *   · **自造 fixture**（本单新建 listing/job 行）· **不复用他人夹具**。
 *   · 只打印 uid / id / 计数 / 状态 / 金额 / 机读字段；**不打印任何密钥 / 连接串 / token**。
 *
 * 判据：① 四表触发器现取 ② 商品轴四段 ③ 招工轴四段（含资金腿 + txid 对账）④ 归属闸源码面 ⑤ 库面判负。
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { readQuery, withTransaction, closePools, txQuery, TxClient } from '../src/db';
import {
  DatabaseService,
} from '../src/database';
import {
  reviewListingTakedownVerb,
  arbitrateJobVerb,
} from '../src/compliance-review-service';
import { canonicalAdminOpsKey } from '../src/admin-service';
import { ledgerErrorFromDbError, normalizeLedgerError } from '../src/ledger';

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '..', '..');
const OUT_DIR = path.join(HERE, '..', '.p8s5-artifacts', `p8s5-${RUN}`);
fs.mkdirSync(OUT_DIR, { recursive: true });

class RollbackSentinel extends Error { constructor(readonly tag: string) { super(`ROLLBACK_SENTINEL:${tag}`); } }

interface Check { id: string; group: string; pass: boolean; expect: string; actual: string; neg_rule: string; }
const checks: Check[] = [];
const t = (id: string, group: string, pass: boolean, expect: unknown, actual: unknown, negRule = ''): boolean => {
  checks.push({ id, group, pass: Boolean(pass), expect: String(expect), actual: String(actual), neg_rule: negRule });
  return Boolean(pass);
};
const eq = (id: string, group: string, actual: unknown, expected: unknown, negRule = ''): boolean =>
  t(id, group, JSON.stringify(actual) === JSON.stringify(expected), JSON.stringify(expected), JSON.stringify(actual), negRule);
const selfTest = (id: string, group: string, predicate: (v: unknown) => boolean, wrongInput: unknown, negRule = ''): void => {
  const fired = predicate(wrongInput) === false;
  t(`${id}__selftest`, `${group}SelfTest`, fired, '谓词转红', JSON.stringify({ wrong_input: wrongInput, judge_fired: fired }), negRule);
};
const defects: Array<Record<string, unknown>> = [];
const fpParts = (parts: unknown[]): string => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
const hashCode = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

/** 受控 actor 常量（现取，写死仅供参考；真值在运行时现取）。 */
const ADMIN_UID = 1;        // is_admin=true（持 review_tasks 全键）
const EMPLOYER_UID = 6;     // 普通用户（cid 1 有余额）
const WORKER_UID = 7;       // 普通用户
const SELLER_UID = 6;       // 商品夹具卖家
const BUYER_UID = 2;        // 商品夹具买家（cid 1 有余额）
const NON_ADMIN_UID = 3;    // 普通非 admin（HTTP 面用）

// ---------------------------------------------------------------- 只读小工具
/** 在事务内跑一段**可能故意失败**的语句：先 SAVEPOINT，失败则 ROLLBACK TO SAVEPOINT（否则整个事务被 abort）。 */
const inSavepoint = async <T>(tx: TxClient, name: string, fn: () => Promise<T>): Promise<T> => {
  await txQuery(tx, `SAVEPOINT ${name}`);
  try {
    const r = await fn();
    await txQuery(tx, `RELEASE SAVEPOINT ${name}`);
    return r;
  } catch (e) {
    await txQuery(tx, `ROLLBACK TO SAVEPOINT ${name}`).catch(() => undefined);
    await txQuery(tx, `RELEASE SAVEPOINT ${name}`).catch(() => undefined);
    throw e;
  }
};

/** 商品「可否购买」闸读数：跑**生产同一 DB 函数** `public.listing_post_event(op='buy')`（tx 内 · 会 ROLLBACK）。 */
const buyGate = async (tx: TxClient, listingId: number, buyer: number, key: string): Promise<Record<string, unknown>> => {
  try {
    const rows = await inSavepoint(tx, `sp_buy_${listingId}_${Math.abs(hashCode(key))}`, () => txQuery<{ r: Record<string, unknown> }>(tx,
      `SELECT public.listing_post_event($1::jsonb) AS r`,
      [JSON.stringify({
        op: 'buy', create_key: key, listing_id: String(listingId), buyer_uid: String(buyer), quantity: '1',
        request_fingerprint: fpParts(['buy', listingId, buyer, key]), memo: `p8s5 buy probe ${key}`,
      })]));
    const r = rows[0]?.r || {};
    return { outcome: 'accepted', purchasable: true, txid: r.txid === undefined ? null : r.txid };
  } catch (e) {
    const mapped = ledgerErrorFromDbError(e) ?? normalizeLedgerError(e);
    const det = (mapped.details || {}) as Record<string, unknown>;
    return {
      outcome: 'rejected', purchasable: false, code: mapped.code, reason: det.reason ?? null,
      status: det.status ?? null, httpStatus: mapped.httpStatus,
      raw_sqlstate: (e as { code?: string })?.code ?? null,
    };
  }
};

/** 招工「可否承接」闸读数：生产两道闸（`applyToJob` / `acceptJobApplication`）唯一判据 = `job.status='open'`（只读 · tx 内）。 */
const acceptGate = async (tx: TxClient, jobId: number): Promise<Record<string, unknown>> => {
  const rows = await txQuery<{ status: string; employer_uid: string; acceptable: boolean }>(tx,
    `SELECT j.status AS status, j.employer_uid::text AS employer_uid,
            (j.status = 'open') AS acceptable
       FROM public.job j WHERE j.job_id = $1::bigint`, [jobId]);
  const r = rows[0];
  return { job_status: r ? r.status : null, employer_uid: r ? r.employer_uid : null, acceptable: r ? r.acceptable : null };
};

/** ledger 分录读数（按事件根键）。 */
const refundLegs = async (tx: TxClient, jobId: number): Promise<Array<Record<string, unknown>>> =>
  txQuery(tx, `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
                      frozen_delta::text AS frozen_delta, kind, idempotency_key, event_root_key
                 FROM public.ledger_entry
                WHERE event_root_key = $1::text ORDER BY txid, kind, uid`, [`biz:job:refund:${jobId}`]);

/** 造招工夹具：publish（托管）→ 设 worker → open→accepted→submitted。返回 job_id。 */
const makeArbJob = async (tx: TxClient, reward: number, tag: string): Promise<number> => {
  const pr = await txQuery<{ r: Record<string, unknown> }>(tx,
    `SELECT public.job_post_event($1::jsonb) AS r`,
    [JSON.stringify({
      op: 'publish', create_key: `biz:job:p8s5:${tag}`, employer_uid: String(EMPLOYER_UID), cid: '1',
      reward: String(reward), title: `p8s5 arb fixture ${tag}`, description: '',
      request_fingerprint: fpParts(['publish', tag]), memo: `p8s5 fixture ${tag}`,
    })]);
  const jobId = Number((pr[0]?.r as Record<string, unknown>)?.job_id);
  await txQuery(tx, `UPDATE public.job SET worker_uid = $1::bigint WHERE job_id = $2::bigint`, [WORKER_UID, jobId]);
  await txQuery(tx, `UPDATE public.job SET status = 'accepted' WHERE job_id = $1::bigint`, [jobId]);
  await txQuery(tx, `UPDATE public.job SET status = 'submitted' WHERE job_id = $1::bigint`, [jobId]);
  return jobId;
};

// ============================================================================
(async () => {
  const out: Record<string, unknown> = {
    unit: 'P8-S5-REAL-CHAINS', run: RUN, generated_at: new Date().toISOString(),
    discipline: '一切写面事务内 + 哨兵 ROLLBACK；禁真 HTTP 写面；走同路径服务层 verb + tx 绑定 DB 函数；自造 fixture',
  };

  // ---------------------------------------------------------------- ① 四表触发器现取（只读）
  const trigReal = await readQuery<Record<string, unknown>>(`
    SELECT c.relname AS table_name, t.tgname, t.tgenabled, t.tgtype::int AS tgtype, p.proname AS fn
      FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_proc p ON p.oid = t.tgfoid
     WHERE n.nspname='public' AND NOT t.tgisinternal
       AND c.relname IN ('listing','listing_review_log','job','job_arbitration_log')
     ORDER BY c.relname, t.tgname`);
  out.section1_triggers = {
    note: '现取四表用户触发器（NOT tgisinternal）；tgtype 位：1=ROW 2=BEFORE 4=INSERT 8=DELETE 16=UPDATE。',
    rows: trigReal,
  };
  const byTable = (n: string) => trigReal.filter((r) => r.table_name === n);
  t('S1.listing_review_log.debug', 'section1', byTable('listing_review_log').length >= 1,
    'listing_review_log 有用户触发器', JSON.stringify(byTable('listing_review_log').map((r) => r.tgname)),
    'append-only 触发器缺失 ⇒ 台账可被改 ⇒ 判负');
  t('S1.job_arbitration_log.debug', 'section1', byTable('job_arbitration_log').length >= 1,
    'job_arbitration_log 有用户触发器', JSON.stringify(byTable('job_arbitration_log').map((r) => r.tgname)),
    'append-only 触发器缺失 ⇒ 台账可被改 ⇒ 判负');
  eq('S1.listing_review_log.append_only', 'section1',
    byTable('listing_review_log').map((r) => `${r.tgname}:${r.tgtype}`),
    ['trg_listing_review_log_append_only:27'],
    'append-only 触发器必须 = BEFORE|ROW|UPDATE|DELETE（tgtype 27）');
  eq('S1.job_arbitration_log.append_only', 'section1',
    byTable('job_arbitration_log').map((r) => `${r.tgname}:${r.tgtype}`),
    ['trg_job_arbitration_log_append_only:27'],
    'append-only 触发器必须 = tgtype 27');
  eq('S1.listing.has_status_guard', 'section1', byTable('listing').some((r) => r.tgname === 'trg_listing_status_guard'), true,
    'listing 状态白名单触发器在场');
  eq('S1.job.has_status_guard', 'section1', byTable('job').some((r) => r.tgname === 'trg_job_status_guard'), true,
    'job 状态白名单触发器在场');
  // 迁移 checksum 断言
  const mig = await readQuery<{ version: string; checksum: string }>(
    `SELECT version, checksum FROM public.schema_migration WHERE version IN ('0026','0027') ORDER BY version`);
  const fileSha = (f: string) => createHash('sha256').update(fs.readFileSync(path.join(REPO_ROOT, 'backend-ts', 'migrations', f))).digest('hex');
  const sha26 = fileSha('0026_listing_review_log.sql');
  const sha27 = fileSha('0027_job_arbitration_log.sql');
  out.migration_assert = {
    db_0026: mig.find((m) => m.version === '0026')?.checksum ?? null,
    file_0026: sha26,
    db_0027: mig.find((m) => m.version === '0027')?.checksum ?? null,
    file_0027: sha27,
  };
  eq('S1.mig0026.checksum', 'section1', out.migration_assert['db_0026'], sha26,
    'schema_migration.0026 checksum ≠ 迁移文件 sha256 ⇒ 判负');
  eq('S1.mig0027.checksum', 'section1', out.migration_assert['db_0027'], sha27,
    'schema_migration.0027 checksum ≠ 迁移文件 sha256 ⇒ 判负');
  const schemaVer = await readQuery<{ version: string }>(`SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1`);
  out.schema_version = schemaVer[0]?.version ?? null;
  out.base_tables = (await readQuery<{ n: number }>(`SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'`))[0]?.n ?? null;

  // ---------------------------------------------------------------- 基线快照（只读 · 恢复自证用）
  const snapshot = async () => {
    const [lr, ja, ld, jd] = await Promise.all([
      readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, coalesce(max(log_id),0)::text AS max_id FROM public.listing_review_log`),
      readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, coalesce(max(log_id),0)::text AS max_id FROM public.job_arbitration_log`),
      readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, max(listing_id)::text AS max_id FROM public.listing`),
      readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, max(job_id)::text AS max_id FROM public.job`),
    ]);
    const led = await readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n, coalesce(max(txid),0)::text AS max_txid FROM public.ledger_entry`);
    const acc = await readQuery<Record<string, string>>(`SELECT count(*)::int::text AS n FROM public.account`);
    return { listing_review_log: lr[0], job_arbitration_log: ja[0], listing: ld[0], job: jd[0], ledger_entry: led[0], account: acc[0] };
  };
  const baseline = await snapshot();
  out.baseline = baseline;

  const segA: Record<string, unknown> = {};
  const segB: Record<string, unknown> = {};

  // ====================================================================
  // ② 商品轴四段 + ⑤ 商品库面判负（事务内 · ROLLBACK）
  // ====================================================================
  try {
    await withTransaction(async (tx) => {
      const A: Record<string, unknown> = {};
      // ---- fixture（自造）：listed 商品
      const lr = await txQuery<{ listing_id: string }>(tx,
        `INSERT INTO public.listing (seller_uid, cid, price, stock, title, description, status, create_key)
         VALUES ($1::bigint, 1, 10, 5, $2::text, '', 'listed', $3::text) RETURNING listing_id::text AS listing_id`,
        [SELLER_UID, `p8s5 listing fixture ${RUN}`, `biz:listing:p8s5:approve:${RUN}`]);
      const LID = Number(lr[0].listing_id);
      A.fixture = { listing_id: LID, seller_uid: SELLER_UID, cid: 1, price: 10, stock: 5, status: 'listed' };
      t('A0.fixture', 'goods', LID > 0, 'listing 夹具自造成功',
        JSON.stringify(A.fixture), '夹具未造出 ⇒ 后续不可测 ⇒ 判负');

      // ---- ④-改动前：可否购买
      const buyBefore = await buyGate(tx, LID, BUYER_UID, `biz:listing:buy:p8s5:b:${RUN}`);
      A['4_behavior_before'] = buyBefore;

      // ---- ①+② 商品 takedown 通过（服务层 verb + tx 绑定 DB 函数）
      const opsKey = canonicalAdminOpsKey(ADMIN_UID, 'listing_takedown', LID);
      const body = { action: 'approve' as const, reason: `p8s5 takedown approve ${RUN}`, target_status: 'delisted' as const };
      const reply = await inSavepoint(tx, 'sp_lst_approve', () => reviewListingTakedownVerb({
        listingIdRaw: String(LID), actorUid: ADMIN_UID, body, opsKey,
        postEvent: (i) => DatabaseService.listingTakedownPostEvent(i, tx),
      }));
      A['1_action'] = {
        route: 'POST /api/admin/listing/:listingId/takedown', gate: "requireAdmin(req,res,'review_tasks')",
        ops_key: `<ops:admin_uid>:listing_takedown:${LID}`, request: { action: 'approve', reason: '<reason>', target_status: 'delisted' },
        reply: { ok: reply.ok, replay: (reply as any).replay ?? null, view: (reply as any).view ?? null, code: (reply as any).code ?? null, status: (reply as any).status ?? null },
      };

      // ---- ② 库内落值
      const logRows = await txQuery<Record<string, unknown>>(tx,
        `SELECT log_id::text AS log_id, listing_id::text AS listing_id, actor_uid::text AS actor_uid, result,
                txid::text AS txid, memo, idempotency_key
           FROM public.listing_review_log WHERE listing_id = $1::bigint ORDER BY log_id`, [LID]);
      const statusRow = await txQuery<{ status: string }>(tx, `SELECT status FROM public.listing WHERE listing_id = $1::bigint`, [LID]);
      A['2_db_landed'] = {
        table: 'public.listing_review_log', row_count: logRows.length, rows: logRows,
        status_col: { table: 'public.listing', column: 'status', value: statusRow[0]?.status ?? null },
      };

      // ---- ③ 业务读口取数（DB 直取 · 同一 SELECT 体在 tx 内；锚 = database.ts:2445 listListingsForAdmin）
      const readOut = await txQuery<Record<string, unknown>>(tx,
        `SELECT l.listing_id AS listing_id, l.seller_uid AS seller_uid, l.cid AS cid, l.price AS price,
                l.stock AS stock, l.title AS title, l.status AS status, l.time_created AS time_created
           FROM public.listing AS l WHERE l.listing_id = $1::bigint`, [LID]);
      A['3_business_read'] = { anchor: 'backend-ts/src/database.ts:2445 listListingsForAdmin（同 SELECT 体）', row: readOut[0] ?? null };

      // ---- ④-改动后：可否购买
      const buyAfter = await buyGate(tx, LID, BUYER_UID, `biz:listing:buy:p8s5:a:${RUN}`);
      A['4_behavior_after'] = buyAfter;

      // ---- 判据（四段 + 判负）
      t('A1.action_ok', 'goods', reply.ok === true,
        '动作口 verb 返 ok', JSON.stringify({ ok: reply.ok }), '动作口未成功 ⇒ 判负');
      eq('A2.log_one_row', 'goods', logRows.length, 1,
        '审核通过 ⇒ listing_review_log **恰 1 行**');
      eq('A2.log_result', 'goods', logRows[0]?.result, 'approved',
        '台账 result 必须 = approved（REVIEW_ACTION_TO_RESULT）');
      eq('A2.log_actor_is_admin', 'goods', logRows[0]?.actor_uid, String(ADMIN_UID),
        'actor_uid 必须 = 动作人 admin（**不得记成 seller**）');
      eq('A2.log_txid_null', 'goods', logRows[0]?.txid, null,
        '商品轴 txid **恒 NULL**（DL59 无分录 ⇒ 对账显式豁免）');
      eq('A2.status_migrated', 'goods', statusRow[0]?.status, 'delisted',
        '通过 ⇒ 同事务走既有边 listed→delisted（状态未随之变 ⇒ 判负）');
      eq('A3.read_new_value', 'goods', readOut[0]?.status, 'delisted',
        '业务读口取到新值（仍取旧值 ⇒ 判负：库内有新值但业务不读）');
      eq('A4.before_purchasable', 'goods', buyBefore.purchasable, true,
        '改动前（listed）商品可购买');
      eq('A4.after_not_purchasable', 'goods', buyAfter.purchasable, false,
        '改动后（delisted）商品**不可购买**');
      eq('A4.after_reason', 'goods', `${buyAfter.code}/${buyAfter.reason}`, 'LEDGER_CURRENCY_INVALID_TRANSITION/listing_not_listed',
        '不可购买必须给逐字机读码 + reason = listing_not_listed');
      t('A4.two_readings_differ', 'goods', buyBefore.purchasable !== buyAfter.purchasable,
        '改动前/后两读数必须不同（同一业务量 = 可否购买）', JSON.stringify({ before: buyBefore.purchasable, after: buyAfter.purchasable }),
        '改动后该业务量不变 ⇒ 判负');
      selfTest('A4.after_not_purchasable', 'goods', (v) => v === false, true,
        '把「改动后仍可购买」喂入 ⇒ 谓词必须转红');
      selfTest('A2.log_txid_null', 'goods', (v) => v === null, '12345',
        '把非 NULL txid 喂入 ⇒ 商品轴谓词必须转红');

      // ---- ⑤ 商品库面判负：驳回分支
      const lr2 = await txQuery<{ listing_id: string }>(tx,
        `INSERT INTO public.listing (seller_uid, cid, price, stock, title, description, status, create_key)
         VALUES ($1::bigint, 1, 10, 5, $2::text, '', 'listed', $3::text) RETURNING listing_id::text AS listing_id`,
        [SELLER_UID, `p8s5 listing reject-fixture ${RUN}`, `biz:listing:p8s5:reject:${RUN}`]);
      const LID2 = Number(lr2[0].listing_id);
      const opsKey2 = canonicalAdminOpsKey(ADMIN_UID, 'listing_takedown', LID2);
      const reply2 = await inSavepoint(tx, 'sp_lst_reject', () => reviewListingTakedownVerb({
        listingIdRaw: String(LID2), actorUid: ADMIN_UID,
        body: { action: 'reject', reason: `p8s5 takedown reject ${RUN}` }, opsKey: opsKey2,
        postEvent: (i) => DatabaseService.listingTakedownPostEvent(i, tx),
      }));
      const logRows2 = await txQuery<Record<string, unknown>>(tx,
        `SELECT log_id::text AS log_id, result, txid::text AS txid FROM public.listing_review_log WHERE listing_id = $1::bigint`, [LID2]);
      const status2 = await txQuery<{ status: string }>(tx, `SELECT status FROM public.listing WHERE listing_id = $1::bigint`, [LID2]);
      const buyAfterReject = await buyGate(tx, LID2, BUYER_UID, `biz:listing:buy:p8s5:rj:${RUN}`);
      A['5_neg_reject'] = {
        reply: { ok: reply2.ok, view: (reply2 as any).view ?? null }, log_rows: logRows2,
        status_after_reject: status2[0]?.status ?? null, buy_after_reject: buyAfterReject,
      };
      eq('A5.reject_log_one_row', 'goods', logRows2.length, 1,
        '驳回 ⇒ 台账 **恰 1 行**（驳回必须留痕 · 不得静默）');
      eq('A5.reject_result', 'goods', logRows2[0]?.result, 'rejected',
        '驳回台账 result = rejected');
      eq('A5.reject_status_unchanged', 'goods', status2[0]?.status, 'listed',
        '★ 驳回分支**不得改状态**（status 变 ⇒ 判负）');
      eq('A5.reject_still_purchasable', 'goods', buyAfterReject.purchasable, true,
        '驳回语义（§28.2(d)）= 状态不动 ⇒ 仍 listed ⇒ 仍可购买（此为该路径**正确**结果；反例：驳回却改状态 ⇒ 判负）');
      selfTest('A5.reject_status_unchanged', 'goods', (v) => v === 'listed', 'delisted',
        '把「驳回后 status=delisted」喂入 ⇒ 谓词必须转红');

      A['rollback'] = { sentinel: 'SEG-GOODS', committed: false, sql: 'withTransaction 回调抛哨兵 ⇒ catch ⇒ ROLLBACK（无 COMMIT）' };
      segA.goods = A;
      throw new RollbackSentinel('SEG-GOODS');
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
  }

  // ====================================================================
  // ③ 招工轴四段（含资金腿 + txid 对账）+ ⑤ 招工库面判负（事务内 · ROLLBACK）
  // ====================================================================
  try {
    await withTransaction(async (tx) => {
      const B: Record<string, unknown> = {};
      // ---- 控制夹具：open 态招工（可承接）—— 与仲裁夹具同一业务量对照
      const ctrlJob = await txQuery<{ r: Record<string, unknown> }>(tx,
        `SELECT public.job_post_event($1::jsonb) AS r`,
        [JSON.stringify({
          op: 'publish', create_key: `biz:job:p8s5:ctrl:${RUN}`, employer_uid: String(EMPLOYER_UID), cid: '1',
          reward: '50', title: `p8s5 ctrl fixture ${RUN}`, description: '',
          request_fingerprint: fpParts(['ctrl', RUN]), memo: 'p8s5 ctrl',
        })]);
      const CTRL = Number((ctrlJob[0]?.r as Record<string, unknown>)?.job_id);
      const ctrlGate = await acceptGate(tx, CTRL);

      // ---- 拒绝（退单）夹具：publish → submitted
      const JREJ = await makeArbJob(tx, 100, `rej:${RUN}`);
      const rejBefore = await acceptGate(tx, JREJ);
      const rejLegsBefore = await refundLegs(tx, JREJ);

      // ---- ④-改动前（同一招工）：可否承接 + 资金腿
      B['4_behavior_before'] = { accept_gate: rejBefore, escrow_refund_legs: rejLegsBefore.length, ctrl_accept_gate: ctrlGate };

      // ---- ① 仲裁驳回（服务层 verb + tx 绑定 DB 函数）
      const opsKeyR = canonicalAdminOpsKey(ADMIN_UID, 'job_arbitrate', JREJ);
      const replyR = await inSavepoint(tx, 'sp_arb_reject', () => arbitrateJobVerb({
        jobIdRaw: String(JREJ), actorUid: ADMIN_UID,
        body: { action: 'reject', reason: `p8s5 arbitrate reject ${RUN}` }, opsKey: opsKeyR,
        postEvent: (i) => DatabaseService.jobArbitrationPostEvent(i, tx),
      }));
      B['1_action'] = {
        route: 'POST /api/admin/arbitration/:jobId', gate: "requireAdmin(req,res,'review_tasks')",
        ops_key: `<ops:admin_uid>:job_arbitrate:${JREJ}`, request: { action: 'reject', reason: '<reason>' },
        reply: { ok: replyR.ok, replay: (replyR as any).replay ?? null, view: (replyR as any).view ?? null, code: (replyR as any).code ?? null, status: (replyR as any).status ?? null, details: (replyR as any).details ?? null },
      };

      // ---- ② 库内落值 + 资金腿 + txid
      const alogRows = await txQuery<Record<string, unknown>>(tx,
        `SELECT log_id::text AS log_id, job_id::text AS job_id, actor_uid::text AS actor_uid, result,
                txid::text AS txid, memo, idempotency_key
           FROM public.job_arbitration_log WHERE job_id = $1::bigint ORDER BY log_id`, [JREJ]);
      const jstatus = await txQuery<{ status: string }>(tx, `SELECT status FROM public.job WHERE job_id = $1::bigint`, [JREJ]);
      const rejLegs = await refundLegs(tx, JREJ);
      const logTxid = alogRows[0]?.txid ?? null;
      const legTxids = Array.from(new Set(rejLegs.map((l) => String(l.txid))));
      const ledgerByTxid = logTxid
        ? await txQuery<Record<string, unknown>>(tx,
            `SELECT txid::text AS txid, uid::text AS uid, cid::text AS cid, delta::text AS delta,
                    frozen_delta::text AS frozen_delta, kind FROM public.ledger_entry WHERE txid = $1::bigint ORDER BY kind, uid`,
            [Number(logTxid)])
        : [];
      B['2_db_landed'] = {
        log_table: 'public.job_arbitration_log', log_rows: alogRows, log_count: alogRows.length,
        status_col: { table: 'public.job', column: 'status', value: jstatus[0]?.status ?? null },
        escrow_refund_legs: rejLegs, escrow_refund_leg_count: rejLegs.length,
        txid_anchor: { log_txid: logTxid, ledger_leg_txids: legTxids, ledger_rows_at_txid: ledgerByTxid },
      };

      // ---- ③ 业务读口取数（DB 直取 · 同一 SELECT 体；锚 = database.ts:2489 listJobsForArbitration）
      const readOut = await txQuery<Record<string, unknown>>(tx,
        `SELECT j.job_id AS job_id, j.employer_uid AS employer_uid, j.worker_uid AS worker_uid, j.cid AS cid,
                j.reward AS reward, j.title AS title, j.status AS status, j.time_created AS time_created
           FROM public.job AS j WHERE j.job_id = $1::bigint`, [JREJ]);
      B['3_business_read'] = { anchor: 'backend-ts/src/database.ts:2489 listJobsForArbitration（同 SELECT 体）', row: readOut[0] ?? null };

      // ---- ④-改动后：可否承接 + 资金腿
      const rejAfter = await acceptGate(tx, JREJ);
      B['4_behavior_after'] = { accept_gate: rejAfter, escrow_refund_legs: rejLegs.length, ctrl_accept_gate: ctrlGate };

      // ---- 判据
      t('B1.action_ok', 'job', replyR.ok === true, '仲裁动作口 verb 返 ok', JSON.stringify({ ok: replyR.ok }), '动作口未成功 ⇒ 判负');
      eq('B2.log_one_row', 'job', alogRows.length, 1, '仲裁动作 ⇒ job_arbitration_log **恰 1 行**');
      eq('B2.log_result', 'job', alogRows[0]?.result, 'rejected', '驳回台账 result = rejected');
      eq('B2.log_actor_is_admin', 'job', alogRows[0]?.actor_uid, String(ADMIN_UID), 'actor_uid = 动作人 admin（不得记成 employer）');
      eq('B2.status_cancelled', 'job', jstatus[0]?.status, 'cancelled', '驳回 ⇒ 走既有边 submitted→disputed→cancelled（退单）');
      eq('B2.escrow_refund_two_legs', 'job', rejLegs.length, 2, '退单必须有 **job_escrow_refund ×2** 资金腿');
      eq('B2.escrow_refund_kinds', 'job', Array.from(new Set(rejLegs.map((l) => l.kind))), ['job_escrow_refund'],
        '资金腿 kind 全 = job_escrow_refund');
      t('B2.txid_non_null', 'job', logTxid !== null && String(logTxid).length > 0,
        '招工仲裁 **txid 非恒 NULL**（成功行 = 回执 txid）', JSON.stringify({ log_txid: logTxid }),
        '台账 txid 恒 NULL ⇒ 判负（未锚账）');
      // ★ 现取：ledger_entry.txid 是**逐分录**序列（同一事件两腿 = 两个 txid，第 2 腿键带 `#2` 后缀）；
      //   台账回执 txid = 该事件**首分录** txid ⇒ 对账判据 = 回执 txid ∈ 腿 txid 集 ∧ 该 txid 在 ledger_entry 有行。
      t('B2.txid_anchors_ledger', 'job', legTxids.includes(String(logTxid)),
        '台账回执 txid ∈ 资金腿 txid 集（能锚账）',
        JSON.stringify({ log_txid: logTxid, leg_txids: legTxids }), '台账 txid 不在腿 txid 集 ⇒ 对不上 ⇒ 判负');
      t('B2.txid_ledger_rows_exist', 'job', ledgerByTxid.length >= 1 && ledgerByTxid.every((r) => r.kind === 'job_escrow_refund'),
        `txid=${logTxid} 在 ledger_entry 有行且 kind = job_escrow_refund`,
        JSON.stringify(ledgerByTxid.map((r) => `${r.kind}:${r.uid}:${r.delta}/${r.frozen_delta}`)),
        'txid 无法在 ledger_entry 对上 ⇒ 判负');
      eq('B2.legs_balance', 'job',
        rejLegs.map((l) => `${l.uid}:${l.delta}:${l.frozen_delta}`).sort(),
        [`${EMPLOYER_UID}:100:0`, `${EMPLOYER_UID}:0:-100`].sort(),
        '退回腿 = 雇主 balance +reward / frozen −reward（经济恒等）');
      eq('B3.read_new_value', 'job', readOut[0]?.status, 'cancelled',
        '业务读口取到新值（仍取旧值 ⇒ 判负）');
      // ④ 两读数：控制 open 招工 可承接 vs 仲裁后 不可承接
      eq('B4.ctrl_job_acceptable', 'job', ctrlGate.acceptable, true, '控制 open 招工 = **可承接**（同一业务量参照）');
      eq('B4.treated_job_not_acceptable', 'job', rejAfter.acceptable, false, '仲裁后招工 = **不可承接**');
      t('B4.two_readings_differ', 'job', ctrlGate.acceptable === true && rejAfter.acceptable === false,
        '改动前/后两读数必须不同（同一业务量 = 可否承接）', JSON.stringify({ ctrl: ctrlGate.acceptable, treated_after: rejAfter.acceptable }),
        '改动后该业务量不变 ⇒ 判负');
      t('B4.escrow_two_readings_differ', 'job', rejLegsBefore.length === 0 && rejLegs.length === 2,
        '改动前/后资金腿读数必须不同（0 → 2）', JSON.stringify({ before: rejLegsBefore.length, after: rejLegs.length }),
        '退单无 job_escrow_refund 腿（托管未退）⇒ 判负');
      selfTest('B4.treated_job_not_acceptable', 'job', (v) => v === false, true, '把「仲裁后仍可承接」喂入 ⇒ 谓词必须转红');
      selfTest('B2.escrow_refund_two_legs', 'job', (v) => v === 2, 0, '把「0 条退单腿」喂入 ⇒ 谓词必须转红');

      // ---- ⑤ 招工库面判负：驳回后仍可承接 ⇒ 判负（已由 B4 覆盖）；追加「成功而台账无行」互证
      t('B5.success_implies_log', 'job', replyR.ok === true && alogRows.length === 1,
        '★「仲裁成功而台账无行 ⇒ 判负」（双向：treated job 状态变而台账必在）',
        JSON.stringify({ ok: replyR.ok, log_count: alogRows.length }),
        '动作成功而台账无行 ⇒ 判负');
      selfTest('B5.success_implies_log', 'job', (v) => Number(v) === 1, 0, '把「台账 0 行」喂入 ⇒ 谓词必须转红');

      // ★★ 真缺陷登记（附逐字复现）：DB 侧真链路成立（status/台账/资金腿全落），但**服务层 verb 回执判据倒置** ⇒
      //    成功动作被误判 409（首调）。根因：`DatabaseService.jobArbitrationPostEvent` 回执 `job_status = 终态`
      //    （database.ts:2618），而 `arbitrateJobVerb` 用 `row.job_status` 作**可仲裁态前置检查**
      //    （compliance-review-service.ts:307/321：`curStatus !== 'submitted' && !== 'disputed' ⇒ 409`）⇒ 终态必然不满足。
      if (replyR.ok !== true && jstatus[0]?.status === 'cancelled' && alogRows.length === 1) {
        defects.push({
          id: 'DEFECT-ARB-VERB-POST-STATE',
          severity: 'HIGH',
          summary: '招工仲裁动作口首调误判 409：库面已生效（status=cancelled/settled、台账 1 行、资金腿），但 verb 回执 ok=false',
          root_cause: 'jobArbitrationPostEvent 回执 job_status=终态；arbitrateJobVerb 误当「前置态」检查',
          anchors: [
            'backend-ts/src/compliance-review-service.ts:307（curStatus = row.job_status）',
            'backend-ts/src/compliance-review-service.ts:321（curStatus !== submitted && !== disputed ⇒ jobStateConflict 409）',
            'backend-ts/src/database.ts:2618（job_status: finalStatus —— 回执给的是**终态**）',
          ],
          repro: 'tx 内 jobArbitrationPostEvent 成功（status=cancelled + 台账 + 退款腿×2）；arbitrateJobVerb 回 {ok:false, code:LEDGER_CURRENCY_INVALID_TRANSITION, status:409}',
          observed: { reply: { ok: replyR.ok, code: (replyR as any).code, status: (replyR as any).status, details: (replyR as any).details }, db: { status: jstatus[0]?.status, log_count: alogRows.length } },
          impact: '真 HTTP POST /api/admin/arbitration/:jobId 首调返回 409（客户端判失败）；状态/台账/资金腿**已提交**（单事务 COMMIT）⇒ 重投命中 prior_count ⇒ 200 重放 ⇒ 「先 409 后 200」不一致；approve 路径同病',
          fix_owner: 'Zang（须改 database.ts:2618 回执 或 compliance-review-service.ts:307 判据 —— 均超本单硬口径）',
        });
      }

      // ---- 通过（结算）夹具：approve ⇒ settled（资金腿 job_payout/job_fee/commission）
      const JAPP = await makeArbJob(tx, 100, `app:${RUN}`);
      const opsKeyA = canonicalAdminOpsKey(ADMIN_UID, 'job_arbitrate', JAPP);
      const replyA = await inSavepoint(tx, 'sp_arb_approve', () => arbitrateJobVerb({
        jobIdRaw: String(JAPP), actorUid: ADMIN_UID,
        body: { action: 'approve', reason: `p8s5 arbitrate approve ${RUN}` }, opsKey: opsKeyA,
        postEvent: (i) => DatabaseService.jobArbitrationPostEvent(i, tx),
      }));
      const alogA = await txQuery<Record<string, unknown>>(tx,
        `SELECT log_id::text AS log_id, result, txid::text AS txid FROM public.job_arbitration_log WHERE job_id = $1::bigint`, [JAPP]);
      const jstatusA = await txQuery<{ status: string }>(tx, `SELECT status FROM public.job WHERE job_id = $1::bigint`, [JAPP]);
      const settleLegs = await txQuery<Record<string, unknown>>(tx,
        `SELECT txid::text AS txid, kind, uid::text AS uid, delta::text AS delta FROM public.ledger_entry
          WHERE event_root_key = $1::text ORDER BY kind, uid`, [`biz:job:settle:${JAPP}`]);
      const appAfter = await acceptGate(tx, JAPP);
      B['6_approve_path'] = {
        reply: { ok: replyA.ok, view: (replyA as any).view ?? null }, log_rows: alogA,
        status: jstatusA[0]?.status ?? null, settle_legs: settleLegs, accept_gate_after: appAfter,
      };
      eq('B6.approve_status_settled', 'job', jstatusA[0]?.status, 'settled', 'approve ⇒ 走既有边 submitted→disputed→settled（支持雇主）');
      eq('B6.approve_log_one_row', 'job', alogA.length, 1, 'approve ⇒ 台账恰 1 行 result=approved');
      eq('B6.approve_log_result', 'job', [alogA[0]?.result], ['approved'], 'approve 台账 result = approved');
      t('B6.approve_txid_non_null', 'job', alogA[0]?.txid !== null && alogA[0]?.txid !== undefined,
        'approve（结算资金腿） txid 非 NULL', JSON.stringify({ txid: alogA[0]?.txid ?? null }), '结算台账 txid 为 NULL ⇒ 判负');
      t('B6.approve_txid_anchors', 'job', settleLegs.length > 0 && settleLegs.some((l) => String(l.txid) === String(alogA[0]?.txid)),
        'approve 台账 txid ∈ 结算腿 txid 集（能锚账）', JSON.stringify({ log: alogA[0]?.txid, legs: Array.from(new Set(settleLegs.map((l) => l.txid))) }),
        '结算台账 txid 不在腿集 ⇒ 判负');
      eq('B6.approve_not_acceptable', 'job', appAfter.acceptable, false, 'approve 后招工不可承接');

      B['rollback'] = { sentinel: 'SEG-JOB', committed: false, sql: 'withTransaction 回调抛哨兵 ⇒ catch ⇒ ROLLBACK（无 COMMIT）' };
      segB.job = B;
      throw new RollbackSentinel('SEG-JOB');
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
  }

  // ====================================================================
  // ③-B 首调真链路（`R-9-9` 修缺陷）：动作口**首调 = 200** + 库内**三处落值** + 非法前置态**不落值**
  //      （事务内 · ROLLBACK；捕获 DB **原始回执**核 `prior_status`（前置态）vs `job_status`（终态））
  // ====================================================================
  const segC: Record<string, unknown> = {};
  try {
    await withTransaction(async (tx) => {
      const C: Record<string, unknown> = {};
      const JC = await makeArbJob(tx, 80, `first:${RUN}`);
      let raw: Record<string, unknown> | null = null;
      const reply = await inSavepoint(tx, 'sp_first_arb', () => arbitrateJobVerb({
        jobIdRaw: String(JC), actorUid: ADMIN_UID,
        body: { action: 'reject', reason: `p8s5 first-call ${RUN}` },
        opsKey: canonicalAdminOpsKey(ADMIN_UID, 'job_arbitrate', JC),
        postEvent: async (i) => { const r = await DatabaseService.jobArbitrationPostEvent(i, tx); raw = r as Record<string, unknown>; return r; },
      }));
      C.reply = { ok: reply.ok, replay: (reply as any).replay ?? null, view: (reply as any).view ?? null,
                  code: (reply as any).code ?? null, status: (reply as any).status ?? null };
      C.receipt = raw;
      const flog = await txQuery<Record<string, unknown>>(tx,
        `SELECT log_id::text AS log_id, result, txid::text AS txid FROM public.job_arbitration_log WHERE job_id = $1::bigint`, [JC]);
      const fst = await txQuery<{ status: string }>(tx, `SELECT status FROM public.job WHERE job_id = $1::bigint`, [JC]);
      const flegs = await refundLegs(tx, JC);
      C.db_landed = { log_rows: flog.length, status: fst[0]?.status ?? null, refund_legs: flegs.length };

      // 非法前置态：对**已终态**的 JC 再仲裁（**新键**）⇒ 期望 409 + 库内三处零增
      const reply2 = await arbitrateJobVerb({
        jobIdRaw: String(JC), actorUid: ADMIN_UID,
        body: { action: 'approve', reason: `p8s5 first-call neg ${RUN}` },
        opsKey: canonicalAdminOpsKey(900001, 'job_arbitrate', JC),
        postEvent: (i) => DatabaseService.jobArbitrationPostEvent(i, tx),
      });
      const flog2 = await txQuery<Record<string, unknown>>(tx,
        `SELECT log_id::text AS log_id FROM public.job_arbitration_log WHERE job_id = $1::bigint`, [JC]);
      const fst2 = await txQuery<{ status: string }>(tx, `SELECT status FROM public.job WHERE job_id = $1::bigint`, [JC]);
      const flegs2 = await refundLegs(tx, JC);
      C.illegal_prestate = {
        reply: { ok: reply2.ok, code: (reply2 as any).code ?? null, status: (reply2 as any).status ?? null, details: (reply2 as any).details ?? null },
        db_after: { log_rows: flog2.length, status: fst2[0]?.status ?? null, refund_legs: flegs2.length },
      };

      const r = (raw ?? {}) as Record<string, unknown>;
      // 判据
      t('C1.first_call_200', 'firstCall', reply.ok === true,
        '★ 动作口首调 = 200（ok=true；修前必 409）', JSON.stringify({ ok: reply.ok, status: (reply as any).status ?? null }),
        '首调非 200 ⇒ 判负（R-9-9 修法未生效）');
      t('C2.receipt_has_prior_status', 'firstCall', raw !== null && String(r.prior_status) === 'submitted',
        'DB 回执含 `prior_status`（前置态）= submitted', JSON.stringify({ prior_status: r?.prior_status ?? null }),
        '回执缺 prior_status / 值非前置态 ⇒ 判负');
      t('C3.terminal_differs_from_prior', 'firstCall',
        String(r?.job_status) === 'cancelled' && String(r?.job_status) !== String(r?.prior_status),
        '回执 `job_status`（终态）= cancelled 且 **≠** prior_status', JSON.stringify({ prior: r?.prior_status ?? null, job_status: r?.job_status ?? null }),
        '终态 == 前置态（未迁移）⇒ 判负');
      t('C4.db_three_landed', 'firstCall', flog.length === 1 && fst[0]?.status === 'cancelled' && flegs.length === 2,
        '库内三处落值：台账 1 行 + 状态 submitted→cancelled + 资金腿 ×2',
        JSON.stringify(C.db_landed), '三处任一未落 ⇒ 判负');
      t('C5.receipt_applied_reviewed_txid', 'firstCall',
        Number(r?.applied) === 1 && Number(r?.reviewed) === 1 && r?.txid !== null && r?.txid !== undefined,
        '回执 applied=1 ∧ reviewed=1 ∧ txid 非 NULL', JSON.stringify({ applied: r?.applied, reviewed: r?.reviewed, txid: r?.txid }),
        'applied/reviewed/txid 任一不对 ⇒ 判负');
      const illegal = (reply2 as unknown as { status?: number; code?: string; details?: Record<string, unknown> });
      t('C6.illegal_prestate_409', 'firstCall',
        reply2.ok === false && illegal.status === 409 && illegal.code === 'LEDGER_CURRENCY_INVALID_TRANSITION'
          && (illegal.details?.reason === 'JOB_STATE_INVALID') && (illegal.details?.from === 'cancelled'),
        '非法前置态（已 cancelled）⇒ 409 LD011 + reason JOB_STATE_INVALID + from=cancelled',
        JSON.stringify(C.illegal_prestate), '非法前置态未落 409 ⇒ 判负');
      t('C7.illegal_prestate_no_write', 'firstCall',
        flog2.length === flog.length && fst2[0]?.status === 'cancelled' && flegs2.length === flegs.length,
        '★ 非法前置态 ⇒ 库内三处**零增**（台账不落 / 状态不变 / 无资金腿）——防「未生效却记账」',
        JSON.stringify({ before: C.db_landed, after: (C.illegal_prestate as { db_after: unknown }).db_after }),
        '非法前置态却落值（假台账）⇒ 判负');
      // ★ 负对照（逐字）：同一首调回执，若改用**终态字段**判前置态 ⇒ 必判 409（= 修前的错）
      const firstCallOk = (x: Record<string, unknown>): boolean => {
        const ps = String(x.prior_status ?? '');
        return (ps === 'submitted' || ps === 'disputed') && Number(x.applied ?? 0) > 0;
      };
      const legacyJudgeOk = (x: Record<string, unknown>): boolean => {
        const ps = String(x.job_status ?? '');   // ★ 旧码：拿**终态**当前置态（投影层误读）
        return (ps === 'submitted' || ps === 'disputed') && Number(x.applied ?? 0) > 0;
      };
      t('C8.negctl_terminal_field_red', 'firstCall',
        firstCallOk(r) === true && legacyJudgeOk(r) === false,
        '★ 负对照：同一回执下 `prior_status` 判据 = 成功；换用终态 `job_status` 判据 ⇒ **必红**',
        JSON.stringify({ prior_path: firstCallOk(r), legacy_terminal_path: legacyJudgeOk(r) }),
        '换回终态字段仍判成功 ⇒ 负对照失效（假门）⇒ 判负');
      selfTest('C8.negctl_terminal_field_red', 'firstCall', (v) => firstCallOk(v as Record<string, unknown>),
        { job_found: 1, prior_status: 'cancelled', job_status: 'cancelled', applied: 0, reviewed: 0 },
        '把「终态当前置态」的回执喂入 ⇒ 判据必须转红');

      C.rollback = { sentinel: 'SEG-FIRSTCALL', committed: false };
      segC.first_call = C;
      throw new RollbackSentinel('SEG-FIRSTCALL');
    });
  } catch (e) {
    if (!(e instanceof RollbackSentinel)) throw e;
  }

  out.segment_goods = segA.goods ?? null;
  out.segment_job = segB.job ?? null;
  out.segment_first_call = segC.first_call ?? null;

  // ---------------------------------------------------------------- 恢复自证（只读）
  const afterAll = await snapshot();
  out.post_restore = afterAll;
  eq('RESTORE-listing_review_log', 'restore', afterAll.listing_review_log, baseline.listing_review_log,
    '恢复后 listing_review_log 行数/最大 id 与基线不同 ⇒ 判负（台账写已外泄）');
  eq('RESTORE-job_arbitration_log', 'restore', afterAll.job_arbitration_log, baseline.job_arbitration_log,
    '恢复后 job_arbitration_log 与基线不同 ⇒ 判负');
  eq('RESTORE-listing', 'restore', afterAll.listing, baseline.listing, '恢复后 listing 行数/最大 id 与基线不同 ⇒ 判负（夹具已落库）');
  eq('RESTORE-job', 'restore', afterAll.job, baseline.job, '恢复后 job 行数/最大 id 与基线不同 ⇒ 判负（夹具已落库）');
  eq('RESTORE-ledger_entry', 'restore', afterAll.ledger_entry, baseline.ledger_entry, '恢复后 ledger_entry 行数/最大 txid 与基线不同 ⇒ 判负（分录已落库）');
  eq('RESTORE-account', 'restore', afterAll.account, baseline.account, '恢复后 account 行数与基线不同 ⇒ 判负');

  t('RESTORE-no-commit-sentinel', 'restore',
    JSON.stringify((segA.goods as any)?.rollback?.committed) === 'false' && JSON.stringify((segB.job as any)?.rollback?.committed) === 'false',
    '两段皆走 ROLLBACK（committed=false）', JSON.stringify({ goods: (segA.goods as any)?.rollback?.committed, job: (segB.job as any)?.rollback?.committed }),
    'committed !== false（疑似走 COMMIT 路径）⇒ 判负');

  // ---------------------------------------------------------------- 结论
  const failed = checks.filter((c) => !c.pass);
  const report = {
    unit: 'P8-S5-REAL-CHAINS', run: RUN, generated_at: new Date().toISOString(),
    total: checks.length, passed: checks.length - failed.length, failed: failed.length,
    section1_triggers: out.section1_triggers,
    schema_version: out.schema_version, base_tables: out.base_tables,
    migration_assert: out.migration_assert,
    baseline: out.baseline, post_restore: out.post_restore,
    segment_goods: out.segment_goods, segment_job: out.segment_job,
    segment_first_call: out.segment_first_call,
    defects,
    checks,
  };
  fs.writeFileSync(path.join(OUT_DIR, 'real-chains.json'), JSON.stringify(report, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify({ total: report.total, passed: report.passed, failed: report.failed, failed_ids: failed.map((f) => f.id) }, null, 1));
  console.log(`SUMMARY total=${report.total} passed=${report.passed} failed=${report.failed} artifact=${path.join(OUT_DIR, 'real-chains.json')}`);
  await closePools();
  process.exit(failed.length ? 1 : 0);
})().catch(async (e) => {
  console.error('PROBE_CRASHED', String((e as Error)?.stack || e).slice(0, 2500));
  await closePools().catch(() => undefined);
  process.exit(2);
});
