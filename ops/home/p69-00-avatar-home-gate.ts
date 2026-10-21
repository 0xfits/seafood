/**
 * p69-00 · 项目头像（0069）+ 首页热门任务读口 · 门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p63/p68 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/home/p69-00-avatar-home-gate.ts
 * 读数：`ops/home/readings/p69-avatar-home-gate-<RUN>.json`
 *
 * 派单两面（本门逐条守住）：
 *   ① 迁移 0069：`project.avatar_url text NULL` + 具名 CHECK
 *      `project_avatar_url_format_check`（NULL ∨ `^/api/media/[0-9]{1,12}$`）+ 尾部自检；
 *   ② 写口：PATCH /api/project/:ref 闭集新增 `avatar_url`（设值 / null 清空 / 非法 400
 *      `AVATAR_URL_INVALID`），路由准入（`manage_tasks`）一字不动；create 面**不收**此键；
 *   ③ 读口：`GET /api/home/campaign-tasks`（公开 · setPublicCache）每行加性 `project_avatar_url`，
 *      SQL 以 `(to_jsonb(pr) ->> 'avatar_url')` 取值 ⇒ 迁移未 apply 的窗口期不报 42703（退化不 500）。
 *
 * 判据面：
 *   A · 静态（零 DB）：0069 形状（无 BEGIN/COMMIT、注释零 dollar-dollar、具名 CHECK 守卫、尾 DO 四臂）·
 *       服务层常量与键集（PATCH 含 / CREATE 不含 avatar_url）· PATCH UPDATE 显式分支（不用 COALESCE）·
 *       路由面（注册点 129 / get 56 / post 66 / patch 4 / delete 3；读口公开 + 公共缓存 + 基建映射；
 *       PATCH project 仍 manage_tasks）· 读口 SQL 五面（to_jsonb 兼容 / 无裸列引用 / DISTINCT 人数 /
 *       三处过滤 / 120 裁剪 + 20 行）· 解析纯函数臂（合法 6 / 非法 7 / 边界 12↔13 位 / create 面拒收）。
 *   B · 迁移干跑（真库 · 回滚事务内）：头段 + 尾部 DO 全绿（列 text NULL / 约束体带正则 / 列注释 /
 *       版本行未写）· 幂等重跑同终态 · 数据面越线 0 行。
 *   S · 服务层真路径（同事务 · `ex` 注入）：PATCH 设值 200 + 回显 · 读口有数据（行在场、头像逐字、
 *       `joined_count` = 去重人数 2 / 凭证 3 行、`description` 裁到 120、首行 = 最新、≤20 行）·
 *       PATCH 清空 null ⇒ 读口 null · 非法 6 臂 400 且库内值不动 · create 面 avatar_url ⇒ 400 NOT_SUPPORTED ·
 *       读口空集 ⇒ []（200 语义）· 读口退化（列被摘）⇒ 不抛、头像 null。
 *   N · **负控**：① 非法直写 ⇒ 23514（约束承重，正控）；② DROP CHECK ⇒ 非法 url 可入 + 尾 DO RAISE
 *       （P0001）⇒ 「去约束」必红；③ ended 项目 ⇒ 该任务不上首页（`pr.status <> 'ended'` 承重）；
 *       ④ draft 任务 ⇒ 不上（`t.status <> 'draft'` 承重）；⑤ 非 active 活动 ⇒ 不上（`c.status = 'active'` 承重）。
 *   Z · 残留：全程单回滚事务；0069 版本行 = 未 apply 态 0 / 已 apply 态零新增；project / campaign / task
 *       行数与「非空头像行数」均不变；约束仍在。
 *
 * 纪律：**不 apply、不写版本表、不 push、不动 frontend**；DDL / DML / 夹具全在回滚事务内；
 *   反事实臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  PROJECT_AVATAR_URL_PATTERN,
  createProjectVerb,
  currentCreateFee,
  listHomeCampaignTasks,
  parseProjectPayload,
  patchProjectVerb,
} from '../../backend-ts/src/project-service';
import type { HomeCampaignTaskRow } from '../../backend-ts/src/project-service';
import { createCampaignVerb, createTaskVerb, patchCampaignVerb, patchTaskVerb } from '../../backend-ts/src/campaign-service';
import { postEvent } from '../../backend-ts/src/ledger';

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
const PROJ_SVC = readSrc('backend-ts/src/project-service.ts');
const MIG69 = readSrc('backend-ts/migrations/0069_project_avatar.sql');

// ---------------------------------------------------------------- SQL 切分（dollar-dollar 感知）
const stripSqlComments = (src: string): string => {
  const out: string[] = [];
  let inDollar = false;
  for (let i = 0; i < src.length; i += 1) {
    if (src.slice(i, i + 2) === '$$') { inDollar = !inDollar; out.push('$$'); i += 1; continue; }
    if (!inDollar && src.slice(i, i + 2) === '--') {
      while (i < src.length && src[i] !== '\n') i += 1;
      out.push('\n');
      continue;
    }
    out.push(src[i]);
  }
  return out.join('');
};
const splitSqlStatements = (src: string): string[] => {
  const clean = stripSqlComments(src);
  const out: string[] = [];
  let buf = '';
  let inDollar = false;
  for (let i = 0; i < clean.length; i += 1) {
    if (clean.slice(i, i + 2) === '$$') { inDollar = !inDollar; buf += '$$'; i += 1; continue; }
    const ch = clean[i];
    if (!inDollar && ch === ';') { if (buf.trim()) out.push(buf.trim()); buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
};
// 文件内共 2 个 DO 块（② 约束守卫 + 尾部自检）；「尾部 DO」= 最后一处（自检块），
// 头段 = 其余全部 ⇒ 干跑头段时约束守卫也跑到（幂等），负控臂打的是自检块本身。
const headOf = (src: string) => src.slice(0, src.lastIndexOf('\nDO $$')).trim();
const tailOf = (src: string) => src.slice(src.lastIndexOf('\nDO $$') + 1).trim();
const M69_HEAD = splitSqlStatements(headOf(MIG69));
const M69_TAIL = tailOf(MIG69);

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p69_${tag}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    const value = await fn();
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    return { value, sqlstate: null, message: '' };
  } catch (e) {
    try { await c.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* noop */ }
    return {
      value: null,
      sqlstate: String((e as { code?: string }).code ?? '') || null,
      message: String((e as { message?: string }).message ?? ''),
    };
  }
};

