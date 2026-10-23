/**
 * p75-00 · 首页热门任务卡「子任务标题」读口加性面（`GET /api/home/campaign-tasks` 每行 `subtasks[]`）· 门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p69/p70/p74 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/home/p75-00-home-task-subtasks-gate.ts
 * 读数：`ops/home/readings/p75-home-task-subtasks-gate-<RUN>.json`
 *
 * 派单（Kevin 2026-10-22，本单 = 纯后端）：
 *   `GET /api/home/campaign-tasks` 每行**加性** `subtasks`：数组，元素**恰**
 *   `{subtask_id, type_code, title, required, sort}`（按 `sort ASC, subtask_id ASC`）；
 *   **不下发** payload / content / reward / 正确答案；无子任务 ⇒ `[]`（键不省略）。
 *   实现：一次批量取（`task_id = ANY(...)`）＋ 内存归组（**禁 N+1**）；`LIMIT 20` 与 30s 缓存语义不变；
 *   同源读口 `/api/prize/all` / `/api/home` 零影响；**零新路由**（regs 仍 109）、零新错误码。
 *
 * 判据面（五臂 + 负控）：
 *   ① 有子任务的 task 行 `subtasks` **逐项对拍**（id / type / title / required / sort 与顺序）；
 *   ② 无子任务 ⇒ `[]` 且**键在场**（hasOwnProperty）；
 *   ③ **多 task 多子任务归属正确**（不串行 —— 同一 `ownershipOk` 谓词，正控真读 true / 负控交叉连接 false）；
 *   ④ **零 N+1**：静态 —— SQL 里 `public.subtask` 恰 1 处、函数体查询恰 2 处、无循环/异步 map 包裹查询；
 *   ⑤ **无泄露键**：出参元素恰 5 键；`payload` / `content` / `reward` / `correct` 零命中（静态 SQL 与线上字面双查）。
 *   负控（反事实，同一谓词必红）：N1 聚合改成「不按 task_id 过滤」（`ON TRUE` 交叉连接）⇒ 臂③ 谓词 false；
 *     N2 SQL 多取 payload / reward 列 ⇒ 臂⑤ 谓词 false 且哨兵值真泄；N3 函数体改成逐 task 回查 ⇒ 臂④ 谓词 false。
 *
 * 纪律：**不 apply、不写版本表、不 push、不改 frontend / docs**；夹具全在单回滚事务内；
 *   反事实臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  createProjectVerb,
  currentCreateFee,
  listHomeCampaignTasks,
} from '../../backend-ts/src/project-service';
import type { HomeCampaignTaskRow, HomeTaskSubtask } from '../../backend-ts/src/project-service';
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

/** 服务层块切片（SQL 字面量 / 函数体断言用） */
const svcSlice = (start: string, end: string): string => {
  const i = PROJ_SVC.indexOf(start);
  if (i < 0) return '';
  const j = PROJ_SVC.indexOf(end, i);
  return PROJ_SVC.slice(i, j < 0 ? i + 3000 : j + end.length);
};
/** 路由块切片（静态接线断言用；止于本路由的 `\n});` —— 防溢出到相邻路由） */
const routeBlock = (startMarker: string, maxLen = 600): string => {
  const i = INDEX_TS.indexOf(startMarker);
  if (i < 0) return '';
  const j = INDEX_TS.indexOf('\n});', i);
  return INDEX_TS.slice(i, j < 0 ? Math.min(i + maxLen, INDEX_TS.length) : j + 4);
};

// ---------------------------------------------------------------- 静态谓词（负控复用同一谓词）
/**
 * ④ 零 N+1 谓词：函数体里查询恒 2 次（行集 1 + 子任务批量 1），且**没有**循环 / 异步 map / Promise.all
 * 包裹查询（逐 task 回查 = N+1 形态）。真实函数体 ⇒ true；注入 `for (const t of tasks) await readRows(...)`
 * ⇒ false（负控 N3）。
 */
