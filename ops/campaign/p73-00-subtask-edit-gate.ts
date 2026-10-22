/**
 * p73-00 · 子任务编辑 / 发布后冻结 / 删除 · 门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p65/p70/p72 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/campaign/p73-00-subtask-edit-gate.ts
 * 读数：`ops/campaign/readings/p73-subtask-edit-gate-<RUN>.json`
 *
 * 派单面（Kevin 2026-10-22 三条裁定，本门逐条守住）：
 *   ① **子任务只能内联于 task 写口增 / 改 / 删** ⇒ 零新路由、零新码、零新表；删除只走闭集键
 *      `subtasks_remove: number[]`（上限 20、去重、均须属本 task、与同请求 `subtasks[]` 不相交 ⇒ 相交 400）。
 *   ② **prediction 发布即冻结**：父 task 非 draft（含「本请求同一笔把 draft 推成 active」的**生效态**）⇒
 *      prediction 子任务只许改 `sort` / `required`，改 title / content / payload / type_code 一律
 *      409 `prediction_locked_after_publish`。判据是**值是否变化**（`canonicalJson` 逐值比），不是键是否出现。
 *   ③ **有凭证不删**：目标子任务存在 `subtask_proof` 行（prediction 的票同表同闸）⇒ 409 `subtask_has_proofs`；
 *      非本 task ⇒ 404 `subtask_not_in_task`；prediction 在非 draft 下**允许删**（无票时）。
 *      upsert 与 remove 同事务（任一侧失败 ⇒ 全回滚，不留半笔）。
 *
 * 判据面：
 *   A1 · 闭集键：create 九键不动、patch = 九键 + `status` + `subtasks_remove`（建口带删除键 ⇒ 400；子任务项闭集九键不动）
 *   A2 · 上限 / 去重 / 相交：`SUBTASK_REMOVE_MAX`=20 · 21 项 ⇒ 400 · 去重保序 · 与 `subtasks[]` 相交 ⇒ 400 `SUBTASK_REMOVE_OVERLAP`
 *   A3 · 零新路由 / 零新码：注册点仍 109（九口在场，delete 仍 3）· 错误码闭集仍 33 · ledger kind 仍 24
 *   A4 · 源码承重位：值比较（`canonicalJson`）＋ `published = nextStatus !== 'draft'`（生效态）＋ 锁闸在 UPDATE 之前
 *        ＋ 凭证闸在 DELETE 之前 ＋ 删除与 upsert 同事务（同一 `runInTx`）
 *   S1 · 编辑真路径：title / content / payload / reward_amount 改后**读回**，`subtask_id` 保留、条数不变
 *   S2 · 锁定三臂：draft 改 payload ⇒ 200 · active 改 payload ⇒ 409 `prediction_locked_after_publish`（`changed_fields` 含 payload）·
 *        active 只改 `sort` ⇒ 200（锁不是禁改排期）
 *   S3 · 删除三臂：无凭证 ⇒ 行消失 · 有凭证 ⇒ 409 `subtask_has_proofs`（行仍在）· 非本 task ⇒ 404 `subtask_not_in_task`
 *   S4 · 同事务：合法 upsert ＋ 非法 remove（他 task 的 id）⇒ 404 且**标题未被写**（零半笔）
 *   S5 · 不留窗口：同一请求 `draft → active` ＋ 改 prediction payload ⇒ 409，库内仍 draft、payload 未动
 *   S6 · 无损等值旁路（臂①）：active 上**存量四键行**按「读口两键」同值重发（金额同值、deadline 同一 instant 的
 *        `+00:00` 写法）⇒ 200、payload 仍恰四键（`option_a`/`option_b` 零丢失）、`time_updated` 不变；同请求的
 *        其它子任务照常落库；对称支（新两键行收旧四键、文案恰 Yes / No）⇒ 同样 200 零变更；文案变 ⇒ 400
 *   S7 · 值真变 ⇒ 409（臂②）：legacy 行按两键改金额 / 改 deadline ⇒ 409 `prediction_locked_after_publish`
 *        （`changed_fields` 含 payload、零写入）；**负控**：旁路改成「任意新两键都放行」⇒ 200 ⇒ 本臂必红，
 *        且放行是真丢数据（两键覆盖写把 `option_a`/`option_b` 抹掉，旧行 `a|b` 口径不可逆）
 *   S8 · draft 下同值重发（臂③）：draft 的 legacy 行两键同值重发 ⇒ 200 零变更（`time_updated` 不变、非删建）；
 *        同一 draft 行改金额 ⇒ 仍 400 `PREDICTION_OPTION_STYLE_IMMUTABLE`（口径不可换原规则照旧）
 *   N1 · 负控①：库面直写可改 prediction payload（无库面锁）⇒ 409 的唯一屏障是服务层锁闸；去锁闸 ⇒ S2 断言必红
 *   N2 · 负控②：库面直删可抹掉有凭证的子任务（CASCADE 连 proof 一起没）⇒ 409 的唯一屏障是凭证闸；去闸 ⇒ S3 断言必红
 *   Z  · 残留：全程单回滚事务；subtask / subtask_proof / ledger_entry / users / schema_migration 行数**事务前 = 事务后**
 *
 * 纪律：**不 apply、不写版本表、不 push、不动 frontend/docs**；一切 DML 与夹具都在回滚事务内，
 *   会抛的臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  SUBTASK_REMOVE_MAX,
  createCampaignVerb,
  createTaskVerb,
  getTaskDetailById,
  parseTaskPayload,
  patchTaskVerb,
} from '../../backend-ts/src/campaign-service';
import { LEDGER_KINDS } from '../../backend-ts/src/ledger';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'readings');
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const SVC = readSrc('backend-ts/src/campaign-service.ts');

const out: Record<string, unknown> = {};
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p73_${tag}`;
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
const changedOf = (r: unknown): string[] =>
  (((r as { details?: { changed_fields?: unknown } })?.details?.changed_fields ?? []) as string[]);
const viewOf = <T = Record<string, unknown>>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;
const errOf = (x: unknown): unknown =>
  (x && typeof x === 'object' && 'err' in (x as Record<string, unknown>) ? (x as { err: unknown }).err : x);

const ck = checker();
const FUTURE = new Date(Date.now() + 3600 * 1000).toISOString();
type Row = Record<string, unknown>;

(async () => {
  // ======================================================================== A · 静态（零 DB）
  const createKeys = (SVC.match(/const TASK_CREATE_KEYS = \[([\s\S]{0,300}?)\];/) ?? [])[0] ?? '';
  const patchKeys = (SVC.match(/const TASK_PATCH_KEYS = \[([^\]]*)\];/) ?? [])[1] ?? '';
  const createWithRemove = errOf(parseTaskPayload(
    { title: 't', reward_amount_primary: '1', subtasks_remove: ['1'] }, 'create'));
  const patchUnknown = errOf(parseTaskPayload({ subtasks_removed: ['1'] }, 'patch'));
  const subtaskItemUnknown = errOf(parseTaskPayload({
    subtasks: [{ type_code: 'x_verify', title: 't', payload: { screenshots: [] }, option_style: 'yes_no' }],
  }, 'patch'));
  ck.t('A1', '★闭集键：建口仍**九键**且**不含** `subtasks_remove`（建口带删除键 ⇒ 400 `NOT_SUPPORTED`）· 改口 = 九键 + `status` + `subtasks_remove`（拼装处逐字在场）· 子任务项闭集仍九键（塞 `option_style` 等旁键 ⇒ 400 `SUBTASK_INPUT_INVALID`）· 拼错键名（`subtasks_removed`）⇒ 400',
    createKeys.length > 0 && !/subtasks_remove/.test(createKeys)
      && /'subtasks_remove'/.test(patchKeys) && /'status'/.test(patchKeys)
      && /const TASK_PATCH_KEYS = \[\.\.\.TASK_CREATE_KEYS, 'status', 'subtasks_remove'\];/.test(SVC)
      && verbOf(createWithRemove) === 400 && reasonOf(createWithRemove) === 'NOT_SUPPORTED'
      && verbOf(patchUnknown) === 400 && reasonOf(patchUnknown) === 'NOT_SUPPORTED'
      && verbOf(subtaskItemUnknown) === 400 && reasonOf(subtaskItemUnknown) === 'SUBTASK_INPUT_INVALID'
      && /const legal = \['subtask_id', 'snowflake_id', 'type_code', 'title', 'content', 'payload', 'sort', 'required', 'reward_amount'\];/.test(SVC),
    JSON.stringify({
      create_keys: createKeys.length, patch_has_remove: /'subtasks_remove'/.test(patchKeys),
      create_with_remove: [verbOf(createWithRemove), reasonOf(createWithRemove)],
      typo_key: [verbOf(patchUnknown), reasonOf(patchUnknown)],
      item_side_key: [verbOf(subtaskItemUnknown), reasonOf(subtaskItemUnknown)],
    }));

  const ok20 = parseTaskPayload({ subtasks_remove: Array.from({ length: 20 }, (_, i) => String(i + 1)) }, 'patch');
  const over = errOf(parseTaskPayload({ subtasks_remove: Array.from({ length: 21 }, (_, i) => String(i + 1)) }, 'patch'));
  const dup = parseTaskPayload({ subtasks_remove: ['7', '7', '8'] }, 'patch');
  const overlap = errOf(parseTaskPayload({
    subtasks: [{ subtask_id: '7', type_code: 'x_verify', title: 't', payload: { screenshots: [] } }],
    subtasks_remove: ['7'],
  }, 'patch'));
  const badShape = errOf(parseTaskPayload({ subtasks_remove: 'abc' }, 'patch'));
  const zeroId = errOf(parseTaskPayload({ subtasks_remove: ['0'] }, 'patch'));
  ck.t('A2', '★上限 / 去重 / 相交：`SUBTASK_REMOVE_MAX` = **20**（恰 20 项通过、21 项 ⇒ 400 `SUBTASK_REMOVE_LIMIT`）· 重复 id **去重保序**（`["7","7","8"] ⇒ ["7","8"]`，不报错也不重复删）· 与同请求 `subtasks[]` 的 id **相交 ⇒ 400 `SUBTASK_REMOVE_OVERLAP`**（语义二义 ⇒ 拒收，不是择一）· 非数组 / 非正整数 ⇒ 400 `SUBTASK_REMOVE_INVALID`',
    SUBTASK_REMOVE_MAX === 20
      && !('err' in ok20) && (ok20.payload.subtasks_remove ?? []).length === 20
      && verbOf(over) === 400 && reasonOf(over) === 'SUBTASK_REMOVE_LIMIT'
      && !('err' in dup) && JSON.stringify(dup.payload.subtasks_remove) === JSON.stringify(['7', '8'])
      && verbOf(overlap) === 400 && reasonOf(overlap) === 'SUBTASK_REMOVE_OVERLAP'
      && verbOf(badShape) === 400 && reasonOf(badShape) === 'SUBTASK_REMOVE_INVALID'
      && verbOf(zeroId) === 400 && reasonOf(zeroId) === 'SUBTASK_REMOVE_INVALID'
      && /if \(ids\.length > SUBTASK_REMOVE_MAX\)/.test(SVC)
      && /const overlap = ids\.filter\(\(id\) => upsertIds\.has\(id\)\)/.test(SVC),
    JSON.stringify({
      max: SUBTASK_REMOVE_MAX, ok20: (!('err' in ok20) ? (ok20.payload.subtasks_remove ?? []).length : 'err'),
      over: [verbOf(over), reasonOf(over)], dup: (!('err' in dup) ? dup.payload.subtasks_remove : 'err'),
      overlap: [verbOf(overlap), reasonOf(overlap)], shape: [verbOf(badShape), reasonOf(badShape)], zero: [verbOf(zeroId), reasonOf(zeroId)],
    }));

  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const nine = [
    "app.get('/api/campaign/all'",
    "app.get('/api/campaign/:ref'",
    "app.post('/api/campaign/subtask/:subtaskId/proof'",
    "app.post('/api/campaign/subtask/:subtaskId/settle'",
    "app.post('/api/campaign'",
    "app.patch('/api/campaign/:campaignId'",
    "app.post('/api/campaign/:campaignId/task'",
    "app.patch('/api/campaign/task/:taskId'",
    "app.post('/api/campaign/task/:taskId/reward'",
  ];
  const newCodes = ['SUBTASK_REMOVE_INVALID', 'SUBTASK_REMOVE_LIMIT', 'SUBTASK_REMOVE_OVERLAP', 'subtask_has_proofs', 'prediction_locked_after_publish'];
  ck.t('A3', '★零新路由 / 零新码：注册点仍 **109**（get 49 / post 53 / patch 4 / delete 3 / put 0 —— 删除**没有**自己的路由）· 九口逐条在场 · 错误码闭集仍 **33**、ledger kind 仍 **24**：`SUBTASK_REMOVE_*` / `subtask_has_proofs` / `prediction_locked_after_publish` 全部只作 `details.reason`（不进闭集）',
    regs === 109 && countVerb('get') === 49 && countVerb('post') === 53 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0
      && nine.every((s) => INDEX_TS.indexOf(s) !== -1)
      && LEDGER_ERROR_CODES.length === 33 && LEDGER_KINDS.length === 24
      && !(LEDGER_ERROR_CODES as readonly string[]).some((x) => /SUBTASK_REMOVE|SUBTASK_HAS_PROOFS|PREDICTION_LOCKED/i.test(x))
      && newCodes.every((x) => SVC.includes(x)),
    JSON.stringify({
      regs, verbs: { get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete') },
      codes: LEDGER_ERROR_CODES.length, kinds: LEDGER_KINDS.length,
    }));

  const lockAt = SVC.indexOf('prediction_locked_after_publish');
  const proofAt = SVC.indexOf('subtask_has_proofs');
  const updateTaskAt = SVC.indexOf('`UPDATE public.task SET');
  const deleteAt = SVC.indexOf('DELETE FROM public.subtask WHERE subtask_id');
  ck.t('A4', '★源码承重位（锁 / 删 / 事务）：`published = nextStatus !== \'draft\'` ⇒ 判据取**生效态**（同请求 draft→active 不留窗口）· 变更判定是**值比较** `canonicalJson(item.payload) !== canonicalJson(asObject(owned.payload))`（不是键是否出现 ⇒ 只改排期不被误伤）· 白名单 `[\'sort\', \'required\']` · 锁闸在 `UPDATE public.task` **之前**、凭证闸在 `DELETE FROM public.subtask` **之前** · 删除与 upsert 同一 `runInTx`（零第二套写入面）',
    /const published = nextStatus !== 'draft';/.test(SVC)
      && /canonicalJson\(item\.payload\) !== canonicalJson\(asObject\(owned\.payload\)\)/.test(SVC)
      && /allowed_fields: \['sort', 'required'\]/.test(SVC)
      && lockAt > 0 && proofAt > 0 && updateTaskAt > 0 && deleteAt > 0
      && lockAt < updateTaskAt && proofAt < deleteAt
      && /const removeTargets: string\[\] = \[\];/.test(SVC)
      && /if \(!gone\.length\) return notFound\('subtask_not_in_task'\)/.test(SVC),
    JSON.stringify({
      published_effective: /const published = nextStatus !== 'draft';/.test(SVC),
      value_compare: /canonicalJson\(item\.payload\) !== canonicalJson/.test(SVC),
      order: { lock_before_update: lockAt < updateTaskAt, proof_before_delete: proofAt < deleteAt },
    }));

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  const committedResidue = async (): Promise<Record<string, number>> => {
    const one = async (sql: string): Promise<number> => Number((await qRetry<{ n: number }>(pool, sql))[0]?.n ?? -1);
    return {
      subtask: await one('SELECT count(*)::int AS n FROM public.subtask'),
      proofs: await one('SELECT count(*)::int AS n FROM public.subtask_proof'),
      ledger: await one('SELECT count(*)::int AS n FROM public.ledger_entry'),
      users: await one('SELECT count(*)::int AS n FROM public.users'),
      migrations: await one('SELECT count(*)::int AS n FROM public.schema_migration'),
    };
  };
  const baseline = await committedResidue();
  out.baseline = baseline;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as TxClient;
    const one = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> =>
      raw1<T>(c, sql, params);

    // ---- 夹具：用户 / 项目 / 活动
    const uids: number[] = [];
    for (const base of [973001, 973002]) {
      const row = await one<{ uid: string }>(
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p73-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [U1, U2] = uids;
    R.fixture_users = uids;
    let FIXPROJ = String((await one<{ project_id: string }>(
      `SELECT project_id::text AS project_id FROM public.project WHERE title = 'Sui 生态推广' ORDER BY project_id LIMIT 1`))?.project_id ?? '');
    if (!FIXPROJ) {
      FIXPROJ = String((await one<{ project_id: string }>(
        `INSERT INTO public.project
           (snowflake_id, owner_uid, title, slug, description, headcount, recruit_min_account_days,
            wage_batt_per_claim, wage_interval_hours, status)
         VALUES (9930000000000099, $1::bigint, 'p73 gate project', $2, 'p73-gate fixture', 5, 0, 10, 1, 'recruiting')
         RETURNING project_id::text AS project_id`,
        [String(U1), `p73-gate-${RUN.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`]))?.project_id ?? '');
    }
    R.fixture_project = FIXPROJ;
    const camp = await createCampaignVerb({ body: { title: `p73 活动 ${RUN}`, project_id: FIXPROJ, description: 'subtask edit gate' }, ex });
    const C = String(viewOf<{ campaign_id?: string }>(camp).campaign_id ?? '');
    R.fixture_campaign = C;

    /** 直插子任务（绕过写口 ⇒ 用来造「存量形状 / 有凭证」的前置态） */
    const insSub = async (taskId: string, snowflake: string, typeCode: string, title: string, payload: Row, sort: number): Promise<string> =>
      String((await one<{ subtask_id: string }>(
        `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title, payload, sort)
         VALUES ($1::bigint, $2::bigint, $3::text, $4::text, $5::jsonb, $6::int)
         RETURNING subtask_id::text AS subtask_id`,
        [snowflake, taskId, typeCode, title, JSON.stringify(payload), sort]))?.subtask_id ?? '');

    const subCount = async (taskId: string): Promise<number> => Number((await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.subtask WHERE task_id = $1::bigint', [taskId]))?.n ?? -1);
    const proofCount = async (subtaskId: string): Promise<number> => Number((await one<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint', [subtaskId]))?.n ?? -1);
    const dbSub = async (subtaskId: string): Promise<{ title: string; content: string | null; payload: Row; sort: number; reward_amount: string | null } | null> =>
      one<{ title: string; content: string | null; payload: Row; sort: number; reward_amount: string | null }>(
        `SELECT title, content, payload, sort, reward_amount::text AS reward_amount
           FROM public.subtask WHERE subtask_id = $1::bigint`, [subtaskId]);
    const dbTaskStatus = async (taskId: string): Promise<string> =>
      String((await one<{ status: string }>('SELECT status FROM public.task WHERE task_id = $1::bigint', [taskId]))?.status ?? '');

    // ==================================================================== S1 · 编辑真路径（title / content / payload / reward）
    const t1 = await createTaskVerb({
      campaignRef: C,
      body: {
        title: `S1 任务 ${RUN}`, description: 'edit', reward_amount_primary: '10',
        subtasks: [
          { type_code: 'quiz', title: '问答', reward_amount: '5', sort: 1,
            payload: { options: { a: '一', b: '二', c: '三', d: '四' }, correct: ['a'] } },
          { type_code: 'x_verify', title: 'X 验证', sort: 2,
            payload: { screenshots: ['m1'], links: ['https://x.com/a'] } },
        ],
      },
      ex,
    });
    const T1 = String(viewOf<{ task_id?: string }>(t1).task_id ?? '');
    const t1subs = viewOf<{ subtasks?: Array<Record<string, unknown>> }>(t1).subtasks ?? [];
    const Q1 = String(t1subs.find((s) => String(s.type_code) === 'quiz')?.subtask_id ?? '');
    const X1 = String(t1subs.find((s) => String(s.type_code) === 'x_verify')?.subtask_id ?? '');
    const editBack = await patchTaskVerb({
      ref: T1,
      body: {
        title: `S1 任务（改名）${RUN}`, description: 'edit-2',
        subtasks: [
          { subtask_id: Q1, type_code: 'quiz', title: '问答（改名）', content: '新题干', reward_amount: '8', sort: 1,
            payload: { options: { a: '甲', b: '乙', c: '丙', d: '丁' }, correct: ['b'] } },
          { subtask_id: X1, type_code: 'x_verify', title: 'X 验证（改名）', content: '新说明', sort: 2,
            payload: { screenshots: ['m2'], links: ['https://x.com/b'] } },
        ],
      },
      ex,
    });
    const read1 = await getTaskDetailById(T1, ex);
    const q1 = read1?.subtasks.find((s) => s.subtask_id === Q1);
    const x1 = read1?.subtasks.find((s) => s.subtask_id === X1);
    const q1db = await dbSub(Q1);
    ck.t('S1', '★编辑真路径（draft task，内联 upsert）：title / description / 子任务 title / content / payload / `reward_amount` 改后**读回全为新值**（quiz 奖励 5 → 8、options 文案换、x_verify screenshots 换）· `subtask_id` **保留**（同一行被 update 而非删建）· 子任务条数不变（2 → 2）',
      editBack.ok === true && T1 !== '' && Q1 !== '' && X1 !== ''
        && read1 !== null && read1.subtasks.length === 2
        && read1.title === `S1 任务（改名）${RUN}` && read1.description === 'edit-2'
        && q1 !== undefined && x1 !== undefined
        && q1.title === '问答（改名）' && q1.content === '新题干' && q1.reward_amount === '8'
        && JSON.stringify((q1.payload as Row).options) === JSON.stringify({ a: '甲', b: '乙', c: '丙', d: '丁' })
        && !('correct' in (q1.payload as Row))
        && JSON.stringify((x1.payload as Row).screenshots) === JSON.stringify(['m2'])
        && x1.content === '新说明'
        && q1db !== null && q1db.reward_amount === '8' && q1db.sort === 1,
      JSON.stringify({ ok: editBack.ok, task: { title: read1?.title, desc: read1?.description }, q1: q1 ?? null, x1: x1 ?? null, q1db: q1db ?? null }));

    // ==================================================================== S2 · 锁定三臂
    const t2 = await createTaskVerb({
      campaignRef: C,
      body: {
        title: `S2 任务 ${RUN}`, reward_amount_primary: '10',
        subtasks: [{ type_code: 'prediction', title: '预测', sort: 1, payload: { prize_amount: '10', deadline: FUTURE } }],
      },
      ex,
    });
    const T2 = String(viewOf<{ task_id?: string }>(t2).task_id ?? '');
    const P2 = String((viewOf<{ subtasks?: Array<Record<string, unknown>> }>(t2).subtasks ?? [])
      .find((s) => String(s.type_code) === 'prediction')?.subtask_id ?? '');
    // ① draft 可改
    const draftEdit = await patchTaskVerb({
      ref: T2,
      body: { subtasks: [{ subtask_id: P2, type_code: 'prediction', title: '预测（draft 改名）', payload: { prize_amount: '20', deadline: FUTURE } }] },
      ex,
    });
    const afterDraftEdit = await dbSub(P2);
    // 发布（active）
    const activated = await patchTaskVerb({ ref: T2, body: { status: 'active' }, ex });
    const statusActive = await dbTaskStatus(T2);
    // ② active 改 payload ⇒ 409
    const lockedPayload = await patchTaskVerb({
      ref: T2,
      body: { subtasks: [{ subtask_id: P2, type_code: 'prediction', title: '预测（active 改名）', payload: { prize_amount: '30', deadline: FUTURE } }] },
      ex,
    });
    const afterLocked = await dbSub(P2);
    // ③ active 只改 sort ⇒ 200
    const sortOnly = await patchTaskVerb({
      ref: T2,
      body: { subtasks: [{ subtask_id: P2, type_code: 'prediction', title: '预测（draft 改名）', payload: { prize_amount: '20', deadline: FUTURE }, sort: 5 }] },
      ex,
    });
    const afterSort = await dbSub(P2);
    ck.t('S2', '★锁定三臂：draft 上改 prediction payload（10 → 20）⇒ **200** 且落库 · 发布（active）后改 payload（→ 30）⇒ **409 `prediction_locked_after_publish`**、`changed_fields` 含 `payload`、库内仍 20（零半笔）· active 上**只改 `sort`**（payload 原值重发）⇒ **200**、sort 5、payload 仍 20（锁锁内容，不锁排期；值比较不是键出现）',
      draftEdit.ok === true && afterDraftEdit !== null && String(afterDraftEdit.payload.prize_amount) === '20'
        && activated.ok === true && statusActive === 'active'
        && verbOf(lockedPayload) === 409 && reasonOf(lockedPayload) === 'prediction_locked_after_publish'
        && changedOf(lockedPayload).includes('payload')
        && afterLocked !== null && String(afterLocked.payload.prize_amount) === '20' && afterLocked.title === '预测（draft 改名）'
        && sortOnly.ok === true && afterSort !== null && afterSort.sort === 5 && String(afterSort.payload.prize_amount) === '20',
      JSON.stringify({
        draft_edit: [draftEdit.ok, afterDraftEdit?.payload ?? null], active: [activated.ok, statusActive],
        locked: [verbOf(lockedPayload), reasonOf(lockedPayload), changedOf(lockedPayload)],
        after_locked: afterLocked ?? null, sort_only: [sortOnly.ok, afterSort?.sort ?? null],
      }));

    // ==================================================================== S3 · 删除三臂
    // active task 上加两枚 x_verify（一枚将被造出凭证）+ 一枚待删 prediction（无票 ⇒ 允许删）
    const xNoProof = await insSub(T2, '9930000000000001', 'x_verify', '无凭证', { screenshots: ['m'], links: [] }, 6);
    const xWithProof = await insSub(T2, '9930000000000002', 'x_verify', '有凭证', { screenshots: ['m'], links: [] }, 7);
    const predNoProof = await insSub(T2, '9930000000000003', 'prediction', '待删预测', { prize_amount: '5', deadline: FUTURE }, 8);
    await c.query(
      `INSERT INTO public.subtask_proof (subtask_id, uid, payload) VALUES ($1::bigint, $2::bigint, $3::jsonb)`,
      [xWithProof, String(U1), JSON.stringify({ screenshots: ['m'], links: [] })]);
    // ① 有凭证 ⇒ 409（行仍在、凭证仍在）
    const removeWithProof = await patchTaskVerb({ ref: T2, body: { subtasks_remove: [xWithProof] }, ex });
    // ② 非本 task ⇒ 404（借 T1 的子任务 id）
    const removeForeign = await patchTaskVerb({ ref: T2, body: { subtasks_remove: [Q1] }, ex });
    // ③ 无凭证 ⇒ 行消失（含 prediction：非 draft 下无票可删）
    const removeNoProof = await patchTaskVerb({ ref: T2, body: { subtasks_remove: [xNoProof, predNoProof] }, ex });
    ck.t('S3', '★删除三臂：目标有 `subtask_proof` 行 ⇒ **409 `subtask_has_proofs`**（行仍在、凭证仍在 1 行 ⇒ 凭证不丢）· 目标属**别的 task** ⇒ **404 `subtask_not_in_task`**（不区分「不存在」与「不是你的」）· 目标无凭证 ⇒ **200** 且行**真消失**（连删两枚、含非 draft 的 prediction 无票行 —— 裁定：prediction 无票可删）',
      verbOf(removeWithProof) === 409 && reasonOf(removeWithProof) === 'subtask_has_proofs'
        && (await proofCount(xWithProof)) === 1 && (await dbSub(xWithProof)) !== null
        && verbOf(removeForeign) === 404 && reasonOf(removeForeign) === 'subtask_not_in_task'
        && removeNoProof.ok === true
        && (await dbSub(xNoProof)) === null && (await dbSub(predNoProof)) === null
        && (await subCount(T2)) === 2,
      JSON.stringify({
        with_proof: [verbOf(removeWithProof), reasonOf(removeWithProof), await proofCount(xWithProof)],
        foreign: [verbOf(removeForeign), reasonOf(removeForeign)],
        gone: [await dbSub(xNoProof), await dbSub(predNoProof)],
        remaining: await subCount(T2),
      }));

    // ==================================================================== S4 · 同事务（合法 upsert + 非法 remove ⇒ 全回滚）
    const beforeMixed = await dbSub(xWithProof);
    const mixed = await patchTaskVerb({
      ref: T2,
      body: {
        subtasks: [{ subtask_id: xWithProof, type_code: 'x_verify', title: '本应回滚的改名', payload: { screenshots: ['m'], links: [] }, sort: 7 }],
        subtasks_remove: [X1],
      },
      ex,
    });
    const afterMixed = await dbSub(xWithProof);
    ck.t('S4', '★同事务（upsert ＋ remove 一笔）：合法 upsert（改 title）＋ 非法 remove（他 task 的 id）⇒ **404 `subtask_not_in_task`** 且**零半笔**（标题仍是原值、行数不变、目标行仍在）⇒ 删除与 upsert 共享同一事务与同一份前置快照',
      verbOf(mixed) === 404 && reasonOf(mixed) === 'subtask_not_in_task'
        && beforeMixed !== null && afterMixed !== null
        && afterMixed.title === String(beforeMixed.title) && afterMixed.sort === beforeMixed.sort
        && (await subCount(T2)) === 2 && (await dbSub(X1)) !== null,
      JSON.stringify({ mixed: [verbOf(mixed), reasonOf(mixed)], before: beforeMixed ?? null, after: afterMixed ?? null, subs: await subCount(T2) }));

    // ==================================================================== S5 · 同请求 draft→active ＋ 改 prediction ⇒ 409（不留窗口）
    const t3 = await createTaskVerb({
      campaignRef: C,
      body: {
        title: `S5 任务 ${RUN}`, reward_amount_primary: '10',
        subtasks: [{ type_code: 'prediction', title: '预测', sort: 1, payload: { prize_amount: '11', deadline: FUTURE } }],
      },
      ex,
    });
    const T3 = String(viewOf<{ task_id?: string }>(t3).task_id ?? '');
    const P3 = String((viewOf<{ subtasks?: Array<Record<string, unknown>> }>(t3).subtasks ?? [])
      .find((s) => String(s.type_code) === 'prediction')?.subtask_id ?? '');
    const sameReq = await patchTaskVerb({
      ref: T3,
      body: {
        status: 'active',
        subtasks: [{ subtask_id: P3, type_code: 'prediction', title: '预测', payload: { prize_amount: '99', deadline: FUTURE } }],
      },
      ex,
    });
    const afterSameReq = await dbSub(P3);
    ck.t('S5', '★不留窗口：同一请求里 `status: draft → active` **＋** 改 prediction payload ⇒ **409 `prediction_locked_after_publish`**（判据用生效态 `nextStatus`，不是库内旧态）· 回滚后 task 仍 **draft**、payload 仍 11 ⇒ 无法用「一笔发布时顺手改」绕过冻结',
      verbOf(sameReq) === 409 && reasonOf(sameReq) === 'prediction_locked_after_publish'
        && changedOf(sameReq).includes('payload')
        && (await dbTaskStatus(T3)) === 'draft'
        && afterSameReq !== null && String(afterSameReq.payload.prize_amount) === '11',
      JSON.stringify({ same_req: [verbOf(sameReq), reasonOf(sameReq), changedOf(sameReq)], status: await dbTaskStatus(T3), payload: afterSameReq?.payload ?? null }));

    // ==================================================================== S6 · 无损等值旁路（legacy 行 ＋ 同值新两键 ⇒ 200 零变更）
    const t4 = await createTaskVerb({
      campaignRef: C,
      body: {
        title: `S6 任务 ${RUN}`, reward_amount_primary: '10',
        subtasks: [{ type_code: 'x_verify', title: 'X 验证', sort: 2, payload: { screenshots: ['m'], links: [] } }],
      },
      ex,
    });
    const T4 = String(viewOf<{ task_id?: string }>(t4).task_id ?? '');
    const X4 = String((viewOf<{ subtasks?: Array<Record<string, unknown>> }>(t4).subtasks ?? [])
      .find((s) => String(s.type_code) === 'x_verify')?.subtask_id ?? '');
    // 直插存量四键行（读口会剥文案 ⇒ 客户端手里只有两键）
    const LEG4 = await insSub(T4, '9930000000000004', 'prediction', '存量预测',
      { option_a: 'Yes', option_b: 'No', prize_amount: '50', deadline: FUTURE }, 1);
    // 同一条 active 任务上再放一枚**新两键**行，用来验对称支（收旧四键、文案恰 Yes / No）
    const YES4 = await insSub(T4, '9930000000000005', 'prediction', '新两键预测',
      { prize_amount: '7', deadline: FUTURE }, 3);
    const act4 = await patchTaskVerb({ ref: T4, body: { status: 'active' }, ex });
    /**
     * 子任务快照。注意两枚「写入证据」在本门里为何都不成立/成立：
     *   · `time_updated` 由 BEFORE UPDATE 触发器写 `now()`（**事务起始时刻**）⇒ 同一事务内恒等，不能证明「没写」；
     *   · `xmin` = 写入事务 id ⇒ 同一事务内所有行恒等，同样不能区分。
     *   ⇒ 用**物理元组指针 `ctid`**：真发生 UPDATE 必产生新元组（新行指针）⇒ ctid 变；未 UPDATE ⇒ ctid 不变。
     */
    const subSnap = async (subtaskId: string): Promise<{ title: string; payload: Row; sort: number; ctid: string; time_updated: string } | null> =>
      one<{ title: string; payload: Row; sort: number; ctid: string; time_updated: string }>(
        `SELECT title, payload, sort, ctid::text AS ctid,
                to_char(time_updated, 'YYYY-MM-DD"T"HH24:MI:SS.US') AS time_updated
           FROM public.subtask WHERE subtask_id = $1::bigint`, [subtaskId]);
    const leg4Before = await subSnap(LEG4);
    const yes4Before = await subSnap(YES4);
    const x4Before = await subSnap(X4);
    // deadline 用**同一 instant 的另一种写法**（+00:00 而非 Z）⇒ 判等必须是 instant 而不是字符串
    const DL4_ALT = FUTURE.replace('Z', '+00:00');
    const equivResend = await patchTaskVerb({
      ref: T4,
      body: {
        subtasks: [
          // ① legacy 行按「读口看到的两键」原样重发（值一个都没改）
          { subtask_id: LEG4, type_code: 'prediction', title: '存量预测', payload: { prize_amount: '50', deadline: DL4_ALT }, sort: 1 },
          // 对称支：新两键行收旧四键，文案恰 Yes / No
          { subtask_id: YES4, type_code: 'prediction', title: '新两键预测',
            payload: { option_a: 'Yes', option_b: 'No', prize_amount: '7', deadline: FUTURE }, sort: 3 },
          // 同请求的**其它**子任务照常处理（非 prediction ⇒ 不受冻结，改名应落库）
          { subtask_id: X4, type_code: 'x_verify', title: 'X 验证（旁路同请求改名）', payload: { screenshots: ['m'], links: [] }, sort: 2 },
        ],
      },
      ex,
    });
    const leg4After = await subSnap(LEG4);
    const yes4After = await subSnap(YES4);
    const x4After = await subSnap(X4);
    const leg4View = (await getTaskDetailById(T4, ex))?.subtasks.find((s) => s.subtask_id === LEG4);
    /** 对称支的反向：文案不是 Yes / No（值真变）⇒ 仍按口径闸 400 */
    const yes4BadText = await patchTaskVerb({
      ref: T4,
      body: { subtasks: [{ subtask_id: YES4, type_code: 'prediction', title: '新两键预测',
        payload: { option_a: 'Yeah', option_b: 'No', prize_amount: '7', deadline: FUTURE }, sort: 3 }] },
      ex,
    });
    ck.t('S6', '★无损等值旁路（臂①）：active 任务上的**存量四键行**按「读口两键」原样重发（金额同值、deadline 同一 instant 的另一种写法 `+00:00`）⇒ **200**、库内 payload 仍**恰四键**（`option_a`/`option_b` 原样在：零丢失）、行内容逐字不变、**物理元组指针 `ctid` 与 `time_updated` 全未动**（事务内 `now()`/`xmin` 都冻结 ⇒ 只有 `ctid` 能证明「零物理写」，空写必红）、读口仍 `option_style=ab_legacy`；**同一请求**里其它子任务的改名照常落库（其 `ctid` 必变）⇒ 旁路是「跳过这一枚」，不是「整笔放行」；对称支（新两键行收旧四键、文案恰 `Yes`/`No`）⇒ 同样 200 且库内仍两键、`ctid` 不变；文案真变（`Yeah`）⇒ 仍 400 `PREDICTION_OPTION_STYLE_IMMUTABLE`',
      act4.ok === true
        && leg4Before !== null && yes4Before !== null && x4Before !== null
        && equivResend.ok === true
        && leg4After !== null && yes4After !== null && x4After !== null
        && JSON.stringify(Object.keys(leg4After.payload).sort())
          === JSON.stringify(['deadline', 'option_a', 'option_b', 'prize_amount'])
        && String(leg4After.payload.option_a) === 'Yes' && String(leg4After.payload.option_b) === 'No'
        && String(leg4After.payload.prize_amount) === '50'
        && leg4After.ctid === leg4Before.ctid
        && leg4After.time_updated === leg4Before.time_updated
        && leg4After.title === leg4Before.title
        && JSON.stringify(Object.keys(yes4After.payload).sort()) === JSON.stringify(['deadline', 'prize_amount'])
        && yes4After.ctid === yes4Before.ctid
        && yes4After.time_updated === yes4Before.time_updated
        && x4After.title === 'X 验证（旁路同请求改名）' && x4After.ctid !== x4Before.ctid
        && leg4View !== undefined && leg4View.option_style === 'ab_legacy'
        && verbOf(yes4BadText) === 400 && reasonOf(yes4BadText) === 'PREDICTION_OPTION_STYLE_IMMUTABLE',
      JSON.stringify({
        active: act4.ok, resend: equivResend.ok,
        legacy_before: leg4Before, legacy_after: leg4After,
        yes_no_before: yes4Before, yes_no_after: yes4After,
        other_item: { before: x4Before?.title, after: x4After?.title, ctid: [x4Before?.ctid, x4After?.ctid] },
        view_option_style: leg4View?.option_style ?? null,
        flipped_text: [verbOf(yes4BadText), reasonOf(yes4BadText)],
      }));

    // ==================================================================== S7 · 值真变 ⇒ 409（臂②）＋ 负控（放行即丢文案 · 必红）
    const leg4Pre = await subSnap(LEG4);
    const changedPrize = await patchTaskVerb({
      ref: T4,
      body: { subtasks: [{ subtask_id: LEG4, type_code: 'prediction', title: '存量预测',
        payload: { prize_amount: '51', deadline: FUTURE }, sort: 1 }] },
      ex,
    });
    const changedDeadline = await patchTaskVerb({
      ref: T4,
      body: { subtasks: [{ subtask_id: LEG4, type_code: 'prediction', title: '存量预测',
        payload: { prize_amount: '50', deadline: new Date(Date.parse(FUTURE) + 86400 * 1000).toISOString() }, sort: 1 }] },
      ex,
    });
    const leg4Post = await subSnap(LEG4);
    // ---- 负控（折进臂②）：把等值旁路改成「任意新两键都放行」⇒ 本臂必红；且放行会真丢文案
    const n3 = await undoAfter(c, 'n3', async () => {
      // 反事实：放行后写口落在 `payload = {prize_amount, deadline}`（客户端手里那两键）⇒ option_a/option_b 被覆盖掉
      await c.query(
        `UPDATE public.subtask SET payload = $2::jsonb WHERE subtask_id = $1::bigint`,
        [LEG4, JSON.stringify({ prize_amount: '51', deadline: FUTURE })]);
      return one<{ payload: Row }>('SELECT payload FROM public.subtask WHERE subtask_id = $1::bigint', [LEG4]);
    });
    /** 等值旁路的**变体**：去掉「值全等」这一项（任意新两键都算等值） */
    const equivVerdict = (published: boolean, equivalent: boolean, changed: string[]): number =>
      (equivalent ? 200 : published && changed.length ? 409 : 200);
    const laxEquivVerdict = (published: boolean, _equivalent: boolean, _changed: string[]): number =>
      (published ? 200 : 200);
    const n3payload = ((n3.value as { payload?: Row } | null)?.payload ?? {}) as Row;
    ck.t('S7', '★值真变 ⇒ 原规则 409（臂②）：active 任务上 legacy 行按两键改**金额**（50 → 51）⇒ **409 `prediction_locked_after_publish`**、`changed_fields` 含 `payload`；改 **deadline**（+1 天，instant 变了）⇒ 同样 409；两种拒法都**零写入**（payload 仍四键、金额仍 50、文案仍在、`time_updated` 不变）—— 旁路只拦「一个值都没改」的重发。**负控**：真实判据 `equivVerdict(true,等价,[payload])`=200 / `equivVerdict(true,非等价,[payload])`=409，把旁路改成「**任意新两键都放行**」⇒ 200 ⇒ 本臂必红；且放行是**真丢数据**（按客户端两键覆盖写后 `option_a`/`option_b` 永久消失 ⇒ 已投票的 `a|b` 口径不可逆）',
      changedPrize.ok !== true && verbOf(changedPrize) === 409 && reasonOf(changedPrize) === 'prediction_locked_after_publish'
        && changedOf(changedPrize).includes('payload')
        && verbOf(changedDeadline) === 409 && reasonOf(changedDeadline) === 'prediction_locked_after_publish'
        && changedOf(changedDeadline).includes('payload')
        && leg4Pre !== null && leg4Post !== null
        && leg4Post.ctid === leg4Pre.ctid
        && leg4Post.time_updated === leg4Pre.time_updated
        && String(leg4Post.payload.prize_amount) === '50' && String(leg4Post.payload.option_a) === 'Yes'
        && JSON.stringify(Object.keys(leg4Post.payload).sort())
          === JSON.stringify(['deadline', 'option_a', 'option_b', 'prize_amount'])
        && equivVerdict(true, true, ['payload']) === 200
        && equivVerdict(true, false, ['payload']) === 409
        && equivVerdict(false, false, ['payload']) === 200
        && laxEquivVerdict(true, false, ['payload']) === 200
        && n3.sqlstate === null
        && JSON.stringify(Object.keys(n3payload).sort()) === JSON.stringify(['deadline', 'prize_amount'])
        && !('option_a' in n3payload) && !('option_b' in n3payload),
      JSON.stringify({
        prize: [verbOf(changedPrize), reasonOf(changedPrize), changedOf(changedPrize)],
        deadline: [verbOf(changedDeadline), reasonOf(changedDeadline), changedOf(changedDeadline)],
        before: leg4Pre, after: leg4Post,
        real_verdicts: [equivVerdict(true, true, ['payload']), equivVerdict(true, false, ['payload']), equivVerdict(false, false, ['payload'])],
        mutant_verdict: laxEquivVerdict(true, false, ['payload']),
        overwritten_payload: n3payload,
      }));

    // ==================================================================== S8 · draft 下同值重发 ⇒ 200 零变更（臂③）
    const t5 = await createTaskVerb({
      campaignRef: C,
      body: {
        title: `S8 任务 ${RUN}`, reward_amount_primary: '10',
        subtasks: [{ type_code: 'x_verify', title: 'X 验证', sort: 2, payload: { screenshots: ['m'], links: [] } }],
      },
      ex,
    });
    const T5 = String(viewOf<{ task_id?: string }>(t5).task_id ?? '');
    const LEG5 = await insSub(T5, '9930000000000006', 'prediction', 'draft 存量预测',
      { option_a: 'Yes', option_b: 'No', prize_amount: '30', deadline: FUTURE }, 1);
    const leg5Before = await subSnap(LEG5);
    const draftResend = await patchTaskVerb({
      ref: T5,
      body: { subtasks: [{ subtask_id: LEG5, type_code: 'prediction', title: 'draft 存量预测',
        payload: { prize_amount: '30', deadline: FUTURE }, sort: 1 }] },
      ex,
    });
    const leg5After = await subSnap(LEG5);
    const draftChanged = await patchTaskVerb({
      ref: T5,
      body: { subtasks: [{ subtask_id: LEG5, type_code: 'prediction', title: 'draft 存量预测',
        payload: { prize_amount: '31', deadline: FUTURE }, sort: 1 }] },
      ex,
    });
    const leg5End = await subSnap(LEG5);
    ck.t('S8', '★draft 下同值重发（臂③）：draft 任务的 legacy 行按两键同值重发 ⇒ **200** 且**零变更**（payload 仍四键、文案仍在、物理元组指针 `ctid` 与 `time_updated` 全未动、`subtask_id` 不变 ⇒ 不是删建）；同一 draft 行改金额（30 → 31）⇒ 仍 **400 `PREDICTION_OPTION_STYLE_IMMUTABLE`**（口径不可换的原规则在 draft 上照旧）且库内未动（`ctid` 不变）',
      draftResend.ok === true
        && leg5Before !== null && leg5After !== null && leg5End !== null
        && leg5After.ctid === leg5Before.ctid
        && leg5After.time_updated === leg5Before.time_updated
        && JSON.stringify(Object.keys(leg5After.payload).sort())
          === JSON.stringify(['deadline', 'option_a', 'option_b', 'prize_amount'])
        && String(leg5After.payload.prize_amount) === '30'
        && verbOf(draftChanged) === 400 && reasonOf(draftChanged) === 'PREDICTION_OPTION_STYLE_IMMUTABLE'
        && String(leg5End.payload.prize_amount) === '30' && leg5End.ctid === leg5Before.ctid
        && leg5End.time_updated === leg5Before.time_updated,
      JSON.stringify({
        resend: draftResend.ok, before: leg5Before, after: leg5After,
        changed: [verbOf(draftChanged), reasonOf(draftChanged)], end: leg5End,
      }));

    // ==================================================================== N1 · 负控① 去锁闸 ⇒ active 可改（S2 必红）
    const n1 = await undoAfter(c, 'n1', async () => {
      // 反事实：库面无锁（只有服务层闸）⇒ 直接 UPDATE active 行的 payload **成功**
      await c.query(
        `UPDATE public.subtask SET payload = payload || jsonb_build_object('prize_amount', '777') WHERE subtask_id = $1::bigint`,
        [P2]);
      return String((await one<{ p: string }>(
        `SELECT payload->>'prize_amount' AS p FROM public.subtask WHERE subtask_id = $1::bigint`, [P2]))?.p ?? '');
    });
    /** 锁判据的**变体**：去掉「发布态」这一项（等价于删掉锁闸） */
    const lockVerdict = (published: boolean, changed: string[]): number => (published && changed.length ? 409 : 200);
    const noLockVerdict = (changed: string[]): number => (changed.length ? 200 : 200);
    ck.t('N1', '★负控① 锁闸承重：真实判据 `lockVerdict(true, ["payload"])` = **409**、`lockVerdict(false, ["payload"])` = 200（draft 放行）· **去掉锁闸**（`noLockVerdict(["payload"])`）= 200 ⇒ S2 的「active 改 payload ⇒ 409」必红 · 且**库面直写同一次改动成功**（`prize_amount` → 777，无库面锁 / 无约束拦）⇒ 409 的唯一屏障就是服务层锁闸',
      lockVerdict(true, ['payload']) === 409 && lockVerdict(false, ['payload']) === 200
        && lockVerdict(true, []) === 200
        && noLockVerdict(['payload']) === 200
        && n1.sqlstate === null && n1.value === '777'
        && verbOf(lockedPayload) === 409,
      JSON.stringify({ real: [lockVerdict(true, ['payload']), lockVerdict(false, ['payload']), lockVerdict(true, [])], mutant: noLockVerdict(['payload']), db_direct: n1.value }));

    // ==================================================================== N2 · 负控② 去凭证闸 ⇒ 有凭证仍删（S3 必红）
    const n2 = await undoAfter(c, 'n2', async () => {
      const proofsBefore = await proofCount(xWithProof);
      // 反事实：库面无凭证闸 ⇒ 直接 DELETE 成功，且 CASCADE 把 proof 一起抹掉
      await c.query('DELETE FROM public.subtask WHERE subtask_id = $1::bigint', [xWithProof]);
      return { proofs_before: proofsBefore, proofs_after: await proofCount(xWithProof), row_left: await dbSub(xWithProof) !== null };
    });
    /** 删除判据的**变体**：去掉「有凭证」这一项（等价于删掉凭证闸） */
    const removeVerdict = (hasProof: boolean): number => (hasProof ? 409 : 200);
    const noProofVerdict = (_hasProof: boolean): number => 200;
    const n2v = n2.value as { proofs_before: number; proofs_after: number; row_left: boolean } | null;
    ck.t('N2', '★负控② 凭证闸承重：真实判据 `removeVerdict(true)` = **409**、`removeVerdict(false)` = 200 · **去掉凭证闸**（`noProofVerdict(true)`）= 200 ⇒ S3 的「有凭证 ⇒ 409」必红 · 且**库面直删能成**（行消失 ＋ `ON DELETE CASCADE` 把该行 proof 一起抹掉 ⇒ 凭证真会丢）⇒ 409 的唯一屏障就是凭证闸',
      removeVerdict(true) === 409 && removeVerdict(false) === 200 && noProofVerdict(true) === 200
        && n2.sqlstate === null && n2v !== null
        && n2v.proofs_before === 1 && n2v.proofs_after === 0 && n2v.row_left === false
        && verbOf(removeWithProof) === 409,
      JSON.stringify({ real: [removeVerdict(true), removeVerdict(false)], mutant: noProofVerdict(true), db_direct: n2v }));

    // ---- 夹具落点（读数用；事务结束一律回滚）
    R.fixture = { campaign: C, s1_task: T1, s2_task: T2, s5_task: T3, quiz: Q1, x_verify: X1, prediction: P2 };
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
    const after = await committedResidue();
    const same = Object.keys(baseline).every((k) => after[k] === baseline[k]);
    ck.t('Z1', `零残留：subtask / subtask_proof / ledger_entry / users / schema_migration 行数**事务前 = 事务后**（夹具与全部反事实臂都在单回滚事务内；基线 ${JSON.stringify(baseline)}）`,
      same, JSON.stringify({ before: baseline, after }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p73-subtask-edit-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings ?? null }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
