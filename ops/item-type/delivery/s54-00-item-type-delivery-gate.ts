/**
 * s54-00 · 商品分类「数字商品拆分」后端门（迁移 0054 · 闭集 3 值 → 4 值 · 裸值 `Digital` 退役）
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/item-type/delivery/s54-00-item-type-delivery-gate.ts
 * 读数：`ops/item-type/delivery/readings/s54-item-type-delivery-gate-<RUN>.json`
 *
 * 判据面：
 *   A · 迁移面（`0054_item_type_delivery_split.sql` 纯文本：DROP IF EXISTS + ADD 四值闭集、无 DML/BEGIN/COMMIT、
 *       尾部 DO 自检 4 面齐全、0050–0053 与 HEAD 逐字未变）
 *   B · 写口面（`ITEM_TYPES` 四值 + 顺序 + 与迁移 CHECK 逐字一致；`normalizeItemType`；`createListing` 桩）
 *       ★ 负控 1：裸值 `Digital` ⇒ **400 NOT_IN_CLOSED_SET** 且 **零 DB 调用**（退役生效）
 *   C · 读口面（**只读** SELECT：feed 48 键 / 详情 47 键，`item_type` 恒在场、值 ∈ 闭集 ∪ {null}）
 *   P · preflight（**只读**，不 apply：`schema_migration` 顶 / PENDING / 约束定义 / 存量计数）
 *   D · 迁移干跑（**inRollbackTx ⇒ 零残留**：0054 首跑+重跑、四值写入、`NULL` 放行、
 *       ★ 负控 2：裸 `Digital` 被 CHECK 拒 = 23514；★ 自检器灵敏度两臂：造「四值+裸 Digital」/ 退回 0053 三值
 *       ⇒ 0054 尾部自检必须 RAISE）
 *
 * 纪律：apply 由 Zang 执行，本脚本**绝不**写版本表、绝不 apply；一切写探针都在 ROLLBACK 事务内。
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { checker, inRollbackTx, mkPool, raw, sp } from '../../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../../backend-ts/src/database';
import { getPrizeSellerView } from '../../../backend-ts/src/messages-service';
import { createListing, normalizeItemType, ITEM_TYPES } from '../../../backend-ts/src/listing-service';

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../../..');
const REPO_BACKEND = path.join(REPO_ROOT, 'backend-ts');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
/** 去 `--` 行注释与块注释后比较（迁移头注会**叙述**「不写 BEGIN/COMMIT」「零 DML」） */
const stripSqlComments = (sql: string) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
const closedSetOf = (code: string): string[] => {
  const m = code.match(/item_type IN \(([^)]*)\)/);
  return m ? (m[1].match(/'([^']+)'/g) ?? []).map((s) => s.slice(1, -1)) : [];
};
/** 裸值 `Digital` 在约束定义里的命中（终止符 = `,` / `)` / 数组收尾 `]` / 行尾）—— 不误伤 `DigitalAutoDeliver` */
const BARE_DIGITAL = /'Digital'(::text)?([,)\]]|$)/;
const EXPECTED = ['DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip'];

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/item-type/delivery/s54-00-item-type-delivery-gate.ts' };

  // ======================================================= A · 迁移面（0054 · 纯文本）
  const MIG54_REL = 'backend-ts/migrations/0054_item_type_delivery_split.sql';
  const MIG54_PATH = path.resolve(REPO_ROOT, MIG54_REL);
  const MIG54_EXISTS = fs.existsSync(MIG54_PATH);
  const MIG54_SQL = MIG54_EXISTS ? fs.readFileSync(MIG54_PATH, 'utf8') : '';
  const MIG54_CODE = stripSqlComments(MIG54_SQL).replace(/\s+/g, ' ').trim();
  const SELFCHECK_AT = MIG54_SQL.indexOf('-- 尾部自检');
  const MIG54_DDL = SELFCHECK_AT > 0 ? MIG54_SQL.slice(0, SELFCHECK_AT) : MIG54_SQL;
  const MIG54_SELFCHECK = SELFCHECK_AT > 0 ? MIG54_SQL.slice(SELFCHECK_AT) : MIG54_SQL;
  const migFiles = fs.readdirSync(path.join(REPO_BACKEND, 'migrations')).filter((f) => f.endsWith('.sql')).sort();
  const versions = migFiles.map((f) => (f.match(/^(\d+)/) ?? [, ''])[1] as string);

  ck.t('A0', '迁移 `0054_item_type_delivery_split.sql` 在场，且编号现取 = 目录最大版本（同链无 0055）',
    MIG54_EXISTS && versions[versions.length - 1] === '0054' && /^0054_item_type_delivery_split\.sql$/.test(migFiles[migFiles.length - 1]),
    `files=${migFiles.length} max=${versions[versions.length - 1]}`);

  ck.t('A1', '先 `DROP CONSTRAINT IF EXISTS listing_item_type_check`（先删后加 ⇒ 反复 apply 同终态、库内恰 1 条）',
    /ALTER TABLE public\.listing DROP CONSTRAINT IF EXISTS listing_item_type_check;/.test(MIG54_CODE),
    `hits=${(MIG54_CODE.match(/DROP CONSTRAINT IF EXISTS listing_item_type_check/g) ?? []).length}`);

  ck.t('A2', `四值 CHECK 逐字（${EXPECTED.join(' / ')}）+ 允许 NULL`,
    /ADD CONSTRAINT listing_item_type_check CHECK \(item_type IS NULL OR item_type IN \('DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip'\)\)/.test(MIG54_CODE),
    `closed_set=${JSON.stringify(closedSetOf(MIG54_CODE))}`);

  ck.t('A3', '闭集 = 恰四值且与 `ITEM_TYPES` 逐字（含顺序）；**不含裸值 `Digital`**',
    JSON.stringify(closedSetOf(MIG54_CODE)) === JSON.stringify(EXPECTED)
      && JSON.stringify([...ITEM_TYPES]) === JSON.stringify(EXPECTED)
      && !BARE_DIGITAL.test(closedSetOf(MIG54_CODE).map((v) => `'${v}'`).join(',') + ']'),
    `closed_set=${JSON.stringify(closedSetOf(MIG54_CODE))} ITEM_TYPES=${JSON.stringify(ITEM_TYPES)}`);

  ck.t('A4', '文件内**无**事务控制 `BEGIN;/COMMIT;/END;`、无 `START TRANSACTION`（DO 块内 PL/pgSQL `BEGIN…END` 不算）',
    !/^\s*(BEGIN|COMMIT|END)\s*;\s*$/im.test(MIG54_CODE) && !/START\s+TRANSACTION/i.test(MIG54_CODE),
    `do_blocks=${(MIG54_SQL.match(/DO \$\$/g) ?? []).length}`);

  ck.t('A5', '零 DML：无 `UPDATE`/`INSERT`/`DELETE`/`TRUNCATE`/`DEFAULT`（只换约束集、存量不回填）',
    !/\b(UPDATE|INSERT|DELETE|TRUNCATE)\b/i.test(MIG54_CODE) && !/DEFAULT/i.test(MIG54_CODE),
    `dml_hits=${(MIG54_CODE.match(/\b(UPDATE|INSERT|DELETE|TRUNCATE)\b/gi) ?? []).length}`);

  const selfCheckTokens = ['item_type missing', 'type is % (expect text)', 'is not nullable',
    'expect exactly 1 item_type CHECK', 'constraint listing_item_type_check missing', 'lacks 4-value closed set',
    'retired value Digital (bare) still accepted', 'must allow NULL', 'still item_type=Digital', 'outside 4-value closed set'];
  ck.t('A6', '尾部 DO 自检 4 面齐全（① 约束在场/恰 1 条/含四值/不含裸 Digital/允许 NULL · ② `Digital` 行 = 0 · ③ 非法值 = 0 · ④ 列仍可空 text）',
    selfCheckTokens.every((s) => MIG54_SQL.includes(s)),
    `hits=${selfCheckTokens.filter((s) => MIG54_SQL.includes(s)).length}/${selfCheckTokens.length} selfcheck_bytes=${MIG54_SELFCHECK.length}`);

  let histDiff = '';
  try {
    histDiff = execFileSync('git', ['-C', REPO_ROOT, 'status', '--porcelain', '--', 'backend-ts/migrations'], { encoding: 'utf8' }).trim();
  } catch (e) {
    histDiff = `GIT_ERR:${String((e as Error).message).slice(0, 80)}`;
  }
  const touched = histDiff.split('\n').filter(Boolean);
  const histFiles = ['0050_media_store.sql', '0051_media_size_cap_1mb.sql', '0052_users_avatar_url.sql', '0053_listing_item_type.sql'];
  let histUnchanged = true;
  const histRead: Array<Record<string, unknown>> = [];
  for (const f of histFiles) {
    let diff = 'ERR';
    try {
      execFileSync('git', ['-C', REPO_ROOT, 'diff', '--quiet', 'HEAD', '--', `backend-ts/migrations/${f}`]);
      diff = '';
    } catch {
      diff = 'CHANGED';
    }
    if (diff !== '') histUnchanged = false;
    histRead.push({ file: f, diff });
  }
  ck.t('A7', '历史迁移零改动（0050–0053 与 HEAD **逐字相同**；工作树 migrations/ 变动只有新增 0054）',
    histUnchanged && touched.every((l) => l.includes('0054_item_type_delivery_split.sql')) && touched.length <= 2,
    JSON.stringify({ touched, hist: histRead }));

  // ======================================================= B · 写口面（静态 + 桩）
  const INDEX_TS = readSrc('backend-ts/src/index.ts');
  const SVC = readSrc('backend-ts/src/listing-service.ts');
  const DB = readSrc('backend-ts/src/database.ts');

  ck.t('B1', '`ITEM_TYPES` = 四值、顺序逐字（`DigitalAutoDeliver` / `DigitalManualDeliver` / `PhysicalFreeShip` / `PhysicalBuyerShip`），裸 `Digital` 不在集内',
    JSON.stringify([...ITEM_TYPES]) === JSON.stringify(EXPECTED) && !(ITEM_TYPES as readonly string[]).includes('Digital'),
    JSON.stringify(ITEM_TYPES));

  ck.t('B2', '服务层注释/真源指针指向 0054（不再把 0053 三值当现役闭集）',
    /migrations\/0054_item_type_delivery_split\.sql/.test(SVC) && /迁移 0054 换集/.test(SVC),
    'src/listing-service.ts 头注指向 0054');

  ck.t('B3', '写口/读口接线**零改动**（`index.ts` 仍 `itemType: body.item_type`；`createListingRow` 5 处 `item_type`）',
    /itemType: body\.item_type,/.test(INDEX_TS)
      && (DB.slice(DB.indexOf('static async createListingRow'), DB.indexOf('static async updateListingRow')).match(/item_type/g) ?? []).length === 5,
    `index_passthrough=${/itemType: body\.item_type,/.test(INDEX_TS)}`);

  ck.t('B4', '错误码 / reason / 闸位置未变（`LEDGER_AMOUNT_INVALID` + `NOT_IN_CLOSED_SET` + `allowed`，闸在 `currencyGate` 之前）',
    /LEDGER_AMOUNT_INVALID/.test(SVC) && /reason: 'NOT_IN_CLOSED_SET'/.test(SVC) && /allowed: \[\.\.\.ITEM_TYPES\]/.test(SVC)
      && SVC.indexOf('const itemType = normalizeItemType(params.itemType)') < SVC.indexOf('const gate = await currencyGate(cid.value)'),
    'ok');

  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading));
  };

  // U1 · 四值各通过、原值透出
  for (const v of EXPECTED) {
    const r = normalizeItemType(v);
    u(`U1-${v}`, `闭集值 \`${v}\` ⇒ 通过且原值透出`, r.ok && r.value === v, r.ok ? r.value : `ERR:${r.err.code}`);
  }
  // U2 · 未传 / null ⇒ null
  for (const [label, rawv] of [['undefined', undefined], ['null', null]] as const) {
    const r = normalizeItemType(rawv);
    u(`U2-${label}`, `未传 / ${label} ⇒ null（未分类）`, r.ok && r.value === null, r.ok ? String(r.value) : `ERR:${r.err.code}`);
  }
  // U3 · 负控 1（退役生效）· 裸 Digital ⇒ 400
  {
    const r = normalizeItemType('Digital');
    u('U3-Digital', '★ 负控 · 退役值裸 `Digital` ⇒ 400 NOT_IN_CLOSED_SET（provided=Digital、allowed=四值）',
      !r.ok && r.err.status === 400 && r.err.code === 'LEDGER_AMOUNT_INVALID'
        && r.err.details.field === 'listing.item_type' && r.err.details.reason === 'NOT_IN_CLOSED_SET'
        && r.err.details.provided === 'Digital'
        && JSON.stringify(r.err.details.allowed) === JSON.stringify(EXPECTED),
      r.ok ? 'PASS?' : { status: r.err.status, code: r.err.code, details: r.err.details });
  }
  // U4 · 其余非法形状
  for (const [label, rawv, kind] of [
    ['小写 digitalautodeliver', 'digitalautodeliver', 'NOT_IN_CLOSED_SET'],
    ['旧值 digital（小写裸值）', 'digital', 'NOT_IN_CLOSED_SET'],
    ['枚举外 Physical', 'Physical', 'NOT_IN_CLOSED_SET'],
    ['空串', '', 'NOT_IN_CLOSED_SET'],
    ['数字 123', 123, 'NOT_A_STRING'],
  ] as const) {
    const r = normalizeItemType(rawv);
    u(`U4-${label}`, `${label} ⇒ 400（${kind}）+ field=listing.item_type`,
      !r.ok && r.err.status === 400 && r.err.code === 'LEDGER_AMOUNT_INVALID'
        && r.err.details.field === 'listing.item_type' && r.err.details.reason === kind,
      r.ok ? 'PASS?' : { status: r.err.status, code: r.err.code, reason: r.err.details.reason });
  }

  // U5 · createListing 桩（替换两静态方法；零真写）
  const svc = DatabaseService as unknown as Record<string, unknown>;
  const origGate = svc.getCurrencyStatus;
  const origCreate = svc.createListingRow;
  let gateCalls = 0;
  let createCalls = 0;
  let lastInput: Record<string, unknown> | null = null;
  svc.getCurrencyStatus = async () => { gateCalls += 1; return { status: 'listed' }; };
  svc.createListingRow = async (input: Record<string, unknown>) => {
    createCalls += 1;
    lastInput = input;
    return {
      outcome: 'inserted',
      row: {
        listing_id: 990054, seller_uid: input.sellerUid, cid: input.cid, price: input.price, stock: input.stock,
        title: input.title, description: input.description, media_urls: input.mediaUrls,
        item_type: input.itemType, status: 'draft', create_key: input.createKey,
      },
    };
  };
  const baseParams = { sellerUid: 900054, cid: 1, price: 100, stock: 1, title: 'S54 桩标题', createKeyRaw: 'cli:s54:gate' };
  try {
    for (const v of EXPECTED) {
      createCalls = 0; lastInput = null; gateCalls = 0;
      const r = await createListing({ ...baseParams, itemType: v });
      u(`U5-${v}`, `createListing \`${v}\` ⇒ 200 且写入口收到 itemType='${v}'（原样落库、不派生）`,
        r.ok && createCalls === 1 && (lastInput as unknown as Record<string, unknown> | null)?.itemType === v
          && (r as { view: Record<string, unknown> }).view.item_type === v,
        r.ok ? { createCalls, itemType: (lastInput as unknown as Record<string, unknown>)?.itemType } : r);
    }
    // U6 · 未传 ⇒ null
    createCalls = 0; lastInput = null;
    const rNone = await createListing({ ...baseParams, createKeyRaw: 'cli:s54:gate:none' });
    u('U6', '未传 item_type ⇒ 写入口收到 null（= 未分类）',
      rNone.ok && (lastInput as unknown as Record<string, unknown> | null)?.itemType === null,
      rNone.ok ? { itemType: (lastInput as unknown as Record<string, unknown>)?.itemType } : rNone);

    // U7 · ★ 负控 1（写口）· 裸 Digital ⇒ 400 且**零 DB 调用**
    for (const bad of ['Digital', 'Digitalx', 'digitalAutoDeliver', ' physical']) {
      gateCalls = 0; createCalls = 0;
      const rBad = await createListing({ ...baseParams, itemType: bad });
      u(`U7-${bad.trim()}`, `非法 item_type=\`${bad}\` ⇒ 400 NOT_IN_CLOSED_SET 且 DB 调用 0 次（闸在 currencyGate 之前）`,
        !rBad.ok && rBad.status === 400 && rBad.code === 'LEDGER_AMOUNT_INVALID'
          && rBad.details.reason === 'NOT_IN_CLOSED_SET' && gateCalls === 0 && createCalls === 0,
        rBad.ok ? 'PASS?' : { status: rBad.status, code: rBad.code, reason: rBad.details.reason, gateCalls, createCalls });
    }
  } finally {
    svc.getCurrencyStatus = origGate;
    svc.createListingRow = origCreate;
  }
  ck.t('U8', '桩已回收（两静态方法逐字还原）',
    (DatabaseService as unknown as Record<string, unknown>).getCurrencyStatus === origGate
      && (DatabaseService as unknown as Record<string, unknown>).createListingRow === origCreate, 'restored');

  // ======================================================= C · 读口面（只读）
  const live: Record<string, unknown> = {};
  try {
    const feed = await DatabaseService.listBrands(0, 100);
    const keyCounts = Array.from(new Set(feed.map((r) => Object.keys(r as object).length)));
    const values = Array.from(new Set(feed.map((r) => (r as { item_type?: unknown }).item_type)));
    live.feed = { rows: feed.length, keyCounts, values: values.map((v) => (v === null ? 'null' : String(v))) };
    ck.t('C1', 'feed（`listBrands`）行键**恰 48**（读口零改动：47→48 的加性键不变）',
      feed.length > 0 && keyCounts.length === 1 && keyCounts[0] === 48,
      `rows=${feed.length} keyCounts=${JSON.stringify(keyCounts)}`);
    ck.t('C2', 'feed 每行 `item_type` **键恒在场**，值 ∈ 四值闭集 ∪ {null}（原样透出、服务端不翻译）',
      feed.every((r) => 'item_type' in (r as object))
        && values.every((v) => v === null || EXPECTED.includes(String(v))),
      `values=${JSON.stringify(live.feed)}`);
    if (feed.length > 0) {
      const id = Number((feed[0] as unknown as { bID: number }).bID);
      const prize = await DatabaseService.getPrizeById(id);
      const dbKeys = prize ? Object.keys(prize as object).length : -1;
      const sellerResult = await getPrizeSellerView(id);
      const httpTop = { ...(prize as object), seller: sellerResult.ok ? sellerResult.seller : null };
      live.detail = { bID: id, db_layer_keys: dbKeys, http_top_keys: Object.keys(httpTop).length };
      ck.t('C3', '详情顶层**恰 47 键**（DB 归一器 46 + 路由层 `{ ...prize, seller }` 1），`item_type` 同键同值',
        dbKeys === 46 && Object.keys(httpTop).length === 47
          && (prize as { item_type?: unknown }).item_type === (feed[0] as unknown as { item_type?: unknown }).item_type,
        JSON.stringify(live.detail));
    } else {
      ck.t('C3', '详情键数（feed 空 ⇒ 跳过）', false, 'SKIP: feed rows=0');
    }
  } catch (e) {
    live.error = String((e as Error).message).slice(0, 200);
    ck.t('C1', 'feed 行键 48（DB 不可达 ⇒ 未测）', false, `DB_ERR:${live.error}`);
  }
  out.live = live;

  // ======================================================= P · preflight（只读；**不 apply**）
  const pre: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const client = await pool.connect();
    try {
      const who = await raw<{ project: string }>(client, "SELECT current_setting('neon.project_id', true) AS project");
      const top = await raw<{ version: string }>(client, 'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1');
      const maxApplied = top[0]?.version ?? null;
      const pending = versions.filter((v) => v > String(maxApplied));
      const col = await raw<{ data_type: string; is_nullable: string }>(client,
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='item_type'");
      const con = await raw<{ def: string }>(client,
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='listing_item_type_check' AND conrelid='public.listing'::regclass AND contype='c'");
      const counts = await raw<{ total: string; non_null: string; bare_digital: string; illegal: string; digital_prefix: string }>(client,
        `SELECT count(*)::text AS total,
                count(item_type)::text AS non_null,
                count(*) FILTER (WHERE item_type = 'Digital')::text AS bare_digital,
                count(*) FILTER (WHERE item_type IS NOT NULL AND item_type NOT IN ('DigitalAutoDeliver','DigitalManualDeliver','PhysicalFreeShip','PhysicalBuyerShip'))::text AS illegal,
                count(*) FILTER (WHERE item_type IN ('DigitalAutoDeliver','DigitalManualDeliver'))::text AS digital_prefix
           FROM public.listing`);
      const defNow = con[0]?.def ?? '';
      const isFour = EXPECTED.every((v) => defNow.includes(`'${v}'`)) && !BARE_DIGITAL.test(defNow);
      const isThree = /'Digital'::text/.test(defNow);
      pre.project = who[0]?.project ?? null;
      pre.max_applied = maxApplied;
      pre.pending = pending;
      pre.column = col[0] ?? null;
      pre.constraint_def = defNow || null;
      pre.state = isFour ? 'FOUR_VALUE_APPLIED' : isThree ? 'THREE_VALUE_PRE_APPLY' : 'UNEXPECTED';
      pre.counts = counts[0] ?? null;
      ck.t('P1', `preflight 版本面（只读·不 apply）：已应用最大 = ${maxApplied}、PENDING = [${pending.join(',')}]（0054 待 Zang apply 时为队首；apply 后为空）`,
        String(maxApplied) >= '0053' && pending.every((v) => v === '0054'),
        `project=${pre.project} max=${maxApplied} pending=${JSON.stringify(pending)}`);
      ck.t('P2', `preflight 目标面：列 = text 且可空；约束定义 ∈ {0053 三值（含裸 Digital，= 待 apply 前态）, 0054 四值（不含裸 Digital）}（现取 = ${pre.state}）`,
        col[0]?.data_type === 'text' && col[0]?.is_nullable === 'YES' && (isThree || isFour),
        JSON.stringify({ def: defNow, state: pre.state }));
      ck.t('P3', `存量面：总数 = ${counts[0]?.total}、\`item_type\` 非空 = ${counts[0]?.non_null}（期望 0）、**裸 \`Digital\` 行 = ${counts[0]?.bare_digital}**（期望 0）、闭集外 = ${counts[0]?.illegal}（期望 0）、已分类到数字前缀两值 = ${counts[0]?.digital_prefix}`,
        Number(counts[0]?.non_null ?? -1) === 0 && Number(counts[0]?.bare_digital ?? -1) === 0 && Number(counts[0]?.illegal ?? -1) === 0,
        JSON.stringify(counts[0] ?? null));
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    pre.error = String((e as Error).message).slice(0, 200);
    ck.t('P1', '迁移 preflight（DB 不可达 ⇒ 未测）', false, `DB_ERR:${pre.error}`);
  }
  out.preflight = pre;

  // ======================================= D · 迁移干跑（inRollbackTx ⇒ 零残留；不 apply 版本）
  const dry: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const probe = await inRollbackTx(pool, async (c) => {
      const r: Record<string, unknown> = {};
      await c.query(MIG54_DDL);
      r.first_run = 'ok';
      await c.query(MIG54_DDL);
      r.second_run = 'ok';
      const col = await raw<{ data_type: string; is_nullable: string }>(c,
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='item_type'");
      const con = await raw<{ def: string }>(c,
        "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname='listing_item_type_check' AND conrelid='public.listing'::regclass AND contype='c'");
      const cnt = await raw<{ n: string }>(c,
        "SELECT count(*)::text AS n FROM pg_constraint WHERE conrelid='public.listing'::regclass AND contype='c' AND (conname='listing_item_type_check' OR pg_get_constraintdef(oid) LIKE '%item_type%')");
      r.column = col[0] ?? null;
      r.constraint_def = con[0]?.def ?? null;
      r.constraint_count = Number(cnt[0]?.n ?? -1);
      // 写入实证：四值 + NULL 放行、裸 Digital / Bogus 拒（23514），逐次 SAVEPOINT
      const target = await raw<{ listing_id: string }>(c, 'SELECT listing_id FROM public.listing ORDER BY listing_id LIMIT 1');
      const lid = target[0]?.listing_id ?? null;
      r.probe_listing_id = lid;
      const writes: Array<Record<string, unknown>> = [];
      if (lid) {
        for (const v of [...EXPECTED, null, 'Digital', 'Bogus', 'digitalautodeliver']) {
          const s = await sp<unknown>(c, async () => c.query('UPDATE public.listing SET item_type = $1 WHERE listing_id = $2::bigint', [v, lid]));
          writes.push({ value: v, ok: s.ok, sqlstate: s.ok ? null : String(((s.error as Record<string, unknown>)?.code) ?? '') });
        }
      }
      r.writes = writes;
      // 自检器灵敏度两臂
      const senA = await sp<unknown>(c, async () => {
        await c.query('ALTER TABLE public.listing DROP CONSTRAINT listing_item_type_check');
        await c.query("ALTER TABLE public.listing ADD CONSTRAINT listing_item_type_check CHECK (item_type IS NULL OR item_type IN ('DigitalAutoDeliver', 'DigitalManualDeliver', 'PhysicalFreeShip', 'PhysicalBuyerShip', 'Digital'))");
        await c.query(MIG54_SELFCHECK);
      });
      r.selfcheck_with_bare_digital = { raised: !senA.ok, message: String(((senA.error as Record<string, unknown>)?.message) ?? '').slice(0, 160) };
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
    ck.t('D1', '0054 干跑（inRollbackTx）首跑 + 重跑均无报错 ⇒ 幂等（DROP IF EXISTS + ADD 落同一终态）',
      probe.error === null && probe.result?.first_run === 'ok' && probe.result?.second_run === 'ok',
      `first=${probe.result?.first_run} second=${probe.result?.second_run} err=${dry.error}`);
    ck.t('D2', '干跑后：列 = text/可空（列定义未被改）+ 约束定义含四值、**不含裸 `Digital`** + 库内**恰 1 条** item_type CHECK',
      (probe.result?.column as { data_type?: string; is_nullable?: string } | undefined)?.data_type === 'text'
        && (probe.result?.column as { is_nullable?: string } | undefined)?.is_nullable === 'YES'
        && EXPECTED.every((v) => String(probe.result?.constraint_def ?? '').includes(`'${v}'`))
        && !BARE_DIGITAL.test(String(probe.result?.constraint_def ?? ''))
        && probe.result?.constraint_count === 1,
      JSON.stringify({ column: probe.result?.column, def: probe.result?.constraint_def, count: probe.result?.constraint_count }));
    ck.t('D3', 'DB 层实证（事务内）：四值 + `NULL` 共 5 次写入 OK；★ 裸 `Digital`、`Bogus`、小写值 3 次被 CHECK 拒（23514）',
      legal.length === 5 && illegal.length === 3 && illegal.every((x) => x.sqlstate === '23514')
        && w.find((x) => x.value === 'Digital')?.ok === false,
      JSON.stringify(w));
    ck.t('D4', '自检器灵敏度（负控自证）：装「四值+裸 Digital」⇒ 0054 自检 RAISE（退役值判据非恒绿）；退回 0053 三值 ⇒ 自检 RAISE（四值判据非恒绿）',
      senA.raised === true && /retired value Digital/.test(String(senA.message ?? ''))
        && senB.raised === true && /lacks 4-value closed set/.test(String(senB.message ?? '')),
      JSON.stringify({ bare_digital: senA, old_triple: senB }));
    ck.t('D5', '干跑零残留：事务一律 ROLLBACK（`schema_migration` 无 0054 行、库内约束回到应用前态 —— 由 P1/P2 读数交叉印证）',
      probe.rolled_back === true, `rolled_back=${probe.rolled_back}`);
  } catch (e) {
    dry.error = String((e as Error).message).slice(0, 200);
    ck.t('D1', '迁移干跑（DB 不可达 ⇒ 未测）', false, `DB_ERR:${dry.error}`);
  }
  out.dry_run = dry;

  out.migration = {
    file: MIG54_REL, bytes: MIG54_SQL.length,
    sha256: (await import('crypto')).createHash('sha256').update(MIG54_SQL, 'utf8').digest('hex'),
  };
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('s54-item-type-delivery-gate', out);
  console.log(JSON.stringify({ saved: f, summary: out.summary, preflight: { state: pre.state, pending: pre.pending }, live, unit: unit.map((x) => ({ id: x.id, pass: x.pass })) }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
