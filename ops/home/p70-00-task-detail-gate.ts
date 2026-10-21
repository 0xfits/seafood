/**
 * p70-00 · 任务详情读口（`GET /api/campaign/task/:taskId`）· 门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p63/p69 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/home/p70-00-task-detail-gate.ts
 * 读数：`ops/home/readings/p70-task-detail-gate-<RUN>.json`
 *
 * 派单面（本门逐条守住）：每个 campaign task 有自己的页面 `/task/:taskId`，后端给一个**公开读口**：
 *   · 形状扁平（task 十一键 ＋ `joined_count` ＋ 可选 `headcount` ＋ `campaign{3}` ＋ `project{5}`
 *     ＋ `subtasks[]{7}`），零嵌套整份 campaign；bigint / numeric 一律 `::text` 字符串；
 *   · 公开面 = 与首页热门任务读口 `listHomeCampaignTasks` **逐字同口径**
 *     （`c.status='active' ∧ t.status<>'draft' ∧ pr.status<>'ended'`）；
 *   · 非公开（draft / ended 任一）⇒ 对匿名与第三方 **404 `LEDGER_REF_NOT_FOUND`**
 *     （`details.reason='task_not_public'`，借码零新码）；owner（`project.owner_uid`=本人）∨
 *     `manage_tasks` 管理员 ⇒ **同一形状** 200（同一读口按身份放宽）；
 *   · `joined_count = count(DISTINCT subtask_proof.uid)`（同一人在 2 个子任务各有凭证 ⇒ 仍算 1 人）；
 *   · 注册点 129 → **130**（get 56 → 57）；零新错误码；写口一字不动。
 *
 * 判据面：
 *   A · 静态（零 DB）：注册点 130 逐 verb · 新口接线（公开 / 缓存分流 / 404 reason / 基建映射）·
 *       零新错误码（33 码闭集不动 + 借码 404）· 读口 SQL 面（单语句三表 JOIN / 双形态 ref /
 *       `count(DISTINCT p.uid)` / 子任务排序）· 可见性纯函数三支 · 出参键集（15 / 3 / 5 / 7）。
 *   S · 服务层真路径（同事务 · `ex` 注入）：公开可见臂（字段全齐 · `joined_count`=2 而凭证 3 行 ·
 *       `headcount`=2 · 子任务 2 条）· draft 匿名 ⇒ null · draft owner ⇒ 200 同形状 · draft 管理员 ⇒ 200 ·
 *       draft 第三方登录 ⇒ null · 不存在 ⇒ null · ended 项目 ⇒ 匿名 null / owner 200 ·
 *       campaign 非 active ⇒ 匿名 null · snowflake ref 与 task_id 等价。
 *   H · **真 HTTP 臂**（本进程起 app · 端口 0 · 零夹具）：`/api/campaign/task/<不存在>` ⇒ 404
 *       `ref_type='task'` + `reason='task_not_public'`（证明路由已注册、参数解析到位、且**未**被
 *       末尾 catch-all 吞成 `route_not_found`）· 非数字 ref ⇒ 404 `task_not_found` · 错误体不得带公共缓存头。
 *   N · **负控**：① 去掉 draft 闸 ⇒ 匿名可读 draft（mutant 谓词转 true）⇒ 本门必红；② 去掉 ended 闸
 *       ⇒ 匿名可读 ended 项目任务 ⇒ 必红；③ `DISTINCT` 承重（`count(*)`=3 ≠ `joined_count`=2）⇒ 去
 *       DISTINCT 必红；④ 静态判据可证伪（源码文本被变异后，A3/A4 的谓词自己转 false）。
 *   Z · 残留：全程单回滚事务；project / campaign / task / subtask / subtask_proof 行数与
 *       schema_migration 版本行均不变；HTTP 臂只读、零写。
 *
 * ★ 边界（诚实登记）：**不提交夹具**（本仓纪律：夹具必须在回滚事务内）⇒ 公开面 200 的「真 HTTP」臂
 *   由「服务层真路径（S1）＋ 路由接线静态断言（A1）」两面合证；HTTP 面只跑零夹具的 404 三臂。
 *
 * 纪律：不写库、不 apply、不 push、不动 frontend；凭据只读 `backend-ts/.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  createCampaignVerb,
  createTaskVerb,
  getTaskDetailByRef,
  isTaskPubliclyVisible,
  patchCampaignVerb,
  patchTaskVerb,
} from '../../backend-ts/src/campaign-service';
import type { TaskDetailView } from '../../backend-ts/src/campaign-service';
import { createProjectVerb, currentCreateFee } from '../../backend-ts/src/project-service';
import { postEvent } from '../../backend-ts/src/ledger';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';

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
const CAMP_SVC = readSrc('backend-ts/src/campaign-service.ts');

/** 路由块切片（静态接线断言用；**截到下一个注册点**，避免把相邻 handler 的 requireActor 误读进来） */
const routeBlock = (startMarker: string, maxLen = 4000): string => {
  const i = INDEX_TS.indexOf(startMarker);
  if (i < 0) return '';
  const rest = INDEX_TS.slice(i + startMarker.length);
  const next = rest.search(/\napp\.(get|post|put|delete|patch)\(/);
  const end = next < 0 ? i + startMarker.length + maxLen : i + startMarker.length + next;
  return INDEX_TS.slice(i, Math.min(end, i + maxLen));
};
/** 服务层块切片（键集 / SQL 字面量断言用） */
const svcSlice = (start: string, end: string): string => {
  const i = CAMP_SVC.indexOf(start);
  if (i < 0) return '';
  const j = CAMP_SVC.indexOf(end, i);
  return CAMP_SVC.slice(i, j < 0 ? i + 3000 : j + end.length);
};

const TASK_DETAIL_SQL_BLOCK = svcSlice('const TASK_DETAIL_SQL', '`;');
/** 可见性纯函数整块（★ 不能按第一个分号切 —— 函数签名里的类型注解就有分号） */
const VISIBILITY_BLOCK = svcSlice('export const isTaskPubliclyVisible', "!== 'ended';");

/** 注册点计数（逐字 = p7b-03 `AC10-2` / p69 `A5` 口径） */
const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;

/** 判据的**可证伪性**自检：源码文本被变异后，同一谓词必须自己转 false */
const visibilitySourceOk = (src: string): boolean =>
  /campaign_status\) === 'active'/.test(src)
  && /task_status\) !== 'draft'/.test(src)
  && /project_status\) !== 'ended'/.test(src);
