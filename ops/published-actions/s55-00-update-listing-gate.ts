/**
 * s55-00 · 发布商品动作后端门（`/profile/trades/published` 行内【编辑】【降价】· 只做后端）
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/published-actions/s55-00-update-listing-gate.ts
 * 读数：`ops/published-actions/readings/s55-update-listing-gate-<RUN>.json`
 *
 * ★ 口径（Kevin 2026-10-20 数据模型指令已并入）：可改字段 = `description / price / stock / media_urls /
 *   item_type`；**`title` 退场**（正文并入 `description`）⇒ body 带 `title` = **400 NOT_SUPPORTED**；
 *   译文重置判据 = **`description` 实际变化**；读口对 `title` 列**无硬依赖**（`to_jsonb` 弱取值）。
 *
 * 判据面：
 *   A · 静态面（**本单零新路由** ⇒ 注册点 = 111（110 + 0059 admin-edit 的编辑预填 GET）/ 本单零迁移 / 零新错误码 / 零 ledger 写 / 读口加性两键 / 无 title 硬依赖）
 *   B · verb 分类闸（`classifyListingPatchBody`：title ⇒ NOT_SUPPORTED、字段支 / 状态支 / 混传 400 / 空体 400）
 *   C · 服务层形状闸（price/stock/description/media_urls/item_type/title；非法形状 **零 DB 调用**）
 *   D · 服务层码映射（403 非本人 / 409 非可编辑态 / 409 库存需 listed / 404 行不存在）
 *   E · 文本变更判据（`text_changed`：只有 `description` **实际**变化才为 true）
 *   F · 真库面（`inRollbackTx` + `ex` 单一真源语句 ⇒ 真 SQL、真触发器、**零残留**）
 *   N · **负控（判负自证）**：把归属闸 / 可编辑态闸**从 SQL 里临时摘掉** ⇒ 对应断言必红（不恒绿）
 *   P · preflight（只读·不 apply：`schema_migration` 顶 = 0054、PENDING 空、listing 列/约束现取）
 *
 * 纪律：**不 apply、不写版本表、不新增迁移、不 DDL**；一切写探针都在 `inRollbackTx` 内 ⇒ ROLLBACK 零残留。
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { checker, inRollbackTx, mkPool, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import {
  updateListingDetails,
  classifyListingPatchBody,
  LISTING_EDIT_FIELDS,
  LISTING_RETIRED_FIELDS,
  MAX_LISTING_MEDIA_ITEMS,
  ITEM_TYPES,
} from '../../backend-ts/src/listing-service';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';
// ★ 0060 两列为 NOT NULL 无默认 ⇒ 本门 listing 夹具 INSERT 必须自带标识两键（p57 N1/N2 同体例）
import { codeFromSnowflake, nextSnowflake } from '../../backend-ts/src/item-id';

type ErrLike = { ok: boolean; status?: number; code?: string; details?: Record<string, unknown> };
const got = (r: ErrLike): string => (r.ok ? 'ok' : `${r.status}/${r.code}/${String(r.details?.reason ?? '')}`);

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const REPO_BACKEND = path.join(REPO_ROOT, 'backend-ts');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const SVC = readSrc('backend-ts/src/listing-service.ts');
const DB = readSrc('backend-ts/src/database.ts');

/** 从 `database.ts` 里取出**单一真源语句**原文（负控要在它上面摘掉闸） */
const SQL_START = 'const UPDATE_LISTING_DETAILS_SQL = `';
const sqlAt = DB.indexOf(SQL_START);
const sqlEnd = sqlAt >= 0 ? DB.indexOf('`;', sqlAt + SQL_START.length) : -1;
const SQL_TEXT = sqlAt >= 0 && sqlEnd > sqlAt ? DB.slice(sqlAt + SQL_START.length, sqlEnd) : '';
// ★ 0059：归属闸扩为 `seller_uid <> $2 AND NOT $11::boolean`（$11 = 管理员放行位；本人/非管理员两臂同族）
const NOT_OWNER_CLAUSE = "cur.seller_uid <> $2::bigint AND NOT $11::boolean THEN 'not_owner'";
const STATUS_CLAUSE = "cur.status NOT IN ('draft', 'listed') THEN 'status_not_editable'";
const STOCK_CLAUSE = "$5::int IS DISTINCT FROM cur.stock AND cur.status <> 'listed' THEN 'stock_requires_listed'";

/**
 * 负控摘闸：**不整行删除**（删掉 `$2` 的唯一出现位置会让 PG 无法定型 ⇒
 * `could not determine data type of parameter $2`，测的就不是闸而是语法）。
 * 改为把谓词中和成 `… AND false` ⇒ **保留参数位与类型**、闸失效，测的正是闸本身。
 */
const dropSqlLine = (sql: string, needle: string): string =>
  sql.split('\n').map((line) => {
    if (!line.includes(needle)) return line;
    const head = needle.slice(0, needle.indexOf(' THEN '));
    const tail = needle.slice(needle.indexOf(' THEN '));
    return line.replace(needle, `${head} AND false${tail}`);
  }).join('\n');

/** `$$` 感知的语句切分（0059 头段含 plpgsql 函数体，体内有 `;` ⇒ 裸 `split(';')` 会切坏） */
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
  return out.filter((s) => s.replace(/--[^\n]*/g, '').trim().length > 0);
};

