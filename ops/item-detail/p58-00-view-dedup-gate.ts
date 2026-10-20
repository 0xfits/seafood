/**
 * p58-00 · 详情浏览**去重开关**（迁移 0058：listing_view_log + app_config 键 detail_view_dedup）后端离线门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/item-detail/p58-00-view-dedup-gate.ts
 * 读数：`ops/item-detail/readings/p58-view-dedup-gate-<RUN>.json`
 *
 * ★ 覆盖面（Kevin 2026-10-20「后台开关」：可选去重/不去重 · **代码默认 = on（去重）· 当前配置 = off**）：
 *   A · 静态面：本单零新路由（regs=110 → 111 由 0059 admin-edit 单前推）· 路由 off/on 两臂接线（off 臂仍字面调既有专用口）·
 *       服务层四新口（开关读 / 日志落行 ON CONFLICT / 只读臂 / on 分支编排）·
 *       自增语句全仓仍恰 1 处（单一真源不破）· 白名单 9→10 键 · 迁移文件形状（表/具名唯一约束/
 *       索引/零 FK/开关行 `{"dedup":"off"}`/ON CONFLICT (key) DO NOTHING/头段无 BEGIN/COMMIT）；
 *   U · 开关值解析单元（fail-safe：非 on 即 off ⇒ 其余一切默认 on）；解析恒真/恒假不可达；
 *   B · 迁移干跑（真库 · `inRollbackTx` ⇒ ROLLBACK ⇒ **零 apply / 零残留**）：
 *       0058 头段（建表 + 索引 + 开关行）+ 尾部 DO 自检在真库跑通（0057 头段同事务内先行 ⇒ 夹具写路径可用）；
 *       ★ **步序 = 迁移链顺序**：0057 头 → 0058 头 → **0058 尾** → 0060 头 → 0061 头 → 读口臂
 *       （0058 尾部 ⑥ 臂硬断 listing 15 列 —— 该断言只在 0058 自身 apply 时点成立：pre-apply 库上
 *       照跑；post-apply 库 committed 已 18 列（0060×2 + 0061×1）⇒ 尾部自检按稳态跳过（p57 B2 同体例），
 *       结构面由 B1 五列实查 + A6 静态形状 + N3 约束负控覆盖，**不放宽迁移断言本身**）；
 *   C · 行为（同 tx · **service 层真实代码路径**，经 `sqlFor(ex)` 事务内注入）：
 *       off ⇒ 连刷 3 次 views 逐次 +1（现状不变）· 事务内改配置 on ⇒ 同 viewer 第二次不涨、
 *       不同 viewer 各 +1（uid / 匿名头）· **不同天不计**（夹具日 = 昨天行不抑制今天自增）·
 *       404 不计数不写日志 · 只读臂 49 键同形且零自增；
 *   N · 负控：① **判定中和臂**（桩替 `recordDetailViewLog` 恒 true = 等价「去掉 ON CONFLICT 判定」）
 *       ⇒ on 模式连刷必涨（正判据 C3 非恒绿、门必红）② 开关非法值（banana / 非串 / 缺字段 / 行缺席）
 *       ⇒ **按默认 on 处理（fail-safe）**③ 唯一约束真在场（裸 INSERT 重复 ⇒ 23505）；
 *   E · 零残留证：回滚后夹具 create_key 命中 = 0 · listing_view_log / 开关行 committed 态与迁移态自洽 ·
 *       库身份自证（neon.project_id）。
 *
 * 纪律：**不 apply、不写版本表、零 DDL/DML 落库**（一切写都在回滚事务内）；
 *   夹具 = **真 `createListingRow` 写路径**自建、事务回滚自回收；探针凭据只读 `.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, rawRetry, raw1Retry } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
// ★ 迁移 0060：读口行键 49→51（+item_code +snowflake_id）⇒ 事务内补两列 + 夹具带两键
import { codeFromSnowflake, nextSnowflake } from '../../backend-ts/src/item-id';
import type { BrandRecord, SqlRunner } from '../../backend-ts/src/database';
import {
  APP_CONFIG_LEGAL_KEYS,
  DETAIL_VIEW_DEDUP_KEY,
  DETAIL_VIEW_DEDUP_LEGAL_VALUES,
  parseDetailViewDedupSwitch,
} from '../../backend-ts/src/database';

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
const MIG58 = readSrc('backend-ts/migrations/0058_view_dedup_switch.sql');
const MIG57 = readSrc('backend-ts/migrations/0057_listing_view_count.sql');

/** 迁移文件切单语句（承 p57 体例：剥 `--` 注释行再按 `;` 切头段；尾部 DO 块整块单语句跑）。 */
const stripSqlLineComments = (text: string): string =>
  text.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');
const splitMigration = (text: string): { head: string; tail: string; headStmts: string[] } => {
  const at = text.indexOf('\nDO $$');
  if (at < 0) throw new Error('migration self-check block (DO $$) not found');
  const head = text.slice(0, at).trim();
  const tail = text.slice(at).trim();
  const headStmts = stripSqlLineComments(head).split(';').map((s) => s.trim()).filter(Boolean);
  return { head, tail, headStmts };
};
const M58 = splitMigration(MIG58);
const M57 = splitMigration(MIG57);
const M60 = splitMigration(readSrc('backend-ts/migrations/0060_item_code_snowflake.sql'));
const M61 = splitMigration(readSrc('backend-ts/migrations/0061_listing_allow_multi_buy.sql'));

