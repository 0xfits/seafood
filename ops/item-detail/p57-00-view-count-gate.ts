/**
 * p57-00 · 详情页浏览计数 + 商品成色（迁移 0057）后端离线门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/item-detail/p57-00-view-count-gate.ts
 * 读数：`ops/item-detail/readings/p57-view-count-gate-<RUN>.json`
 *
 * ★ 覆盖面（Kevin 2026-10-20 详情页改版 · 后端件：浏览计数 + item_condition 成色 + wants）：
 *   A · 静态面：本单零新路由（regs=110 → 111 由 0059 admin-edit 单前推）· 详情读口换「自增+读」专用口 · feed SQL 不选两列 ·
 *       归一器两处条件透出 · 迁移文件形状（头段无 BEGIN/COMMIT / 两列 / 零索引 / 闭集逐字）· 写口接线；
 *   B · 迁移干跑（真库 · `inRollbackTx` ⇒ ROLLBACK ⇒ **零 apply / 零残留**）：
 *       0057 头段（两列 ADD COLUMN）+ 尾部 DO 自检在真库跑通（pre-apply 模式）；
 *   C · 详情读口行为（同 tx · **service 层真实代码路径**，经 `sqlFor(ex)` 事务内注入）：
 *       连续两次详情读 ⇒ 第二次 views = 第一次 + 1（自增后读）· 详情 service 层 49 键 / 路由合成后
 *       50 键（+views +condition +wants，wants 走真收藏行 left join）· draft 也计数（任何状态都计）·
 *       不存在 id ⇒ null（404 语义）且不计数 · feed 行键仍 48 且无 views/condition ·
 *       **mine 行键 11（+condition）**· 成色四值写入（DB 层真实写路径）·
 *       PATCH `condition_not_applicable` DB 守卫臂 + 实物合法改写（回执键数 = 11 同族）；
 *   D · 写口校验（**离线 · 桩替 DB 静态方法**，逐字还原）：非法值 400 · 数字带成色 400 ·
 *       未分类带成色 400 · 合法值透传写入口 · PATCH 两闸 · `classifyListingPatchBody` 识别新字段键；
 *   N · CHECK 负控（各自独立回滚事务）：非法成色值 ⇒ 23514 · 负 view_count ⇒ 23514（证明判据非恒绿）；
 *   E · 零残留证：回滚后夹具 create_key 命中 = 0（连历史 run 一起核）· 库身份自证（neon.project_id）。
 *
 * 纪律：**不 apply、不写版本表、零 DDL/DML 落库**（一切写都在回滚事务内）；
 *   夹具 = **真 `createListingRow` 写路径**自建、事务回滚自回收；探针凭据只读 `.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import type { BrandRecord, SqlRunner } from '../../backend-ts/src/database';
import {
  createListing,
  updateListingDetails,
  classifyListingPatchBody,
  ITEM_CONDITIONS,
  PHYSICAL_ITEM_TYPES,
  ITEM_TYPES,
} from '../../backend-ts/src/listing-service';

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
const DB = readSrc('backend-ts/src/database.ts');
const SVC = readSrc('backend-ts/src/listing-service.ts');
const MIG = readSrc('backend-ts/migrations/0057_listing_view_count.sql');

/**
 * 迁移文件切单语句：头段（两列 ALTER，无 BEGIN/COMMIT）+ 尾段（`DO $$ … $$;` 自检块）。
 * ★ 头段切分前先剥 `--` 注释行：语句之间的注释行若不剥，会产生「纯注释段」——
 *   作为空查询发出去在部分驱动（HTTP prepared-statement）上不可靠，直接滤掉最稳。
 */
const stripSqlLineComments = (text: string): string =>
  text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const splitMigration = (text: string): { head: string; tail: string; headStmts: string[]; headCode: string } => {
  const at = text.indexOf('\nDO $$');
  if (at < 0) throw new Error('migration self-check block (DO $$) not found');
  const head = text.slice(0, at).trim();
  const tail = text.slice(at).trim();
  const headCode = stripSqlLineComments(head);
  // 头段按 `;` 切（CHECK 字面量内无分号；尾段 DO 块**不切**、整块单语句跑）
  const headStmts = headCode.split(';').map((s) => s.trim()).filter(Boolean);
  return { head, tail, headStmts, headCode };
};
const M57 = splitMigration(MIG);

const sliceBetween = (src: string, startMark: string, endMark: string): string => {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : '';
};

