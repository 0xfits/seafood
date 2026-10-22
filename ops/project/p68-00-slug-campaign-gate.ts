/**
 * p68-00 · 项目 slug + campaign 挂项目 + 权限扩容门 · 迁移 0068
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p63/p67 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/project/p68-00-slug-campaign-gate.ts
 * 读数：`ops/project/readings/p68-slug-campaign-gate-<RUN>.json`
 *
 * 派单四件（本门逐条守住）：
 *   ① 迁移 0068：project.slug NOT NULL UNIQUE（格式 CHECK）+ 10 种子逐字回填 + campaign.project_id
 *      NOT NULL FK（级联删）；
 *   ② GET /api/project/:ref 三形态（snowflake / 数字 id / slug）· 零新路由（`:ref` 吞 slug）；
 *   ③ create/patch 接受 slug（保留字 / 格式 / 唯一冲突 ⇒ 400 借码 + details.reason）；
 *   ④ 权限扩容：campaign/task/subtask 创建口 = manage_tasks 管理员 ∨ project_owner（owner ∧ ≠ ended）。
 *
 * 判据面：
 *   A · 静态（零 DB）：0068 形状（无 BEGIN/COMMIT、注释零 dollar-dollar、DB 只查格式不含保留字）·
 *       10 种子映射逐字 · 服务层常量（正则 / 保留字表 = App.jsx 现取一级静态段 ∪ 语义保留段，与前端同表）·
 *       保留字逐段 400（A10）· slug 解析纯函数臂 · 零新路由（注册点仍 128）·
 *       路由面三形态/权限支静态接线（R2 → isProjectReadRef + getProjectDetailByRef；
 *       POST campaign/task、PATCH task → authorizeProjectScopedCreate；PATCH campaign/settle/reward 仍 manage_tasks）。
 *   B · 迁移干跑（真库 · 回滚事务内）：头段 + 尾部 DO 全绿（列 / 约束 / FK 级联 / 索引 / 10 种子逐字 /
 *       格式与保留字 0 行 / 唯一）· 幂等重跑 · **自检负控**（保留字入数据 / 违格式 / 去唯一约束 ⇒ 尾 DO 必 RAISE）。
 *   S · 服务层真路径（同事务 · `ex` 注入）：建项带 slug · 三形态读同一行 · 非法/保留/纯数字 slug 400 ·
 *       重名 400 且零残留 · PATCH 改 slug · campaign 挂项目（缺 project_id 400 / 未知项目 404）·
 *       项目页嵌套 campaigns[]（public 仅 active；owner 见 draft；别项目活动不串）· 权限四臂。
 *   N · **负控**：① 去 slug 唯一 ⇒ 重名可入（直插成功）+ 尾 DO 必 RAISE（缺约束可红）；
 *       ② 去 owner 支 ⇒ owner 走同一 deny 路径 ⇒ 被拒（owner 臂与 deny 臂互斥，删支必红）；
 *       ③ ended 项目 owner ⇒ 拒（≠ended 半支承重）。
 *   Z · 残留：全程单回滚事务；提交面无 0068 版本行（未 apply 态）/ 已 apply 态则零新增。
 *
 * 纪律：**不 apply、不写版本表**；DDL / DML / 夹具全在回滚事务内；反事实臂再包 SAVEPOINT ⇒ 零残留。
 *   凭据只读 `backend-ts/.env.local`（dev 库）。服务层调用一律注入 `ex`（迁移干跑未提交 ⇒ 别连接不可见）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  PROJECT_SLUG_PATTERN,
  PROJECT_SLUG_RESERVED,
  createProjectVerb,
  currentCreateFee,
  getProjectByRef,
  getProjectDetailByRef,
  getProjectOwnerContext,
  isProjectReadRef,
  isProjectRef,
  isProjectSlug,
  listProjects,
  parseProjectSlugInput,
  patchProjectVerb,
} from '../../backend-ts/src/project-service';
import {
  authorizeProjectScopedCreate,
  createCampaignVerb,
  createTaskVerb,
  getCampaignAuthzContext,
  getTaskAuthzContext,
  listActiveCampaigns,
  patchCampaignVerb,
  patchTaskVerb,
} from '../../backend-ts/src/campaign-service';
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
const CAMP_SVC = readSrc('backend-ts/src/campaign-service.ts');
const MIG68 = readSrc('backend-ts/migrations/0068_project_slug_campaign_link.sql');

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
// 文件内共 3 个 DO 块（两处幂等守卫 + 尾部自检）；「尾部 DO」= **最后一处** DO（自检块），
// 头段 = 其余全部 DDL/DML ⇒ 干跑头段时约束守卫也跑到（幂等），负控臂打的是自检块本身。
const headOf = (src: string) => src.slice(0, src.lastIndexOf('\nDO $$')).trim();
const tailOf = (src: string) => src.slice(src.lastIndexOf('\nDO $$') + 1).trim();
const M68_HEAD = splitSqlStatements(headOf(MIG68));
const M68_TAIL = tailOf(MIG68);

const SEED_PAIRS: Array<[string, string]> = [
  ['Ethereum 生态推广', 'ethereum'],
  ['Solana 生态推广', 'solana'],
  ['Arbitrum 生态推广', 'arbitrum'],
  ['Base 生态推广', 'base'],
  ['Optimism 生态推广', 'optimism'],
  ['Polygon 生态推广', 'polygon'],
  ['Sui 生态推广', 'sui'],
  ['Aptos 生态推广', 'aptos'],
  ['Starknet 生态推广', 'starknet'],
  ['zkSync 生态推广', 'zksync'],
];
// ---- 保留字表三方对拍真源：App.jsx **现取**（一级静态段，含 `/dashboard/*` 子段）∪ 语义保留段
// 口径：`path="task/new"` ⇒ 一级段 `task`；`/dashboard/*` ⇒ `dashboard`；`/${lang}/*`（动态语言壳）与
// `:slug` 是动态段 ⇒ 不参与；`*` catch-all 不参与。App.jsx 新增一级路由而两表未跟进 ⇒ A5 必红。
const APP_JSX = readSrc('frontend/src/App.jsx');
const APP_ROUTE_PATHS = [...APP_JSX.matchAll(/path=(?:"([^"]*)"|\{`([^`]*)`\})/g)]
  .map((m) => (m[1] ?? m[2] ?? '').trim());
const APP_FIRST_SEGMENTS = [...new Set(APP_ROUTE_PATHS
  .map((p) => p.replace(/^\//, ''))
  .filter((p) => p !== '' && p !== '*' && !p.includes('${'))
  .map((p) => p.split('/')[0])
  .filter((s) => s !== '' && !s.startsWith(':')))].sort();
/** 语义保留段（未注册路由但语义占用：复数/别名/历史与预留面；纯新增路由**不必**加这里）
 *  ★ 2026-10-22（下架单 1a6994b 后补）：`rewards` / `listing-review` 原 App.jsx 现取段
 *    （/dashboard/rewards、/dashboard/listing-review）已随页面下架移除路由，但后端
 *    `PROJECT_SLUG_RESERVED` 不动（下架单口径：后端零改动）⇒ 两段降级为语义保留段挂这里，
 *    保住「App.jsx 现取 ∪ 语义保留 = 前后端两表（37 段）」三方对拍不红。 */
