/**
 * p61-00 · 多件购买授权（`allow_multi_buy`）后端门 · 迁移 0061
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/multi-buy/p61-00-multi-buy-gate.ts
 * 读数：`ops/multi-buy/readings/p61-multi-buy-gate-<RUN>.json`
 *
 * ★ 覆盖面（route §49.17 · data §40.13 · ops/multi-buy/SPEC-NOTE.md）：
 *   A · 静态面（零 DB）：注册点仍 **111** · index.ts 两处透传 `body.allow_multi_buy` ·
 *       `LISTING_EDIT_FIELDS` 6→7 与 `editable_when_creating` 7 项**同批** · 归一/400 纯函数 ·
 *       `buyListing` 前置闸位置/闸序（qty=1 零读库 · 行缺失放行 · allow 先于 stock）·
 *       迁移 0061 形状（恰 1 列 / 无 BEGIN-COMMIT / 零 DML / 零索引 / 零 CHECK / 自检八条 RAISE·六臂）·
 *       三读口 SELECT 带 `allow_multi_buy`、feed 不带 · UPDATE 语句 `$12` + W5 归一 + W7 守卫臂 ·
 *       幂等指纹不含该列 · 400 借码（零新码）；
 *   B · 迁移面（真库）：post-apply 列形状（boolean/NOT NULL/DEFAULT false/列数 18）·
 *       pre-apply ⇒ 事务内干跑头段 + 尾部 DO（ROLLBACK 零 apply）· 尾部 DO 重跑仍绿（重放免疫）·
 *       `pg_constraint` 实查零 CHECK 引用该列 · 存量零 NULL（三态禁令）；
 *   W · 写口矩阵（真库 · 事务内 · **service 层真实代码路径**）：W1–W7 全臂 + W3 的 PATCH
 *       纯预检臂，400 臂**零 DB 写**（写桩计数不增 / 读回不变）；
 *   M · 购买矩阵（真库 · 真资金链 `listing_post_event`，夹具 = 自建币 + mint + 双用户）：
 *       B1 单件照旧（qty=1 **零读库**）· B2 false∧qty2 ⇒ 400 零写 · B3 true∧qty2∧stock≥2 ⇒
 *       成交（订单 qty=2 / 库存递减 / 余额两腿 / allow 不回写）· B4 qty>stock ⇒ 既有 409 ·
 *       闸序（false∧qty>stock ⇒ 400 而非 409）· B7 true∧stock1∧qty1 ⇒ 正常终态；
 *   N · **两臂负控（判据非恒绿）**：
 *       ① 去写口归一 —— 对**唯一真源 UPDATE_LISTING_DETAILS_SQL** 做手术（W5 归一 CASE →
 *          `COALESCE` 透传，参数位不动）⇒ `true ∧ stock1` 落库 ⇒ **W5 判据必红**；
 *       ② 去购买闸 —— 绕开服务层直调真 `listing_post_event`（qty=2 ∧ allow=false）⇒
 *          照常成交（订单 / 库存 / 余额全动）⇒ **B2 判据必红**（DB 层故意不设闸，服务层闸是唯一防线）；
 *   C · 读口键数（同 tx）：详情 service 52 / 路由合成 **53** · mine **14** · edit **14** ·
 *       feed **50**（零 `allow_multi_buy`）；键型 = 真布尔；
 *   E · 桩回收 · F · 零残留 + committed 库面未动。
 *
 * 纪律：**不 apply、不写版本表、一切写在回滚事务内**（SAVEPOINT 包预期失败/须撤销臂）；
 *   资金夹具（币 / mint / 订单 / 余额）全部随事务回滚 ⇒ 零残留；探针凭据只读 `.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, raw1Retry, qRetry, sha256 } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import type { SqlRunner } from '../../backend-ts/src/database';
import {
  LISTING_EDIT_FIELDS,
  createListing,
  multiBuyApplicabilityError,
  normalizeAllowMultiBuy,
  updateListingDetails,
} from '../../backend-ts/src/listing-service';
import { buyListing } from '../../backend-ts/src/listing-funds-service';

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DB = readSrc('backend-ts/src/database.ts');
const SVC = readSrc('backend-ts/src/listing-service.ts');
const FUNDS = readSrc('backend-ts/src/listing-funds-service.ts');
const LEDGER_ERR = readSrc('backend-ts/src/ledger-errors.ts');
const MIG61 = readSrc('backend-ts/migrations/0061_listing_allow_multi_buy.sql');
const MIG60 = readSrc('backend-ts/migrations/0060_item_code_snowflake.sql');

const sliceBetween = (src: string, startMark: string, endMark: string): string => {
  const a = src.indexOf(startMark);
  const b = a >= 0 ? src.indexOf(endMark, a + 1) : -1;
  return a >= 0 && b > a ? src.slice(a, b) : '';
};
const stripSqlLineComments = (text: string): string =>
  text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const splitSqlStatements = (src: string): string[] => {
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < src.length; i += 1) {
    if (src.slice(i, i + 2) === '$$') { inDollar = !inDollar; buf += '$$'; i += 1; continue; }
    const ch = src[i];
    if (!inDollar && ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter((x) => x.replace(/--[^\n]*/g, '').trim().length > 0);
};
const M61_AT = MIG61.indexOf('\nDO $$');
const M61_HEAD = MIG61.slice(0, M61_AT).trim();
const M61_TAIL = MIG61.slice(M61_AT).trim();
const M61_HEAD_STMTS = splitSqlStatements(M61_HEAD);
const M60_HEAD_STMTS = splitSqlStatements(MIG60.slice(0, MIG60.indexOf('\nDO $$')).trim());

/** ★ 唯一真源写口语句原文（负控要在它上面中和闸，而不是另写一份 SQL —— p59b 体例） */
const SQL_START = 'const UPDATE_LISTING_DETAILS_SQL = `';
const sqlAt = DB.indexOf(SQL_START);
const sqlEnd = sqlAt >= 0 ? DB.indexOf('`;', sqlAt + SQL_START.length) : -1;
const UPDATE_SQL = sqlAt >= 0 && sqlEnd > sqlAt ? DB.slice(sqlAt + SQL_START.length, sqlEnd) : '';

/** 负控 ①：W5 归一 CASE（SET 臂 + changed_fields 臂）→ `COALESCE($12, 列现值)` 透传（参数位 $12/$5 均仍在场） */
const W5_SET_RE = /CASE\s+WHEN \$12::boolean IS NULL THEN \(CASE WHEN COALESCE\(\$5::int, l\.stock\) <= 1 THEN false ELSE l\.allow_multi_buy END\)\s+ELSE \$12::boolean\s+END/;
const W5_CTE_RE = /CASE\s+WHEN \$12::boolean IS NULL THEN \(CASE WHEN COALESCE\(\$5::int, g\.stock\) <= 1 THEN false ELSE g\.allow_multi_buy END\)\s+ELSE \$12::boolean\s+END/;
const mutateW5 = (sql: string): string =>
  sql.replace(W5_SET_RE, 'COALESCE($12::boolean, l.allow_multi_buy)')
    .replace(W5_CTE_RE, 'COALESCE($12::boolean, g.allow_multi_buy)');

const FIXTURE_KEY_PREFIX = 'cli:p61-gate:';
const SYMBOL_PREFIX = 'p61g';
const MINE_14 = ['allow_multi_buy', 'cid', 'condition', 'description', 'item_code', 'item_type', 'listing_id',
  'media_urls', 'price', 'snowflake_id', 'status', 'stock', 'time_created', 'title'];

