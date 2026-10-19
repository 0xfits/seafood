/**
 * s53-00 · 商品分类枚举（迁移 0053）后端门 —— 迁移面 / 写口面 / 单测桩 / 读口回读
 * ---------------------------------------------------------------------------
 * 用法：cd backend-ts && npx ts-node --transpile-only scripts/s53-00-item-type-gate.ts
 * 读数：`ops/item-type/readings/s53-item-type-gate-<RUN>.json`
 *
 * ★ 2026-10-20 续（迁移 `0054_item_type_delivery_split.sql` · Kevin 新口径「数字商品再拆两类」）：
 *   闭集 3 值 → **4 值**（`AutoDeliver` / `ManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`），
 *   **`Digital` 退役**。本脚本随之同步（**只改读数口径，不改 0053 文件**）：
 *   · A 段仍断言 **0053 冻结文本**（三值 + 不回填）—— 它已 apply，改文件 = checksum 漂移 ABORT；
 *     现役闭集真源 = **0054**，由 B5 / Q 段与 `ops/item-type/delivery/s54-00-item-type-delivery-gate.ts` 断言。
 *   · B5 / U 段 / Q 段改读**四值**；新增负控「`Digital` ⇒ 400」与「DB CHECK 拒 `Digital`（23514）」。
 *
 * 纪律：
 *   · 迁移面 / 写口面 = **纯文本 + 纯函数**（零 DB）；单测桩**只替换 DatabaseService 两个静态方法**
 *     （`getCurrencyStatus` / `createListingRow`）⇒ **不写真库**（本单 migration 由 Zang apply）。
 *   · 读口回读 = **只读 SELECT**（`listBrands` / `getBrandById`），零写、零 DDL。
 *   · 注册点不动（`p7b-03` 判 110）；本脚本不 import 任何路由。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { execFileSync } from 'child_process';
import { checker, inRollbackTx, mkPool, raw, sp, REPO_BACKEND, REPO_ROOT } from './p7b-lib';
import { DatabaseService } from '../src/database';
import { getPrizeSellerView } from '../src/messages-service';
import { createListing, normalizeItemType, ITEM_TYPES } from '../src/listing-service';

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const OUT_DIR = path.resolve(REPO_ROOT, 'ops/item-type/readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
/** 迁移目录版本号清单（升序；仅取文件名前缀数字，与 `scripts/migrate.ts` 的版本口径一致） */
const loadMigrationVersions = (): string[] =>
  fs.readdirSync(path.resolve(REPO_BACKEND, 'migrations'))
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((f) => (f.match(/^(\d+)/) ?? [, ''])[1] as string);
/** 去掉 `--` 行注释与 `/* *\/` 块注释后比较（迁移文件头部会**叙述**「不写 BEGIN/COMMIT」） */
const stripSqlComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'scripts/s53-00-item-type-gate.ts' };

  // ======================================================= A · 迁移面（0053）
  const MIG = 'backend-ts/migrations/0053_listing_item_type.sql';
  const migPath = path.resolve(REPO_ROOT, MIG);
  const migExists = fs.existsSync(migPath);
  ck.t('A0', '迁移文件 `0053_listing_item_type.sql` 在场（编号现取 = 最大 0052 + 1）',
    migExists, migPath);
  const MIG_SQL = migExists ? fs.readFileSync(migPath, 'utf8') : '';
  const MIG_CODE = stripSqlComments(MIG_SQL).replace(/\s+/g, ' ').trim();

  // ---- 现役闭集真源 = 0054（2026-10-20 换集：3 值 → 4 值，裸值 `Digital` 退役）----
  const MIG54 = 'backend-ts/migrations/0054_item_type_delivery_split.sql';
  const mig54Path = path.resolve(REPO_ROOT, MIG54);
  const MIG54_EXISTS = fs.existsSync(mig54Path);
  const MIG54_SQL = MIG54_EXISTS ? fs.readFileSync(mig54Path, 'utf8') : '';
  const MIG54_CODE = stripSqlComments(MIG54_SQL).replace(/\s+/g, ' ').trim();
  const SELFCHECK_AT = MIG54_SQL.indexOf('-- 尾部自检');
  const MIG54_DDL = SELFCHECK_AT > 0 ? MIG54_SQL.slice(0, SELFCHECK_AT) : MIG54_SQL;
  const MIG54_SELFCHECK = SELFCHECK_AT > 0 ? MIG54_SQL.slice(SELFCHECK_AT) : MIG54_SQL;
  /** 取 `item_type IN (...)` 里的字面值（顺序保留）——用于「服务层常量 vs 迁移 CHECK」逐字比对 */
  const closedSetOf = (code: string): string[] => {
    const m = code.match(/item_type IN \(([^)]*)\)/);
    return m ? (m[1].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1)) : [];
  };

  ck.t('A8', '迁移 `0054_item_type_delivery_split.sql` 在场（编号现取 = 0053 + 1），闭集 = 四值且**不含裸值 `Digital`**',
    MIG54_EXISTS && JSON.stringify(closedSetOf(MIG54_CODE)) === JSON.stringify([...ITEM_TYPES]),
    `exists=${MIG54_EXISTS} closed_set=${JSON.stringify(closedSetOf(MIG54_CODE))}`);

  ck.t('A1', '加列：`ALTER TABLE public.listing ADD COLUMN IF NOT EXISTS item_type text`',
    /ALTER TABLE public\.listing ADD COLUMN IF NOT EXISTS item_type text;/.test(MIG_CODE),
    `hit=${/ALTER TABLE public\.listing ADD COLUMN IF NOT EXISTS item_type text;/.test(MIG_CODE)}`);

  ck.t('A2', '0053 **冻结文本**·三值 CHECK 逐字（Digital / PhysicalFreeShip / PhysicalBuyerShip）+ 允许 NULL（历史值：现役闭集已由 0054 换为四值，见 A8/B5）',
    /CHECK \(item_type IS NULL OR item_type IN \('Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip'\)\)/.test(MIG_CODE),
    'ok');

  ck.t('A3', '约束名 `listing_item_type_check` + 幂等守卫（先查 `pg_constraint` 且 `conrelid = public.listing::regclass`，再 ADD）',
    MIG_CODE.includes('listing_item_type_check')
      && /pg_constraint/.test(MIG_CODE)
      && /conrelid = 'public\.listing'::regclass/.test(MIG_CODE)
      && !/ADD CONSTRAINT IF NOT EXISTS/.test(MIG_CODE),
    `pg_constraint=${/pg_constraint/.test(MIG_CODE)} conrelid_scope=${/conrelid/.test(MIG_CODE)}`);

  ck.t('A4', '文件内**不写**事务控制 BEGIN;/COMMIT;（DO 块内的 PL/pgSQL `BEGIN … END` 与 0052 同族，非事务控制）',
    !/^\s*(BEGIN|COMMIT|END)\s*;\s*$/im.test(MIG_CODE) && !/START\s+TRANSACTION/i.test(MIG_CODE),
    `tx_control_hits=${(/^\s*(BEGIN|COMMIT|END)\s*;\s*$/im.test(MIG_CODE) ? 1 : 0)} do_blocks=${(MIG_SQL.match(/DO \$\$/g) ?? []).length}`);

  const selfChecks = ['item_type missing', 'type is % (expect text)', 'not nullable', 'listing_item_type_check missing',
    'lacks closed set', 'must allow NULL', 'outside closed set', 'stock row(s) backfilled'];
  ck.t('A5', '尾部 DO 自检 8 项（0053 冻结文本：列在场 / 类型 text / 可空 / 约束在场 / 定义含三值 / 定义允许 NULL / 非法值 0 行 / 存量非 NULL 0 行）',
    selfChecks.every((s) => MIG_SQL.includes(s)), `hits=${selfChecks.filter((s) => MIG_SQL.includes(s)).length}/8`);

  ck.t('A6', '不回填：文件内**无** `UPDATE public.listing` / `SET item_type` / `DEFAULT`（存量行保持 NULL）',
    !/UPDATE\s+public\.listing/i.test(MIG_CODE) && !/SET\s+item_type/i.test(MIG_CODE) && !/DEFAULT/i.test(MIG_CODE),
    `update=${/UPDATE\s+public\.listing/i.test(MIG_CODE)} default=${/DEFAULT/i.test(MIG_CODE)}`);

  let migDiff = '';
  try {
    migDiff = execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain', '--', 'backend-ts/migrations'], { encoding: 'utf8' }).trim();
  } catch (e) {
    migDiff = `GIT_ERR:${String((e as Error).message).slice(0, 80)}`;
  }
  const migTouched = migDiff.split('\n').filter(Boolean);
  ck.t('A7', '历史迁移零改动（git 工作树下 migrations/ 变动 ⊆ {新增 0053, 新增 0054}；0050-0052 一字未动）',
    migTouched.every((l) => /0053_listing_item_type\.sql|0054_item_type_delivery_split\.sql/.test(l)) && migTouched.length <= 4,
    JSON.stringify(migTouched));

  // ======================================================= B · 写口面（静态）
  const INDEX_TS = readSrc('backend-ts/src/index.ts');
  const SVC = readSrc('backend-ts/src/listing-service.ts');
  const DB = readSrc('backend-ts/src/database.ts');
  const dbRow = DB.slice(DB.indexOf('static async createListingRow'), DB.indexOf('static async updateListingRow'));

  ck.t('B1', '`POST /api/listing` 透传 `body.item_type`（index.ts）',
    /itemType: body\.item_type,/.test(INDEX_TS), 'ok');
  ck.t('B2', 'INSERT 列 + INSERT SELECT + RETURNING + 两臂 SELECT 均带 `item_type`（5 处）',
    (dbRow.match(/item_type/g) ?? []).length === 5 && /INSERT INTO public\.listing \([^)]*item_type/.test(dbRow),
    `hits=${(dbRow.match(/item_type/g) ?? []).length}`);
  const dbUpdRow = DB.slice(DB.indexOf('static async updateListingRow'), DB.indexOf('static async updateListingRow') + 2600);
  ck.t('B3', '编辑/状态迁移**不写**该列（`updateListingRow` 段内 item_type 命中 = 0；`updateListing` 签名无 itemType）',
    !dbUpdRow.includes('item_type')
      && /export const updateListing = async \(params: \{[\s\S]{0,320}\}\): Promise<VerbResult>/.test(SVC)
      && !/export const updateListing = async \(params: \{[\s\S]{0,320}itemType/.test(SVC),
    `upd_row_item_type_hits=${(dbUpdRow.match(/item_type/g) ?? []).length}`);
  ck.t('B4', '`PATCH /api/listing/:id` 只收 `to_status`/`status`（分类不可改）',
    /toStatus: req\.body\?\.to_status \?\? req\.body\?\.status \?\? ''/.test(INDEX_TS)
      && !/app\.patch\('\/api\/listing\/:listingId'[\s\S]{0,900}item_type/.test(INDEX_TS),
    'ok');
  ck.t('B5', '服务层闭集常量 = 四值且与迁移 **0054** CHECK 逐字一致（含顺序）；裸值 `Digital` 不在其中（0053 文本冻结保留三值 = A2）',
    JSON.stringify([...ITEM_TYPES]) === JSON.stringify(['DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip'])
      && JSON.stringify(closedSetOf(MIG54_CODE)) === JSON.stringify([...ITEM_TYPES])
      && !ITEM_TYPES.includes('Digital' as never),
    `ITEM_TYPES=${JSON.stringify(ITEM_TYPES)} mig0054=${JSON.stringify(closedSetOf(MIG54_CODE))}`);
  const fpBody = SVC.match(/const fingerprintOf = \(row: Record<string, unknown>\) => JSON\.stringify\(\[([\s\S]*?)\]\);/)?.[1] ?? '';
  const fpFields = Array.from(new Set((fpBody.match(/row\.([a-z_]+)/g) ?? []).map((s) => s.slice(4))));
  ck.t('B6', '幂等指纹字段集未改（`fingerprintOf` 仍 6 字段，item_type 不进指纹）',
    fpFields.join(',') === 'seller_uid,cid,price,title,description,media_urls'
      && !fpFields.includes('item_type')
      && /fingerprintOf\(write\.row\) !== JSON\.stringify\(\[Number\(params\.sellerUid\), cid\.value, price\.value, title, description\.value \|\| '', mediaUrls\.value \|\| \[\]\]\)/.test(SVC),
    `field_set=${fpFields.length} fields=${fpFields.join(',')}`);

  // ======================================================= U · 单测桩（不写真库）
  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading));
  };

  // U1-U4：normalizeItemType 纯函数
  for (const v of ITEM_TYPES) {
    const r = normalizeItemType(v);
    u(`U1-${v}`, `闭集值 \`${v}\` ⇒ 通过且原值透出`, r.ok && r.value === v, r.ok ? r.value : `ERR:${r.err.code}`);
  }
  for (const [label, raw] of [['undefined', undefined], ['null', null]] as const) {
    const r = normalizeItemType(raw);
    u(`U2-${label}`, `未传 / ${label} ⇒ null（未分类）`, r.ok && r.value === null, r.ok ? String(r.value) : `ERR:${r.err.code}`);
  }
  for (const [label, raw, wantValue] of [
    ['小写 digitalautodeliver', 'digitalautodeliver', null],
    ['空格包裹仍合法', ' DigitalAutoDeliver ', 'DigitalAutoDeliver'],
  ] as const) {
    const r = normalizeItemType(raw);
    const want = wantValue !== null;
    u(`U3-${label}`, `${label} ⇒ ${want ? '通过（trim 后闭集命中）' : '400 NOT_IN_CLOSED_SET（大小写敏感）'}`,
      want ? r.ok && r.value === wantValue : (!r.ok && r.err.status === 400 && r.err.details.reason === 'NOT_IN_CLOSED_SET'),
      r.ok ? r.value : { status: r.err.status, code: r.err.code, reason: r.err.details.reason });
  }
  for (const [label, raw] of [['枚举外 Physical', 'Physical'], ['空串', ''], ['数字 123', 123]] as const) {
    const r = normalizeItemType(raw);
    const isStr = label.startsWith('数字') === false;
    u(`U4-${label}`, `${label} ⇒ 400（${isStr ? 'NOT_IN_CLOSED_SET + provided/allowed' : 'NOT_A_STRING'} + field=listing.item_type）`,
      !r.ok && r.err.status === 400 && r.err.code === 'LEDGER_AMOUNT_INVALID'
        && r.err.details.field === 'listing.item_type'
        && (isStr
          ? (r.err.details.reason === 'NOT_IN_CLOSED_SET'
              && r.err.details.provided === String(raw)
              && JSON.stringify(r.err.details.allowed) === JSON.stringify([...ITEM_TYPES]))
          : r.err.details.reason === 'NOT_A_STRING'),
      r.ok ? 'PASS?' : { status: r.err.status, code: r.err.code, details: r.err.details });
  }

  // U10（负控 · 退役生效）：裸值 `Digital` ⇒ 400 —— 且**不得**被新前缀值 `DigitalAutoDeliver` / `DigitalManualDeliver` 兜住
  {
    const rDigital = normalizeItemType('Digital');
    u('U10-Digital', '退役值裸 `Digital` ⇒ 400 NOT_IN_CLOSED_SET（provided=Digital、allowed=四值）—— 「0054 换集生效」负控',
      !rDigital.ok && rDigital.err.status === 400 && rDigital.err.code === 'LEDGER_AMOUNT_INVALID'
        && rDigital.err.details.field === 'listing.item_type'
        && rDigital.err.details.reason === 'NOT_IN_CLOSED_SET'
        && rDigital.err.details.provided === 'Digital'
        && JSON.stringify(rDigital.err.details.allowed) === JSON.stringify([...ITEM_TYPES]),
      rDigital.ok ? 'PASS?' : { status: rDigital.err.status, code: rDigital.err.code, details: rDigital.err.details });
  }

  // U5-U7：createListing 桩（替换两个 DB 静态方法；零真写）
  const svc = DatabaseService as unknown as Record<string, unknown>;
  const origGate = svc.getCurrencyStatus;
  const origCreate = svc.createListingRow;
  let gateCalls = 0;
  let createCalls = 0;
  let lastInput: Record<string, unknown> | null = null;
  let existingRow: Record<string, unknown> | null = null;
  svc.getCurrencyStatus = async () => { gateCalls += 1; return { status: 'listed' }; };
  svc.createListingRow = async (input: Record<string, unknown>) => {
    createCalls += 1;
    lastInput = input;
    if (existingRow) return { outcome: 'existing', row: existingRow };
    return {
      outcome: 'inserted',
      row: {
        listing_id: 990001, seller_uid: input.sellerUid, cid: input.cid, price: input.price, stock: input.stock,
        title: input.title, description: input.description, media_urls: input.mediaUrls,
        item_type: input.itemType, status: 'draft', create_key: input.createKey,
      },
    };
  };

  const baseParams = { sellerUid: 900001, cid: 1, price: 100, stock: 1, title: 'S53 桩标题', createKeyRaw: 'cli:s53:gate' };
  try {
    for (const v of ITEM_TYPES) {
      createCalls = 0; lastInput = null;
      const r = await createListing({ ...baseParams, itemType: v });
      u(`U5-${v}`, `createListing 三值之一 \`${v}\` ⇒ 200 且写入口收到 itemType='${v}'（原样落库，不派生）`,
        r.ok && createCalls === 1 && (lastInput as Record<string, unknown> | null)?.itemType === v && (r as { view: Record<string, unknown> }).view.item_type === v,
        r.ok ? { createCalls, itemType: (lastInput as Record<string, unknown>)?.itemType, view: (r as { view: Record<string, unknown> }).view.item_type } : r);
    }
    // U6 缺省 ⇒ null
    createCalls = 0; lastInput = null;
    const rNone = await createListing({ ...baseParams, createKeyRaw: 'cli:s53:gate:none' });
    u('U6', '未传 item_type ⇒ 写入口收到 null（= 未分类，存量行同义）',
      rNone.ok && (lastInput as Record<string, unknown> | null)?.itemType === null,
      rNone.ok ? { itemType: (lastInput as Record<string, unknown>)?.itemType } : rNone);

    // U7 非法值 ⇒ 400 且**零 DB 调用**（闸早于 currencyGate/createListingRow）
    for (const bad of ['Digital', 'Digital2', 'physicalfreeship', ' physical']) {
      gateCalls = 0; createCalls = 0;
      const rBad = await createListing({ ...baseParams, itemType: bad });
      u(`U7-${bad.trim()}`, `非法 item_type=\`${bad}\` ⇒ 400 NOT_IN_CLOSED_SET 且 DB 调用 0 次（闸在 currencyGate 之前）`,
        !rBad.ok && rBad.status === 400 && rBad.code === 'LEDGER_AMOUNT_INVALID'
          && gateCalls === 0 && createCalls === 0,
        rBad.ok ? 'PASS?' : { status: rBad.status, code: rBad.code, reason: rBad.details.reason, gateCalls, createCalls });
    }

    // U8 重放臂：同键已在库（item_type='PhysicalBuyerShip'），本次未传 ⇒ replay + 回**库内**真值（指纹不含该列）
    existingRow = {
      listing_id: 990002, seller_uid: baseParams.sellerUid, cid: baseParams.cid, price: baseParams.price,
      stock: baseParams.stock, title: baseParams.title, description: '', media_urls: [],
      item_type: 'PhysicalBuyerShip', status: 'draft', create_key: 'cli:s53:gate:replay',
    };
    const rReplay = await createListing({ ...baseParams, createKeyRaw: 'cli:s53:gate:replay' });
    u('U8', '同键重放（指纹 6 字段一致、本次未传分类）⇒ 200 replay=true 且 view.item_type = 库内值（披露：分类不进指纹）',
      rReplay.ok && (rReplay as { replay: boolean }).replay === true
        && (rReplay as { view: Record<string, unknown> }).view.item_type === 'PhysicalBuyerShip',
      rReplay.ok ? { replay: (rReplay as { replay: boolean }).replay, item_type: (rReplay as { view: Record<string, unknown> }).view.item_type } : rReplay);
  } finally {
    svc.getCurrencyStatus = origGate;
    svc.createListingRow = origCreate;
    existingRow = null;
  }
  ck.t('U9', '桩已回收（两静态方法逐字还原到原型方法）',
    (DatabaseService as unknown as Record<string, unknown>).getCurrencyStatus === origGate
      && (DatabaseService as unknown as Record<string, unknown>).createListingRow === origCreate, 'restored');

  // ======================================================= R · 读口回读（只读）
  const live: Record<string, unknown> = {};
  try {
    const feed = await DatabaseService.listBrands(0, 100);
    const keyCounts = Array.from(new Set(feed.map((r) => Object.keys(r as object).length)));
    const itemTypePresent = feed.every((r) => 'item_type' in (r as object));
    const itemTypeValues = Array.from(new Set(feed.map((r) => (r as { item_type?: unknown }).item_type))).map((v) => (v === null ? 'null' : String(v)));
    live.feed = { rows: feed.length, keyCounts, itemTypePresent, itemTypeValues };
    ck.t('R1', 'feed（`listBrands`）行键**恰 48**（47→48，加性 1 键）',
      feed.length > 0 && keyCounts.length === 1 && keyCounts[0] === 48,
      `rows=${feed.length} keyCounts=${JSON.stringify(keyCounts)}`);
    ck.t('R2', 'feed 每行 `item_type` **键恒在场**（值 = 闭集或 null，非缺键）',
      itemTypePresent && itemTypeValues.every((v) => v === 'null' || (ITEM_TYPES as readonly string[]).includes(v)),
      `present=${itemTypePresent} values=${JSON.stringify(itemTypeValues)}`);

    if (feed.length > 0) {
      const id = Number((feed[0] as unknown as { bID: number }).bID);
      const prize = await DatabaseService.getPrizeById(id);
      const dbKeys = prize ? Object.keys(prize as object).length : -1;
      // 详情**顶层**键数 = 归一器输出 + 路由层 `{ ...prize, seller }` 的 1 键（index.ts:679 逐字同构复算）
      const sellerResult = await getPrizeSellerView(id);
      const httpTop = { ...(prize as object), seller: sellerResult.ok ? sellerResult.seller : null };
      const httpKeys = Object.keys(httpTop).length;
      live.detail = {
        bID: id, db_layer_keys: dbKeys, http_top_keys: httpKeys,
        item_type: (prize as unknown as { item_type?: unknown } | null)?.item_type,
        seller_in_route: sellerResult.ok,
      };
      ck.t('R3', '详情顶层**恰 47 键**（46→47；DB 归一器 45→46，路由层 `{ ...prize, seller }` +1 复算）',
        dbKeys === 46 && httpKeys === 47, `bID=${id} db_layer=${dbKeys} http_top=${httpKeys}`);
      ck.t('R4', '详情两口 `item_type` 同键同值（feed 行 vs 详情归一器，均取 `listing.item_type`）',
        !!prize && ('item_type' in (prize as object))
          && (prize as { item_type?: unknown }).item_type === (feed[0] as unknown as { item_type?: unknown }).item_type
          && ('item_type' in httpTop),
        JSON.stringify({ feed: (feed[0] as unknown as { item_type?: unknown }).item_type, detail_db: (prize as unknown as { item_type?: unknown })?.item_type, detail_http: (httpTop as { item_type?: unknown }).item_type }));
    } else {
      ck.t('R3', '详情键数（feed 空 ⇒ 跳过，dev 无 listed 行）', false, 'SKIP: feed rows=0');
    }
  } catch (e) {
    live.error = String((e as Error).message).slice(0, 200);
    ck.t('R1', 'feed 行键 48（DB 不可达 ⇒ 未测）', false, `DB_ERR:${live.error}`);
  }
  out.live = live;

  // ======================================================= P · 迁移 preflight（只读；**不 apply**）
  const pre: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const client = await pool.connect();
    try {
      const applied = await raw<{ version: string }>(client, 'SELECT version FROM public.schema_migration ORDER BY version DESC LIMIT 1');
      const maxApplied = applied[0]?.version ?? null;
      const has0053 = await raw<{ n: string }>(client, "SELECT count(*)::text AS n FROM public.schema_migration WHERE version = '0053'");
      const col = await raw<{ data_type: string; is_nullable: string }>(client,
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='item_type'");
      const con = await raw<{ def: string }>(client,
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='listing_item_type_check' AND conrelid='public.listing'::regclass AND contype='c'");
      let nonNull = 0;
      if (col.length > 0) {
        const rows = await raw<{ n: string }>(client, 'SELECT count(*)::text AS n FROM public.listing WHERE item_type IS NOT NULL');
        nonNull = Number(rows[0]?.n ?? 0);
      }
      const state = has0053[0]?.n === '1' ? 'APPLIED' : 'PRE_APPLY';
      const migratedFiles = loadMigrationVersions();
      const pending = migratedFiles.filter((v) => v > String(maxApplied));
      pre.state = state;
      pre.max_applied = maxApplied;
      pre.pending = pending;
      pre.column = col[0] ?? null;
      pre.constraint_def = con[0]?.def ?? null;
      pre.rows_with_item_type = nonNull;
      ck.t('P1', `preflight 版本面：已应用最大 = ${maxApplied}，PENDING = [${pending.join(',')}]（0053 已 apply；0054 排在队首、待 Zang apply；本脚本**不 apply**）`,
        state === 'APPLIED' && pending.every((v) => v === '0054'),
        `state=${state} max=${maxApplied} pending=${JSON.stringify(pending)}`);
      const defNow = con[0]?.def ?? '';
      const isFourValue = /DigitalAutoDeliver/.test(defNow) && !/'Digital'(::text)?([,)\]]|$)/.test(defNow);
      const isThreeValue = /'Digital'::text/.test(defNow);
      ck.t('P2', `preflight 授权面：列 = text 且可空；约束定义 ∈ {0053 三值（含裸 \`Digital\`）= 合法前态, 0054 四值（不含裸 \`Digital\`）} —— 目标面四值由 \`ops/item-type/delivery\` 的 s54 门严判（0053 已 apply，本处只判「已知两态之一」）`,
        col.length === 1 && col[0]?.data_type === 'text' && col[0]?.is_nullable === 'YES'
          && (isThreeValue || isFourValue),
        `def=${JSON.stringify(defNow)} four_value=${isFourValue} three_value=${isThreeValue}`);
      ck.t('P3', `存量行零回填：item_type 非空行数 = ${nonNull}（期望 0；列未迁移时记 N/A=0）`,
        nonNull === 0, `rows_with_item_type=${nonNull}`);
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    pre.error = String((e as Error).message).slice(0, 200);
    ck.t('P1', '迁移 preflight（DB 不可达 ⇒ 未测）', false, `DB_ERR:${pre.error}`);
  }
  out.preflight = pre;

  // ============================================ Q · 迁移干跑（**inRollbackTx ⇒ 零残留**，不 apply 版本）
  // ★ 0054 换集（3 值 → 4 值、裸 `Digital` 退役）：本段干跑 **0054**（现役闭集真源）；
  //   0053 的列/三值契约由 A 段静态断言冻结（0053 已 apply，改文件 = checksum 漂移 ABORT）。
  const dry: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const probe = await inRollbackTx(pool, async (c) => {
      const r: Record<string, unknown> = {};
      // ① 前置：列若尚缺（未 apply 0053 的库）先补 0053，使干跑在两种前态下都成立；已 apply 的库自然跳过
      const colNow = await raw<{ n: string }>(c,
        "SELECT count(*)::text AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='item_type'");
      r.column_pre_existing = Number(colNow[0]?.n ?? 0) === 1;
      if (!r.column_pre_existing) await c.query(MIG_SQL);
      r.first_run = 'ok';
      // ② 首跑 0054 DDL（与 migrate.ts 同语义：单文件一事务）
      await c.query(MIG54_DDL);
      r.second_run = 'ok';
      // ③ 重跑：幂等（DROP CONSTRAINT IF EXISTS + ADD）⇒ 零报错、库内仍恰 1 条
      await c.query(MIG54_DDL);
      const col = await raw<{ data_type: string; is_nullable: string }>(c,
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='item_type'");
      const con = await raw<{ def: string }>(c,
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='listing_item_type_check' AND conrelid='public.listing'::regclass AND contype='c'");
      const conCnt = await raw<{ n: string }>(c,
        "SELECT count(*)::text AS n FROM pg_constraint WHERE conrelid='public.listing'::regclass AND contype='c' AND (conname='listing_item_type_check' OR pg_get_constraintdef(oid) LIKE '%item_type%')");
      r.column = col[0] ?? null;
      r.constraint_def = con[0]?.def ?? null;
      r.constraint_count = Number(conCnt[0]?.n ?? -1);
      // ④ 闭集闸实证：四值各写一次（合法）+ 裸 `Digital`（退役 ⇒ 必须 23514）+ NULL（放行）+ `Bogus`（23514），逐次 SAVEPOINT 包住
      const target = await raw<{ listing_id: string }>(c, 'SELECT listing_id FROM public.listing ORDER BY listing_id LIMIT 1');
      const lid = target[0]?.listing_id ?? null;
      r.probe_listing_id = lid;
      const writes: Array<Record<string, unknown>> = [];
      if (lid) {
        for (const v of [...ITEM_TYPES, 'Digital', null, 'Bogus']) {
          const s = await sp<unknown>(c, async () => c.query('UPDATE public.listing SET item_type = $1 WHERE listing_id = $2::bigint', [v, lid]));
          writes.push({ value: v, ok: s.ok, sqlstate: s.ok ? null : String(((s.error as Record<string, unknown>)?.code) ?? '') });
        }
      }
      r.writes = writes;
      // ⑤ 自检器灵敏度（负控自证：证明 0054 尾部 DO 不是恒绿）
      //   (a) 造「四值 + 裸 Digital」的约束 ⇒ 0054 自检必须 RAISE（否则「退役值」判据是坏的）
      const senA = await sp<unknown>(c, async () => {
        await c.query('ALTER TABLE public.listing DROP CONSTRAINT listing_item_type_check');
        await c.query("ALTER TABLE public.listing ADD CONSTRAINT listing_item_type_check CHECK (item_type IS NULL OR item_type IN ('DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip', 'Digital'))");
        await c.query(MIG54_SELFCHECK);
      });
      r.selfcheck_with_bare_digital = { raised: !senA.ok, message: String(((senA.error as Record<string, unknown>)?.message) ?? '').slice(0, 160) };
      //   (b) 退回 0053 三值 ⇒ 0054 自检必须 RAISE（否则「四值闭集」判据是坏的）
      const senB = await sp<unknown>(c, async () => {
        await c.query('ALTER TABLE public.listing DROP CONSTRAINT listing_item_type_check');
        await c.query("ALTER TABLE public.listing ADD CONSTRAINT listing_item_type_check CHECK (item_type IS NULL OR item_type IN ('Digital', 'PhysicalFreeShip', 'PhysicalBuyerShip'))");
        await c.query(MIG54_SELFCHECK);
      });
      r.selfcheck_with_old_triple = { raised: !senB.ok, message: String(((senB.error as Record<string, unknown>)?.message) ?? '').slice(0, 160) };
      return r;
    });
    await pool.end();
    dry.result = probe.result;
    dry.rolled_back = probe.rolled_back;
    dry.error = probe.error ? String((probe.error as Error).message).slice(0, 200) : null;
    const w = (probe.result?.writes ?? []) as Array<Record<string, unknown>>;
    const legal = w.filter((x) => x.ok === true);
    const illegal = w.filter((x) => x.ok === false);
    const senA = (probe.result?.selfcheck_with_bare_digital ?? {}) as { raised?: boolean; message?: string };
    const senB = (probe.result?.selfcheck_with_old_triple ?? {}) as { raised?: boolean; message?: string };
    ck.t('Q1', '迁移 **0054 干跑**（inRollbackTx）：首跑 + 重跑均无报错（尾部 DO 自检全过 = 首跑成功的前提）',
      probe.error === null && probe.result?.first_run === 'ok' && probe.result?.second_run === 'ok',
      `first=${probe.result?.first_run} second=${probe.result?.second_run} err=${dry.error}`);
    ck.t('Q2', '干跑后列 = text/可空（不动列定义）+ 约束定义含四值、**不含裸 `Digital`** + 库内恰 1 条 item_type CHECK',
      (probe.result?.column as { data_type?: string; is_nullable?: string } | undefined)?.data_type === 'text'
        && (probe.result?.column as { is_nullable?: string } | undefined)?.is_nullable === 'YES'
        && [...ITEM_TYPES].every((v) => String(probe.result?.constraint_def ?? '').includes(`'${v}'`))
        && !/'Digital'(::text)?([,)\]]|$)/.test(String(probe.result?.constraint_def ?? ''))
        && probe.result?.constraint_count === 1,
      JSON.stringify({ column: probe.result?.column, def: probe.result?.constraint_def, count: probe.result?.constraint_count }));
    ck.t('Q3', '闭集闸实证（事务内）：四值各写入 OK · `NULL` 放行 · **裸 `Digital` 被 CHECK 拒（23514）** · `Bogus` 被拒（23514）',
      legal.length === 5 && illegal.length === 2 && legal.every((x) => x.ok === true)
        && illegal.every((x) => x.sqlstate === '23514')
        && w.find((x) => x.value === 'Digital')?.ok === false,
      JSON.stringify(w));
    ck.t('Q4', '自检器灵敏度（负控自证）：装「四值+裸 Digital」约束 ⇒ 0054 自检 RAISE（退役值判据非恒绿）；退回 0053 三值 ⇒ 自检 RAISE（四值判据非恒绿）',
      senA.raised === true && /retired value Digital/.test(String(senA.message ?? ''))
        && senB.raised === true && /lacks 4-value closed set/.test(String(senB.message ?? '')),
      JSON.stringify({ bare_digital: senA, old_triple: senB }));
    ck.t('Q5', '干跑**零残留**：事务一律 ROLLBACK（版本表无 0054 行、约束仍为库内前态 —— 由 P1/P2 读数交叉印证）',
      probe.rolled_back === true, `rolled_back=${probe.rolled_back}`);
  } catch (e) {
    dry.error = String((e as Error).message).slice(0, 200);
    ck.t('Q1', '迁移干跑（DB 不可达 ⇒ 未测）', false, `DB_ERR:${dry.error}`);
  }
  out.dry_run = dry;

  out.migration = {
    file: MIG, bytes: MIG_SQL.length,
    sha256: (await import('crypto')).createHash('sha256').update(MIG_SQL, 'utf8').digest('hex'),
  };
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('s53-item-type-gate', out);
  console.log(JSON.stringify({ saved: f, summary: out.summary, live, unit: unit.map((x) => ({ id: x.id, pass: x.pass })) }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