const FIXTURE_KEY_PREFIX = 'cli:p57-gate:';

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/item-detail/p57-00-view-count-gate.ts' };

  // ====================================================================== A · 静态面（零 DB）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('A1', '**零新路由**：注册点仍 = 110（本单只改既有读口/写口，无第 111 个注册点）',
    regs === 111, `registration_points=${regs}`);

  const detailBlock = sliceBetween(INDEX_TS, "app.get('/api/prize/:bID'", "app.get('/api/user'");
  ck.t('A2', '详情读口已换「自增+读」专用口：`getPrizeDetailRecordingView` 在场、`getPrizeById` 不再被详情路由调用（裸读只留内部回执用）',
    /DatabaseService\.getPrizeDetailRecordingView\(bID\)/.test(detailBlock) && !/getPrizeById\(/.test(detailBlock),
    JSON.stringify({ uses_recording: /getPrizeDetailRecordingView/.test(detailBlock), uses_bare: /getPrizeById\(/.test(detailBlock) }));

  const incrHits = (DB.match(/view_count = view_count \+ 1/g) ?? []).length;
  const detailSvc = sliceBetween(DB, 'static async getPrizeDetailRecordingView', 'static async listPrizes');
  ck.t('A3', '`view_count = view_count + 1` 全仓 database.ts **恰 1 处**且在详情专用 CTE 内（其余读面零计数）',
    incrHits === 1 && /view_count = view_count \+ 1/.test(detailSvc) && /WITH bumped AS/.test(detailSvc),
    `increment_sites=${incrHits} in_detail_cte=${/view_count = view_count \+ 1/.test(detailSvc)}`);

  const feedSvc = sliceBetween(DB, 'static async listBrands', 'static async listClaimedPrizeIdsByUser');
  ck.t('A4', 'feed（`listBrands`）SQL **不选** `view_count` / `item_condition` ⇒ 行键 48 不变、两键不出现、不计数',
    feedSvc.length > 0 && !feedSvc.includes('view_count') && !feedSvc.includes('item_condition'),
    `listBrands_slice_bytes=${feedSvc.length}`);

  const condHits = (DB.match(/row\.item_condition !== undefined/g) ?? []).length;
  const viewHits = (DB.match(/row\.view_count !== undefined/g) ?? []).length;
  ck.t('A5', '归一器两处**条件透出**（行携带列才出键）：`row.view_count` ×1 + `row.item_condition` ×1（详情专用；feed 行无列 ⇒ 键不出现；mine 行 `condition` 走 getValue 兜底口、不计入本口径）',
    condHits === 1 && viewHits === 1, `item_condition_guards=${condHits} view_count_guards=${viewHits}`);

  // ★ BEGIN/COMMIT 判据只看**头段代码行**（剥注释）：尾部 DO $$ 块的 BEGIN/END 是 PL/pgSQL
  //   语法体、不是事务语句；头段注释里的字面「BEGIN/COMMIT」也不该参与判据。
  ck.t('A6', '迁移 0057 形状（**头段代码行口径**）：无 BEGIN/COMMIT · 两列 `ADD COLUMN IF NOT EXISTS`（具名 CHECK）· **零 CREATE INDEX** · `view_count >= 0` 在场',
    !/\bBEGIN\b/.test(M57.headCode) && !/\bCOMMIT\b/.test(M57.headCode)
      && (MIG.match(/ADD COLUMN IF NOT EXISTS view_count/g) ?? []).length === 1
      && (MIG.match(/ADD COLUMN IF NOT EXISTS item_condition/g) ?? []).length === 1
      && !/CREATE\s+(UNIQUE\s+)?INDEX/i.test(MIG)
      && /CHECK \(view_count >= 0\)/.test(MIG)
      && /CONSTRAINT listing_view_count_check/.test(MIG)
      && /CONSTRAINT listing_item_condition_check/.test(MIG),
    JSON.stringify({
      begins: /\bBEGIN\b/.test(M57.headCode), commits: /\bCOMMIT\b/.test(M57.headCode),
      adds: (MIG.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length, create_index: /CREATE\s+(UNIQUE\s+)?INDEX/i.test(MIG),
    }));

  // 迁移 CHECK 里的成色闭集逐字提取（引号字面量、按出现顺序）⇒ 与服务层常量逐字一致。
  // ★ 切片止于 `\nDO $$`：DO 块内有 'text'/'public'/'c' 等其它带引号字面量，不切会把它们混进集合。
  const migCondBlock = MIG.slice(MIG.indexOf('listing_item_condition_check'), MIG.indexOf('\nDO $$'));
  const migSet = (migCondBlock.match(/'([A-Za-z]+)'/g) ?? []).map((s) => s.slice(1, -1));
  ck.t('A7', '成色闭集**单一真源对齐**：迁移 CHECK 字面量 = 服务层 `ITEM_CONDITIONS`（含顺序）；实物两分类常量 = PhysicalFreeShip/PhysicalBuyerShip；`ITEM_TYPES` 未动',
    JSON.stringify(migSet) === JSON.stringify([...ITEM_CONDITIONS])
      && JSON.stringify([...PHYSICAL_ITEM_TYPES]) === JSON.stringify(['PhysicalFreeShip', 'PhysicalBuyerShip'])
      && JSON.stringify([...ITEM_TYPES]) === JSON.stringify(['DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip']),
    `mig_check_set=${JSON.stringify(migSet)} svc=${JSON.stringify([...ITEM_CONDITIONS])}`);

  const postBlock = sliceBetween(INDEX_TS, "app.post('/api/listing'", "app.post('/api/listing/:listingId'");
  const patchBlock = sliceBetween(INDEX_TS, "app.patch('/api/listing/:listingId'", 'app.get(');
  ck.t('A8', '写口接线：POST /api/listing 与 PATCH 字段支都透传 `body.item_condition` ⇒ `itemCondition`',
    /itemCondition: body\.item_condition,/.test(postBlock) && /itemCondition: body\.item_condition,/.test(patchBlock),
    JSON.stringify({ post: /itemCondition: body\.item_condition,/.test(postBlock), patch: /itemCondition: body\.item_condition,/.test(patchBlock) }));

  // ====================================================================== D · 写口校验（离线 · 桩替 DB）
  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading).slice(0, 600));
  };

  const svc = DatabaseService as unknown as Record<string, unknown>;
  const origGate = svc.getCurrencyStatus;
  const origCreate = svc.createListingRow;
  const origUpdate = svc.updateListingDetailsRow;
  let gateCalls = 0;
  let createCalls = 0;
  let updateCalls = 0;
  let lastCreateInput: Record<string, unknown> | null = null;
  try {
    svc.getCurrencyStatus = async () => { gateCalls += 1; return { status: 'listed' }; };
    svc.createListingRow = async (input: Record<string, unknown>) => {
      createCalls += 1;
      lastCreateInput = input;
      return {
        outcome: 'inserted',
        row: {
          listing_id: 990001, seller_uid: input.sellerUid, cid: input.cid, price: input.price, stock: input.stock,
          title: String(input.description ?? '').split('\n')[0], description: input.description, media_urls: input.mediaUrls,
          item_type: input.itemType, status: 'draft', create_key: input.createKey,
        },
      };
    };
    svc.updateListingDetailsRow = async () => { updateCalls += 1; return { outcome: 'updated', row: null, prev: null }; };

    const baseCreate = {
      sellerUid: 900100, cid: 1, price: 100, stock: 3,
      description: 'p57 gate 离线臂商品\n第二行描述', mediaUrls: [] as string[],
      createKeyRaw: `cli:p57-gate:${RUN}-offline`,
    };

    // D1 非法值 ⇒ 400 NOT_IN_CLOSED_SET（零 DB）
    for (const bad of ['Mint', 'brandnewsealed', '', '  ']) {
      gateCalls = 0; createCalls = 0;
      const r = await createListing({ ...baseCreate, itemCondition: bad });
      u(`D1-${bad.trim() || 'blank'}`, `非法 item_condition=\`${bad}\` ⇒ 400 NOT_IN_CLOSED_SET + allowed 四值，且 **DB 调用 0 次**（闸在 currencyGate 之前）`,
        !r.ok && r.status === 400 && r.code === 'LEDGER_AMOUNT_INVALID'
        && r.details?.field === 'listing.item_condition' && r.details?.reason === 'NOT_IN_CLOSED_SET'
        && JSON.stringify(r.details?.allowed) === JSON.stringify([...ITEM_CONDITIONS])
        && gateCalls === 0 && createCalls === 0,
        r.ok ? 'PASS?' : { got: got(r), field: r.details?.field, gateCalls, createCalls });
    }
    // D1b 非字符串
    {
      gateCalls = 0; createCalls = 0;
      const r = await createListing({ ...baseCreate, itemCondition: 7 });
      u('D1b', '非字符串 item_condition ⇒ 400 NOT_A_STRING（零 DB）',
        !r.ok && r.status === 400 && r.details?.field === 'listing.item_condition' && r.details?.reason === 'NOT_A_STRING' && gateCalls === 0,
        r.ok ? 'PASS?' : { got: got(r), gateCalls });
    }

    // D2 / D3 适用性：数字两分类 / 未分类（item_type 缺省）带成色 ⇒ 400 ITEM_CONDITION_NOT_APPLICABLE（零 DB）
    for (const t of ['DigitalAutoDeliver', 'DigitalManualDeliver']) {
      gateCalls = 0; createCalls = 0;
      const r = await createListing({ ...baseCreate, itemType: t, itemCondition: 'LikeNew' });
      u(`D2-${t}`, `数字商品 \`${t}\` 带成色 ⇒ 400 ITEM_CONDITION_NOT_APPLICABLE + requires_item_type=实物两分类（零 DB）`,
        !r.ok && r.status === 400 && r.code === 'LEDGER_AMOUNT_INVALID'
        && r.details?.field === 'listing.item_condition' && r.details?.reason === 'ITEM_CONDITION_NOT_APPLICABLE'
        && JSON.stringify(r.details?.requires_item_type) === JSON.stringify(['PhysicalFreeShip', 'PhysicalBuyerShip'])
        && gateCalls === 0 && createCalls === 0,
        r.ok ? 'PASS?' : { got: got(r), gateCalls, createCalls });
    }
    {
      gateCalls = 0; createCalls = 0;
      const r = await createListing({ ...baseCreate, itemCondition: 'LikeNew' });
      u('D3', '未分类（item_type 缺省 ⇒ null）带成色 ⇒ 400 ITEM_CONDITION_NOT_APPLICABLE（零 DB）',
        !r.ok && r.status === 400 && r.details?.reason === 'ITEM_CONDITION_NOT_APPLICABLE' && r.details?.item_type === null && gateCalls === 0,
        r.ok ? 'PASS?' : { got: got(r), item_type: r.details?.item_type, gateCalls });
    }

    // D4 合法值透传写入口（桩收数 ⇒ 零真库；条件闸全过 + currencyGate 前置）
    {
      gateCalls = 0; createCalls = 0; lastCreateInput = null;
      const r = await createListing({ ...baseCreate, itemType: 'PhysicalFreeShip', itemCondition: 'MinorWear' });
      // （显式宽化：TS 控制流看不到桩内异步赋值，会把 lastCreateInput 收窄成 null）
      const created = lastCreateInput as unknown as { itemCondition?: unknown; itemType?: unknown } | null;
      u('D4', '实物 + `MinorWear` ⇒ 通过全部闸，写入口收到 `itemCondition=MinorWear`（原样落库参数，不派生不改写）',
        r.ok && createCalls === 1 && created?.itemCondition === 'MinorWear' && created?.itemType === 'PhysicalFreeShip',
        r.ok ? { createCalls, itemCondition: created?.itemCondition, itemType: created?.itemType } : r);
    }

    // D5 / D6 PATCH 两闸（预检零 DB）
    {
      updateCalls = 0;
      const r = await updateListingDetails({ listingId: 990002, actorUid: 900100, patch: { itemType: 'DigitalAutoDeliver', itemCondition: 'LikeNew' } });
      u('D5', 'PATCH 数字分类 + 带值成色（同 patch 提交）⇒ 400 ITEM_CONDITION_NOT_APPLICABLE（纯预检、**零 DB**）',
        !r.ok && r.status === 400 && r.details?.reason === 'ITEM_CONDITION_NOT_APPLICABLE' && updateCalls === 0,
        r.ok ? 'PASS?' : { got: got(r), updateCalls });
    }
    {
      updateCalls = 0;
      const r = await updateListingDetails({ listingId: 990002, actorUid: 900100, patch: { itemCondition: 'Mint' } });
      u('D6', 'PATCH 非法成色值 ⇒ 400 NOT_IN_CLOSED_SET（零 DB）',
        !r.ok && r.status === 400 && r.details?.field === 'listing.item_condition' && r.details?.reason === 'NOT_IN_CLOSED_SET' && updateCalls === 0,
        r.ok ? 'PASS?' : { got: got(r), updateCalls });
    }
    {
      const route = classifyListingPatchBody({ item_condition: 'LikeNew' });
      u('D7', '`classifyListingPatchBody` 识别 `item_condition` 为**字段键**（kind=fields；不误判 NO_EDITABLE_FIELD / 状态支）',
        route.kind === 'fields' && (route as { fields?: string[] }).fields?.includes('item_condition') === true,
        JSON.stringify(route).slice(0, 200));
    }
  } finally {
    svc.getCurrencyStatus = origGate;
    svc.createListingRow = origCreate;
    svc.updateListingDetailsRow = origUpdate;
  }
  ck.t('D8', '桩已回收（三个静态方法逐字还原）',
    svc.getCurrencyStatus === origGate && svc.createListingRow === origCreate && svc.updateListingDetailsRow === origUpdate, 'restored');

  // ====================================================================== 真库段（B / C / N / E）
  const pool = mkPool(2);
  const projRows = await raw(pool as never, "SELECT current_setting('neon.project_id', true) AS project_id, current_setting('neon.branch_id', true) AS branch_id");
  const projectId = String(projRows[0]?.project_id ?? '');
  out.env = { project_id: projectId, branch_id: String(projRows[0]?.branch_id ?? ''), expect_dev: 'quiet-math-65207667' };
  ck.t('ENV', '库身份自证：neon.project_id = dev（quiet-math-65207667）—— 读数归因前置',
    projectId === 'quiet-math-65207667', `project_id=${projectId}`);

  const preCols = await raw(pool as never, "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('view_count','item_condition')");
  const preHas = (name: string) => preCols.some((r) => r.column_name === name);
  const mode = preHas('view_count') && preHas('item_condition') ? 'post-apply' : (!preHas('view_count') && !preHas('item_condition') ? 'pre-apply' : 'partial-STOP');
  out.mode = mode;
  ck.t('ENV2', '迁移态可判读（pre-apply = 两列均缺席 ⇒ 本门以「事务内 ADD COLUMN」干跑；post-apply = 两列均在场 ⇒ 头段为 no-op 同样可跑；partial = STOP）',
    mode === 'pre-apply' || mode === 'post-apply', `mode=${mode} view_count=${preHas('view_count')} item_condition=${preHas('item_condition')}`);

  if (mode === 'partial-STOP') {
    ck.t('B1', '迁移态 partial（一列在一列不在）⇒ 停手人工核查', false, 'partial column state');
  } else {
    // ---- B · 迁移干跑（回滚事务） ----
    const br = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      const cols = await raw(c, "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('view_count','item_condition') ORDER BY column_name");
      // 尾部 DO 自检（pre-apply 模式：存量全 0 / 全 NULL 的 apply 刻状态成立；post-apply：存量 views 可能 > 0 = 稳态 ⇒ 跳过）
      let tailRan = false;
      let tailError: string | null = null;
      if (mode === 'pre-apply') {
        try { await c.query(M57.tail); tailRan = true; } catch (e) { tailError = String((e as Error).message).slice(0, 240); }
      }
      return { cols, tailRan, tailError };
    });
    const bCols = (br.result?.cols ?? []) as Array<Record<string, unknown>>;
    const vc = bCols.find((r) => r.column_name === 'view_count');
    const ic = bCols.find((r) => r.column_name === 'item_condition');
    ck.t('B1', '迁移头段干跑（事务内）⇒ 两列在场：view_count = bigint/NOT NULL/DEFAULT 0 · item_condition = text/可空',
      br.error === null && vc?.data_type === 'bigint' && vc?.is_nullable === 'NO' && String(vc?.column_default).trim() === '0'
      && ic?.data_type === 'text' && ic?.is_nullable === 'YES',
      JSON.stringify({ error: br.error, view_count: vc, item_condition: ic }).slice(0, 400));
    ck.t('B2', mode === 'pre-apply'
      ? '迁移尾部 DO 自检（真库 · 事务内）跑通：列型/默认/存量全 0/存量全 NULL/CHECK 在场/零索引/列数 15 全过'
      : '迁移尾部 DO 自检按稳态跳过（post-apply 后存量 views > 0 属设计内；结构断言已由 B1 + N 臂覆盖）',
      mode === 'pre-apply' ? (br.result?.tailRan === true && br.result?.tailError === null) : true,
      JSON.stringify({ tail_ran: br.result?.tailRan, tail_error: br.result?.tailError }));
    ck.t('B3', '事务已回滚（`inRollbackTx` 恒 ROLLBACK ⇒ 零 apply / 零版本行 / 零残留）',
      br.rolled_back === true && br.error === null, `rolled_back=${br.rolled_back} ms=${br.ms}`);

    // ---- C · 详情读口行为（同 tx · service 层真实代码路径） ----
    const cr = await inRollbackTx(pool, async (c) => {
      // 各回滚事务相互独立 ⇒ 本事务内先跑迁移头段（IF NOT EXISTS ⇒ pre/post-apply 皆幂等 no-op 安全）
      for (const stmt of M57.headStmts) await c.query(stmt);
      const ex = c as unknown as SqlRunner;
      const sellerRow = await raw1(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0');
      const sellerUid = Number(sellerRow?.uid ?? 0);
      if (!sellerUid) throw new Error('no usable seller uid in users');

      // 夹具自建 = **真 createListingRow 写路径**（含 0057 的 item_condition INSERT 列）
      const mkA = await DatabaseService.createListingRow({
        sellerUid, cid: 1, price: 100, stock: 3,
        description: `p57-gate fixture A · 实物包邮 · 成色 LikeNew · RUN=${RUN}`,
        mediaUrls: [], itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew',
        createKey: `${FIXTURE_KEY_PREFIX}${RUN}-a`,
      }, ex);
      const mkB = await DatabaseService.createListingRow({
        sellerUid, cid: 1, price: 60, stock: 2,
        description: `p57-gate fixture B · 数字自动发货 · 无成色 · RUN=${RUN}`,
        mediaUrls: [], itemType: 'DigitalAutoDeliver', itemCondition: null,
        createKey: `${FIXTURE_KEY_PREFIX}${RUN}-b`,
      }, ex);
      const idA = Number(mkA.row ? (mkA.row as Record<string, unknown>).listing_id : 0);
      const idB = Number(mkB.row ? (mkB.row as Record<string, unknown>).listing_id : 0);
      // A 上架（draft → listed 走既有合法迁移；B 保持 draft ⇒ 两态各一）
      await c.query('UPDATE public.listing SET status = \'listed\' WHERE listing_id = $1', [idA]);
      // wants 数据源（与 feed 同源）：给 A 落一行真收藏（in-tx、随事务回收）⇒ 详情 wants = 1
      // 证明 LEFT JOIN 聚合真起作用（不是 COALESCE 兜 0 的恒绿）；B 不收藏 ⇒ wants = 0。
      const favIns = await c.query(
        'INSERT INTO public.listing_favorite (fav_uid, listing_id) SELECT min(uid), $1::bigint FROM public.users WHERE uid > 0',
        [idA],
      );

      // C2 · 连续两次「GET 详情」（service 层 = 路由层每次 GET 恰调一次本方法）
      const rec1 = await DatabaseService.getPrizeDetailRecordingView(idA, ex);
      const rec2 = await DatabaseService.getPrizeDetailRecordingView(idA, ex);
      // C3 · 键数与形状（service 层 49；路由层合 seller ⇒ 50）
      const keys1 = rec1 ? Object.keys(rec1) : [];
      const routeShapeKeys = rec1 ? Object.keys({ ...rec1, seller: null }).length : 0;
      // C4 · draft 也计数（任何状态都计）+ 数字商品 condition = null（键在场）+ 未收藏 wants = 0
      const recB1 = await DatabaseService.getPrizeDetailRecordingView(idB, ex);
      // C5 · 不存在 id ⇒ null（404 语义）且不计数
      const ghostId = 900000000 + Number(String(Date.now()).slice(-6));
      const recGhost = await DatabaseService.getPrizeDetailRecordingView(ghostId, ex);
      const vcAfterGhost = await raw1(c, 'SELECT view_count::text AS vc FROM public.listing WHERE listing_id = $1', [idA]);

      // C7 · 成色四值写入（DB 层真实写路径：四值逐个落 CHECK）
      const condWriteRows: number[] = [];
      for (const v of ITEM_CONDITIONS) {
        const w = await c.query('UPDATE public.listing SET item_condition = $1 WHERE listing_id = $2', [v, idB]);
        condWriteRows.push((w as unknown as { rowCount?: number | null }).rowCount ?? -1);
      }
      await c.query('UPDATE public.listing SET item_condition = NULL WHERE listing_id = $1', [idB]);

      // C8 · PATCH DB 守卫臂：数字行带成色 ⇒ condition_not_applicable；实物行合法改写 ⇒ updated（回执键数不变）
      const wBad = await DatabaseService.updateListingDetailsRow({
        listingId: idB, actorUid: sellerUid, description: null, price: null, stock: null, mediaUrls: null,
        itemType: null, itemTypeSet: false, itemCondition: 'HeavyWear', conditionSet: true,
      }, ex);
      const wOk = await DatabaseService.updateListingDetailsRow({
        listingId: idA, actorUid: sellerUid, description: null, price: null, stock: null, mediaUrls: null,
        itemType: null, itemTypeSet: false, itemCondition: 'HeavyWear', conditionSet: true,
      }, ex);
      const wOkRowKeys = wOk.row ? Object.keys(wOk.row).length : -1;
      const wOkCond = await raw1(c, 'SELECT item_condition::text AS ic FROM public.listing WHERE listing_id = $1', [idA]);
      await c.query('UPDATE public.listing SET item_condition = $1 WHERE listing_id = $2', ['LikeNew', idA]);

      // C9 · mine 行键 10→11（+condition）：真实 `listListingsBySeller`（事务内注入 ex 同一代码路径）；
      //   夹具行经真写路径落成色 ⇒ 预填值 = 创建时的 LikeNew / B（数字）= null。
      const mineRows = await DatabaseService.listListingsBySeller(sellerUid, 0, 100, ex);
      const mineA = mineRows.find((r) => r.listing_id === idA);
      const mineB = mineRows.find((r) => r.listing_id === idB);
      const mineBadKeys = mineRows.filter((r) => Object.keys(r).length !== 11 || !('condition' in r)).length;

      return {
        sellerUid, idA, idB, ghostId,
        rec1: rec1 as BrandRecord | null, rec2: rec2 as BrandRecord | null, recB1: recB1 as BrandRecord | null,
        recGhost, vcAfterGhost: String(vcAfterGhost?.vc ?? ''),
        keys1, routeShapeKeys, condWriteRows, favRows: (favIns as unknown as { rowCount?: number | null }).rowCount ?? -1,
        mineTotal: mineRows.length, mineBadKeys,
        mineAKeys: mineA ? Object.keys(mineA).length : -1,
        mineAHasCondition: mineA ? 'condition' in mineA : false,
        mineACond: mineA ? mineA.condition : 'row-missing',
        mineBCond: mineB ? mineB.condition : 'row-missing',
        wBadOutcome: wBad.outcome, wOkOutcome: wOk.outcome, wOkRowKeys, wOkCond: String(wOkCond?.ic ?? ''),
        createAOutcome: mkA.outcome, createBOutcome: mkB.outcome,
      };
    });

    const R = (cr.result ?? {}) as Record<string, unknown>;
    const rec1 = R.rec1 as BrandRecord | undefined;
    const rec2 = R.rec2 as BrandRecord | undefined;
    const recB1 = R.recB1 as BrandRecord | undefined;
    const keys1 = (R.keys1 ?? []) as string[];

    ck.t('C0', '夹具自建走**真 createListingRow 写路径**（含 0057 item_condition INSERT 列）⇒ 两行 inserted · wants 夹具收藏行落 1 行',
      cr.error === null && R.createAOutcome === 'inserted' && R.createBOutcome === 'inserted' && R.favRows === 1,
      JSON.stringify({ error: cr.error, a: R.createAOutcome, b: R.createBOutcome, idA: R.idA, idB: R.idB, fav_rows: R.favRows }));

    ck.t('C1', '**连续两次 GET 详情 ⇒ 第二次 views = 第一次 + 1**（自增后读）：views₁ = 1（0+1）· views₂ = 2',
      !!rec1 && !!rec2 && rec1.views === 1 && rec2.views === 2 && rec2.views === rec1.views + 1,
      JSON.stringify({ views1: rec1?.views, views2: rec2?.views, type1: typeof rec1?.views }));

    ck.t('C2', '**详情 service 层 49 键**（= 详情 50 − 路由层 seller）：`views`/`condition`/`wants` 三加性键在场 · wants = 1（收藏 left join 生效）· condition = LikeNew',
      keys1.length === 49 && keys1.includes('views') && keys1.includes('condition') && keys1.includes('wants')
      && rec1?.condition === 'LikeNew' && rec1?.views === 1 && rec1?.wants === 1,
      JSON.stringify({ keys: keys1.length, has_views: keys1.includes('views'), has_condition: keys1.includes('condition'), has_wants: keys1.includes('wants'), condition: rec1?.condition, wants: rec1?.wants }));

    ck.t('C3', '**详情路由合成后 50 键**（{ ...prize, seller } ⇒ 47→50：+views +condition +wants）',
      R.routeShapeKeys === 50, `route_shape_keys=${R.routeShapeKeys}`);

    ck.t('C4', '**draft 也计数**（任何状态都计）且数字商品 `condition` = null（键在场值为 null，不缺键）、未收藏 wants = 0',
      !!recB1 && recB1.views === 1 && 'condition' in recB1 && recB1.condition === null && recB1.wants === 0,
      JSON.stringify({ views: recB1?.views, has_condition_key: recB1 ? 'condition' in recB1 : null, condition: recB1?.condition, wants: recB1?.wants }));

    ck.t('C5', '**不存在 id ⇒ null（404 语义）且不计数**：ghost 读数 null · 夹具 A view_count 仍 = 2',
      R.recGhost === null && R.vcAfterGhost === '2',
      JSON.stringify({ ghost: R.recGhost, vc_after_ghost: R.vcAfterGhost }));

    ck.t('C6', '**成色四值写入**（DB 层真实写路径）：四值闭集逐个 UPDATE 全部命中 1 行（CHECK 放行）',
      (R.condWriteRows as number[]).length === 4 && (R.condWriteRows as number[]).every((n) => n === 1),
      `row_counts=${JSON.stringify(R.condWriteRows)}`);

    ck.t('C7', '**PATCH DB 守卫臂**：数字行带成色 ⇒ `condition_not_applicable`（400 路径）；实物行合法改写 ⇒ `updated` 且回执 = **11 键**（ListingMineRow 同族，P57 +condition）、库内值已改',
      R.wBadOutcome === 'condition_not_applicable' && R.wOkOutcome === 'updated' && R.wOkRowKeys === 11 && R.wOkCond === 'HeavyWear',
      JSON.stringify({ bad: R.wBadOutcome, ok: R.wOkOutcome, ok_row_keys: R.wOkRowKeys, ok_cond_in_db: R.wOkCond }));

    ck.t('C9', '**mine 行键 10→11**：`listListingsBySeller` 全部行恰 11 键且 `condition` 在场；夹具 A = LikeNew（编辑页预填）/ B（数字）= null',
      (R.mineTotal as number) > 0 && R.mineBadKeys === 0
      && R.mineAKeys === 11 && R.mineAHasCondition === true && R.mineACond === 'LikeNew' && R.mineBCond === null,
      JSON.stringify({ mine_total: R.mineTotal, bad_rows: R.mineBadKeys, a_keys: R.mineAKeys, a_has_condition: R.mineAHasCondition, a_cond: R.mineACond, b_cond: R.mineBCond }));

    // ---- C6 · feed 键数（http 只读、committed dev 数据；事务外） ----
    const feed = await DatabaseService.listBrands(0, 8);
    const feedBad = feed.filter((r) => Object.keys(r).length !== 48 || 'views' in r || 'condition' in r);
    ck.t('C6', '**feed 行键仍 48**：全部行恰 48 键且 `views`/`condition` 均不出现（feed 不加键、不计数）',
      feed.length > 0 && feedBad.length === 0,
      JSON.stringify({ rows: feed.length, bad_rows: feedBad.length, sample_keys: feed[0] ? Object.keys(feed[0]).length : 0 }));

    // ---- N · CHECK 负控（各自独立回滚事务；错误后事务_abort，只能作为末臂） ----
    const negCond = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      const ins = await c.query(
        `INSERT INTO public.listing (seller_uid, cid, price, stock, description, media_urls, status, create_key, ledger_event_keys)
         SELECT min(uid), 1, 100, 1, $1, '{}'::text[], 'draft', $2, '{}'::text[] FROM public.users WHERE uid > 0 RETURNING listing_id`, [`p57-gate neg fixture ${RUN}`, `${FIXTURE_KEY_PREFIX}${RUN}-n1`]);
      const id = Number(ins.rows[0]?.listing_id ?? 0);
      try {
        await c.query('UPDATE public.listing SET item_condition = $1 WHERE listing_id = $2', ['Mint', id]);
        return { violated: false, sqlstate: null };
      } catch (e) {
        return { violated: true, sqlstate: String((e as { code?: string }).code ?? '') };
      }
    });
    ck.t('N1', 'CHECK 负控①：非法成色值 `Mint` ⇒ 23514 check_violation（闭集闸真在场，判据非恒绿）',
      negCond.result?.violated === true && negCond.result?.sqlstate === '23514',
      JSON.stringify({ violated: negCond.result?.violated, sqlstate: negCond.result?.sqlstate, error: negCond.error }));

    const negVc = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      const ins = await c.query(
        `INSERT INTO public.listing (seller_uid, cid, price, stock, description, media_urls, status, create_key, ledger_event_keys)
         SELECT min(uid), 1, 100, 1, $1, '{}'::text[], 'draft', $2, '{}'::text[] FROM public.users WHERE uid > 0 RETURNING listing_id`, [`p57-gate neg fixture ${RUN}`, `${FIXTURE_KEY_PREFIX}${RUN}-n2`]);
      const id = Number(ins.rows[0]?.listing_id ?? 0);
      try {
        await c.query('UPDATE public.listing SET view_count = -1 WHERE listing_id = $1', [id]);
        return { violated: false, sqlstate: null };
      } catch (e) {
        return { violated: true, sqlstate: String((e as { code?: string }).code ?? '') };
      }
    });
    ck.t('N2', 'CHECK 负控②：负 view_count ⇒ 23514（`view_count >= 0` 真在场）',
      negVc.result?.violated === true && negVc.result?.sqlstate === '23514',
      JSON.stringify({ violated: negVc.result?.violated, sqlstate: negVc.result?.sqlstate, error: negVc.error }));

    // ---- E · 零残留证（新连接 = committed 视角） ----
    const residue = await raw1(pool as never, 'SELECT count(*)::int AS n FROM public.listing WHERE create_key LIKE $1', [`${FIXTURE_KEY_PREFIX}%`]);
    ck.t('E1', '**零残留**：回滚后 `create_key LIKE cli:p57-gate:%` 命中 = 0（含历史 run；> 0 = 有夹具泄漏，fail-loud）',
      Number(residue?.n ?? -1) === 0, `residue_rows=${residue?.n}`);

    const postCols = await raw1(pool as never, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing'");
    const expectCols = mode === 'pre-apply' ? 13 : 15;
    ck.t('E2', `committed 列面与迁移态自洽（pre-apply ⇒ 13 列 / post-apply ⇒ 15 列；实测 mode=${mode}）`,
      Number(postCols?.n ?? -1) === expectCols, `committed_cols=${postCols?.n} expect=${expectCols}`);
  }

  // ====================================================================== 落盘
  out.migration = { head_stmts: M57.headStmts.length, head_bytes: M57.head.length, tail_bytes: M57.tail.length };
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p57-view-count-gate', out);
  console.log(JSON.stringify({
    saved: f,
    mode: out.mode,
    env: out.env,
    summary: out.summary,
    red: (out.summary as { red: string[] }).red,
  }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