/** 一次「读行现值」：stock / allow_multi_buy / status */
const readRow = async (c: Qx, id: number) => raw1<{ stock: number; allow: boolean; status: string }>(c,
  'SELECT stock, allow_multi_buy AS allow, status FROM public.listing WHERE listing_id = $1::bigint', [id]);

/**
 * SAVEPOINT 三明治：fn 跑完（**无论成败**）一律 `ROLLBACK TO SAVEPOINT` —— 预期失败的臂
 * （409）要让事务复活、须撤销的成功臂（负控成交）要把写全抹掉 ⇒ 读数都在 fn 内部取。
 */
const undoAfter = async <T>(c: Qx, fn: () => Promise<T>): Promise<{ value: T | null; error: unknown | null }> => {
  await c.query('SAVEPOINT p61_nc');
  try {
    const value = await fn();
    await c.query('ROLLBACK TO SAVEPOINT p61_nc');
    return { value, error: null };
  } catch (e) {
    try { await c.query('ROLLBACK TO SAVEPOINT p61_nc'); } catch { /* noop */ }
    return { value: null, error: e };
  }
};

/** 首连偶发 ECONNRESET ⇒ 三次退避重试（p60 体例；业务/SQL 错误由 lib 侧判据保证不被吞） */
const tx = async <T>(p: ReturnType<typeof mkPool>, fn: (c: Qx) => Promise<T>) => {
  let last: { result: T | null; error: unknown | null; rolled_back: boolean; ms: number } | null = null;
  for (let i = 0; i < 3; i += 1) {
    const r = await inRollbackTx(p, fn);
    last = r;
    const msg = String((r.error as { message?: string })?.message ?? '');
    if (!r.error || !/socket disconnected|ECONNRESET|timeout/i.test(msg)) return r;
    await new Promise((res) => setTimeout(res, 1200));
  }
  return last as NonNullable<typeof last>;
};

