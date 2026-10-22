/**
 * p60-00 · 商品统一 Id（雪花 + item_code + `:ref` 双形态）后端离线门 · 迁移 0060
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/item-id/p60-00-item-id-gate.ts
 * 读数：`ops/item-id/readings/p60-item-id-gate-<RUN>.json`
 *
 * ★ 覆盖面（Kevin 2026-10-20「统一商品 Id」第 3 条）：
 *   A · 静态面（零 DB）：零新路由（regs=111）· `:ref` 双形态真接线（全数字 ⇒ listing_id /
 *       7 位字母数字 ⇒ `getListingIdByItemCode` / 其它形状 ⇒ `bID_not_found` 404）·
 *       计数去重缓存头逐字未动 · 迁移形状（两列 / 两唯一索引 / CHECK **两条件** / 无 BEGIN-COMMIT）·
 *       三处常量单一真源（字母表 / 纪元 / 打散常量 / 位宽）· 服务层生成 + 重试接线；
 *   G · 生成器（离线）：1000 次发号**无重号**、码恒 7 位 / 恒在 56 字母表 / **恒非纯数字**；
 *       确定性（同雪花同 offset 同码）与 `isNumericRef` ∧ `isItemCode` 的**歧义自证**
 *       （7 位纯数字两判据同时为真 ⇒ 必须有库级禁令）；
 *   B · 迁移干跑（真库 · `inRollbackTx` ⇒ ROLLBACK ⇒ 零 apply / 零残留）：
 *       0060 头段 + 尾部 DO 整块跑通 ⇒ 两列（bigint/char(7) NOT NULL）· 两唯一索引 ·
 *       CHECK 为**两条件版**（含 `!~ '^[0-9]{7}$'`）· 存量全量回填（行行合法、纯数字码 0 行）·
 *       行数不变 · 触发器恢复启用 · **尾部重跑一次仍绿**（幂等）；
 *   N · 负控（同 tx · SAVEPOINT 包住预期失败）：纯数字码 ⇒ 23514 · 缺码（NULL）⇒ 23502 ·
 *       6 位码 ⇒ 23514 · 撞码 ⇒ 23505（唯一索引真在场）；三个负控都过 ⇒ 判据非恒绿；
 *   C · 读口键数（同 tx）：feed **50** · 详情路由合成 **53**（服务层 52，0061 +allow_multi_buy）· mine **14** · edit **14**；
 *   D · 行为（同 tx）：`createListingRow` 两键落库（码合法非纯数字、雪花递增）·
 *       `getListingIdByItemCode` 往返命中 / 未知码 null · 码解析出的 id 与数字 id **读同一行**（逐键等价）；
 *   E · 冲突重试臂（离线 · 桩替 DB，逐字还原）：连续两次 23505 ⇒ **第 3 次成功**且两次候选码不同 ·
 *       **负控①**：恒 23505 ⇒ 3 次后**上抛**（不静默成功、不落半行）·
 *       **负控②**：`create_key` 撞车 ⇒ **不进** id 重试（1 次即上抛，幂等键语义不被吞）。
 *
 * 纪律：**不 apply、不写版本表、零 DDL/DML 落库**（一切写都在回滚事务内）；
 *   夹具 = 真 `createListingRow` 写路径 + 事务回滚自回收；探针凭据只读 `.env.local`（dev 库）。
 *   ★ 0060 **未 apply** 期间本门仍可跑：每个回滚事务先跑一遍 0060 头段 DDL（`IF NOT EXISTS` 幂等），
 *     否则 `l.item_code` / `l.snowflake_id` 一律 42703/42P01。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, sp, rawRetry, raw1Retry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import type { BrandRecord, SqlRunner } from '../../backend-ts/src/database';
import { createListing } from '../../backend-ts/src/listing-service';
import {
  ITEM_CODE_ALPHABET,
  ITEM_CODE_LENGTH,
  ITEM_CODE_MIX,
  ITEM_CODE_PATTERN,
  ITEM_CODE_RADIX,
  ITEM_ID_CREATE_ATTEMPTS,
  SNOWFLAKE_EPOCH_MS,
  SNOWFLAKE_MACHINE_BITS,
  SNOWFLAKE_SEQ_BITS,
  codeFromSnowflake,
  isItemCode,
  isItemIdUniqueViolation,
  isNumericRef,
  nextSnowflake,
} from '../../backend-ts/src/item-id';

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
const ITEM_ID_TS = readSrc('backend-ts/src/item-id.ts');
const MIG60 = readSrc('backend-ts/migrations/0060_item_code_snowflake.sql');

const stripSqlLineComments = (text: string): string =>
  text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const splitMigration = (text: string): { head: string; tail: string; headStmts: string[]; headCode: string } => {
  const at = text.indexOf('\nDO $$');
  if (at < 0) throw new Error('migration self-check block (DO $$) not found');
  const head = text.slice(0, at).trim();
  const tail = text.slice(at).trim();
  const headCode = stripSqlLineComments(head);
  const headStmts = headCode.split(';').map((s) => s.trim()).filter(Boolean);
  return { head, tail, headStmts, headCode };
};
const M60 = splitMigration(MIG60);

const sliceBetween = (src: string, startMark: string, endMark: string): string => {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : '';
};

const FIXTURE_KEY_PREFIX = 'cli:p60-gate:';
const ALL_DIGITS = /^[0-9]{7}$/;

/** 一次「建商品两键」：真发号器 + 真编码器（与生产 service 同一对函数） */
const ids = (offset = 0): { snowflakeId: string; itemCode: string } => {
  const sf = nextSnowflake();
  return { snowflakeId: sf.toString(), itemCode: codeFromSnowflake(sf, offset) };
};

/** 首个连接偶发 ECONNRESET（Neon dev 端点冷启 / 连接抖动）⇒ 三次退避重试后再判失败 */
const firstRows = async <T = Record<string, unknown>>(p: ReturnType<typeof mkPool>, sqlText: string): Promise<T[]> => {
  let last: unknown = null;
  for (let i = 0; i < 3; i += 1) {
    try { return await raw<T>(p as never, sqlText); } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1000)); }
  }
  throw last;
};

