/**
 * s56-00 · 去标题（`listing.title` 退场、正文并入 `description`）后端门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/published-actions/s56-00-title-merge-gate.ts
 * 读数：`ops/published-actions/readings/s56-title-merge-gate-<RUN>.json`
 *
 * ★ 本门覆盖「阶段 1 → 阶段 2 → 阶段 3」的**结构性与行为性**判据：
 *   ① 派生标题唯一口径（有回车 / 无回车 / 仅空白描述拒）；
 *   ② 写口拒 `title`（`createListing` / `updateListing` / `updateListingDetails` 同码同 reason）；
 *   ③ 幂等指纹与派生键**去 title**（6 → 5 段）后**同键同内容重投仍 replay**、异内容仍 409；
 *   ④ **真库干跑 `0055 → 0056` 再 `ROLLBACK`**（零残留、零 apply）：
 *      回填命中数 / 行数不变 / 空描述 0 / 列已删；并含 **0055 重放臂**（幂等守卫 ⇒ 第二次 UPDATE 0）；
 *   ⑤ 负控：**把 0055 的幂等守卫摘掉 ⇒ 重放臂必红**（证明该判据非恒绿）。
 *
 * 纪律：**不 apply、不写版本表、零 DDL 落盘**（一切 DDL/DML 都在 `inRollbackTx` 内 ⇒ ROLLBACK）；
 *   离线臂用**桩**替换 `DatabaseService` 的行方法（逐字还原，见 C0）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import {
  createListing,
  deriveListingTitle,
  LISTING_RETIRED_FIELDS,
  updateListingDetails,
} from '../../backend-ts/src/listing-service';
import { TRANSLATABLE_SPECS } from '../../backend-ts/src/translate-service';

type ErrLike = { ok: boolean; status?: number; code?: string; details?: Record<string, unknown> };
const got = (r: ErrLike): string => (r.ok ? 'ok' : `${r.status}/${r.code}/${String(r.details?.reason ?? '')}`);

/** 事务客户端（`pg` 兼容：多一个 `rowCount`，用来读 UPDATE 的真实命中行数） */
type Cx = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount?: number | null }>;
};

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
const MSG = readSrc('backend-ts/src/messages-service.ts');
const TR = readSrc('backend-ts/src/translate-service.ts');
const SVC = readSrc('backend-ts/src/listing-service.ts');
const MIG55 = readSrc('backend-ts/migrations/0055_title_merge_into_description.sql');
const MIG56 = readSrc('backend-ts/migrations/0056_drop_listing_title.sql');

/**
 * 迁移文件切成**单语句**（文件内无 BEGIN/COMMIT）：
 * 头段（0055 = UPDATE / 0056 = ALTER）+ 尾段（`DO $$ … $$;` 自检块）。
 * 不整段丢给驱动 ⇒ 不吃「多语句 prepared statement」的 42601，且**能读到 UPDATE 的 rowCount**。
 */
const splitMigration = (text: string): { head: string; tail: string } => {
  const at = text.indexOf('\nDO $$');
  if (at < 0) throw new Error('migration self-check block (DO $$) not found');
  return { head: text.slice(0, at).trim(), tail: text.slice(at).trim() };
};
const M55 = splitMigration(MIG55);
const M56 = splitMigration(MIG56);