const got = (r: { ok?: boolean; status?: number; code?: string; details?: Record<string, unknown> }) => ({
  ok: r.ok === true, status: r.status ?? null, code: r.code ?? null, details: r.details ?? null,
});

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/multi-buy/p61-00-multi-buy-gate.ts' };

  // ====================================================================== A · 静态面（零 DB）
  const regsByVerb = ['get', 'post', 'put', 'delete', 'patch'].map((v) =>
    (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length);
  const regs = regsByVerb.reduce((a, b) => a + b, 0);
  ck.t('A1', '**零新路由**：注册点仍 = 111（get 50 / post 57 / put 0 / delete 3 / patch 1）—— 写口/购买口全是既有端点收新字段',
    regs === 111 && JSON.stringify(regsByVerb) === JSON.stringify([50, 57, 0, 3, 1]),
    `registration_points=${regs} by_verb=${JSON.stringify(regsByVerb)}`);

  /** 从某一路由声明起，截到下一个顶层 `app.` 注册点（或文件尾）——PATCH 口是全文件唯一 patch ⇒ 也能截到 */
  const routeBlock = (src: string, startMark: string): string => {
    const a = src.indexOf(startMark);
    if (a < 0) return '';
    const b = src.indexOf('\napp.', a + 1);
    return b > a ? src.slice(a, b) : src.slice(a);
  };
  const postBlock = routeBlock(INDEX_TS, "app.post('/api/listing'");
  const patchBlock = routeBlock(INDEX_TS, "app.patch('/api/listing/:listingId'");
  const passCount = (INDEX_TS.match(/allowMultiBuy: body\.allow_multi_buy/g) ?? []).length;
  ck.t('A2', '**index.ts 两处透传**：`POST /api/listing` 与 `PATCH /api/listing/:listingId` 各有一次 `allowMultiBuy: body.allow_multi_buy`（全文件恰 2 处；本层不校验、不默认 —— 归一/400 全在服务层）',
    /allowMultiBuy: body\.allow_multi_buy/.test(postBlock) && /allowMultiBuy: body\.allow_multi_buy/.test(patchBlock)
    && passCount === 2,
    JSON.stringify({ post: /allowMultiBuy: body\.allow_multi_buy/.test(postBlock), patch: /allowMultiBuy: body\.allow_multi_buy/.test(patchBlock), total: passCount }));

  const EDIT_7 = ['description', 'price', 'stock', 'media_urls', 'item_type', 'item_condition', 'allow_multi_buy'];
  const creatingErr = await createListing({ sellerUid: 1, cid: 1, price: 1, stock: 1, description: `p61-gate A4 probe ${RUN}`, title: '退场字段探针' });
  const creating = (creatingErr.details as { editable_when_creating?: string[] } | undefined)?.editable_when_creating;
  ck.t('A3', '**第 7 可改字段同批**：`LISTING_EDIT_FIELDS` 恰 7 项（末位 `allow_multi_buy`，不含 title / item_code / snowflake_id）· 创建面 `editable_when_creating` 同批 7 项（退场字段 400 的 details 现取）—— 只改一处 ⇒ 另一半静默忽略（MB-N3 同族），必须两处都在',
    JSON.stringify([...LISTING_EDIT_FIELDS]) === JSON.stringify(EDIT_7)
    && JSON.stringify(creating ?? []) === JSON.stringify(EDIT_7)
    && !LISTING_EDIT_FIELDS.includes('title' as never) && !LISTING_EDIT_FIELDS.includes('item_code' as never)
    && !LISTING_EDIT_FIELDS.includes('snowflake_id' as never),
    JSON.stringify({ fields: LISTING_EDIT_FIELDS, editable_when_creating: creating ?? null }));

  const w6 = await normalizeAllowMultiBuy('true' as never);
  const w6b = await normalizeAllowMultiBuy(null as never);
  const w6c = multiBuyApplicabilityError(true, 1);
  const w6d = multiBuyApplicabilityError(true, 2);
  const w6e = multiBuyApplicabilityError(false, 0);
  const w6f = multiBuyApplicabilityError(null, 1);
  const inv = (e: { ok?: boolean; err?: { status?: number; code?: string; details?: Record<string, unknown> } }) =>
    !e.ok && e.err?.status === 400 && e.err.code === 'LEDGER_AMOUNT_INVALID';
  ck.t('A4', '**归一 / 400 纯函数**（W6/W3 单一真源 · 零 DB）：`normalizeAllowMultiBuy` 只收布尔（`\'true\'` ⇒ 400 `NOT_A_BOOLEAN` 零 DB；`undefined` ⇒ null = 未传；显式 `null` ⇒ 400）· `multiBuyApplicabilityError` 不变式：`(true, 1)` ⇒ 400 `MULTI_BUY_NOT_APPLICABLE`、`(true, 2)` / `(false, ·)` / `(null, ·)` ⇒ null',
    inv(w6) && (w6.err as { details?: { reason?: string } }).details?.reason === 'NOT_A_BOOLEAN'
    && inv(w6b) && w6b.err?.details?.reason === 'NOT_A_BOOLEAN'
    && normalizeAllowMultiBuy(undefined as never).ok === true
    && (normalizeAllowMultiBuy(undefined as never) as { value: unknown }).value === null
    && normalizeAllowMultiBuy(false as never).ok === true
    && w6c !== null && w6c.status === 400 && w6c.code === 'LEDGER_AMOUNT_INVALID'
    && w6c.details?.reason === 'MULTI_BUY_NOT_APPLICABLE' && w6c.details?.stock === 1
    && w6d === null && w6e === null && w6f === null,
    JSON.stringify({ w6: w6.err?.details, w3: w6c?.details, true2: w6d, false0: w6e, null1: w6f }));

  const buySlice = FUNDS.slice(FUNDS.indexOf('export const buyListing'));
  const gateAt = buySlice.indexOf('getListingBuyAuthRow');
  const postAt = buySlice.indexOf('listingPostEvent(payload)');
  const qtyAt = buySlice.indexOf('toPosIntText(body.quantity');
  const gateBlock = gateAt >= 0 ? buySlice.slice(gateAt, postAt > gateAt ? postAt : gateAt + 1200) : '';
  ck.t('A5', '**购买前置闸位置与形状**（route §49.17.4 写死）：闸在 `toPosIntText` quantity 形状闸之后、`listingPostEvent` 之前（服务层前置只读、零写）· `if (Number(qty.value) > 1)` 包住读库（**qty=1 零读库**，单件链路零额外往返）· `auth && !auth.allowMultiBuy`（**行缺失放行**，404 语义真源不变）· 拒绝形状 = `field:\'quantity\'` + `reason:\'multi_buy_not_allowed\'`（借 `LEDGER_AMOUNT_INVALID`，零新码）',
    qtyAt >= 0 && gateAt > qtyAt && postAt > gateAt
    && /if \(Number\(qty\.value\) > 1\)/.test(buySlice)
    && /const auth = await DatabaseService\.getListingBuyAuthRow/.test(buySlice)
    && /if \(auth && !auth\.allowMultiBuy\)/.test(buySlice)
    && /shapeError\('quantity', 'multi_buy_not_allowed'/.test(buySlice)
    && !/listing_stock_insufficient/.test(gateBlock) && !/stock\s*<\s*/.test(gateBlock),
    JSON.stringify({ gate_before_post: gateAt < postAt, gate_after_qty: gateAt > qtyAt, qty1_shortcircuit: /if \(Number\(qty\.value\) > 1\)/.test(buySlice), missing_row_pass: /if \(auth && !auth\.allowMultiBuy\)/.test(buySlice) }));

  const stripped61 = stripSqlLineComments(MIG61);
  const headCode = stripSqlLineComments(M61_HEAD);
  const adds = (stripped61.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length;
  const raises = (stripSqlLineComments(M61_TAIL).match(/RAISE EXCEPTION '0061 self-check/g) ?? []).length;
  ck.t('A6', '**迁移 0061 形状**：恰 **1** 条 `ADD COLUMN IF NOT EXISTS` = `allow_multi_buy boolean NOT NULL DEFAULT false`（计数按去注释正文，头注提及不算）· 头段无 BEGIN/COMMIT · 正文零 `UPDATE`（存量不回填）/ 零 `CREATE INDEX` / 零 `ADD CONSTRAINT`（`true ⇒ stock>=2` 的跨列不变式**只在写口**，库面不设 CHECK —— MB-N1）· 尾部 DO 自检**八条 RAISE**（六臂）在场：⓪列在场 / ①形状×3（boolean · NOT NULL · DEFAULT false）/ ②零三态 / ③首跑全 false · 重放免疫 / ④列数 18 / ⑤零 CHECK 引用',
    adds === 1 && /ADD COLUMN IF NOT EXISTS allow_multi_buy boolean NOT NULL DEFAULT false/.test(M61_HEAD)
    && !/\bBEGIN\b/.test(headCode) && !/\bCOMMIT\b/.test(headCode)
    && !/\bUPDATE\b/.test(stripped61) && !/CREATE (UNIQUE )?INDEX/.test(stripped61)
    && !/ADD CONSTRAINT/.test(stripped61)
    && raises === 8 && /IF v_n <> 18 THEN/.test(M61_TAIL) && /WHERE version = '0061'/.test(M61_TAIL),
    JSON.stringify({ adds, raises, col18: /IF v_n <> 18 THEN/.test(M61_TAIL), first_run_gate: /WHERE version = '0061'/.test(M61_TAIL) }));

  const detailRec = sliceBetween(DB, 'static async getPrizeDetailRecordingView', 'static async getPrizeDetailReadOnly');
  const detailRo = sliceBetween(DB, 'static async getPrizeDetailReadOnly', 'static async getPrizeDetailViewWithViewer');
  const mineBlk = sliceBetween(DB, 'static async listListingsBySeller', 'static async getListingEditRow');
  const editBlk = sliceBetween(DB, 'static async getListingEditRow', 'static async getListingBuyAuthRow');
  const feedBlk = sliceBetween(DB, 'static async listBrands', 'static async listListingsBySeller');
  const authBlk = sliceBetween(DB, 'static async getListingBuyAuthRow', 'static async listListingOrdersBySeller');
  ck.t('A7', '**三读口加键、feed 不加**（§49.17.5）：详情自增臂 / 只读臂 / mine / edit / 购买闸读点 SELECT 均含 `allow_multi_buy` · feed（`listBrands`）**不含**（列表卡不参与购买决策）· `getListingBuyAuthRow` 只读 `allow_multi_buy/stock/status` 且零 `for update`（前置只读、零锁）',
    /allow_multi_buy/.test(detailRec) && /allow_multi_buy/.test(detailRo)
    && /allow_multi_buy/.test(mineBlk) && /allow_multi_buy/.test(editBlk) && /allow_multi_buy/.test(authBlk)
    && !/allow_multi_buy/.test(feedBlk) && !/for update/.test(authBlk.toLowerCase()),
    JSON.stringify({ detail_rec: /allow_multi_buy/.test(detailRec), detail_ro: /allow_multi_buy/.test(detailRo), mine: /allow_multi_buy/.test(mineBlk), edit: /allow_multi_buy/.test(editBlk), auth: /allow_multi_buy/.test(authBlk), feed_clean: !/allow_multi_buy/.test(feedBlk), auth_locked: /for update/.test(authBlk.toLowerCase()) }));

  const w5Site = (UPDATE_SQL.match(/WHEN \$12::boolean IS NULL THEN \(CASE WHEN COALESCE\(\$5::int, l\.stock\) <= 1 THEN false ELSE l\.allow_multi_buy END\)/g) ?? []).length;
  ck.t('A8', '**写口语句三件套**（唯一真源 `UPDATE_LISTING_DETAILS_SQL`）：`$12` 参数位在场（≥4 处：guarded / SET / changed_fields / RETURNING）· W5 归一 CASE（`$12 IS NULL ∧ 生效 stock<=1 ⇒ false`，不 400）· W7 守卫臂（`$12 IS TRUE ∧ COALESCE($5, cur.stock) <= 1 ⇒ multi_buy_not_applicable`，**追加在既有 outcome 之后 ⇒ 既有优先级逐字不变**）· changed_fields 含 `allow_multi_buy`（管理员代编降量也入账）',
    UPDATE_SQL.length > 0 && (UPDATE_SQL.match(/\$12/g) ?? []).length >= 4
    && w5Site === 1
    && /WHEN \$12::boolean IS TRUE AND COALESCE\(\$5::int, cur\.stock\) <= 1 THEN 'multi_buy_not_applicable'/.test(UPDATE_SQL)
    && /THEN 'allow_multi_buy' END/.test(UPDATE_SQL),
    JSON.stringify({ dollars12: (UPDATE_SQL.match(/\$12/g) ?? []).length, w5_sites: w5Site, w7_guard: /multi_buy_not_applicable'/.test(UPDATE_SQL), changed_fields: /THEN 'allow_multi_buy' END/.test(UPDATE_SQL) }));

  const fpSlice = sliceBetween(SVC, 'resolveListingCreateKey(params.createKeyRaw,', ')');
  ck.t('A9', '**不进幂等指纹**（MB-N4）：`resolveListingCreateKey` 派生仍 **5 元素**（create / sellerUid / cid / price / stock），`allowMultiBuy` 不在其中 ⇒ 同键重投 200 replay 回库内真值',
    /['"]create['"]\s*,\s*params\.sellerUid\s*,\s*cid\.value\s*,\s*price\.value\s*,\s*stock\.value/.test(fpSlice)
    && !/allowMultiBuy/.test(fpSlice) && (fpSlice.match(/,/g) ?? []).length === 5,
    `fingerprint_slice=${JSON.stringify(fpSlice.slice(0, 120))}`);

  ck.t('A10', '**400 / 409 借码不改**（33 码闭集不动）：`LEDGER_AMOUNT_INVALID` = 400（B2/W3/W6 拒绝码）· `LEDGER_INSUFFICIENT_BALANCE` = 409（B4 既有码）；`multi_buy_not_allowed` 只是 `details.reason` 字符串，不占码位',
    /LEDGER_INSUFFICIENT_BALANCE:\s*\{\s*status:\s*409/.test(LEDGER_ERR)
    && /LEDGER_AMOUNT_INVALID:\s*\{\s*status:\s*400/.test(LEDGER_ERR)
    && /'multi_buy_not_allowed'/.test(FUNDS),
    JSON.stringify({ amount_invalid_400: /LEDGER_AMOUNT_INVALID:\s*\{\s*status:\s*400/.test(LEDGER_ERR), insufficient_409: /LEDGER_INSUFFICIENT_BALANCE:\s*\{\s*status:\s*409/.test(LEDGER_ERR) }));

  // ====================================================================== 真库段（B / W / M / N / C）
  const pool = mkPool(2);
  const projRows = await qRetry<{ project_id: string }>(pool, "SELECT current_setting('neon.project_id', true) AS project_id");
  const projectId = String(projRows[0]?.project_id ?? '');
  out.env = { project_id: projectId, expect_dev: 'quiet-math-65207667' };
  ck.t('ENV', '库身份自证：neon.project_id = dev（quiet-math-65207667）—— 读数归因前置',
    projectId === 'quiet-math-65207667', `project_id=${projectId}`);

  const committedCols = await raw1Retry<{ n: number; has: number }>(pool,
    "SELECT count(*)::int AS n, count(*) FILTER (WHERE column_name = 'allow_multi_buy')::int AS has FROM information_schema.columns WHERE table_schema='public' AND table_name='listing'");
  out.mode = Number(committedCols?.has ?? 0) === 1 ? 'post-apply' : 'pre-apply';
  ck.t('ENV2', '迁移态可判读：post-apply（列已 apply ⇒ 校验 committed 形状 + 事务内重放尾部 DO）/ pre-apply（事务内干跑头段 + 尾部 DO ⇒ ROLLBACK 零 apply）',
    out.mode === 'post-apply' || out.mode === 'pre-apply',
    `mode=${out.mode} committed_cols=${committedCols?.n} has_allow=${committedCols?.has}`);

  // ---- B · 迁移面（干跑 / 形状 / 零 CHECK）
  const br = await tx(pool, async (c) => {
    if (out.mode === 'pre-apply') {
      const idCols = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('snowflake_id','item_code')");
      if (Number(idCols?.n ?? 0) < 2) for (const stmt of M60_HEAD_STMTS) await c.query(stmt);
      for (const stmt of M61_HEAD_STMTS) await c.query(stmt);
    }
    let tailError: string | null = null;
    try { await c.query(M61_TAIL); } catch (e) { tailError = String((e as Error).message).slice(0, 240); }
    let tail2Error: string | null = null;
    try { await c.query(M61_TAIL); } catch (e) { tail2Error = String((e as Error).message).slice(0, 240); }
    const col = await raw1<Record<string, unknown>>(c,
      `SELECT data_type, is_nullable, column_default FROM information_schema.columns
        WHERE table_schema='public' AND table_name='listing' AND column_name='allow_multi_buy'`);
    const colCount = await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing'");
    const checkRefs = await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conrelid = 'public.listing'::regclass AND contype = 'c'
          AND position('allow_multi_buy' IN pg_get_constraintdef(oid)) > 0`);
    const trigRefs = await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class cl ON cl.oid = t.tgrelid
        WHERE cl.relname = 'listing' AND NOT t.tgisinternal AND position('allow_multi_buy' IN pg_get_triggerdef(t.oid)) > 0`);
    const idxRefs = await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM pg_index i JOIN pg_class cl ON cl.oid = i.indexrelid
        WHERE cl.relname = 'listing' AND position('allow_multi_buy' IN pg_get_indexdef(i.indexrelid)) > 0`);
    const nullRows = await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.listing WHERE allow_multi_buy IS NULL');
    const versionRow = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0061'");
    return { tailError, tail2Error, col, colCount, checkRefs, trigRefs, idxRefs, nullRows, versionRow };
  });
  const B = (br.result ?? {}) as Record<string, unknown>;
  const bcol = (B.col ?? {}) as Record<string, unknown>;
  ck.t('B1', `迁移面（mode=${String(out.mode)}）：\`allow_multi_buy\` = **boolean / NOT NULL / DEFAULT false**（两态列，禁三态禁 smallint）· 列数 = **18**（15 @0059 + 0060 ×2 + 本列）· 尾部 DO 自检跑通`,
    br.error === null && B.tailError === null && bcol.data_type === 'boolean' && bcol.is_nullable === 'NO'
    && String(bcol.column_default ?? '').includes('false') && Number((B.colCount as { n?: number })?.n ?? -1) === 18,
    JSON.stringify({ error: br.error, tail: B.tailError, col: bcol, cols: (B.colCount as { n?: number })?.n }).slice(0, 420));

  ck.t('B2', '尾部 DO 整块**重跑仍绿**（自检③首跑判据按 `schema_migration` 版本行做**重放免疫**：人工重放不再断言存量全 false ⇒ 迁移可重放）',
    B.tail2Error === null, JSON.stringify({ second_run_error: B.tail2Error }));

  ck.t('B3', '**库面零跨列约束**（MB-N1 实查）：`pg_constraint` 上零 CHECK 提及 `allow_multi_buy` · listing 上零触发器 / 零索引引用该列（`stock` 随购买递减 ⇒ 约束会把正常购买打成 23514；不变式只在写口）',
    Number((B.checkRefs as { n?: number })?.n ?? -1) === 0
    && Number((B.trigRefs as { n?: number })?.n ?? -1) === 0
    && Number((B.idxRefs as { n?: number })?.n ?? -1) === 0,
    JSON.stringify({ checks: (B.checkRefs as { n?: number })?.n, triggers: (B.trigRefs as { n?: number })?.n, indexes: (B.idxRefs as { n?: number })?.n }));

  ck.t('B4', '**存量零 NULL**（三态禁令取值面自证）· `schema_migration` 版本行与 mode 自洽（post-apply ⇒ 1 行；pre-apply ⇒ 0 行且本门全程未落版本行）',
    Number((B.nullRows as { n?: number })?.n ?? -1) === 0
    && Number((B.versionRow as { n?: number })?.n ?? 0) === (out.mode === 'post-apply' ? 1 : 0),
    JSON.stringify({ null_rows: (B.nullRows as { n?: number })?.n, version_rows: (B.versionRow as { n?: number })?.n, mode: out.mode }));

  // ---- W / M / N / C · 事务内（service 层真实代码路径 + 真资金链）
  const cr = await tx(pool, async (c) => {
    if (out.mode === 'pre-apply') {
      const idCols = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('snowflake_id','item_code')");
      if (Number(idCols?.n ?? 0) < 2) for (const stmt of M60_HEAD_STMTS) await c.query(stmt);
      for (const stmt of M61_HEAD_STMTS) await c.query(stmt);
    }
    const ex = c as unknown as SqlRunner;
    const r: Record<string, unknown> = {};

    // ---- 夹具：双用户 + 自建币（owner = 买家）+ mint（全部随事务回滚）
    const u1 = Number((await raw1<{ uid: number }>(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0'))?.uid ?? 0);
    const u2 = Number((await raw1<{ uid: number }>(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0 AND uid <> $1::bigint', [u1]))?.uid ?? 0);
    if (!u1 || !u2) throw new Error('p61-gate: no usable seller/buyer uids in users');
    const cidRows = await raw<{ cid: number }>(c,
      `INSERT INTO public.currency (symbol, name, owner_uid, decimals, total_supply, supply_cap, status, listed_at)
       VALUES ($1, $2, $3::bigint, 0, 0, NULL, 'listed', now()) RETURNING cid::bigint AS cid`,
      [`${SYMBOL_PREFIX}${RUN.slice(-9)}`, `p61-gate currency ${RUN}`, u1]);
    const CX = Number(cidRows[0].cid);
    await raw1(c, 'SELECT public.ledger_post_event($1::jsonb) AS r', [JSON.stringify({
      op: 'mint', uid: String(u1), cid: String(CX), amount: '1000000',
      idempotency_key: `ops:p61-gate:${RUN}-mint`, memo: `p61-gate mint ${RUN}`, request_fingerprint: sha256(`p61-mint-${RUN}`),
    })]);
    const minted = Number((await raw1<{ b: string }>(c, 'SELECT balance::text AS b FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint', [u1, CX]))?.b ?? '-1');
    r.fixture = { u1, u2, cid: CX, minted };

    // ---- 桩：五个 DB 静态方法 binds 到本事务客户端 + 调用计数（400 臂「零 DB 写」的判据）
    const svc = DatabaseService as unknown as Record<string, unknown>;
    const orig = {
      getCurrencyStatus: svc.getCurrencyStatus, createListingRow: svc.createListingRow,
      updateListingDetailsRow: svc.updateListingDetailsRow, getListingBuyAuthRow: svc.getListingBuyAuthRow,
      listingPostEvent: svc.listingPostEvent,
    };
    const cnt = { cur: 0, create: 0, upd: 0, auth: 0, post: 0 };
    try {
      svc.getCurrencyStatus = async (cid: number) => {
        cnt.cur += 1;
        const row = await raw1<{ cid: unknown; status: unknown }>(c,
          'SELECT c.cid AS cid, c.status AS status FROM public.currency AS c WHERE c.cid = $1::bigint LIMIT 1', [cid]);
        return row ? { cid: Number(row.cid), status: String(row.status) } : null;
      };
      svc.createListingRow = async (input: Record<string, unknown>) => { cnt.create += 1; return (orig.createListingRow as (...a: unknown[]) => Promise<unknown>)(input, c); };
      svc.updateListingDetailsRow = async (input: Record<string, unknown>) => { cnt.upd += 1; return (orig.updateListingDetailsRow as (...a: unknown[]) => Promise<unknown>)(input, c); };
      svc.getListingBuyAuthRow = async (id: number) => { cnt.auth += 1; return (orig.getListingBuyAuthRow as (...a: unknown[]) => Promise<unknown>)(id, c); };
      svc.listingPostEvent = async (payload: Record<string, unknown>) => {
        cnt.post += 1;
        const row = await raw1<Record<string, unknown>>(c, 'SELECT public.listing_post_event($1::jsonb) AS r', [JSON.stringify(payload)]);
        if (!row) throw new Error('listingPostEvent stub: no row');
        return row;
      };

      // ---- W1/W2/W4 · 创建三臂（落库真值读回）
      const mk = async (tag: string, stock: number, allow: unknown) => createListing({
        sellerUid: u2, cid: CX, price: 100, stock,
        description: `p61-gate ${tag} · RUN=${RUN}`, mediaUrls: [],
        itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew',
        createKeyRaw: `${FIXTURE_KEY_PREFIX}${RUN}-${tag}`, allowMultiBuy: allow,
      });
      const w1 = await mk('w1', 3, undefined);
      const w2 = await mk('w2', 3, true);
      const w4 = await mk('w4', 3, false);
      const w1v = (w1.view as Record<string, unknown> | undefined);
      const idOf = (v: { ok?: boolean; view?: Record<string, unknown> }) => Number(v?.view?.listing_id ?? 0);
      const FA = idOf(w1); const FB = idOf(w2); const FE = idOf(w4);
      for (const id of [FA, FB, FE]) await c.query("UPDATE public.listing SET status = 'listed' WHERE listing_id = $1::bigint", [id]);
      const w1db = await readRow(c, FA); const w2db = await readRow(c, FB); const w4db = await readRow(c, FE);
      ck.t('W1', '**W1**：创建**未传** `allow_multi_buy`（stock=3）⇒ 200，落库 **false**（缺省即未授权，绝不替卖家授权）',
        w1.ok === true && w1db?.allow === false && w1db?.stock === 3,
        JSON.stringify({ ok: w1.ok, db: w1db }));
      ck.t('W2', '**W2**：创建传 `true` ∧ stock≥2 ⇒ 200，落库 **true**（真布尔）',
        w2.ok === true && w2db?.allow === true && w2db?.stock === 3,
        JSON.stringify({ ok: w2.ok, db: w2db }));
      ck.t('W4', '**W4**：创建传显式 `false` ⇒ 200，落库 false',
        w4.ok === true && w4db?.allow === false,
        JSON.stringify({ ok: w4.ok, db: w4db }));

      // ---- W3 · 创建 true ∧ stock=1 ⇒ 400 零 DB
      const w3 = await mk('w3', 1, true);
      const crBefore3 = cnt.create;
      const w3b = await mk('w3b', 1, true);
      ck.t('W3', '**W3**：创建传 `true` ∧ stock=1 ⇒ 400 `MULTI_BUY_NOT_APPLICABLE` + `details.stock=1` · **零 DB 写**（`createListingRow` 调用数不增）',
        !w3.ok && w3.status === 400 && w3.code === 'LEDGER_AMOUNT_INVALID'
        && w3.details?.reason === 'MULTI_BUY_NOT_APPLICABLE' && String(w3.details?.stock) === '1'
        && cnt.create === crBefore3 && Number(idOf(w3b)) === 0,
        JSON.stringify({ res: got(w3 as never), create_calls: cnt.create, before: crBefore3 }));

      // ---- W6 · 形状闸（创建 + PATCH 两面 · 严格布尔）
      const crBefore6 = cnt.create; const udrBefore6 = cnt.upd;
      const w6a = await mk('w6a', 3, 'true' as never);
      const w6b2 = await mk('w6b', 3, 1 as never);
      const w6c2 = await mk('w6c', 3, null as never);
      const w6p = await updateListingDetails({ listingId: FA, actorUid: u2, patch: { allowMultiBuy: 'true' as never } });
      ck.t('W6', '**W6**（形状闸 · 零 DB）：`\'true\'` / `1` / 显式 `null`（创建面）与 PATCH 同值 ⇒ 400 `NOT_A_BOOLEAN` + `details.field = \'listing.allow_multi_buy\'` · 写桩调用数双双不增',
        !w6a.ok && !w6b2.ok && !w6c2.ok && !w6p.ok
        && w6a.status === 400 && w6b2.status === 400 && w6c2.status === 400 && w6p.status === 400
        && w6a.details?.reason === 'NOT_A_BOOLEAN' && w6p.details?.reason === 'NOT_A_BOOLEAN'
        && String(w6a.details?.field) === 'listing.allow_multi_buy' && String(w6p.details?.field) === 'listing.allow_multi_buy'
        && cnt.create === crBefore6 && cnt.upd === udrBefore6,
        JSON.stringify({ a: got(w6a as never), p: got(w6p as never), create_calls: cnt.create, upd_calls: cnt.upd }));

      // ---- W8 · PATCH 同 patch 带 stock+true ⇒ 纯预检零 DB（W3 最易漏的一臂）
      const udrBefore8 = cnt.upd;
      const w8 = await updateListingDetails({ listingId: FB, actorUid: u2, patch: { stock: 1, allowMultiBuy: true } });
      ck.t('W8', '**W3·PATCH 纯预检臂**：同 patch 带 `stock: 1` + `allow_multi_buy: true` ⇒ 生效 stock 已在手 ⇒ 400 `MULTI_BUY_NOT_APPLICABLE`，**零 DB**（`updateListingDetailsRow` 调用数不增）',
        !w8.ok && w8.status === 400 && w8.details?.reason === 'MULTI_BUY_NOT_APPLICABLE' && cnt.upd === udrBefore8,
        JSON.stringify({ res: got(w8 as never), upd_calls: cnt.upd, before: udrBefore8 }));

      // ---- W5 · PATCH 未传键 ∧ 改后 stock<=1 ⇒ 归一 false（不 400）
      const w5pre = await mk('w5', 3, true);
      const FC = idOf(w5pre);
      await c.query("UPDATE public.listing SET status = 'listed' WHERE listing_id = $1::bigint", [FC]);
      const w5 = await updateListingDetails({ listingId: FC, actorUid: u2, patch: { stock: 1 } });
      const w5db = await readRow(c, FC);
      ck.t('W5', '**W5**：PATCH **未传**该键、只把 stock 改到 1（行内原 true）⇒ 200（**不 400**），服务端归一落 **false**（编辑是合法动作，降量单向自动关的库面真源）',
        w5.ok === true && w5db?.allow === false && w5db?.stock === 1,
        JSON.stringify({ ok: w5.ok, db: w5db }));

      // ---- W7 · PATCH 只传 true、行内现值 stock=1 ⇒ SQL 守卫臂 400 零写
      const w7pre = await mk('w7', 1, false);
      const FD = idOf(w7pre);
      await c.query("UPDATE public.listing SET status = 'listed' WHERE listing_id = $1::bigint", [FD]);
      const w7 = await updateListingDetails({ listingId: FD, actorUid: u2, patch: { allowMultiBuy: true } });
      const w7db = await readRow(c, FD);
      ck.t('W7', '**W7**（最易漏臂）：只传 `allow_multi_buy: true`、**同一请求不改 stock**、行内现值 = 1 ⇒ 400 `MULTI_BUY_NOT_APPLICABLE`（生效 stock 用行内现值 —— SQL 守卫臂真在场）· **零写**（读回 stock/allow 不变）',
        !w7.ok && w7.status === 400 && w7.details?.reason === 'MULTI_BUY_NOT_APPLICABLE' && String(w7.details?.stock) === '1'
        && w7db?.allow === false && w7db?.stock === 1,
        JSON.stringify({ res: got(w7 as never), db: w7db }));

      r.ids = { FA, FB, FC, FD, FE };

      // ---- M · 购买矩阵（真 `listing_post_event`；B2 零写由 post 计数 + 订单行数双判据）
      const buy = (listingId: number, quantity: string, tag: string) => buyListing({
        actorUid: u1, listingIdRaw: String(listingId),
        body: { quantity, create_key: `${FIXTURE_KEY_PREFIX}${RUN}-${tag}` },
      });
      const balOf = async (uid: number) => Number((await raw1<{ b: string }>(c,
        'SELECT balance::text AS b FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint', [uid, CX]))?.b ?? '0');
      const orderOf = async (key: string) => raw1<{ quantity: number; status: string }>(c,
        'SELECT quantity, status FROM public.listing_order WHERE create_key = $1', [key]);

      // B1 · false ∧ qty=1 ⇒ 200（既有单件链路逐字不变；qty=1 零读库）
      const authBefore1 = cnt.auth;
      const buyBeforeB1 = await balOf(u1);
      const b1 = await buy(FA, '1', 'b1');
      const b1order = await orderOf(`${FIXTURE_KEY_PREFIX}${RUN}-b1`);
      const faAfter1 = await readRow(c, FA);
      const buyAfterB1 = await balOf(u1);
      ck.t('M1', '**B1**（改前行为逐字不变）：`allow=false` ∧ **qty=1** ∧ listed ⇒ **200** 成交（订单 1 行 quantity=1 / 库存 3→2 / 买家 **−100** = price×1）· `getListingBuyAuthRow` **零读**（qty=1 短路 ⇒ 单件链路零额外往返、零行为变化）',
        b1.ok === true && !!b1order && Number(b1order.quantity) === 1 && b1order.status === 'paid'
        && faAfter1?.stock === 2 && buyAfterB1 === buyBeforeB1 - 100 && cnt.auth === authBefore1,
        JSON.stringify({ ok: b1.ok, order: b1order, stock: faAfter1?.stock, buyer: [buyBeforeB1, buyAfterB1], auth_reads: cnt.auth - authBefore1 }));

      // B2 · false ∧ qty=2 ⇒ 400 零写
      const authBefore2 = cnt.auth; const postBefore2 = cnt.post;
      const b2 = await buy(FA, '2', 'b2');
      const b2order = await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.listing_order WHERE create_key = $1', [`${FIXTURE_KEY_PREFIX}${RUN}-b2`]);
      const faAfter2 = await readRow(c, FA);
      ck.t('M2', '**B2**（本单唯一新拒绝臂）：`allow=false` ∧ qty=2 ⇒ **400** `LEDGER_AMOUNT_INVALID` + `{field:\'quantity\', reason:\'multi_buy_not_allowed\', allow_multi_buy:false}` · **零 DB 写**（`listingPostEvent` 调用数 **0** · 该 create_key 订单 **0** 行 · 库存不变）',
        !b2.ok && b2.status === 400 && b2.code === 'LEDGER_AMOUNT_INVALID'
        && b2.details?.reason === 'multi_buy_not_allowed' && String(b2.details?.field) === 'quantity'
        && b2.details?.allow_multi_buy === false
        && cnt.post === postBefore2 && cnt.auth === authBefore2 + 1
        && Number(b2order?.n ?? -1) === 0 && faAfter2?.stock === 2,
        JSON.stringify({ res: got(b2 as never), post_calls: cnt.post - postBefore2, auth_reads: cnt.auth - authBefore2, orders: b2order?.n, stock: faAfter2?.stock }));

      // 闸序 · false ∧ qty>stock ⇒ 400（B2）而非 409 ⇒ allow 先于 stock
      const postBefore5 = cnt.post;
      const m5 = await buy(FA, '4', 'm5');
      ck.t('M5', '**闸序**（写死）：`allow=false` ∧ qty=4 > stock=2（B2 与 B4 同时成立）⇒ 报 **B2（400 multi_buy_not_allowed）** 而非 409 —— `allow` 闸先于 `stock` 闸，且零 DB（post 计数不增）',
        !m5.ok && m5.status === 400 && m5.details?.reason === 'multi_buy_not_allowed' && cnt.post === postBefore5,
        JSON.stringify({ res: got(m5 as never), post_calls: cnt.post - postBefore5 }));

      // B3 · true ∧ qty=2 ∧ stock≥2 ⇒ 200 成交（资金两腿 + 库存递减 + 不回写）
      const buyBefore = await balOf(u1); const sellBefore = await balOf(u2);
      const b3 = await buy(FB, '2', 'b3');
      const b3order = await orderOf(`${FIXTURE_KEY_PREFIX}${RUN}-b3`);
      const fbAfter3 = await readRow(c, FB);
      const buyAfter = await balOf(u1); const sellAfter = await balOf(u2);
      ck.t('M3', '**B3**：`allow=true` ∧ qty=2 ∧ stock=3 ⇒ **200** 成交：订单 quantity=2 · 库存 3→1 · 买家 **−200** / 卖家 **+200**（金额 = price×quantity 服务端取数）· `allow_multi_buy` **保持 true**（购买不回写该列 —— MB-N5）',
        b3.ok === true && !!b3order && Number(b3order.quantity) === 2
        && fbAfter3?.stock === 1 && fbAfter3?.allow === true
        && buyAfter === buyBefore - 200 && sellAfter === sellBefore + 200,
        JSON.stringify({ ok: b3.ok, order: b3order, stock: fbAfter3?.stock, allow: fbAfter3?.allow, buyer: [buyBefore, buyAfter], seller: [sellBefore, sellAfter] }));

      // B4 · true ∧ qty>stock ⇒ 既有 409（SAVEPOINT 三明治包预期失败 ⇒ 事务复活）
      const b4 = await undoAfter(c, () => buy(FB, '3', 'b4'));
      const b4v = (b4.value ?? undefined) as { ok?: boolean; status?: number; code?: string; details?: Record<string, unknown> } | undefined;
      ck.t('M4', '**B4**（既有码不动）：`allow=true` ∧ qty=3 > stock=1 ⇒ **409** `LEDGER_INSUFFICIENT_BALANCE` + `details.reason = \'listing_stock_insufficient\'`（0015 既有库存闸；本单**不新增**「已售罄」语义）· SAVEPOINT 回滚 ⇒ 零残留',
        !!b4v && !b4v.ok && b4v.status === 409 && b4v.code === 'LEDGER_INSUFFICIENT_BALANCE'
        && b4v.details?.reason === 'listing_stock_insufficient' && b4.error === null,
        JSON.stringify({ res: b4v ? got(b4v as never) : null, savepoint_error: b4.error }));

      // B7 · true ∧ stock=1 ∧ qty=1 ⇒ 200（正常终态；读面容忍 true 且 stock=1）
      const b7 = await buy(FB, '1', 'b7');
      const fbAfter7 = await readRow(c, FB);
      ck.t('M6', '**B7**（正常终态）：`allow=true` ∧ 库存卖到剩 1 ∧ qty=1 ⇒ **200**（买到最后 1 件后 `allow_multi_buy` 保持 true，**不回写**；读面容忍 `true ∧ stock=1`）',
        b7.ok === true && fbAfter7?.stock === 0 && fbAfter7?.allow === true,
        JSON.stringify({ ok: b7.ok, db: fbAfter7 }));

      // ---- N · 两臂负控（判据非恒绿）
      // NC1 · 去写口归一：对真源 UPDATE_LISTING_DETAILS_SQL 做手术（W5 CASE → COALESCE 透传）。
      //   专用夹具 FH（行内原 true ∧ stock=3）—— FC 已被 W5 臂归一成 false，不能复用
      const nc1pre = await mk('nc1', 3, true);
      const FH = idOf(nc1pre);
      await c.query("UPDATE public.listing SET status = 'listed' WHERE listing_id = $1::bigint", [FH]);
      const MUT = mutateW5(UPDATE_SQL);
      const mutationReal = MUT !== UPDATE_SQL
        && (UPDATE_SQL.match(W5_SET_RE) ?? []).length === 1 && (UPDATE_SQL.match(W5_CTE_RE) ?? []).length === 1
        && (MUT.match(W5_SET_RE) ?? []).length === 0;
      const w5Params = [FH, u2, null, null, 1, null, null, false, null, false, false, null];
      const nc1 = await undoAfter(c, async () => {
        const run = await raw1<{ outcome: string }>(c, MUT, w5Params);
        const db = await readRow(c, FH);
        return { outcome: run?.outcome ?? null, db };
      });
      const nc1v = (nc1.value ?? undefined) as { outcome: string; db: { stock: number; allow: boolean; status: string } | null } | undefined;
      r.NC1 = { mutation_real: mutationReal, outcome: nc1v?.outcome ?? null, db: nc1v?.db ?? null };
      ck.t('N1', '★ **负控①（去写口归一 ⇒ `true∧stock1` 能写 ⇒ 必红）**：对唯一真源 UPDATE 语句做手术（W5 归一 CASE → `COALESCE($12, 现值)` 透传，$5/$12 参数位不动、手术非空转）后，同参重跑（PATCH stock→1、未传键，行内原 true）⇒ `updated` 且落库 **allow=true ∧ stock=1** —— 归一若被摘除，**W5 判据（必须 false）当场变红**；对照组 = W5 臂（真语句同参 ⇒ false）',
        mutationReal && nc1.error === null && nc1v?.outcome === 'updated'
        && nc1v?.db?.allow === true && nc1v?.db?.stock === 1,
        JSON.stringify(r.NC1));

      // NC2 · 去购买闸：绕开服务层直调真 listing_post_event（qty=2 ∧ allow=false）
      const nc2key = `${FIXTURE_KEY_PREFIX}${RUN}-nc2`;
      const nc2 = await undoAfter(c, async () => {
        const row = await raw1<Record<string, unknown>>(c, 'SELECT public.listing_post_event($1::jsonb) AS r', [JSON.stringify({
          op: 'buy', create_key: nc2key, listing_id: String(FA), buyer_uid: String(u1), quantity: '2',
          request_fingerprint: sha256(`p61-nc2-${RUN}`), memo: `p61-gate nc2 ${RUN}`,
        })]);
        const rr = ((row?.r ?? {}) as Record<string, unknown>);
        const order = await raw1<{ n: number; quantity: number }>(c,
          'SELECT count(*)::int AS n, coalesce(max(quantity),0)::int AS quantity FROM public.listing_order WHERE create_key = $1', [nc2key]);
        const db = await readRow(c, FA);
        return { op: rr.op ?? null, order_id: rr.order_id ?? null, orders: order?.n ?? -1, quantity: order?.quantity ?? -1, db };
      });
      const nc2v = (nc2.value ?? undefined) as { op: string; order_id: string; orders: number; quantity: number; db: { stock: number; allow: boolean } | null } | undefined;
      r.NC2 = { op: nc2v?.op ?? null, orders: nc2v?.orders ?? -1, quantity: nc2v?.quantity ?? -1, stock: nc2v?.db?.stock ?? null, allow: nc2v?.db?.allow ?? null, savepoint_error: nc2.error };
      ck.t('N2', '★ **负控②（去购买闸 ⇒ qty2 能过 ⇒ 必红）**：绕开服务层闸**直调真 `listing_post_event`**（qty=2、`allow=false`、库存足够）⇒ **照常成交**：订单 1 行（quantity=2）、库存递减、资金两腿 —— **DB 层故意不设授权闸（MB-N1/B3 同源裁定）**，`allow=false ∧ qty>1` 的唯一防线就是服务层前置闸 ⇒ 闸一旦被摘，**B2 判据（必须 400 零写）当场变红**；对照组 = M2 臂（同一请求走 `buyListing` ⇒ 400、零调用）',
        nc2.error === null && nc2v?.op === 'buy' && nc2v?.orders === 1 && nc2v?.quantity === 2
        && (nc2v?.db?.allow === false && typeof nc2v?.db?.stock === 'number'),
        JSON.stringify(r.NC2));

      // ---- C · 读口键数（同 tx · 真实读路径）
      const dRec = await DatabaseService.getPrizeDetailRecordingView(FB, ex);
      const dKeys = dRec ? Object.keys(dRec) : [];
      const routeShape = dRec ? Object.keys({ ...(dRec as unknown as Record<string, unknown>), seller: null }).length : 0;
      const mine = await DatabaseService.listListingsBySeller(u2, 0, 100, ex);
      const mineFb = mine.find((x) => x.listing_id === FB);
      const mineBad = mine.filter((x) => Object.keys(x).length !== 14 || !('allow_multi_buy' in x));
      const edit = await DatabaseService.getListingEditRow(FB, ex);
      const editKeys = edit ? Object.keys(edit.row) : [];
      const feed = await DatabaseService.listBrands(0, 60, ex);
      const feedKeys = feed.length ? Object.keys(feed[0]) : [];
      const feedBad = feed.filter((x) => (x as unknown as Record<string, unknown>).allow_multi_buy !== undefined
        || Object.keys(x).length !== 50);
      ck.t('C1', '**详情 52→53**：service 层 **52 键** + 路由合成 `seller` ⇒ **53 键**；`allow_multi_buy` 在场且为**真布尔**（FB 行 = true）',
        dKeys.length === 52 && dKeys.includes('allow_multi_buy') && routeShape === 53
        && (dRec as unknown as Record<string, unknown>).allow_multi_buy === true,
        JSON.stringify({ service_keys: dKeys.length, route_shape: routeShape, allow_true: (dRec as unknown as Record<string, unknown>).allow_multi_buy, is_boolean: typeof (dRec as unknown as Record<string, unknown>).allow_multi_buy === 'boolean' }));
      ck.t('C2', '**mine 13→14**：`listListingsBySeller` 全部行恰 **14 键**且 `allow_multi_buy` 恒在场（含夹具行 = true；存量行 = 库内真值）· 键型真布尔',
        mine.length > 0 && mineBad.length === 0 && !!mineFb && mineFb.allow_multi_buy === true,
        JSON.stringify({ rows: mine.length, bad: mineBad.length, fixture_allow: mineFb?.allow_multi_buy, keys: mineFb ? Object.keys(mineFb).length : -1 }));
      ck.t('C3', '**edit 13→14**（与 mine 键面恒等的派生硬律）：edit 行恰 **14 键**、键名逐字 = mine 同族（`allow_multi_buy` 恒在场）⇒ 编辑页预填不断链',
        editKeys.length === 14 && JSON.stringify([...editKeys].sort()) === JSON.stringify(MINE_14),
        JSON.stringify({ keys: editKeys.length, sorted: [...editKeys].sort() }));
      ck.t('C4', '**feed 50 不变**：`listBrands` 全部行恰 **50 键**、**零行**出现 `allow_multi_buy`（列表卡不参与购买决策）',
        feed.length > 0 && feedBad.length === 0 && feedKeys.length === 50,
        JSON.stringify({ rows: feed.length, bad: feedBad.length, keys: feedKeys.length }));
    } finally {
      Object.assign(svc, orig);
    }
    ck.t('E1', '桩已回收（`getCurrencyStatus` / `createListingRow` / `updateListingDetailsRow` / `getListingBuyAuthRow` / `listingPostEvent` 逐字还原）',
      svc.getCurrencyStatus === orig.getCurrencyStatus && svc.createListingRow === orig.createListingRow
      && svc.updateListingDetailsRow === orig.updateListingDetailsRow
      && svc.getListingBuyAuthRow === orig.getListingBuyAuthRow && svc.listingPostEvent === orig.listingPostEvent,
      'restored');
    return r;
  });

  void cr;
  await pool.end();

  // ====================================================================== F · 零残留
  const pool2 = mkPool(1);
  const residue = await raw1Retry<{ n: number }>(pool2, 'SELECT count(*)::int AS n FROM public.listing WHERE create_key LIKE $1', [`${FIXTURE_KEY_PREFIX}%`]);
  const residueCur = await raw1Retry<{ n: number }>(pool2, 'SELECT count(*)::int AS n FROM public.currency WHERE symbol LIKE $1', [`${SYMBOL_PREFIX}%`]);
  const head = await raw1Retry<{ version: string }>(pool2, 'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1');
  const postCol = await raw1Retry<{ n: number }>(pool2,
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing'");
  await pool2.end();
  out.migration_state = { head: head?.version ?? '', committed_cols: postCol?.n ?? -1 };
  ck.t('F1', '**零残留**：回滚后 `create_key LIKE cli:p61-gate:%` 与 `symbol LIKE p61g%` 命中均 = 0（夹具 / 订单 / 账本分录 / 余额随事务整体回滚）',
    Number(residue?.n ?? -1) === 0 && Number(residueCur?.n ?? -1) === 0,
    `listing_residue=${residue?.n} currency_residue=${residueCur?.n}`);
  ck.t('F2', '**committed 库面未被本门改动**：迁移头仍 = 0061（本门零版本行）· listing 列数 = 18 与开跑一致',
    (head?.version ?? '') === '0061' && Number(postCol?.n ?? -1) === 18,
    JSON.stringify(out.migration_state));

  // ====================================================================== 落盘
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p61-multi-buy-gate', out);
  console.log(JSON.stringify({
    saved: f,
    mode: out.mode,
    env: out.env,
    migration_state: out.migration_state,
    summary: out.summary,
    red: (out.summary as { red: string[] }).red,
  }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  const err = e as { kError?: { message?: string; stack?: string }; message?: string; stack?: string };
  console.error('FATAL', err?.kError?.message ?? err?.message ?? e);
  console.error((err?.kError?.stack ?? err?.stack ?? '').split('\n').slice(0, 8).join('\n'));
  process.exit(2);
});