const zeroNPlusOne = (body: string): boolean => {
  const q = (body.match(/await\s+readRows</g) ?? []).length
    + (body.match(/await\s+readQuery</g) ?? []).length
    + (body.match(/await\s+txQuery</g) ?? []).length;
  if (q !== 2) return false;
  const perRowLoop = /for\s*\(\s*const\s+\w+\s+of\s+tasks\s*\)[\s\S]*?await\s+(readRows|readQuery|txQuery)/.test(body)
    || /\.map\s*\(\s*async[\s\S]*?await\s+readRows/.test(body)
    || /Promise\.all\s*\(\s*tasks\s*\.map/.test(body)
    || /await\s+readRows<Row>\(HOME_TASK_SUBTASKS_SQL,\s*\[\s*\w+\.task_id\s*\]/.test(body);
  if (perRowLoop) return false;
  // 单条批量取 + 归组（批量 SQL 必须带 task_id 收口；归组必须在内存 Map 里）
  return /await\s+readRows<Row>\(HOME_TASK_SUBTASKS_SQL/.test(body)
    && /new Map<string, HomeTaskSubtask\[\]>\(\)/.test(body);
};

/** ⑤ 无泄露谓词：SQL 字面量里零 payload / content / reward / correct / answers 字样 */
const leakFreeSql = (sql: string): boolean =>
  !/payload|content|reward|correct|answers/i.test(sql);

/** ⑤ 无泄露谓词（出参面）：元素恰 5 键 + 序列化零泄露词 */
const SUBTASK_KEYS = ['required', 'sort', 'subtask_id', 'title', 'type_code'];
const leakFreeOut = (items: Array<Record<string, unknown>>): boolean => {
  for (const item of items) {
    if (JSON.stringify(Object.keys(item).sort()) !== JSON.stringify(SUBTASK_KEYS)) return false;
    if (typeof item.required !== 'boolean') return false;
    if (!Number.isFinite(item.sort as number)) return false;
    if (typeof item.subtask_id !== 'string' || typeof item.type_code !== 'string' || typeof item.title !== 'string') return false;
  }
  const blob = JSON.stringify(items);
  // ★ `task_id` 不能裸匹配 —— `subtask_id` 内含子串 `task_id`（S4 曾因此恒红）；
  //   改为「前一位不是 b」的 look-behind 等价写法（TS 目标无 lookbehind，用字符组）。
  return !/payload|content|reward|correct|answers|snowflake_id|(^|[^b])task_id/.test(blob);
};

/**
 * ③ 归属谓词：`map` = task_id → 子任务 id 序列（读口实际产出），`expect` = 同 shape 的期望。
 * **逐 task 精确相等**（集合 + 顺序）：多一个别家子任务 / 少一个自家子任务 / 顺序错 ⇒ false。
 */
const ownershipOk = (got: Record<string, string[]>, expect: Record<string, string[]>): boolean => {
  const keys = Object.keys(expect);
  if (Object.keys(got).length !== keys.length) return false;
  return keys.every((k) => JSON.stringify(got[k] ?? []) === JSON.stringify(expect[k]));
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

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p75_${tag}`;
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

const verbOf = (r: unknown): number => {
  const x = r as { ok?: boolean; status?: number };
  return x?.ok ? 200 : Number(x?.status ?? 0);
};
const viewOf = <T,>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;

/** 隔离用哨兵：只存在于 subtask.payload（quiz options 的选项文案 / correct 选题）—— 出参数组里出现即泄露 */
const SENTINEL_PAYLOAD = 'SENTINEL_OPTION_TEXT_P75';

const SUBTASKS_SQL_SLICE = svcSlice('const HOME_TASK_SUBTASKS_SQL', '`;');
const SUBTASKS_SQL = (SUBTASKS_SQL_SLICE.match(/`([\s\S]*?)`/) ?? ['', ''])[1] ?? '';
const MAIN_SQL = (svcSlice('const HOME_CAMPAIGN_TASKS_SQL', 'LIMIT 20`').match(/`([\s\S]*?)`/) ?? ['', ''])[1] ?? '';
const FN_BODY = (() => {
  const i = PROJ_SVC.indexOf('export const listHomeCampaignTasks');
  if (i < 0) return '';
  const j = PROJ_SVC.indexOf('\n};', i);
  return PROJ_SVC.slice(i, j < 0 ? i + 2000 : j + 3);
})();

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const ifaceSrc = svcSlice('export interface HomeTaskSubtask {', '}');
  const rowIfaceSrc = svcSlice('export interface HomeCampaignTaskRow {', '}');
  const ifaceKeys = (ifaceSrc.match(/^ {2}(\w+):/gm) ?? []).map((s) => s.trim().replace(/:.*$/, ''));
  ck.t('A1',
    '键面：`HomeTaskSubtask` **恰五键**（subtask_id / type_code / title / required / sort，无 payload / content / reward / correct）· `HomeCampaignTaskRow.subtasks: HomeTaskSubtask[]` **非可选**（类型层即「键恒在场」，无 `?`）',
    JSON.stringify(ifaceKeys.sort()) === JSON.stringify(['required', 'sort', 'subtask_id', 'title', 'type_code'])
      && /subtasks: HomeTaskSubtask\[\];/.test(rowIfaceSrc)
      && !/subtasks\?:/.test(rowIfaceSrc),
    JSON.stringify({ iface_keys: ifaceKeys.sort(), row_has_required_key: /subtasks: HomeTaskSubtask\[\];/.test(rowIfaceSrc) }));

  ck.t('A2',
    '★⑤ 无泄露（静态）：批量 SQL 只 SELECT 五列（task_id 仅归组用）· `payload` / `content` / `reward` / `correct` / `answers` 在 SQL 字面量里**零命中**（不是「取了再剥」，是根本不查）',
    leakFreeSql(SUBTASKS_SQL)
      && /s\.subtask_id::text\s+AS subtask_id/.test(SUBTASKS_SQL)
      && /s\.type_code\s+AS type_code/.test(SUBTASKS_SQL)
      && /s\.title\s+AS title/.test(SUBTASKS_SQL)
      && /s\.required\s+AS required/.test(SUBTASKS_SQL)
      && /s\.sort\s+AS sort/.test(SUBTASKS_SQL),
    JSON.stringify({ sql_chars: SUBTASKS_SQL.length, leak_tokens: (SUBTASKS_SQL.match(/payload|content|reward|correct|answers/gi) ?? []) }));

  ck.t('A3',
    '★排序与收口：`WHERE s.task_id = ANY(string_to_array($1::text, 「,」)::bigint[])`（只取本页 task 的子任务 —— 负控 N1 去掉此支 ⇒ 臂③ 必红）· `ORDER BY s.task_id ASC, s.sort ASC, s.subtask_id ASC`（同 sort 由 id 定序 ⇒ 前端顺序稳定）',
    /WHERE s\.task_id = ANY\(string_to_array\(\$1::text, ','\)::bigint\[\]\)/.test(SUBTASKS_SQL)
      && /ORDER BY s\.task_id ASC, s\.sort ASC, s\.subtask_id ASC/.test(SUBTASKS_SQL),
    JSON.stringify({ where: /WHERE s\.task_id = ANY/.test(SUBTASKS_SQL), order: /sort ASC, s\.subtask_id ASC/.test(SUBTASKS_SQL) }));

  ck.t('A4',
    '★④ 零 N+1（静态）：函数体内查询**恰 2 次**（行集 1 + 子任务批量 1，与行数无关）· 无 `for..of tasks` / 异步 `map` / `Promise.all` 包裹查询 · 归组在内存 `Map` 里 · 空行集早退（0 行 ⇒ 第二条语句不发）',
    zeroNPlusOne(FN_BODY)
      && /if \(tasks\.length === 0\) return \[\];/.test(FN_BODY)
      && /byTask\.get\(t\.task_id\) \?\? \[\]/.test(FN_BODY),
    JSON.stringify({
      query_awaits: (FN_BODY.match(/await\s+readRows</g) ?? []).length,
      loops: /for\s*\(/.test(FN_BODY), body_chars: FN_BODY.length,
    }));

  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const homeBlock = routeBlock("app.get('/api/home/campaign-tasks'", 400);
  ck.t('A5',
    '★路由面零改动：注册点仍 **109**（get 49 / post 54 / patch 4 / delete 3 / put 0）· 读口仍 `listHomeCampaignTasks()` → `setPublicCache(res)`（30s 公共缓存语义不变）→ `sendSuccess` · 块内零 `requireActor` · 异常仍 `sendInfraMapped(res, 「home.campaign_tasks」)`（零新错误码）',
    regs === 110 && countVerb('get') === 49 && countVerb('post') === 54 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0
      && homeBlock.length > 0 && !/requireActor/.test(homeBlock)
      && /listHomeCampaignTasks\(\)/.test(homeBlock) && /setPublicCache\(res\)/.test(homeBlock)
      && /sendInfraMapped\(res, 'home\.campaign_tasks'/.test(homeBlock),
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete'), put: countVerb('put') }));

  const homeApi = routeBlock("app.get('/api/home',", 400);
  const prizeAll = routeBlock("app.get('/api/prize/all',", 400);
  const callSites = (INDEX_TS.match(/listHomeCampaignTasks/g) ?? []).length;
  ck.t('A6',
    '同源读口零影响：`listHomeCampaignTasks` 在路由层**恰 2 处**（import + 本读口调用）⇒ 只此一口受益 · `GET /api/home` 与 `GET /api/prize/all` 块内零 `listHomeCampaignTasks` / 零 `HOME_TASK_SUBTASKS_SQL`（不连带改动）· 主 SQL `LIMIT 20` 与三处公开过滤逐字不变',
    callSites === 2
      && homeApi.length > 0 && prizeAll.length > 0
      && !/listHomeCampaignTasks|HOME_TASK_SUBTASKS_SQL/.test(homeApi)
      && !/listHomeCampaignTasks|HOME_TASK_SUBTASKS_SQL/.test(prizeAll)
      && /LIMIT 20/.test(MAIN_SQL)
      && /WHERE c\.status = 'active'/.test(MAIN_SQL) && /AND t\.status <> 'draft'/.test(MAIN_SQL)
      && /AND pr\.status <> 'ended'/.test(MAIN_SQL),
    JSON.stringify({ call_sites: callSites, main_has_limit20: /LIMIT 20/.test(MAIN_SQL) }));

  // ======================================================================== B + S + N · 事务内（单回滚）
  const pool = mkPool(2);
  const committedBefore = {
    tasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.task'))[0]?.n ?? -1),
    subtasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.subtask'))[0]?.n ?? -1),
    campaigns: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1),
    projects: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1),
    migrations: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.schema_migration'))[0]?.n ?? -1),
  };
  out.committed_before = committedBefore;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as TxClient;
    const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => raw1<T>(c, sql, params);

    // ---- 夹具：owner + 项目 + 活动 + 三个任务（T1 三条子任务 / T2 两条（同 sort 定序）/ T3 无子任务）
    const owner = await q1<{ uid: string }>(
      `INSERT INTO public.users (uid, evm, bio)
       VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
       ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
       RETURNING uid::text AS uid`,
      [909951, `p75-gate fixture ${RUN}`]);
    const OWNER = Number(owner?.uid ?? 0);
    const fee = BigInt(await currentCreateFee());
    await postEvent({
      op: 'mint', uid: String(OWNER), cid: '1', amount: (fee * 2n + 5000n).toString(), platform: true,
      idempotencyKey: `ops:p75-gate:${RUN}:mint`, memo: 'p75-gate usd fixture', ex,
    });

    const createdProj = await createProjectVerb({
      actorUid: OWNER,
      body: {
        title: `p75 gate project ${RUN}`, slug: `p75a${Math.random().toString(36).slice(2, 8)}`,
        description: 'p75 gate', headcount: 2, recruit_min_account_days: 0,
        wage_batt_per_claim: '10', wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p75-${RUN}-proj`,
      ex,
    });
    const P_A = String(viewOf<{ project_id?: string }>(createdProj).project_id ?? '');
    console.error('[p75][dbg] proj', JSON.stringify(createdProj).slice(0, 160));
    const createdCamp = await createCampaignVerb({ body: { title: `p75 campaign ${RUN}`, project_id: P_A }, ex });
    console.error('[p75][dbg] camp', JSON.stringify(createdCamp).slice(0, 160));
    const C_A = String(viewOf<{ campaign_id?: string }>(createdCamp).campaign_id ?? '');
    await patchCampaignVerb({ ref: C_A, body: { status: 'active' }, ex });

    // T1：三条子任务，写入顺序故意乱（sort 30 / 10 / 20）⇒ 读口必须按 sort 升序重排
    const t1 = await createTaskVerb({
      campaignRef: C_A,
      body: {
        title: `p75 task A ${RUN}`, description: 'p75 gate A', reward_amount_primary: '10',
        subtasks: [
          {
            type_code: 'quiz', title: '甲一 答题', sort: 30, required: true, reward_amount: '5',
            payload: { options: { a: '甲', b: SENTINEL_PAYLOAD, c: '丙', d: '丁' }, correct: ['b'] },
          },
          { type_code: 'survey', title: '甲二 问卷', sort: 10, required: false, payload: { answers: { q2: 'no' } } },
          {
            type_code: 'x_verify', title: '甲三 截图', sort: 20, required: true,
            payload: { screenshots: ['https://example.com/p75.png'] },
          },
        ],
      },
      ex,
    });
    const T1 = String(viewOf<{ task_id?: string }>(t1).task_id ?? '');
    console.error('[p75][dbg] t1', JSON.stringify(t1).slice(0, 160));
    // T2：两条子任务 **同 sort** ⇒ 由 subtask_id ASC 定序（顺序判据的第二维）
    const t2 = await createTaskVerb({
      campaignRef: C_A,
      body: {
        title: `p75 task B ${RUN}`, description: 'p75 gate B', reward_amount_primary: '7',
        subtasks: [
          { type_code: 'onchain_snapshot', title: '乙一 快照', sort: 5, payload: { snapshot_addr: '0xabc' } },
          { type_code: 'survey', title: '乙二 问卷', sort: 5, payload: { answers: { q: 'yes' } } },
        ],
      },
      ex,
    });
    const T2 = String(viewOf<{ task_id?: string }>(t2).task_id ?? '');
    // T3：**零子任务** ⇒ 读口必须给 `[]`（键在场）
    const t3 = await createTaskVerb({
      campaignRef: C_A,
      body: { title: `p75 task C ${RUN}`, description: 'p75 gate C', reward_amount_primary: '3', subtasks: [] },
      ex,
    });
    const T3 = String(viewOf<{ task_id?: string }>(t3).task_id ?? '');
    for (const t of [T1, T2, T3]) await patchTaskVerb({ ref: t, body: { status: 'active' }, ex });

    const dbSubs = async (taskId: string) => raw<HomeTaskSubtask>(c,
      `SELECT subtask_id::text AS subtask_id, type_code AS type_code, title AS title,
              required AS required, sort AS sort
         FROM public.subtask
        WHERE task_id = $1::bigint
        ORDER BY sort ASC, subtask_id ASC`, [taskId]);
    const expectT1 = await dbSubs(T1);
    const expectT2 = await dbSubs(T2);
    const expectT3 = await dbSubs(T3);
    R.fixture = {
      owner: OWNER, project_id: P_A, campaign_id: C_A,
      tasks: { T1, T2, T3 },
      subtask_counts: { T1: expectT1.length, T2: expectT2.length, T3: expectT3.length },
    };
    const canon = (items: HomeTaskSubtask[] | undefined) => JSON.stringify((items ?? []).map((s) => [
      s.subtask_id, s.type_code, s.title, s.required, s.sort,
    ]));
    const canonDb = (items: HomeTaskSubtask[]) => JSON.stringify(items.map((s) => [
      String(s.subtask_id), String(s.type_code), String(s.title), s.required === true, Number(s.sort),
    ]));

    // ==================================================================== S · 服务层真路径
    R.fixture_probe = { t1_count: expectT1.length, t2_count: expectT2.length, t3_count: expectT3.length };
    const rows = await listHomeCampaignTasks(ex);
    const byId = new Map(rows.map((x) => [x.task_id, x]));
    const r1 = byId.get(T1);
    const r2 = byId.get(T2);
    const r3 = byId.get(T3);
    R.read = {
      rows: rows.length,
      first: rows[0]?.task_id ?? null,
      hit_subtasks: { T1: r1?.subtasks ?? null, T2: r2?.subtasks ?? null, T3: r3?.subtasks ?? null },
    };

    // ---- ① 逐项对拍（id / type / title / required / sort + 顺序）
    ck.t('S1',
      `★臂① 逐项对拍：有子任务的 task 行（T1 三条 / T2 两条）\`subtasks\` 与库内 \`ORDER BY sort ASC, subtask_id ASC\` **逐项逐字相等**（id / type_code / title / required / sort，写入顺序 30/10/20 ⇒ 出参 10/20/30 已重排；同 sort 两条由 subtask_id 定序）`,
      r1 !== undefined && r2 !== undefined
        && canon(r1.subtasks) === canonDb(expectT1)
        && canon(r2.subtasks) === canonDb(expectT2),
      JSON.stringify({ t1_read: canon(r1?.subtasks), t1_db: canonDb(expectT1), t2_read: canon(r2?.subtasks), t2_db: canonDb(expectT2) }));

    // ---- ② 无子任务 ⇒ [] 且键在场
    ck.t('S2',
      '★臂② 无子任务 ⇒ `[]` 且**键在场**：T3 无任何 subtask 行 ⇒ 出参 `subtasks` = `[]`、`Object.prototype.hasOwnProperty(「subtasks」)` = true（**不省略键** —— 前端 `row.subtasks.length` 免空判断）',
      r3 !== undefined && Array.isArray(r3.subtasks) && r3.subtasks.length === 0
        && Object.prototype.hasOwnProperty.call(r3, 'subtasks'),
      JSON.stringify({ T3: r3 === undefined ? 'NO_ROW' : { subtasks: r3.subtasks, has_key: Object.prototype.hasOwnProperty.call(r3, 'subtasks') } }));

    // ---- ③ 多 task 多子任务归属正确（谓词正控）
    const gotMap: Record<string, string[]> = {
      [T1]: (r1?.subtasks ?? []).map((s) => s.subtask_id),
      [T2]: (r2?.subtasks ?? []).map((s) => s.subtask_id),
      [T3]: (r3?.subtasks ?? []).map((s) => s.subtask_id),
    };
    const expectMap: Record<string, string[]> = {
      [T1]: expectT1.map((s) => String(s.subtask_id)),
      [T2]: expectT2.map((s) => String(s.subtask_id)),
      [T3]: expectT3.map((s) => String(s.subtask_id)),
    };
    const ownOk = ownershipOk(gotMap, expectMap);
    const crossTalk = rows.some((x) => x.subtasks.some((s) => ![T1, T2, T3].includes(x.task_id) && true));
    const titleCrosstalk = rows
      .filter((x) => [T1, T2, T3].includes(x.task_id))
      .some((x) => x.subtasks.some((s) => {
        const ownerOfTitle = [T1, T2, T3].find((t) => (t === T1 ? expectT1 : t === T2 ? expectT2 : expectT3)
          .some((e) => String(e.title) === String(s.title)));
        return ownerOfTitle !== undefined && ownerOfTitle !== x.task_id;
      }));
    ck.t('S3',
      '★臂③ 多 task 多子任务**归属正确（不串行）**：T1 三条 / T2 两条 / T3 零条 ⇒ 每行 `subtasks` 的 id 序列与该行 task 的子任务**精确相等**（`ownershipOk` 同一谓词）· 全局：零别家标题串入（T1 拿不到 T2 的「乙一 快照」、T2 拿不到「甲一 答题」）· 三行互不重叠',
      r1 !== undefined && r2 !== undefined && r3 !== undefined
        && ownOk && crossTalk === false && titleCrosstalk === false
        && (r1.subtasks.length === 3 && r2.subtasks.length === 2 && r3.subtasks.length === 0),
      JSON.stringify({ got: gotMap, expect: expectMap, own_ok: ownOk, title_crosstalk: titleCrosstalk }));

    // ---- ⑤ 无泄露（出参面）
    const allItems: Array<Record<string, unknown>> = [r1, r2, r3]
      .flatMap((x) => (x?.subtasks ?? [])) as unknown as Array<Record<string, unknown>>;
    const blob = JSON.stringify(allItems);
    ck.t('S4',
      '★臂⑤ 无泄露：每条子任务**恰 5 键**（required 布尔 / sort 数字 / 三串）· 序列化后 `payload` / `content` / `reward` / `correct` / `answers` / `snowflake_id` 零命中 · **哨兵值**（只存在于 quiz payload 的 options / correct）零出现 ⇒ 题库答案不外流',
      leakFreeOut(allItems) && allItems.length === 5
        && !blob.includes(SENTINEL_PAYLOAD),
      JSON.stringify({ items: allItems.length, keys: allItems[0] ? Object.keys(allItems[0]) : [], sentinel_hit: blob.includes(SENTINEL_PAYLOAD) }));

    // ---- 读口既有语义不变（LIMIT 20 / 首行 = 最新 / 空集）
    ck.t('S5',
      '既有语义零改动：行数 ≤ 20（`LIMIT 20` 承重）· 首行 = 最新任务（`time_created DESC` —— T3 最后建 ⇒ 首行）· 行内既有 16 键全在（`subtasks` 之外的键一个不少）',
      rows.length > 0 && rows.length <= 20 && rows[0]?.task_id === T3
        && ['task_id', 'title', 'description', 'status', 'joined_count', 'campaign_id', 'campaign_title',
          'project_id', 'project_title', 'project_slug', 'project_avatar_url',
          'reward_amount_primary', 'reward_cid_secondary', 'reward_amount_secondary', 'time_start', 'time_end']
          .every((k) => Object.prototype.hasOwnProperty.call(rows[0] ?? {}, k)),
      JSON.stringify({ rows: rows.length, first: rows[0]?.task_id ?? null, t3: T3 }));

    // ---- 空集臂：无 active 活动 ⇒ [] （且第二条语句不发 —— 静态早退已在 A4）
    const emptyArm = await undoAfter(c, 'empty', async () => {
      await c.query(`UPDATE public.campaign SET status = 'draft' WHERE status <> 'draft'`);
      const er = await listHomeCampaignTasks(ex);
      return { len: er.length, isArray: Array.isArray(er) };
    });
    const emptyVal = emptyArm.value as { len: number; isArray: boolean } | null;
    ck.t('S6',
      '读口空集臂：无 active 活动 ⇒ `[]`（200 语义，不 404/500）且零行时**不再发第二条语句**（`tasks.length === 0` 早退）',
      emptyArm.sqlstate === null && emptyVal !== null && emptyVal.isArray && emptyVal.len === 0,
      JSON.stringify({ arm: emptyVal, sqlstate: emptyArm.sqlstate }));

    // ==================================================================== N · 负控（同一谓词必红）
    // N1 · 聚合改成「不按 task_id 过滤」（漏掉 s.task_id = t.task_id ⇒ 交叉连接）
    const mutatedJoinSql = `
      SELECT t.task_id::text    AS task_id,
             s.subtask_id::text AS subtask_id,
             s.type_code        AS type_code,
             s.title            AS title,
             s.required         AS required,
             s.sort             AS sort
        FROM public.task AS t
        JOIN public.subtask AS s ON TRUE
       WHERE t.task_id = ANY(string_to_array($1::text, ',')::bigint[])
       ORDER BY t.task_id ASC, s.sort ASC, s.subtask_id ASC`;
    const n1 = await undoAfter(c, 'crossjoin', async () => {
      const mutated = await raw<HomeTaskSubtask & { task_id: string }>(c, mutatedJoinSql, [[T1, T2, T3].join(',')]);
      const got: Record<string, string[]> = { [T1]: [], [T2]: [], [T3]: [] };
      for (const row of mutated) got[String(row.task_id)]?.push(String(row.subtask_id));
      return { got, ok: ownershipOk(got, expectMap), t3_len: got[T3].length, t1_has_t2: got[T1].some((id) => expectMap[T2].includes(id)) };
    });
    const n1v = n1.value as { got: Record<string, string[]>; ok: boolean; t3_len: number; t1_has_t2: boolean } | null;
    ck.t('N1',
      '★负控① 臂③ 承重：把聚合改成「取全部子任务、不按 task_id 过滤」（`JOIN public.subtask ON TRUE` ⇒ 每个 task 拿到全表子任务）⇒ **同一 `ownershipOk` 谓词 false**、T3（本该 `[]`）非空、T1 里出现 T2 的子任务 id ⇒ **臂③ 必红**（拿掉归属条件就当场暴露）',
      n1.sqlstate === null && n1v !== null && n1v.ok === false && n1v.t3_len > 0 && n1v.t1_has_t2 === true,
      JSON.stringify({ ...(n1v ? { ok: n1v.ok, t3_len: n1v.t3_len, t1_has_t2: n1v.t1_has_t2 } : {}), sqlstate: n1.sqlstate }));

    // N2 · 泄露负控：SQL 多取 payload / reward 列 ⇒ 臂⑤ 谓词 false 且哨兵真泄
    const mutatedLeakSql = SUBTASKS_SQL.replace(
      's.sort             AS sort',
      's.sort             AS sort,\n         s.payload          AS payload,\n         s.reward_amount::text AS reward_amount',
    );
    const n2 = await undoAfter(c, 'leak', async () => {
      const leaked = await raw<Record<string, unknown>>(c, mutatedLeakSql, [[T1].join(',')]);
      const list = leaked.map((row) => ({
        subtask_id: String(row.subtask_id), type_code: String(row.type_code), title: String(row.title),
        required: row.required === true, sort: Number(row.sort),
        ...(row.payload !== undefined ? { payload: row.payload } : {}),
        ...(row.reward_amount !== undefined ? { reward_amount: row.reward_amount } : {}),
      }));
      return {
        ok: leakFreeOut(list), sentinel: JSON.stringify(list).includes(SENTINEL_PAYLOAD),
        keys: list[0] ? Object.keys(list[0]).sort() : [],
      };
    });
    const n2v = n2.value as { ok: boolean; sentinel: boolean; keys: string[] } | null;
    ck.t('N2',
      '★负控② 臂⑤ 承重：批量 SQL 多取 `payload` / `reward_amount` ⇒ 元素键集 ≠ 5 键 ⇒ **同 `leakFreeOut` 谓词 false**，且 quiz 哨兵答案（`correct` 内值）**真出现**在出参里 ⇒ 泄露检测非空转（臂⑤ 必红）',
      n2.sqlstate === null && n2v !== null && n2v.ok === false && n2v.sentinel === true,
      JSON.stringify({ ...(n2v ?? {}), sqlstate: n2.sqlstate }));

    // N3 · 零 N+1 负控：函数体注入逐 task 回查 ⇒ 臂④ 谓词 false
    const mutatedBody = FN_BODY.replace(
      'const subRows = await readRows<Row>(HOME_TASK_SUBTASKS_SQL',
      'for (const t of tasks) { await readRows<Row>(HOME_TASK_SUBTASKS_SQL, [t.task_id], ex); }\n  const subRows = await readRows<Row>(HOME_TASK_SUBTASKS_SQL',
    );
    ck.t('N3',
      '★负控③ 臂④ 承重：函数体注入「逐 task 回查」（`for (const t of tasks) await readRows(...)` = 典型 N+1）⇒ **同 `zeroNPlusOne` 谓词 false**（查询次数 3 且循环包裹）· 真函数体 true ⇒ 「回归成 N+1」必被静态判据抓住',
      mutatedBody !== FN_BODY && zeroNPlusOne(FN_BODY) === true && zeroNPlusOne(mutatedBody) === false,
      JSON.stringify({ real_ok: zeroNPlusOne(FN_BODY), mutated_ok: zeroNPlusOne(mutatedBody), mutated_chars: mutatedBody.length }));

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
    const now = {
      tasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.task'))[0]?.n ?? -1),
      subtasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.subtask'))[0]?.n ?? -1),
      campaigns: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1),
      projects: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1),
      migrations: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.schema_migration'))[0]?.n ?? -1),
    };
    ck.t('Z1',
      `零残留：task ${committedBefore.tasks} / subtask ${committedBefore.subtasks} / campaign ${committedBefore.campaigns} / project ${committedBefore.projects} / schema_migration ${committedBefore.migrations} 行数**前后相等**（夹具全在单回滚事务内；本门零 apply / 零 DDL）`,
      now.tasks === committedBefore.tasks && now.subtasks === committedBefore.subtasks
        && now.campaigns === committedBefore.campaigns && now.projects === committedBefore.projects
        && now.migrations === committedBefore.migrations,
      JSON.stringify({ before: committedBefore, after: now }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p75-home-task-subtasks-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
