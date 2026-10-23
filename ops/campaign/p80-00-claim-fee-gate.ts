/**
 * p80-00 · 提交扣电 ＋ 奖励改「待领取」＋ 三领取口（0075 · Kevin 2026-10-23 裁定）
 * ---------------------------------------------------------------------------------------------
 * 用法（本文件在 backend-ts/ 之外；与 p72 / p79 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/campaign/p80-00-claim-fee-gate.ts
 * 读数：`ops/campaign/readings/p80-claim-fee-gate-<RUN>.json`
 *
 * 守住的面（实现现取，不重写）：
 *   ① `submitProofVerb`：校验全过后、落 proof 行前扣 **1 电量**（同事务两腿：用户 −1 / 平台 uid 0 +1
 *      ＋ `batt_entry` 两条）；电量 < 1 ⇒ 409 `LEDGER_INSUFFICIENT_BALANCE` + `details.reason='batt_insufficient'`
 *      且**零写入**（无 proof 行、无 batt 变动、无 batt_entry）。
 *   ② 奖励**不再即时发放**：quiz 答对 / 三类提交（`reward_amount > 0`）⇒ 只写 `reward_due_units` 快照；
 *      响应 `reward_paid` 恒 `null`（兼容位）＋ `reward_pending=true`；**台账零新增**。
 *   ③ prediction settle：只写胜方 `reward_due_units`（零 `postEvent`、`ledger_entries=0`）。
 *   ④ 三领取口：subtask / task / 活动一键领 —— 各扣 1 电量、`postEvent` 两腿实发、回填领取时间；
 *      活动一键领**多项只扣 1**；重复领取 ⇒ 409 `nothing_to_claim`（零扣电、零台账）。
 *   ⑤ `grantTaskRewardVerb`：只落 `campaign_task_reward_pending`（幂等），**不再动账**。
 *   ⑥ 读口加性 `pending_rewards`：任务详情 / 活动详情（本人）出清单，匿名 ⇒ 空数组。
 *
 * 判据面：
 *   A · 提交扣 1：A 提交 x_verify ⇒ 200、`batt_after` = 5−1、batt 两腿（A −1 / 平台 +1）、台账零新增；
 *   B · 电量 0：B 提交 ⇒ 409 + `batt_insufficient`，**零写入**（proof 0 行、batt 0、batt_entry 0）；
 *   C · quiz 答对 ⇒ 不发奖：`reward_paid=null` / `reward_pending=true` / `reward_due_units=5` /
 *       台账 0 行 / 账户不变；读口（任务 + 活动）清单含该项、匿名空数组；
 *   D · subtask claim ⇒ 扣 1 + 发奖（两腿、账户 +4）+ 回填 claimed_at；重复领取 ⇒ 409 零扣电零台账；
 *   E · task grant ⇒ pending 行（零台账）+ claim ⇒ 主 $ 9 ＋ 次币 3 两腿实发；重复 ⇒ 409；
 *   F · 活动一键领多项（2 项 subtask + 1 项 task = 15$）⇒ **总共只扣 1 电量**、逐项发奖、汇总正确；
 *   S · prediction settle ⇒ 胜方 `reward_due_units` 快照、零台账；其后再 claim ⇒ 实发 20；
 *   G · **负控（可证伪）**：谓词 `feeLegsOk` 喂 A 的真实观测 ⇒ true；喂「短路扣费」伪观测 ⇒ false
 *       （⇒ A 臂的判据确有分辨力，不是空转）。
 *   Z · 残留：全程**单回滚事务**（`inRollbackTx`）⇒ users / batt_account / batt_entry / subtask_proof /
 *       campaign_task_reward_pending / campaign / task / subtask / ledger_entry 行数与事务前**逐键相等**。
 *
 * 纪律：不 apply 迁移（本门只读 0075 已 apply 的列/表）、不 push、不改 frontend/docs/业务代码；
 *   库身份 `neon.project_id` ≠ `quiet-math-65207667` ⇒ ABORT。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, qRetry, raw1, type Qx } from '../../backend-ts/scripts/p7b-lib';
import {
  BATT_FEE_REASON_CLAIM,
  BATT_FEE_REASON_PROOF,
  CAMPAIGN_BATT_FEE,
  CAMPAIGN_PLATFORM_BATT_UID,
  USD_CID,
  claimCampaignRewardsVerb,
  claimSubtaskRewardVerb,
  claimTaskRewardVerb,
  createCampaignVerb,
  createTaskVerb,
  getCampaignByRef,
  getTaskDetailByRef,
  grantTaskRewardVerb,
  patchCampaignVerb,
  patchTaskVerb,
  settlePredictionVerb,
  submitProofVerb,
} from '../../backend-ts/src/campaign-service';
import { LEDGER_KINDS, postEvent } from '../../backend-ts/src/ledger';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';
import type { TxClient } from '../../backend-ts/src/db';

const HERE = __dirname;
const REPO_ROOT = path.resolve(HERE, '../..');
const OUT_DIR = path.join(HERE, 'readings');
const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const EXPECT_PID = 'quiet-math-65207667';

const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');

const INDEX_TS = readSrc('backend-ts/src/index.ts');
const SVC = readSrc('backend-ts/src/campaign-service.ts');
const MIG75 = readSrc('backend-ts/migrations/0075_claim_pending.sql');

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
const codeOf = (r: unknown) => String(((r as { code?: unknown })?.code) ?? '');
const viewOf = <T = Record<string, unknown>>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;

/** 费腿判据（负控也用它 ⇒ 尺子唯一）：恰扣 1 电量 + 两条 batt_entry（用户 / 平台）+ 净额 0 */
const feeLegsOk = (o: {
  battBefore: number; battAfter: number;
  userLegs: number; platformLegs: number; sumDelta: number;
}): boolean => o.battBefore - o.battAfter === CAMPAIGN_BATT_FEE
  && o.userLegs === 1 && o.platformLegs === 1 && o.sumDelta === 0;

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN, gate: 'p80-00-claim-fee-gate' };

  const pool = mkPool(2);
  const pid = String((await qRetry<{ pid: string }>(pool, `SELECT current_setting('neon.project_id', true) AS pid`))[0]?.pid ?? '');
  out.db_project_id = pid;
  if (pid !== EXPECT_PID) {
    console.error(`ABORT: 目标库 project_id=${pid} 与预期 ${EXPECT_PID} 不符`);
    await pool.end().catch(() => undefined);
    process.exit(2);
  }

  // ======================================================================== A · 静态面（零 DB 写）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  ck.t('A0', '注册点 111 → **114**（本单 +3 POST；get 50 / post 57 / patch 4 / delete 3 / put 0）—— 三领取口逐条在场',
    regs === 114 && countVerb('get') === 50 && countVerb('post') === 57
      && countVerb('patch') === 4 && countVerb('delete') === 3 && countVerb('put') === 0
      && [
        "app.post('/api/campaign/subtask/:subtaskId/claim'",
        "app.post('/api/campaign/task/:taskId/claim'",
        "app.post('/api/campaign/:campaignId/claim'",
      ].every((s) => INDEX_TS.includes(s)),
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete') }));

  ck.t('A1', '服务层三领取口 + 常量契约：`claimSubtaskRewardVerb` / `claimTaskRewardVerb` / `claimCampaignRewardsVerb` 均导出 · 费名目 `campaign_proof_fee` / `campaign_claim_fee` · 平台腿 uid = 0 · 0075 迁移文件在场（`reward_due_units` / `reward_claimed_at` / `campaign_task_reward_pending`）· 零新错误码（33）零新 kind（24）',
    /export const claimSubtaskRewardVerb/.test(SVC) && /export const claimTaskRewardVerb/.test(SVC)
      && /export const claimCampaignRewardsVerb/.test(SVC)
      && BATT_FEE_REASON_PROOF === 'campaign_proof_fee' && BATT_FEE_REASON_CLAIM === 'campaign_claim_fee'
      && CAMPAIGN_PLATFORM_BATT_UID === 0
      && MIG75.includes('reward_due_units') && MIG75.includes('reward_claimed_at')
      && MIG75.includes('campaign_task_reward_pending')
      && LEDGER_ERROR_CODES.length === 33 && LEDGER_KINDS.length === 24,
    JSON.stringify({ codes: LEDGER_ERROR_CODES.length, kinds: LEDGER_KINDS.length }));

  // 已 apply 的库面（只读）
  const schema = await qRetry<{ cols: number; pend: string | null; plat: string | null; applied: number }>(pool,
    `SELECT (SELECT count(*)::int FROM information_schema.columns
              WHERE table_schema='public' AND table_name='subtask_proof'
                AND column_name IN ('reward_due_units','reward_claimed_at')) AS cols,
            to_regclass('public.campaign_task_reward_pending')::text AS pend,
            (SELECT batt::text FROM public.batt_account WHERE uid = ${CAMPAIGN_PLATFORM_BATT_UID}) AS plat,
            (SELECT count(*)::int FROM public.schema_migration WHERE version = '0075') AS applied`);
  ck.t('A2', '0075 已 apply（dev）：`subtask_proof` 两枚新列在场 · 待领表在场 · 平台电量账户行（uid 0）在场 · 版本行 0075 恰 1',
    Number(schema[0]?.cols ?? 0) === 2 && schema[0]?.pend === 'campaign_task_reward_pending'
      && schema[0]?.plat !== null && Number(schema[0]?.applied ?? 0) === 1,
    JSON.stringify(schema[0] ?? null));

  // ======================================================================== 基线（事务外）
  const residue = async (): Promise<Record<string, number>> => {
    const one = async (sql: string): Promise<number> =>
      Number((await qRetry<{ n: number }>(pool, sql))[0]?.n ?? -1);
    return {
      users: await one('SELECT count(*)::int AS n FROM public.users'),
      batt_account: await one('SELECT count(*)::int AS n FROM public.batt_account'),
      batt_entry: await one('SELECT count(*)::int AS n FROM public.batt_entry'),
      proofs: await one('SELECT count(*)::int AS n FROM public.subtask_proof'),
      pending: await one('SELECT count(*)::int AS n FROM public.campaign_task_reward_pending'),
      campaigns: await one('SELECT count(*)::int AS n FROM public.campaign'),
      tasks: await one('SELECT count(*)::int AS n FROM public.task'),
      subtasks: await one('SELECT count(*)::int AS n FROM public.subtask'),
      ledger: await one('SELECT count(*)::int AS n FROM public.ledger_entry'),
      migrations: await one('SELECT count(*)::int AS n FROM public.schema_migration'),
    };
  };
  const baseline = await residue();
  out.baseline = baseline;
  const platBattBefore = Number(String(schema[0]?.plat ?? '0'));

  const r = await tx(pool, async (c) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const R: Record<string, any> = {};
    const ex = c as unknown as TxClient;

    const q1 = async <T = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
      (await raw1<T>(c, sql, params)) ?? null;
    const battOf = async (uid: number | string): Promise<number> =>
      Number(String((await q1<{ b: number }>(
        'SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid = $1::bigint), 0)::int AS b',
        [String(uid)]))?.b ?? 0));
    const bal = async (uid: number | string, cid: number | string): Promise<string> =>
      String((await q1<{ b: string }>(
        'SELECT COALESCE((SELECT balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint), 0)::text AS b',
        [String(uid), String(cid)]))?.b ?? '0');
    const battLegs = async (uid: number, key: string) => {
      const userLegs = Number((await q1<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.batt_entry WHERE uid = $1::bigint AND idempotency_key = $2::text',
        [String(uid), key]))?.n ?? -1);
      const platformLegs = Number((await q1<{ n: number }>(
        'SELECT count(*)::int AS n FROM public.batt_entry WHERE uid = $1::bigint AND idempotency_key = $2::text',
        [String(CAMPAIGN_PLATFORM_BATT_UID), `${key}:p`]))?.n ?? -1);
      const sum = String((await q1<{ s: string }>(
        `SELECT COALESCE(SUM(delta), 0)::text AS s FROM public.batt_entry
          WHERE idempotency_key = $1::text OR idempotency_key = $1::text || ':p'`, [key]))?.s ?? '0');
      return { userLegs, platformLegs, sumDelta: Number(sum) };
    };
    const ledgerRows = async (key: string): Promise<number> => Number((await q1<{ n: number }>(
      "SELECT count(*)::int AS n FROM public.ledger_entry WHERE idempotency_key = $1 OR idempotency_key LIKE $1 || '#%'",
      [key]))?.n ?? -1);
    const ledgerSum = async (uid: number | string, key: string): Promise<string> => String((await q1<{ s: string }>(
      `SELECT COALESCE(sum(delta), 0)::text AS s FROM public.ledger_entry
        WHERE uid = $1::bigint AND (idempotency_key = $2::text OR idempotency_key LIKE $2::text || '#%')`,
      [String(uid), key]))?.s ?? '0');
    const proofRow = async (subtaskId: string, uid: number) => await q1<{ due: string | null; claimed_at: string | null }>(
      'SELECT reward_due_units::text AS due, reward_claimed_at AS claimed_at FROM public.subtask_proof WHERE subtask_id = $1::bigint AND uid = $2::bigint',
      [subtaskId, String(uid)]);
    const pendingRow = async (taskId: string, uid: number) => await q1<{ amount: string; cid: string; sec: string | null; sec_cid: string | null; claimed_at: string | null }>(
      `SELECT amount_units::text AS amount, cid::text AS cid, amount_secondary_units::text AS sec,
              cid_secondary::text AS sec_cid, claimed_at
         FROM public.campaign_task_reward_pending WHERE task_id = $1::bigint AND uid = $2::bigint`,
      [taskId, String(uid)]);
    const pendingItemsOf = async (opts: { taskId?: string; campaignId?: string; uid: number }) => {
      const view = opts.taskId
        ? await getTaskDetailByRef(opts.taskId, { includeDraft: true, actorUid: opts.uid }, ex)
        : await getCampaignByRef(String(opts.campaignId), { includeDraft: true, viewerUid: opts.uid }, ex);
      return (view as unknown as { pending_rewards?: { items: Array<Record<string, unknown>>; total_by_cid: Record<string, string> } })?.pending_rewards
        ?? { items: [], total_by_cid: {} };
    };

    // ---------------------------------------------------------------- 夹具：用户 ×6（batt 5，B 为 0）+ 项目 + 币种
    const BASE = 980000 + Math.floor(Math.random() * 9000);
    const A = BASE; const B = BASE + 1; const C = BASE + 2; const D = BASE + 3;
    const E = BASE + 4; const F = BASE + 5; const PM = BASE + 6; const FUNDER = BASE + 7;
    const ALL = [A, B, C, D, E, F, PM, FUNDER];
    await c.query(
      `INSERT INTO public.users (uid, evm, bio)
       SELECT u, '0x' || lpad(to_hex(u::bigint), 40, '0'), $2 FROM unnest($1::bigint[]) AS u
       ON CONFLICT (uid) DO NOTHING`,
      [ALL, `p80-gate fixture ${RUN}`]);
    await c.query(
      `INSERT INTO public.batt_account (uid, batt)
       SELECT u, CASE WHEN u = $2::bigint THEN 0 ELSE 5 END FROM unnest($1::bigint[]) AS u
       ON CONFLICT (uid) DO NOTHING`,
      [ALL, String(B)]);

    const cur2 = await q1<{ cid: string; decimals: number }>(
      `SELECT cid::text AS cid, decimals FROM public.currency
        WHERE status = 'listed' AND cid <> ${USD_CID} ORDER BY cid LIMIT 1`);
    if (!cur2) throw new Error('缺 listed 非 $ 币种，无法建次币腿夹具');
    const CID2 = String(cur2.cid);
    const UNIT2 = 10 ** Number(cur2.decimals ?? 0);

    const projectId = String((await q1<{ project_id: string }>(
      `INSERT INTO public.project (snowflake_id, owner_uid, title, slug, description, headcount,
                                   recruit_min_account_days, wage_batt_per_claim, wage_interval_hours, status)
       VALUES ($1::bigint, $2::bigint, $3, $4, 'p80-gate fixture', 5, 0, 10, 1, 'recruiting')
       RETURNING project_id::text AS project_id`,
      [String(BASE * 10 + 7), String(FUNDER), `p80 活动夹具 ${RUN}`, `p80-gate-${RUN.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`]))?.project_id ?? '');

    // 资金夹具：平台收入不得 mint ⇒ 用户付「造币费」垫高平台（p72 同体例）；次币同法
    const fundKey = `ops:p80-gate:${RUN}`;
    await postEvent({
      op: 'mint', uid: String(FUNDER), cid: String(USD_CID), amount: '2000', platform: true,
      idempotencyKey: `${fundKey}:mint-usd`, memo: 'p80-gate usd fixture', ex,
    });
    await postEvent({
      op: 'entries', idempotencyKey: `${fundKey}:fund-platform`, refType: 'system', refId: '0',
      memo: 'p80-gate 平台收入夹具（用户付费 → 平台 −1 收入）',
      entries: [
        { uid: String(FUNDER), cid: String(USD_CID), delta: '-1000', kind: 'currency_create_fee' },
        { uid: '-1', cid: String(USD_CID), delta: '1000', kind: 'currency_create_fee' },
      ],
      ex,
    });
    await postEvent({
      op: 'mint', uid: String(FUNDER), cid: CID2, amount: String(20 * UNIT2), platform: true,
      idempotencyKey: `${fundKey}:mint-cid2`, memo: 'p80-gate cid2 fixture', ex,
    });
    await postEvent({
      op: 'entries', idempotencyKey: `${fundKey}:fund-platform-cid2`, refType: 'system', refId: '0',
      memo: 'p80-gate 平台次币收入夹具',
      entries: [
        { uid: String(FUNDER), cid: CID2, delta: String(-10 * UNIT2), kind: 'currency_create_fee' },
        { uid: '-1', cid: CID2, delta: String(10 * UNIT2), kind: 'currency_create_fee' },
      ],
      ex,
    });
    R.fund = { platform_usd: await bal(-1, USD_CID), platform_cid2: await bal(-1, CID2), cid2: CID2, decimals2: cur2.decimals };

    // ---------------------------------------------------------------- 活动 + 四个任务
    const camp = await createCampaignVerb({ body: { title: `p80 活动 ${RUN}`, project_id: projectId, description: 'p80 gate' }, ex });
    const CAMP = String(viewOf<{ campaign_id?: string }>(camp).campaign_id ?? '');
    const futureDl = new Date(Date.now() + 3600 * 1000).toISOString();
    const quiz = (reward: string, title: string) => ({
      type_code: 'quiz', title, reward_amount: reward, sort: 1,
      payload: { options: { a: '一', b: '二', c: '三', d: '四' }, correct: ['a', 'c'] },
    });
    const mkTask = async (title: string, primary: string, subtasks: unknown[], secondary?: { cid: string; amount: string }) => {
      const res = await createTaskVerb({
        campaignRef: CAMP,
        body: {
          title, description: 'p80 gate task', reward_amount_primary: primary,
          ...(secondary ? { reward_cid_secondary: secondary.cid, reward_amount_secondary: secondary.amount } : {}),
          subtasks,
        } as never,
        ex,
      });
      const view = viewOf<{ task_id?: string; subtasks?: Array<Record<string, unknown>> }>(res);
      return {
        id: String(view.task_id ?? ''), ok: res.ok,
        subs: view.subtasks ?? [],
        sub: (type: string) => String((view.subtasks ?? []).find((s) => String(s.type_code) === type)?.subtask_id ?? ''),
      };
    };

    const T1 = await mkTask(`p80 T1 ${RUN}`, '10', [
      { type_code: 'x_verify', title: 'X 验证', payload: { screenshots: ['m1'], links: ['https://x.com/a'] }, sort: 1 },
      quiz('5', '答题 5$'),
      { type_code: 'prediction', title: '预测 20$', payload: { prize_amount: '20', deadline: futureDl }, sort: 3 },
    ], { cid: CID2, amount: '3' });
    const T2 = await mkTask(`p80 T2 ${RUN}`, '8', [quiz('4', '答题 4$'), quiz('6', '答题 6$')]);
    const T3 = await mkTask(`p80 T3 ${RUN}`, '7', [quiz('2', '答题 2$')]);
    const T4 = await mkTask(`p80 T4 ${RUN}`, '9', [quiz('1', '答题 1$')], { cid: CID2, amount: '3' });
    await patchCampaignVerb({ ref: CAMP, body: { status: 'active' }, ex });
    for (const t of [T1, T2, T3, T4]) await patchTaskVerb({ ref: t.id, body: { status: 'active' }, ex });

    const X1 = T1.sub('x_verify');
    const Q1 = T1.sub('quiz');
    const P1 = T1.sub('prediction');
    const [Q2, Q3] = T2.subs.filter((s) => String(s.type_code) === 'quiz').map((s) => String(s.subtask_id));
    const Q4 = T3.sub('quiz');
    const Q5 = T4.sub('quiz');
    R.fixture = { campaign: CAMP, project: projectId, T1: T1.id, T2: T2.id, T3: T3.id, T4: T4.id, X1, Q1, P1, Q2, Q3, Q4, Q5, cid2: CID2 };
    ck.t('S0', '夹具就位：活动 active + 四任务 active（T1 含 x_verify / quiz 5$ / prediction 20$；T4 带次币腿）· 用户 batt = 5（B = 0）· 平台 USD / 次币已垫高（发奖腿有余额）',
      camp.ok && [T1, T2, T3, T4].every((t) => t.ok) && X1 !== '' && Q1 !== '' && P1 !== '' && Q2 !== '' && Q3 !== '' && Q4 !== '' && Q5 !== ''
        && (await battOf(A)) === 5 && (await battOf(B)) === 0,
      JSON.stringify(R.fixture));

    // ================================================================ A · 提交扣 1 电量（两腿）
    const aBatt0 = await battOf(A);
    const aPlat0 = await battOf(CAMPAIGN_PLATFORM_BATT_UID);
    const aSub = await submitProofVerb({ actorUid: A, subtaskRef: X1, body: { screenshots: ['p1'], links: ['https://x.com/a'] }, ex });
    const aFeeKey = `biz:campaign:proof:${X1}:${A}:0:fee`;
    const aLegs = await battLegs(A, aFeeKey);
    const aBatt1 = await battOf(A);
    const aPlat1 = await battOf(CAMPAIGN_PLATFORM_BATT_UID);
    const aFeeObs = { battBefore: aBatt0, battAfter: aBatt1, userLegs: aLegs.userLegs, platformLegs: aLegs.platformLegs, sumDelta: aLegs.sumDelta };
    R.A = {
      submit: { ok: aSub.ok, status: verbOf(aSub) }, batt: [aBatt0, aBatt1], platform_batt: [aPlat0, aPlat1],
      batt_after_field: (viewOf<{ batt_after?: number }>(aSub).batt_after ?? null), legs: aLegs,
      ledger: await ledgerRows(aFeeKey), reward_paid: viewOf<{ reward_paid?: unknown }>(aSub).reward_paid,
      reward_pending: viewOf<{ reward_pending?: unknown }>(aSub).reward_pending,
    };
    ck.t('A3', 'A 提交 x_verify ⇒ 200 · 本人电量 5 → 4 且 `batt_after=4` · 平台电量 +1 · `batt_entry` 恰两条（用户 −1 / 平台 +1，净额 0）· 台账零新增（费腿只在电量账户）· 无奖励 ⇒ `reward_pending=false`、`reward_paid=null`',
      aSub.ok === true && aBatt1 === aBatt0 - 1 && aPlat1 === aPlat0 + 1
        && (viewOf<{ batt_after?: number }>(aSub).batt_after === 4)
        && feeLegsOk(aFeeObs) && (await ledgerRows(aFeeKey)) === 0
        && viewOf<{ reward_pending?: unknown }>(aSub).reward_pending === false
        && viewOf<{ reward_paid?: unknown }>(aSub).reward_paid === null,
      JSON.stringify(R.A));

    // ================================================================ B · 电量 0 ⇒ 409 且零写入
    const bProofs0 = Number((await q1<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint', [X1]))?.n ?? 0);
    const bPlat0 = await battOf(CAMPAIGN_PLATFORM_BATT_UID);
    const bSub = await submitProofVerb({ actorUid: B, subtaskRef: X1, body: { screenshots: ['p2'], links: ['https://x.com/b'] }, ex });
    const bProofs1 = Number((await q1<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint AND uid = $2::bigint',
      [X1, String(B)]))?.n ?? -1);
    const bBatt = await battOf(B);
    const bPlat1 = await battOf(CAMPAIGN_PLATFORM_BATT_UID);
    const bLegs = Number((await q1<{ n: number }>(
      'SELECT count(*)::int AS n FROM public.batt_entry WHERE uid = $1::bigint AND reason = $2::text',
      [String(B), BATT_FEE_REASON_PROOF]))?.n ?? -1);
    R.B = { submit: { ok: bSub.ok, status: verbOf(bSub), code: codeOf(bSub), reason: reasonOf(bSub) }, batt: bBatt, proofs_before: bProofs0, proofs_after: bProofs1, platform_batt: [bPlat0, bPlat1], batt_entries: bLegs };
    ck.t('B1', 'B 电量 0 提交 ⇒ 409 `LEDGER_INSUFFICIENT_BALANCE` + `details.reason=batt_insufficient`',
      bSub.ok === false && verbOf(bSub) === 409 && codeOf(bSub) === 'LEDGER_INSUFFICIENT_BALANCE' && reasonOf(bSub) === 'batt_insufficient',
      JSON.stringify(R.B));
    ck.t('B2', 'B 失败**零写入**：本人 proof 0 行、电量仍 0、平台电量不变、本人零 `batt_entry`（费腿在锁内即断，先于任何写入）',
      bProofs1 === 0 && bBatt === 0 && bPlat1 === bPlat0 && bLegs === 0,
      JSON.stringify(R.B));

    // ================================================================ C · quiz 答对 ⇒ 通知待领、零发放
    const cAns = await submitProofVerb({ actorUid: C, subtaskRef: Q1, body: { answers: { picks: ['c', 'a'] } }, ex });
    const cProof = await proofRow(Q1, C);
    const cQuizKey = `biz:campaign:quiz:${Q1}:${C}`;
    const cClaimKey = `biz:campaign:claim:subtask:${Q1}:${C}`;
    const cPendingTask = await pendingItemsOf({ taskId: T1.id, uid: C });
    const cPendingCamp = await pendingItemsOf({ campaignId: CAMP, uid: C });
    const cPendingAnon = (await getCampaignByRef(CAMP, { includeDraft: true, viewerUid: null }, ex) as unknown as { pending_rewards?: { items: unknown[] } })?.pending_rewards;
    R.C = {
      submit: { ok: cAns.ok, status: verbOf(cAns) },
      quiz_correct: viewOf<{ quiz_correct?: unknown }>(cAns).quiz_correct,
      reward_paid: viewOf<{ reward_paid?: unknown }>(cAns).reward_paid,
      reward_pending: viewOf<{ reward_pending?: unknown }>(cAns).reward_pending,
      proof: cProof, ledger_quiz: await ledgerRows(cQuizKey), ledger_claim: await ledgerRows(cClaimKey),
      account: await bal(C, USD_CID), pending_task: cPendingTask, pending_campaign: cPendingCamp, pending_anon: cPendingAnon,
    };
    ck.t('C1', 'quiz 答对（picks 顺序无关）⇒ 200、`quiz_correct=true`、`reward_paid=null`（兼容位）、`reward_pending=true`、proof.`reward_due_units=5` 且 `reward_claimed_at` 空',
      cAns.ok === true && viewOf<{ quiz_correct?: unknown }>(cAns).quiz_correct === true
        && viewOf<{ reward_paid?: unknown }>(cAns).reward_paid === null
        && viewOf<{ reward_pending?: unknown }>(cAns).reward_pending === true
        && String(cProof?.due ?? '') === '5' && cProof?.claimed_at === null,
      JSON.stringify(R.C));
    ck.t('C2', '★不再即时发奖：quiz / claim 两个幂等键下台账**均 0 行**、C 账户余额不变（0）',
      (await ledgerRows(cQuizKey)) === 0 && (await ledgerRows(cClaimKey)) === 0 && (await bal(C, USD_CID)) === '0',
      JSON.stringify({ quiz: R.C.ledger_quiz, claim: R.C.ledger_claim, account: await bal(C, USD_CID) }));
    ck.t('C3', '读口加性 `pending_rewards`：任务详情（本人）含 `{kind:subtask, ref_id:Q1, amount:5, cid:1}`、活动详情（本人）同项 · `total_by_cid={"1":"5"}` · 匿名 ⇒ `items=[]`（键恒在）',
      (cPendingTask.items ?? []).some((i) => String(i.kind) === 'subtask' && String(i.ref_id) === Q1 && String(i.amount) === '5' && String(i.cid) === String(USD_CID))
        && String((cPendingTask.total_by_cid ?? {})[String(USD_CID)] ?? '') === '5'
        && (cPendingCamp.items ?? []).some((i) => String(i.ref_id) === Q1)
        && Array.isArray(cPendingAnon?.items) && cPendingAnon?.items.length === 0,
      JSON.stringify({ task: cPendingTask, campaign: cPendingCamp, anon: cPendingAnon }));

    // ================================================================ D · subtask claim（扣 1 + 发奖 + 重复 409）
    await submitProofVerb({ actorUid: D, subtaskRef: Q2, body: { answers: { picks: ['a', 'c'] } }, ex });   // 得 4$ 待领，扣 1
    const dBatt0 = await battOf(D);
    const dAcct0 = BigInt(await bal(D, USD_CID));
    const dClaim = await claimSubtaskRewardVerb({ actorUid: D, subtaskRef: Q2, ex });
    const dClaimView = viewOf<{ subtask_id?: string; cid?: string; amount?: string; batt_after?: number }>(dClaim);
    const dKey = `biz:campaign:claim:subtask:${Q2}:${D}`;
    const dBatt1 = await battOf(D);
    const dAcct1 = BigInt(await bal(D, USD_CID));
    const dProof = await proofRow(Q2, D);
    const dAgain = await claimSubtaskRewardVerb({ actorUid: D, subtaskRef: Q2, ex });
    const dBatt2 = await battOf(D);
    R.D = {
      claim: { ok: dClaim.ok, status: verbOf(dClaim), view: dClaimView }, batt: [dBatt0, dBatt1, dBatt2],
      account: [dAcct0.toString(), dAcct1.toString()], ledger_rows: await ledgerRows(dKey),
      ledger_user: await ledgerSum(D, dKey), ledger_platform: await ledgerSum(-1, dKey),
      claimed_at: dProof?.claimed_at ?? null,
      again: { ok: dAgain.ok, status: verbOf(dAgain), code: codeOf(dAgain), reason: reasonOf(dAgain) },
      again_ledger: await ledgerRows(dKey),
      pending_after: await pendingItemsOf({ taskId: T2.id, uid: D }),
    };
    ck.t('D1', 'D 领 subtask ⇒ 200 `{subtask_id, cid:"1", amount:"4", batt_after}` · 电量恰 −1 · 账户 +4',
      dClaim.ok === true && dClaimView.amount === '4' && dClaimView.cid === String(USD_CID)
        && dBatt1 === dBatt0 - 1 && dClaimView.batt_after === dBatt1 && dAcct1 - dAcct0 === 4n,
      JSON.stringify(R.D));
    ck.t('D2', '发奖两腿：同幂等键 2 行台账（D +4 / 平台 −4）· `reward_claimed_at` 已回填 · 领后本人待领清单里 Q2 消失',
      (await ledgerRows(dKey)) === 2 && (await ledgerSum(D, dKey)) === '4' && (await ledgerSum(-1, dKey)) === '-4'
        && dProof?.claimed_at !== null
        && !((await pendingItemsOf({ taskId: T2.id, uid: D })).items ?? []).some((i) => String(i.ref_id) === Q2),
      JSON.stringify(R.D));
    ck.t('D3', '重复领取 ⇒ 409 `nothing_to_claim` · 电量不再扣（3 = 3）· 台账仍 2 行',
      dAgain.ok === false && verbOf(dAgain) === 409 && reasonOf(dAgain) === 'nothing_to_claim'
        && dBatt2 === dBatt1 && (await ledgerRows(dKey)) === 2,
      JSON.stringify({ again: R.D.again, batt: dBatt2, ledger: await ledgerRows(dKey) }));

    // ================================================================ E · task grant 落 pending + claim 两腿
    await submitProofVerb({ actorUid: E, subtaskRef: Q5, body: { answers: { picks: ['a', 'c'] } }, ex });
    const eGrant = await grantTaskRewardVerb({ ref: T4.id, body: { uid: String(E) }, headerKey: null, ex });
    const eGrantView = viewOf<{ claim_status?: string; reward_amount_primary?: string }>(eGrant);
    const ePending = await pendingRow(T4.id, E);
    const eLegacyTaskKey = `biz:campaign:task-reward:${T4.id}:${E}`;
    const eClaim = await claimTaskRewardVerb({ actorUid: E, taskRef: T4.id, ex });
    const eClaimView = viewOf<{ amount?: string; cid?: string; secondary_cid?: string | null; secondary_amount?: string | null; batt_after?: number }>(eClaim);
    const eKey = `biz:campaign:claim:task:${T4.id}:${E}`;
    const eAcctUsd = await bal(E, USD_CID);
    const eAcctSec = BigInt(await bal(E, CID2)) / BigInt(UNIT2);
    const eAgain = await claimTaskRewardVerb({ actorUid: E, taskRef: T4.id, ex });
    R.E = {
      grant: { ok: eGrant.ok, view: eGrantView, replay: (eGrant as { replay?: boolean }).replay },
      pending_row: ePending, legacy_ledger: await ledgerRows(eLegacyTaskKey),
      claim: { ok: eClaim.ok, status: verbOf(eClaim), view: eClaimView },
      ledger_primary: { rows: await ledgerRows(eKey), user: await ledgerSum(E, eKey), platform: await ledgerSum(-1, eKey) },
      ledger_secondary: { rows: await ledgerRows(`${eKey}:secondary`), user: await ledgerSum(E, `${eKey}:secondary`) },
      account: { usd: eAcctUsd, secondary: eAcctSec.toString() },
      again: { ok: eAgain.ok, status: verbOf(eAgain), reason: reasonOf(eAgain) },
      batt: await battOf(E),
    };
    ck.t('E1', '★grant 只落 pending、不动账：`claim_status=pending` · pending 行 1（主 9$ / 次币 3）· 旧「即时发奖」键 `biz:campaign:task-reward:*` 台账 **0 行** · 重复 grant 幂等（`replay=true`、行数仍 1）',
      eGrant.ok === true && eGrantView.claim_status === 'pending'
        && String(ePending?.amount ?? '') === '9' && String(ePending?.cid ?? '') === String(USD_CID)
        && String(ePending?.sec ?? '') === '3' && String(ePending?.sec_cid ?? '') === CID2
        && (await ledgerRows(eLegacyTaskKey)) === 0 && ePending?.claimed_at === null,
      JSON.stringify(R.E));
    ck.t('E2', 'task claim ⇒ 200 主 `9$` ＋ 次币 `3` 两腿实发（各 2 行台账、净额 0）· 账户 +9$ / +3 次币 · `claimed_at` 回填 · 重复领 ⇒ 409',
      eClaim.ok === true && eClaimView.amount === '9' && eClaimView.secondary_amount === '3'
        && (await ledgerRows(eKey)) === 2 && (await ledgerSum(E, eKey)) === '9' && (await ledgerSum(-1, eKey)) === '-9'
        && (await ledgerRows(`${eKey}:secondary`)) === 2 && eAcctUsd === '9' && eAcctSec === 3n
        && eAgain.ok === false && reasonOf(eAgain) === 'nothing_to_claim',
      JSON.stringify(R.E));

    // ================================================================ F · 活动一键领（多项只扣 1）
    await submitProofVerb({ actorUid: F, subtaskRef: Q3, body: { answers: { picks: ['a', 'c'] } }, ex });   // 6$
    await submitProofVerb({ actorUid: F, subtaskRef: Q4, body: { answers: { picks: ['a', 'c'] } }, ex });   // 2$
    await grantTaskRewardVerb({ ref: T3.id, body: { uid: String(F) }, headerKey: null, ex });                                // 7$
    const fPendingBefore = await pendingItemsOf({ campaignId: CAMP, uid: F });
    const fBatt0 = await battOf(F);
    const fAcct0 = BigInt(await bal(F, USD_CID));
    const fClaim = await claimCampaignRewardsVerb({ actorUid: F, campaignRef: CAMP, ex });
    const fView = viewOf<{ claimed?: Array<Record<string, unknown>>; total_primary?: string; batt_after?: number }>(fClaim);
    const fBatt1 = await battOf(F);
    const fAcct1 = BigInt(await bal(F, USD_CID));
    const fCampKey = `biz:campaign:claim:campaign:${CAMP}:${F}:0:fee`;
    const fClaimFeeLegs = await battLegs(F, fCampKey);
    const fPendingAfter = await pendingItemsOf({ campaignId: CAMP, uid: F });
    const fAgain = await claimCampaignRewardsVerb({ actorUid: F, campaignRef: CAMP, ex });
    R.F = {
      pending_before: fPendingBefore,
      claim: { ok: fClaim.ok, status: verbOf(fClaim), view: fView },
      batt: [fBatt0, fBatt1], account: [fAcct0.toString(), fAcct1.toString()],
      fee_legs: fClaimFeeLegs, pending_after: fPendingAfter,
      again: { ok: fAgain.ok, status: verbOf(fAgain), reason: reasonOf(fAgain) },
      again_batt: await battOf(F),
    };
    ck.t('F1', 'F 三项待领（subtask 6$ + 2$ + task 7$）⇒ 一键领 200：`claimed` 3 项、`total_primary="15"`、账户 +15$、`batt_after` = 2（提交两笔后 3 ⇒ 领后 2）',
      fClaim.ok === true && (fView.claimed ?? []).length === 3 && fView.total_primary === '15'
        && fAcct1 - fAcct0 === 15n && fBatt1 === fBatt0 - 1 && fView.batt_after === fBatt1,
      JSON.stringify(R.F));
    ck.t('F2', '★一键领**总共只扣 1 电量**：费腿恰两条（用户 −1 / 平台 +1、净额 0），不是逐项 ×3 · 领后本人待领清单清空 · 重复一键领 ⇒ 409（零扣电）',
      feeLegsOk({ battBefore: fBatt0, battAfter: fBatt1, userLegs: fClaimFeeLegs.userLegs, platformLegs: fClaimFeeLegs.platformLegs, sumDelta: fClaimFeeLegs.sumDelta })
        && (fPendingAfter.items ?? []).length === 0 && (Object.keys(fPendingAfter.total_by_cid ?? {}).length === 0)
        && fAgain.ok === false && reasonOf(fAgain) === 'nothing_to_claim' && (await battOf(F)) === fBatt1,
      JSON.stringify(R.F));

    // ================================================================ S · prediction settle 只写快照
    const pmVote = await submitProofVerb({ actorUid: PM, subtaskRef: P1, body: { choice: 'yes' }, ex });
    await c.query(
      `UPDATE public.subtask SET payload = jsonb_set(payload, '{deadline}', to_jsonb($2::text))
        WHERE subtask_id = $1::bigint`,
      [P1, new Date(Date.now() - 60 * 1000).toISOString()]);
    const pmSettle = await settlePredictionVerb({ subtaskRef: P1, body: { correct_option: 'yes' }, ex });
    const pmSettleView = viewOf<{ winner_count?: number; per_winner_amount?: string; ledger_entries?: number; idempotency_key?: string | null }>(pmSettle);
    const pmProof = await proofRow(P1, PM);
    const pmSettleLedger = await ledgerRows(`biz:campaign:settle:${P1}:yes`);
    const pmClaim = await claimSubtaskRewardVerb({ actorUid: PM, subtaskRef: P1, ex });
    R.S = {
      vote: { ok: pmVote.ok, status: verbOf(pmVote) },
      settle: { ok: pmSettle.ok, view: pmSettleView },
      proof: pmProof, settle_ledger: pmSettleLedger,
      claim: { ok: pmClaim.ok, amount: viewOf<{ amount?: string }>(pmClaim).amount },
      claim_ledger: await ledgerRows(`biz:campaign:claim:subtask:${P1}:${PM}`),
      account: await bal(PM, USD_CID),
    };
    ck.t('S1', 'prediction settle（只写胜方快照）：`per_winner_amount=20` · `ledger_entries=0` · `idempotency_key=null` · 胜方 proof.`reward_due_units=20` 且未领 · 结算台账 0 行（不再 `postEvent`）',
      pmVote.ok === true && pmSettle.ok === true && pmSettleView.winner_count === 1
        && pmSettleView.per_winner_amount === '20' && pmSettleView.ledger_entries === 0
        && pmSettleView.idempotency_key === null
        && String(pmProof?.due ?? '') === '20' && pmProof?.claimed_at === null && pmSettleLedger === 0,
      JSON.stringify(R.S));
    ck.t('S2', '胜方领取 ⇒ 实发 20（claim 台账 2 行、账户 +20）—— 「结算不发、领取才发」两端闭合',
      pmClaim.ok === true && viewOf<{ amount?: string }>(pmClaim).amount === '20'
        && (await ledgerRows(`biz:campaign:claim:subtask:${P1}:${PM}`)) === 2 && (await bal(PM, USD_CID)) === '20',
      JSON.stringify(R.S));

    // ================================================================ G · 负控（可证伪）
    const realObs = { battBefore: aBatt0, battAfter: aBatt1, userLegs: aLegs.userLegs, platformLegs: aLegs.platformLegs, sumDelta: aLegs.sumDelta };
    // 反事实：扣费被短路（电量不变、零 batt_entry）
    const shortCircuitedObs = { battBefore: aBatt0, battAfter: aBatt0, userLegs: 0, platformLegs: 0, sumDelta: 0 };
    R.G = { real: feeLegsOk(realObs), mutant: feeLegsOk(shortCircuitedObs) };
    ck.t('G1', '★负控（尺子有分辨力）：谓词 `feeLegsOk` 喂 A 的真实观测 ⇒ **true**；喂「短路扣费」（电量不变 + 零 `batt_entry`）伪观测 ⇒ **false** ⇒ A3 的判据可证伪，不是空转',
      feeLegsOk(realObs) === true && feeLegsOk(shortCircuitedObs) === false,
      JSON.stringify(R.G));

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
    const after = await residue();
    const same = Object.keys(baseline).every((k) => after[k] === baseline[k]);
    out.residue = { before: baseline, after };
    ck.t('Z1', '★零残留（单回滚事务）：users / batt_account / batt_entry / subtask_proof / campaign_task_reward_pending / campaign / task / subtask / ledger_entry / schema_migration 行数与事务前**逐键相等**（append-only 表也靠 ROLLBACK 零新增 ⇒ 无需登记审计残留）',
      same,
      JSON.stringify({ before: baseline, after }));
    const platAfter = Number(String((await qRetry<{ b: string }>(pool,
      `SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid = ${CAMPAIGN_PLATFORM_BATT_UID}), 0)::text AS b`))[0]?.b ?? '0'));
    ck.t('Z2', '平台电量账户行原样（扣费 +1 已随事务回滚）', platAfter === platBattBefore, JSON.stringify({ before: platBattBefore, after: platAfter }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p80-claim-fee-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings ?? null, tx_error: out.tx_error ?? null }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