const sliceBetween = (src: string, startMark: string, endMark: string): string => {
  const a = src.indexOf(startMark);
  const b = src.indexOf(endMark, a + 1);
  return a >= 0 && b > a ? src.slice(a, b) : '';
};

const newIds = (): { snowflakeId: string; itemCode: string } => {
  const sf = nextSnowflake();
  return { snowflakeId: sf.toString(), itemCode: codeFromSnowflake(sf) };
};
const FIXTURE_KEY_PREFIX = 'cli:p58-gate:';

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/item-detail/p58-00-view-dedup-gate.ts' };

  // ====================================================================== A · 静态面（零 DB）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  ck.t('A1', '**零新路由**：注册点 = 111（本单**零新路由**；111 = 0059 admin-edit 的 `GET /api/listing/:listingId/edit`，本单只改详情读口内部分支）',
    regs === 111, `registration_points=${regs}`);

  const detailBlock = sliceBetween(INDEX_TS, "app.get('/api/prize/:bID'", "app.get('/api/user'");
  ck.t('A2', '路由两臂接线：开关读 `isDetailViewDedupEnabled` 在场 · **off 臂仍字面调** `getPrizeDetailRecordingView(bID)`（P57 专用口不挪窝）· on 臂走 `getPrizeDetailViewWithViewer` · `getPrizeById(` 不在详情路由（裸读不回流）· 仅 on 时解析访客（off 零 cookie/头读取）',
    /DatabaseService\.isDetailViewDedupEnabled\(\)/.test(detailBlock)
    && /DatabaseService\.getPrizeDetailRecordingView\(bID\)/.test(detailBlock)
    && /DatabaseService\.getPrizeDetailViewWithViewer\(bID,/.test(detailBlock)
    && !/getPrizeById\(/.test(detailBlock)
    && /dedupOn \? resolveDetailViewViewerKey\(req, res\) : null/.test(detailBlock),
    JSON.stringify({
      switch_read: /isDetailViewDedupEnabled/.test(detailBlock), off_arm_literal: /getPrizeDetailRecordingView\(bID\)/.test(detailBlock),
      on_arm: /getPrizeDetailViewWithViewer/.test(detailBlock), bare_read回流: /getPrizeById\(/.test(detailBlock),
    }));

  const cookieMint = detailBlock + INDEX_TS.slice(INDEX_TS.indexOf('const DETAIL_VIEWER_HEADER'), INDEX_TS.indexOf('const parseBoolean'));
  ck.t('A3', '匿名访客面：头 `x-sf-viewer` 优先 · cookie `sf_viewer` 复用 · 缺失**发** `sf_viewer=<uuid4>`（HttpOnly; SameSite=Lax; Max-Age=1 年）· **P59 后缓存头不再二分**：详情路由无条件 `setPrivateNoStore(res)`（发 cookie 的串号风险被 no-store 整体覆盖）· `setPublicCache` / `mintedCookie` 在详情块**零命中** · viewer_key 前缀 uid:/anon: 分域',
    cookieMint.includes("'x-sf-viewer'") && cookieMint.includes("'sf_viewer'")
    && /HttpOnly; SameSite=Lax; Max-Age=/.test(cookieMint)
    && /60 \* 60 \* 24 \* 365/.test(cookieMint)
    && /randomUUID\(\)/.test(cookieMint)
    && /setPrivateNoStore\(res\)/.test(detailBlock) && !/setPublicCache\(/.test(detailBlock)
    && !/mintedCookie/.test(detailBlock)
    && /`uid:\$\{session\.uID\}`/.test(cookieMint) && /`anon:\$\{/.test(cookieMint),
    JSON.stringify({
      header: cookieMint.includes("'x-sf-viewer'"), cookie: cookieMint.includes("'sf_viewer'"),
      attrs: /HttpOnly; SameSite=Lax; Max-Age=/.test(cookieMint), uuid: /randomUUID\(\)/.test(cookieMint),
      unconditional_no_store: /setPrivateNoStore\(res\)/.test(detailBlock),
      detail_public_cache_hits: /setPublicCache\(/.test(detailBlock),
      detail_minted_cookie_hits: /mintedCookie/.test(detailBlock),
    }));

  const incrHits = (DB.match(/view_count = view_count \+ 1/g) ?? []).length;
  const detailSvc = sliceBetween(DB, 'static async getPrizeDetailRecordingView', 'static async listPrizes');
  const readOnlySvc = sliceBetween(DB, 'static async getPrizeDetailReadOnly', 'static async getPrizeDetailViewWithViewer');
  const logSvc = sliceBetween(DB, 'static async recordDetailViewLog', 'static async getPrizeDetailReadOnly');
  ck.t('A4', '服务层四新口在场且**单一真源不破**：`view_count = view_count + 1` 全仓仍恰 1 处（在既有 CTE 内）· `isDetailViewDedupEnabled` / `recordDetailViewLog` / `getPrizeDetailViewWithViewer` / `getPrizeDetailReadOnly` 齐 · 只读臂**零自增零 UPDATE** · 日志口 `ON CONFLICT ON CONSTRAINT listing_view_log_uniq DO NOTHING` 在场 · 编排口 fail-open（catch ⇒ null）',
    incrHits === 1 && /view_count = view_count \+ 1/.test(detailSvc) && /WITH bumped AS/.test(detailSvc)
    && /static async isDetailViewDedupEnabled/.test(DB) && logSvc.length > 0
    && /ON CONFLICT ON CONSTRAINT listing_view_log_uniq DO NOTHING/.test(logSvc)
    && /WHERE EXISTS \(SELECT 1 FROM public\.listing WHERE listing_id = \$\{bID\}\)/.test(logSvc)
    && readOnlySvc.length > 0 && !/view_count \+ 1/.test(readOnlySvc) && !/\bUPDATE\b/i.test(readOnlySvc)
    && /catch \{\s*\n\s*logged = null;/.test(sliceBetween(DB, 'static async getPrizeDetailViewWithViewer', 'static async listPrizes')),
    `increment_sites=${incrHits} log_slice=${logSvc.length} readonly_slice=${readOnlySvc.length}`);

  ck.t('A5', 'app_config 合法键白名单同步前推：恰 **10** 键且含 `detail_view_dedup`（真源常量断言 · 在册 ≠ 可写：无 AV2 校验器 ⇒ /api/admin/settings 写该键仍 fail-closed 拒）',
    APP_CONFIG_LEGAL_KEYS.length === 10
    && (APP_CONFIG_LEGAL_KEYS as readonly string[]).includes(DETAIL_VIEW_DEDUP_KEY)
    && (DB.match(/validateNumericPolicyValue\(targetKey, value\)/g) ?? []).length === 1,
    `legal_keys=${APP_CONFIG_LEGAL_KEYS.length} has_key=${(APP_CONFIG_LEGAL_KEYS as readonly string[]).includes(DETAIL_VIEW_DEDUP_KEY)}`);

  ck.t('A6', '迁移 0058 形状：`CREATE TABLE IF NOT EXISTS public.listing_view_log`（五列逐字：bigserial PK / listing_id bigint NOT NULL / viewer_key text NOT NULL / view_day date NOT NULL DEFAULT current_date / time_created timestamptz NOT NULL DEFAULT now()）· 具名 `listing_view_log_uniq UNIQUE (listing_id, viewer_key, view_day)` · 索引 `listing_view_log_listing_idx` · **零 REFERENCES（不建 FK）** · 头段代码行无 BEGIN/COMMIT · `ADD COLUMN` 零处（listing 列面不动）',
    /CREATE TABLE IF NOT EXISTS public\.listing_view_log/.test(MIG58)
    && /id\s+bigserial\s+NOT NULL/.test(MIG58) && /listing_id\s+bigint\s+NOT NULL/.test(MIG58)
    && /viewer_key\s+text\s+NOT NULL/.test(MIG58)
    && /view_day\s+date\s+NOT NULL DEFAULT current_date/.test(MIG58)
    && /time_created\s+timestamptz NOT NULL DEFAULT now\(\)/.test(MIG58)
    && /CONSTRAINT listing_view_log_uniq UNIQUE \(listing_id, viewer_key, view_day\)/.test(MIG58)
    && /CREATE INDEX IF NOT EXISTS listing_view_log_listing_idx/.test(MIG58)
    && !/REFERENCES/i.test(MIG58)
    && !/\bBEGIN\b/.test(stripSqlLineComments(M58.head)) && !/\bCOMMIT\b/.test(stripSqlLineComments(M58.head))
    && (MIG58.match(/ADD COLUMN/g) ?? []).length === 0,
    JSON.stringify({
      table: /CREATE TABLE IF NOT EXISTS public\.listing_view_log/.test(MIG58), uniq: /listing_view_log_uniq/.test(MIG58),
      idx: /listing_view_log_listing_idx/.test(MIG58), fk: /REFERENCES/i.test(MIG58),
      begins: /\bBEGIN\b/.test(stripSqlLineComments(M58.head)), adds: (MIG58.match(/ADD COLUMN/g) ?? []).length,
    }));

  ck.t('A7', '迁移 0058 开关行：键 `detail_view_dedup` · 值 `{"dedup":"off"}`（**当前不去重**；0017 容器 CHECK ⇒ 对象包裹）· `ON CONFLICT (key) DO NOTHING`（反复 apply 不覆盖运维翻转值）· 尾部 DO 自检在场',
    /VALUES \('detail_view_dedup', '\{"dedup":"off"\}'::jsonb, 0\)/.test(MIG58)
    && /ON CONFLICT \(key\) DO NOTHING/.test(MIG58)
    && /\nDO \$\$/.test(MIG58) && /expect on\|off/.test(MIG58),
    JSON.stringify({ row: /detail_view_dedup/.test(MIG58), idempotent: /ON CONFLICT \(key\) DO NOTHING/.test(MIG58) }));

  // ====================================================================== U · 解析单元（离线）
  const unit: Array<Record<string, unknown>> = [];
  const u = (id: string, what: string, pass: boolean, reading: unknown) => {
    unit.push({ id, what, pass, reading });
    ck.t(id, what, pass, typeof reading === 'string' ? reading : JSON.stringify(reading));
  };
  u('U1', '解析正例：`on` ⇒ true（去重）· `off` ⇒ false（不去重）',
    parseDetailViewDedupSwitch('on') === true && parseDetailViewDedupSwitch('off') === false,
    { on: parseDetailViewDedupSwitch('on'), off: parseDetailViewDedupSwitch('off') });
  u('U2', '解析 normalize：`ON` / ` OFF `（大小写·首尾空白）同合法值',
    parseDetailViewDedupSwitch('ON') === true && parseDetailViewDedupSwitch(' OFF ') === false,
    { ON: parseDetailViewDedupSwitch('ON'), spaced_off: parseDetailViewDedupSwitch(' OFF ') });
  u('U3', '**fail-safe 全臂**：非法串 `banana` / 空串 / 非字符串（boolean·null·undefined·对象）⇒ 一律默认 **on（去重）**——缺配置永不静默关闸',
    parseDetailViewDedupSwitch('banana') === true && parseDetailViewDedupSwitch('') === true
    && parseDetailViewDedupSwitch(true) === true && parseDetailViewDedupSwitch(null) === true
    && parseDetailViewDedupSwitch(undefined) === true && parseDetailViewDedupSwitch({ dedup: 'off' }) === true,
    { banana: parseDetailViewDedupSwitch('banana'), empty: parseDetailViewDedupSwitch(''), bool: parseDetailViewDedupSwitch(true), obj: parseDetailViewDedupSwitch({ dedup: 'off' }) });
  u('U4', '合法值闭集真源 = `DETAIL_VIEW_DEDUP_LEGAL_VALUES`（恰 on|off · 迁移自检同族）',
    JSON.stringify([...DETAIL_VIEW_DEDUP_LEGAL_VALUES]) === JSON.stringify(['on', 'off']),
    JSON.stringify([...DETAIL_VIEW_DEDUP_LEGAL_VALUES]));

  // ====================================================================== 真库段（B / C / N / E）
  const pool = mkPool(2);
  const projRows = await rawRetry(pool, "SELECT current_setting('neon.project_id', true) AS project_id, current_setting('neon.branch_id', true) AS branch_id");
  const projectId = String(projRows[0]?.project_id ?? '');
  out.env = { project_id: projectId, branch_id: String(projRows[0]?.branch_id ?? ''), expect_dev: 'quiet-math-65207667' };
  ck.t('ENV', '库身份自证：neon.project_id = dev（quiet-math-65207667）—— 读数归因前置',
    projectId === 'quiet-math-65207667', `project_id=${projectId}`);

  const preRows = await rawRetry(pool,
    "SELECT to_regclass('public.listing_view_log') IS NOT NULL AS tbl, EXISTS (SELECT 1 FROM public.app_config WHERE key = 'detail_view_dedup') AS cfg");
  const preTbl = preRows[0]?.tbl === true;
  const preCfg = preRows[0]?.cfg === true;
  const mode = preTbl && preCfg ? 'post-apply' : (!preTbl && !preCfg ? 'pre-apply' : 'partial-STOP');
  out.mode = mode;
  ck.t('ENV2', '迁移态可判读（pre-apply = 表与开关行均缺席 ⇒ 事务内干跑；post-apply = 均在场 ⇒ 头段幂等 no-op；partial = STOP）',
    mode === 'pre-apply' || mode === 'post-apply', `mode=${mode} table=${preTbl} config_row=${preCfg}`);

  if (mode === 'partial-STOP') {
    ck.t('B1', '迁移态 partial（表在开关行不在 / 反之）⇒ 停手人工核查', false, 'partial 0058 state');
  } else {
    // ---- B · 迁移干跑（回滚事务；0057 头段先行 ⇒ 夹具写路径在 pre-apply-0057 的库上同样可用） ----
    // ★ 执行顺序 = **迁移链顺序**（0057 → 0058 头段 → 0058 尾部自检 → 0060 头段）：
    //   0058 尾部自检硬断「listing 恒 15 列」（该迁移零列变更），而 0060 头段要加两列 ⇒ 若先跑 0060
    //   再跑 0058 尾部，自检会读到 17 列而误红（与迁移链真实顺序相反）。故 0058 的「头段 + 尾部自检」
    //   作为**完整一步**先跑完，0060 两列留给其后的读口段（C / N 夹具需新两键）。
    const br = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      for (const stmt of M58.headStmts) await c.query(stmt);
      const cols = await raw(c, "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='listing_view_log' ORDER BY ordinal_position");
      const uniq = await raw1(c, "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = 'public.listing_view_log'::regclass AND conname = 'listing_view_log_uniq' AND contype = 'u'");
      const idx = await raw1(c, "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND tablename='listing_view_log' AND indexname='listing_view_log_listing_idx'");
      const fk = await raw1(c, "SELECT count(*)::int AS n FROM pg_constraint WHERE conrelid = 'public.listing_view_log'::regclass AND contype = 'f'");
      const cfg = await raw1(c, "SELECT value ->> 'dedup' AS dedup, jsonb_typeof(value) AS jtype FROM public.app_config WHERE key = 'detail_view_dedup'");
      const switchRead = await DatabaseService.isDetailViewDedupEnabled(c as unknown as SqlRunner);
      const listingColsBefore = await raw1(c, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listing'");
      // 0058 尾部 DO 自检 —— 仅 pre-apply 模式整块跑（⑥ 臂硬断「listing 恒 15 列」，该断言只在 0058
      //   自身 apply 时点成立；post-apply committed 已 18 列（0060×2 + 0061×1）⇒ 重放必误红 ⇒ 按稳态
      //   跳过（p57 B2 同体例）。判据不放宽：pre-apply 下仍必须整块跑通；post-apply 的结构面由
      //   B1 五列实查 + A6 静态形状（含 ⑥ 臂源文）+ N3 约束负控覆盖。
      // ★ 顺序 = 迁移链：0057 头 → 0058 头 → **0058 尾** → 0060 头 → 0061 头（尾部先于链上后续列变更）
      let tailRan = false;
      let tailError: string | null = null;
      if (mode === 'pre-apply') {
        try { await c.query(M58.tail); tailRan = true; } catch (e) { tailError = String((e as Error).message).slice(0, 240); }
      }
      const listingColsAtTail = await raw1(c, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listing'");
      // 链上后续步：0060 头段 + 0061 头段（未 apply 时补列 · ROLLBACK 零残留）—— 只补列面，不回头影响 0058 判据
      for (const stmt of M60.headStmts) await c.query(stmt);
      for (const stmt of M61.headStmts) await c.query(stmt);
      const listingColsAfter60 = await raw1(c, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listing'");
      const listingColsAfter61 = await raw1(c, "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'listing'");
      return { cols, uniq, idx, fk, cfg, switchRead, tailRan, tailError, listingColsBefore, listingColsAtTail, listingColsAfter60, listingColsAfter61 };
    });
    const bCols = (br.result?.cols ?? []) as Array<Record<string, unknown>>;
    const colOf = (name: string) => bCols.find((r) => r.column_name === name);
    ck.t('B1', '迁移头段干跑（事务内）⇒ 表五列逐字：id bigserial PK · listing_id bigint · viewer_key text · view_day date DEFAULT current_date · time_created timestamptz —— 且**全 NOT NULL**',
      br.error === null && bCols.length === 5
      && colOf('id')?.data_type === 'bigint' && colOf('id')?.is_nullable === 'NO' && String(colOf('id')?.column_default ?? '').startsWith('nextval')
      && colOf('listing_id')?.data_type === 'bigint' && colOf('listing_id')?.is_nullable === 'NO'
      && colOf('viewer_key')?.data_type === 'text' && colOf('viewer_key')?.is_nullable === 'NO'
      && colOf('view_day')?.data_type === 'date' && colOf('view_day')?.is_nullable === 'NO' && String(colOf('view_day')?.column_default ?? '').toLowerCase().includes('current_date')
      && colOf('time_created')?.data_type === 'timestamp with time zone' && colOf('time_created')?.is_nullable === 'NO',
      JSON.stringify({ error: br.error, cols: bCols }).slice(0, 500));
    const cfgDedup = String(br.result?.cfg?.dedup ?? '');
    const cfgLegal = ['on', 'off'].includes(cfgDedup);
    ck.t('B2', '约束面：具名唯一约束 `listing_view_log_uniq` 恰 1 · 索引 `listing_view_log_listing_idx` 恰 1 · **FK = 0**（历史商品删除不阻碍日志保留）· 开关行 object 且值合法（pre-apply 干跑落行 = off；post-apply = 运维现值 on|off 均过）· pre-apply 下服务层开关读（同事务）= false（off ⇒ 不去重）',
      Number(br.result?.uniq?.n ?? -1) === 1 && Number(br.result?.idx?.n ?? -1) === 1 && Number(br.result?.fk?.n ?? -1) === 0
      && br.result?.cfg?.jtype === 'object' && cfgLegal && (mode === 'pre-apply' ? (cfgDedup === 'off' && br.result?.switchRead === false) : true),
      JSON.stringify({ uniq: br.result?.uniq?.n, idx: br.result?.idx?.n, fk: br.result?.fk?.n, cfg: br.result?.cfg, switch_read: br.result?.switchRead, mode }));
    ck.t('B3', mode === 'pre-apply'
      ? '迁移尾部 DO 自检（真库 · 事务内 · **按迁移链顺序：0057 头 → 0058 头 → 0058 尾 → 0060 头 → 0061 头**）跑通：五列/唯一约束/索引/零 FK/开关行合法（on|off）/**listing 在其自身时点仍 15 列**（尾部断言原样未放宽，0060 两列 + 0061 一列在其后才加入）'
      : '迁移尾部 DO 自检按稳态跳过（post-apply：committed listing 已带 0060 ×2 + 0061 ×1 = 18 列，0058 尾部 ⑥ 臂的「15 列」断言只在其 apply 时点成立 ⇒ 不在异时点重放；结构面已由 B1 五列实查 + A6 静态形状 + N3 约束负控覆盖）',
      mode === 'pre-apply' ? (br.result?.tailRan === true && br.result?.tailError === null) : true,
      JSON.stringify({
        tail_ran: br.result?.tailRan, tail_error: br.result?.tailError,
        listing_cols_before_tail: br.result?.listingColsBefore?.n,
        listing_cols_at_tail: br.result?.listingColsAtTail?.n,
        listing_cols_after_0060: br.result?.listingColsAfter60?.n,
        listing_cols_after_0061: br.result?.listingColsAfter61?.n,
      }));
    ck.t('B4', '事务已回滚（`inRollbackTx` 恒 ROLLBACK ⇒ 零 apply / 零版本行 / 零残留）',
      br.rolled_back === true && br.error === null, `rolled_back=${br.rolled_back} ms=${br.ms}`);

    // ---- C · 详情读口开关两臂行为（同 tx · service 层真实代码路径） ----
    const cr = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      for (const stmt of M58.headStmts) await c.query(stmt);
      for (const stmt of M60.headStmts) await c.query(stmt);   // 0060 未 apply 时补两列（ROLLBACK 零残留）
      for (const stmt of M61.headStmts) await c.query(stmt);   // 0061 一列（createListingRow 绑 allow_multi_buy 的前提；post-apply 幂等 no-op）
      const ex = c as unknown as SqlRunner;
      const sellerRow = await raw1(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0');
      const sellerUid = Number(sellerRow?.uid ?? 0);
      if (!sellerUid) throw new Error('no usable seller uid in users');

      const mkA = await DatabaseService.createListingRow({
        sellerUid, cid: 1, price: 100, stock: 3,
        description: `p58-gate fixture A · 去重开关夹具 · RUN=${RUN}`,
        mediaUrls: [], itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew',
        createKey: `${FIXTURE_KEY_PREFIX}${RUN}-a`, ...newIds(), allowMultiBuy: false,
      }, ex);
      const idA = Number(mkA.row ? (mkA.row as Record<string, unknown>).listing_id : 0);
      await c.query("UPDATE public.listing SET status = 'listed' WHERE listing_id = $1", [idA]);

      // 开关基线：干跑落行后（pre-apply）= 'off'；post-apply 下显式归零（对齐「当前值 = 不去重」）
      await c.query("UPDATE public.app_config SET value = '{\"dedup\":\"off\"}'::jsonb WHERE key = 'detail_view_dedup'");
      const offFlag = await DatabaseService.isDetailViewDedupEnabled(ex);

      // C1 · off（现状）⇒ 连刷 3 次 views 逐次 +1（不写日志、零访客面）
      const off1 = await DatabaseService.getPrizeDetailRecordingView(idA, ex);
      const off2 = await DatabaseService.getPrizeDetailRecordingView(idA, ex);
      const off3 = await DatabaseService.getPrizeDetailRecordingView(idA, ex);

      // C2 · 事务内改配置 ⇒ on（去重生效）
      await c.query("UPDATE public.app_config SET value = '{\"dedup\":\"on\"}'::jsonb WHERE key = 'detail_view_dedup'");
      const onFlag = await DatabaseService.isDetailViewDedupEnabled(ex);

      // C3 · 同 viewer 第二次不涨（rowCount=1 才 +1）
      const v1 = await DatabaseService.getPrizeDetailViewWithViewer(idA, 'uid:900101', ex);
      const v2 = await DatabaseService.getPrizeDetailViewWithViewer(idA, 'uid:900101', ex);
      const logSame = await raw1(c, "SELECT count(*)::int AS n FROM public.listing_view_log WHERE listing_id = $1 AND viewer_key = 'uid:900101' AND view_day = current_date", [idA]);

      // C4 · 不同 viewer 各 +1（登录 uid / 匿名头两形态）
      const v3 = await DatabaseService.getPrizeDetailViewWithViewer(idA, 'uid:900102', ex);
      const v4 = await DatabaseService.getPrizeDetailViewWithViewer(idA, 'anon:hdr-p58-1', ex);

      // C5 · 不同天不计（夹具日 = 昨天）：昨日访客今天再访 ⇒ 新一天 ⇒ 自增
      await c.query("INSERT INTO public.listing_view_log (listing_id, viewer_key, view_day) VALUES ($1, 'uid:900103', current_date - 1)", [idA]);
      const v5 = await DatabaseService.getPrizeDetailViewWithViewer(idA, 'uid:900103', ex);
      const logYesterday = await raw1(c, "SELECT count(*)::int AS n FROM public.listing_view_log WHERE listing_id = $1 AND viewer_key = 'uid:900103'", [idA]);

      // C6 · 404 不计数不写日志
      const ghostId = 900000000 + Number(String(Date.now()).slice(-6));
      const recGhost = await DatabaseService.getPrizeDetailViewWithViewer(ghostId, 'uid:900104', ex);
      const logGhost = await raw1(c, 'SELECT count(*)::int AS n FROM public.listing_view_log WHERE listing_id = $1', [ghostId]);
      const vcAfterGhost = await raw1(c, 'SELECT view_count::text AS vc FROM public.listing WHERE listing_id = $1', [idA]);

      // C7 · 只读臂：52 键同形（0060 +item_code +snowflake_id、0061 +allow_multi_buy）、views = 现值、连读两次零自增
      const ro1 = await DatabaseService.getPrizeDetailReadOnly(idA, ex);
      const ro2 = await DatabaseService.getPrizeDetailReadOnly(idA, ex);
      const roKeys = ro1 ? Object.keys(ro1) : [];
      const sameShape = (() => {
        const base = off1 ? Object.keys(off1) : [];
        return JSON.stringify([...base].sort()) === JSON.stringify([...roKeys].sort());
      })();

      return {
        sellerUid, idA, ghostId, offFlag, onFlag,
        off_views: [off1?.views, off2?.views, off3?.views],
        v1: v1?.views, v2: v2?.views, log_same_day: logSame?.n,
        v3: v3?.views, v4: v4?.views,
        v5: v5?.views, log_yesterday_total: logYesterday?.n,
        recGhost, log_ghost: logGhost?.n, vc_after_ghost: String(vcAfterGhost?.vc ?? ''),
        ro_views: [ro1?.views, ro2?.views], ro_keys: roKeys.length, ro_shape_same: sameShape,
        wants: ro1?.wants, condition: ro1?.condition,
      };
    });
    const R = (cr.result ?? {}) as Record<string, unknown>;

    ck.t('C0', '夹具自建走**真 createListingRow 写路径**（0057+0058 头段同事务先行）⇒ inserted · 开关读两态：干跑行 = false（off）· 事务内改配置后 = true（on）',
      cr.error === null && R.offFlag === false && R.onFlag === true,
      JSON.stringify({ error: cr.error, idA: R.idA, off: R.offFlag, on: R.onFlag }));

    ck.t('C1', '**开关 off（当前配置）⇒ 行为不变**：连刷 3 次 views = 1→2→3 逐次 +1（P57 口径原样）',
      JSON.stringify(R.off_views) === JSON.stringify([1, 2, 3]),
      `off_views=${JSON.stringify(R.off_views)}`);

    ck.t('C2', '**on · 同 viewer 第二次不涨**：首次 +1（4）→ 再刷仍 4（`ON CONFLICT … DO NOTHING` rowCount=0 ⇒ 只读不增）· 同 viewer 同天日志恰 **1** 行',
      R.v1 === 4 && R.v2 === 4 && Number(R.log_same_day ?? -1) === 1,
      `v1=${R.v1} v2=${R.v2} log_rows=${R.log_same_day}`);

    ck.t('C3', '**on · 不同 viewer 各 +1**：`uid:900102` ⇒ 5 · 匿名头 `anon:hdr-p58-1` ⇒ 6（uid:/anon: 两形态均判新访客）',
      R.v3 === 5 && R.v4 === 6, `v3=${R.v3} v4=${R.v4}`);

    ck.t('C4', '**on · 不同天不计（夹具日）**：昨日已有日志的访客今天再访 ⇒ 自增（7）· 该 viewer 日志恰 2 行（昨天 + 今天各一）',
      R.v5 === 7 && Number(R.log_yesterday_total ?? -1) === 2,
      `v5=${R.v5} viewer_rows=${R.log_yesterday_total}`);

    ck.t('C5', '**404 不计数不写日志**：ghost 读数 null · ghost 的日志 0 行 · 夹具 view_count 仍 7',
      R.recGhost === null && Number(R.log_ghost ?? -1) === 0 && R.vc_after_ghost === '7',
      JSON.stringify({ ghost: R.recGhost, log_ghost: R.log_ghost, vc_after_ghost: R.vc_after_ghost }));

    ck.t('C6', '**只读臂（已见访客路径）**：键形与自增臂完全同源（49 键）· views = 现值 · 连读两次零自增 · wants/condition 加性键照常',
      R.ro_shape_same === true && R.ro_keys === 52
      && R.ro_views?.[0] === 7 && R.ro_views?.[1] === 7
      && R.wants === 0 && R.condition === 'LikeNew',
      JSON.stringify({ keys: R.ro_keys, views: R.ro_views, wants: R.wants, condition: R.condition, shape_same: R.ro_shape_same }));

    // ---- N · 负控（各自独立回滚事务） ----
    // N1 · 判定中和臂：桩替 recordDetailViewLog 恒 true = 等价「去掉 ON CONFLICT 判定」⇒ on 模式连刷必涨
    //      （证明 C2 的「第二次不涨」非恒绿、判据真承载；桩逐字还原）
    const svc = DatabaseService as unknown as Record<string, unknown>;
    const origLog = svc.recordDetailViewLog;
    let neg1 = { v1: -1, v2: -1, v3: -1 };
    try {
      const n1 = await inRollbackTx(pool, async (c) => {
        for (const stmt of M57.headStmts) await c.query(stmt);
        for (const stmt of M58.headStmts) await c.query(stmt);
        for (const stmt of M60.headStmts) await c.query(stmt);
        for (const stmt of M61.headStmts) await c.query(stmt);   // 0061 一列（post-apply 幂等 no-op）
        const ex = c as unknown as SqlRunner;
        const sellerRow = await raw1(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0');
        const mk = await DatabaseService.createListingRow({
          sellerUid: Number(sellerRow?.uid ?? 0), cid: 1, price: 1, stock: 1,
          description: `p58-gate neg fixture 1 · RUN=${RUN}`, mediaUrls: [],
          createKey: `${FIXTURE_KEY_PREFIX}${RUN}-n1`, ...newIds(), allowMultiBuy: false,
        }, ex);
        const idN = Number(mk.row ? (mk.row as Record<string, unknown>).listing_id : 0);
        await c.query("UPDATE public.app_config SET value = '{\"dedup\":\"on\"}'::jsonb WHERE key = 'detail_view_dedup'");
        svc.recordDetailViewLog = async () => true; // 判定被中和 ⇒ 恒「新访客」
        const a = await DatabaseService.getPrizeDetailViewWithViewer(idN, 'uid:neg1', ex);
        const b = await DatabaseService.getPrizeDetailViewWithViewer(idN, 'uid:neg1', ex);
        const d = await DatabaseService.getPrizeDetailViewWithViewer(idN, 'uid:neg1', ex);
        return { v1: a?.views ?? -1, v2: b?.views ?? -1, v3: d?.views ?? -1 };
      });
      neg1 = { v1: n1.result?.v1 ?? -1, v2: n1.result?.v2 ?? -1, v3: n1.result?.v3 ?? -1 };
    } finally {
      svc.recordDetailViewLog = origLog;
    }
    const neg1Restored = svc.recordDetailViewLog === origLog;
    ck.t('N1', '**负控①（判定中和）**：桩替日志判定恒 true（= 去掉 ON CONFLICT 判定）⇒ on 模式同 viewer 连刷 **必涨** 1→2→3 —— 证明 C2 判据非恒绿、门必红',
      neg1Restored && neg1.v1 === 1 && neg1.v2 === 2 && neg1.v3 === 3,
      JSON.stringify({ ...neg1, restored: neg1Restored }));

    // N2 · 开关非法值 fail-safe：banana / 非串 / 缺字段 / 行缺席 ⇒ 一律按默认 on（去重）
    const n2 = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      for (const stmt of M58.headStmts) await c.query(stmt);
      for (const stmt of M60.headStmts) await c.query(stmt);   // 0060 未 apply 时补两列（ROLLBACK 零残留）
      for (const stmt of M61.headStmts) await c.query(stmt);   // 0061 一列（createListingRow 绑 allow_multi_buy 的前提；post-apply 幂等 no-op）
      const ex = c as unknown as SqlRunner;
      const read = () => DatabaseService.isDetailViewDedupEnabled(ex);
      await c.query("UPDATE public.app_config SET value = '{\"dedup\":\"banana\"}'::jsonb WHERE key = 'detail_view_dedup'");
      const r1 = await read();
      await c.query("UPDATE public.app_config SET value = '{\"dedup\":true}'::jsonb WHERE key = 'detail_view_dedup'");
      const r2 = await read();
      await c.query("UPDATE public.app_config SET value = '{\"other\":1}'::jsonb WHERE key = 'detail_view_dedup'");
      const r3 = await read();
      await c.query("DELETE FROM public.app_config WHERE key = 'detail_view_dedup'");
      const r4 = await read();
      return { r1, r2, r3, r4 };
    });
    ck.t('N2', '**负控②（非法值 fail-safe）**：值 `banana` / 非串（boolean）/ 缺 `dedup` 字段 / 行缺席 ⇒ 全部按默认 **on（去重）** 处理',
      n2.result?.r1 === true && n2.result?.r2 === true && n2.result?.r3 === true && n2.result?.r4 === true,
      JSON.stringify(n2.result));

    // N3 · 唯一约束真在场：裸 INSERT 重复（无 ON CONFLICT）⇒ 23505（判据非恒绿）
    const n3 = await inRollbackTx(pool, async (c) => {
      for (const stmt of M57.headStmts) await c.query(stmt);
      for (const stmt of M58.headStmts) await c.query(stmt);
      for (const stmt of M60.headStmts) await c.query(stmt);   // 0060 未 apply 时补两列（ROLLBACK 零残留）
      for (const stmt of M61.headStmts) await c.query(stmt);   // 0061 一列（createListingRow 绑 allow_multi_buy 的前提；post-apply 幂等 no-op）
      const sellerRow = await raw1(c, 'SELECT min(uid)::bigint AS uid FROM public.users WHERE uid > 0');
      const mk = await DatabaseService.createListingRow({
        sellerUid: Number(sellerRow?.uid ?? 0), cid: 1, price: 1, stock: 1,
        description: `p58-gate neg fixture 3 · RUN=${RUN}`, mediaUrls: [],
        createKey: `${FIXTURE_KEY_PREFIX}${RUN}-n3`, ...newIds(), allowMultiBuy: false,
      }, c as unknown as SqlRunner);
      const idN = Number(mk.row ? (mk.row as Record<string, unknown>).listing_id : 0);
      await c.query("INSERT INTO public.listing_view_log (listing_id, viewer_key) VALUES ($1, 'uid:neg3')", [idN]);
      try {
        await c.query("INSERT INTO public.listing_view_log (listing_id, viewer_key) VALUES ($1, 'uid:neg3')", [idN]);
        return { violated: false, sqlstate: null };
      } catch (e) {
        return { violated: true, sqlstate: String((e as { code?: string }).code ?? '') };
      }
    });
    ck.t('N3', '**负控③（约束真在场）**：同 (listing, viewer, day) 裸重复 INSERT ⇒ 23505 unique_violation（`listing_view_log_uniq` 真闸，判据非恒绿）',
      n3.result?.violated === true && n3.result?.sqlstate === '23505',
      JSON.stringify(n3.result));

    // ---- E · 零残留证（新连接 = committed 视角） ----
    const residue = await raw1Retry(pool, 'SELECT count(*)::int AS n FROM public.listing WHERE create_key LIKE $1', [`${FIXTURE_KEY_PREFIX}%`]);
    ck.t('E1', '**零残留**：回滚后 `create_key LIKE cli:p58-gate:%` 命中 = 0（含历史 run；> 0 = 有夹具泄漏，fail-loud）',
      Number(residue?.n ?? -1) === 0, `residue_rows=${residue?.n}`);

    const postRows = await raw1Retry(pool,
      "SELECT to_regclass('public.listing_view_log') IS NOT NULL AS tbl, EXISTS (SELECT 1 FROM public.app_config WHERE key = 'detail_view_dedup') AS cfg");
    const expectTbl = mode === 'post-apply';
    const expectCfg = mode === 'post-apply';
    ck.t('E2', `committed 态与迁移态自洽（${mode} ⇒ listing_view_log=${expectTbl ? '在场' : '缺席'} · 开关行=${expectCfg ? '在场' : '缺席'}；实测 table=${postRows?.tbl} row=${postRows?.cfg}）`,
      postRows?.tbl === expectTbl && postRows?.cfg === expectCfg,
      `table=${postRows?.tbl} row=${postRows?.cfg} mode=${mode}`);
  }

  // ====================================================================== 落盘
  out.migration = { head_stmts: M58.headStmts.length, head_bytes: M58.head.length, tail_bytes: M58.tail.length };
  out.unit = unit;
  out.checks = ck.checks;
  out.summary = ck.summary();
  const f = save('p58-view-dedup-gate', out);
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