/** 服务层桩行（= `ListingMineRow` 同族 11 键；P57 · 迁移 0057 加 `item_condition` ⇒ 回执键 `condition`） */
const stubRow = (over: Record<string, unknown> = {}) => ({
  listing_id: 424242,
  title: 'S55 存量标题（退场字段，读口弱取值）',
  price: 1000,
  cid: 1,
  status: 'listed',
  stock: 3,
  media_urls: [] as string[],
  time_created: 0,
  description: 'S55 桩描述',
  item_type: null as string | null,
  item_condition: null as string | null,
  ...over,
});

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/published-actions/s55-00-update-listing-gate.ts' };
  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading).slice(0, 600));
  };

  // ====================================================================== A · 静态面
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('A1', '**本单零新路由**：注册点 = 111 —— 110（0058 面）+ 1 = 0059 admin-edit 的 `GET /api/listing/:listingId/edit`；本单只扩既有 `PATCH /api/listing/:listingId`',
    regs === 111, `registration_points=${regs}`);

  const patchRoutes = INDEX_TS.match(/^app\.patch\('\/api\/listing\/:listingId'/gm) ?? [];
  ck.t('A2', '`PATCH /api/listing/:listingId` **恰 1 个注册点**（未出现 `/item/:id/edit` 之类第二条写路径）',
    patchRoutes.length === 1 && !/app\.patch\('\/item/.test(INDEX_TS), `patch_regs=${patchRoutes.length}`);

  const patchBlockStart = INDEX_TS.indexOf("app.patch('/api/listing/:listingId'");
  const patchBlock = patchBlockStart >= 0 ? INDEX_TS.slice(patchBlockStart, patchBlockStart + 4600) : '';
  ck.t('A3', '路由体：`classifyListingPatchBody` 分支 + 字段支 `updateListingDetails` + **仅 `text_changed` 时**重置翻译 + 状态支原样保留',
    /classifyListingPatchBody\(body\)/.test(patchBlock)
      && /route\.kind === 'invalid'\) return sendVerbError\(res, route\.err\)/.test(patchBlock)
      && /await updateListingDetails\(\{/.test(patchBlock)
      && /if \(result\.text_changed\) await enqueueListingTranslation\(result\.view, true\)/.test(patchBlock)
      && /await transitionListingStatus\(\{/.test(patchBlock),
    `patch_block_bytes=${patchBlock.length}`);

  ck.t('A4', '服务层导出齐备：`updateListingDetails` / `classifyListingPatchBody` / `LISTING_EDIT_FIELDS`（**7 字段，无 title**；0057 批前推 +`item_condition`、0061 批前推 +`allow_multi_buy`，原 5/6 字面量见 git 历史）/ `LISTING_RETIRED_FIELDS=[title]` / media ≤4',
    typeof updateListingDetails === 'function'
      && typeof classifyListingPatchBody === 'function'
      && JSON.stringify([...LISTING_EDIT_FIELDS]) === JSON.stringify(['description', 'price', 'stock', 'media_urls', 'item_type', 'item_condition', 'allow_multi_buy'])
      && JSON.stringify([...LISTING_RETIRED_FIELDS]) === JSON.stringify(['title'])
      && MAX_LISTING_MEDIA_ITEMS === 4,
    JSON.stringify({ fields: LISTING_EDIT_FIELDS, retired: LISTING_RETIRED_FIELDS, media_max: MAX_LISTING_MEDIA_ITEMS }));

  const iNotOwner = SQL_TEXT.indexOf(NOT_OWNER_CLAUSE);
  const iStatus = SQL_TEXT.indexOf(STATUS_CLAUSE);
  const iStock = SQL_TEXT.indexOf(STOCK_CLAUSE);
  ck.t('A5', 'SQL 三道闸在场且**顺序**正确（归属 → 可编辑态 → 库存），带 `FOR UPDATE` 行锁 + `prev_description` 同语句带回',
    SQL_TEXT.length > 0 && iNotOwner > 0 && iStatus > iNotOwner && iStock > iStatus
      && /FOR UPDATE/.test(SQL_TEXT) && /prev_description/.test(SQL_TEXT),
    JSON.stringify({ sql_bytes: SQL_TEXT.length, iNotOwner, iStatus, iStock }));

  ck.t('A6', '「未传字段不动」= 逐列 `COALESCE($n, l.x)`（**4 列**：description/price/stock/media_urls）+ `item_type` 用 `$8::boolean` 开关区分「未传 / 显式 NULL」',
    ['description = COALESCE($3::text, l.description)', 'price       = COALESCE($4::bigint, l.price)',
      'stock       = COALESCE($5::int, l.stock)', 'media_urls  = COALESCE($6::text[], l.media_urls)',
      'item_type   = CASE WHEN $8::boolean THEN $7::text ELSE l.item_type END']
      .every((s) => SQL_TEXT.includes(s)),
    `coalesce_hits=${(SQL_TEXT.match(/COALESCE\(/g) ?? []).length}`);

  // ★ 只截 `SET … FROM guarded` 这一段判 title（RETURNING 里 title 是 split_part 派生值，不算 SET 列）
  const setClause = (SQL_TEXT.match(/SET\s+([\s\S]*?)\bFROM\s+guarded\b/i)?.[1]) ?? '';
  ck.t('A7', '★ **写路径零 `title`**：唯一真源 SQL **不 SET 也不直接 SELECT `title` 列**（RETURNING 的 title = `split_part(description, …)` 派生；title 列已 0056 DROP）⇒ 本语句不 42P01',
    setClause.length > 0 && !/\btitle\b/i.test(setClause)
      && !/,\s*title\s*,/.test(SQL_TEXT)
      && !/pl\.title\b|l\.title\b/.test(SQL_TEXT)
      && /split_part\(l\.description/.test(SQL_TEXT),
    `set_clause_bytes=${setClause.length} set_title=${/\btitle\b/i.test(setClause)} hard_col=${/pl\.title\b|l\.title\b/.test(SQL_TEXT)}`);

  const mineSelect = DB.slice(DB.indexOf('static async listListingsBySeller'), DB.indexOf('static async updateListingDetailsRow'));
  const mineIface = DB.slice(DB.indexOf('export interface ListingMineRow'), DB.indexOf('export interface ListingOrderSoldRow'));
  ck.t('A8', "读口：加性键 `description` / `item_type`（S55，8→10）+ `item_condition`（P57 · 迁移 0057，10→11 ⇒ 回执键 `condition`）；`title` = `split_part` **派生列**（title 列已 0056 DROP，零列引用）",
    /l\.description,/.test(mineSelect) && /l\.item_type/.test(mineSelect) && /l\.item_condition/.test(mineSelect)
      && mineSelect.includes("split_part(l.description, E'\\\\n', 1) AS title")
      && /description: string;/.test(mineIface) && /item_type: string \| null;/.test(mineIface)
      && /condition: string \| null;/.test(mineIface)
      && ['listing_id', 'title', 'price', 'cid', 'status', 'stock', 'media_urls', 'time_created']
        .every((k) => new RegExp(`\\b${k}:`).test(mineIface)),
    `iface_keys=${(mineIface.match(/^\s{2}\w+:/gm) ?? []).length}`);

  const ledgerImports = (SVC.match(/from '\.\/ledger'/g) ?? []).length;
  ck.t('A9', '**零 ledger 写**：`listing-service.ts` 不 import `./ledger`；新段无 `ledger_post_event` / 无 `create_key` 派生（改价不涉资金、无分录、无幂等键）',
    ledgerImports === 0
      && !/ledger_post_event/.test(SVC)
      && !/resolveListingCreateKey/.test(SVC.slice(SVC.indexOf('export const updateListingDetails'))),
    `ledger_imports=${ledgerImports}`);

  const newFn = SVC.slice(SVC.indexOf('export const updateListingDetails'));
  const usedCodes = Array.from(new Set(newFn.match(/'(LEDGER_[A-Z_]+|AUTH_[A-Z_]+)'/g) ?? [])).map((s) => s.slice(1, -1));
  const unknownCodes = usedCodes.filter((c) => c !== 'AUTH_FORBIDDEN' && !(LEDGER_ERROR_CODES as string[]).includes(c));
  ck.t('A10', `**零新错误码**：新函数只借既有码（${usedCodes.join(' / ')}），33 码闭集不动`,
    LEDGER_ERROR_CODES.length === 33 && unknownCodes.length === 0,
    `codes=${JSON.stringify(usedCodes)} unknown=${JSON.stringify(unknownCodes)} close_set=${LEDGER_ERROR_CODES.length}`);

  const migFiles = fs.readdirSync(path.join(REPO_BACKEND, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  const maxMig = (migFiles[migFiles.length - 1].match(/^(\d+)/) ?? [, ''])[1];
  let migGit = 'ERR';
  try {
    migGit = execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain', '--', 'backend-ts/migrations'], { encoding: 'utf8' }).trim();
  } catch (e) {
    migGit = `GIT_ERR:${String((e as Error).message).slice(0, 60)}`;
  }
  const migGitLines = migGit.split('\n').map((l) => l.trim()).filter(Boolean);
  ck.t('A11', `**本单零迁移 / 零 DDL**：迁移文件链顶 = ${maxMig}（同树多单并进：0059 admin-edit → 0060 商品统一 Id → 0061 多件购买授权列）· 本单不新增/不改任何迁移文件 ⇒ migrations/ 的 git 变更全部为 \`??\` 未跟踪新文件（零 M / 零 D）`,
    maxMig === '0061'
      && migGitLines.length >= 1
      && migGitLines.every((l) => l.startsWith('?? backend-ts/migrations/')),
    `max=${maxMig} files=${migFiles.length} git=${JSON.stringify(migGitLines)}`);

  // ======================================================== B · verb 分类闸（纯函数）
  const cls: Array<{ id: string; body: Record<string, unknown>; expect: string; field?: string }> = [
    { id: 'B1', body: { to_status: 'delisted' }, expect: 'status' },
    { id: 'B2', body: { status: 'listed' }, expect: 'status' },
    { id: 'B3', body: { price: 999 }, expect: 'fields' },
    { id: 'B4', body: { description: 'y' }, expect: 'fields' },
    { id: 'B5', body: { item_type: null }, expect: 'fields' },
    { id: 'B6', body: { media_urls: [] }, expect: 'fields' },
    { id: 'B7', body: {}, expect: 'invalid:NO_EDITABLE_FIELD', field: 'listing' },
    { id: 'B8', body: { description: undefined, price: undefined }, expect: 'invalid:NO_EDITABLE_FIELD', field: 'listing' },
    { id: 'B9', body: { price: 1, to_status: 'delisted' }, expect: 'invalid:STATUS_AND_FIELDS_EXCLUSIVE', field: 'listing' },
    { id: 'B10', body: { status: 'delisted', description: 'x' }, expect: 'invalid:STATUS_AND_FIELDS_EXCLUSIVE', field: 'listing' },
    { id: 'B11', body: { status: 'frozen', item_type: 'PhysicalFreeShip' }, expect: 'invalid:STATUS_AND_FIELDS_EXCLUSIVE', field: 'listing' },
    { id: 'B12', body: { unknown_key: 1 }, expect: 'invalid:NO_EDITABLE_FIELD', field: 'listing' },
    { id: 'B13', body: { title: '任意标题' }, expect: 'invalid:NOT_SUPPORTED', field: 'listing.title' },
    { id: 'B14', body: { title: '', price: 5 }, expect: 'invalid:NOT_SUPPORTED', field: 'listing.title' },
    { id: 'B15', body: { title: 'x', to_status: 'delisted' }, expect: 'invalid:NOT_SUPPORTED', field: 'listing.title' },
  ];
  for (const c of cls) {
    const r = classifyListingPatchBody(c.body);
    const g = r.kind === 'invalid' ? `invalid:${String(r.err.details.reason)}` : r.kind;
    const okShape = r.kind === 'invalid'
      ? r.err.status === 400 && r.err.code === 'LEDGER_AMOUNT_INVALID' && (c.field ? r.err.details.field === c.field : true)
      : true;
    u(c.id, `分类 \`${JSON.stringify(c.body)}\` ⇒ ${c.expect}（400 形状 = LEDGER_AMOUNT_INVALID + field=${c.field ?? '—'}）`,
      g === c.expect && okShape, g);
  }
  u('B16', '混传 400 的 details 两侧键**都列出**（status_keys / field_keys ⇒ 前端可定位）',
    (() => {
      const r = classifyListingPatchBody({ to_status: 'delisted', price: 1, description: 'x' });
      return r.kind === 'invalid'
        && JSON.stringify(r.err.details.status_keys) === JSON.stringify(['to_status'])
        && JSON.stringify(r.err.details.field_keys) === JSON.stringify(['description', 'price']);
    })(), 'status_keys/field_keys');
  u('B17', 'title 400 的 details 带 `retired_fields` + `editable_fields`（可机读的改法指引），且 `title` **不在** editable_fields',
    (() => {
      const r = classifyListingPatchBody({ title: 'x' });
      return r.kind === 'invalid'
        && JSON.stringify(r.err.details.retired_fields) === JSON.stringify(['title'])
        && JSON.stringify(r.err.details.editable_fields) === JSON.stringify([...LISTING_EDIT_FIELDS])
        && !(r.err.details.editable_fields as string[]).includes('title');
    })(), 'retired/editable');

  // ================================================ C/D/E · 服务层（桩 DB · 零真写）
  const svc = DatabaseService as unknown as Record<string, unknown>;
  const origRowMethod = svc.updateListingDetailsRow;
  let dbCalls = 0;
  let lastInput: Record<string, unknown> | null = null;
  const defaultOutcome = () => ({ outcome: 'updated', row: stubRow(), prev: { description: 'S55 桩描述' } });
  let nextOutcome: Record<string, unknown> = defaultOutcome();
  svc.updateListingDetailsRow = async (input: Record<string, unknown>) => {
    dbCalls += 1;
    lastInput = input;
    return nextOutcome;
  };
  const call = (patch: Record<string, unknown>, listingId = 424242, actorUid = 900055) =>
    updateListingDetails({ listingId, actorUid, patch });

  try {
    // ---- C · 形状闸（全部 400 且**零 DB 调用**）
    const shapeCases: Array<{ id: string; what: string; patch: Record<string, unknown>; code: string; field: string; reason?: string }> = [
      { id: 'C1', what: 'price = 0', patch: { price: 0 }, code: 'LEDGER_AMOUNT_NOT_POSITIVE', field: 'listing.price' },
      { id: 'C2', what: 'price = -1', patch: { price: -1 }, code: 'LEDGER_AMOUNT_NOT_POSITIVE', field: 'listing.price' },
      { id: 'C3', what: "price = 'abc'", patch: { price: 'abc' }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.price', reason: 'NOT_AN_INTEGER' },
      { id: 'C4', what: 'price = 2^53（超 JS 安全整数 = 有效上限）', patch: { price: 2 ** 53 }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.price', reason: 'OUT_OF_RANGE' },
      { id: 'C5', what: 'stock = -1', patch: { stock: -1 }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.stock', reason: 'NEGATIVE_OR_NON_INTEGER' },
      { id: 'C6', what: 'stock = 1.5', patch: { stock: 1.5 }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.stock', reason: 'NOT_AN_INTEGER' },
      { id: 'C7', what: 'description = 123（非字符串）', patch: { description: 123 }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.description', reason: 'NOT_A_STRING' },
      { id: 'C8', what: 'item_type = 裸 Digital（退役值）', patch: { itemType: 'Digital' }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.item_type', reason: 'NOT_IN_CLOSED_SET' },
      { id: 'C9', what: 'item_type = Bogus', patch: { itemType: 'Bogus' }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.item_type', reason: 'NOT_IN_CLOSED_SET' },
      { id: 'C10', what: 'item_type = 空串', patch: { itemType: '' }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.item_type', reason: 'NOT_IN_CLOSED_SET' },
      { id: 'C11', what: 'media_urls = 5 张（超 4）', patch: { mediaUrls: ['/api/media/1', '/api/media/2', '/api/media/3', '/api/media/4', '/api/media/5'] }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.media_urls', reason: 'TOO_MANY_ITEMS' },
      { id: 'C12', what: 'media_urls 含非 /api/media 形态', patch: { mediaUrls: ['/api/media/1', 'http://evil/x.png'] }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.media_urls', reason: 'INVALID_MEDIA_URL' },
      { id: 'C13', what: 'media_urls 非数组', patch: { mediaUrls: 'nope' }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.media_urls', reason: 'NOT_A_STRING_ARRAY' },
      { id: 'C14', what: '空 patch（无任何字段）', patch: {}, code: 'LEDGER_AMOUNT_INVALID', field: 'listing', reason: 'NO_EDITABLE_FIELD' },
      { id: 'C15', what: '全部字段 undefined（= 未传）', patch: { description: undefined, price: undefined, itemType: undefined }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing', reason: 'NO_EDITABLE_FIELD' },
      { id: 'C16', what: '**title（退场字段）** ⇒ 400 NOT_SUPPORTED', patch: { title: '改标题' }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.title', reason: 'NOT_SUPPORTED' },
      { id: 'C17', what: 'title（退场字段）+ 合法 price ⇒ 仍 400 NOT_SUPPORTED（不半执行）', patch: { title: 'x', price: 9 }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing.title', reason: 'NOT_SUPPORTED' },
      { id: 'C18', what: 'title = null ⇒ 视为未传 ⇒ NO_EDITABLE_FIELD（不含 title 支）', patch: { title: null }, code: 'LEDGER_AMOUNT_INVALID', field: 'listing', reason: 'NO_EDITABLE_FIELD' },
    ];
    for (const c of shapeCases) {
      dbCalls = 0;
      const r = await call(c.patch);
      const g = got(r as ErrLike);
      u(c.id, `${c.what} ⇒ 400 ${c.code}${c.reason ? ` / ${c.reason}` : ''} + field=${c.field} + **DB 调用 0 次**`,
        !r.ok && r.status === 400 && r.code === c.code && r.details.field === c.field
          && (c.reason === undefined || String(r.details.reason) === c.reason)
          && dbCalls === 0,
        `${g} dbCalls=${dbCalls}`);
    }

    // ---- C19+ · 合法形状透传到 DB 入参（未传 = null / itemTypeSet 开关 / 描述不 trim）
    const pass: Array<{ id: string; what: string; patch: Record<string, unknown>; check: () => boolean }> = [
      {
        id: 'C19', what: '合法改价 `price=999` ⇒ 200，写入口收到 `price=999`、其余一律 **null（不动）**、`itemTypeSet=false`',
        patch: { price: 999 },
        check: () => (lastInput?.price === 999 && lastInput?.description === null && lastInput?.stock === null
          && lastInput?.mediaUrls === null && lastInput?.itemTypeSet === false),
      },
      {
        id: 'C20', what: "`description` **不 trim**（保留作者排版）且允许 `''`（清空描述）",
        patch: { description: '  多行\n排版  ' },
        check: () => lastInput?.description === '  多行\n排版  ',
      },
      {
        id: 'C21', what: '`description = ""` ⇒ 透传空串（清空），非「不动」',
        patch: { description: '' },
        check: () => lastInput?.description === '',
      },
      {
        id: 'C22', what: '`item_type = null`（显式）⇒ `itemTypeSet=true` 且 `itemType=null`（置未分类，区别于「未传不动」）',
        patch: { itemType: null },
        check: () => lastInput?.itemTypeSet === true && lastInput?.itemType === null,
      },
      {
        id: 'C23', what: `\`item_type='${ITEM_TYPES[0]}'\` ⇒ 200 且原值透传（不派生、不归一）`,
        patch: { itemType: ITEM_TYPES[0] },
        check: () => lastInput?.itemType === ITEM_TYPES[0] && lastInput?.itemTypeSet === true,
      },
      {
        id: 'C24', what: '`media_urls` 合法两图 ⇒ 200 且元素 **trim**、`[]` = 清空',
        patch: { mediaUrls: [' /api/media/7 ', '/api/media/8'] },
        check: () => JSON.stringify(lastInput?.mediaUrls) === JSON.stringify(['/api/media/7', '/api/media/8']),
      },
    ];
    for (const p of pass) {
      dbCalls = 0; lastInput = null;
      const r = await call(p.patch);
      u(p.id, p.what, r.ok && dbCalls === 1 && p.check(), r.ok ? JSON.stringify(lastInput) : got(r as ErrLike));
    }

    // ---- D · 码映射
    const mapping: Array<{ id: string; what: string; outcome: Record<string, unknown>; expect: (r: any) => boolean; reading: (r: any) => unknown }> = [
      {
        id: 'D1', what: '**非本人** ⇒ 403 AUTH_FORBIDDEN / reason=ACTOR_NOT_ALLOWED（+ authDomain）',
        outcome: { outcome: 'not_owner', row: stubRow(), prev: null },
        expect: (r) => !r.ok && r.status === 403 && r.code === 'AUTH_FORBIDDEN'
          && r.details.reason === 'ACTOR_NOT_ALLOWED' && r.details.ref_type === 'listing'
          && (r as { authDomain?: boolean }).authDomain === true,
        reading: (r) => (r.ok ? 'ok' : { status: r.status, code: r.code, reason: r.details.reason }),
      },
      {
        id: 'D2', what: '**delisted（终态）** ⇒ 409 LEDGER_CURRENCY_INVALID_TRANSITION / reason=LISTING_STATE_INVALID（details.status=delisted）',
        outcome: { outcome: 'status_not_editable', row: stubRow({ status: 'delisted' }), prev: null },
        expect: (r) => !r.ok && r.status === 409 && r.code === 'LEDGER_CURRENCY_INVALID_TRANSITION'
          && r.details.reason === 'LISTING_STATE_INVALID' && r.details.status === 'delisted'
          && JSON.stringify(r.details.editable_statuses) === JSON.stringify(['draft', 'listed']),
        reading: (r) => (r.ok ? 'ok' : { status: r.status, reason: r.details.reason, s: r.details.status }),
      },
      {
        id: 'D3', what: '**frozen（冻结）** ⇒ 同 409 LISTING_STATE_INVALID（只读面覆盖 delisted + frozen）',
        outcome: { outcome: 'status_not_editable', row: stubRow({ status: 'frozen' }), prev: null },
        expect: (r) => !r.ok && r.status === 409 && r.details.reason === 'LISTING_STATE_INVALID' && r.details.status === 'frozen',
        reading: (r) => (r.ok ? 'ok' : { status: r.status, reason: r.details.reason, s: r.details.status }),
      },
      {
        id: 'D4', what: '库存变更但非 listed ⇒ 409 reason=`listing_stock_change_requires_listed`（DL60 同码）',
        outcome: { outcome: 'stock_requires_listed', row: stubRow({ status: 'draft' }), prev: null },
        expect: (r) => !r.ok && r.status === 409 && r.details.reason === 'listing_stock_change_requires_listed' && r.details.status === 'draft',
        reading: (r) => (r.ok ? 'ok' : { status: r.status, reason: r.details.reason }),
      },
      {
        id: 'D5', what: '行不存在 ⇒ 404 LEDGER_REF_NOT_FOUND + ref_type=listing（沿用既有码，非新码）',
        outcome: { outcome: 'updated', row: null, prev: null },
        expect: (r) => !r.ok && r.status === 404 && r.code === 'LEDGER_REF_NOT_FOUND'
          && r.details.ref_type === 'listing' && r.details.ref_id === '424242',
        reading: (r) => (r.ok ? 'ok' : { status: r.status, code: r.code, ref: r.details.ref_id }),
      },
    ];
    for (const m of mapping) {
      nextOutcome = m.outcome;
      const r = await call({ price: 999 });
      u(m.id, m.what, m.expect(r), m.reading(r));
    }
    nextOutcome = defaultOutcome();

    // ---- E · text_changed 判据（只认 description）
    const tc: Array<{ id: string; what: string; patch: Record<string, unknown>; prev: string; expect: boolean }> = [
      { id: 'E1', what: '只改价 ⇒ `text_changed=false`（**不重置翻译**）', patch: { price: 999 }, prev: 'D', expect: false },
      { id: 'E2', what: 'description 与库内**相同** ⇒ false（避免无谓重译）', patch: { description: 'D' }, prev: 'D', expect: false },
      { id: 'E3', what: 'description 实际变化 ⇒ true（重置回 pending）', patch: { description: 'D2' }, prev: 'D', expect: true },
      { id: 'E4', what: "description 清空为 ''（原非空）⇒ true", patch: { description: '' }, prev: 'D', expect: true },
      { id: 'E5', what: 'price+stock+mediaUrls 变更但未传 description ⇒ false', patch: { price: 5, stock: 2, mediaUrls: [] }, prev: 'D', expect: false },
      { id: 'E6', what: 'item_type 变更 ⇒ false（分类不进译文源）', patch: { itemType: 'PhysicalFreeShip' }, prev: 'D', expect: false },
    ];
    for (const t of tc) {
      nextOutcome = { outcome: 'updated', row: stubRow(), prev: { description: t.prev } };
      const r = await call(t.patch);
      u(t.id, t.what, r.ok && r.text_changed === t.expect, r.ok ? `text_changed=${r.text_changed}` : got(r as ErrLike));
    }
    nextOutcome = defaultOutcome();

    // ---- E7 · 回执形状 = 读口同族（11 键，无内嵌旁路键）
    const stubKeys = Object.keys(stubRow());
    const okView = await call({ price: 999 });
    u('E7', '回执 `view` 键集与 `GET /api/listing/mine` 行**同族 11 键**（P57 +condition），且 `text_changed` **不在 view 内**（旁路键，不下发）',
      okView.ok && JSON.stringify(Object.keys(okView.view).sort()) === JSON.stringify([...stubKeys].sort())
        && !('text_changed' in okView.view),
      okView.ok ? JSON.stringify(Object.keys(okView.view)) : got(okView as ErrLike));
  } finally {
    svc.updateListingDetailsRow = origRowMethod;
  }
  ck.t('C0', '桩已回收（`updateListingDetailsRow` 逐字还原）',
    (DatabaseService as unknown as Record<string, unknown>).updateListingDetailsRow === origRowMethod, 'restored');

  // ================================================== F · 真库面（rollback ⇒ 零残留）
  const live: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const probe = await inRollbackTx(pool, async (c) => {
      const r: Record<string, unknown> = {};
      // ★ 0059：写口语句现含 `listing_edit_log` 的 `ins` CTE（表不存在 ⇒ **任何** UPDATE 都 42P01，
      //   与 $11 真假无关）⇒ 迁移未 apply 时在本事务内按 0059 头段 DDL 建表（ROLLBACK ⇒ 零残留）；
      //   已 apply 的库走已建表（本分支自然跳过）。
      const pre59 = await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='listing_edit_log'");
      r.edit_log_pre_existing = Number(pre59?.n ?? 0) === 1;
      if (!r.edit_log_pre_existing) {
        const mig59 = fs.readFileSync(path.join(REPO_BACKEND, 'migrations/0059_listing_edit_log.sql'), 'utf8');
        const head = mig59.slice(0, mig59.indexOf('\nDO $$'));
        for (const st of splitSqlStatements(head)) await c.query(st);
      }
      const svcLive = DatabaseService as unknown as Record<string, unknown>;
      const origLive = svcLive.updateListingDetailsRow as (...args: unknown[]) => Promise<unknown>;
      // ex 绑定：服务层调用走**本事务客户端** ⇒ 真 SQL / 真触发器 / 事务末 ROLLBACK 零残留
      svcLive.updateListingDetailsRow = (input: Record<string, unknown>) => origLive(input, c);
      try {
        const draft = await raw1<Record<string, unknown>>(c,
          "SELECT listing_id, seller_uid::text AS seller_uid, price::text AS price, stock, (to_jsonb(l)->>'title') AS title, description, media_urls, item_type, status FROM public.listing AS l WHERE status = 'draft' ORDER BY listing_id LIMIT 1");
        const listed = await raw1<Record<string, unknown>>(c,
          "SELECT listing_id, seller_uid::text AS seller_uid, price::text AS price, stock, description FROM public.listing WHERE status = 'listed' ORDER BY listing_id LIMIT 1");
        const delisted = await raw1<Record<string, unknown>>(c,
          "SELECT listing_id, seller_uid::text AS seller_uid, price::text AS price, (to_jsonb(l)->>'title') AS title FROM public.listing AS l WHERE status = 'delisted' ORDER BY listing_id LIMIT 1");
        r.fixtures = { draft, listed, delisted };
        if (!draft || !listed || !delisted) throw new Error('fixture missing (draft/listed/delisted)');

        const draftId = Number(draft.listing_id);
        const owner = Number(draft.seller_uid);
        const stranger = 900055;
        const readBack = async (id: number) => raw1<Record<string, unknown>>(c,
          'SELECT price::text AS price, stock, description, media_urls, item_type, (to_jsonb(l)->>\'title\') AS title FROM public.listing AS l WHERE listing_id = $1::bigint', [id]);

        // F1 · 合法改价 200 且**库内值变**
        const beforePrice = Number(draft.price);
        const newPrice = beforePrice + 137;
        const f1 = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { price: newPrice } });
        const after1 = await readBack(draftId);
        ck.t('F1', `**合法改价 ⇒ 200 且库内值变**（listing ${draftId}：price ${beforePrice} → ${newPrice}，库内现取 = ${after1?.price}）`,
          f1.ok && Number(after1?.price) === newPrice,
          JSON.stringify({ before: beforePrice, want: newPrice, db: after1?.price }));

        // F2 · 未传字段不变
        ck.t('F2', '**未传字段不动**：只改 price 后 stock/description/media_urls/item_type 与 `title` 六项逐字未变',
          Number(after1?.stock) === Number(draft.stock)
            && String(after1?.description) === String(draft.description)
            && JSON.stringify(after1?.media_urls ?? []) === JSON.stringify(draft.media_urls ?? [])
            && (after1?.item_type ?? null) === (draft.item_type ?? null)
            && String(after1?.title ?? '') === String(draft.title ?? ''),
          JSON.stringify({ stock: after1?.stock, item_type: after1?.item_type, title_unchanged: String(after1?.title ?? '') === String(draft.title ?? '') }));

        // F3 · 【降价】路径（只改价）+ text_changed=false
        const cheaper = newPrice - 7;
        const f3 = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { price: cheaper } });
        const after3 = await readBack(draftId);
        ck.t('F3', `【降价】路径（弹窗只改价）：${newPrice} → ${cheaper} ⇒ 200、库内 = ${after3?.price}、\`text_changed=false\`（不重置翻译）`,
          f3.ok && Number(after3?.price) === cheaper && f3.text_changed === false,
          f3.ok ? `text_changed=${f3.text_changed}` : got(f3 as ErrLike));

        // F4 · description 实际变化 ⇒ text_changed=true 且库内变更
        const f4 = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { description: 'S55 门·改描述（正文并入 description）' } });
        const after4 = await readBack(draftId);
        ck.t('F4', 'description 实际变化 ⇒ 200、`text_changed=true`（调用方据此重置翻译回 pending）、库内该列已变',
          f4.ok && f4.text_changed === true && after4?.description === 'S55 门·改描述（正文并入 description）',
          f4.ok ? JSON.stringify({ text_changed: f4.text_changed, description: after4?.description }) : got(f4 as ErrLike));

        // F5 · 非本人 ⇒ 403（库内 price 未变）
        const f5 = await updateListingDetails({ listingId: draftId, actorUid: stranger, patch: { price: 1 } });
        const after5 = await readBack(draftId);
        ck.t('F5', '**非本人 ⇒ 403** ACTOR_NOT_ALLOWED 且库内 price **未被改写**（归属闸在 SQL 内 ⇒ 零副作用）',
          !f5.ok && f5.status === 403 && f5.code === 'AUTH_FORBIDDEN' && f5.details.reason === 'ACTOR_NOT_ALLOWED'
            && Number(after5?.price) === cheaper,
          f5.ok ? 'ok?' : JSON.stringify({ status: f5.status, reason: f5.details.reason, db_price: after5?.price }));

        // F6 · delisted ⇒ 409（零副作用）
        const f6 = await updateListingDetails({ listingId: Number(delisted.listing_id), actorUid: Number(delisted.seller_uid), patch: { price: 5 } });
        const after6 = await readBack(Number(delisted.listing_id));
        ck.t('F6', `**delisted 终态 ⇒ 409** LISTING_STATE_INVALID（listing ${delisted.listing_id}；库内 price 仍 ${after6?.price}，未被改写）`,
          !f6.ok && f6.status === 409 && f6.code === 'LEDGER_CURRENCY_INVALID_TRANSITION'
            && f6.details.reason === 'LISTING_STATE_INVALID' && f6.details.status === 'delisted'
            && Number(after6?.price) === Number(delisted.price),
          f6.ok ? 'ok?' : JSON.stringify({ status: f6.status, code: f6.code, reason: f6.details.reason }));

        // F7 · frozen ⇒ 409（INSERT 夹具；BEFORE UPDATE 触发器不拦 INSERT；事务末 ROLLBACK）
        const sfFrozen = nextSnowflake();
        const frozenRow = await raw1<Record<string, unknown>>(c, `
          -- ★ title 列已于迁移 0056 DROP ⇒ 夹具不再写该列（标题 = split_part(description, …) 派生）
          -- ★ 0060 两列为 NOT NULL 无默认 ⇒ 夹具自带全新标识两键（UNIQUE ⇒ 不可复制源行值）
          INSERT INTO public.listing (seller_uid, cid, price, stock, description, media_urls, item_type, status, create_key, snowflake_id, item_code)
          SELECT seller_uid, cid, 1000, 1, 'S55 门夹具 frozen', '{}'::text[], NULL, 'frozen', $1::text, $3::bigint, $4::char(7)
          FROM public.listing WHERE listing_id = $2::bigint
          RETURNING listing_id, seller_uid::text AS seller_uid`, [`cli:s55:gate:${RUN}:frozen`, draftId, sfFrozen.toString(), codeFromSnowflake(sfFrozen)]);
        const f7 = frozenRow
          ? await updateListingDetails({ listingId: Number(frozenRow.listing_id), actorUid: Number(frozenRow.seller_uid), patch: { price: 5 } })
          : null;
        ck.t('F7', '**frozen（冻结）⇒ 409** LISTING_STATE_INVALID（新增夹具行，事务末 ROLLBACK 消失）',
          !!f7 && !f7.ok && f7.status === 409 && f7.details.reason === 'LISTING_STATE_INVALID' && f7.details.status === 'frozen',
          f7 ? (f7.ok ? 'ok?' : JSON.stringify({ status: f7.status, reason: f7.details.reason })) : 'INSERT_FAIL');

        // F8 · 库存：listed 生效 / draft 拒
        const targetStock = Number(listed.stock) + 3;
        const f8a = await updateListingDetails({ listingId: Number(listed.listing_id), actorUid: Number(listed.seller_uid), patch: { stock: targetStock } });
        const after8 = await readBack(Number(listed.listing_id));
        const f8b = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { stock: Number(draft.stock) + 1 } });
        const after8b = await readBack(draftId);
        ck.t('F8', `库存：**listed 生效**（${listed.stock} → ${targetStock}，库内 = ${after8?.stock}）· **draft 拒 409** \`listing_stock_change_requires_listed\`（库内仍 = ${after8b?.stock}，DL60 触发器口径未动）`,
          f8a.ok && Number(after8?.stock) === targetStock
            && !f8b.ok && f8b.status === 409 && f8b.details.reason === 'listing_stock_change_requires_listed'
            && Number(after8b?.stock) === Number(draft.stock),
          JSON.stringify({ listed: after8?.stock, draft: f8b.ok ? 'ok?' : f8b.details.reason }));

        // F9 · item_type：显式置 NULL / 四值写入 / 未传不动
        await raw(c, "UPDATE public.listing SET item_type = 'PhysicalFreeShip' WHERE listing_id = $1::bigint", [draftId]);
        const f9a = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { itemType: null } });
        const a9a = await readBack(draftId);
        const f9b = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { itemType: 'DigitalManualDeliver' } });
        const a9b = await readBack(draftId);
        const f9c = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { price: 11 } });
        const a9c = await readBack(draftId);
        ck.t('F9', `item_type：显式 null ⇒ 库内 NULL（${a9a?.item_type}）· 四值写入 ⇒ ${a9b?.item_type} · **未传时不动** ⇒ 仍 ${a9c?.item_type}`,
          f9a.ok && a9a?.item_type === null && f9b.ok && a9b?.item_type === 'DigitalManualDeliver'
            && f9c.ok && a9c?.item_type === 'DigitalManualDeliver',
          JSON.stringify({ null_set: a9a?.item_type, four: a9b?.item_type, untouched: a9c?.item_type }));

        // F10 · media_urls 覆盖 / 清空
        const f10a = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { mediaUrls: ['/api/media/11', '/api/media/12'] } });
        const a10a = await readBack(draftId);
        const f10b = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { mediaUrls: [] } });
        const a10b = await readBack(draftId);
        ck.t('F10', `media_urls：两图覆盖 ⇒ ${JSON.stringify(a10a?.media_urls)}；\`[]\` ⇒ 清空 ${JSON.stringify(a10b?.media_urls)}`,
          f10a.ok && JSON.stringify(a10a?.media_urls) === JSON.stringify(['/api/media/11', '/api/media/12'])
            && f10b.ok && JSON.stringify(a10b?.media_urls) === JSON.stringify([]),
          JSON.stringify({ a: a10a?.media_urls, b: a10b?.media_urls }));

        // F11 · 行不存在 ⇒ 404
        const f11 = await updateListingDetails({ listingId: 999999999, actorUid: owner, patch: { price: 5 } });
        ck.t('F11', '不存在的 listing ⇒ **404** LEDGER_REF_NOT_FOUND（ref_type=listing）',
          !f11.ok && f11.status === 404 && f11.code === 'LEDGER_REF_NOT_FOUND' && f11.details.ref_type === 'listing',
          f11.ok ? 'ok?' : JSON.stringify({ status: f11.status, code: f11.code }));

        // F12 · 回执 view 与读口同族（真库）+ ★ title 400 且库内 title 未变
        const viewKeys = f9c.ok ? Object.keys(f9c.view).sort() : [];
        const mineRows = await DatabaseService.listListingsBySeller(owner, 0, 1);
        const mineKeys = mineRows.length ? Object.keys(mineRows[0]).sort() : [];
        const f12 = await updateListingDetails({ listingId: draftId, actorUid: owner, patch: { title: '不该被写进去的标题', price: 12 } });
        const a12 = await readBack(draftId);
        ck.t('F12', '读口行键 **11 → 14**（S55 description/item_type + P57 condition + 0060 item_code/snowflake_id + 0061 allow_multi_buy）且与编辑回执 `view` **逐键同集**；★ `title` ⇒ 400 且库内 title/price **零改动**',
          mineKeys.length === 14
            && JSON.stringify(mineKeys) === JSON.stringify(['allow_multi_buy', 'cid', 'condition', 'description', 'item_code', 'item_type', 'listing_id', 'media_urls', 'price', 'snowflake_id', 'status', 'stock', 'time_created', 'title'])
            && JSON.stringify(viewKeys) === JSON.stringify(mineKeys)
            && !f12.ok && f12.status === 400 && f12.details.reason === 'NOT_SUPPORTED'
            && Number(a12?.price) === 11 && String(a12?.title ?? '') === String(draft.title ?? ''),
          JSON.stringify({ mine_keys: mineKeys, view_keys: viewKeys, title_res: f12.ok ? 'ok?' : `${f12.status}/${f12.details.reason}`, price_after: a12?.price }));

        // N · 负控（把闸从 SQL 里摘掉 ⇒ 对应断言必红）
        const runSql = async (sql: string, params: unknown[]) => raw1<Record<string, unknown>>(c, sql, params);
        // ★ P57：UPDATE_LISTING_DETAILS_SQL 参数位 8 → 10（$9 item_condition · $10 item_condition_set）
        // ★ 0059：参数位 10 → 11（$11 admin_edit 管理员放行位；本门一律 false ⇒ 归属闸行为与 0058 逐字相同）
        // ★ 0061：参数位 11 → 12（$12 allow_multi_buy；null = 未传 ⇒ 语句走 W5 归一）
        const strangerParams = [draftId, stranger, null, null, null, null, null, false, null, false, false, null];
        const negOwnerReal = await runSql(SQL_TEXT, strangerParams);
        const negNoOwner = await runSql(dropSqlLine(SQL_TEXT, NOT_OWNER_CLAUSE), strangerParams);
        r.N1 = { real: negOwnerReal?.outcome, mutated: negNoOwner?.outcome };
        ck.t('N1', '★ **负控 1**：把归属闸（`seller_uid <> $2 ⇒ not_owner`）从 SQL 摘掉 ⇒ 非本人得 `updated`（不是 `not_owner`）⇒ **F5/D1 断言必红**（归属判据非恒绿）',
          negOwnerReal?.outcome === 'not_owner' && negNoOwner?.outcome === 'updated', JSON.stringify(r.N1));

        const delistedParams = [Number(delisted.listing_id), Number(delisted.seller_uid), null, 5, null, null, null, false, null, false, false, null];
        const negStatusReal = await runSql(SQL_TEXT, delistedParams);
        const negNoStatus = await runSql(dropSqlLine(SQL_TEXT, STATUS_CLAUSE), delistedParams);
        r.N2 = { real: negStatusReal?.outcome, mutated: negNoStatus?.outcome, delisted_id: delisted.listing_id };
        ck.t('N2', '★ **负控 2**：把可编辑态闸（`status NOT IN (draft,listed) ⇒ status_not_editable`）摘掉 ⇒ delisted 行得 `updated` ⇒ **F6/D2 断言必红**（终态只读判据非恒绿）',
          negStatusReal?.outcome === 'status_not_editable' && negNoStatus?.outcome === 'updated', JSON.stringify(r.N2));

        r.N3 = {
          not_owner_removed: dropSqlLine(SQL_TEXT, NOT_OWNER_CLAUSE) !== SQL_TEXT,
          status_removed: dropSqlLine(SQL_TEXT, STATUS_CLAUSE) !== SQL_TEXT,
          stock_removed: dropSqlLine(SQL_TEXT, STOCK_CLAUSE) !== SQL_TEXT,
        };
        ck.t('N3', '负控 3（静态）：三条闸的摘除**确实改变**了语句文本（摘除器不空转 ⇒ N1/N2 不是在「未变异」的 SQL 上跑）',
          Object.values(r.N3 as Record<string, boolean>).every(Boolean), JSON.stringify(r.N3));

        return r;
      } finally {
        svcLive.updateListingDetailsRow = origLive;
      }
    });
    await pool.end();
    live.result = probe.result;
    live.rolled_back = probe.rolled_back;
    live.error = probe.error ? String((probe.error as Error).message).slice(0, 300) : null;
    live.ms = probe.ms;
    ck.t('F0', `真库面跑完并**一律 ROLLBACK**（含 ${(live.result as Record<string, unknown> | null)?.edit_log_pre_existing === true ? '已 apply 的台账表' : '事务内临时建的 0059 台账表'} / frozen 夹具 INSERT 与全部 UPDATE ⇒ 零残留）`,
      probe.error === null && probe.rolled_back === true, `error=${live.error} rolled_back=${probe.rolled_back}`);
  } catch (e) {
    live.error = String((e as Error).message).slice(0, 300);
    ck.t('F0', '真库面（DB 不可达 ⇒ 未测）', false, `DB_ERR:${live.error}`);
  }

  // ===================================================== P · preflight（只读 · 不 apply）
  const pre: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const client = await pool.connect();
    try {
      const who = await raw1<{ project: string }>(client, "SELECT current_setting('neon.project_id', true) AS project");
      const top = await raw1<{ version: string }>(client, 'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1');
      const pend = await raw<{ version: string }>(client,
        `SELECT v AS version FROM (VALUES ('0050'),('0051'),('0052'),('0053'),('0054'),('0055'),('0056'),('0057'),('0058'),('0059'),('0060'),('0061')) AS t(v)
         WHERE v > $1::text ORDER BY v`, [top?.version ?? '']);
      const pending: string[] = pend.map((p) => p.version);
      // ★ 0059：迁移**文件链**顶（不 apply ⇒ 只读文件名，不写版本表）
      const migTop = (fs.readdirSync(path.join(REPO_BACKEND, 'migrations')).filter((f) => f.endsWith('.sql')).sort().pop() ?? '').slice(0, 4);
      const cols = await raw<{ column_name: string; data_type: string; is_nullable: string }>(client,
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema='public' AND table_name='listing' AND column_name IN ('description','item_type','price','stock','title')
         ORDER BY column_name`);
      const cons = await raw<{ conname: string; def: string }>(client,
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
         WHERE conrelid='public.listing'::regclass AND contype='c' ORDER BY conname`);
      const counts = await raw1<Record<string, string>>(client,
        `SELECT count(*)::text AS total,
                count(*) FILTER (WHERE status='draft')::text AS draft,
                count(*) FILTER (WHERE status='listed')::text AS listed,
                count(*) FILTER (WHERE status='delisted')::text AS delisted,
                count(*) FILTER (WHERE status='frozen')::text AS frozen,
                count(*) FILTER (WHERE item_type IS NOT NULL)::text AS typed
           FROM public.listing`);
      pre.project = who?.project ?? null;
      pre.max_applied = top?.version ?? null;
      pre.pending = pending;
      pre.migration_chain_top = migTop;
      pre.columns = cols;
      pre.constraints = cons.map((x) => x.conname);
      pre.counts = counts;
      ck.t('P1', `preflight 版本面（只读·不 apply）：迁移**文件链顶** = ${migTop}（同树 0059 admin-edit → 0060 商品统一 Id → 0061 多件购买授权列）· 已应用最大 = **${pre.max_applied}** · PENDING = [${pending.join(',')}]（判据 = 链上尚未 apply 的**后缀**；dev 已全 apply ⇒ [] 同算过 = post-apply 模式）`,
        migTop === '0061'
          && ['0058', '0059', '0060', '0061'].includes(String(pre.max_applied))
          && JSON.stringify(pending) === JSON.stringify((['0059', '0060', '0061'] as string[]).filter((v) => v > String(pre.max_applied))),
        JSON.stringify({ project: pre.project, chain_top: migTop, max: pre.max_applied, pending }));
      ck.t('P2', 'preflight 列面：`price` bigint / `stock` integer / `description` text NOT NULL / `item_type` text **可空**；`title` 列**已 DROP**（迁移 0056，标题 = `split_part(description, …)` 派生 ⇒ 本门对 title 的断言只看派生值）',
        cols.length === 4
          && cols.find((c) => c.column_name === 'price')?.data_type === 'bigint'
          && cols.find((c) => c.column_name === 'stock')?.data_type === 'integer'
          && cols.find((c) => c.column_name === 'description')?.is_nullable === 'NO'
          && cols.find((c) => c.column_name === 'item_type')?.is_nullable === 'YES'
          && !cols.some((c) => c.column_name === 'title'),
        JSON.stringify(cols));
      ck.t('P3', 'preflight 约束面：`price > 0` / `stock >= 0` 仍在（服务层有效上限 = JS 安全整数，**更紧**于 bigint 上限）、`item_type` 四值闭集仍在',
        cons.some((c) => c.conname === 'listing_price_positive')
          && cons.some((c) => c.conname === 'listing_stock_nonneg')
          && cons.some((c) => c.conname === 'listing_item_type_check' && /DigitalAutoDeliver/.test(c.def)),
        JSON.stringify(cons.map((c) => c.conname)));
      ck.t('P4', `存量面（只读）：listing 共 ${counts?.total} 行（draft ${counts?.draft} / listed ${counts?.listed} / delisted ${counts?.delisted} / frozen ${counts?.frozen}；已分类 ${counts?.typed}）`,
        Number(counts?.total ?? -1) > 0, JSON.stringify(counts));
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    pre.error = String((e as Error).message).slice(0, 200);
    ck.t('P1', 'preflight（DB 不可达 ⇒ 未测）', false, `DB_ERR:${pre.error}`);
  }

  out.sql_bytes = SQL_TEXT.length;
  out.preflight = pre;
  out.live = live;
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('s55-update-listing-gate', out);
  console.log(JSON.stringify({
    saved: f,
    summary: out.summary,
    preflight: { max: pre.max_applied, pending: pre.pending, counts: pre.counts },
    live: { rolled_back: live.rolled_back, error: live.error },
    red: (out.summary as { red: string[] }).red,
  }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