const tx = async <T>(p: ReturnType<typeof mkPool>, fn: (c: Qx) => Promise<T>) => {
  let last: Awaited<ReturnType<typeof inRollbackTx<T>>> | null = null;
  for (let i = 0; i < 3; i += 1) {
    const r = await inRollbackTx<T>(p, fn);
    last = r;
    const msg = String((r.error as { message?: string })?.message ?? '');
    if (!r.error || !/fetch failed|ECONNRESET|ECONNREFUSED|terminat/i.test(msg)) break;
  }
  return last!;
};

const verbOf = (r: unknown): number => {
  const x = r as { ok?: boolean; status?: number };
  return x?.ok ? 200 : Number(x?.status ?? 0);
};
const reasonOf = (r: unknown) => String(((r as { details?: { reason?: unknown } })?.details?.reason) ?? '');
const viewOf = <T,>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;

/** 路由块切片（静态接线断言用；按长度截断） */
const routeBlock = (startMarker: string, maxLen = 1600): string => {
  const i = INDEX_TS.indexOf(startMarker);
  if (i < 0) return '';
  return INDEX_TS.slice(i, i + maxLen);
};

/** 服务层块切片（键集 / SQL 字面量断言用） */
const svcSlice = (start: string, end: string): string => {
  const i = PROJ_SVC.indexOf(start);
  if (i < 0) return '';
  const j = PROJ_SVC.indexOf(end, i);
  return PROJ_SVC.slice(i, j < 0 ? i + 3000 : j);
};

const AVATAR_OK = '/api/media/900001';
const ILLEGAL_URLS = [
  'https://evil.example.com/a.png',
  'data:image/png;base64,iVBORw0KGgo=',
  '',
  '/api/media/abc',
  '/api/media/1234567890123',
  'javascript:alert(1)',
];