/** 0055 幂等守卫（逐字取自迁移文件；负控要把它中和掉）：2026-10-20 收敛为一条 —— 描述不以 title 开头 */
const GUARD_RE = /AND\s+strpos\(description,\s*title\)\s*<>\s*1/;
/** 负控：把守卫谓词中和成 `AND true`（**保留列引用与参数位**，测的是守卫本身而非语法） */
const stripGuard = (sql: string) => sql.replace(GUARD_RE, 'AND true');

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/published-actions/s56-00-title-merge-gate.ts' };
  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading).slice(0, 600));
  };

  // ====================================================================== A · 静态面
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('A1', '**零新路由**：注册点仍 = 110（本单只改既有写口/读口，无第 111 个注册点）',
    regs === 110, `registration_points=${regs}`);

  // 「title 列零引用」= 只要没有**表别名限定**的 `x.title`（`u.title` 是 `upd` CTE 的输出列，合法派生）
  const qualifiedTitle = (src: string) => (src.match(/(?<![A-Za-z_])(?:l|pl|i|e|g|j)\.title\b/g) ?? []);
  const dbQualified = qualifiedTitle(DB).filter((m) => !m.startsWith('j.'));
  ck.t('A2', '`database.ts`：**零处表别名 `.title`**（`pl.`/`l.`/`i.`/`e.`/`g.`；`j.title` = job 面、不在本单范围）⇒ 0056 DROP 后结构上不可能 42P01',
    dbQualified.length === 0, JSON.stringify(dbQualified.slice(0, 8)));
  const msgQualified = qualifiedTitle(MSG);
  ck.t('A3', '`messages-service.ts`：**零处 `l.title`**（3 处会话/通知读口全改派生）',
    msgQualified.length === 0, JSON.stringify(msgQualified));

  const derivedInDb = (DB.match(/split_part\((?:pl|l|i|e|g)\.description, E'\\\\n', 1\)/g) ?? []).length;
  const derivedInMsg = (MSG.match(/split_part\(l\.description, E'\\\\n', 1\)/g) ?? []).length;
  ck.t('A4', `派生位点现取：database.ts \`split_part(<alias>.description, E'\\n', 1)\` = **${derivedInDb}** 处 · messages-service.ts = **${derivedInMsg}** 处（两处都 > 0 ⇒ 派生确实铺开、不是删了事）`,
    derivedInDb >= 10 && derivedInMsg === 3, JSON.stringify({ db: derivedInDb, msg: derivedInMsg }));

  const trListingWhitelist = /listing:\s*\{\s*table:\s*'listing',\s*idCol:\s*'listing_id',\s*fields:\s*\{\s*description:\s*'description'\s*\}\s*\}/.test(TR);
  const trSpec = /entity_type:\s*'listing',\s*table:\s*'listing',\s*id_col:\s*'listing_id',\s*fields:\s*\['description'\]/.test(TR);
  ck.t('A5', "翻译面：`createDbSourceResolver` 的 listing 字段 = **恰 `{description}`** · `TRANSLATABLE_SPECS` 的 listing `fields = ['description']`（标题随描述一起译，不再单列已 DROP 的列）",
    trListingWhitelist && trSpec, JSON.stringify({ whitelist: trListingWhitelist, specs: trSpec }));

  const enqBlockAt = INDEX_TS.indexOf('const enqueueListingTranslation');
  const enqBlock = enqBlockAt >= 0 ? INDEX_TS.slice(enqBlockAt, enqBlockAt + 1400) : '';
  ck.t('A6', '`enqueueListingTranslation` **只登记 description**：块内无 `fields.title`、无 `v.title`（`view.title` 是派生值、不可写回）',
    enqBlock.length > 0 && !/fields\.title/.test(enqBlock) && !/v\.title/.test(enqBlock)
      && /fields\.description\s*=\s*description/.test(enqBlock),
    JSON.stringify({ block_bytes: enqBlock.length, fields_title: /fields\.title/.test(enqBlock), v_title: /v\.title/.test(enqBlock) }));

  // 三个写口的「列清单 / RETURNING」必须无 title（只允许 `AS title` 的派生投影）
  const writeSites = [
    { name: 'createListingRow', anchor: 'WITH existing AS (' },
    { name: 'updateListingRow', anchor: 'WHEN cur.status = \'delisted\' THEN' },
    { name: 'transitionListingRow', anchor: 'public.listing_status_transition_ok(cur.status' },
  ];
  const writeReadings = writeSites.map((s) => {
    const at = DB.indexOf(s.anchor);
    const block = at >= 0 ? DB.slice(Math.max(0, at - 1800), at + 2600) : '';
    // 允许：`AS title`（派生投影）· `u.title` / `i.title` / `e.title`（CTE 输出列）
    const bad = (block.match(/(?<![A-Za-z_])(?:l|pl|i|e|g)\.title\b/g) ?? []);
    const insertTitle = /INSERT INTO public\.listing \([^)]*\btitle\b[^)]*\)/.test(block);
    const curTitle = /SELECT listing_id, seller_uid, cid, price, stock, title,/.test(block);
    return { name: s.name, block_bytes: block.length, qualified: bad, insert_title: insertTitle, cur_title: curTitle };
  });
  ck.t('A7', '三个写口（create / update / transition）的 SQL 块：**INSERT 列清单无 title** · **cur CTE 无 title 列** · **零 `.title` 限定引用**',
    writeReadings.every((w) => w.block_bytes > 0 && w.qualified.length === 0 && !w.insert_title && !w.cur_title),
    JSON.stringify(writeReadings));

  ck.t('A8', '迁移面：`0055` 含**幂等守卫**（单条 `strpos(description, title) <> 1`：描述不以 title 开头才并 —— 覆盖相等 / 无换行超串 / 已带前缀三形态）＋ 两条重放自检（`double` / `titled_empty_desc`）；`0056` = `DROP COLUMN IF EXISTS title`；两文件内**无顶层 BEGIN/COMMIT**',
    GUARD_RE.test(M55.head)
      && /v_double/.test(M55.tail) && /v_titled_empty_desc/.test(M55.tail)
      && /ALTER TABLE public\.listing DROP COLUMN IF EXISTS title;/.test(M56.head)
      && !/^\s*BEGIN\s*;/m.test(MIG55) && !/^\s*COMMIT\s*;/m.test(MIG55)
      && !/^\s*BEGIN\s*;/m.test(MIG56) && !/^\s*COMMIT\s*;/m.test(MIG56),
    JSON.stringify({ guard: GUARD_RE.test(M55.head), double_check: /v_double/.test(M55.tail), drop: /DROP COLUMN IF EXISTS title/.test(M56.head) }));

  // ============================================================ B · 派生标题三支（离线）
  const b1 = deriveListingTitle('门标题甲\n正文第一行\n正文第二行');
  const b2 = deriveListingTitle('整段无回车也当标题（存储不截断）');
  const b3 = deriveListingTitle('');
  const b4 = deriveListingTitle('   ');
  const b5 = deriveListingTitle(null);
  u('B1', '`deriveListingTitle` **有回车** ⇒ 只取首个 `\\n` 之前（多行正文不吃进标题）', b1 === '门标题甲', JSON.stringify(b1));
  u('B2', '`deriveListingTitle` **无回车** ⇒ 整段即标题（**不截断**，48 显示宽单位的截断归前端）', b2 === '整段无回车也当标题（存储不截断）', JSON.stringify(b2));
  u('B3', '`deriveListingTitle` **仅空白 / 空串 / 非字符串** ⇒ `\'\'`（无异常、不编值）',
    b3 === '' && b4 === '   ' && b5 === '', JSON.stringify({ empty: b3, spaces: b4, null: b5 }));

  // ---- C · 写口：退场字段**先于一切校验与 DB** 即拒 + 描述必填
  const svc = DatabaseService as unknown as Record<string, unknown>;
  const ORIG = {
    createListingRow: svc.createListingRow,
    updateListingRow: svc.updateListingRow,
    transitionListingRow: svc.transitionListingRow,
    getCurrencyStatus: svc.getCurrencyStatus,
  };
  let dbCalls = 0;
  let nextCreate: (input: Record<string, unknown>) => Promise<unknown> = async () => ({ outcome: 'inserted', row: {} });
  svc.getCurrencyStatus = async () => ({ status: 'listed' });
  svc.createListingRow = async (input: Record<string, unknown>) => { dbCalls += 1; return nextCreate(input); };

  const base = { sellerUid: 900056, cid: 1, price: 1000, stock: 1 };
  dbCalls = 0;
  const cTitle = await createListing({ ...base, title: '旧前端还在发标题', description: '标题\n正文' } as never);
  u('C1', '`createListing` **带 `title` ⇒ 400 `NOT_SUPPORTED`**（`details.field=listing.title`、`retired_fields=[title]`）且**零 DB 调用**',
    !cTitle.ok && cTitle.status === 400 && cTitle.details.reason === 'NOT_SUPPORTED'
      && cTitle.details.field === 'listing.title'
      && JSON.stringify(cTitle.details.retired_fields) === JSON.stringify([...LISTING_RETIRED_FIELDS])
      && dbCalls === 0,
    cTitle.ok ? 'ok?' : JSON.stringify({ res: got(cTitle as ErrLike), db_calls: dbCalls }));

  dbCalls = 0;
  const cBlank = await createListing({ ...base, description: '   \n  ' } as never);
  const cMissing = await createListing({ ...base } as never);
  const cNull = await createListing({ ...base, description: null } as never);
  u('C2', '`createListing` **仅空白 / 未传 / null 描述 ⇒ 400 `REQUIRED`**（标题已并入描述 ⇒ 空描述 = 无标题可选）且**零 DB 调用**',
    [cBlank, cMissing, cNull].every((r) => !r.ok && r.status === 400 && r.details.reason === 'REQUIRED')
      && dbCalls === 0,
    JSON.stringify({ blank: got(cBlank as ErrLike), missing: got(cMissing as ErrLike), null: got(cNull as ErrLike), db_calls: dbCalls }));

  // ---- 重放臂（指纹去 title 后同键同内容 ⇒ replay；异内容 ⇒ 409）
  const KEY = `cli:s56:gate:${RUN}:replay`;
  const DESC = '门标题乙\n正文（重投放同一份）';
  const stubRow = (over: Record<string, unknown> = {}) => ({
    listing_id: 900561,
    seller_uid: base.sellerUid,
    cid: base.cid,
    price: base.price,
    stock: base.stock,
    description: DESC,
    media_urls: [] as string[],
    item_type: null as string | null,
    status: 'draft',
    create_key: KEY,
    title: deriveListingTitle(DESC),
    ...over,
  });
  nextCreate = async () => ({ outcome: 'existing', row: stubRow() });
  dbCalls = 0;
  const r1 = await createListing({ ...base, createKeyRaw: KEY, description: DESC } as never);
  u('C3', '**同键同内容重投 ⇒ `replay=true`**（指纹去 title 后仍判定为同一请求；回执 `title` = 描述首行派生值）',
    r1.ok && r1.replay === true
      && (r1.view as Record<string, unknown>).title === '门标题乙'
      && (r1.view as Record<string, unknown>).create_key === KEY,
    r1.ok ? JSON.stringify({ replay: r1.replay, title: (r1.view as Record<string, unknown>).title }) : got(r1 as ErrLike));

  nextCreate = async () => ({ outcome: 'existing', row: stubRow({ description: '另一段完全不同的正文' }) });
  const r2 = await createListing({ ...base, createKeyRaw: KEY, description: DESC } as never);
  u('C4', '**同键异内容 ⇒ 409 `LEDGER_IDEMPOTENCY_CONFLICT`**（`reason=REPLAY_FINGERPRINT_MISMATCH`）—— 幂等判据没被「去 title」放宽',
    !r2.ok && r2.status === 409 && r2.code === 'LEDGER_IDEMPOTENCY_CONFLICT'
      && r2.details.reason === 'REPLAY_FINGERPRINT_MISMATCH' && r2.details.ref_id === KEY,
    got(r2 as ErrLike));

  nextCreate = async () => ({ outcome: 'inserted', row: stubRow() });
  const r3 = await createListing({ ...base, createKeyRaw: KEY, description: DESC } as never);
  u('C5', '首次写（`inserted`）⇒ `replay=false`（重放判据只看库回 `existing`，不由客户端声明）',
    r3.ok && r3.replay === false, r3.ok ? `replay=${r3.replay}` : got(r3 as ErrLike));

  // ---- 指纹集 / 派生键段数（静态：6 → 5）
  const fpAt = SVC.indexOf('const fingerprintOf = (row: Record<string, unknown>) => JSON.stringify([');
  const fpBlock = fpAt >= 0 ? SVC.slice(fpAt, fpAt + 420) : '';
  const fpParts = (fpBlock.match(/^\s{2}(?:Number|String|Array\.isArray)\(/gm) ?? []).length;
  u('C6', `创建指纹 = **5 段**（\`seller_uid, cid, price, description, media_urls\` · 原 6 段去 \`title\`）且块内**无 \`row.title\`**`,
    fpParts === 5 && !/row\.title/.test(fpBlock), JSON.stringify({ parts: fpParts, row_title: /row\.title/.test(fpBlock) }));

  const keyAt = SVC.indexOf("resolveListingCreateKey(params.createKeyRaw, ['create'");
  const keyArr = keyAt >= 0 ? (SVC.slice(keyAt, keyAt + 400).match(/\[([^\]]*)\]/)?.[1] ?? '') : '';
  const keyParts = keyArr ? keyArr.split(',').map((s) => s.trim()).filter(Boolean).length : 0;
  u('C7', `派生键 \`fallbackParts\` = **${keyParts} 段**（\`create, seller_uid, cid, price, stock\` · 原 6 段去 title）`,
    keyParts === 5 && !/title/.test(keyArr), JSON.stringify(keyArr.slice(0, 160)));

  // 还原桩（C0 自证）
  svc.createListingRow = ORIG.createListingRow;
  svc.updateListingRow = ORIG.updateListingRow;
  svc.transitionListingRow = ORIG.transitionListingRow;
  svc.getCurrencyStatus = ORIG.getCurrencyStatus;
  ck.t('C0', '桩已逐字回收（`createListingRow` / `updateListingRow` / `transitionListingRow` / `getCurrencyStatus`）',
    svc.createListingRow === ORIG.createListingRow && svc.getCurrencyStatus === ORIG.getCurrencyStatus, 'restored');

  // ============================================ D · 真库干跑 0055 → 0056（ROLLBACK）
  const live: Record<string, unknown> = {};
  const lr: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const probe = await inRollbackTx(pool, async (c0) => {
      const c = c0 as unknown as Cx;
      const r: Record<string, unknown> = {};
      const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
        ((await c.query(sql, params)).rows[0] ?? null) as T | null;

      const snap = async () => one<Record<string, string>>(`
        SELECT count(*)::text AS rows,
               count(DISTINCT listing_id)::text AS rows_distinct,
               count(*) FILTER (WHERE btrim(title) <> '')::text AS titled,
               count(*) FILTER (WHERE btrim(description) = '')::text AS empty_desc,
               count(*) FILTER (WHERE btrim(title) = '' AND btrim(description) = '')::text AS both_empty,
               count(*) FILTER (WHERE btrim(title) <> '' AND strpos(description, title) = 1)::text AS already_merged
          FROM public.listing`);
      const dbl = async () => one<Record<string, string>>(`
        SELECT count(*) FILTER (WHERE btrim(title) <> '' AND btrim(description) = '')::text AS titled_empty_desc,
               count(*) FILTER (WHERE btrim(title) <> '' AND strpos(description, title || E'\\n' || title) = 1)::text AS double_merged,
               count(*) FILTER (WHERE btrim(title) <> ''
                                 AND left(description, length(title)) = title
                                 AND (length(description) = length(title) OR substr(description, length(title) + 1, 1) = E'\\n'))::text AS merged_ok
          FROM public.listing`);

      const before = await snap();
      r.before = before;
      const titled = Number(before?.titled ?? -1);
      const already = Number(before?.already_merged ?? -1);
      const expectHits = titled - already;

      // D1 · 0055 首跑（真文件、真语句；`rowCount` = 回填命中数）
      const res55 = await c.query(M55.head);
      await c.query(M55.tail); // 自检块（RAISE ⇒ 本臂抛错 ⇒ 红）
      const hits = Number(res55.rowCount ?? -1);
      const afterFirst = await snap();
      const d1 = await dbl();
      r.first = { hits, expect: expectHits, after: afterFirst, checks: d1 };

      ck.t('D1', `**0055 首跑（回填命中数）**：\`UPDATE\` rowCount = **${hits}** = 有标题 ${titled} − 已合并 ${already}；尾部自检块**未抛**（空描述 ${afterFirst?.empty_desc} = 双空 ${afterFirst?.both_empty}）`,
        hits === expectHits && Number(afterFirst?.empty_desc) === Number(afterFirst?.both_empty),
        JSON.stringify({ hits, expect: expectHits, empty_desc: afterFirst?.empty_desc, both_empty: afterFirst?.both_empty }));

      ck.t('D2', `**行数不变**：合并前 ${before?.rows} → 合并后 ${afterFirst?.rows}（PK 唯一行数 ${afterFirst?.rows_distinct}；UPDATE 不增删行）`,
        String(afterFirst?.rows) === String(before?.rows)
          && String(afterFirst?.rows_distinct) === String(afterFirst?.rows),
        JSON.stringify({ before: before?.rows, after: afterFirst?.rows, distinct: afterFirst?.rows_distinct }));

      ck.t('D3', `**空描述 = 0**（合并后 \`count(description='')\` = **${afterFirst?.empty_desc}**、由原 ${before?.empty_desc} 行清空 —— 原 7 行「有标题无描述」全部由 title 补齐）`,
        Number(afterFirst?.empty_desc) === 0, JSON.stringify({ before: before?.empty_desc, after: afterFirst?.empty_desc }));

      ck.t('D4', `**并入完整且未叠加**：\`merged_ok\` = **${d1?.merged_ok}** = 有标题 ${titled}；双叠行 = ${d1?.double_merged}；有标题却空描述 = ${d1?.titled_empty_desc}`,
        Number(d1?.merged_ok) === titled && Number(d1?.double_merged) === 0 && Number(d1?.titled_empty_desc) === 0,
        JSON.stringify(d1));

      // D5 · 样本语义：description 首行 == 原 title（用首行非空的样本行现取）
      const sampleRow = await one<{ listing_id: string; title: string; description: string }>(
        `SELECT listing_id::text AS listing_id, title, description FROM public.listing
          WHERE btrim(title) <> '' ORDER BY listing_id LIMIT 1`);
      const sampleOk = !!sampleRow && deriveListingTitle(sampleRow.description) === sampleRow.title;
      r.sample = { listing_id: sampleRow?.listing_id, title: sampleRow?.title, first_line: deriveListingTitle(sampleRow?.description) };
      ck.t('D5', `样本行 ${sampleRow?.listing_id}：合并后**描述首行 == 原标题**（派生口径真落地，非空描述拼凑）`,
        sampleOk, JSON.stringify(r.sample));

      // D6 · **重放臂**（幂等守卫）：再跑一次 0055 ⇒ UPDATE 0、双重叠加仍 0、空描述行数不变、样本逐字未变
      const descBefore = sampleRow?.description ?? '';
      const resReplay = await c.query(M55.head);
      await c.query(M55.tail);
      const replayHits = Number(resReplay.rowCount ?? -1);
      const afterReplay = await snap();
      const d6 = await dbl();
      const sampleAfter = await one<{ description: string }>(
        'SELECT description FROM public.listing WHERE listing_id = $1::bigint', [sampleRow?.listing_id]);
      r.replay = { hits: replayHits, after: afterReplay, checks: d6, sample_unchanged: sampleAfter?.description === descBefore };
      ck.t('D6', `**0055 重放臂**：第二次 apply 的 rowCount = **${replayHits}**（幂等守卫生效 ⇒ 0）· 双叠行 ${d6?.double_merged} · **重放后空描述行数不变**（${afterReplay?.empty_desc}）· 样本描述逐字未变`,
        replayHits === 0 && Number(d6?.double_merged) === 0
          && String(afterReplay?.empty_desc) === String(afterFirst?.empty_desc)
          && sampleAfter?.description === descBefore,
        JSON.stringify(r.replay));

      // D7 · 0056（DROP）：列已删 + 列数 = 13 + 自检块不抛
      await c.query(M56.head);
      await c.query(M56.tail);
      const colLeft = await one<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.columns
          WHERE table_schema='public' AND table_name='listing' AND column_name='title'`);
      const colAll = await one<{ n: string }>(
        `SELECT count(*)::text AS n FROM information_schema.columns
          WHERE table_schema='public' AND table_name='listing'`);
      r.dropped = { title_cols: colLeft?.n, listing_cols: colAll?.n };
      ck.t('D7', `**0056 干跑：列已删**（\`information_schema\` title 列 = **${colLeft?.n}**）且 \`listing\` 列数 = **${colAll?.n}**（14 − 1），尾部自检未抛`,
        Number(colLeft?.n) === 0 && Number(colAll?.n) === 13, JSON.stringify(r.dropped));

      // D8 · **DROP 之后**真跑派生写口（同事务内、真语句）：不再 42P01，且 title 由**新描述**派生
      const draftRow = await one<{ listing_id: string; seller_uid: string }>(
        "SELECT listing_id::text AS listing_id, seller_uid::text AS seller_uid FROM public.listing WHERE status='draft' ORDER BY listing_id LIMIT 1");
      const svcLive = DatabaseService as unknown as Record<string, unknown>;
      const origLive = svcLive.updateListingDetailsRow as (...a: unknown[]) => Promise<unknown>;
      svcLive.updateListingDetailsRow = (input: Record<string, unknown>) => origLive(input, c);
      let post: Record<string, unknown> = {};
      try {
        const p1 = await updateListingDetails({
          listingId: Number(draftRow?.listing_id), actorUid: Number(draftRow?.seller_uid),
          patch: { description: '门标题丙\n门正文（DROP 后写入）' },
        });
        const p2 = await updateListingDetails({
          listingId: Number(draftRow?.listing_id), actorUid: Number(draftRow?.seller_uid),
          patch: { description: '整段无回车（DROP 后）' },
        });
        post = {
          draft_id: draftRow?.listing_id,
          nl_ok: p1.ok, nl_title: p1.ok ? (p1.view as Record<string, unknown>).title : got(p1 as ErrLike),
          nl_desc: p1.ok ? (p1.view as Record<string, unknown>).description : null,
          nonl_ok: p2.ok, nonl_title: p2.ok ? (p2.view as Record<string, unknown>).title : got(p2 as ErrLike),
          keys: p2.ok ? Object.keys(p2.view as Record<string, unknown>).sort() : [],
          text_changed_nl: p1.ok ? (p1 as { text_changed?: boolean }).text_changed : null,
        };
      } finally {
        svcLive.updateListingDetailsRow = origLive;
      }
      r.postDrop = post;
      ck.t('D8', `**DROP 之后写口照跑**（无 42P01）：有回车 ⇒ title = \`${post.nl_title}\` · 无回车 ⇒ title = \`${post.nonl_title}\`（**由新描述派生**、不是旧值）`,
        post.nl_ok === true && post.nl_title === '门标题丙' && post.nonl_title === '整段无回车（DROP 后）',
        JSON.stringify({ nl: post.nl_title, nonl: post.nonl_title, err: post.nl_ok ? null : post.nl_desc }));
      ck.t('D9', 'DROP 之后回执键集仍 **10 键**（`title` 键保留、值派生 ⇒ 前端零改动）',
        Array.isArray(post.keys) && (post.keys as string[]).length === 10 && (post.keys as string[]).includes('title'),
        JSON.stringify(post.keys));

      return r;
    });
    await pool.end();
    Object.assign(lr, probe.result ?? {});
    lr.rolled_back = probe.rolled_back;
    lr.error = probe.error ? String((probe.error as Error).message).slice(0, 400) : null;
    lr.ms = probe.ms;
    ck.t('F0', '真库干跑 **一律 ROLLBACK**（0055 回填 + 0056 DROP + 全部写探针 ⇒ 零残留、零 apply）',
      probe.error === null && probe.rolled_back === true, `error=${lr.error} rolled_back=${lr.rolled_back}`);
  } catch (e) {
    lr.error = String((e as Error).message).slice(0, 400);
    ck.t('F0', '真库干跑（DB 不可达 ⇒ 未测）', false, `DB_ERR:${lr.error}`);
  }

  // ================== G · 真库**读口**逐条跑通（显式列清单无笔误；title 键恒 = 派生首行）
  const reads: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const c = (await pool.connect()) as unknown as Cx;
    try {
      const one = async (sql: string, params: unknown[] = []) => ((await c.query(sql, params)).rows[0] ?? null) as Record<string, string> | null;
      const seller = await one('SELECT seller_uid::text AS uid FROM public.listing ORDER BY listing_id LIMIT 1');
      const fav = await one('SELECT fav_uid::text AS uid FROM public.listing_favorite ORDER BY fav_id LIMIT 1');
      const feed = (await DatabaseService.listBrands(0, 5)) as unknown as Array<Record<string, unknown>>;
      const adminRows = (await DatabaseService.listListingsForAdmin(null)) as Array<Record<string, unknown>>;
      const mine = (await DatabaseService.listListingsBySeller(Number(seller?.uid ?? 0), 0, 5)) as unknown as Array<Record<string, unknown>>;
      const favs = fav ? (await DatabaseService.listFavoritesByUser(Number(fav.uid), 0, 5)) as unknown as Array<Record<string, unknown>> : [];
      const detail = feed.length ? (await DatabaseService.getBrandById(Number(feed[0].bID)) as unknown as Record<string, unknown> | null) : null;

      // 行内带 `description` 的口 ⇒ 断言 `title == 描述首行`（派生同源）；
      // 行内**不带** description 的口（admin / favorites 只选派生 title）⇒ 只断 `title` 是**字符串**（SQL 没写错列）。
      const consistent = (rows: Array<Record<string, unknown>>, key: string) =>
        rows.every((r) => typeof r[key] === 'string'
          && (r.description === undefined || r[key] === deriveListingTitle(r.description)));
      reads.feed = { rows: feed.length, consistent: consistent(feed, 'name'), sample: feed[0] ? { bID: feed[0].bID, name: feed[0].name } : null };
      reads.detail = detail ? { bID: detail.bID, name: detail.name, ok: detail.name === deriveListingTitle(detail.description) } : null;
      reads.mine = { rows: mine.length, keys: mine[0] ? Object.keys(mine[0]).length : 0, consistent: consistent(mine, 'title') };
      reads.admin = { rows: adminRows.length, consistent: consistent(adminRows, 'title') };
      reads.favorites = { rows: favs.length, consistent: consistent(favs, 'title'), note: fav ? null : 'no favorite fixture (empty table)' };

      ck.t('G1', `**feed 读口**（\`listBrands\`）跑通：${reads.feed && (reads.feed as Record<string, unknown>).rows} 行，逐行 \`name\` == 描述首行（显式列清单无笔误、派生同源）`,
        feed.length > 0 && consistent(feed, 'name'), JSON.stringify(reads.feed));
      ck.t('G2', '**详情读口**（`getBrandById`）跑通且 `name` == 描述首行',
        !!detail && (detail.name === deriveListingTitle(detail.description)), JSON.stringify(reads.detail));
      ck.t('G3', `**我的发布**（\`listListingsBySeller\`）跑通：${reads.mine && (reads.mine as Record<string, unknown>).rows} 行 · 10 键 · 逐行 \`title\` == 描述首行`,
        mine.length > 0 && (mine[0] ? Object.keys(mine[0]).length === 10 : false) && consistent(mine, 'title'),
        JSON.stringify(reads.mine));
      ck.t('G4', `**管理列表**（\`listListingsForAdmin\`）跑通：${reads.admin && (reads.admin as Record<string, unknown>).rows} 行，每行 \`title\` 均为字符串（该口只选派生 title、行内无 description 可对拍）`,
        adminRows.length > 0 && adminRows.every((r) => typeof r.title === 'string'), JSON.stringify(reads.admin));
      ck.t('G5', `**收藏**（\`listFavoritesByUser\`）跑通：${(reads.favorites as Record<string, unknown>).rows} 行（无夹具时为空表、不算红；行内无 description ⇒ 只断 title 是字符串）`,
        favs.every((r) => typeof r.title === 'string'), JSON.stringify(reads.favorites));
    } finally {
      (c as unknown as { release?: () => void }).release?.();
      await pool.end();
    }
  } catch (e) {
    reads.error = String((e as Error).message).slice(0, 300);
    ck.t('G1', '读口面（DB 不可达 / SQL 报错 ⇒ 判负）', false, `ERR:${reads.error}`);
  }

  // ================================ E · 负控：把 0055 的幂等守卫摘掉 ⇒ 重放臂必红
  const neg: Record<string, unknown> = {};
  try {
    const pool = mkPool(1);
    const probe = await inRollbackTx(pool, async (c0) => {
      const c = c0 as unknown as Cx;
      const r: Record<string, unknown> = {};
      const stripped = stripGuard(M55.head);
      r.guard_present = GUARD_RE.test(M55.head);
      r.stripped_changed_text = stripped !== M55.head;
      r.stripped_tail = stripped.slice(-160);
      if (!r.stripped_changed_text) return r; // 摘除器空转 ⇒ 下面的读数无意义（由 E2 判红）

      const once = await c.query(stripped);
      const twice = await c.query(stripped);
      const d = ((await c.query(`
        SELECT count(*) FILTER (WHERE btrim(title) <> '' AND strpos(description, title || E'\\n' || title) = 1)::text AS double_merged
          FROM public.listing`)).rows[0] ?? null) as Record<string, string> | null;
      r.neg_first_hits = Number(once.rowCount ?? -1);
      r.neg_replay_hits = Number(twice.rowCount ?? -1);
      r.neg_double = d?.double_merged;
      // ③ 0055 自带自检也必须抓到（叠两遍后跑原文件自检块 ⇒ 必须 RAISE ⑤）
      let selfCheckCaught: string | null = null;
      try {
        await c.query(M55.tail);
      } catch (e) {
        selfCheckCaught = String((e as Error).message).slice(0, 160);
      }
      r.neg_selfcheck_caught = selfCheckCaught;
      return r;
    });
    await pool.end();
    Object.assign(neg, probe.result ?? {});
    neg.rolled_back = probe.rolled_back;
    neg.error = probe.error ? String((probe.error as Error).message).slice(0, 300) : null;

    ck.t('E1', `★ **负控 1（判负自证）**：把幂等守卫中和成 \`AND true\` 后连跑两次 ⇒ 第二次仍写 **${neg.neg_replay_hits}** 行、双叠行 = **${neg.neg_double}**（> 0）⇒ **D6 那条「重放 0 行 / 双叠 0」断言必红**（该判据非恒绿）`,
      Number(neg.neg_replay_hits) > 0 && Number(neg.neg_double) > 0,
      JSON.stringify({ first: neg.neg_first_hits, replay: neg.neg_replay_hits, double: neg.neg_double }));
    ck.t('E2', '★ **负控 2（自证变异真发生）**：摘除器**确实改变**了语句文本（不是说「没守卫」的空跑）—— 且原文件**确有**该守卫',
      neg.guard_present === true && neg.stripped_changed_text === true
        && String(neg.stripped_tail ?? '').includes('AND true'),
      JSON.stringify({ guard_present: neg.guard_present, changed: neg.stripped_changed_text }));
    ck.t('E3', '★ **负控 3（自带自检也承重）**：叠两遍后跑**原文件自检块** ⇒ 必须 `RAISE`（`0055 self-check FAILED: … 叠加两次`），即「守卫失效」不会静默过迁',
      typeof neg.neg_selfcheck_caught === 'string' && /叠加两次/.test(neg.neg_selfcheck_caught as string),
      String(neg.neg_selfcheck_caught ?? 'NO_RAISE'));
  } catch (e) {
    neg.error = String((e as Error).message).slice(0, 300);
    ck.t('E1', '负控（DB 不可达 ⇒ 未测）', false, `DB_ERR:${neg.error}`);
  }

  out.migrations = { m55_head_bytes: M55.head.length, m55_tail_bytes: M55.tail.length, m56_head: M56.head, m56_head_bytes: M56.head.length };
  out.live = lr;
  out.negative = neg;
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('s56-title-merge-gate', out);
  console.log(JSON.stringify({
    saved: f,
    summary: out.summary,
    live: {
      rolled_back: lr.rolled_back, error: lr.error,
      backfill_hits: (lr.first as Record<string, unknown> | undefined)?.hits,
      replay_hits: (lr.replay as Record<string, unknown> | undefined)?.hits,
      empty_desc: (lr.first as Record<string, unknown> | undefined)?.after,
      dropped: lr.dropped,
    },
    negative: { replay_hits: neg.neg_replay_hits, double: neg.neg_double },
    red: (out.summary as { red: string[] }).red,
  }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