/** 事务段同样带连通性重试：只有「socket 断开 / 连接超时」这类**环境错误**才重跑（真判据错误照原样上抛） */
const tx = async <T>(
  p: ReturnType<typeof mkPool>,
  fn: (c: Qx) => Promise<T>,
): Promise<{ result: T | null; error: unknown | null; rolled_back: boolean; ms: number }> => {
  for (let i = 0; i < 3; i += 1) {
    const r = await inRollbackTx(p, fn);
    const msg = String((r.error as { message?: string })?.message ?? '');
    if (!r.error || !/socket disconnected|ECONNRESET|timeout/i.test(msg)) return r;
    await new Promise((res) => setTimeout(res, 1200));
  }
  return inRollbackTx(p, fn);
};

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/item-id/p60-00-item-id-gate.ts' };

  // ====================================================================== A · 静态面（零 DB）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('A1', '**零新路由**：注册点 = 109（job 域下线 −21 后现取 —— `:ref` 只扩既有 `GET /api/prize/:bID` 的参数取值域，不新增注册点）',
    regs === 109, `registration_points=${regs}`);

  const detailBlock = sliceBetween(INDEX_TS, "app.get('/api/prize/:", "app.get('/api/user'");
  const dual = {
    numeric: /isNumericRef\(rawRef\)/.test(detailBlock),
    code: /isItemCode\(rawRef\)/.test(detailBlock),
    resolver: /DatabaseService\.getListingIdByItemCode\(/.test(detailBlock),
    shape404: /sendRefNotFound\(res, 'prize', rawRef, 'bID_not_found'\)/.test(detailBlock),
    miss404: /sendRefNotFound\(res, 'prize', rawRef, 'prize_not_found'\)/.test(detailBlock),
    legacyParse: /parseInteger\(req\.params\.bID\)/.test(detailBlock),
  };
  ck.t('A2', '**`:ref` 双形态真接线**：全数字 ⇒ `parseInteger` 走 `listing_id` · 7 位字母数字 ⇒ `getListingIdByItemCode` · 其它形状 ⇒ 404 `bID_not_found`（**零 DB**）· 码/ id 不存在 ⇒ 同一 404 `prize_not_found` · **两处 404 都原样回显 `rawRef`** · 旧的 `parseInteger(req.params.bID)` 单形态已不在',
    dual.numeric && dual.code && dual.resolver && dual.shape404 && dual.miss404 && !dual.legacyParse,
    JSON.stringify(dual));

  const unchanged = {
    recording: /DatabaseService\.getPrizeDetailRecordingView\(bID\)/.test(detailBlock),
    dedup: /isDetailViewDedupEnabled/.test(detailBlock),
    noStore: /setPrivateNoStore\(res\)/.test(detailBlock),
    seller: /getPrizeSellerView\(bID\)/.test(detailBlock),
  };
  ck.t('A3', '计数 / 去重 / 缓存头 / seller 合成**逐字未动**（解析出 `listing_id` 之后走原封不动的旧路径 ⇒ 本单对详情语义只多了一种入参解释方式）',
    Object.values(unchanged).every(Boolean), JSON.stringify(unchanged));

  const svcCreate = sliceBetween(SVC, 'export const createListing = async', '// ---- P1-b');
  ck.t('A4', '服务层**生成 + 重试**接线：每次尝试先 `nextSnowflake()` 再 `codeFromSnowflake(snowflake)`（同源一对函数）· 上限 = `ITEM_ID_CREATE_ATTEMPTS` · 只对 `isItemIdUniqueViolation` 重试 · 用尽**上抛**（`if (!write) throw`）',
    /nextSnowflake\(\)/.test(svcCreate) && /codeFromSnowflake\(snowflake\)/.test(svcCreate)
    && /ITEM_ID_CREATE_ATTEMPTS/.test(svcCreate) && /isItemIdUniqueViolation\(error\)/.test(svcCreate)
    && /if \(!write\) throw/.test(svcCreate),
    JSON.stringify({
      snowflake: /nextSnowflake\(\)/.test(svcCreate), code: /codeFromSnowflake\(snowflake\)/.test(svcCreate),
      attempts: /ITEM_ID_CREATE_ATTEMPTS/.test(svcCreate), predicate: /isItemIdUniqueViolation\(error\)/.test(svcCreate),
      rethrow: /if \(!write\) throw/.test(svcCreate),
    }));

  const svcResolver = sliceBetween(DB, 'static async getListingIdByItemCode', 'static async getBrandById');
  ck.t('A5', '库层解析口 `getListingIdByItemCode`：**精确等值**（`item_code = $1::char(7)`、无 `lower()` / `ILIKE`）· 长度 ≠ 7 直接 null（零查询）· 只读单行 SELECT（零锁零副作用）',
    /item_code = \$\{text\}::char\(7\)/.test(svcResolver) && /text\.length !== 7/.test(svcResolver)
    && !/lower\(|ilike/i.test(svcResolver) && /LIMIT 1/.test(svcResolver),
    `resolver_bytes=${svcResolver.length}`);

  ck.t('A6', '迁移 0060 形状：**两列** `ADD COLUMN IF NOT EXISTS`（snowflake_id / item_code）· **两唯一索引** · 头段**无 BEGIN/COMMIT** · 回填期 DISABLE / 末尾 ENABLE `trg_listing_touch_time_updated`',
    (M60.headCode.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length === 2
    && /ADD COLUMN IF NOT EXISTS snowflake_id bigint/.test(MIG60)
    && /ADD COLUMN IF NOT EXISTS item_code\s+char\(7\)/.test(MIG60)
    && /CREATE UNIQUE INDEX IF NOT EXISTS listing_snowflake_id_uidx/.test(MIG60)
    && /CREATE UNIQUE INDEX IF NOT EXISTS listing_item_code_uidx/.test(MIG60)
    && !/\bBEGIN\b/.test(M60.headCode) && !/\bCOMMIT\b/.test(M60.headCode)
    && /DISABLE TRIGGER trg_listing_touch_time_updated/.test(MIG60)
    && /ENABLE TRIGGER trg_listing_touch_time_updated/.test(MIG60),
    JSON.stringify({
      adds: (M60.headCode.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length,
      head_stmts: M60.headStmts.length, begins: /\bBEGIN\b/.test(M60.headCode), commits: /\bCOMMIT\b/.test(M60.headCode),
    }));

  // CHECK 必须**两条件**：形状 ∧ 纯数字禁令（后者是「:ref 双形态无歧义」的结构保证）
  const checkClause = "CHECK (item_code ~ '^[0-9A-Za-z]{7}$' AND item_code !~ '^[0-9]{7}$')";
  const digitSelfCheck = /item_code ~ '\^\[0-9\]\{7\}\$'/.test(MIG60) && /carry all-digit item_code/.test(MIG60);
  const backfillGuard = /EXIT WHEN v_code !~ '\^\[0-9\]\{7\}\$'/.test(MIG60);
  ck.t('A7', '**纯数字码禁令三处同口径**：① CHECK 两条件（`~ ^[0-9A-Za-z]{7}$` ∧ `!~ ^[0-9]{7}$`）· ② 回填循环 `EXIT WHEN v_code !~ ^[0-9]{7}$`（候选纯数字就 +1）· ③ 尾部自检「纯数字码 0 行」反断言',
    MIG60.includes(checkClause) && backfillGuard && digitSelfCheck,
    JSON.stringify({ check_two_clauses: MIG60.includes(checkClause), backfill_skip: backfillGuard, selfcheck_digit: digitSelfCheck }));

  const parity = {
    alphabet: MIG60.includes(`'${ITEM_CODE_ALPHABET}'`) && ITEM_CODE_ALPHABET.length === 57 && ITEM_CODE_RADIX === 57,
    radixParity: new RegExp('c_radix\\s+CONSTANT int\\s+:=\\s*' + ITEM_CODE_RADIX + ';').test(MIG60),
    epoch: MIG60.includes(`:= ${SNOWFLAKE_EPOCH_MS}`) && SNOWFLAKE_EPOCH_MS === 1704067200000,
    mix: MIG60.includes(`* ${ITEM_CODE_MIX})`) && ITEM_CODE_MIX === 1000003,
    seqBits: MIG60.includes(`:= ${SNOWFLAKE_SEQ_BITS}`) && SNOWFLAKE_SEQ_BITS === 12,
    machineBits: SNOWFLAKE_MACHINE_BITS === 10 && ITEM_CODE_LENGTH === 7,
    deconfused: !/[01IlO]/.test(ITEM_CODE_ALPHABET),
    pattern: ITEM_CODE_PATTERN.source === '^[0-9A-Za-z]{7}$',
    routeImport: /from '\.\/item-id'/.test(INDEX_TS) && /isItemCode/.test(INDEX_TS) && /isNumericRef/.test(INDEX_TS),
    retryConst: ITEM_ID_CREATE_ATTEMPTS === 3,
  };
  ck.t('A8', '**单一真源对拍**：迁移常量 ≡ `item-id.ts`（57 字符去混淆字母表 / 纪元 1704067200000 / 打散 1000003 / 12 位序号 / 10 位机器）· **`c_radix` = 字母表长度 = 57**（两者不等 ⇒ 回填码与服务层码不同基、同雪花不同码 —— 本门首跑即抓到这个缺陷）· 路由与库层都从 `item-id.ts` 取值（无第二份字母本）',
    Object.values(parity).every(Boolean), JSON.stringify(parity));

  // ====================================================================== G · 生成器（离线，零 DB）
  const N = 1000;
  const sfs = new Set<string>();
  const codes = new Set<string>();
  let codeBad = 0;
  let digitCode = 0;
  let prev = -1n;
  let monotonic = true;
  for (let i = 0; i < N; i += 1) {
    const sf = nextSnowflake();
    if (sf <= prev) monotonic = false;
    prev = sf;
    sfs.add(sf.toString());
    const code = codeFromSnowflake(sf);
    if (!ITEM_CODE_PATTERN.test(code) || code.length !== ITEM_CODE_LENGTH) codeBad += 1;
    if (ALL_DIGITS.test(code)) digitCode += 1;
    codes.add(code);
  }
  ck.t('G1', `生成器 ${N} 次：雪花**无重号**且**严格递增** · 码**无重复**（${codes.size}/${N}）`,
    sfs.size === N && codes.size === N && monotonic,
    JSON.stringify({ snowflakes: sfs.size, codes: codes.size, monotonic, n: N }));
  ck.t('G2', `生成器 ${N} 次：每码恒 **7 位**、恒在 `+`^[0-9A-Za-z]{7}$`+`、**纯数字码 0 个**（+1 跳码生效）`,
    codeBad === 0 && digitCode === 0,
    JSON.stringify({ bad_shape: codeBad, all_digit: digitCode }));

  const sfFix = nextSnowflake();
  const c0 = codeFromSnowflake(sfFix);
  const c1 = codeFromSnowflake(sfFix);
  const cOff = codeFromSnowflake(sfFix, 1);
  ck.t('G3', '编码确定性：同雪花恒同码（回填与服务层同口径）· `offset` 1 位即换码（撞码重试必然前进，不死循环）',
    c0 === c1 && cOff !== c0 && ITEM_CODE_PATTERN.test(cOff),
    JSON.stringify({ same: c0 === c1, offset_differs: cOff !== c0 }));

  // ★ 歧义自证：7 位纯数字同时满足两个形态判据 ⇒ 必须有库级禁令（A7）+ 生成器跳码（G2）
  const ambiguity = isNumericRef('1234567') && isItemCode('1234567');
  const disjoint = isNumericRef('987') && !isItemCode('987') && isItemCode('a234567') && !isNumericRef('a234567');
  ck.t('G4', '判别子无歧义：**纯数字 7 位两判据同时为真**（这就是必须从库级禁掉纯数字码的理由）· 真实码形态（含字母）与纯数字 id 互斥；`isItemIdUniqueViolation` 只认 23505 且排除 `create_key`',
    ambiguity && disjoint
    && isItemIdUniqueViolation({ code: '23505', constraint: 'listing_item_code_uidx' })
    && !isItemIdUniqueViolation({ code: '23505', constraint: 'listing_create_key_key', message: 'create_key' })
    && !isItemIdUniqueViolation({ code: '23514' }),
    JSON.stringify({ ambiguity, disjoint }));

  // ====================================================================== 真库段（B / N / C / D）
  const pool = mkPool(2);
  const projRows = await firstRows(pool, "SELECT current_setting('neon.project_id', true) AS project_id, current_setting('neon.branch_id', true) AS branch_id");
  const projectId = String(projRows[0]?.project_id ?? '');
  out.env = { project_id: projectId, branch_id: String(projRows[0]?.branch_id ?? ''), expect_dev: 'quiet-math-65207667' };
  ck.t('ENV', '库身份自证：neon.project_id = dev（quiet-math-65207667）—— 读数归因前置',
    projectId === 'quiet-math-65207667', `project_id=${projectId}`);

  const preCol = await raw1Retry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('snowflake_id','item_code')");
  out.mode = Number(preCol?.n ?? 0) === 0 ? 'pre-apply' : (Number(preCol?.n ?? 0) === 2 ? 'post-apply' : 'partial-STOP');
  ck.t('ENV2', '迁移态可判读：pre-apply（两列缺席 ⇒ 本门在事务内干跑 0060）/ post-apply（两列在场 ⇒ 头段 no-op）· partial = STOP',
    out.mode === 'pre-apply' || out.mode === 'post-apply',
    `mode=${out.mode} columns=${preCol?.n}`);

  // ---- B · 迁移干跑（整块 0060：头段 + 尾部 DO；ROLLBACK ⇒ 零 apply）
  const br = await tx(pool, async (c) => {
    const preRows = Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.listing'))?.n ?? -1);
    for (const stmt of M60.headStmts) await c.query(stmt);
    let tailError: string | null = null;
    try { await c.query(M60.tail); } catch (e) { tailError = String((e as Error).message).slice(0, 240); }
    // 幂等：尾部整块再跑一次（回填 WHERE IS NULL / SET NOT NULL / CHECK 已两条件 ⇒ 全部 no-op）
    let tail2Error: string | null = null;
    try { await c.query(M60.tail); } catch (e) { tail2Error = String((e as Error).message).slice(0, 240); }

    const cols = await raw<{ column_name: string; data_type: string; is_nullable: string; character_maximum_length: number | null }>(c,
      `SELECT column_name, data_type, is_nullable, character_maximum_length
         FROM information_schema.columns
        WHERE table_schema='public' AND table_name='listing' AND column_name IN ('snowflake_id','item_code')
        ORDER BY column_name`);
    const idx = await raw<{ indexname: string; indexdef: string }>(c,
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname='public' AND tablename='listing'
          AND indexname IN ('listing_snowflake_id_uidx','listing_item_code_uidx') ORDER BY indexname`);
    const ckDef = await raw1<{ def: string }>(c,
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conrelid='public.listing'::regclass AND conname='listing_item_code_format_ck'`);
    const counts = await raw1<Record<string, number>>(c,
      `SELECT count(*)::int AS total,
              count(*) FILTER (WHERE item_code IS NULL OR snowflake_id IS NULL)::int AS null_ids,
              count(*) FILTER (WHERE item_code ~ '^[0-9]{7}$')::int AS digit_codes,
              count(*) FILTER (WHERE item_code !~ '^[0-9A-Za-z]{7}$')::int AS bad_shape,
              count(*) FILTER (WHERE translate(item_code::text, $1, '') <> '')::int AS off_alphabet,
              count(DISTINCT item_code)::int AS distinct_codes,
              count(DISTINCT snowflake_id)::int AS distinct_snowflakes,
              count(*) FILTER (WHERE snowflake_id <= 0)::int AS nonpositive
         FROM public.listing`, [ITEM_CODE_ALPHABET]);
    const rowsAfter = Number(counts?.total ?? -1);
    const trg = await raw1<{ enabled: string; disabled: number }>(c,
      `SELECT max(t.tgenabled) AS enabled,
              count(*) FILTER (WHERE NOT t.tgisinternal AND t.tgenabled <> 'O')::int AS disabled
         FROM pg_trigger t JOIN pg_class cl ON cl.oid=t.tgrelid JOIN pg_namespace n ON n.oid=cl.relnamespace
        WHERE n.nspname='public' AND cl.relname='listing' AND t.tgname='trg_listing_touch_time_updated'`);

    // ---- N · 负控（SAVEPOINT 包住预期失败 ⇒ 事务可继续）
    const oneUid = String((await raw1<{ uid: string }>(c, 'SELECT min(uid)::text AS uid FROM public.users WHERE uid > 0'))?.uid ?? '0');
    const existing = await raw1<{ code: string; sf: string }>(c,
      'SELECT item_code::text AS code, snowflake_id::text AS sf FROM public.listing ORDER BY listing_id LIMIT 1');
    const insSql = (code: string | null, sf: string) => [
      `INSERT INTO public.listing (seller_uid, cid, price, stock, description, media_urls, status, create_key, ledger_event_keys, snowflake_id, item_code)
       SELECT $1::bigint, 1, 100, 1, $2, '{}'::text[], 'draft', $3, '{}'::text[], $4::bigint, $5::char(7)
        WHERE EXISTS (SELECT 1 FROM public.users WHERE uid > 0) RETURNING listing_id`,
      [oneUid, `p60-gate neg fixture ${RUN}`, `${FIXTURE_KEY_PREFIX}${RUN}-${Math.random().toString(36).slice(2, 8)}`, sf, code],
    ] as [string, unknown[]];
    const sfFree = (nextSnowflake() + 1n).toString();

    const armDigit = await sp(c, () => {
      const [q, p] = insSql('1234567', sfFree);
      return c.query(q, p);
    });
    const armNull = await sp(c, () => {
      const [q, p] = insSql(null, (nextSnowflake() + 2n).toString());
      return c.query(q, p);
    });
    const armShort = await sp(c, () => {
      const [q, p] = insSql('abcde', (nextSnowflake() + 3n).toString());
      return c.query(q, p);
    });
    const armDupCode = await sp(c, () => {
      const [q, p] = insSql(existing?.code ?? 'a234567', (nextSnowflake() + 4n).toString());
      return c.query(q, p);
    });
    const armDupSf = await sp(c, () => {
      const [q, p] = insSql('a23456Z', existing?.sf ?? '1');
      return c.query(q, p);
    });
    const errOf = (e: unknown) => String((e as { code?: string })?.code ?? '');
    const cnameOf = (e: unknown) => String((e as { constraint?: string })?.constraint ?? '');

    return {
      preRows, tailError, tail2Error, cols, idx, ckDef: ckDef?.def ?? null, counts, rowsAfter, trg,
      arms: {
        digit: { sqlstate: errOf(armDigit.error), constraint: cnameOf(armDigit.error) },
        null_code: { sqlstate: errOf(armNull.error), constraint: cnameOf(armNull.error) },
        short: { sqlstate: errOf(armShort.error) },
        dup_code: { sqlstate: errOf(armDupCode.error), constraint: cnameOf(armDupCode.error) },
        dup_sf: { sqlstate: errOf(armDupSf.error), constraint: cnameOf(armDupSf.error) },
      },
    };
  });

  const B = (br.result ?? {}) as Record<string, unknown>;
  const cols = (B.cols ?? []) as Array<Record<string, unknown>>;
  const sfCol = cols.find((r) => r.column_name === 'snowflake_id');
  const codeCol = cols.find((r) => r.column_name === 'item_code');
  const idx = (B.idx ?? []) as Array<{ indexname: string; indexdef: string }>;
  const counts = (B.counts ?? {}) as Record<string, number>;
  const arms = (B.arms ?? {}) as Record<string, { sqlstate?: string; constraint?: string }>;

  ck.t('B1', '迁移 0060 干跑（真库 · 事务内）：两列 = `snowflake_id bigint NOT NULL` / `item_code char(7) NOT NULL`（长度 7）',
    br.error === null && B.tailError === null
    && sfCol?.data_type === 'bigint' && sfCol?.is_nullable === 'NO'
    && codeCol?.data_type === 'character' && codeCol?.is_nullable === 'NO' && Number(codeCol?.character_maximum_length) === 7,
    JSON.stringify({ error: br.error, tail: B.tailError, snowflake_id: sfCol, item_code: codeCol }).slice(0, 500));

  ck.t('B2', '两条唯一索引在场且**确为 UNIQUE**（不是同名空壳）',
    idx.length === 2 && idx.every((r) => /^CREATE UNIQUE INDEX/.test(r.indexdef)),
    JSON.stringify(idx.map((r) => r.indexname)));

  ck.t('B3', 'CHECK 干跑后为**两条件版**：形状正则 ∧ `!~ ^[0-9]{7}$`（纯数字禁令已在库级落地）',
    typeof B.ckDef === 'string' && B.ckDef.includes('[0-9A-Za-z]{7}') && B.ckDef.includes('!~') && B.ckDef.includes('[0-9]{7}'),
    String(B.ckDef ?? '<none>').slice(0, 300));

  const total = Number(counts.total ?? -1);
  ck.t('B4', `存量**全量回填**（${total} 行）：码非空 / 形状合法 / 全在 56 字母表 / **纯数字码 0 行** · 两列取值各自唯一（码 ${counts.distinct_codes} / 雪花 ${counts.distinct_snowflakes}）· 雪花恒正`,
    total > 0 && Number(counts.null_ids) === 0 && Number(counts.bad_shape) === 0
    && Number(counts.off_alphabet) === 0 && Number(counts.digit_codes) === 0
    && Number(counts.distinct_codes) === total && Number(counts.distinct_snowflakes) === total
    && Number(counts.nonpositive) === 0,
    JSON.stringify(counts));

  ck.t('B5', '**行数不变**（回填只补标识列，不增不删）· 回填期摘掉的 `trg_listing_touch_time_updated` 已恢复 `tgenabled=O` 且 listing 上零禁用触发器',
    Number(B.rowsAfter) === Number(B.preRows) && (B.trg as { enabled?: string })?.enabled === 'O'
    && Number((B.trg as { disabled?: number })?.disabled) === 0,
    JSON.stringify({ before: B.preRows, after: B.rowsAfter, trigger: B.trg }));

  ck.t('B6', '尾部 DO 整块**重跑仍绿**（回填 `WHERE IS NULL` / `SET NOT NULL` / CHECK 已是两条件 ⇒ 全 no-op）⇒ 迁移可重放、码一旦下发不再变',
    B.tail2Error === null, JSON.stringify({ second_run_error: B.tail2Error }));

  ck.t('B7', '事务一律回滚（`inRollbackTx` ⇒ 零 apply / 零版本行 / 零 DDL 残留）',
    br.rolled_back === true && br.error === null, `rolled_back=${br.rolled_back} ms=${br.ms}`);

  // ---- N · 负控读数
  ck.t('N1', '★ **负控①（纯数字码禁令）**：直接插 `item_code = \'1234567\'` ⇒ **23514** + `listing_item_code_format_ck`（库级拒收；若这项绿着而生成器坏，纯数字码就会入库并让 `:ref` 判别失效）',
    arms.digit?.sqlstate === '23514' && String(arms.digit?.constraint ?? '').includes('listing_item_code_format_ck'),
    JSON.stringify(arms.digit));

  ck.t('N2', '负控②：缺码（`item_code = NULL`）⇒ **23502** not_null_violation（NOT NULL 真在场）· 6 位码 ⇒ **23514**（形状闸真在场）',
    arms.null_code?.sqlstate === '23502' && arms.short?.sqlstate === '23514',
    JSON.stringify({ null_code: arms.null_code, short: arms.short }));

  ck.t('N3', '负控③：撞已有码 ⇒ **23505** + `listing_item_code_uidx` · 撞已有雪花 ⇒ **23505** + `listing_snowflake_id_uidx`（两唯一索引都不是摆设）',
    arms.dup_code?.sqlstate === '23505' && String(arms.dup_code?.constraint ?? '').includes('listing_item_code_uidx')
    && arms.dup_sf?.sqlstate === '23505' && String(arms.dup_sf?.constraint ?? '').includes('listing_snowflake_id_uidx'),
    JSON.stringify({ dup_code: arms.dup_code, dup_sf: arms.dup_sf }));

  // ---- C/D · 读口键数 + 行为（新事务：真写路径建夹具，回滚自回收）
  const cr = await tx(pool, async (c) => {
    for (const stmt of M60.headStmts) await c.query(stmt);
    await c.query(M60.tail);                        // 真 apply 态（NOT NULL + CHECK + 存量回填）
    const ex = c as unknown as SqlRunner;
    const sellerUid = Number((await raw1<{ uid: string }>(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0'))?.uid ?? 0);
    if (!sellerUid) throw new Error('no usable seller uid in users');

    const a = ids();
    const b = ids();
    const mkA = await DatabaseService.createListingRow({
      sellerUid, cid: 1, price: 100, stock: 3,
      description: `p60-gate fixture A · 详情/链接用码 · RUN=${RUN}`,
      mediaUrls: [], itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew',
      createKey: `${FIXTURE_KEY_PREFIX}${RUN}-a`, ...a, allowMultiBuy: false,
    }, ex);
    const mkB = await DatabaseService.createListingRow({
      sellerUid, cid: 1, price: 60, stock: 2,
      description: `p60-gate fixture B · RUN=${RUN}`,
      mediaUrls: [], itemType: 'DigitalAutoDeliver', itemCondition: null,
      createKey: `${FIXTURE_KEY_PREFIX}${RUN}-b`, ...b, allowMultiBuy: false,
    }, ex);
    const idA = Number((mkA.row as Record<string, unknown>)?.listing_id ?? 0);
    const idB = Number((mkB.row as Record<string, unknown>)?.listing_id ?? 0);

    const rowA = await raw1<Record<string, unknown>>(c,
      'SELECT item_code::text AS code, snowflake_id::text AS sf FROM public.listing WHERE listing_id = $1::bigint', [idA]);
    const rowB = await raw1<Record<string, unknown>>(c,
      'SELECT item_code::text AS code, snowflake_id::text AS sf FROM public.listing WHERE listing_id = $1::bigint', [idB]);

    const resolvedA = await DatabaseService.getListingIdByItemCode(String(rowA?.code ?? ''), ex);
    const resolvedB = await DatabaseService.getListingIdByItemCode(String(rowB?.code ?? ''), ex);
    const resolvedUnknown = await DatabaseService.getListingIdByItemCode('ZZZZZZZ', ex);
    const resolvedShort = await DatabaseService.getListingIdByItemCode('abc', ex);

    // 详情：码解析出的 id 与数字 id **读同一行**（逐键等价；item_code 键即页面地址码）
    const dByCode = await DatabaseService.getPrizeDetailRecordingView(Number(resolvedA ?? 0), ex);
    const dById = await DatabaseService.getPrizeDetailRecordingView(idA, ex);
    const detailKeys = dById ? Object.keys(dById) : [];
    const routeShapeKeys = dById ? Object.keys({ ...dById, seller: null }).length : 0;

    const feed = await DatabaseService.listBrands(0, 8, ex);
    const feedKeys = feed.length ? Object.keys(feed[0]) : [];
    const feedBad = feed.filter((r) => Object.keys(r).length !== 51 || !('item_code' in r) || !('snowflake_id' in r)
      || !('feed_score' in r)
      || !ITEM_CODE_PATTERN.test(String(r.item_code ?? '')) || ALL_DIGITS.test(String(r.item_code ?? '')));

    const mine = await DatabaseService.listListingsBySeller(sellerUid, 0, 100, ex);
    const mineA = mine.find((r) => r.listing_id === idA);
    const mineBad = mine.filter((r) => Object.keys(r).length !== 14 || !('item_code' in r) || !('snowflake_id' in r) || !('allow_multi_buy' in r));

    const edit = await DatabaseService.getListingEditRow(idA, ex);
    const editKeys = edit ? Object.keys(edit.row) : [];

    return {
      idA, idB, sellerUid,
      mkA: mkA.outcome, mkB: mkB.outcome,
      receiptAKeys: mkA.row ? Object.keys(mkA.row) : [],
      codeA: String(rowA?.code ?? ''), sfA: String(rowA?.sf ?? ''),
      codeB: String(rowB?.code ?? ''), sfB: String(rowB?.sf ?? ''),
      resolvedA, resolvedB, resolvedUnknown, resolvedShort,
      detailKeys, routeShapeKeys, detailCode: dByCode?.item_code ?? null,
      sameRow: !!dByCode && !!dById
        && JSON.stringify({ ...dByCode, views: null }) === JSON.stringify({ ...dById, views: null }),
      viewsStep: Number((dById as { views?: number } | null)?.views ?? -1) - Number((dByCode as { views?: number } | null)?.views ?? -1),
      detailHasCode: dById ? 'item_code' in dById : false,
      feedKeys, feedRows: feed.length, feedBad: feedBad.length,
      mineTotal: mine.length, mineBad: mineBad.length,
      mineAKeys: mineA ? Object.keys(mineA).length : -1,
      editKeys,
    };
  });

  const R = (cr.result ?? {}) as Record<string, unknown>;
  const dKeys = (R.detailKeys ?? []) as string[];
  const fKeys = (R.feedKeys ?? []) as string[];

  ck.t('C0', '夹具自建走**真 `createListingRow` 写路径**（0060 头段 + 尾部先在同事务跑一遍 ⇒ 真 apply 态的 NOT NULL + CHECK 下写入）',
    cr.error === null && R.mkA === 'inserted' && R.mkB === 'inserted',
    JSON.stringify({ error: cr.error, a: R.mkA, b: R.mkB, idA: R.idA, idB: R.idB }));

  ck.t('C1', '**建商品两键写入**：库内 `item_code` / `snowflake_id` 均非空 · 码恒 7 位、全在字母表、**非纯数字** · 两次发号的雪花与码都不相同',
    ITEM_CODE_PATTERN.test(String(R.codeA)) && !ALL_DIGITS.test(String(R.codeA))
    && ITEM_CODE_PATTERN.test(String(R.codeB)) && !ALL_DIGITS.test(String(R.codeB))
    && String(R.codeA) !== String(R.codeB) && String(R.sfA) !== String(R.sfB)
    && BigInt(String(R.sfA)) > 0n && BigInt(String(R.sfB)) > BigInt(String(R.sfA)),
    JSON.stringify({ codeA: R.codeA, codeB: R.codeB, sfA: R.sfA, sfB: R.sfB }));

  ck.t('C2', '**码 → id 往返**：`getListingIdByItemCode(code)` = 建单返回的 `listing_id`（两行各一次）· 未知码（`ZZZZZZZ`）与过短串（`abc`）⇒ `null`（零查询 / 不命中，语义 = 404 不区分）',
    Number(R.resolvedA) === Number(R.idA) && Number(R.resolvedB) === Number(R.idB)
    && R.resolvedUnknown === null && R.resolvedShort === null,
    JSON.stringify({ a: R.resolvedA, idA: R.idA, unknown: R.resolvedUnknown, short: R.resolvedShort }));

  ck.t('C3', '**`GET /api/prize/<code>` ≡ `GET /api/prize/<数字 id>`**（路由层把码解析成 `listing_id` 后走同一读口 ⇒ 两次读的服务层行**除 `views` 外逐键逐值相同**，且 `views` 恰 +1 —— 证明确实读到同一行、且自增语义未被入参形态改变）· 行内 `item_code` = 该码 · 详情服务层 **52 键**（0061 +allow_multi_buy）/ 路由合成（+seller）**53 键**',
    R.sameRow === true && R.viewsStep === 1 && R.detailHasCode === true && String(R.detailCode) === String(R.codeA)
    && dKeys.length === 52 && dKeys.includes('item_code') && dKeys.includes('snowflake_id') && dKeys.includes('allow_multi_buy')
    && R.routeShapeKeys === 53,
    JSON.stringify({ same_row: R.sameRow, views_step: R.viewsStep, detail_keys: dKeys.length, route_shape: R.routeShapeKeys, detail_code: R.detailCode, code: R.codeA }));

  ck.t('C4', '**feed 行键 51**（48 + item_code + snowflake_id + feed_score）：全部行恰 51 键、两键恒在场、码全部合法且非纯数字（存量回填行同样成立）',
    Number(R.feedRows) > 0 && Number(R.feedBad) === 0 && fKeys.length === 51,
    JSON.stringify({ rows: R.feedRows, bad: R.feedBad, keys: fKeys.length }));

  ck.t('C5', '**mine 行键 14**（11 + item_code + snowflake_id + allow_multi_buy）：全部行恰 14 键且三键在场 · **edit 读口同族 14 键**（编辑页一套预填）',
    Number(R.mineTotal) > 0 && Number(R.mineBad) === 0 && R.mineAKeys === 14
    && (R.editKeys as string[]).length === 14
    && JSON.stringify((R.editKeys as string[]).slice().sort()) === JSON.stringify((['allow_multi_buy', 'cid', 'condition', 'description', 'item_code', 'item_type', 'listing_id', 'media_urls', 'price', 'snowflake_id', 'status', 'stock', 'time_created', 'title'])),
    JSON.stringify({ mine_total: R.mineTotal, mine_bad: R.mineBad, mine_keys: R.mineAKeys, edit_keys: (R.editKeys as string[]).length }));

  // ====================================================================== E · 冲突重试臂（离线 · 桩替 DB）
  const unit: Array<Record<string, unknown>> = [];
  const svcDb = DatabaseService as unknown as Record<string, unknown>;
  const origGate = svcDb.getCurrencyStatus;
  const origCreate = svcDb.createListingRow;
  const inputs: Array<Record<string, unknown>> = [];
  const dupErr = (constraint: string) => ({ code: '23505', constraint, message: `duplicate key value violates unique constraint "${constraint}"` });
  let mode: 'twice-then-ok' | 'always-dup' | 'create-key-dup' = 'twice-then-ok';
  try {
    svcDb.getCurrencyStatus = async () => ({ status: 'listed' });
    svcDb.createListingRow = async (input: Record<string, unknown>) => {
      inputs.push(input);
      if (mode === 'twice-then-ok' && inputs.length <= 2) throw dupErr('listing_item_code_uidx');
      if (mode === 'always-dup') throw dupErr('listing_snowflake_id_uidx');
      if (mode === 'create-key-dup') throw dupErr('listing_create_key_key');
      return {
        outcome: 'inserted',
        row: {
          listing_id: 990060, seller_uid: input.sellerUid, cid: input.cid, price: input.price, stock: input.stock,
          title: String(input.description ?? '').split('\n')[0], description: input.description,
          media_urls: input.mediaUrls, item_type: input.itemType, status: 'draft', create_key: input.createKey,
          item_code: input.itemCode, snowflake_id: input.snowflakeId,
        },
      };
    };

    const base = {
      sellerUid: 900100, cid: 1, price: 100, stock: 3,
      description: 'p60 gate 冲突重试臂商品\n第二行描述', mediaUrls: [] as string[],
      itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew',
    };

    // E1 · 前两次撞码 ⇒ 第三次成功（每次都是新雪花 ⇒ 新码）
    inputs.length = 0;
    mode = 'twice-then-ok';
    const ok = await createListing({ ...base, createKeyRaw: `cli:p60-gate:${RUN}-retry` });
    const tried = inputs.map((x) => String(x.itemCode ?? ''));
    const sfs = inputs.map((x) => String(x.snowflakeId ?? ''));
    unit.push({
      id: 'E1', what: '撞码**重试臂**：前两次 23505（item_code）⇒ 第 3 次成功 · 恰 3 次写库调用 · 三次候选码互不相同（重生必换码）· 雪花亦不相同',
      pass: ok.ok && inputs.length === 3 && new Set(tried).size === 3 && new Set(sfs).size === 3,
      reading: JSON.stringify({ ok: ok.ok, calls: inputs.length, codes: tried, snowflakes: sfs }),
    });
    ck.t('E1', (unit[0].what as string), unit[0].pass as boolean, unit[0].reading as string);

    // E2 · 负控①：恒撞 ⇒ 3 次后**上抛**（不静默成功、不落半行）
    inputs.length = 0;
    mode = 'always-dup';
    let thrown: unknown = null;
    try {
      await createListing({ ...base, createKeyRaw: `cli:p60-gate:${RUN}-neg` });
    } catch (e) { thrown = e; }
    unit.push({
      id: 'E2', what: '★ **负控①（重试用尽必须上抛）**：恒 23505 ⇒ 恰 3 次尝试后**抛错**（`code=23505`）· 绝不「第 4 次成功」、绝不返回半成品',
      pass: inputs.length === ITEM_ID_CREATE_ATTEMPTS && String((thrown as { code?: string })?.code ?? '') === '23505',
      reading: JSON.stringify({ calls: inputs.length, thrown: String((thrown as { code?: string })?.code ?? '') }),
    });
    ck.t('E2', (unit[1].what as string), unit[1].pass as boolean, unit[1].reading as string);

    // E3 · 负控②：create_key 撞车**不进** id 重试（幂等键语义，1 次即上抛）
    inputs.length = 0;
    mode = 'create-key-dup';
    let thrownKey: unknown = null;
    try {
      await createListing({ ...base, createKeyRaw: `cli:p60-gate:${RUN}-ck` });
    } catch (e) { thrownKey = e; }
    unit.push({
      id: 'E3', what: '**负控②（幂等键不被 id 重试吞掉）**：`create_key` 撞车 ⇒ **1 次即上抛**（`isItemIdUniqueViolation` 按名排除 `create_key`）⇒ 幂等语义不被改写成「换个 id 重投」',
      pass: inputs.length === 1 && String((thrownKey as { code?: string })?.code ?? '') === '23505'
        && String((thrownKey as { constraint?: string })?.constraint ?? '') === 'listing_create_key_key',
      reading: JSON.stringify({ calls: inputs.length, thrown: String((thrownKey as { constraint?: string })?.constraint ?? '') }),
    });
    ck.t('E3', (unit[2].what as string), unit[2].pass as boolean, unit[2].reading as string);

    // E4 · 每次尝试都带两键（生成与写入同批，不存在「先写后补」）
    unit.push({
      id: 'E4', what: '每次尝试的写库载荷都带 `snowflakeId`（字符串）+ `itemCode`（7 位非纯数字）—— 两键**同批**进 INSERT，无「先写后补」窗口',
      pass: inputs.length === 0 || sfs.every((s) => /^\d+$/.test(s)) && tried.every((c) => ITEM_CODE_PATTERN.test(c) && !ALL_DIGITS.test(c)),
      reading: JSON.stringify({ last_calls: sfs.length }),
    });
    ck.t('E4', (unit[3].what as string), unit[3].pass as boolean, unit[3].reading as string);
  } finally {
    svcDb.getCurrencyStatus = origGate;
    svcDb.createListingRow = origCreate;
  }
  ck.t('E5', '桩已回收（`getCurrencyStatus` / `createListingRow` 逐字还原）',
    svcDb.getCurrencyStatus === origGate && svcDb.createListingRow === origCreate, 'restored');

  // ====================================================================== F · 零残留
  const residue = await raw1Retry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.listing WHERE create_key LIKE $1', [`${FIXTURE_KEY_PREFIX}%`]);
  ck.t('F1', '**零残留**：回滚后 `create_key LIKE cli:p60-gate:%` 命中 = 0（含历史 run）+ 0060 **未 apply**（`schema_migration` 顶仍 0059 或更低 ⇒ 本门全程未落版本行）',
    Number(residue?.n ?? -1) === 0,
    `residue_rows=${residue?.n}`);

  const top = await raw1Retry<{ version: string }>(pool, 'SELECT version FROM schema_migration ORDER BY version DESC LIMIT 1');
  const postCol = await raw1Retry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name IN ('snowflake_id','item_code')");
  out.migration_state = { head: top?.version ?? '', committed_id_columns: postCol?.n ?? -1 };
  ck.t('F2', '**committed 库面未被本门改动**（列数与开跑时的迁移态一致：pre-apply ⇒ 0 列 / post-apply ⇒ 2 列）',
    Number(postCol?.n ?? -1) === (out.mode === 'pre-apply' ? 0 : 2),
    JSON.stringify(out.migration_state));

  await pool.end();

  // ====================================================================== 落盘
  out.migration = { head_stmts: M60.headStmts.length, head_bytes: M60.head.length, tail_bytes: M60.tail.length };
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p60-item-id-gate', out);
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