const distinctOk = (sql: string): boolean => /count\(DISTINCT p\.uid\)/.test(sql);

const STATIC_KEYS = [
  'campaign', 'description', 'headcount', 'joined_count', 'project', 'reward_amount_primary',
  'reward_amount_secondary', 'reward_cid_secondary', 'sort', 'status', 'subtasks', 'task_id',
  'time_end', 'time_start', 'title',
].sort();
const CAMPAIGN_KEYS = ['id', 'status', 'title'].sort();
const PROJECT_KEYS = ['avatar_url', 'id', 'slug', 'status', 'title'].sort();
const SUBTASK_KEYS = ['content', 'payload', 'required', 'sort', 'subtask_id', 'title', 'type_code'].sort();

const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p70_${tag}`;
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

const viewOf = <T,>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;

/** 负控用 mutant：与真实谓词**只差一条闸**（去掉 ⇒ 必红） */
const mutantNoDraftGate = (x: { task_status: string; campaign_status: string; project_status: string }) =>
  x.campaign_status === 'active' && x.project_status !== 'ended';
const mutantNoEndedGate = (x: { task_status: string; campaign_status: string; project_status: string }) =>
  x.campaign_status === 'active' && x.task_status !== 'draft';

const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v as Record<string, unknown>).sort() : []);
const sameKeys = (a: string[], b: string[]) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const block = routeBlock("app.get('/api/campaign/task/:taskId'");
  ck.t('A1',
    '★路由面：注册点 **130**（get 57 / post 66 / patch 4 / delete 3 / put 0）· 新口 `GET /api/campaign/task/:taskId` 在场且**公开**（块内零 `requireActor`）· 身份只经 `resolveOptionalCampaignViewer`（与 R2 同源）· 非数字 ref ⇒ 404 `task_not_found` · view=null ⇒ 404 `task_not_public` · 公开面 `setPublicCache(res)` / 非公开面 `setPrivateNoStore(res)` **分流**（draft 绝不进 CDN）· `sendSuccess(res, view, …)` · 异常走 `sendInfraMapped(res, \'campaign.task.detail\')`',
    regs === 130 && countVerb('get') === 57 && countVerb('post') === 66 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0
      && block.length > 0
      && !/requireActor\(/.test(block) && !/requireAdmin\(/.test(block)
      && /resolveOptionalCampaignViewer\(req\)/.test(block)
      && /getTaskDetailByRef\(ref, \{ includeDraft: viewer\.admin, actorUid: viewer\.viewerUid \}\)/.test(block)
      && /sendRefNotFound\(res, 'task', ref, 'task_not_found'\)/.test(block)
      && /sendRefNotFound\(res, 'task', ref, 'task_not_public'\)/.test(block)
      && /setPublicCache\(res\)/.test(block) && /setPrivateNoStore\(res\)/.test(block)
      && /isTaskPubliclyVisible\(\{/.test(block)
      && /sendSuccess\(res, view, 'Campaign task detail \(public\)'\)/.test(block)
      && /sendInfraMapped\(res, 'campaign\.task\.detail'/.test(block),
    JSON.stringify({
      regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'),
      delete: countVerb('delete'), block_bytes: block.length,
    }));

  const codesInSvc = Array.from(new Set((CAMP_SVC.match(/'(LEDGER_[A-Z_]+|AUTH_[A-Z_]+)'/g) ?? []).map((s) => s.slice(1, -1))));
  const BORROWED_CODES = ['LEDGER_AMOUNT_INVALID', 'LEDGER_REF_NOT_FOUND', 'LEDGER_INSUFFICIENT_BALANCE', 'AUTH_FORBIDDEN'];
  ck.t('A2',
    '★零新错误码：错误码闭集仍 **33** 值（`LEDGER_ERROR_CODES`）· 活动域源码里出现的码字面量 **⊆ 既有借码四值**（`LEDGER_AMOUNT_INVALID` / `LEDGER_REF_NOT_FOUND` / `LEDGER_INSUFFICIENT_BALANCE` / `AUTH_FORBIDDEN`）· 本口只借 404 `LEDGER_REF_NOT_FOUND`，逐场景理由落 `details.reason`（`task_not_found` / `task_not_public`，reason 不进闭集）',
    LEDGER_ERROR_CODES.length === 33
      && codesInSvc.every((x) => BORROWED_CODES.includes(x))
      && /sendRefNotFound\(res, 'task', ref, 'task_not_public'\)/.test(INDEX_TS)
      && /sendRefNotFound\(res, 'task', ref, 'task_not_found'\)/.test(INDEX_TS)
      && !/TASK_NOT_PUBLIC/.test(CAMP_SVC),
    JSON.stringify({ codes: LEDGER_ERROR_CODES.length, svc_codes: codesInSvc }));

  ck.t('A3',
    '★读口 SQL 面：**单语句**归属链（`FROM public.task t JOIN public.campaign c … JOIN public.project pr …`，零 N+1）· 双形态 ref（`t.task_id = $1::bigint OR t.snowflake_id = $1::bigint`）· `count(DISTINCT p.uid)` 去重人数（相关子查询走 `subtask_proof ⋈ subtask`）· bigint/numeric 出参 `::text`（task_id / campaign_id / project_id / 三个 reward）· 子任务 `ORDER BY s.sort ASC, s.subtask_id ASC` 全序',
    /FROM public\.task AS t/.test(TASK_DETAIL_SQL_BLOCK)
      && /JOIN public\.campaign AS c/.test(TASK_DETAIL_SQL_BLOCK)
      && /JOIN public\.project\s+AS pr/.test(TASK_DETAIL_SQL_BLOCK)
      && /t\.task_id = \$1::bigint OR t\.snowflake_id = \$1::bigint/.test(TASK_DETAIL_SQL_BLOCK)
      && /count\(DISTINCT p\.uid\)::int/.test(TASK_DETAIL_SQL_BLOCK)
      && /t\.task_id::text/.test(TASK_DETAIL_SQL_BLOCK) && /t\.reward_amount_primary::text/.test(TASK_DETAIL_SQL_BLOCK)
      && /c\.campaign_id::text/.test(TASK_DETAIL_SQL_BLOCK) && /pr\.project_id::text/.test(TASK_DETAIL_SQL_BLOCK)
      && /pr\.owner_uid::text/.test(TASK_DETAIL_SQL_BLOCK) && /pr\.headcount::int/.test(TASK_DETAIL_SQL_BLOCK)
      && /ORDER BY s\.sort ASC, s\.subtask_id ASC/.test(CAMP_SVC),
    JSON.stringify({
      one_stmt: /FROM public\.task AS t/.test(TASK_DETAIL_SQL_BLOCK),
      distinct: distinctOk(TASK_DETAIL_SQL_BLOCK),
      dual_ref: /snowflake_id = \$1::bigint/.test(TASK_DETAIL_SQL_BLOCK),
    }));

  ck.t('A4',
    '★可见性：纯函数 `isTaskPubliclyVisible` 三支逐字（`campaign_status === \'active\'` ∧ `task_status !== \'draft\'` ∧ `project_status !== \'ended\'`，与首页读口同口径）· 服务层用**同一函数**决策（非公开 ⇒ 仅 `includeDraft` 管理员 ∨ `project_owner_uid` = 本人，其余返回 null）',
    visibilitySourceOk(VISIBILITY_BLOCK)
      && /const publicVisible = isTaskPubliclyVisible\(\{/.test(CAMP_SVC)
      && /const owner = typeof uid === 'number'/.test(CAMP_SVC)
      && /String\(uid\) === str\(row\.project_owner_uid\)/.test(CAMP_SVC)
      && /if \(!\(opts\.includeDraft \|\| owner\)\) return null;/.test(CAMP_SVC),
    JSON.stringify({ visibility_block: VISIBILITY_BLOCK.replace(/\s+/g, ' ').slice(0, 220) }));

  ck.t('A5',
    '★出参形状：顶层 **15 键**（task 十一键 ＋ `joined_count` ＋ `headcount` ＋ `campaign` ＋ `project` ＋ `subtasks`）· `campaign` 恰 3 键（id/title/status）· `project` 恰 5 键（id/title/slug/avatar_url/status）· `subtasks[]` 恰 7 键（无 `status` 键 —— 0065 CP-3 逐字：subtask 无 status 列）· `headcount` 为**条件键**（库内无值 ⇒ 键缺省）· `joined_count` 恒 `int()`（零凭证 ⇒ 0，不造 null）',
    /joined_count: int\(row\.joined_count\)/.test(CAMP_SVC)
      && /headcount === null \? \{\} : \{ headcount \}/.test(CAMP_SVC)
      && /campaign: \{\s*id: str\(row\.campaign_id\),\s*title: str\(row\.campaign_title\),\s*status: str\(row\.campaign_status\),/.test(CAMP_SVC.replace(/\n\s*/g, ' '))
      && /project: \{\s*id: str\(row\.project_id\),\s*title: str\(row\.project_title\),\s*slug: str\(row\.project_slug\),\s*avatar_url: strOrNull\(row\.project_avatar_url\),\s*status: str\(row\.project_status\),/.test(CAMP_SVC.replace(/\n\s*/g, ' '))
      && !/status: str\(s\.status\)/.test(CAMP_SVC),
    'shape ok');

  // ======================================================================== B + S · 事务内
  const pool = mkPool(2);
  const committedBefore = {
    projects: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -1),
    campaigns: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -1),
    tasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.task'))[0]?.n ?? -1),
    subtasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.subtask'))[0]?.n ?? -1),
    proofs: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.subtask_proof'))[0]?.n ?? -1),
    migrations: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.schema_migration'))[0]?.n ?? -1),
  };
  out.committed_before = committedBefore;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as TxClient;
    const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => raw1<T>(c, sql, params);

    // ---- 夹具：项目 owner ＋ 两个参与者
    const uids: number[] = [];
    for (const base of [909801, 909802, 909803]) {
      const row = await q1<{ uid: string }>(
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p70-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [OWNER, FAN1, FAN2] = uids;
    R.fixture_users = uids;
    const fee = BigInt(await currentCreateFee());
    await postEvent({
      op: 'mint', uid: String(OWNER), cid: '1', amount: (fee * 2n + 5000n).toString(), platform: true,
      idempotencyKey: `ops:p70-gate:${RUN}:mint`, memo: 'p70-gate usd fixture', ex,
    });

    const createdProj = await createProjectVerb({
      actorUid: OWNER,
      body: {
        title: `p70 gate project ${RUN}`, slug: `p70a${Math.random().toString(36).slice(2, 8)}`,
        description: 'p70 gate', headcount: 2, recruit_min_account_days: 0,
        wage_batt_per_claim: '10', wage_cid: null, wage_currency_amount: null, wage_interval_hours: 1,
      },
      headerKey: `cli:p70-${RUN}-proj`,
      ex,
    });
    const P_A = String(viewOf<{ project_id?: string }>(createdProj).project_id ?? '');
    const createdCamp = await createCampaignVerb({ body: { title: `p70 campaign ${RUN}`, project_id: P_A }, ex });
    const C_A = String(viewOf<{ campaign_id?: string }>(createdCamp).campaign_id ?? '');
    const createdTask = await createTaskVerb({
      campaignRef: C_A,
      body: {
        title: `p70 task ${RUN}`, description: '任务详情页夹具描述', reward_amount_primary: '10', sort: 3,
        subtasks: [
          { type_code: 'quiz', title: '答题一', content: '内容一', payload: { answers: { q1: 'yes' } }, sort: 1, required: true },
          { type_code: 'survey', title: '问卷二', payload: { answers: { q2: 'no' } }, sort: 2 },
        ],
      },
      ex,
    });
    const T_A = String(viewOf<{ task_id?: string }>(createdTask).task_id ?? '');
    await patchCampaignVerb({ ref: C_A, body: { status: 'active' }, ex });
    await patchTaskVerb({ ref: T_A, body: { status: 'active' }, ex });
    const taskSnow = String((await q1<{ s: string }>(
      'SELECT snowflake_id::text AS s FROM public.task WHERE task_id = $1::bigint', [T_A]))?.s ?? '');

    // 凭证：subtask1 ← FAN1 + FAN2、subtask2 ← FAN1 ⇒ **3 行 / 2 个去重人**（DISTINCT 承重）
    const subs = await raw<{ subtask_id: string }>(c,
      'SELECT subtask_id::text AS subtask_id FROM public.subtask WHERE task_id = $1::bigint ORDER BY subtask_id', [T_A]);
    for (const [i, s] of subs.entries()) {
      const provers = i === 0 ? [FAN1, FAN2] : [FAN1];
      for (const uid of provers) {
        await c.query(
          `INSERT INTO public.subtask_proof (subtask_id, uid, payload, status)
           VALUES ($1::bigint, $2::bigint, '{}'::jsonb, 'submitted')
           ON CONFLICT (subtask_id, uid) DO NOTHING`, [s.subtask_id, String(uid)]);
      }
    }
    const proofRows = Number((await q1<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.subtask_proof p
         JOIN public.subtask s ON s.subtask_id = p.subtask_id WHERE s.task_id = $1::bigint`, [T_A]))?.n ?? -1);
    R.fixture = { project_id: P_A, campaign_id: C_A, task_id: T_A, snowflake_id: taskSnow, proofs: proofRows, subtasks: subs.length };

    // ==================================================================== S1 · 公开可见臂（active 任务）
    const pub = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: null }, ex);
    const topKeys = keysOf(pub);
    const sub0 = pub?.subtasks?.[0];
    const sub1 = pub?.subtasks?.[1];
    ck.t('S1',
      `★公开可见臂（= 路由 200 的唯一决策点）：匿名读 active 任务 ⇒ **有 view** · 顶层 15 键齐无缺无多 · \`title\`/\`description\`/\`status='active'\`/\`sort=3\`/\`reward_amount_primary='10'\` 逐字 · \`joined_count\`=**2**（3 行凭证 / 2 个去重人 ⇒ DISTINCT 承重）· \`headcount\`=2（项目额定人数）· \`campaign\`{${CAMPAIGN_KEYS.join(',')}} · \`project\`{${PROJECT_KEYS.join(',')}} · \`subtasks\` 2 条、每条 7 键、\`sort\` 升序、\`payload\` 原样透出、\`required\` 布尔`,
      pub !== null
        && sameKeys(topKeys, STATIC_KEYS)
        && pub.title === `p70 task ${RUN}`
        && pub.description === '任务详情页夹具描述'
        && pub.status === 'active'
        && pub.sort === 3
        && pub.reward_amount_primary === '10'
        && pub.reward_cid_secondary === null && pub.reward_amount_secondary === null
        && pub.joined_count === 2
        && pub.headcount === 2
        && sameKeys(keysOf(pub.campaign), CAMPAIGN_KEYS)
        && pub.campaign.id === C_A && pub.campaign.title === `p70 campaign ${RUN}` && pub.campaign.status === 'active'
        && sameKeys(keysOf(pub.project), PROJECT_KEYS)
        && pub.project.id === P_A && pub.project.slug.startsWith('p70a') && pub.project.status === 'recruiting'
        && pub.subtasks.length === 2
        && sameKeys(keysOf(sub0), SUBTASK_KEYS) && sameKeys(keysOf(sub1), SUBTASK_KEYS)
        && sub0.type_code === 'quiz' && sub0.title === '答题一' && sub0.content === '内容一'
        && sub0.sort === 1 && sub0.required === true
        && JSON.stringify(sub0.payload) === JSON.stringify({ answers: { q1: 'yes' } })
        && sub1.type_code === 'survey' && sub1.required === false && sub1.content === null,
      JSON.stringify({
        view: pub, keys: topKeys, proofs: proofRows,
        dist_ok: pub?.joined_count === 2,
      }));

    // ==================================================================== S2 · draft 三面
    const draftArm = await undoAfter(c, 'draft', async () => {
      await c.query(`UPDATE public.task SET status = 'draft' WHERE task_id = $1::bigint`, [T_A]);
      const anon = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: null }, ex);
      const third = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: FAN1 }, ex);
      const owner = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: OWNER }, ex);
      const admin = await getTaskDetailByRef(T_A, { includeDraft: true, actorUid: null }, ex);
      return { anon, third, owner, admin };
    });
    const da = draftArm.value as { anon: TaskDetailView | null; third: TaskDetailView | null; owner: TaskDetailView | null; admin: TaskDetailView | null } | null;
    ck.t('S2',
      '★负面（draft 匿名）：任务置 `draft` ⇒ 匿名读 **null**（路由落 404 `LEDGER_REF_NOT_FOUND` + `reason=\'task_not_public\'`，与「不存在」同形 ⇒ 不泄露存在性）',
      draftArm.sqlstate === null && da !== null && da.anon === null,
      JSON.stringify({ anon: da?.anon ?? 'null', sqlstate: draftArm.sqlstate }));

    ck.t('S3',
      '★放宽面（draft owner）：`actorUid = project.owner_uid` ⇒ **200 同形状**（同一读口、15 键齐、`status=\'draft\'`、`joined_count` 仍 2）⇒ owner 不是第二套字段面',
      da !== null && da.owner !== null
        && sameKeys(keysOf(da.owner), STATIC_KEYS)
        && da.owner.status === 'draft'
        && da.owner.joined_count === 2
        && sameKeys(keysOf(da.owner.campaign), CAMPAIGN_KEYS)
        && sameKeys(keysOf(da.owner.project), PROJECT_KEYS)
        && da.owner.subtasks.length === 2,
      JSON.stringify({ owner_keys: keysOf(da?.owner ?? null), status: da?.owner?.status ?? null }));

    ck.t('S4',
      '★放宽面（draft 管理员）：`includeDraft=true`（谓词 = `can_access_admin ∧ (is_admin ∨ manage_tasks)`，路由层同源）⇒ 200 同形状（即便非 owner）',
      da !== null && da.admin !== null && sameKeys(keysOf(da.admin), STATIC_KEYS) && sameKeys(keysOf(da.owner ?? null), keysOf(da.admin)),
      JSON.stringify({ admin_keys: keysOf(da?.admin ?? null) }));

    ck.t('S5',
      '★闸承重（draft 第三方）：登录但**既非 owner 亦非管理员**（FAN1）⇒ null ⇒ 「登录」本身不是可见性（draft 不被普通会话读到）',
      da !== null && da.third === null,
      JSON.stringify({ third: da?.third ?? 'null' }));

    // ==================================================================== S6 · 不存在 / snowflake
    const missing = await getTaskDetailByRef('9999999999', { includeDraft: true, actorUid: OWNER }, ex);
    const badRef = await getTaskDetailByRef('not-a-number', { includeDraft: true, actorUid: OWNER }, ex);
    ck.t('S6',
      '不存在臂：任务 id 不存在（管理员身份也一样）⇒ `null` · 非数字 ref ⇒ `null`（路由层 `isCampaignRef` 先拦 ⇒ 404 `task_not_found`，绝不 500 —— route #60）',
      missing === null && badRef === null,
      JSON.stringify({ missing, bad_ref: badRef }));

    const bySnow = await getTaskDetailByRef(taskSnow, { includeDraft: false, actorUid: null }, ex);
    ck.t('S7',
      '双形态 ref：`snowflake_id` 与 `task_id` 读到**同一任务**（task_id 逐字相同、`joined_count` 相同）⇒ 对外标识与内务主键等价',
      bySnow !== null && bySnow.task_id === T_A && bySnow.joined_count === 2,
      JSON.stringify({ by_snow: bySnow?.task_id ?? null, expect: T_A }));

    // ==================================================================== S8 · ended 项目
    const endedProj = await undoAfter(c, 'ended_proj', async () => {
      await c.query(`UPDATE public.project SET status = 'ended' WHERE project_id = $1::bigint`, [P_A]);
      const anon = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: null }, ex);
      const owner = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: OWNER }, ex);
      return { anon, owner, ownerStatus: owner?.project.status ?? null };
    });
    const ep = endedProj.value as { anon: TaskDetailView | null; owner: TaskDetailView | null; ownerStatus: string | null } | null;
    ck.t('S8',
      '★负面（ended 项目）：项目置 `ended`（活动/任务仍 active）⇒ 匿名 **null** ⇒ 404（`project_status !== \'ended\'` 承重；删这一支 ⇒ 本臂必红）· owner 仍 200（放宽面覆盖 ended）且 `project.status` 逐字 `ended`',
      endedProj.sqlstate === null && ep !== null && ep.anon === null
        && ep.owner !== null && ep.ownerStatus === 'ended',
      JSON.stringify({ anon: ep?.anon ?? 'null', owner_status: ep?.ownerStatus, sqlstate: endedProj.sqlstate }));

    // ==================================================================== S9 · campaign 非 active
    const endedCamp = await undoAfter(c, 'ended_camp', async () => {
      await c.query(`UPDATE public.campaign SET status = 'ended' WHERE campaign_id = $1::bigint`, [C_A]);
      const anon = await getTaskDetailByRef(T_A, { includeDraft: false, actorUid: null }, ex);
      const admin = await getTaskDetailByRef(T_A, { includeDraft: true, actorUid: null }, ex);
      return { anon, admin };
    });
    const ec = endedCamp.value as { anon: TaskDetailView | null; admin: TaskDetailView | null } | null;
    ck.t('S9',
      '★负面（campaign 非 active / ended）：活动收口 ⇒ 匿名 **null**（`campaign_status === \'active\'` 承重；与首页读口同口径）· 管理员仍 200',
      endedCamp.sqlstate === null && ec !== null && ec.anon === null && ec.admin !== null,
      JSON.stringify({ anon: ec?.anon ?? 'null', admin_ok: ec?.admin !== null }));

    // ==================================================================== N · 负控（纯函数 mutant）
    const draftTuple = { task_status: 'draft', campaign_status: 'active', project_status: 'recruiting' };
    const endedTuple = { task_status: 'active', campaign_status: 'active', project_status: 'ended' };
    ck.t('N1',
      '★负控①（draft 闸）：真实谓词对 draft 任务 = false；**去掉 draft 闸的 mutant** = true ⇒ 「删掉 draft 闸 ⇒ 匿名可读 draft」这一变异必被本门抓住（本臂即红）',
      isTaskPubliclyVisible(draftTuple) === false && mutantNoDraftGate(draftTuple) === true,
      JSON.stringify({ real: isTaskPubliclyVisible(draftTuple), mutant: mutantNoDraftGate(draftTuple) }));

    ck.t('N2',
      '★负控②（ended 闸）：真实谓词对 ended 项目任务 = false；去掉 ended 闸的 mutant = true ⇒ 删这一支必红',
      isTaskPubliclyVisible(endedTuple) === false && mutantNoEndedGate(endedTuple) === true,
      JSON.stringify({ real: isTaskPubliclyVisible(endedTuple), mutant: mutantNoEndedGate(endedTuple) }));

    // N3 · DISTINCT 承重（DB 实测）：3 行凭证 / 2 人
    const counts = await q1<{ rows: number; people: number }>(
      `SELECT count(*)::int AS rows,
              count(DISTINCT p.uid)::int AS people
         FROM public.subtask_proof p
         JOIN public.subtask s ON s.subtask_id = p.subtask_id
        WHERE s.task_id = $1::bigint`, [T_A]);
    ck.t('N3',
      '★负控③（DISTINCT 承重）：同任务 **3 行凭证 / 2 个去重人** ⇒ `count(*)`=3 ≠ `joined_count`=2；把 SQL 的 `count(DISTINCT p.uid)` 改成 `count(p.uid)` ⇒ 读口出 3，本门读数对不上必红',
      Number(counts?.rows) === 3 && Number(counts?.people) === 2 && Number(counts?.people) !== Number(counts?.rows),
      JSON.stringify(counts ?? {}));

    // N4 · 静态判据可证伪（变异源码文本 ⇒ 同一谓词自己转 false）
    const mutatedVisibility = CAMP_SVC.replace(/&& str\(input\.task_status\) !== 'draft'/, '&& true');
    const mutatedSqlBlock = TASK_DETAIL_SQL_BLOCK.replace(/count\(DISTINCT p\.uid\)/, 'count(p.uid)');
    ck.t('N4',
      '★负控④（静态判据可证伪）：源码文本里删掉 `task_status !== \'draft\'` ⇒ A4 谓词转 false；把 `count(DISTINCT p.uid)` 改成 `count(p.uid)` ⇒ A3 谓词转 false ⇒ 本门的静态臂不是同义反复',
      visibilitySourceOk(VISIBILITY_BLOCK) === true
        && visibilitySourceOk(mutatedVisibility) === false
        && distinctOk(TASK_DETAIL_SQL_BLOCK) === true
        && distinctOk(mutatedSqlBlock) === false,
      JSON.stringify({
        vis_real: visibilitySourceOk(VISIBILITY_BLOCK),
        vis_mutated: visibilitySourceOk(mutatedVisibility),
        distinct_real: distinctOk(TASK_DETAIL_SQL_BLOCK),
        distinct_mutated: distinctOk(mutatedSqlBlock),
      }));

    R.committed_touch = 'none (single rollback tx)';
    return R;
  });

  if (r.error) {
    out.tx_error = String((r.error as { message?: string })?.message ?? r.error);
    ck.t('X', '事务内全链执行未抛未预期异常', false, `error=${out.tx_error}`);
  } else {
    out.readings = r.result;
  }

  // ======================================================================== H · 真 HTTP 臂（零夹具）
  // 起本进程内 app（`VERCEL=1` ⇒ index.ts 不 listen；我们自己挂到端口 0）⇒ 只打「零夹具」的 404 三臂。
  try {
    process.env.VERCEL = '1';
    const mod = await import('../../backend-ts/src/index');
    const app = (mod as { default: { listen: (p: number, cb?: () => void) => unknown } }).default;
    const server = app.listen(0) as unknown as {
      address: () => { port: number } | null;
      close: (cb?: () => void) => void;
      once: (ev: string, cb: () => void) => void;
    };
    await new Promise<void>((resolve) => { server.once('listening', resolve); setTimeout(resolve, 5000); });
    const port = server.address()?.port ?? 0;
    const base = `http://127.0.0.1:${port}`;
    const getJson = async (p: string) => {
      const res = await fetch(`${base}${p}`);
      const body = await res.json() as Record<string, unknown>;
      return { status: res.status, cache: res.headers.get('cache-control') ?? '', body };
    };
    const h1 = await getJson('/api/campaign/task/9999999999');
    const h2 = await getJson('/api/campaign/task/not-a-number');
    const err1 = (h1.body.error ?? {}) as { code?: string; details?: Record<string, unknown> };
    const err2 = (h2.body.error ?? {}) as { code?: string; details?: Record<string, unknown> };
    ck.t('H1',
      '★真 HTTP（不存在臂）：`GET /api/campaign/task/9999999999` ⇒ **404** · `error.code = LEDGER_REF_NOT_FOUND` · `details.ref_type=\'task\'`、`details.reason=\'task_not_public\'` ⇒ 证明**路由已注册**（不是末尾 catch-all 的 `route_not_found`）且参数解析到位',
      h1.status === 404 && err1.code === 'LEDGER_REF_NOT_FOUND'
        && String(err1.details?.ref_type ?? '') === 'task'
        && String(err1.details?.reason ?? '') === 'task_not_public',
      JSON.stringify({ status: h1.status, error: err1 }));

    ck.t('H2',
      '★真 HTTP（非数字 ref）：`GET /api/campaign/task/not-a-number` ⇒ **404** `reason=\'task_not_found\'`（`isCampaignRef` 前置拦截，不进服务层、不 500）· 错误响应**不带**公共缓存头（不得缓存错误体）',
      h2.status === 404 && err2.code === 'LEDGER_REF_NOT_FOUND'
        && String(err2.details?.reason ?? '') === 'task_not_found'
        && !/public/.test(h1.cache) && !/public/.test(h2.cache),
      JSON.stringify({ status: h2.status, error: err2, cache: [h1.cache, h2.cache] }));

    await new Promise<void>((resolve) => server.close(() => resolve()));
    out.http = { port, h1: { status: h1.status, error: err1 }, h2: { status: h2.status, error: err2 } };
  } catch (e) {
    ck.t('H1', '★真 HTTP 臂（不存在 ⇒ 404 task_not_public）', false, `error=${String((e as Error).message ?? e)}`);
    ck.t('H2', '★真 HTTP 臂（非数字 ref ⇒ 404 task_not_found）', false, `error=${String((e as Error).message ?? e)}`);
  }

  // ======================================================================== Z · 残留（rollback 之后）
  if (!r.error) {
    const now = {
      projects: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.project'))[0]?.n ?? -2),
      campaigns: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.campaign'))[0]?.n ?? -2),
      tasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.task'))[0]?.n ?? -2),
      subtasks: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.subtask'))[0]?.n ?? -2),
      proofs: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.subtask_proof'))[0]?.n ?? -2),
      migrations: Number((await qRetry<{ n: number }>(pool, 'SELECT count(*)::int AS n FROM public.schema_migration'))[0]?.n ?? -2),
    };
    ck.t('Z1',
      `零残留：project ${committedBefore.projects} / campaign ${committedBefore.campaigns} / task ${committedBefore.tasks} / subtask ${committedBefore.subtasks} / subtask_proof ${committedBefore.proofs} / schema_migration ${committedBefore.migrations} 行数**不变**（夹具全在单回滚事务内）`,
      now.projects === committedBefore.projects && now.campaigns === committedBefore.campaigns
        && now.tasks === committedBefore.tasks && now.subtasks === committedBefore.subtasks
        && now.proofs === committedBefore.proofs && now.migrations === committedBefore.migrations,
      JSON.stringify({ before: committedBefore, after: now }));

    const fixtureLeft = Number((await qRetry<{ n: number }>(pool,
      `SELECT count(*)::int AS n FROM public.users WHERE bio LIKE $1`, [`p70-gate fixture ${RUN}%`]))[0]?.n ?? -2);
    ck.t('Z2',
      '零残留（用户面）：本门夹具 uid（909801/909802/909803）**不存在**于 committed 面 ⇒ 回滚彻底',
      fixtureLeft === 0,
      JSON.stringify({ fixture_users_left: fixtureLeft }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p70-task-detail-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings, http: out.http }, null, 1));
  process.exit((out.summary as { failed: number }).failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
