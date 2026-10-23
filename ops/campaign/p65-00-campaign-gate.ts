/**
 * p65-00 · 活动任务体系后端门 · 迁移 0065 + campaign-service
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p57/p59b/p60/p61/p63 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/campaign/p65-00-campaign-gate.ts
 * 读数：`ops/campaign/readings/p65-campaign-gate-<RUN>.json`
 *
 * ★ 覆盖面（data §40.14 · route §49.18）：
 *   A · 静态面（零 DB）：注册点 109（get 49 / post 54 / patch 4 / delete 3 / put 0；job 下线后实测）· 九口在场 ·
 *       `/api/campaign/all` 注册在 `:ref` 之前 · 六条管理口闸 = `manage_tasks`（非 manage_rewards）·
 *       零新 kind（LEDGER_KINDS 仍 24，平台出账借 `invite_first_task_reward`）· 零新错误码（33 码不动）·
 *       迁移无 BEGIN/COMMIT、注释零 dollar-dollar、恰一个 DO 块 · seed 恰 5 类且无 poll ·
 *       五表 IF NOT EXISTS + 三条 CASCADE · 状态迁移矩阵 · 五类枚举常量 · 入参纯函数。
 *   B · 迁移干跑（真库 · 回滚事务内）：0065 头段 + 尾部 DO 全绿（五表 / 列数 9-14-**12**-4-7 —— subtask 12 列
 *       含 0072 的 reward_amount / 具名约束 /
 *       三 CASCADE / 两索引 / 三触发器 / seed 5 行逐字 / 版本行未写）· 重跑幂等（seed 不增行）·
 *       库面闸反证（status 越集 / 时间窗倒置 / 主奖 0 / 次币取 $ / 次币缺 cid / 未知 type_code /
 *       proof 审核态 / proof 一人两条 ⇒ 各自 SQLSTATE）。
 *   S · 服务层真路径（同事务 · `ex` 注入）：建活动（status 恒 draft、draft 公众 404 / 管理员 200）·
 *       状态机（draft→ended 409、draft→active 200、ended 后封板 409）· 建任务（主 $ + 可选次币 +
 *       内联 4 类子任务）· 公开列表嵌套（active 活动 → active 任务 → 全量子任务，snowflake 恒字符串）·
 *       凭证提交（通用类重提覆盖 200 且仍一行）· prediction 全链（截止前 settle 409 / 截止后投票 409 /
 *       重复投票 409 / 正确人数 0 ⇒ 整笔留平台 / floor 分发逐户对拍 + 余数进平台 / 重复 settle 409）·
 *       task 完成奖（未全完成 409；全完成 ⇒ 两币各一笔、幂等重放零新增）。
 *   S17–S19 · **登录态加性面（零新路由 / 零新表）**：
 *       S17 登录态详情每子任务 `my_proof` 键恒在场（回读到 payload 与 time_created，逐人 ballot 不同，未提交 ⇒ null）；
 *       S18 未登录详情 `my_proof` / `my_outcome` **键缺省**（≠ null），且加性成立（登录态键集 = 匿名键集 ＋ 至多两键）；
 *       S19 settled prediction 的 `my_outcome{choice,won,payout}` —— payout 与 settle `per_winner_amount`
 *           及**台账逐户真到账**三方对拍（输家 0、未投票 null、未结算无键、无人选对 ⇒ 0；反事实赢家数 1 ⇒ 101 ≠ 50）。
 *   N · **三臂负控（判据必须可红）**：
 *       ① 去 `subtask_proof_uniq` ⇒ 同一人重复投票可入（第二行可现）⇒ S 臂「重复投票 409 + 恰一行」必红；
 *       ② 去 floor 余数规则（改 ceil 分发）⇒ 两户各 51 = 102 ≠ 奖池 101（超额发放、余数变负）⇒
 *          S 臂「distributed + retained == prize 且 retained ≥ 0」必红；
 *       ③ 去「全部子任务完成」闸 ⇒ 零凭证用户可领完成奖（平台→用户分录可现）⇒ S 臂「未完成 409」必红。
 *   Z · 残留（mode-aware）：**事务前**取提交面基线（五表数 / 0065 版本行数），**事务后**读数须与基线
 *       逐项相等 ⇒ 本门全程单回滚事务、未向提交面额外写入。pre-apply 时基线 = 0/0（即旧的「无五表、
 *       无 0065 版本行」）；post-apply（dev 已 apply 0065）时基线 = 5/1（已 apply 稳态）。
 *
 *   0072（quiz 奖励列 `subtask.reward_amount`）同样**只在回滚事务内全量干跑**（ALTER + 两个 DO 块 + 尾部自检），
 *   随后 insertSubtask / 读口才拿得到该列 —— 提交面 DDL 零泄漏由 Z1 的 `reward_col` 前后相等守。
 *
 * 纪律：**不 apply、不写版本表**；一切 DDL / DML / 资金夹具都在回滚事务内（`inRollbackTx`），
 *   失败 / 须撤销的臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 *   · 服务层调用**一律注入 `ex`**（含读口 `listActiveCampaigns(ex)` / `getCampaignByRef(..., ex)` 与
 *     `postEvent({…, ex})`）：迁移干跑未提交 ⇒ 别的连接看不到五表（42P01）。
 *   · 台账条数按派生键 `<key>#<i>` 计（`deriveEventKey`）：多腿事件 = `key` + `key#2` …
 *     ⇒ `idempotency_key = k OR LIKE k || '#%'`，只等值匹配会少算。
 *   · 资金夹具：平台收入账户（uid = −1）**不得 mint**（`LEDGER_RESERVED_UID reason=MINT_TO_POOL`），
 *     只能用「用户付平台费（kind `currency_create_fee`、平台 credit 白名单内）」把平台收入垫高，
 *     再由 `invite_first_task_reward`（−1 唯一合法 debit kind）付出 —— 与生产口径同构。
 *     ★ **两腿各自垫高**：S14 的次币腿也从 −1 出账 ⇒ 次币侧同样走「owner 自铸 1000 给 U4
 *     （R23 自建单位只许 owner 铸）→ U4 付 500 `currency_create_fee` 给 −1」；只垫 $ 会让次币腿
 *     撞 `LEDGER_INSUFFICIENT_BALANCE`（`Available balance is insufficient`）整笔 tx 抛错。
 *   · SQL 切分前**先剥注释行**：0065 文件头大段 `--` 注释若并入第一条语句，首条 `CREATE TABLE` 就丢。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  CAMPAIGN_STATUS_TRANSITIONS,
  PLATFORM_PAYOUT_KIND,
  SUBTASK_TYPES,
  USD_CID,
  createCampaignVerb,
  createTaskVerb,
  derivePredictionOutcome,
  getCampaignByRef,
  grantTaskRewardVerb,
  isCampaignRef,
  listActiveCampaigns,
  parseCampaignPayload,
  parsePredictionChoice,
  parsePredictionPayload,
  parseTaskPayload,
  patchCampaignVerb,
  patchTaskVerb,
  settlePredictionVerb,
  submitProofVerb,
} from '../../backend-ts/src/campaign-service';
import { LEDGER_KINDS, postEvent } from '../../backend-ts/src/ledger';
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
const SVC = readSrc('backend-ts/src/campaign-service.ts');
const MIG65 = readSrc('backend-ts/migrations/0065_campaign_hierarchy.sql');
// 0068（p68 单）：createCampaignVerb 的 INSERT / 归属链读口需要 campaign.project_id 在场 ⇒ 干跑其头段（幂等）
const MIG68 = readSrc('backend-ts/migrations/0068_project_slug_campaign_link.sql');
// 0072（p72 单）：quiz 奖励列 `subtask.reward_amount` —— 服务层写口/读口都带该列 ⇒ 干跑（幂等）
const MIG72 = readSrc('backend-ts/migrations/0072_subtask_reward_and_quiz.sql');

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
const headOf = (src: string) => src.slice(0, src.indexOf('\nDO $$')).trim();
const tailOf = (src: string) => src.slice(src.indexOf('\nDO $$') + 1).trim();
const M65_HEAD = splitSqlStatements(headOf(MIG65));
const M65_TAIL = tailOf(MIG65);
// 0068 有 3 个 DO 块（两处幂等守卫 + 尾部自检）：头段须取到**最后一处 DO 之前**的全部 DDL
// （campaign ADD COLUMN project_id / FK / 索引在第一个 DO 之后）⇒ 用 lastIndexOf，别复用 MIG65 的 indexOf 语义。
const headBeforeLastDo = (src: string) => src.slice(0, src.lastIndexOf('\nDO $$')).trim();
const M68_HEAD = splitSqlStatements(headBeforeLastDo(MIG68));

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null }> => {
  const sp = `p65_${tag}`;
  await c.query(`SAVEPOINT ${sp}`);
  try {
    const value = await fn();
    await c.query(`ROLLBACK TO SAVEPOINT ${sp}`);
    return { value, sqlstate: null };
  } catch (e) {
    try { await c.query(`ROLLBACK TO SAVEPOINT ${sp}`); } catch { /* noop */ }
    return { value: null, sqlstate: String((e as { code?: string }).code ?? '') || null };
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
const viewOf = <T = Record<string, unknown>>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  ck.t('A1', '注册点 = 109（**job 体系下线后实测**；get 49 / post 54 / patch 4 / delete 3 / put 0）—— 本门九口与写口零改动（130 是 job 下线前的旧常量，属存量红，本单顺手改对）',
    regs === 110 && countVerb('get') === 49 && countVerb('post') === 54
      && countVerb('patch') === 4 && countVerb('delete') === 3 && countVerb('put') === 0,
    `regs=${regs} get=${countVerb('get')} post=${countVerb('post')} patch=${countVerb('patch')} delete=${countVerb('delete')}`);

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
  const missing = nine.filter((s) => INDEX_TS.indexOf(s) === -1);
  ck.t('A2', '九口逐条在场（R1–R9）', missing.length === 0, `missing=${JSON.stringify(missing)}`);
  ck.t('A3', '注册顺序：`/api/campaign/all` 在 `/api/campaign/:ref` **之前**（route #55）',
    INDEX_TS.indexOf("app.get('/api/campaign/all'") < INDEX_TS.indexOf("app.get('/api/campaign/:ref'"),
    `all=${INDEX_TS.indexOf("app.get('/api/campaign/all'")} ref=${INDEX_TS.indexOf("app.get('/api/campaign/:ref'")}`);

  const gateCount = (INDEX_TS.match(/requireAdmin\(req, res, 'manage_tasks'\)/g) ?? []).length;
  const CAMPAIGN_BLOCK = INDEX_TS.slice(
    INDEX_TS.indexOf("app.get('/api/campaign/all'"),
    INDEX_TS.indexOf("app.use((req, res) =>"),
  );
  const PROOF_ROUTE = CAMPAIGN_BLOCK.slice(
    CAMPAIGN_BLOCK.indexOf("app.post('/api/campaign/subtask/:subtaskId/proof'"),
    CAMPAIGN_BLOCK.indexOf("app.post('/api/campaign/subtask/:subtaskId/settle'"),
  );
  // 0068（p68）权限扩容：三个**创建口**（POST campaign / POST task / PATCH task）改走
  // `authorizeProjectScopedCreate`（manage_tasks 管理员 ∨ 在管项目 owner），其余管理口仍 `requireAdmin('manage_tasks')`。
  const scopedCreates = (INDEX_TS.match(/authorizeProjectScopedCreate\(/g) ?? []).length;
  ck.t('A4', '权限键：`requireAdmin(manage_tasks)` 仍 **4 处**（非创建口）· 创建口 **3 处**走 `authorizeProjectScopedCreate`（管理员 ∨ owner，p68 扩容）· 活动块内**零** manage_rewards · 提凭证口 = 登录闸 `requireActor`',
    gateCount === 4 && scopedCreates === 3
      && !/manage_rewards/.test(CAMPAIGN_BLOCK) && /requireActor\(req, res\)/.test(PROOF_ROUTE),
    `manage_tasks_gates=${gateCount} scoped_creates=${scopedCreates} block_has_manage_rewards=${/manage_rewards/.test(CAMPAIGN_BLOCK)} proof_uses_actor=${/requireActor\(req, res\)/.test(PROOF_ROUTE)}`);

  ck.t('A5', '零新 ledger kind：`LEDGER_KINDS` 仍 24 值，平台出账借 `invite_first_task_reward`（−1 唯一合法 debit）',
    LEDGER_KINDS.length === 24 && PLATFORM_PAYOUT_KIND === 'invite_first_task_reward'
      && (LEDGER_KINDS as readonly string[]).includes(PLATFORM_PAYOUT_KIND)
      && SVC.includes("PLATFORM_PAYOUT_KIND = 'invite_first_task_reward'"),
    `kinds=${LEDGER_KINDS.length} payout_kind=${PLATFORM_PAYOUT_KIND}`);
  ck.t('A6', '零新错误码：33 码闭集不动', LEDGER_ERROR_CODES.length === 33, `codes=${LEDGER_ERROR_CODES.length}`);

  const commentDollar = MIG65.split('\n').filter((l) => l.trim().startsWith('--') && l.includes('$$')).length;
  const doBlocks = (MIG65.match(/^DO \$\$/gm) ?? []).length;
  ck.t('A7', '迁移形状：无 BEGIN/COMMIT · 注释零 dollar-dollar · 恰一个 DO 块 · 零行首竖线',
    !/^\s*(BEGIN|COMMIT)\s*;/m.test(MIG65) && commentDollar === 0 && doBlocks === 1
      && MIG65.split('\n').filter((l) => l.startsWith('|')).length === 0,
    JSON.stringify({ comment_dollar: commentDollar, do_blocks: doBlocks, begin: /^\s*BEGIN\s*;/m.test(MIG65) }));

  const seedBlock = MIG65.slice(MIG65.indexOf('INSERT INTO public.subtask_type'), MIG65.indexOf('ON CONFLICT (type_code) DO NOTHING'));
  const seedCodes = SUBTASK_TYPES.map((t) => t.type_code);
  ck.t('A8', 'seed 恰 5 类逐字（x_verify/onchain_snapshot/survey/prediction/quiz）· 排序 1–5 · **无 poll**',
    seedCodes.length === 5 && seedCodes.join(',') === 'x_verify,onchain_snapshot,survey,prediction,quiz'
      && seedCodes.every((c) => seedBlock.includes(`'${c}'`)) && !/poll/.test(seedBlock)
      && SUBTASK_TYPES.every((t, i) => t.sort === i + 1)
      && /ON CONFLICT \(type_code\) DO NOTHING/.test(MIG65),
    JSON.stringify({ codes: seedCodes, has_poll: /poll/.test(seedBlock) }));
  const cascadeRefs = (MIG65.match(/REFERENCES public\.[a-z_]+\([a-z_]+\) ON DELETE CASCADE/g) ?? []).length;
  ck.t('A9', '五表 `CREATE TABLE IF NOT EXISTS` · 三条 CASCADE（task→campaign / subtask→task / proof→subtask）· 两索引',
    ['campaign', 'task', 'subtask', 'subtask_type', 'subtask_proof']
      .every((t) => new RegExp(`CREATE TABLE IF NOT EXISTS public\\.${t} \\(`).test(MIG65))
      && cascadeRefs === 3
      && /CREATE INDEX IF NOT EXISTS task_campaign_idx/.test(MIG65)
      && /CREATE INDEX IF NOT EXISTS subtask_task_idx/.test(MIG65),
    `cascade_fks=${cascadeRefs}`);
  ck.t('A10', '状态迁移矩阵：draft→{active} · active→{ended} · ended→∅（回退/跳变/封板后改写全 409）',
    JSON.stringify(CAMPAIGN_STATUS_TRANSITIONS) === JSON.stringify({ draft: ['active'], active: ['ended'], ended: [] }),
    JSON.stringify(CAMPAIGN_STATUS_TRANSITIONS));
  ck.t('A11', '迁移号 = 0065（0062 已被跳过、0063/0064 被项目域占用）· 旧迁移零改动痕迹',
    fs.existsSync(path.join(REPO_ROOT, 'backend-ts/migrations/0065_campaign_hierarchy.sql'))
      && !fs.existsSync(path.join(REPO_ROOT, 'backend-ts/migrations/0062_campaign.sql'))
      && !fs.existsSync(path.join(REPO_ROOT, 'backend-ts/migrations/0062_campaign_hierarchy.sql')),
    'files ok');

  // ---- 入参纯函数（零 DB）
  const errOf = (x: unknown): unknown =>
    (x && typeof x === 'object' && 'err' in (x as Record<string, unknown>) ? (x as { err: unknown }).err : x);
  const cForbid = parseCampaignPayload({ title: 'x', status: 'active' }, 'create');
  const cBadWin = parseCampaignPayload({ title: 'x', project_id: '1000', time_start: '2026-10-20T10:00:00Z', time_end: '2026-10-20T09:00:00Z' }, 'create');
  const cBadStatus = parseCampaignPayload({ title: 'x', status: 'archived' }, 'patch');
  const cOk = parseCampaignPayload({ title: 'x', project_id: '1000', description: 'd', time_start: '2026-10-20T09:00:00Z', time_end: '2026-10-21T09:00:00Z' }, 'create');
  const cNoProj = parseCampaignPayload({ title: 'x' }, 'create');
  ck.t('A12', '活动入参：建口禁带 status（400 NOT_SUPPORTED）· 缺 project_id 400（0068）· 时间窗倒置 400 · 状态越集 400 · 合法体通过',
    verbOf(errOf(cForbid)) === 400 && reasonOf(errOf(cForbid)) === 'NOT_SUPPORTED'
      && verbOf(errOf(cNoProj)) === 400 && reasonOf(errOf(cNoProj)) === 'CAMPAIGN_PROJECT_REQUIRED'
      && verbOf(errOf(cBadWin)) === 400 && reasonOf(errOf(cBadWin)) === 'CAMPAIGN_TIME_WINDOW_INVALID'
      && verbOf(errOf(cBadStatus)) === 400 && reasonOf(errOf(cBadStatus)) === 'CAMPAIGN_STATUS_INVALID'
      && 'payload' in cOk,
    JSON.stringify({ forbid: reasonOf(errOf(cForbid)), no_proj: reasonOf(errOf(cNoProj)), window: reasonOf(errOf(cBadWin)), status: reasonOf(errOf(cBadStatus)) }));

  const tNoReward = parseTaskPayload({ title: 'x' }, 'create');
  const tOneCid = parseTaskPayload({ title: 'x', reward_amount_primary: '100', reward_cid_secondary: '5' }, 'create');
  const tUsdSec = parseTaskPayload({ title: 'x', reward_amount_primary: '100', reward_cid_secondary: '1', reward_amount_secondary: '5' }, 'create');
  const tBadSubtask = parseTaskPayload({
    title: 'x', reward_amount_primary: '100',
    subtasks: [{ type_code: 'poll', title: 's' }],
  }, 'create');
  const tBadPred = parseTaskPayload({
    title: 'x', reward_amount_primary: '100',
    subtasks: [{ type_code: 'prediction', title: 'p', payload: { prize_amount: '10' } }],
  }, 'create');
  // quiz：新契约 = 四选项 + 正确答案 + 奖励列；缺奖励 ⇒ 400 QUIZ_REWARD_REQUIRED
  const QUIZ_FIXTURE_PAYLOAD = { options: { a: '甲', b: '乙', c: '丙', d: '丁' }, correct: ['a', 'c'] };
  const tQuizNoReward = parseTaskPayload({
    title: 'x', reward_amount_primary: '100',
    subtasks: [{ type_code: 'quiz', title: 'q', payload: QUIZ_FIXTURE_PAYLOAD }],
  }, 'create');
  const tQuizOk = parseTaskPayload({
    title: 'x', reward_amount_primary: '100',
    subtasks: [{ type_code: 'quiz', title: 'q', payload: QUIZ_FIXTURE_PAYLOAD, reward_amount: '7', required: true }],
  }, 'create');
  const tOk = parseTaskPayload({
    title: 'x', reward_amount_primary: '100', reward_cid_secondary: '5', reward_amount_secondary: '25',
    subtasks: [
      { type_code: 'quiz', title: 'q', payload: QUIZ_FIXTURE_PAYLOAD, reward_amount: '7', required: true },
      { type_code: 'prediction', title: 'p', payload: { prize_amount: '10', deadline: '2026-10-21T00:00:00Z' } },
    ],
  }, 'create');
  ck.t('A13', '任务入参：主奖缺 ⇒ 400 · 次币缺对 ⇒ 400 · 次币取 $ ⇒ 400（CP-N8）· 未知 type（poll）⇒ 400 · prediction 缺 deadline ⇒ 400 · **quiz 缺 reward_amount ⇒ 400 QUIZ_REWARD_REQUIRED**（新契约：答对即发奖 ⇒ 奖励列必填）· quiz 合法体（四选项+correct+reward）通过 · 混合体通过',
    verbOf(errOf(tNoReward)) === 400 && reasonOf(errOf(tNoReward)) === 'TASK_REWARD_PRIMARY_INVALID'
      && verbOf(errOf(tOneCid)) === 400 && reasonOf(errOf(tOneCid)) === 'TASK_REWARD_SECONDARY_PAIR_REQUIRED'
      && verbOf(errOf(tUsdSec)) === 400 && reasonOf(errOf(tUsdSec)) === 'TASK_REWARD_SECONDARY_CID_INVALID'
      && verbOf(errOf(tBadSubtask)) === 400 && reasonOf(errOf(tBadSubtask)) === 'SUBTASK_TYPE_INVALID'
      && verbOf(errOf(tBadPred)) === 400 && reasonOf(errOf(tBadPred)) === 'PREDICTION_PAYLOAD_SHAPE'
      && verbOf(errOf(tQuizNoReward)) === 400 && reasonOf(errOf(tQuizNoReward)) === 'QUIZ_REWARD_REQUIRED'
      && 'payload' in tQuizOk && 'payload' in tOk,
    JSON.stringify({
      no_reward: reasonOf(errOf(tNoReward)), one_cid: reasonOf(errOf(tOneCid)), usd_sec: reasonOf(errOf(tUsdSec)),
      bad_type: reasonOf(errOf(tBadSubtask)), bad_pred: reasonOf(errOf(tBadPred)),
      quiz_no_reward: reasonOf(errOf(tQuizNoReward)), quiz_ok: 'payload' in tQuizOk, ok: 'payload' in tOk,
    }));

  const pThreeOpt = parsePredictionPayload({ option_a: 'A', option_b: 'B', option_c: 'C', prize_amount: '10', deadline: '2026-10-21T00:00:00Z' });
  const pCurrency = parsePredictionPayload({ option_a: 'A', option_b: 'B', prize_amount: '10', deadline: '2026-10-21T00:00:00Z', currency_cid: '5' });
  const pZeroPrize = parsePredictionPayload({ option_a: 'A', option_b: 'B', prize_amount: '0', deadline: '2026-10-21T00:00:00Z' });
  const pOk = parsePredictionPayload({ option_a: 'A', option_b: 'B', prize_amount: '101', deadline: '2026-10-21T00:00:00Z' });
  const pNewOk = parsePredictionPayload({ prize_amount: '101', deadline: '2026-10-21T00:00:00Z' });
  // 混合形状（既有新两键又带 option_a）⇒ 落 legacy 支 ⇒ 缺 option_b ⇒ 400（禁双开的结构面证明）
  const pMixed = parsePredictionPayload({ option_a: 'A', prize_amount: '101', deadline: '2026-10-21T00:00:00Z' });
  const chExtra = parsePredictionChoice({ choice: 'a', note: 'x' }, 'ab_legacy');
  const chOut = parsePredictionChoice({ choice: 'c' }, 'yes_no');
  const chCrossStyle = parsePredictionChoice({ choice: 'a' }, 'yes_no');
  const chOk = parsePredictionChoice({ choice: 'b' }, 'ab_legacy');
  const chYes = parsePredictionChoice({ choice: 'yes' }, 'yes_no');
  ck.t('A14', 'prediction 入参**两形状**：三选项 ⇒ 400（未知键）· 币种键 ⇒ 400 PREDICTION_PRIZE_NOT_USD（CP-PN1）· prize 0 ⇒ 400 · **混合形状（新两键 ＋ option_a）⇒ 400 禁双开** · 新两键合法体 ⇒ `option_style=yes_no` 且 payload 不含 option_a/b · 投票：多键/越值 ⇒ 400 · **口径交叉（`ab_legacy` 行收 `yes`、`yes_no` 行收 `a`）⇒ 400** · 两口径各自合法体通过',
    verbOf(errOf(pThreeOpt)) === 400 && reasonOf(errOf(pThreeOpt)) === 'PREDICTION_PAYLOAD_SHAPE'
      && verbOf(errOf(pCurrency)) === 400 && reasonOf(errOf(pCurrency)) === 'PREDICTION_PRIZE_NOT_USD'
      && verbOf(errOf(pZeroPrize)) === 400 && reasonOf(errOf(pZeroPrize)) === 'PREDICTION_PRIZE_INVALID'
      && verbOf(errOf(pMixed)) === 400 && reasonOf(errOf(pMixed)) === 'PREDICTION_PAYLOAD_SHAPE'
      && !('err' in pNewOk) && pNewOk.option_style === 'yes_no'
      && !('option_a' in pNewOk.payload) && 'payload' in pOk && pOk.option_style === 'ab_legacy'
      && verbOf(errOf(chExtra)) === 400 && reasonOf(errOf(chExtra)) === 'PREDICTION_CHOICE_SHAPE'
      && verbOf(errOf(chOut)) === 400 && verbOf(errOf(chCrossStyle)) === 400
      && 'choice' in chOk && chOk.choice === 'b' && 'choice' in chYes && chYes.choice === 'yes',
    JSON.stringify({
      three: reasonOf(errOf(pThreeOpt)), currency: reasonOf(errOf(pCurrency)), zero: reasonOf(errOf(pZeroPrize)),
      mixed: reasonOf(errOf(pMixed)), new_style: ('err' in pNewOk ? 'err' : pNewOk.option_style),
      legacy_style: ('err' in pOk ? 'err' : pOk.option_style),
      extra: reasonOf(errOf(chExtra)), out: reasonOf(errOf(chOut)), cross_style: reasonOf(errOf(chCrossStyle)),
    }));
  ck.t('A15', '`isCampaignRef`：纯数字才放行（`all` / 非数字 / 空 ⇒ false ⇒ 路由落 404 而非 500）',
    isCampaignRef('123') && isCampaignRef('700000000000000001') && !isCampaignRef('all')
      && !isCampaignRef('12a') && !isCampaignRef(''), 'ok');

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  // ★ mode-aware（承「dev 已 apply ⇒ 同一门必红」纪律）：0065 已进 dev 库 ⇒ B1 断言「已 apply 稳态」；
  //   0068 已 apply ⇒ 0065 旧尾的「campaign 物理 9 列」过时（+project_id = 10）⇒ 跳过旧尾、期望前推。
  const applied65 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0065'"))[0]?.n ?? 0) > 0;
  const applied68 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0068'"))[0]?.n ?? 0) > 0;
  const MODE = applied65 ? 'post-apply' : 'pre-apply';
  out.mode = MODE;
  // ★ Z1 基线（**事务前**取提交面读数）：0065 已进 dev 库 ⇒ 「无五表 / 无版本行」是过时断言。
  //   改为「本门未额外写入」：事务后读数必须与事务前基线**逐项相等**（两种 mode 同一判据，判据数不减）。
  const committedResidue = async (): Promise<{ tables: number; version_rows: number; reward_col: number }> => {
    const t = await qRetry<{ n: number }>(pool,
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('campaign','task','subtask','subtask_type','subtask_proof')");
    const v = await qRetry<{ n: number }>(pool, "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0065'");
    // 0072 的 DDL 面残留：提交面上 subtask.reward_amount 列的存在性（pre-apply = 0 / 已 apply = 1）
    const c7 = await qRetry<{ n: number }>(pool,
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='subtask' AND column_name='reward_amount'");
    return { tables: Number(t[0]?.n ?? -1), version_rows: Number(v[0]?.n ?? -1), reward_col: Number(c7[0]?.n ?? -1) };
  };
  const baseline = await committedResidue();
  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as TxClient;
    const ledgerRows = async (key: string): Promise<number> => Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.ledger_entry WHERE idempotency_key = $1 OR idempotency_key LIKE $1 || '#%'",
      [key]))?.n ?? -1);
    const bal = async (uid: number | string, cid: number | string): Promise<string> =>
      String((await raw1<{ b: string }>(c,
        'SELECT COALESCE((SELECT balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint), 0)::text AS b',
        [String(uid), String(cid)]))?.b ?? '0');

    // ---- 夹具：四个新用户（rollback 内；evm 由 uid 派生 ⇒ 唯一）
    const uids: number[] = [];
    for (const base of [971001, 971002, 971003, 971004]) {
      const row = await raw1<{ uid: string }>(c,
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p65-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [U1, U2, U3, U4] = uids;
    R.fixture_users = uids;

    // ---- B1 · 迁移 0065 干跑（头段 + 尾部 DO；0068 已 apply ⇒ 旧尾 9 列断言过时 ⇒ 跳过旧尾）
    for (const stmt of M65_HEAD) await c.query(stmt);
    const before65 = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0065'");
    if (!applied68) await c.query(M65_TAIL);
    const after65 = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0065'");
    // ---- 0072 全量干跑（ALTER + 两个 DO 块，含尾部自检）：服务层 insertSubtask / 读口都带 reward_amount 列
    for (const stmt of splitSqlStatements(MIG72)) await c.query(stmt);
    const rewardCol = await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name='subtask' AND column_name='reward_amount'
          AND data_type='numeric' AND is_nullable='YES'`);

    const tables = await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('campaign','task','subtask','subtask_type','subtask_proof')");
    const cols = await raw<{ table_name: string; n: number }>(c,
      `SELECT table_name, count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name IN ('campaign','task','subtask','subtask_type','subtask_proof')
        GROUP BY table_name ORDER BY table_name`);
    const colMap = Object.fromEntries(cols.map((x) => [x.table_name, Number(x.n)]));
    const seedRows = await raw<{ type_code: string; label: string; sort: number; active: boolean }>(c,
      'SELECT type_code, label, sort, active FROM public.subtask_type ORDER BY sort');
    const cascades = await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM pg_constraint WHERE conname IN ('task_campaign_fk','subtask_task_fk','subtask_proof_subtask_fk') AND contype='f' AND confdeltype='c'");
    const uniqDef = await raw1<{ def: string }>(c,
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.subtask_proof'::regclass AND conname='subtask_proof_uniq'");
    const statusDef = await raw1<{ def: string }>(c,
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid='public.subtask_proof'::regclass AND conname='subtask_proof_status_check'");
    const idx = await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname IN ('task_campaign_idx','subtask_task_idx')");
    const trg = await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
        JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relname IN ('campaign','task','subtask')
          AND NOT t.tgisinternal AND t.tgenabled='O'
          AND t.tgname IN ('trg_campaign_touch_updated','trg_task_touch_updated','trg_subtask_touch_updated')`);
    const rewardCons = await raw1<{ n: number }>(c,
      `SELECT count(*)::int AS n FROM pg_constraint
        WHERE conrelid='public.subtask'::regclass AND conname='subtask_reward_amount_nonneg' AND contype='c'
          AND pg_get_constraintdef(oid) LIKE '%reward_amount%'`);
    ck.t('B1', `[${applied65 ? 'post-apply' : 'pre-apply'}] 0065 干跑全绿：五表 · 列数 ${applied68 ? '10' : '9'}/14/**12**/4/7（subtask 11 → **12**：0072 干跑加 reward_amount numeric NULL）${applied68 ? '（0068 已 apply ⇒ campaign=10 含 project_id，旧尾跳过、期望前推）' : ''} · 三 CASCADE · UNIQUE(subtask_id,uid) · proof status 单值 · 两索引 · 三触发器 · **0072 CHECK subtask_reward_amount_nonneg 在场** · ${applied65 ? '版本行 0065 稳态 1（干跑零新增）' : '版本行未写'}`,
      Number(tables?.n ?? 0) === 5 && colMap.campaign === (applied68 ? 10 : 9) && colMap.task === 14 && colMap.subtask === 12
        && colMap.subtask_type === 4 && colMap.subtask_proof === 7
        && Number(cascades?.n ?? 0) === 3 && /subtask_id/.test(String(uniqDef?.def ?? '')) && /uid/.test(String(uniqDef?.def ?? ''))
        && /submitted/.test(String(statusDef?.def ?? '')) && !/approved/.test(String(statusDef?.def ?? ''))
        && Number(idx?.n ?? 0) === 2 && Number(trg?.n ?? 0) === 3
        && Number(rewardCol?.n ?? 0) === 1 && Number(rewardCons?.n ?? 0) === 1
        && Number(before65?.n ?? -1) === (applied65 ? 1 : 0) && Number(after65?.n ?? -1) === (applied65 ? 1 : 0),
      JSON.stringify({ tables: tables?.n, cols: colMap, cascades: cascades?.n, uniq: uniqDef?.def, status: statusDef?.def, idx: idx?.n, trg: trg?.n, reward_col: rewardCol?.n, reward_check: rewardCons?.n, version: [before65?.n, after65?.n] }));

    ck.t('B2', 'seed 恰 5 行且 (type_code,label,sort) 与 §40.14.3 逐字一致 · 全 active · 无 poll',
      seedRows.length === 5
        && seedRows.map((x) => `${x.type_code}:${x.label}:${Number(x.sort)}:${x.active}`).join('|')
          === 'x_verify:X 验证:1:true|onchain_snapshot:链上快照:2:true|survey:问卷:3:true|prediction:预测:4:true|quiz:答题:5:true',
      JSON.stringify(seedRows));

    // 重跑头段（幂等）：表/seed 不增行
    for (const stmt of M65_HEAD) await c.query(stmt);
    const seedAgain = await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.subtask_type');
    ck.t('B3', '迁移幂等：头段**二次执行** ⇒ seed 仍恰 5 行（ON CONFLICT DO NOTHING）',
      Number(seedAgain?.n ?? -1) === 5, `seed_rows=${seedAgain?.n}`);

    // ---- 0068 头段干跑（幂等 · 回滚事务内）：createCampaignVerb 的 INSERT / 归属链读口需要 campaign.project_id
    //      与 project.slug 在场（pre-apply ⇒ 本事务内建列；post-apply ⇒ no-op）。跑在 B1 之后：0065 旧尾先验旧形状。
    for (const stmt of M68_HEAD) await c.query(stmt);

    // 活动挂载项目夹具：取种子项目（0064 十行）；无种子 ⇒ 直插一行（owner = U4，slug 列已在场）
    let FIXPROJ = String((await raw1<{ project_id: string }>(c,
      `SELECT project_id::text AS project_id FROM public.project
        WHERE title = 'Sui 生态推广' ORDER BY project_id LIMIT 1`))?.project_id ?? '');
    if (!FIXPROJ) {
      const insRow = await raw1<{ project_id: string }>(c,
        `INSERT INTO public.project
           (snowflake_id, owner_uid, title, slug, description, headcount, recruit_min_account_days,
            wage_batt_per_claim, wage_interval_hours, status)
         VALUES (9910000000000099, $1::bigint, 'p65 gate project', $2, 'p65-gate fixture', 5, 0, 10, 1, 'recruiting')
         RETURNING project_id::text AS project_id`,
        [String(U4), `p65-gate-${RUN.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`]);
      FIXPROJ = String(insRow?.project_id ?? '');
    }
    R.fixture_project = FIXPROJ;

    // ---- 资金夹具：平台收入账户只能「收平台费」垫高（−1 不得 mint），再由 invite_first_task_reward 付
    await postEvent({
      op: 'mint', uid: String(U4), cid: String(USD_CID), amount: '6000', platform: true,
      idempotencyKey: `ops:p65-gate:${RUN}:mint-usd`, memo: 'p65-gate usd fixture', ex,
    });
    await postEvent({
      op: 'entries', idempotencyKey: `ops:p65-gate:${RUN}:fund-platform`, refType: 'system', refId: '0',
      memo: 'p65-gate platform income fixture（用户付平台费 → −1 收入）',
      entries: [
        { uid: String(U4), cid: String(USD_CID), delta: '-5000', kind: 'currency_create_fee' },
        { uid: '-1', cid: String(USD_CID), delta: '5000', kind: 'currency_create_fee' },
      ],
      ex,
    });
    // ---- 次币夹具：SEC 归 U4（自建单位只许 owner 自铸 ⇒ R23 mint 授权），
    //      再由 U4 以 `currency_create_fee` 把 500 SEC 付给平台收入（−1）——
    //      task 完成奖的**次币腿**从 −1 出账（`invite_first_task_reward` 是 −1 唯一合法 debit），
    //      故 −1 必须先有次币余额；−1 不得 mint（`LEDGER_RESERVED_UID / MINT_TO_POOL`）。
    const secRows = await raw<{ cid: string }>(c,
      `INSERT INTO public.currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
       VALUES ($1, $2, $3::bigint, 0, 0, 'listed', now()) RETURNING cid::text AS cid`,
      [`p65g${RUN.slice(-8)}`.toLowerCase(), `p65-gate secondary ${RUN}`, String(U4)]);
    const SEC = Number(secRows[0].cid);
    await postEvent({
      op: 'mint', uid: String(U4), cid: String(SEC), amount: '1000',
      idempotencyKey: `ops:p65-gate:${RUN}:mint-sec`, memo: 'p65-gate sec fixture（owner 自铸 1000）', ex,
    });
    await postEvent({
      op: 'entries', idempotencyKey: `ops:p65-gate:${RUN}:fund-platform-sec`, refType: 'system', refId: '0',
      memo: 'p65-gate platform income fixture（次币腿：U4 付平台费 → −1 收入 500 SEC）',
      entries: [
        { uid: String(U4), cid: String(SEC), delta: '-500', kind: 'currency_create_fee' },
        { uid: '-1', cid: String(SEC), delta: '500', kind: 'currency_create_fee' },
      ],
      ex,
    });
    R.fixture_money = {
      sec_cid: SEC, platform_usd: await bal(-1, USD_CID), u4_usd: await bal(U4, USD_CID),
      platform_sec: await bal(-1, SEC), u4_sec: await bal(U4, SEC),
    };

    // ---- S1 · 建活动（status 恒 draft；draft 公众 404 / 管理员 200）
    const mkCampaign = (over: Record<string, unknown> = {}) =>
      createCampaignVerb({ body: { title: `p65 活动 ${RUN}-${Math.random().toString(36).slice(2, 7)}`, project_id: FIXPROJ, description: 'gate', ...over }, ex });
    const c1 = await mkCampaign();
    const C1 = String(viewOf<{ campaign_id?: string }>(c1).campaign_id ?? '');
    const C1_SF = String(viewOf<{ snowflake_id?: string }>(c1).snowflake_id ?? '');
    const c1Status = String(viewOf<{ status?: string }>(c1).status ?? '');
    const pubDraft = await getCampaignByRef(C1, { includeDraft: false }, ex);
    const admDraft = await getCampaignByRef(C1, { includeDraft: true }, ex);
    const bySf = await getCampaignByRef(C1_SF, { includeDraft: true }, ex);
    ck.t('S1', '建活动：status 恒 `draft` · snowflake 出参字符串 · 双形态详情命中（id / snowflake）· **draft 公众 404（null）/ 管理员 200**',
      c1.ok === true && c1Status === 'draft' && C1 !== '' && typeof viewOf<{ snowflake_id?: unknown }>(c1).snowflake_id === 'string'
        && pubDraft === null && admDraft !== null && bySf !== null,
      JSON.stringify({ ok: c1.ok, status: c1Status, snowflake: C1_SF, public_draft: pubDraft === null, admin_draft: admDraft !== null }));

    // ---- S2 · 状态机：draft→ended 409 · 时间窗非法 400 · draft→active 200
    const toEnded = await patchCampaignVerb({ ref: C1, body: { status: 'ended' }, ex });
    const badWindow = await patchCampaignVerb({ ref: C1, body: { time_start: '2026-10-20T10:00:00Z', time_end: '2026-10-19T10:00:00Z' }, ex });
    const toActive = await patchCampaignVerb({ ref: C1, body: { status: 'active' }, ex });
    const activeAgain = await patchCampaignVerb({ ref: C1, body: { status: 'active' }, ex });
    ck.t('S2', '状态机：`draft→ended` ⇒ 409 `campaign_invalid_transition` · 时间窗倒置 ⇒ 400 · `draft→active` ⇒ 200 · 同值写幂等 200',
      verbOf(toEnded) === 409 && reasonOf(toEnded) === 'campaign_invalid_transition'
        && verbOf(badWindow) === 400 && reasonOf(badWindow) === 'CAMPAIGN_TIME_WINDOW_INVALID'
        && toActive.ok === true && String(viewOf<{ status?: string }>(toActive).status) === 'active'
        && activeAgain.ok === true,
      JSON.stringify({ ended: [verbOf(toEnded), reasonOf(toEnded)], window: [verbOf(badWindow), reasonOf(badWindow)], active: viewOf<{ status?: string }>(toActive).status }));

    // ---- S3 · 建任务（主 $ + 次币 + 内联 4 类子任务；prediction 一过一未过）
    const pastDl = new Date(Date.now() - 3600 * 1000).toISOString();
    const futureDl = new Date(Date.now() + 3600 * 1000).toISOString();
    const mkTask = (over: Record<string, unknown> = {}) => createTaskVerb({
      campaignRef: C1,
      body: {
        title: `p65 任务 ${RUN}-${Math.random().toString(36).slice(2, 7)}`,
        description: 'gate task',
        reward_amount_primary: '100',
        reward_cid_secondary: String(SEC),
        reward_amount_secondary: '25',
        subtasks: [
          { type_code: 'x_verify', title: 'X 验证', payload: { screenshots: ['m1'], links: ['https://x.com/a'] }, required: true },
          // prediction 新契约：**恰两键**（选项文案由前端 i18n 恒 Yes / No）+ 投票值域 yes|no
          { type_code: 'prediction', title: '预测（待截止）', payload: { prize_amount: '101', deadline: futureDl } },
          { type_code: 'prediction', title: '预测（未截止）', payload: { prize_amount: '50', deadline: futureDl } },
          // quiz 新契约：四选项 + correct（服务端密钥）+ 奖励列（答对即发）
          { type_code: 'quiz', title: '答题', payload: QUIZ_FIXTURE_PAYLOAD, reward_amount: '7' },
        ],
        ...over,
      },
      ex,
    });
    const t1 = await mkTask();
    const T1 = String(viewOf<{ task_id?: string }>(t1).task_id ?? '');
    const T1_SF = String(viewOf<{ snowflake_id?: string }>(t1).snowflake_id ?? '');
    const subs = viewOf<{ subtasks?: Array<Record<string, unknown>> }>(t1).subtasks ?? [];
    const byType = (code: string) => String(subs.find((s) => String(s.type_code) === code)?.subtask_id ?? '');
    const X_VERIFY = byType('x_verify');
    const PRED_PAST = String(subs.filter((s) => String(s.type_code) === 'prediction')[0]?.subtask_id ?? '');
    const PRED_FUTURE = String(subs.filter((s) => String(s.type_code) === 'prediction')[1]?.subtask_id ?? '');
    const QUIZ = byType('quiz');
    ck.t('S3', '建任务：status 恒 draft · 主奖 100$ + 次币 25 · 内联 4 子任务（x_verify / 2×prediction / quiz）· 全部 snowflake 字符串',
      t1.ok === true && String(viewOf<{ status?: string }>(t1).status) === 'draft'
        && String(viewOf<{ reward_amount_primary?: string }>(t1).reward_amount_primary) === '100'
        && String(viewOf<{ reward_amount_secondary?: string }>(t1).reward_amount_secondary) === '25'
        && subs.length === 4 && X_VERIFY !== '' && PRED_PAST !== '' && PRED_FUTURE !== '' && QUIZ !== ''
        && subs.every((s) => typeof s.snowflake_id === 'string')
        && subs.filter((s) => String(s.type_code) === 'prediction').every((s) => s.prediction_state === 'open'),
      JSON.stringify({ ok: t1.ok, subtasks: subs.length, ids: { X_VERIFY, PRED_PAST, PRED_FUTURE, QUIZ }, states: subs.map((s) => s.prediction_state) }));

    // ---- B4 · 库面闸反证（savepoint 内直插，逐条取 SQLSTATE）
    const C1_ID = C1;
    const probe = async (tag: string, sql: string, params: unknown[] = []) =>
      undoAfter(c, tag, async () => { await c.query(sql, params); return 'inserted'; });
    const dbChecks: Record<string, string | null> = {};
    dbChecks.campaign_status = (await probe('b4a',
      `INSERT INTO public.campaign (snowflake_id, project_id, title, status) VALUES (9910000000000001, $1::bigint, 'x', 'archived')`, [FIXPROJ])).sqlstate;
    dbChecks.campaign_window = (await probe('b4b',
      `INSERT INTO public.campaign (snowflake_id, project_id, title, time_start, time_end)
       VALUES (9910000000000002, $1::bigint, 'x', now(), now() - interval '1 hour')`, [FIXPROJ])).sqlstate;
    dbChecks.task_reward_zero = (await probe('b4c',
      `INSERT INTO public.task (snowflake_id, campaign_id, title, reward_amount_primary)
       VALUES (9910000000000003, $1::bigint, 'x', 0)`, [C1_ID])).sqlstate;
    dbChecks.task_secondary_usd = (await probe('b4d',
      `INSERT INTO public.task (snowflake_id, campaign_id, title, reward_amount_primary, reward_cid_secondary, reward_amount_secondary)
       VALUES (9910000000000004, $1::bigint, 'x', 100, 1, 5)`, [C1_ID])).sqlstate;
    dbChecks.task_secondary_unpaired = (await probe('b4e',
      `INSERT INTO public.task (snowflake_id, campaign_id, title, reward_amount_primary, reward_amount_secondary)
       VALUES (9910000000000005, $1::bigint, 'x', 100, 5)`, [C1_ID])).sqlstate;
    dbChecks.subtask_unknown_type = (await probe('b4f',
      `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title)
       VALUES (9910000000000006, $1::bigint, 'poll', 'x')`, [T1])).sqlstate;
    dbChecks.subtask_payload_array = (await probe('b4g',
      `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title, payload)
       VALUES (9910000000000007, $1::bigint, 'quiz', 'x', '[1,2]'::jsonb)`, [T1])).sqlstate;
    dbChecks.proof_audit_state = (await probe('b4h',
      `INSERT INTO public.subtask_proof (subtask_id, uid, payload, status)
       VALUES ($1::bigint, $2::bigint, '{}'::jsonb, 'approved')`, [QUIZ, String(U4)])).sqlstate;
    const proofDup = await undoAfter(c, 'b4i', async () => {
      await c.query(`INSERT INTO public.subtask_proof (subtask_id, uid, payload) VALUES ($1::bigint, $2::bigint, '{"answers":{}}'::jsonb)`, [QUIZ, String(U4)]);
      await c.query(`INSERT INTO public.subtask_proof (subtask_id, uid, payload) VALUES ($1::bigint, $2::bigint, '{"answers":{}}'::jsonb)`, [QUIZ, String(U4)]);
      return 'two_rows';
    });
    dbChecks.proof_dup = proofDup.sqlstate;
    ck.t('B4', '库面闸反证：status 越集 23514 · 时间窗倒置 23514 · 主奖 0 ⇒ 23514 · 次币取 $ ⇒ 23514 · 次币缺 cid ⇒ 23514 · 未知 type ⇒ 23503 · payload 数组 ⇒ 23514 · proof 审核态 ⇒ 23514 · proof 一人两条 ⇒ 23505',
      dbChecks.campaign_status === '23514' && dbChecks.campaign_window === '23514'
        && dbChecks.task_reward_zero === '23514' && dbChecks.task_secondary_usd === '23514'
        && dbChecks.task_secondary_unpaired === '23514' && dbChecks.subtask_unknown_type === '23503'
        && dbChecks.subtask_payload_array === '23514' && dbChecks.proof_audit_state === '23514'
        && dbChecks.proof_dup === '23505',
      JSON.stringify(dbChecks));

    // ---- S4 · 公开列表嵌套（任务需先 active）
    const tActive = await patchTaskVerb({ ref: T1, body: { status: 'active' }, ex });
    const listed = await listActiveCampaigns(ex);
    const listedC1 = listed.find((x) => x.campaign_id === C1);
    const listedT1 = listedC1?.tasks.find((x) => x.task_id === T1);
    ck.t('S4', '公开列表：active 活动嵌套 active 任务 → 全量子任务 · snowflake 全字符串 · 任务 draft→active 200',
      tActive.ok === true && listed.length >= 1 && Boolean(listedC1) && Boolean(listedT1)
        && (listedT1?.subtasks.length ?? 0) === 4
        && typeof listedC1?.snowflake_id === 'string' && typeof listedT1?.snowflake_id === 'string'
        && listedT1?.subtasks.every((s) => typeof s.snowflake_id === 'string') === true,
      JSON.stringify({ t_active: tActive.ok, campaigns: listed.length, tasks: listedC1?.tasks.length, subtasks: listedT1?.subtasks.length }));

    // ---- S5 · 凭证闸：非 active 链 ⇒ 409
    const c2 = await mkCampaign({ title: `p65 草稿活动 ${RUN}` });
    const C2 = String(viewOf<{ campaign_id?: string }>(c2).campaign_id ?? '');
    const t2 = await createTaskVerb({
      campaignRef: C2,
      body: { title: 'draft task', reward_amount_primary: '10', subtasks: [{ type_code: 'survey', title: 's', payload: { answers: { q: '1' } } }] },
      ex,
    });
    const T2_SUB = String((viewOf<{ subtasks?: Array<Record<string, unknown>> }>(t2).subtasks ?? [])[0]?.subtask_id ?? '');
    const proofOnDraft = await submitProofVerb({ actorUid: U1, subtaskRef: T2_SUB, body: { answers: { q: '1' } }, ex });
    ck.t('S5', '凭证闸链：任务/活动非 active ⇒ 409 `campaign_not_active`（零写副作用）',
      verbOf(proofOnDraft) === 409 && reasonOf(proofOnDraft) === 'campaign_not_active',
      JSON.stringify({ status: verbOf(proofOnDraft), reason: reasonOf(proofOnDraft) }));

    // ---- S6 · 通用凭证：提交即通过 · 重提覆盖 200 · 仍恰一行
    const p1 = await submitProofVerb({ actorUid: U1, subtaskRef: X_VERIFY, body: { screenshots: ['m1'], links: ['https://x.com/a'] }, ex });
    const p1again = await submitProofVerb({ actorUid: U1, subtaskRef: X_VERIFY, body: { screenshots: ['m1', 'm2'], links: [] }, ex });
    const xRows = await raw1<{ n: number }>(c,
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint AND uid = $2::bigint', [X_VERIFY, String(U1)]);
    const xPayload = await raw1<{ shots: number }>(c,
      "SELECT jsonb_array_length(payload->'screenshots')::int AS shots FROM public.subtask_proof WHERE subtask_id = $1::bigint AND uid = $2::bigint",
      [X_VERIFY, String(U1)]);
    ck.t('S6', '通用凭证：首次 200 · 重提 200 **覆盖**（screenshots 1→2）· 行数仍恰 1 · status 恒 submitted（零审核态）',
      p1.ok === true && p1again.ok === true && Number(xRows?.n ?? -1) === 1
        && Number(xPayload?.shots ?? -1) === 2 && String(viewOf<{ status?: string }>(p1again).status) === 'submitted',
      JSON.stringify({ first: p1.ok, again: p1again.ok, rows: xRows?.n, shots: xPayload?.shots, status: viewOf<{ status?: string }>(p1again).status }));

    const badPayload = await submitProofVerb({ actorUid: U2, subtaskRef: X_VERIFY, body: { answers: { q: 1 } }, ex });
    const unknownKey = await submitProofVerb({ actorUid: U2, subtaskRef: X_VERIFY, body: { foo: 1 }, ex });
    ck.t('S7', '凭证 payload 闭集：类型↔键族错配 400 `PROOF_PAYLOAD_TYPE_MISMATCH` · 未知键 400 `PROOF_PAYLOAD_UNKNOWN_KEY`',
      verbOf(badPayload) === 400 && reasonOf(badPayload) === 'PROOF_PAYLOAD_TYPE_MISMATCH'
        && verbOf(unknownKey) === 400 && reasonOf(unknownKey) === 'PROOF_PAYLOAD_UNKNOWN_KEY',
      JSON.stringify({ mismatch: reasonOf(badPayload), unknown: reasonOf(unknownKey) }));

    // ---- S8 · prediction 投票：一人一票（重提 409）· 截止后拒票（新契约值域 yes|no）
    const vote = (uid: number, sub: string, choice: 'yes' | 'no') =>
      submitProofVerb({ actorUid: uid, subtaskRef: sub, body: { choice }, ex });
    const v1 = await vote(U1, PRED_PAST, 'yes');
    const v2 = await vote(U2, PRED_PAST, 'yes');
    const v3 = await vote(U3, PRED_PAST, 'no');
    const v1again = await vote(U1, PRED_PAST, 'no');
    const pastVoteRows = await raw1<{ n: number }>(c,
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint', [PRED_PAST]);
    // 时间推进夹具：把 deadline 推到过去（等价于「到点」，零新列零定时器 ⇒ 读时派生即切换）
    await c.query(
      `UPDATE public.subtask SET payload = payload || jsonb_build_object('deadline', $2::text) WHERE subtask_id = $1::bigint`,
      [PRED_PAST, pastDl],
    );
    const lateVote = await vote(U4, PRED_PAST, 'yes');
    const stateAfter = await raw1<{ payload: Record<string, unknown> }>(c, 'SELECT payload FROM public.subtask WHERE subtask_id = $1::bigint', [PRED_PAST]);
    ck.t('S8', 'prediction 投票：三票各 200 · **重提 409 `prediction_vote_locked`**（票数仍 3、choice 未改写）· 到点后投票 409 `prediction_deadline_passed`',
      v1.ok === true && v2.ok === true && v3.ok === true
        && verbOf(v1again) === 409 && reasonOf(v1again) === 'prediction_vote_locked'
        && Number(pastVoteRows?.n ?? -1) === 3
        && verbOf(lateVote) === 409 && reasonOf(lateVote) === 'prediction_deadline_passed'
        && String((stateAfter?.payload ?? {}).correct_option ?? '') === '',
      JSON.stringify({ votes: [v1.ok, v2.ok, v3.ok], again: [verbOf(v1again), reasonOf(v1again)], rows: pastVoteRows?.n, late: [verbOf(lateVote), reasonOf(lateVote)] }));

    // ---- S9 · settle 闸：未截止 409 · 非 prediction 400 · 重复 settle 409（S11）
    await vote(U1, PRED_FUTURE, 'yes');
    const early = await settlePredictionVerb({ subtaskRef: PRED_FUTURE, body: { correct_option: 'yes' }, ex });
    const wrongType = await settlePredictionVerb({ subtaskRef: X_VERIFY, body: { correct_option: 'yes' }, ex });
    ck.t('S9', 'settle 闸：deadline 前 ⇒ 409 `prediction_deadline_not_reached`（零分发）· 非 prediction 子任务 ⇒ 400 `PREDICTION_TYPE_MISMATCH`',
      verbOf(early) === 409 && reasonOf(early) === 'prediction_deadline_not_reached'
        && verbOf(wrongType) === 400 && reasonOf(wrongType) === 'PREDICTION_TYPE_MISMATCH',
      JSON.stringify({ early: [verbOf(early), reasonOf(early)], wrong_type: [verbOf(wrongType), reasonOf(wrongType)] }));

    // ---- S10 · settle 分发：prize 101 / 选对 2 人 ⇒ 各 50、余 1 进平台（floor）
    const u1Before = BigInt(await bal(U1, USD_CID));
    const u2Before = BigInt(await bal(U2, USD_CID));
    const u3Before = BigInt(await bal(U3, USD_CID));
    const platBefore = BigInt(await bal(-1, USD_CID));
    const settleKey = `biz:campaign:settle:${PRED_PAST}:yes`;
    const settled = await settlePredictionVerb({ subtaskRef: PRED_PAST, body: { correct_option: 'yes' }, ex });
    const sv = viewOf<Record<string, unknown>>(settled);
    const rowAfter = await raw1<{ payload: Record<string, unknown> }>(c, 'SELECT payload FROM public.subtask WHERE subtask_id = $1::bigint', [PRED_PAST]);
    ck.t('S10', 'settle 分发（floor + 余数进平台）：prize 101 / 选对 2 ⇒ per 50 · distributed 100 · retained 1 · 台账 3 条 · 逐户 +50 · 平台 −100 · correct_option 回填 · state settled',
      settled.ok === true && Number(sv.prize_amount) === 101 && Number(sv.winner_count) === 2
        && Number(sv.per_winner_amount) === 50 && Number(sv.distributed_total) === 100
        && Number(sv.platform_retained) === 1 && Number(sv.ledger_entries) === 3
        && BigInt(await bal(U1, USD_CID)) - u1Before === 50n
        && BigInt(await bal(U2, USD_CID)) - u2Before === 50n
        && BigInt(await bal(U3, USD_CID)) - u3Before === 0n
        && platBefore - BigInt(await bal(-1, USD_CID)) === 100n
        && String((rowAfter?.payload ?? {}).correct_option ?? '') === 'yes'
        && Number(await ledgerRows(settleKey)) === 3,
      JSON.stringify({ ok: settled.ok, ...sv, deltas: { u1: (BigInt(await bal(U1, USD_CID)) - u1Before).toString(), platform: (platBefore - BigInt(await bal(-1, USD_CID))).toString() }, backfill: (rowAfter?.payload ?? {}).correct_option }));

    // ---- S11 · 重复 settle ⇒ 409（一次性封板）· 零第二笔分发
    const settleAgain = await settlePredictionVerb({ subtaskRef: PRED_PAST, body: { correct_option: 'no' }, ex });
    const ledAfterRepeat = await ledgerRows(settleKey);
    ck.t('S11', '重复 settle ⇒ 409 `prediction_already_settled` · 分发台账**仍 3 条**（禁二次分发）· 首票结论未被改写',
      verbOf(settleAgain) === 409 && reasonOf(settleAgain) === 'prediction_already_settled' && ledAfterRepeat === 3,
      JSON.stringify({ status: verbOf(settleAgain), reason: reasonOf(settleAgain), entries: ledAfterRepeat }));

    // ---- S12 · 正确人数 0 ⇒ 整笔留平台（零分录）
    const tZero = await createTaskVerb({
      campaignRef: C1,
      body: {
        title: 'zero-winner task', reward_amount_primary: '10',
        subtasks: [{ type_code: 'prediction', title: '无人选对', payload: { prize_amount: '77', deadline: futureDl } }],
      },
      ex,
    });
    const T_ZERO = String(viewOf<{ task_id?: string }>(tZero).task_id ?? '');
    const ZERO_SUB = String((viewOf<{ subtasks?: Array<Record<string, unknown>> }>(tZero).subtasks ?? [])[0]?.subtask_id ?? '');
    await patchTaskVerb({ ref: T_ZERO, body: { status: 'active' }, ex });
    await vote(U3, ZERO_SUB, 'no');
    // 时间推进：到点后才可 settle
    await c.query(
      `UPDATE public.subtask SET payload = payload || jsonb_build_object('deadline', $2::text) WHERE subtask_id = $1::bigint`,
      [ZERO_SUB, pastDl],
    );
    const platBeforeZero = BigInt(await bal(-1, USD_CID));
    const settledZero = await settlePredictionVerb({ subtaskRef: ZERO_SUB, body: { correct_option: 'yes' }, ex });
    const zv = viewOf<Record<string, unknown>>(settledZero);
    ck.t('S12', '选对人数 = 0 ⇒ winner 0 · per 0 · distributed 0 · **retained 77 整笔留平台** · 零台账分录 · 平台余额不变 · 仍封板',
      settledZero.ok === true && Number(zv.winner_count) === 0 && Number(zv.distributed_total) === 0
        && Number(zv.platform_retained) === 77 && Number(zv.ledger_entries) === 0
        && BigInt(await bal(-1, USD_CID)) === platBeforeZero
        && (await settlePredictionVerb({ subtaskRef: ZERO_SUB, body: { correct_option: 'no' }, ex })).ok === false,
      JSON.stringify({ ok: settledZero.ok, ...zv, platform_delta: (BigInt(await bal(-1, USD_CID)) - platBeforeZero).toString() }));

    // ---- S13 · task 完成奖闸：未完成 ⇒ 409
    const earlyReward = await grantTaskRewardVerb({ ref: T1, body: { uid: U1 }, headerKey: undefined, ex });
    const countsBefore = await raw1<{ total: number; done: number }>(c,
      `SELECT (SELECT count(*)::int FROM public.subtask WHERE task_id=$1::bigint) AS total,
              (SELECT count(*)::int FROM public.subtask s WHERE s.task_id=$1::bigint
                AND EXISTS (SELECT 1 FROM public.subtask_proof p WHERE p.subtask_id=s.subtask_id AND p.uid=$2::bigint)) AS done`,
      [T1, String(U1)]);
    ck.t('S13', 'task 完成奖闸：U1 缺 2 项凭证 ⇒ 409 `task_reward_incomplete`（total/done 逐字回显，零发放）',
      verbOf(earlyReward) === 409 && reasonOf(earlyReward) === 'task_reward_incomplete'
        && Number((earlyReward as { details?: { total_subtasks?: number } }).details?.total_subtasks ?? -1) === Number(countsBefore?.total ?? -2)
        && Number((earlyReward as { details?: { completed_subtasks?: number } }).details?.completed_subtasks ?? -1) === Number(countsBefore?.done ?? -2),
      JSON.stringify({ status: verbOf(earlyReward), reason: reasonOf(earlyReward), counts: countsBefore }));

    // ---- S14 · 补齐凭证 ⇒ 完成奖两币各一笔 + 幂等
    await submitProofVerb({ actorUid: U1, subtaskRef: PRED_FUTURE, body: { choice: 'yes' }, ex });
    const quizProof = await submitProofVerb({ actorUid: U1, subtaskRef: QUIZ, body: { answers: { picks: ['b'] } }, ex });
    const u1UsdBefore = BigInt(await bal(U1, USD_CID));
    const u1SecBefore = BigInt(await bal(U1, SEC));
    const platUsdBefore = BigInt(await bal(-1, USD_CID));
    const platSecBefore = BigInt(await bal(-1, SEC));
    const rewardKey = `cli:p65-gate-${RUN}-reward`;
    const reward = await grantTaskRewardVerb({ ref: T1, body: { uid: U1 }, headerKey: rewardKey, ex });
    const rewardEntries = await ledgerRows(rewardKey);
    const rewardEntriesSec = await ledgerRows(`${rewardKey}:secondary`);
    const rewardReplay = await grantTaskRewardVerb({ ref: T1, body: { uid: U1 }, headerKey: rewardKey, ex });
    const rewardEntriesAfter = await ledgerRows(rewardKey);
    ck.t('S14', 'task 完成奖：全完成 ⇒ 200 · $ 100 与次币 25 **各一笔（各 2 腿）** · 用户/平台双边对拍 · 同键重放 ⇒ replay 零新增',
      reward.ok === true && String(viewOf<{ reward_amount_primary?: string }>(reward).reward_amount_primary) === '100'
        && String(viewOf<{ reward_amount_secondary?: string }>(reward).reward_amount_secondary) === '25'
        && BigInt(await bal(U1, USD_CID)) - u1UsdBefore === 100n
        && BigInt(await bal(U1, SEC)) - u1SecBefore === 25n
        && platUsdBefore - BigInt(await bal(-1, USD_CID)) === 100n
        && platSecBefore - BigInt(await bal(-1, SEC)) === 25n
        && rewardEntries === 2 && rewardEntriesSec === 2
        && rewardReplay.ok === true && (rewardReplay as { replay?: boolean }).replay === true
        && (await ledgerRows(rewardKey)) === rewardEntriesAfter
        // quiz 答错（correct=[a,c]，投 b）⇒ proof 落库、奖励零发（发奖账实由 p72 门独占）
        && quizProof.ok === true && String((viewOf<{ reward_paid?: string }>(quizProof)).reward_paid) === '0',
      JSON.stringify({
        ok: reward.ok, entries: [rewardEntries, rewardEntriesSec], replay: (rewardReplay as { replay?: boolean }).replay,
        quiz_reward_paid: viewOf<{ reward_paid?: string }>(quizProof).reward_paid,
        repro_entries: rewardEntriesAfter,
        deltas: { usd: (BigInt(await bal(U1, USD_CID)) - u1UsdBefore).toString(), sec: (BigInt(await bal(U1, SEC)) - u1SecBefore).toString() },
      }));

    // ---- S15 · 子任务整组 upsert（永不 DELETE）· ended 封板
    const tBeforePatch = await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.subtask WHERE task_id = $1::bigint', [T1]);
    const patchedTask = await patchTaskVerb({
      ref: T1,
      body: {
        subtasks: [
          { subtask_id: QUIZ, type_code: 'quiz', title: '答题（改名）', payload: QUIZ_FIXTURE_PAYLOAD, reward_amount: '9', required: true },
          { type_code: 'survey', title: '新增问卷', payload: { answers: { q: 'a' } } },
        ],
      },
      ex,
    });
    const tAfterPatch = await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.subtask WHERE task_id = $1::bigint', [T1]);
    const quizAfterPatch = await raw1<{ title: string; reward_amount: string | null }>(c,
      'SELECT title, reward_amount::text AS reward_amount FROM public.subtask WHERE subtask_id = $1::bigint', [QUIZ]);
    ck.t('S15', '子任务写口：带 id ⇒ 更新（标题改写生效 · **奖励列 7 → 9 随整组 upsert 落库**）· 不带 ⇒ 插入 · **永不 DELETE**（4 → 5 行）· 整组 upsert 200',
      patchedTask.ok === true && Number(tBeforePatch?.n ?? -1) === 4 && Number(tAfterPatch?.n ?? -1) === 5
        && /改名/.test(String(quizAfterPatch?.title ?? '')) && String(quizAfterPatch?.reward_amount ?? '') === '9',
      JSON.stringify({ before: tBeforePatch?.n, after: tAfterPatch?.n, quiz_title: quizAfterPatch?.title, reward_amount: quizAfterPatch?.reward_amount }));

    const c1End = await patchCampaignVerb({ ref: C1, body: { status: 'ended' }, ex });
    const patchAfterEnd = await patchCampaignVerb({ ref: C1, body: { title: 'nope' }, ex });
    const taskAfterEnd = await patchTaskVerb({ ref: T1, body: { title: 'nope' }, ex });
    const taskAddAfterEnd = await createTaskVerb({ campaignRef: C1, body: { title: 'x', reward_amount_primary: '10' }, ex });
    ck.t('S16', 'ended = 终态封板：活动改 409 `campaign_ended_frozen` · 任务改 409 · ended 后加任务 409',
      c1End.ok === true && verbOf(patchAfterEnd) === 409 && reasonOf(patchAfterEnd) === 'campaign_ended_frozen'
        && verbOf(taskAfterEnd) === 409 && verbOf(taskAddAfterEnd) === 409,
      JSON.stringify({ end: c1End.ok, campaign_patch: [verbOf(patchAfterEnd), reasonOf(patchAfterEnd)], task_patch: [verbOf(taskAfterEnd), reasonOf(taskAfterEnd)], task_add: [verbOf(taskAddAfterEnd), reasonOf(taskAddAfterEnd)] }));

    // ==================================================================== S17–S19 · 登录态加性面（零新路由）
    // 口径：**登录态** ⇒ 每子任务 `my_proof`（`null` = 未提交）＋ settled prediction 的 `my_outcome`；
    //       **匿名** ⇒ 两键**缺省**（不是 null）⇒ 前端据「键是否在场」区分「匿名」与「未提交」。
    const flatOf = (v: unknown) => ((v as { tasks?: Array<{ subtasks?: unknown[] }> } | null)?.tasks ?? [])
      .flatMap((t) => ((t.subtasks ?? []) as Array<Record<string, unknown>>));
    const subOf = (list: Array<Record<string, unknown>>, id: string) => list.find((s) => String(s.subtask_id) === id);
    const detailU1 = await getCampaignByRef(C1, { includeDraft: true, viewerUid: U1 }, ex);
    const detailU3 = await getCampaignByRef(C1, { includeDraft: true, viewerUid: U3 }, ex);
    const flatU1 = flatOf(detailU1);
    const flatU3 = flatOf(detailU3);
    const xProofU1 = (subOf(flatU1, X_VERIFY)?.my_proof ?? null) as { payload: Record<string, unknown>; time_created: string | null } | null;
    const predProofU1 = (subOf(flatU1, PRED_PAST)?.my_proof ?? null) as { payload: Record<string, unknown> } | null;
    const predProofU3 = (subOf(flatU3, PRED_PAST)?.my_proof ?? null) as { payload: Record<string, unknown> } | null;
    const surveyU1 = flatU1.find((s) => String(s.type_code) === 'survey');
    ck.t('S17', '★登录态详情加性 `my_proof`：每子任务键**恒在场**（`null` = 未提交）· U1 通用凭证回读 screenshots 2 条 + `time_created` ISO · 投票 choice 逐人不同（U1 yes / U3 no）· 未提交子任务 ⇒ `null`（非缺键）',
      detailU1 !== null && flatU1.length > 0 && flatU1.every((s) => 'my_proof' in s)
        && xProofU1 !== null && Number((xProofU1.payload.screenshots as unknown[] | undefined)?.length ?? -1) === 2
        && typeof xProofU1.time_created === 'string' && !Number.isNaN(Date.parse(String(xProofU1.time_created)))
        && predProofU1 !== null && String(predProofU1.payload.choice ?? '') === 'yes'
        && predProofU3 !== null && String(predProofU3.payload.choice ?? '') === 'no'
        && surveyU1 !== undefined && surveyU1.my_proof === null,
      JSON.stringify({
        subtasks: flatU1.length, keys_all_present: flatU1.every((s) => 'my_proof' in s),
        x_shots: (xProofU1?.payload.screenshots as unknown[] | undefined)?.length ?? null,
        x_time: xProofU1?.time_created ?? null,
        choice: { u1: predProofU1?.payload.choice ?? null, u3: predProofU3?.payload.choice ?? null },
        unvoted: surveyU1 ? surveyU1.my_proof : 'no_survey',
      }));

    const detailAnon = await getCampaignByRef(C1, { includeDraft: false }, ex);
    const detailAnonNull = await getCampaignByRef(C1, { includeDraft: false, viewerUid: null }, ex);
    const flatAnon = flatOf(detailAnon);
    const flatAnonNull = flatOf(detailAnonNull);
    const anonBody = JSON.stringify(detailAnon ?? {});
    const keysOf = (list: Array<Record<string, unknown>>) => list.map((s) => Object.keys(s).sort().join(','));
    // 加性判据：登录态键集 = 匿名键集 ＋ 至多 {my_proof, my_outcome}（既有键一个不多一个不少）
    const additiveOk = flatAnon.length === flatU1.length && flatAnon.every((s, i) => {
      const base = new Set(Object.keys(s));
      const extra = Object.keys(flatU1[i]).filter((k) => !base.has(k));
      return extra.every((k) => k === 'my_proof' || k === 'my_outcome');
    });
    ck.t('S18', '★未登录详情**无** `my_proof` / `my_outcome` 键（缺省 ≠ null）· 显式 `viewerUid: null` 同形 · 加性成立：登录态键集 = 匿名键集 ＋ 至多两键（既有键零变化）',
      detailAnon !== null && flatAnon.length > 0
        && flatAnon.every((s) => !('my_proof' in s) && !('my_outcome' in s))
        && !anonBody.includes('my_proof') && !anonBody.includes('my_outcome')
        && detailAnonNull !== null && JSON.stringify(keysOf(flatAnonNull)) === JSON.stringify(keysOf(flatAnon))
        && additiveOk,
      JSON.stringify({
        subtasks: flatAnon.length, anon_keys: keysOf(flatAnon)[0] ?? null,
        has_my_proof: anonBody.includes('my_proof'), has_my_outcome: anonBody.includes('my_outcome'),
        additive: additiveOk, same_shape: JSON.stringify(keysOf(flatAnonNull)) === JSON.stringify(keysOf(flatAnon)),
      }));

    // 到账额对拍：**按 settle 幂等键逐户汇总 `ledger_entry.delta`**（服务端真到账，不是算出来的）
    const paidOf = async (uid: number, key: string): Promise<string> => String((await raw1<{ s: string }>(c,
      `SELECT COALESCE(sum(delta), 0)::text AS s FROM public.ledger_entry
        WHERE uid = $1::bigint AND (idempotency_key = $2::text OR idempotency_key LIKE $2::text || '#%')`,
      [String(uid), key]))?.s ?? '');
    const svPer = String(sv.per_winner_amount ?? '');
    const u1Paid = await paidOf(U1, settleKey);
    const u3Paid = await paidOf(U3, settleKey);
    const detailU4 = await getCampaignByRef(C1, { includeDraft: true, viewerUid: U4 }, ex);
    const flatU4 = flatOf(detailU4);
    const out1 = subOf(flatU1, PRED_PAST)?.my_outcome as { choice?: string; won?: boolean; payout?: string } | null | undefined;
    const out3 = subOf(flatU3, PRED_PAST)?.my_outcome as { choice?: string; won?: boolean; payout?: string } | null | undefined;
    const out4Sub = subOf(flatU4, PRED_PAST);
    const out4 = out4Sub?.my_outcome as { choice?: string; won?: boolean; payout?: string } | null | undefined;
    const futureSub = subOf(flatU1, PRED_FUTURE);
    const outZero = flatU3.find((s) => String(s.subtask_id) === ZERO_SUB)?.my_outcome as
      { choice?: string; won?: boolean; payout?: string } | null | undefined;
    // 灵敏度自证：同一人、赢家人数按 1 算 ⇒ payout 应变 101（≠ 实测 50）⇒ 判据对「赢家人数」敏感、payout 非写死
    const cfPer = String(derivePredictionOutcome(
      (subOf(flatU1, PRED_PAST)?.payload ?? {}) as Record<string, unknown>,
      { payload: { choice: 'yes' }, time_created: null },
      1,
    )?.payout ?? '');
    ck.t('S19', '★`my_outcome` = `{choice, won, payout}` 且 **payout 对拍服务端真到账**：U1 选对 ⇒ won · payout 50 = settle `per_winner_amount` = 台账该户 +50 · U3 选错 ⇒ won false · payout 0 = 台账 0 · U4 未投票 ⇒ `null`（键在场）· 未结算 prediction 无该键 · 无人选对 ⇒ 输家 payout 0 · 反事实（赢家数 1）⇒ 101 ≠ 50（判据可红）',
      detailU1 !== null && detailU3 !== null && detailU4 !== null
        && out1 !== undefined && out1 !== null && String(out1.choice) === 'yes' && out1.won === true
        && String(out1.payout) === svPer && String(out1.payout) === u1Paid && BigInt(u1Paid) > 0n
        && out3 !== undefined && out3 !== null && String(out3.choice) === 'no' && out3.won === false
        && String(out3.payout) === '0' && u3Paid === '0'
        && out4Sub !== undefined && 'my_outcome' in out4Sub && out4 === null
        && futureSub !== undefined && !('my_outcome' in futureSub) && futureSub.prediction_state === 'open'
        && outZero !== undefined && outZero !== null && outZero.won === false && String(outZero.payout) === '0'
        && cfPer === '101' && cfPer !== String(out1.payout),
      JSON.stringify({
        u1: out1 ?? null, u3: out3 ?? null, u4: out4 === undefined ? 'missing' : out4,
        zero_winner_arm: outZero ?? null, ledger: { u1: u1Paid, u3: u3Paid, per_winner: svPer },
        unsettled_has_key: futureSub ? 'my_outcome' in futureSub : 'missing', counterfactual_per: cfPer,
      }));

    // ==================================================================== N · 三臂负控
    // ① 去 UNIQUE ⇒ 同一人重复投票可入（第二行可现）；复 UNIQUE ⇒ 23505
    const nc1 = await undoAfter(c, 'nc1', async () => {
      await c.query('ALTER TABLE public.subtask_proof DROP CONSTRAINT subtask_proof_uniq');
      await c.query(`INSERT INTO public.subtask_proof (subtask_id, uid, payload) VALUES ($1::bigint, $2::bigint, '{"choice":"no"}'::jsonb)`,
        [PRED_PAST, String(U1)]);
      return Number((await raw1<{ n: number }>(c,
        'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint AND uid = $2::bigint',
        [PRED_PAST, String(U1)]))?.n ?? -1);
    });
    const nc1Keep = await undoAfter(c, 'nc1b', async () => {
      await c.query(`INSERT INTO public.subtask_proof (subtask_id, uid, payload) VALUES ($1::bigint, $2::bigint, '{"choice":"no"}'::jsonb)`,
        [PRED_PAST, String(U1)]);
      return 'inserted';
    });
    ck.t('N1', '★负控① 一人一票：**去 UNIQUE** ⇒ 同人投票可现第二行（=2）；**复 UNIQUE** ⇒ 23505。⇒ S8「重提 409 ＋ 恰 3 票」判据对唯一约束敏感',
      nc1.sqlstate === null && Number(nc1.value ?? 0) === 2 && nc1Keep.sqlstate === '23505',
      JSON.stringify({ without_uniq: { rows: nc1.value, sqlstate: nc1.sqlstate }, with_uniq: nc1Keep.sqlstate }));

    // ② 去 floor 余数规则 ⇒ ceil 分发超额（51×2 = 102 ≠ 奖池 101）⇒ 「distributed + retained == prize」必红
    const prize = 101n;
    const floorShare = prize / 2n; // 50
    const measuredTotal = BigInt(String(sv.distributed_total ?? '0'));
    const measuredRetained = BigInt(String(sv.platform_retained ?? '0'));
    const ceilShare = (prize + 1n) / 2n; // 51
    const nc2 = await undoAfter(c, 'nc2', async () => {
      // 反事实：按 ceil 分发（= 去掉 floor + 余数进平台的规则），在平台 → 两户之间真落分录
      await postEvent({
        op: 'entries', idempotencyKey: `ops:p65-gate:${RUN}:nc2-ceil`, refType: 'system', refId: PRED_PAST,
        memo: 'nc2 counterfactual: ceil split (no floor remainder rule)',
        entries: [
          { uid: '-1', cid: String(USD_CID), delta: (-(ceilShare * 2n)).toString(), kind: PLATFORM_PAYOUT_KIND },
          { uid: String(U1), cid: String(USD_CID), delta: ceilShare.toString(), kind: PLATFORM_PAYOUT_KIND },
          { uid: String(U2), cid: String(USD_CID), delta: ceilShare.toString(), kind: PLATFORM_PAYOUT_KIND },
        ],
        ex,
      });
      const paid = ceilShare * 2n;
      return { paid: paid.toString(), retained: (prize - paid).toString() };
    });
    const ceilPaid = BigInt(String((nc2.value as { paid?: string } | null)?.paid ?? '0'));
    const ceilRetained = BigInt(String((nc2.value as { retained?: string } | null)?.retained ?? '0'));
    ck.t('N2', '★负控② floor 余数：实测 distributed 100 + retained 1 = 奖池 101（retained ≥ 0）；**去 floor 改 ceil** ⇒ 51×2 = 102 > 101、retained = −1（超额发放）⇒ S10 的守恒判据必红',
      measuredTotal + measuredRetained === prize && measuredRetained >= 0n && floorShare === 50n
        && nc2.sqlstate === null && ceilPaid === 102n && ceilRetained === -1n && ceilPaid !== measuredTotal,
      JSON.stringify({ measured: { distributed: measuredTotal.toString(), retained: measuredRetained.toString(), sum: (measuredTotal + measuredRetained).toString() }, ceil_arm: nc2.value, floor_share: floorShare.toString() }));

    // ③ 去「全部完成」闸 ⇒ 零凭证用户可领完成奖（平台 → 用户分录可现）
    const earlyByBypass = await undoAfter(c, 'nc3', async () => {
      const u2BeforeBal = BigInt(await bal(U2, USD_CID));
      await postEvent({
        op: 'entries', idempotencyKey: `ops:p65-gate:${RUN}:nc3-early`, refType: 'system', refId: T1,
        memo: 'nc3 counterfactual: reward without completion gate',
        entries: [
          { uid: '-1', cid: String(USD_CID), delta: '-100', kind: PLATFORM_PAYOUT_KIND },
          { uid: String(U2), cid: String(USD_CID), delta: '100', kind: PLATFORM_PAYOUT_KIND },
        ],
        ex,
      });
      const u2AfterBal = BigInt(await bal(U2, USD_CID));
      const u2Proofs = Number((await raw1<{ n: number }>(c,
        'SELECT count(*)::int AS n FROM public.subtask_proof WHERE uid = $1::bigint', [String(U2)]))?.n ?? -1);
      return { delta: (u2AfterBal - u2BeforeBal).toString(), u2_proofs: u2Proofs };
    });
    ck.t('N3', '★负控③ 完成闸：U2 仅 1 条凭证（远未完成）⇒ 实测 409 `task_reward_incomplete` 零发放；**去闸直发** ⇒ 平台→U2 +100 分录可现 ⇒ 「未完成不发」判据必红',
      verbOf(earlyReward) === 409
        && Number((earlyByBypass.value as { delta?: string } | null)?.delta ?? '0') === 100
        && Number((earlyByBypass.value as { u2_proofs?: number } | null)?.u2_proofs ?? 0) < 4,
      JSON.stringify({ verb: [verbOf(earlyReward), reasonOf(earlyReward)], bypass: earlyByBypass.value }));

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
    // mode-aware 判据：**事务前后逐项相等** ⇒ 本门没有向提交面写入任何东西。
    //   pre-apply（基线 tables=0 / version_rows=0）等价于旧的「无五表、无 0065 版本行」；
    //   post-apply（dev 已 apply 0065）基线 = 五表 + 版本行 1，仍然是「零残留」的同一口径。
    const after = await committedResidue();
    const sameTables = after.tables === baseline.tables;
    const sameVersion = after.version_rows === baseline.version_rows;
    const sameRewardCol = after.reward_col === baseline.reward_col;
    ck.t('Z1', `[${MODE}] 零残留（mode-aware）：提交面五表数、0065 版本行数、**0072 的 subtask.reward_amount 列存在性** 三项**事务前 = 事务后**（本门全程单回滚事务，0072 只在事务内干跑 ⇒ DDL 未泄漏到提交面；基线 tables=${baseline.tables} / version_rows=${baseline.version_rows} / reward_col=${baseline.reward_col}${applied65 ? ' = 已 apply 稳态' : ' = 未 apply ⇒ 即「无五表、无版本行、无奖励列」'}）`,
      sameTables && sameVersion && sameRewardCol,
      JSON.stringify({ mode: MODE, baseline, after, same_tables: sameTables, same_version_rows: sameVersion, same_reward_col: sameRewardCol }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p65-campaign-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings ?? null }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