const SEMANTIC_RESERVED = [
  'admin', 'api', 'assets', 'campaigns', 'items', 'jobs', 'listing-review', 'market', 'order', 'orders',
  'project', 'projects', 'rewards',
];
const EXPECTED_RESERVED = [...new Set([...APP_FIRST_SEGMENTS, ...SEMANTIC_RESERVED])].sort();
/** 前端同表（`frontend/src/project-slug.js` 的 `RESERVED_PROJECT_SEGMENTS` 字面量） */
const FRONT_RESERVED: string[] = (() => {
  const src = readSrc('frontend/src/project-slug.js');
  const i = src.indexOf('export const RESERVED_PROJECT_SEGMENTS');
  if (i < 0) return [];
  return [...src.slice(i, i + src.slice(i).indexOf('\n]')).matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]);
})();

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p68_${tag}`;
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

/** 路由块切片（静态接线断言用；按下一处注册点截断） */
const routeBlock = (startMarker: string, maxLen = 2200): string => {
  const i = INDEX_TS.indexOf(startMarker);
  if (i < 0) return '';
  return INDEX_TS.slice(i, i + maxLen);
};

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const commentDollar = MIG68.split('\n').filter((l) => l.trim().startsWith('--') && l.includes('$$')).length;
  const fmtCheckDef = (MIG68.match(/CHECK \(slug ~ '[^']+'\)/) ?? [''])[0];
  ck.t('A1', '0068 形状：`ADD COLUMN IF NOT EXISTS slug` + `SET NOT NULL` + `project_slug_uniq`(UNIQUE) + `project_slug_format_check`（正则体）+ `campaign_project_fk`（ON DELETE CASCADE）+ `campaign_project_idx` + 无 BEGIN/COMMIT + 注释零 dollar-dollar',
    !/^\s*(BEGIN|COMMIT)\s*;/m.test(MIG68)
      && commentDollar === 0
      && /ADD COLUMN IF NOT EXISTS slug text/.test(MIG68)
      && /ALTER COLUMN slug SET NOT NULL/.test(MIG68)
      && /ADD CONSTRAINT project_slug_uniq UNIQUE \(slug\)/.test(MIG68)
      && /ADD CONSTRAINT project_slug_format_check/.test(MIG68)
      && /slug ~ '\^\[a-z0-9\]\[a-z0-9-\]\{0,31\}\$'/.test(MIG68)
      && /ADD CONSTRAINT campaign_project_fk/.test(MIG68)
      && /REFERENCES public\.project\(project_id\) ON DELETE CASCADE/.test(MIG68)
      && /CREATE INDEX IF NOT EXISTS campaign_project_idx/.test(MIG68)
      && /ALTER COLUMN project_id SET NOT NULL/.test(MIG68),
    JSON.stringify({ commentDollar, fmt: fmtCheckDef }));

  ck.t('A2', '★DB 只查格式（派单建议支）：`project_slug_format_check` 的约束体**不含**保留字（wage/api/admin/… 由服务层拒）· 尾部 DO 自检仍断言数据面保留字 0 行',
    !/CHECK \([^)]*slug[^)]*\bwage\b/.test(fmtCheckDef)
      && /slug IN \('wage','profile','task','tasks','campaign','campaigns','item','items'/.test(MIG68)
      && /slug !~ '\^\[a-z0-9\]\[a-z0-9-\]\{0,31\}\$'/.test(MIG68)
      && /slug ~ '\^\[0-9\]\+\$'/.test(MIG68),
    JSON.stringify({ fmt: fmtCheckDef }));

  ck.t('A3', '0068 尾部自检七面在场：slug 列/NOT NULL · 唯一约束 · 格式约束正则体 · FK 级联 · campaign.project_id NOT NULL · 10 种子 (title,slug) 逐字 · campaign_project_idx',
    /conname = 'project_slug_uniq'/.test(MIG68) && /conname = 'project_slug_format_check'/.test(MIG68)
      && /conname = 'campaign_project_fk'/.test(MIG68) && /confdeltype = 'c'/.test(MIG68)
      && /column_name = 'slug' AND data_type = 'text' AND is_nullable = 'NO'/.test(MIG68)
      && /column_name = 'project_id' AND data_type = 'bigint' AND is_nullable = 'NO'/.test(MIG68)
      && /indexname = 'campaign_project_idx'/.test(MIG68)
      && /expect 10 seed \(title, slug\) pairs/.test(MIG68),
    'tail tokens ok');

  // 迁移里 VALUES 行按列对齐 ⇒ 逗号后有多余空格；用「标题后任意空白 + 单引号 slug」容错对拍（不放宽到跨行）
  const migPairs = SEED_PAIRS.every(([title, slug]) =>
    new RegExp(`\\(\\s*'${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s*,\\s*'${slug}'\\s*\\)`).test(MIG68));
  ck.t('A4', '★10 个种子映射逐字（Sui ⇒ sui 正是 Kevin 举例）：ethereum/solana/arbitrum/base/optimism/polygon/sui/aptos/starknet/zksync 十对齐中',
    migPairs,
    JSON.stringify({ pairs: SEED_PAIRS.map(([t, s]) => `${t}=${s}`) }));

  ck.t('A5', `服务层常量：slug 正则 = \`^[a-z0-9][a-z0-9-]{0,31}$\` · 保留字表 = App.jsx 现取一级静态段（${APP_FIRST_SEGMENTS.length} 段：${APP_FIRST_SEGMENTS.join('/')}）∪ 语义保留 ${SEMANTIC_RESERVED.length} 段 = ${EXPECTED_RESERVED.length} 段，逐字、无重、无漏`,
    PROJECT_SLUG_PATTERN.source === '^[a-z0-9][a-z0-9-]{0,31}$'
      && PROJECT_SLUG_RESERVED.length === EXPECTED_RESERVED.length
      && new Set(PROJECT_SLUG_RESERVED).size === PROJECT_SLUG_RESERVED.length
      && JSON.stringify([...PROJECT_SLUG_RESERVED].sort()) === JSON.stringify(EXPECTED_RESERVED),
    JSON.stringify({ pattern: PROJECT_SLUG_PATTERN.source, reserved: PROJECT_SLUG_RESERVED, routes: APP_FIRST_SEGMENTS, missing: EXPECTED_RESERVED.filter((w) => !(PROJECT_SLUG_RESERVED as readonly string[]).includes(w)) }));

  // ---- slug 解析纯函数臂
  // 正则体 `^[a-z0-9][a-z0-9-]{0,31}$` 字面允许**尾随**连字符（只有首字符禁 `-`）⇒ `sui-` 属合法臂
  const okSlugs = ['sui', 'base-1', 'a', 'a' + 'b'.repeat(31), 'sui-'];
  const badSlugs = ['Sui', '-sui', 'sui_x', 'a'.repeat(33), '', 'a b', 'wage', 'tasks', 'orders', 'admin', '42', '0', '123'];
  const okParsed = okSlugs.every((s) => {
    const r = parseProjectSlugInput(s);
    return 'slug' in r && r.slug === s;
  });
  const badAll = badSlugs.every((s) => {
    const r = parseProjectSlugInput(s);
    return 'err' in r && r.err.status === 400 && reasonOf(r.err) === 'SLUG_INVALID'
      && (r.err.code === 'LEDGER_AMOUNT_INVALID');
  });
  ck.t('A6', '★slug 解析（借码 + details.reason，零新错误码）：合法 5 臂（含正则字面允许的尾随连字符 `sui-`）通过 · 大写/首字符连字符/下划线/超 32/空串/空格/4 保留字/纯数字 13 臂 ⇒ 400 `LEDGER_AMOUNT_INVALID` + reason=`SLUG_INVALID`',
    okParsed && badAll,
    JSON.stringify({ ok: okSlugs, bad: badSlugs }));

  // ---- ★保留字逐段 400（不只是抽样）+ 前后端两表逐字同表（三方：App.jsx 现取 → 两表）
  const reservedArms = (PROJECT_SLUG_RESERVED as readonly string[]).map((seg) => {
    const r = parseProjectSlugInput(seg);
    const err = 'err' in r ? r.err : null;
    const det = (err as { details?: { reserved?: boolean; slug?: string } } | null)?.details;
    return {
      seg,
      ok: !!err && err.status === 400 && err.code === 'LEDGER_AMOUNT_INVALID'
        && reasonOf(err) === 'SLUG_INVALID'
        && det?.reserved === true && det?.slug === seg,
    };
  });
  const reservedBad = reservedArms.filter((x) => !x.ok).map((x) => x.seg);
  ck.t('A10', `★保留字逐段 400（${reservedArms.length - reservedBad.length}/${reservedArms.length}）：每段 \`parseProjectSlugInput\` ⇒ 400 \`LEDGER_AMOUNT_INVALID\` · reason=\`SLUG_INVALID\` · details.reserved=true（明细带 slug）· 前端 \`RESERVED_PROJECT_SEGMENTS\` 与 \`PROJECT_SLUG_RESERVED\` 逐字同表（顺序亦同）`,
    reservedBad.length === 0
      && FRONT_RESERVED.length === (PROJECT_SLUG_RESERVED as readonly string[]).length
      && JSON.stringify(FRONT_RESERVED) === JSON.stringify([...PROJECT_SLUG_RESERVED]),
    JSON.stringify({ n: reservedArms.length, failed: reservedBad, frontend: FRONT_RESERVED.length, backend: PROJECT_SLUG_RESERVED.length }));

  // ---- 三形态判定表（纯谓词）
  const snowflake19 = '7412345678901234567';
  const judgeOk = isProjectReadRef('123') && isProjectReadRef(snowflake19) && isProjectReadRef('sui')
    && isProjectRef('123') && isProjectRef(snowflake19) && !isProjectRef('sui')
    // 纯数字同时满足 slug 正则（[a-z0-9] 含数字）⇒ isProjectSlug('123') 为真，但**判定表数值优先** ⇒
    // 读口落 id/snowflake 双形态；写口 parseProjectSlugInput 拒纯数字 ⇒ 无歧义
    && isProjectSlug('sui') && isProjectSlug('123') && !isProjectSlug('Sui') && !isProjectSlug('-sui')
    && !isProjectReadRef('a'.repeat(33)) && !isProjectReadRef('') && !isProjectReadRef('Sui');
  ck.t('A7', '★判定表（纯谓词）：全数字（id/snowflake）**优先** ⇒ 数值双形态；slug 格式 ⇒ slug 等值；其余 404（isProjectRef 仍纯数字 ⇒ apply/claim/leave/PATCH 口语义不变）',
    judgeOk,
    JSON.stringify({ read_123: isProjectReadRef('123'), read_snowflake: isProjectReadRef(snowflake19), read_sui: isProjectReadRef('sui'), ref_sui: isProjectRef('sui'), read_upper: isProjectReadRef('Sui') }));

  // ---- 零新路由 + 权限支静态接线
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const r2Block = routeBlock("app.get('/api/project/:ref'");
  const cCreate = routeBlock("app.post('/api/campaign',");
  const tCreate = routeBlock("app.post('/api/campaign/:campaignId/task'");
  const tPatch = routeBlock("app.patch('/api/campaign/task/:taskId'");
  const cPatch = routeBlock("app.patch('/api/campaign/:campaignId'");
  const settleBlock = routeBlock("app.post('/api/campaign/subtask/:subtaskId/settle'");
  ck.t('A8', '★零新路由：注册点仍 **128**（get 55 / post 66 / patch 4 / delete 3）· R2 `:ref` 吞 slug（isProjectReadRef + getProjectDetailByRef）· POST campaign/task、PATCH task 接 authorizeProjectScopedCreate · PATCH campaign / settle 仍 manage_tasks（非创建口零回归）',
    regs === 128 && countVerb('get') === 55 && countVerb('post') === 66 && countVerb('patch') === 4 && countVerb('delete') === 3
      && /isProjectReadRef\(ref\)/.test(r2Block) && /getProjectDetailByRef\(ref/.test(r2Block)
      && /authorizeProjectScopedCreate/.test(cCreate) && /getProjectOwnerContext/.test(cCreate)
      && /authorizeProjectScopedCreate/.test(tCreate) && /getCampaignAuthzContext/.test(tCreate)
      && /authorizeProjectScopedCreate/.test(tPatch) && /getTaskAuthzContext/.test(tPatch)
      && /requireAdmin\(req, res, 'manage_tasks'\)/.test(cPatch)
      && /requireAdmin\(req, res, 'manage_tasks'\)/.test(settleBlock)
      && /createProjectVerb/.test(PROJ_SVC) && /listCampaignsByProject/.test(CAMP_SVC)
      // campaign 建口 = 管理员支 ∨ owner 支（两臂都在同一决策函数里）
      && /adminActor/.test(cCreate) && /manage_tasks/.test(cCreate),
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete'), r2: [r2Block.includes('isProjectReadRef(ref)'), r2Block.includes('getProjectDetailByRef(ref')] }));

  ck.t('A9', '服务层加性面：listProjects 行带 slug（normalizeProjectRow 含 slug）· CampaignView 带 project_id · CAMPAIGN_CREATE_KEYS 含 project_id 且 PATCH 键集不含（不许改挂）',
    /slug: str\(row\.slug\)/.test(PROJ_SVC)
      && /project_id: str\(row\.project_id\)/.test(CAMP_SVC)
      && /const CAMPAIGN_CREATE_KEYS = \['title', 'project_id'/.test(CAMP_SVC)
      && /const CAMPAIGN_PATCH_KEYS = \['title', 'description', 'time_start', 'time_end', 'status'\]/.test(CAMP_SVC),
    'additive shapes ok');

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  const applied68 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0068'"))[0]?.n ?? 0) > 0;
  const MODE = applied68 ? 'post-apply' : 'pre-apply';
  out.mode = MODE;
  const committedBefore = {
    projects: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1),
    campaigns: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1),
  };
  out.committed_before = committedBefore;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = { mode: MODE };
    const ex = c as unknown as TxClient;
    const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => raw1<T>(c, sql, params);
    const projectRows = async (): Promise<number> => Number((await q1<{ n: number }>('SELECT count(*)::int AS n FROM public.project'))?.n ?? -1);
    const ledgerRows = async (key: string): Promise<number> => Number((await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.ledger_entry WHERE idempotency_key = $1 OR idempotency_key LIKE $1 || '#%'", [key]))?.n ?? -1);

    // ---- 夹具：三用户（owner1 / owner2 / 非 owner）
    const uids: number[] = [];
    for (const base of [908801, 908802, 908803]) {
      const row = await q1<{ uid: string }>(
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p68-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [OWNER1, OWNER2, OUTSIDER] = uids;
    R.fixture_users = uids;
    // 建项费资金：受信任平台 mint（早于 B1 干跑 —— mint 需 0068 之前的库面；随事务回滚）
    const fee = BigInt(await currentCreateFee());
    for (const [i, uid] of [OWNER1, OWNER2].entries()) {
      await postEvent({
        op: 'mint', uid: String(uid), cid: '1', amount: (fee * 2n + 5000n).toString(), platform: true,
        idempotencyKey: `ops:p68-gate:${RUN}:mint-${i}`, memo: 'p68-gate usd fixture', ex,
      });
    }

    // ---- B1 · 迁移 0068 干跑（头段 + 尾部 DO）
    const before68 = Number((await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0068'"))?.n ?? -1);
    for (const stmt of M68_HEAD) await c.query(stmt);
    await c.query(M68_TAIL);
    const after68 = Number((await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0068'"))?.n ?? -1);

    const slugCol = await q1<{ is_nullable: string; data_type: string }>(
      `SELECT is_nullable, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='project' AND column_name='slug'`);
    const projIdCol = await q1<{ is_nullable: string; data_type: string }>(
      `SELECT is_nullable, data_type FROM information_schema.columns
        WHERE table_schema='public' AND table_name='campaign' AND column_name='project_id'`);
    const uniq = await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname='project_slug_uniq' AND conrelid='public.project'::regclass AND contype='u'`);
    const fmtDef = await q1<{ def: string }>(
      `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
        WHERE conname='project_slug_format_check' AND conrelid='public.project'::regclass`);
    const fk = await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conname='campaign_project_fk' AND conrelid='public.campaign'::regclass
          AND contype='f' AND confdeltype='c'`);
    const idx = await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname='campaign_project_idx'");
    ck.t('B1', `[${MODE}] 0068 干跑全绿：slug text NOT NULL · campaign.project_id bigint NOT NULL · 唯一/格式/FK 级联三约束 · campaign_project_idx · 版本行未写`,
      after68 === before68 && slugCol?.is_nullable === 'NO' && slugCol?.data_type === 'text'
        && projIdCol?.is_nullable === 'NO' && projIdCol?.data_type === 'bigint'
        && Number(uniq?.n ?? 0) === 1
        && /\[a-z0-9-\]\{0,31\}/.test(String(fmtDef?.def ?? ''))
        && Number(fk?.n ?? 0) === 1 && Number(idx?.n ?? 0) === 1,
      JSON.stringify({ version: [before68, after68], slug: slugCol, proj_id: projIdCol, uniq: uniq?.n, fmt: fmtDef?.def, fk: fk?.n, idx: idx?.n }));

    // ---- B2 · 10 种子 slug 逐字对拍
    const seedRows = await raw<{ title: string; slug: string }>(c,
      `SELECT title, slug FROM public.project WHERE title LIKE '%生态推广' ORDER BY title`);
    const seedMap = new Map(seedRows.map((x) => [String(x.title), String(x.slug)]));
    const seedOk = SEED_PAIRS.every(([t, s]) => seedMap.get(t) === s) && seedRows.length === 10;
    ck.t('B2', '★10 个种子 slug 逐字对拍（ethereum/solana/arbitrum/base/optimism/polygon/**sui**/aptos/starknet/zksync）· 恰 10 行',
      seedOk,
      JSON.stringify(Object.fromEntries(seedMap)));

    // ---- B3 · 数据面卫生：格式 / 纯数字 / 保留字 0 行；distinct = 全行
    const hygiene = await q1<{ bad_fmt: number; digit: number; reserved: number; nulls: number; n: number; dist: number }>(
      `SELECT count(*) FILTER (WHERE slug !~ '^[a-z0-9][a-z0-9-]{0,31}$')::int AS bad_fmt,
              count(*) FILTER (WHERE slug ~ '^[0-9]+$')::int AS digit,
              count(*) FILTER (WHERE slug IN (${(PROJECT_SLUG_RESERVED as readonly string[]).map((s) => `'${s}'`).join(',')}))::int AS reserved,
              count(*) FILTER (WHERE slug IS NULL)::int AS nulls,
              count(*)::int AS n, count(DISTINCT slug)::int AS dist
         FROM public.project`);
    ck.t('B3', 'slug 数据面卫生：格式违例 0 · 纯数字 0 · 保留字 0 · NULL 0 · distinct = 全行（唯一）',
      Number(hygiene?.bad_fmt ?? -1) === 0 && Number(hygiene?.digit ?? -1) === 0
        && Number(hygiene?.reserved ?? -1) === 0 && Number(hygiene?.nulls ?? -1) === 0
        && Number(hygiene?.n ?? -1) === Number(hygiene?.dist ?? -2),
      JSON.stringify(hygiene));

    // ---- B4 · 幂等：再跑一遍头段 + 尾部 DO ⇒ 终态不变
    for (const stmt of M68_HEAD) await c.query(stmt);
    await c.query(M68_TAIL);
    const seedAgain = await raw<{ title: string; slug: string }>(c,
      `SELECT title, slug FROM public.project WHERE title LIKE '%生态推广' ORDER BY title`);
    const againOk = seedAgain.length === 10 && SEED_PAIRS.every(([t, s]) => seedAgain.some((x) => String(x.title) === t && String(x.slug) === s));
    ck.t('B4', '0068 幂等：重跑头段 + 尾部 DO ⇒ 无异常、种子仍 10 行逐字、无重复 slug（ADD COLUMN IF NOT EXISTS / 约束守卫 / UPDATE 只补 NULL）',
      againOk, JSON.stringify({ rows: seedAgain.length }));

    // ---- B5 · 迁移自检负控（三臂）
    const ncReserved = await undoAfter(c, 'reserved', async () => {
      await c.query(`UPDATE public.project SET slug = 'wage' WHERE title = 'Sui 生态推广'`);
      await c.query(M68_TAIL);
      return 'passed';
    });
    const ncFormat = await undoAfter(c, 'format', async () => {
      await c.query(`UPDATE public.project SET slug = 'Bad_Slug' WHERE title = 'Sui 生态推广'`);
      return 'updated';
    });
    const ncUnique = await undoAfter(c, 'unique', async () => {
      await c.query(`ALTER TABLE public.project DROP CONSTRAINT project_slug_uniq`);
      await c.query(M68_TAIL);
      return 'passed';
    });
    ck.t('B5', '★迁移自检负控三臂：数据面保留字（slug=wage）⇒ 尾 DO RAISE（P0001）· 违格式（Bad_Slug）⇒ DB 格式 CHECK 当场 23514 · 去唯一约束 ⇒ 尾 DO RAISE（缺 project_slug_uniq）',
      ncReserved.sqlstate === 'P0001' && /self-check FAILED/.test(ncReserved.message)
        && ncFormat.sqlstate === '23514'
        && ncUnique.sqlstate === 'P0001' && /self-check FAILED/.test(ncUnique.message),
      JSON.stringify({
        reserved: [ncReserved.sqlstate, ncReserved.message.slice(0, 90)],
        format: [ncFormat.sqlstate, ncFormat.message.slice(0, 90)],
        unique: [ncUnique.sqlstate, ncUnique.message.slice(0, 90)],
      }));

    // ==================================================================== S · 服务层真路径
    const slugA = `p68a${Math.random().toString(36).slice(2, 8)}`;
    const rowsBefore = await projectRows();
    const created = await createProjectVerb({
      actorUid: OWNER1,
      body: {
        title: `p68 gate project A ${RUN}`, slug: slugA, description: 'p68 gate',
        headcount: 2, recruit_min_account_days: 0, wage_batt_per_claim: '10',
        wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p68-${RUN}-a`,
      ex,
    });
    const viewA = viewOf<{ project_id?: string; slug?: string; snowflake_id?: string }>(created);
    const P_A = String(viewA.project_id ?? '');
    const SF_A = String(viewA.snowflake_id ?? '');
    const rowsAfter = await projectRows();
    ck.t('S1', '建项带用户填写 slug：201/200 ok · `view.slug` 逐字回显 · 项目行 +1',
      verbOf(created) === 200 && String(viewA.slug) === slugA && P_A !== '' && rowsAfter === rowsBefore + 1,
      JSON.stringify({ status: verbOf(created), slug: viewA.slug, id: P_A, rows: [rowsBefore, rowsAfter] }));

    const listRows = await listProjects(ex);
    const listHit = listRows.find((x) => x.project_id === P_A);
    ck.t('S2', '列表行**加性** `slug`（listProjects 每行 carry slug；种子行也带）· 无裁剪（原键仍在）',
      listRows.length > 0 && listRows.every((x) => typeof x.slug === 'string' && x.slug.length > 0)
        && listHit !== undefined && listHit.slug === slugA,
      JSON.stringify({ rows: listRows.length, sample: listHit?.slug, first: listRows[0]?.slug }));

    const bySlug = await getProjectByRef(slugA, ex);
    const byId = await getProjectByRef(P_A, ex);
    const bySf = await getProjectByRef(SF_A, ex);
    const miss = await getProjectByRef('no-such-slug-xyz', ex);
    ck.t('S3', '★三形态读同一行：slug / 数字 id / snowflake ⇒ 同一 project_id · 不存在的 slug ⇒ null（路由落 404，不 500）',
      bySlug !== null && byId !== null && bySf !== null && miss === null
        && bySlug.project_id === P_A && byId.project_id === P_A && bySf.project_id === P_A,
      JSON.stringify({ slug: bySlug?.project_id, id: byId?.project_id, sf: bySf?.project_id, miss: miss === null }));

    // ---- S4 · 非法 / 保留 / 纯数字 slug（400，零残留：不落行、不扣费）
    const badCreate = async (slug: unknown) => createProjectVerb({
      actorUid: OWNER1,
      body: {
        title: `p68 bad slug ${RUN}-${Math.random().toString(36).slice(2, 6)}`, slug,
        description: '', headcount: 1, recruit_min_account_days: 0, wage_batt_per_claim: '1',
        wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p68-${RUN}-bad-${Math.random().toString(36).slice(2, 7)}`,
      ex,
    });
    const rowsBeforeBad = await projectRows();
    const noSlug = await createProjectVerb({
      actorUid: OWNER1,
      body: {
        title: `p68 no slug ${RUN}`, description: '', headcount: 1, recruit_min_account_days: 0,
        wage_batt_per_claim: '1', wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p68-${RUN}-noslug`,
      ex,
    });
    const rUpper = await badCreate('Sui');
    const rReserved = await badCreate('wage');
    const rDigits = await badCreate('42');
    const rDash = await badCreate('-x');
    const rowsAfterBad = await projectRows();
    const allFour = [noSlug, rUpper, rReserved, rDigits, rDash];
    ck.t('S4', '★slug 入参闸（借码 400 + reason）：缺 slug · 大写 · 保留字 · 纯数字 · 首字符连字符 ⇒ 全部 400 `SLUG_INVALID` · 项目行零新增（早于扣费）',
      allFour.every((x) => verbOf(x) === 400 && reasonOf(x) === 'SLUG_INVALID' && (x as { code?: string }).code === 'LEDGER_AMOUNT_INVALID')
        && rowsAfterBad === rowsBeforeBad,
      JSON.stringify({ arms: allFour.map((x) => [verbOf(x), reasonOf(x)]), rows: [rowsBeforeBad, rowsAfterBad] }));

    // ---- S5 · 重名（种子 'sui'）⇒ 400 SLUG_TAKEN，零残留（无新行 / 无台账）
    const takenKey = `cli:p68-${RUN}-taken`;
    const rowsBeforeTaken = await projectRows();
    const taken = await createProjectVerb({
      actorUid: OWNER1,
      body: {
        title: `p68 taken ${RUN}`, slug: 'sui', description: '', headcount: 1,
        recruit_min_account_days: 0, wage_batt_per_claim: '1',
        wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: takenKey,
      ex,
    });
    ck.t('S5', '★slug 唯一：与种子 `sui` 重名 ⇒ 400 `SLUG_TAKEN`（预检早于扣费）· 项目行不增 · 同键台账 0 条',
      verbOf(taken) === 400 && reasonOf(taken) === 'SLUG_TAKEN'
        && (await projectRows()) === rowsBeforeTaken && (await ledgerRows(takenKey)) === 0,
      JSON.stringify({ status: verbOf(taken), reason: reasonOf(taken), detail: (taken as { details?: unknown }).details, ledger: await ledgerRows(takenKey) }));

    // ---- S6 · PATCH 改 slug（可改 / 重名 400 / 保留字 400）
    const slugA2 = `${slugA}-v2`;
    const patched = await patchProjectVerb({ ref: P_A, body: { slug: slugA2 }, ex });
    const patchedTaken = await patchProjectVerb({ ref: P_A, body: { slug: 'base' }, ex });
    const patchedReserved = await patchProjectVerb({ ref: P_A, body: { slug: 'tasks' }, ex });
    const afterPatch = await getProjectByRef(slugA2, ex);
    const oldSlugGone = await getProjectByRef(slugA, ex);
    ck.t('S6', 'PATCH 可改 slug：改值 200 且新 slug 可读、旧 slug 立即 miss · 改成种子名 `base` ⇒ 400 `SLUG_TAKEN` · 改成保留字 `tasks` ⇒ 400 `SLUG_INVALID`',
      verbOf(patched) === 200 && String(viewOf<{ slug?: string }>(patched).slug) === slugA2
        && afterPatch?.project_id === P_A && oldSlugGone === null
        && verbOf(patchedTaken) === 400 && reasonOf(patchedTaken) === 'SLUG_TAKEN'
        && verbOf(patchedReserved) === 400 && reasonOf(patchedReserved) === 'SLUG_INVALID',
      JSON.stringify({ patched: viewOf<{ slug?: string }>(patched).slug, taken: reasonOf(patchedTaken), reserved: reasonOf(patchedReserved) }));

    // ---- S7 · campaign 挂项目：缺 project_id 400 / 未知项目 404 / 正常 201
    const noProjCampaign = await createCampaignVerb({ body: { title: `p68 no proj ${RUN}` }, ex });
    const unknownProjCampaign = await createCampaignVerb({ body: { title: `p68 unknown proj ${RUN}`, project_id: '999999999' }, ex });
    const campCreated = await createCampaignVerb({ body: { title: `p68 campaign ${RUN}`, project_id: P_A }, ex });
    const campView = viewOf<{ campaign_id?: string; project_id?: string; status?: string }>(campCreated);
    const C_A = String(campView.campaign_id ?? '');
    ck.t('S7', 'campaign 挂项目（0068）：缺 `project_id` ⇒ 400 `CAMPAIGN_PROJECT_REQUIRED` · 未知项目 ⇒ 404 `project_not_found` · 正常 ⇒ 201 draft 且 `view.project_id` = 项目',
      verbOf(noProjCampaign) === 400 && reasonOf(noProjCampaign) === 'CAMPAIGN_PROJECT_REQUIRED'
        && verbOf(unknownProjCampaign) === 404 && reasonOf(unknownProjCampaign) === 'project_not_found'
        && verbOf(campCreated) === 200 && campView.project_id === P_A && String(campView.status) === 'draft' && C_A !== '',
      JSON.stringify({ no_proj: [verbOf(noProjCampaign), reasonOf(noProjCampaign)], unknown: [verbOf(unknownProjCampaign), reasonOf(unknownProjCampaign)], created: campView }));

    // ---- S8 · 项目页嵌套：public 仅 active；owner 见 draft；别项目活动不串
    const P_B = String(viewOf<{ project_id?: string }>(await createProjectVerb({
      actorUid: OWNER2,
      body: {
        title: `p68 gate project B ${RUN}`, slug: `p68b${Math.random().toString(36).slice(2, 8)}`,
        description: 'other project', headcount: 1, recruit_min_account_days: 0,
        wage_batt_per_claim: '1', wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p68-${RUN}-b`,
      ex,
    })).project_id ?? '');
    const campOnB = await createCampaignVerb({ body: { title: `p68 campaign B ${RUN}`, project_id: P_B }, ex });
    const CB = String(viewOf<{ campaign_id?: string }>(campOnB).campaign_id ?? '');

    const taskOnA = await createTaskVerb({
      campaignRef: C_A,
      body: {
        title: `p68 task ${RUN}`, reward_amount_primary: '10',
        subtasks: [{ type_code: 'quiz', title: '答题', payload: { answers: { q1: 'yes' } } }],
      },
      ex,
    });
    const T_A = String(viewOf<{ task_id?: string }>(taskOnA).task_id ?? '');

    const ownerView = await getProjectDetailByRef(slugA2, { viewerUid: OWNER1, adminActor: false }, ex);
    const publicViewDraft = await getProjectDetailByRef(slugA2, { viewerUid: null, adminActor: false }, ex);
    const adminView = await getProjectDetailByRef(slugA2, { viewerUid: OUTSIDER, adminActor: true }, ex);
    const ownerHasDraft = (ownerView?.campaigns ?? []).some((x) => x.campaign_id === C_A);
    const publicHasDraft = (publicViewDraft?.campaigns ?? []).some((x) => x.campaign_id === C_A);
    const adminHasDraft = (adminView?.campaigns ?? []).some((x) => x.campaign_id === C_A);
    const noCrossB = (ownerView?.campaigns ?? []).every((x) => x.campaign_id !== CB);

    // 激活活动 + 任务 ⇒ public 可见（并验证 subtask 嵌套）
    await patchCampaignVerb({ ref: C_A, body: { status: 'active' }, ex });
    await patchTaskVerb({ ref: T_A, body: { status: 'active' }, ex });
    const publicViewActive = await getProjectDetailByRef(slugA2, { viewerUid: null, adminActor: false }, ex);
    const pubCamp = (publicViewActive?.campaigns ?? []).find((x) => x.campaign_id === C_A);
    const pubTask = (pubCamp?.tasks ?? []).find((x) => x.task_id === T_A);
    ck.t('S8', '★项目页嵌套（归属链按 campaign.project_id 过滤）：owner 见 draft 活动（含任务/子任务）· 公众不见 draft · 管理员见 draft · 别项目活动不串 · 激活后公众可见 campaign→task→subtask',
      ownerHasDraft && !publicHasDraft && adminHasDraft && noCrossB
        && pubCamp !== undefined && pubTask !== undefined
        && (pubTask?.subtasks ?? []).length === 1,
      JSON.stringify({
        owner_campaigns: (ownerView?.campaigns ?? []).map((x) => [x.campaign_id, x.status]),
        public_draft_visible: publicHasDraft,
        admin_draft_visible: adminHasDraft,
        public_active: pubCamp ? { status: pubCamp.status, tasks: (pubCamp.tasks ?? []).length, subtasks: (pubTask?.subtasks ?? []).length } : null,
      }));

    // ---- S9 · ★权限三臂（创建口 project_owner 支）：owner 可建 / 非 owner 非管理员 403 / 管理员可
    const ctxA = await getProjectOwnerContext(P_A, ex);
    const ctxB = await getProjectOwnerContext(P_B, ex);
    const campCtx = await getCampaignAuthzContext(C_A, ex);
    const taskCtx = await getTaskAuthzContext(T_A, ex);
    const armOwner = authorizeProjectScopedCreate({ actorUid: OWNER1, adminActor: false, ownerContext: ctxA, projectId: P_A });
    const armOutsider = authorizeProjectScopedCreate({ actorUid: OUTSIDER, adminActor: false, ownerContext: ctxA, projectId: P_A });
    const armAdmin = authorizeProjectScopedCreate({ actorUid: OUTSIDER, adminActor: true, ownerContext: null, projectId: P_A });
    const armOwnerOfOther = authorizeProjectScopedCreate({ actorUid: OWNER1, adminActor: false, ownerContext: ctxB, projectId: P_B });
    const armCampOwner = authorizeProjectScopedCreate({ actorUid: OWNER1, adminActor: false, ownerContext: campCtx, projectId: campCtx?.project_id ?? null });
    const armCampOutsider = authorizeProjectScopedCreate({ actorUid: OUTSIDER, adminActor: false, ownerContext: campCtx, projectId: campCtx?.project_id ?? null });
    const armTaskOwner = authorizeProjectScopedCreate({ actorUid: OWNER1, adminActor: false, ownerContext: taskCtx, projectId: taskCtx?.project_id ?? null });
    ck.t('S9', '★权限三臂：owner（自己的项目）放行 · 非 owner ∧ 非管理员 ⇒ 403 `AUTH_FORBIDDEN` reason=`project_owner_required` · 管理员（manage_tasks，adminActor）放行；task/subtask 归属链（campaign → project）同判：campaign owner 放行 / 他人 403 / task 链 owner 放行',
      armOwner === null && armAdmin === null
        && armOutsider !== null && armOutsider.status === 403 && armOutsider.code === 'AUTH_FORBIDDEN' && reasonOf(armOutsider) === 'project_owner_required'
        && armOwnerOfOther !== null && reasonOf(armOwnerOfOther) === 'project_owner_required'
        && armCampOwner === null && armTaskOwner === null
        && armCampOutsider !== null && reasonOf(armCampOutsider) === 'project_owner_required'
        && campCtx?.project_id === P_A && taskCtx?.project_id === P_A,
      JSON.stringify({
        owner: armOwner, admin: armAdmin,
        outsider: [verbOf(armOutsider), reasonOf(armOutsider)],
        owner_other: reasonOf(armOwnerOfOther),
        camp: [armCampOwner === null, reasonOf(armCampOutsider)], task: armTaskOwner === null,
        camp_ctx: campCtx, task_ctx: taskCtx,
      }));

    // 真路径落库：owner 建 campaign（不走管理员）→ 行在；非 owner 建 campaign 被 403（同一决策函数路由层用）
    const ownerCamp = await createCampaignVerb({ body: { title: `p68 owner campaign ${RUN}`, project_id: P_A }, ex });
    ck.t('S10', '真路径：owner 建 campaign（service）⇒ 201 且 campaign 行挂本人项目 · campaign_id 出参字符串',
      verbOf(ownerCamp) === 200 && viewOf<{ project_id?: string }>(ownerCamp).project_id === P_A
        && typeof viewOf<{ campaign_id?: unknown }>(ownerCamp).campaign_id === 'string',
      JSON.stringify({ status: verbOf(ownerCamp), view: viewOf<{ project_id?: string; campaign_id?: string }>(ownerCamp) }));

    // ==================================================================== N · 负控
    // ① 「去 slug 唯一 ⇒ 重名可入」：savepoint 内 DROP 约束 ⇒ 直插重名成功（行 +1）⇒ 反证约束承重；
    //    同一 savepoint 内再跑尾 DO ⇒ RAISE（自检对缺约束可红）。
    const ncDup = await undoAfter(c, 'dup', async () => {
      await c.query(`ALTER TABLE public.project DROP CONSTRAINT project_slug_uniq`);
      const dupSlug = String((await q1<{ slug: string }>("SELECT slug FROM public.project WHERE title = 'Solana 生态推广'"))?.slug ?? '');
      const rowsBeforeDup = await projectRows();
      await c.query(
        `INSERT INTO public.project (snowflake_id, owner_uid, title, slug, description, headcount,
                                     recruit_min_account_days, wage_batt_per_claim, wage_interval_hours, status)
         VALUES (9000000000000068, $1::bigint, $2, $3, '', 1, 0, 1, 1, 'recruiting')`,
        [String(OUTSIDER), `p68 dup ${RUN}`, dupSlug]);
      const rowsAfterDup = await projectRows();
      let tailSql: string | null = null;
      try {
        await c.query(M68_TAIL);
      } catch (e) {
        tailSql = String((e as { code?: string }).code ?? '');
      }
      return { dupSlug, before: rowsBeforeDup, after: rowsAfterDup, tailSql };
    });
    const dupVal = ncDup.value as { dupSlug: string; before: number; after: number; tailSql: string | null } | null;
    ck.t('N1', '★负控① 去 slug 唯一 ⇒ 重名可入：DROP `project_slug_uniq` 后同名 slug 直插**成功**（行 +1；唯一性由约束承重）· 同态再跑 0068 尾 DO ⇒ RAISE（P0001，缺唯一约束被自检抓住）⇒ 「去唯一」必红',
      ncDup.sqlstate === null && dupVal !== null && dupVal.after === dupVal.before + 1
        && dupVal.tailSql === 'P0001',
      JSON.stringify({ ...(dupVal ?? {}), sqlstate: ncDup.sqlstate }));

    // ② 「去 owner 支 ⇒ owner 被拒必红」：owner 臂走 allow（null），deny 臂（非 owner / 别人项目）已被 S9 证明走
    //    project_owner_required —— 删掉 owner 支后 owner 输入只能落 deny 路径 ⇒ S9 的 `armOwner === null` 必红。
    //    此处再补一臂：owner 在 **别人项目** 上（ownerContext 指向他人）⇒ 必拒；即「owner 身份不是万能钥匙」。
    const ncOwner = authorizeProjectScopedCreate({ actorUid: OWNER1, adminActor: false, ownerContext: ctxB, projectId: P_B });
    const ownerBranchSensitive = ncOwner !== null && reasonOf(ncOwner) === 'project_owner_required'
      && authorizeProjectScopedCreate({ actorUid: OWNER1, adminActor: false, ownerContext: ctxA, projectId: P_A }) === null;
    ck.t('N2', '★负控② 去 owner 支 ⇒ owner 被拒必红：owner 身份只在**自己**项目上放行（别人项目 ⇒ 403 `project_owner_required`）；S9 的 owner 臂与 deny 臂互斥 ⇒ 删 owner 支后 owner 输入必落 deny 路径 ⇒ 判据可红',
      ownerBranchSensitive,
      JSON.stringify({ owner_on_other_project: reasonOf(ncOwner ?? {}) }));

    // ③ ended 项目：owner 也被拒（≠ ended 半支承重）
    await patchProjectVerb({ ref: P_B, body: { status: 'ended' }, ex });
    const ctxBEnded = await getProjectOwnerContext(P_B, ex);
    const armEnded = authorizeProjectScopedCreate({ actorUid: OWNER2, adminActor: false, ownerContext: ctxBEnded, projectId: P_B });
    ck.t('N3', '★负控③ ended 项目：owner 本人也被拒（403 reason=`project_owner_ended`）⇒ 谓词「owner ∧ status ≠ ended」的后半支承重（管理员支不受此限 —— 派单字面）',
      ctxBEnded?.project_status === 'ended' && armEnded !== null && armEnded.status === 403
        && reasonOf(armEnded) === 'project_owner_ended',
      JSON.stringify({ ctx: ctxBEnded, err: [verbOf(armEnded ?? {}), reasonOf(armEnded ?? {})] }));

    // ---- 登录态列表/嵌套一致性：listActiveCampaigns 仍只回 active（零回归）
    const actives = await listActiveCampaigns(ex);
    R.active_campaigns = actives.length;
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
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0068'"))[0]?.n ?? -1);
    const projectsNow = Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1);
    const campaignsNow = Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1);
    // 已 apply 态（他单已落库）⇒ 判据是「本门零新增」：版本行仍恰 1；未 apply 态 ⇒ 仍 0。
    const expectVersion = applied68 ? 1 : 0;
    ck.t('Z1', `[${MODE}] 零 apply / 零残留：提交面 \`schema_migration\` 0068 行 = ${expectVersion}（${applied68 ? '既已 apply，本门零新增' : '未 apply 态，本门不写版本行'}）· project 行数不变（${committedBefore.projects}）· campaign 行数不变（${committedBefore.campaigns}）`,
      versionRows === expectVersion && projectsNow === committedBefore.projects && campaignsNow === committedBefore.campaigns,
      JSON.stringify({ mode: MODE, version_0068: versionRows, projects: [committedBefore.projects, projectsNow], campaigns: [committedBefore.campaigns, campaignsNow] }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p68-slug-campaign-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