/** 夹具描述必须 >120 ⇒ 验读口裁剪 */
const LONG_DESCRIPTION = 'P69 门夹具长描述：' + '甲乙丙丁戊己庚辛壬癸'.repeat(14); // 140+ 字符

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const commentDollar = MIG69.split('\n').filter((l) => l.trim().startsWith('--') && l.includes('$$')).length;
  const fmtDefSrc = (MIG69.match(/CHECK \(avatar_url IS NULL OR avatar_url ~ '[^']+'\)/) ?? [''])[0];
  ck.t('A1',
    '0069 形状：`ADD COLUMN IF NOT EXISTS avatar_url text NULL` · 列注释 · 具名 CHECK `project_avatar_url_format_check`（body = `avatar_url IS NULL OR avatar_url ~ \'^/api/media/[0-9]{1,12}$\'`· pg_constraint 守卫）· 无 BEGIN/COMMIT · 注释零 dollar-dollar',
    !/^\s*(BEGIN|COMMIT)\s*;/m.test(MIG69)
      && commentDollar === 0
      && /ADD COLUMN IF NOT EXISTS avatar_url text NULL/.test(MIG69)
      && /COMMENT ON COLUMN public\.project\.avatar_url/.test(MIG69)
      && /ADD CONSTRAINT project_avatar_url_format_check/.test(MIG69)
      && /CHECK \(avatar_url IS NULL OR avatar_url ~ '\^\/api\/media\/\[0-9\]\{1,12\}\$'\)/.test(MIG69)
      && /conname = 'project_avatar_url_format_check'/.test(MIG69)
      && /conrelid = 'public\.project'::regclass/.test(MIG69),
    JSON.stringify({ commentDollar, fmt: fmtDefSrc }));

  ck.t('A2',
    '0069 尾部自检四臂在场：③ 列 nullable text · ④ 约束体带正则（防同名异体）· ⑤ 数据面越线 0 行 · ⑥ 真实行试写外链必被拒（23514）且「被接受 ⇒ 自检主动 RAISE」',
    /column_name = 'avatar_url' AND data_type = 'text' AND is_nullable = 'YES'/.test(MIG69)
      && /pg_get_constraintdef/.test(MIG69) && /position\('\/api\/media\/\[0-9\]\{1,12\}' IN v_def\)/.test(MIG69)
      && /avatar_url !~ '\^\/api\/media\/\[0-9\]\{1,12\}\$'/.test(MIG69)
      && /WHEN check_violation THEN/.test(MIG69)
      // ★ 42601 陷阱：PL/pgSQL 里不许 SAVEPOINT / ROLLBACK TO SAVEPOINT ⇒ 尾 DO 必须零 SAVEPOINT
      && !/\bSAVEPOINT\b/.test(MIG69.split('\n').map((l) => l.replace(/--.*$/, '')).join('\n'))
      && /illegal avatar_url was accepted — CHECK not enforced/.test(MIG69)
      && /v_rejected/.test(MIG69),
    'tail tokens ok');

  // ---- 服务层常量 / 键集 / UPDATE 分支
  const createKeysSrc = svcSlice('const CREATE_KEYS = [', '];');
  const patchKeysSrc = svcSlice('const PATCH_KEYS = [', '];');
  ck.t('A3',
    '服务层：`PROJECT_AVATAR_URL_PATTERN.source` = `^/api/media/[0-9]{1,12}$`（与 DB 约束同口径）· PATCH 键集含 `avatar_url` · CREATE 键集**不含**（create 面拒收）· `normalizeProjectRow` 加性 `avatar_url: strOrNull(...)`（存量 NULL ⇒ null，不造 "")',
    PROJECT_AVATAR_URL_PATTERN.source.replace(/\\\//g, '/') === '^/api/media/[0-9]{1,12}$'
      && /'avatar_url'/.test(patchKeysSrc)
      && !/avatar_url/.test(createKeysSrc)
      && /avatar_url: strOrNull\(row\.avatar_url\)/.test(PROJ_SVC),
    JSON.stringify({
      pattern: PROJECT_AVATAR_URL_PATTERN.source,
      create_has: /avatar_url/.test(createKeysSrc),
      patch_has: /'avatar_url'/.test(patchKeysSrc),
      patch_keys: (patchKeysSrc.match(/'[a-z_]+'/g) ?? []),
    }));

  ck.t('A4',
    'PATCH 写口显式分支（NULL 有语义 ⇒ 不用 COALESCE）：`const avatarNext = ...hasOwnProperty.call(body, \'avatar_url\')` · UPDATE 里 `avatar_url = $12::text` 直赋（未提供额外键时静态保留库内现值）· 解析侧 `mode === \'patch\' && has(\'avatar_url\')` · 非法 ⇒ 400 `AVATAR_URL_INVALID`（借码 + reason，零新错误码）',
    /const avatarNext = Object\.prototype\.hasOwnProperty\.call\(body, 'avatar_url'\)/.test(PROJ_SVC)
      && /avatar_url = \$12::text/.test(PROJ_SVC)
      && /if \(mode === 'patch' && has\('avatar_url'\)\)/.test(PROJ_SVC)
      && /badRequest\('AVATAR_URL_INVALID'/.test(PROJ_SVC),
    'explicit branch ok');

  // ---- 路由面
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const homeBlock = routeBlock("app.get('/api/home/campaign-tasks'", 300);
  const patchProjBlock = routeBlock("app.patch('/api/project/:projectId'", 900);
  ck.t('A5',
    '★路由面：注册点 **129**（get 56 / post 66 / patch 4 / delete 3）· 读口 `GET /api/home/campaign-tasks` 公开（块内零 `requireActor`）· `listHomeCampaignTasks()` → `setPublicCache(res)` → `sendSuccess` · 异常走 `sendInfraMapped(res, \'home.campaign_tasks\')`（绝不硬编码 500）',
    regs === 129 && countVerb('get') === 56 && countVerb('post') === 66 && countVerb('patch') === 4 && countVerb('delete') === 3
      && homeBlock.length > 0
      && !/requireActor/.test(homeBlock)
      && /listHomeCampaignTasks\(\)/.test(homeBlock)
      && /setPublicCache\(res\)/.test(homeBlock)
      && /sendSuccess\(res, rows/.test(homeBlock)
      && /sendInfraMapped\(res, 'home\.campaign_tasks'/.test(homeBlock),
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete') }));

  ck.t('A6',
    '★PATCH 路由准入一字不动：`app.patch(\'/api/project/:projectId\')` 仍 `requireAdmin(req, res, \'manage_tasks\')`（头像不是新的权限面）',
    /requireAdmin\(req, res, 'manage_tasks'\)/.test(patchProjBlock),
    JSON.stringify({ has_manage_tasks: /requireAdmin\(req, res, 'manage_tasks'\)/.test(patchProjBlock) }));

  // ---- 读口 SQL 五面
  const sqlBlock = svcSlice('const HOME_CAMPAIGN_TASKS_SQL', '`;');
  ck.t('A7',
    '★读口 SQL：`(to_jsonb(pr) ->> \'avatar_url\')` 取值（pre-apply 窗口不报 42703）且**无裸列引用** `pr.avatar_url` · `count(DISTINCT p.uid)` 去重人数 · 三处过滤（`c.status = \'active\'` / `t.status <> \'draft\'` / `pr.status <> \'ended\'`）· `ORDER BY t.time_created DESC, t.task_id DESC LIMIT 20`',
    /\(to_jsonb\(pr\) ->> 'avatar_url'\) AS project_avatar_url/.test(sqlBlock)
      && !/\bpr\.avatar_url\b/.test(sqlBlock)
      && /count\(DISTINCT p\.uid\)/.test(sqlBlock)
      && /WHERE c\.status = 'active'/.test(sqlBlock)
      && /AND t\.status <> 'draft'/.test(sqlBlock)
      && /AND pr\.status <> 'ended'/.test(sqlBlock)
      && /ORDER BY t\.time_created DESC, t\.task_id DESC/.test(sqlBlock)
      && /LIMIT 20/.test(sqlBlock),
    JSON.stringify({ to_jsonb: /to_jsonb\(pr\)/.test(sqlBlock), bare_col: /\bpr\.avatar_url\b/.test(sqlBlock), limit20: /LIMIT 20/.test(sqlBlock) }));

  ck.t('A8',
    '读出口径与形状：`HOME_TASK_DESCRIPTION_MAX = 120` 且在 normalize 里 `slice(0, HOME_TASK_DESCRIPTION_MAX)`（裁剪只在服务层，前端拿到的即展示值）· `joined_count` 走 `int()`（永不 null）· 出参 bigint 皆 `::text`（task_id/campaign_id/project_id/reward_*）· `listHomeCampaignTasks` 空行集 ⇒ `[]`',
    /const HOME_TASK_DESCRIPTION_MAX = 120/.test(PROJ_SVC)
      && /description: str\(row\.description\)\.slice\(0, HOME_TASK_DESCRIPTION_MAX\)/.test(PROJ_SVC)
      && /joined_count: int\(row\.joined_count\)/.test(PROJ_SVC)
      && /t\.task_id::text/.test(sqlBlock) && /c\.campaign_id::text/.test(sqlBlock) && /pr\.project_id::text/.test(sqlBlock)
      && /export const listHomeCampaignTasks = async \(ex\?: TxClient\): Promise<HomeCampaignTaskRow\[\]> => \{/.test(PROJ_SVC),
    'shape ok');

  // ---- 解析纯函数臂（借码 400 + reason）
  const okArms: Array<[string, string]> = [
    ['/api/media/1', '/api/media/1'],
    ['/api/media/900001', '/api/media/900001'],
    ['/api/media/123456789012', '/api/media/123456789012'], // 12 位上限
    ['/api/media/000123', '/api/media/000123'],             // 正则允许前导零（media_id 由读口存在性兜底）
  ];
  const okParsed = okArms.map(([input, expect]) => {
    const r = parseProjectPayload({ avatar_url: input }, 'patch');
    const p = 'payload' in r ? r.payload : null;
    return { input, got: p?.avatar_url ?? null, ok: p?.avatar_url === expect };
  });
  const badParsed = ILLEGAL_URLS.map((input) => {
    const r = parseProjectPayload({ avatar_url: input }, 'patch');
    const err = 'err' in r ? r.err : null;
    return {
      input,
      ok: !!err && err.status === 400 && reasonOf(err) === 'AVATAR_URL_INVALID'
        && (err as { code?: string }).code === 'LEDGER_AMOUNT_INVALID',
      status: err?.status ?? null,
      reason: reasonOf(err),
      code: (err as { code?: string } | null)?.code ?? null,
    };
  });
  const nullArm = parseProjectPayload({ avatar_url: null }, 'patch');
  const nullOk = 'payload' in nullArm && nullArm.payload.avatar_url === null
    && Object.prototype.hasOwnProperty.call(nullArm.payload, 'avatar_url');
  const absentArm = parseProjectPayload({}, 'patch');
  const absentOk = 'payload' in absentArm && !Object.prototype.hasOwnProperty.call(absentArm.payload, 'avatar_url');
  const createArm = parseProjectPayload({ avatar_url: AVATAR_OK }, 'create');
  const createErr = 'err' in createArm ? createArm.err : null;
  ck.t('A9',
    '★头像解析（借码 400 + details.reason，零新错误码）：合法 4 臂（含 12 位上限与前导零）逐字回显 · 非法 6 臂（外链 / data: / 空串 / 非数字 / 13 位 / javascript:）⇒ 400 `LEDGER_AMOUNT_INVALID` + reason=`AVATAR_URL_INVALID` · `null` ⇒ 键在场值 null（清空）· 未提供 ⇒ 键**缺席**（保留库内现值）· create 面 ⇒ 400 `NOT_SUPPORTED`（field=avatar_url）',
    okParsed.every((x) => x.ok) && badParsed.every((x) => x.ok) && nullOk && absentOk
      && !!createErr && createErr.status === 400 && reasonOf(createErr) === 'NOT_SUPPORTED',
    JSON.stringify({
      ok: okParsed, bad: badParsed, null_arm: nullOk, absent_arm: absentOk,
      create: [createErr?.status ?? null, reasonOf(createErr)],
    }));

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  const applied69 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0069'"))[0]?.n ?? 0) > 0;
  const MODE = applied69 ? 'post-apply' : 'pre-apply';
  out.mode = MODE;
  const committedBefore = {
    projects: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1),
    campaigns: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1),
    tasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.task'))[0]?.n ?? -1),
    // 已 apply 态才有这列；未 apply 态直接给 -1（Z 臂按 mode 取口径）
    avatar_nonnull: applied69
      ? Number((await qRetry<{ n: number }>(pool,
        'SELECT count(*)::int AS n FROM public.project WHERE avatar_url IS NOT NULL'))[0]?.n ?? -1)
      : -1,
    constraint: applied69
      ? Number((await qRetry<{ n: number }>(pool,
        "SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'project_avatar_url_format_check'"))[0]?.n ?? -1)
      : -1,
  };
  out.committed_before = committedBefore;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = { mode: MODE };
    const ex = c as unknown as TxClient;
    const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => raw1<T>(c, sql, params);

    // ---- 夹具：三用户（owner / 两个参与者）
    const uids: number[] = [];
    for (const base of [909901, 909902, 909903]) {
      const row = await q1<{ uid: string }>(
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p69-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [OWNER, FAN1, FAN2] = uids;
    R.fixture_users = uids;
    const fee = BigInt(await currentCreateFee());
    await postEvent({
      op: 'mint', uid: String(OWNER), cid: '1', amount: (fee * 2n + 5000n).toString(), platform: true,
      idempotencyKey: `ops:p69-gate:${RUN}:mint`, memo: 'p69-gate usd fixture', ex,
    });

    const createdProj = await createProjectVerb({
      actorUid: OWNER,
      body: {
        title: `p69 gate project ${RUN}`, slug: `p69a${Math.random().toString(36).slice(2, 8)}`,
        description: 'p69 gate', headcount: 2, recruit_min_account_days: 0,
        wage_batt_per_claim: '10', wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p69-${RUN}-proj`,
      ex,
    });
    const P_A = String(viewOf<{ project_id?: string }>(createdProj).project_id ?? '');
    const createdCamp = await createCampaignVerb({ body: { title: `p69 campaign ${RUN}`, project_id: P_A }, ex });
    const C_A = String(viewOf<{ campaign_id?: string }>(createdCamp).campaign_id ?? '');
    const createdTask = await createTaskVerb({
      campaignRef: C_A,
      body: {
        title: `p69 task ${RUN}`, description: LONG_DESCRIPTION, reward_amount_primary: '10',
        subtasks: [
          { type_code: 'quiz', title: '答题一', payload: { answers: { q1: 'yes' } } },
          { type_code: 'survey', title: '问卷二', payload: { answers: { q2: 'no' } } },
        ],
      },
      ex,
    });
    const T_A = String(viewOf<{ task_id?: string }>(createdTask).task_id ?? '');
    await patchCampaignVerb({ ref: C_A, body: { status: 'active' }, ex });
    await patchTaskVerb({ ref: T_A, body: { status: 'active' }, ex });
    const fixture = { project_id: P_A, campaign_id: C_A, task_id: T_A, proofs: -1 };

    // 凭证：subtask1 ← FAN1 + FAN2，subtask2 ← FAN1 ⇒ **3 行凭证 / 2 个去重人**（DISTINCT 承重）
    const subs = await raw<{ subtask_id: string }>(c,
      `SELECT subtask_id::text AS subtask_id FROM public.subtask WHERE task_id = $1::bigint ORDER BY subtask_id`, [T_A]);
    for (const [i, s] of subs.entries()) {
      const provers = i === 0 ? [FAN1, FAN2] : [FAN1];
      for (const uid of provers) {
        await c.query(
          `INSERT INTO public.subtask_proof (subtask_id, uid, payload, status)
           VALUES ($1::bigint, $2::bigint, '{}'::jsonb, 'submitted')
           ON CONFLICT (subtask_id, uid) DO NOTHING`, [s.subtask_id, String(uid)]);
      }
    }
    const proofCount = Number((await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.subtask_proof p
         JOIN public.subtask s ON s.subtask_id = p.subtask_id WHERE s.task_id = $1::bigint`, [T_A]))?.n ?? -1);
    fixture.proofs = proofCount;
    R.fixture = fixture;

    // ==================================================================== B · 迁移 0069 干跑
    const before69 = Number((await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0069'"))?.n ?? -1);
    for (const stmt of M69_HEAD) await c.query(stmt);
    await c.query(M69_TAIL);

    const col = await q1<{ is_nullable: string; data_type: string; col_default: string | null }>(
      `SELECT is_nullable, data_type, column_default AS col_default FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project' AND column_name = 'avatar_url'`);
    const conDef = await q1<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname = 'project_avatar_url_format_check'
          AND conrelid = 'public.project'::regclass AND contype = 'c'`);
    const conCount = Number((await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname = 'project_avatar_url_format_check' AND conrelid = 'public.project'::regclass`))?.n ?? -1);
    const colComment = String((await q1<{ c: string | null }>(
      `SELECT col_description('public.project'::regclass,
              (SELECT attnum FROM pg_attribute WHERE attrelid = 'public.project'::regclass AND attname = 'avatar_url')) AS c`))?.c ?? '');
    const after69 = Number((await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0069'"))?.n ?? -1);
    ck.t('B1',
      `[${MODE}] 0069 干跑全绿：\`avatar_url\` = nullable text（无默认）· 具名 CHECK 在场且约束体带 \`[0-9]{1,12}\` · 列注释在场 · 尾部自检未 RAISE · 版本行未写（${before69}→${after69}）`,
      col?.is_nullable === 'YES' && col?.data_type === 'text' && (col?.col_default ?? null) === null
        && Number(conCount) === 1
        && /\[0-9\]\{1,12\}/.test(String(conDef?.def ?? ''))
        && /\/api\/media/.test(String(conDef?.def ?? ''))
        && colComment.includes('/api/media/')
        && after69 === before69,
      JSON.stringify({ version: [before69, after69], col, con: conDef?.def, con_count: conCount, comment: colComment.slice(0, 80) }));

    // 幂等重跑：头段 + 尾部 DO 再来一遍 ⇒ 同一终态（ADD COLUMN IF NOT EXISTS / 约束守卫）
    for (const stmt of M69_HEAD) await c.query(stmt);
    await c.query(M69_TAIL);
    const conCount2 = Number((await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname = 'project_avatar_url_format_check' AND conrelid = 'public.project'::regclass`))?.n ?? -1);
    const colCount2 = Number((await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'project' AND column_name = 'avatar_url'`))?.n ?? -1);
    const viol = await q1<{ bad: number; nonnull: number; total: number }>(
      `SELECT count(*) FILTER (WHERE avatar_url IS NOT NULL AND avatar_url !~ '^/api/media/[0-9]{1,12}$')::int AS bad,
              count(*) FILTER (WHERE avatar_url IS NOT NULL)::int AS nonnull,
              count(*)::int AS total
         FROM public.project`);
    ck.t('B2',
      '0069 幂等：重跑头段 + 尾部 DO ⇒ 无异常、列仍恰 1、约束仍恰 1（不重复挂 / 不报 42710）· 数据面越线 0 行（存量全 NULL ⇒ 无回填压力）',
      conCount2 === 1 && colCount2 === 1 && Number(viol?.bad ?? -1) === 0,
      JSON.stringify({ con: conCount2, col: colCount2, viol }));

    // ==================================================================== S · 服务层真路径
    // S1 · PATCH 设值
    const setRes = await patchProjectVerb({ ref: P_A, body: { avatar_url: AVATAR_OK }, ex });
    const setView = viewOf<{ avatar_url?: string | null }>(setRes);
    ck.t('S1', `★PATCH 设头像：200 · view.avatar_url 逐字回显 \`${AVATAR_OK}\` · 库内列真写入`,
      verbOf(setRes) === 200 && setView.avatar_url === AVATAR_OK
        && String((await q1<{ v: string | null }>('SELECT avatar_url AS v FROM public.project WHERE project_id = $1::bigint', [P_A]))?.v ?? '') === AVATAR_OK,
      JSON.stringify({ status: verbOf(setRes), view: setView.avatar_url }));

    // S2 · 读口有数据（含 DISTINCT / 裁剪 / 排序 / 上限）
    const rowsFull = await listHomeCampaignTasks(ex);
    const hit = rowsFull.find((x) => x.task_id === T_A);
    const keysOfHit = hit ? Object.keys(hit).sort() : [];
    const expectKeys = [
      'campaign_id', 'campaign_title', 'description', 'joined_count', 'project_avatar_url', 'project_id',
      'project_slug', 'project_title', 'reward_amount_primary', 'reward_amount_secondary', 'reward_cid_secondary',
      'status', 'task_id', 'time_end', 'time_start', 'title',
    ].sort();
    ck.t('S2',
      `★读口有数据臂：行在场 · \`project_avatar_url\` = ${AVATAR_OK} · \`joined_count\` = 2（**3 行凭证 / 2 个去重人** ⇒ DISTINCT 承重，非行数）· \`description\` 裁到 120（原 ${LONG_DESCRIPTION.length} 字）· 16 键齐（加性，无缺无多）· 首行 = 最新任务（time_created DESC）· 行数 ≤ 20`,
      hit !== undefined
        && hit.project_avatar_url === AVATAR_OK
        && hit.joined_count === 2
        && hit.description.length === 120
        && LONG_DESCRIPTION.startsWith(hit.description)
        && JSON.stringify(keysOfHit) === JSON.stringify(expectKeys)
        && typeof hit.task_id === 'string' && typeof hit.campaign_id === 'string' && typeof hit.project_id === 'string'
        && typeof hit.reward_amount_primary === 'string' && hit.project_slug.length > 0
        && Number.isFinite(hit.joined_count)
        && rowsFull.length <= 20
        && rowsFull[0]?.task_id === T_A,
      JSON.stringify({
        rows: rowsFull.length, first: rowsFull[0]?.task_id, hit: hit ?? null,
        desc_len: hit?.description.length ?? null, proofs: proofCount,
        keys_ok: JSON.stringify(keysOfHit) === JSON.stringify(expectKeys),
      }));

    // S3 · PATCH 清空（null）⇒ 读口 null（前端首字渐变兜底）
    const clearRes = await patchProjectVerb({ ref: P_A, body: { avatar_url: null }, ex });
    const rowsCleared = await listHomeCampaignTasks(ex);
    const hitCleared = rowsCleared.find((x) => x.task_id === T_A);
    ck.t('S3',
      '★PATCH 清空：body `{avatar_url: null}` ⇒ 200 · view.avatar_url = null · 读口同行 `project_avatar_url` = null（NULL = 未设头像，前端按项目名首字兜底；不造空串）',
      verbOf(clearRes) === 200 && viewOf<{ avatar_url?: string | null }>(clearRes).avatar_url === null
        && hitCleared !== undefined && hitCleared.project_avatar_url === null,
      JSON.stringify({ status: verbOf(clearRes), view: viewOf<{ avatar_url?: string | null }>(clearRes).avatar_url, read: hitCleared?.project_avatar_url ?? 'missing' }));

    // 复位为设值态（后续非法臂断言「值不动」用）
    await patchProjectVerb({ ref: P_A, body: { avatar_url: AVATAR_OK }, ex });

    // S4 · 非法 6 臂：400 且库内值不动（零残留写）
    const illegalArms: Array<Record<string, unknown>> = [];
    for (const bad of ILLEGAL_URLS) {
      const res = await patchProjectVerb({ ref: P_A, body: { avatar_url: bad }, ex });
      const dbAfter = String((await q1<{ v: string | null }>('SELECT avatar_url AS v FROM public.project WHERE project_id = $1::bigint', [P_A]))?.v ?? '');
      illegalArms.push({
        input: bad.slice(0, 40), status: verbOf(res), reason: reasonOf(res),
        code: (res as { code?: string }).code ?? null, db_after: dbAfter,
      });
    }
    ck.t('S4',
      `★PATCH 非法 6 臂（外链 / data: / 空串 / 非数字 / 13 位 / javascript:）⇒ 全部 400 \`AVATAR_URL_INVALID\` · 库内值不动（仍 ${AVATAR_OK}）⇒ 服务层先拒，零脏写`,
      illegalArms.every((x) => x.status === 400 && x.reason === 'AVATAR_URL_INVALID'
        && x.code === 'LEDGER_AMOUNT_INVALID' && x.db_after === AVATAR_OK),
      JSON.stringify(illegalArms));

    // S5 · create 面拒收 avatar_url
    const createBad = await createProjectVerb({
      actorUid: OWNER,
      body: {
        title: `p69 create bad ${RUN}`, slug: `p69b${Math.random().toString(36).slice(2, 8)}`,
        description: '', headcount: 1, recruit_min_account_days: 0, wage_batt_per_claim: '1',
        wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1, avatar_url: AVATAR_OK,
      },
      headerKey: `cli:p69-${RUN}-createbad`,
      ex,
    });
    ck.t('S5',
      '★create 面不收 `avatar_url`（闭集 = 建项九键）：带此键 ⇒ 400 `NOT_SUPPORTED`（details.field = avatar_url · 未知键清单在场）· 零建项、零扣费（早于任何写）',
      verbOf(createBad) === 400 && reasonOf(createBad) === 'NOT_SUPPORTED'
        && String(((createBad as { details?: { field?: unknown } }).details?.field) ?? '') === 'avatar_url',
      JSON.stringify({ status: verbOf(createBad), reason: reasonOf(createBad), details: (createBad as { details?: unknown }).details }));

    // S6 · 读口空集臂：活动全置 draft ⇒ []（200，不是 404/500）
    const emptyArm = await undoAfter(c, 'empty', async () => {
      await c.query(`UPDATE public.campaign SET status = 'draft' WHERE status <> 'draft'`);
      const rows = await listHomeCampaignTasks(ex);
      return { len: rows.length, isArray: Array.isArray(rows) };
    });
    const emptyVal = emptyArm.value as { len: number; isArray: boolean } | null;
    ck.t('S6',
      '★读口空集臂：无 active 活动 ⇒ `listHomeCampaignTasks` 返回空数组（`[]` ⇒ 路由 200 + `sendSuccess([])`，前端按「无真数据 ⇒ mock 补足」降级；绝不 404/500）',
      emptyArm.sqlstate === null && emptyVal !== null && emptyVal.isArray && emptyVal.len === 0,
      JSON.stringify({ arm: emptyVal, sqlstate: emptyArm.sqlstate, msg: emptyArm.message.slice(0, 80) }));

    // S7 · 读口退化臂（pre-apply 等价）：列被摘 ⇒ to_jsonb 键缺席 ⇒ 不抛 42703、头像 null、行仍在
    const degenerate = await undoAfter(c, 'degen', async () => {
      await c.query('ALTER TABLE public.project DROP COLUMN avatar_url');
      const rows = await listHomeCampaignTasks(ex);
      const h = rows.find((x) => x.task_id === T_A);
      return { len: rows.length, hasHit: h !== undefined, avatar: h === undefined ? 'NO_HIT' : h.project_avatar_url };
    });
    const degenVal = degenerate.value as { len: number; hasHit: boolean; avatar: string | null } | null;
    ck.t('S7',
      '★读口退化臂（= 代码先于 DDL 上线的窗口期）：`DROP COLUMN avatar_url` 后同一 SQL ⇒ **不抛 42703** · 行集照常在场 · `project_avatar_url` = null（`to_jsonb` 键缺席归 NULL）⇒ 读口恒 200，退化不 500',
      degenerate.sqlstate === null && degenVal !== null && degenVal.hasHit && degenVal.len > 0 && degenVal.avatar === null,
      JSON.stringify({ arm: degenVal, sqlstate: degenerate.sqlstate, msg: degenerate.message.slice(0, 120) }));

    // ==================================================================== N · 负控
    // N1 · DB 约束承重（正控）：直写外链 ⇒ 23514；直写合法 ⇒ 通过
    const dbIllegal = await undoAfter(c, 'db_illegal', async () => {
      await c.query(`UPDATE public.project SET avatar_url = 'https://evil.example.com/a.png' WHERE project_id = $1::bigint`, [P_A]);
      return 'accepted';
    });
    const dbLegal = await undoAfter(c, 'db_legal', async () => {
      await c.query(`UPDATE public.project SET avatar_url = '/api/media/123456789012' WHERE project_id = $1::bigint`, [P_A]);
      return 'accepted';
    });
    ck.t('N1',
      '★负控（正控面）约束承重：绕过服务层直写外链 ⇒ **23514**（`project_avatar_url_format_check` 当场拒）· 直写 12 位合法值 ⇒ 通过 ⇒ 约束不是摆设',
      dbIllegal.sqlstate === '23514' && dbLegal.sqlstate === null,
      JSON.stringify({ illegal: [dbIllegal.sqlstate, dbIllegal.message.slice(0, 90)], legal: dbLegal.sqlstate }));

    // N2 · 去约束 ⇒ 非法 url 可入 + 尾 DO RAISE（缺约束必红）
    const ncDrop = await undoAfter(c, 'drop_check', async () => {
      await c.query('ALTER TABLE public.project DROP CONSTRAINT project_avatar_url_format_check');
      const before = Number((await q1<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.project WHERE avatar_url = 'https://evil.example.com/a.png'`))?.n ?? -1);
      await c.query(`UPDATE public.project SET avatar_url = 'https://evil.example.com/a.png' WHERE project_id = $1::bigint`, [P_A]);
      const after = Number((await q1<{ n: number }>(
        `SELECT count(*)::int AS n FROM public.project WHERE avatar_url = 'https://evil.example.com/a.png'`))?.n ?? -1);
      let tailSql: string | null = null;
      let tailMsg = '';
      try {
        await c.query(M69_TAIL);
      } catch (e) {
        tailSql = String((e as { code?: string }).code ?? '');
        tailMsg = String((e as { message?: string }).message ?? '');
      }
      return { before, after, tailSql, tailMsg };
    });
    const dropVal = ncDrop.value as { before: number; after: number; tailSql: string | null; tailMsg: string } | null;
    ck.t('N2',
      '★负控① 去 CHECK ⇒ 非法 url 可入 + 尾 DO RAISE：DROP `project_avatar_url_format_check` 后外链直写**成功**（越线行 0→1，CHECK 才是承重件）· 同态再跑 0069 尾 DO ⇒ **P0001**（自检 FAILED，缺约束被抓住）⇒ 「删约束 / 删约束守卫」必红',
      ncDrop.sqlstate === null && dropVal !== null && dropVal.after === dropVal.before + 1
        && dropVal.tailSql === 'P0001' && /self-check FAILED/.test(dropVal.tailMsg),
      JSON.stringify({ ...(dropVal ?? {}), sqlstate: ncDrop.sqlstate }));

    // N3 · ended 项目 ⇒ 该任务不上首页（pr.status <> 'ended' 承重）
    const endedArm = await undoAfter(c, 'ended_proj', async () => {
      await c.query(`UPDATE public.project SET status = 'ended' WHERE project_id = $1::bigint`, [P_A]);
      const rows = await listHomeCampaignTasks(ex);
      return { len: rows.length, hit: rows.some((x) => x.task_id === T_A) };
    });
    const endedVal = endedArm.value as { len: number; hit: boolean } | null;
    ck.t('N3',
      '★负控② 关停项目不上首页：项目置 `ended`（活动/任务仍 active）⇒ 该任务从读口消失（`pr.status <> \'ended\'` 承重；只删这一支 ⇒ 本臂必红）',
      endedArm.sqlstate === null && endedVal !== null && endedVal.hit === false,
      JSON.stringify({ arm: endedVal, sqlstate: endedArm.sqlstate }));

    // N4 · draft 任务 ⇒ 不上（t.status <> 'draft' 承重）
    const draftArm = await undoAfter(c, 'draft_task', async () => {
      await c.query(`UPDATE public.task SET status = 'draft' WHERE task_id = $1::bigint`, [T_A]);
      const rows = await listHomeCampaignTasks(ex);
      return { len: rows.length, hit: rows.some((x) => x.task_id === T_A) };
    });
    const draftVal = draftArm.value as { len: number; hit: boolean } | null;
    ck.t('N4',
      '★负控③ draft 任务不上首页：任务置 `draft`（活动仍 active）⇒ 消失（`t.status <> \'draft\'` 承重；删这一支 ⇒ 本臂必红）',
      draftArm.sqlstate === null && draftVal !== null && draftVal.hit === false,
      JSON.stringify({ arm: draftVal, sqlstate: draftArm.sqlstate }));

    // N5 · 非 active 活动 ⇒ 不上（c.status = 'active' 承重）
    const campArm = await undoAfter(c, 'draft_campaign', async () => {
      await c.query(`UPDATE public.campaign SET status = 'draft' WHERE campaign_id = $1::bigint`, [C_A]);
      const rows = await listHomeCampaignTasks(ex);
      return { len: rows.length, hit: rows.some((x) => x.task_id === T_A) };
    });
    const campVal = campArm.value as { len: number; hit: boolean } | null;
    ck.t('N5',
      '★负控④ 非 active 活动不上首页：活动回落 `draft`（任务仍 active）⇒ 消失（`c.status = \'active\'` 承重；删这一支 ⇒ 本臂必红）',
      campArm.sqlstate === null && campVal !== null && campVal.hit === false,
      JSON.stringify({ arm: campVal, sqlstate: campArm.sqlstate }));

    R.committed_touch = 'none (single rollback tx)';
    return R;
  });

  if (r.error) {
    out.tx_error = String((r.error as { message?: string })?.message ?? r.error);
    ck.t('X', '事务内全链执行未抛未预期异常', false, `error=${out.tx_error}`);
  } else {
    out.readings = r.result;
  }

  // ======================================================================== Z · 残留（rollback 之后）
  if (!r.error) {
    const versionRows = Number((await qRetry<{ n: number }>(pool,
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0069'"))[0]?.n ?? -1);
    const projectsNow = Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1);
    const campaignsNow = Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1);
    const tasksNow = Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.task'))[0]?.n ?? -1);
    const expectVersion = applied69 ? 1 : 0;
    const avatarNow = applied69
      ? Number((await qRetry<{ n: number }>(pool,
        'SELECT count(*)::int AS n FROM public.project WHERE avatar_url IS NOT NULL'))[0]?.n ?? -2)
      : -1;
    const conNow = applied69
      ? Number((await qRetry<{ n: number }>(pool,
        "SELECT count(*)::int AS n FROM pg_constraint WHERE conname = 'project_avatar_url_format_check'"))[0]?.n ?? -2)
      : -1;
    ck.t('Z1',
      `[${MODE}] 零 apply / 零残留：\`schema_migration\` 0069 行 = ${expectVersion}（${applied69 ? '既已 apply，本门零新增' : '未 apply 态，本门不写版本行'}）· project ${committedBefore.projects} / campaign ${committedBefore.campaigns} / task ${committedBefore.tasks} 行数不变`,
      versionRows === expectVersion && projectsNow === committedBefore.projects
        && campaignsNow === committedBefore.campaigns && tasksNow === committedBefore.tasks,
      JSON.stringify({
        mode: MODE, version_0069: versionRows,
        projects: [committedBefore.projects, projectsNow],
        campaigns: [committedBefore.campaigns, campaignsNow],
        tasks: [committedBefore.tasks, tasksNow],
      }));

    ck.t('Z2',
      `[${MODE}] ${applied69 ? '已 apply 态：非空头像行数不变（' + committedBefore.avatar_nonnull + '）· CHECK 仍在（' + committedBefore.constraint + '）—— 本门零写入' : '未 apply 态：本门未加列、未挂约束（committed 面无 avatar_url 列）'}`,
      applied69 ? (avatarNow === committedBefore.avatar_nonnull && conNow === committedBefore.constraint) : true,
      JSON.stringify({ avatar_nonnull: [committedBefore.avatar_nonnull, avatarNow], constraint: [committedBefore.constraint, conNow] }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p69-avatar-home-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
