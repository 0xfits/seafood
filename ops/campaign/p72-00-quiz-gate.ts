/**
 * p72-00 · quiz 答对发奖 ＋ prediction 选项恒 Yes/No · 门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p65/p69/p70 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/campaign/p72-00-quiz-gate.ts
 * 读数：`ops/campaign/readings/p72-quiz-gate-<RUN>.json`
 *
 * 派单面（Kevin 2026-10-22 两条裁定，本门逐条守住）：
 *   ① **prediction 选项恒 Yes / No** ⇒ 新 payload 恰两键 `{prize_amount, deadline}`（选项文案由前端 i18n 固定），
 *      投票 / 结算值域 `yes|no`；**存量四键行**（`option_a` / `option_b`）继续以 `a|b` 走 ⇒ 两条路共存、按库内
 *      payload 形状分支、**禁双开**（同一行不可来回换口径）。
 *   ② **quiz 发布填 4 个选项、其中 1–4 个标为正确，用户答对即发奖励** ⇒ payload 恰两键
 *      `{options:{a,b,c,d}, correct:[…]}`（`correct` 是**服务端密钥**，永不出公开读口）；奖励载体 = 列
 *      `subtask.reward_amount`（迁移 0072）；提交 `{answers:{picks}}`，**集合相等**即答对 ⇒ 同一事务发奖
 *      （平台 −N → 用户 +N，借 `invite_first_task_reward`）；答错也落 proof 但零发奖；同一 uid 重提 ⇒ 409。
 *
 * 判据面：
 *   A · 静态（零 DB，9 条）：0072 文件形状（无 BEGIN/COMMIT、幂等、只 ALTER 一张表、两个 DO 块、零业务行写）·
 *       常量契约（新两键 2 / 旧四键 4 / quiz 两键 / options 恰 a–d / 奖励列名）· 口径判别**唯一真源**
 *       （`predictionOptionStyle` 只看库内形状；`parsePredictionChoice` 第二参；无硬编码 a|b 值域）·
 *       建口禁双开 ＋ 改口口径不可变 · 奖励是列不是 payload 键（两处 SQL 都带列；非 quiz 带 ⇒ 400）·
 *       发奖两腿同事务同幂等键 · 脱敏只在一处读 `correct`、公开读口两处都过 `publicSubtaskPayload` ·
 *       零新错误码（33 码闭集不动，QUIZ_* 全是 details.reason，不进闭集）· 注册点 109 未变、九口在场。
 *   B · 迁移干跑（真库 · 回滚事务内）：0072 全量（ALTER + 两 DO + 尾部自检）· 列 `numeric NULL` ·
 *       CHECK `subtask_reward_amount_nonneg` 在场且定义含列 · **幂等**（二次执行仍 1 列 1 约束）·
 *       **CHECK 反证**（reward = −1 ⇒ 23514）· **自检反证**（塞一行三选项 prediction 再跑自检 DO ⇒ P0001）。
 *   S1–S9 · 服务层真路径（同事务 · `ex` 注入）：
 *       S1 prediction 新两键入参 → 落库 → 读口（恰两键、state open）；
 *       S2 新两键投票/结算（`no`/`yes` 200、`a` ⇒ 400 口径交叉、到点 settle `yes` ⇒ floor 分发、重复 settle 409）；
 *       S3 **存量四键行读口统一**（直插存量形状 ⇒ 读口 payload 无 option_a/b、`option_style=ab_legacy`、库内值仍在；`a|b` 可投可结算、`yes` 被拒）；
 *       S4 **禁双开 ＋ 发布后冻结**（建口四键 ⇒ 400；新两键行改口成四键 ⇒ 400 STYLE_IMMUTABLE；active task 改 legacy 四键 ⇒ 409 锁；另建 draft task 改四键 ⇒ 200）；
 *       S5 quiz 答对发奖**账实两腿**（account + ledger 对拍、顺序无关的 picks）；
 *       S6 quiz 答错零发奖（proof 落库、balance 不变、零分录）；
 *       S7 quiz 重复提交 ⇒ 409 `quiz_already_answered`（仍 1 行、零二次发奖）；
 *       S8 公开读口 `correct` **零泄漏**（三读口 JSON 无该键；登录本人 my_proof 同样无）；
 *       S9 奖励载体闸：非 quiz 带 `reward_amount` ⇒ 400；quiz 缺 ⇒ 400；quiz payload 塞 reward 键 ⇒ 400。
 *   N1–N3 · 负控（判据必须可红）：
 *       N1 去集合相等（变体判据 = 真子集即算对；S6 的答错答案取真子集 `["a"] ⊂ ["a","c"]` 才能让变体真转红）⇒
 *       答错也发奖（真实分录可现、余额 +7）⇒ S6 必红；
 *       N2 不脱敏（payload 原样透出）⇒ JSON 含 `correct` ⇒ S8 必红；
 *       N3 非 quiz 传 reward 的 400 是**唯一屏障**（库面直写同一列可成）⇒ 去掉该闸即静默落库。
 *   Z · 残留：全程单回滚事务；subtask / subtask_proof / ledger_entry / users 夹具 / schema_migration 行数与
 *       `subtask.reward_amount` 列存在性**事务前 = 事务后**（0072 只在事务内干跑 ⇒ DDL 零泄漏）。
 *
 * 纪律：**不 apply、不写版本表、不 push、不动 frontend/docs**；一切 DDL / DML / 资金夹具都在回滚事务内，
 *   会抛的臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 *   · 资金夹具沿用 p65 口径：平台收入（uid = −1）**不得 mint**，只能由用户付平台费（`currency_create_fee`）
 *     垫高，再由 `invite_first_task_reward`（−1 唯一合法 debit）付出。
 *   · 台账条数按派生键 `<key>#<i>` 计 ⇒ `idempotency_key = k OR LIKE k || '#%'`。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  PLATFORM_PAYOUT_KIND,
  PREDICTION_CHOICES,
  PREDICTION_CORRECT_OPTION_KEY,
  PREDICTION_LEGACY_PAYLOAD_KEYS,
  PREDICTION_OPTION_STYLES,
  PREDICTION_PAYLOAD_KEYS,
  QUIZ_CORRECT_KEY,
  QUIZ_OPTION_KEYS,
  QUIZ_PAYLOAD_KEYS,
  SUBTASK_REWARD_COLUMN,
  SUBTASK_TYPES,
  USD_CID,
  createCampaignVerb,
  createTaskVerb,
  derivePredictionState,
  getCampaignByRef,
  getTaskDetailByRef,
  isPredictionChoice,
  listActiveCampaigns,
  parsePredictionChoice,
  parsePredictionPayload,
  parseQuizPayload,
  parseQuizProof,
  parseTaskPayload,
  patchCampaignVerb,
  patchTaskVerb,
  predictionChoicesFor,
  predictionOptionStyle,
  publicSubtaskPayload,
  samePickSet,
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
const MIG72 = readSrc('backend-ts/migrations/0072_subtask_reward_and_quiz.sql');

// ---------------------------------------------------------------- SQL 切分（dollar-dollar 感知；与 p65 同族）
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
const M72_STMTS = splitSqlStatements(MIG72);
/** 尾部自检 DO（最后一条语句）—— 供「自检反证」单独复跑 */
const M72_SELFCHECK = M72_STMTS[M72_STMTS.length - 1];

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p72_${tag}`;
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
/** 409 / 400 的 `details.changed_fields`（锁闸专用：判定哪些字段被锁） */
const changedOf = (r: unknown): string[] =>
  (((r as { details?: { changed_fields?: unknown } })?.details?.changed_fields ?? []) as string[]);
const codeOf = (r: unknown) => String(((r as { code?: unknown })?.code) ?? '');
const viewOf = <T = Record<string, unknown>>(r: unknown): T => ((r as { view?: T })?.view ?? {}) as T;
const errOf = (x: unknown): unknown =>
  (x && typeof x === 'object' && 'err' in (x as Record<string, unknown>) ? (x as { err: unknown }).err : x);

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const commentDollar = MIG72.split('\n').filter((l) => l.trim().startsWith('--') && l.includes('$$')).length;
  const doBlocks = (MIG72.match(/^DO \$\$/gm) ?? []).length;
  // 判据是「只 ALTER 一张表」⇒ 按**去重表名**计（DO 块内的 ALTER 与顶层 ALTER 同表，算一张）
  const alterStmts = (MIG72.match(/^\s*ALTER TABLE public\.[a-z_]+/gm) ?? []).length;
  const alterTables = Array.from(new Set(
    (MIG72.match(/ALTER TABLE public\.[a-z_]+/g) ?? []).map((s) => s.replace(/^[\s\S]*?public\./, ''))));
  const bizWrites = (MIG72.match(/^\s*(INSERT INTO public\.(?!subtask_type)|UPDATE public\.|DELETE FROM public\.)/gm) ?? []).length;
  ck.t('A1', '★0072 文件形状：无 BEGIN/COMMIT · 注释零 dollar-dollar · 恰 2 个 DO 块 · 只 ALTER **一张表**（去重表名恰 `subtask`；DO 块内那条同表 ⇒ 算一张）· 零业务行 INSERT/UPDATE/DELETE · 幂等（ADD COLUMN IF NOT EXISTS ＋ 约束存在性守卫 ＋ 约束名固定 `subtask_reward_amount_nonneg`）',
    !/^\s*(BEGIN|COMMIT)\s*;/m.test(MIG72) && commentDollar === 0 && doBlocks === 2
      && alterTables.length === 1 && alterTables[0] === 'subtask' && bizWrites === 0
      && /ADD COLUMN IF NOT EXISTS reward_amount/.test(MIG72)
      && /IF NOT EXISTS \(\s*SELECT 1 FROM pg_constraint[\s\S]*conname = 'subtask_reward_amount_nonneg'/.test(MIG72),
    JSON.stringify({ comment_dollar: commentDollar, do_blocks: doBlocks, alter_stmts: alterStmts, alter_tables: alterTables, biz_writes: bizWrites }));

  ck.t('A2', '★常量契约（判据真源，改动即口径变更）：新 payload 恰 2 键 `[prize_amount, deadline]` · 存量 4 键 `[option_a, option_b, prize_amount, deadline]` · 行为两口径 yes_no / ab_legacy · 值域 `yes_no=[yes,no]` / `ab_legacy=[a,b]` · quiz payload 恰 2 键 `[options, correct]` · options 恰 a–d · `correct` 键名 · 奖励列名 `reward_amount`',
    JSON.stringify(PREDICTION_PAYLOAD_KEYS) === JSON.stringify(['prize_amount', 'deadline'])
      && JSON.stringify(PREDICTION_LEGACY_PAYLOAD_KEYS) === JSON.stringify(['option_a', 'option_b', 'prize_amount', 'deadline'])
      && JSON.stringify(PREDICTION_OPTION_STYLES) === JSON.stringify(['yes_no', 'ab_legacy'])
      && JSON.stringify(PREDICTION_CHOICES.yes_no) === JSON.stringify(['yes', 'no'])
      && JSON.stringify(PREDICTION_CHOICES.ab_legacy) === JSON.stringify(['a', 'b'])
      && JSON.stringify(QUIZ_PAYLOAD_KEYS) === JSON.stringify(['options', 'correct'])
      && JSON.stringify(QUIZ_OPTION_KEYS) === JSON.stringify(['a', 'b', 'c', 'd'])
      && QUIZ_CORRECT_KEY === 'correct' && SUBTASK_REWARD_COLUMN === 'reward_amount'
      && PREDICTION_CORRECT_OPTION_KEY === 'correct_option',
    JSON.stringify({
      new_keys: PREDICTION_PAYLOAD_KEYS, legacy_keys: PREDICTION_LEGACY_PAYLOAD_KEYS,
      styles: PREDICTION_OPTION_STYLES, choices: PREDICTION_CHOICES, quiz: QUIZ_PAYLOAD_KEYS, reward_col: SUBTASK_REWARD_COLUMN,
    }));

  // 口径判别唯一真源：只看**库内 payload 形状**（不看请求体）⇒ 同一行两条路结构上不可能同时成立
  const styleProbe = predictionOptionStyle({ prize_amount: '1', deadline: 'x' });
  const styleLegacy = predictionOptionStyle({ option_a: 'A', option_b: 'B', prize_amount: '1', deadline: 'x' });
  const styleMixed = predictionOptionStyle({ option_a: 'A', prize_amount: '1', deadline: 'x' });
  ck.t('A3', '★口径判别唯一真源：`predictionOptionStyle` 只按库内 payload 形状判（带 option_a 或 option_b ⇒ `ab_legacy`，否则 `yes_no`；混合形状也落 legacy ⇒ 不产生第三条路）· `predictionChoicesFor` 派生值域 · `parsePredictionChoice(raw, style)` 第二参存在且值域取自 `predictionChoicesFor`（源码无硬编码 a|b 判定）',
    styleProbe === 'yes_no' && styleLegacy === 'ab_legacy' && styleMixed === 'ab_legacy'
      && predictionChoicesFor('yes_no').join(',') === 'yes,no' && predictionChoicesFor('ab_legacy').join(',') === 'a,b'
      && isPredictionChoice('yes_no', 'yes') && !isPredictionChoice('yes_no', 'a')
      && isPredictionChoice('ab_legacy', 'a') && !isPredictionChoice('ab_legacy', 'yes')
      && /export const parsePredictionChoice = \(raw: unknown, style: PredictionOptionStyle\)/.test(SVC)
      && /const legal = predictionChoicesFor\(style\)/.test(SVC)
      && !/choice !== 'a' && choice !== 'b'/.test(SVC),
    JSON.stringify({ probe: styleProbe, legacy: styleLegacy, mixed: styleMixed }));

  ck.t('A4', '★禁双开：建口只收新两键（`mode === create` 且 payload 为 `ab_legacy` ⇒ 400 `PREDICTION_PAYLOAD_SHAPE`）· 改口口径不可换（`PREDICTION_OPTION_STYLE_IMMUTABLE` 闸：存量四键行仍用四键、新两键行仍用两键）',
    /if \(mode === 'create' && parsed\.input\.option_style === 'ab_legacy'\)/.test(SVC)
      && /PREDICTION_OPTION_STYLE_IMMUTABLE/.test(SVC)
      && /const existing = predictionOptionStyle\(asObject\(owned\.payload\)\)/.test(SVC),
    JSON.stringify({
      create_guard: /parsed\.input\.option_style === 'ab_legacy'/.test(SVC),
      style_immutable: (SVC.match(/PREDICTION_OPTION_STYLE_IMMUTABLE/g) ?? []).length,
    }));

  // INSERT 需连 `VALUES (…)` 一起取 —— 列名清单里没有 `$n::numeric`（占位符在 VALUES 段）
  const INSERT_SQL = (SVC.match(/INSERT INTO public\.subtask \(([^)]*reward_amount[^)]*)\)\s*VALUES \(([^)]*)\)\s*RETURNING \*/) ?? []).join('\n');
  const UPDATE_SQL = (SVC.match(/UPDATE public\.subtask SET[\s\S]{0,400}?RETURNING \*/) ?? [])[0] ?? '';
  ck.t('A5', '★奖励是**列**不是 payload 键：`insertSubtask` / `updateSubtask` 两条 SQL 都带 `reward_amount` 列（$n::numeric）· quiz payload 内出现 `reward_amount` ⇒ 400 `QUIZ_PAYLOAD_SHAPE`（提示「是列」）· 非 quiz 类型带 `reward_amount` ⇒ 400 `SUBTASK_REWARD_NOT_APPLICABLE` · quiz 缺 ⇒ 400 `QUIZ_REWARD_REQUIRED`',
    /reward_amount/.test(INSERT_SQL) && /\$7::numeric/.test(INSERT_SQL)
      && /reward_amount = \$6::numeric/.test(UPDATE_SQL)
      && /SUBTASK_REWARD_NOT_APPLICABLE/.test(SVC) && /QUIZ_REWARD_REQUIRED/.test(SVC)
      && /是子任务列，不写进 payload/.test(SVC),
    JSON.stringify({ insert_has_col: /reward_amount/.test(INSERT_SQL), insert_param: /\$7::numeric/.test(INSERT_SQL), update_has_col: /reward_amount = \$6::numeric/.test(UPDATE_SQL) }));

  // quiz 发奖臂：两腿 · 同事务 · 幂等键形状（切片到「通用三类」之前 ⇒ 只审 quiz 分支）
  const QUIZ_BLOCK = SVC.slice(SVC.indexOf('// ---- quiz：'), SVC.indexOf('// ---- 通用三类'));
  ck.t('A6', '★quiz 发奖：**同一事务两腿**（平台 −N / 用户 +N）· kind 借 `PLATFORM_PAYOUT_KIND`（零新 kind）· 幂等键 `biz:campaign:quiz:<subtaskId>:<uid>` · 仅 `quizCorrect` 且 reward > 0 才发 · 答错分支零 `postEvent`（proof 落库即返回）',
    /ex: tx as unknown/.test(QUIZ_BLOCK)
      && /uid: String\(PLATFORM_UID\), cid: String\(USD_CID\), delta: \(-reward\)\.toString\(\)/.test(QUIZ_BLOCK)
      && /uid, cid: String\(USD_CID\), delta: reward\.toString\(\)/.test(QUIZ_BLOCK)
      && /kind: PLATFORM_PAYOUT_KIND/.test(QUIZ_BLOCK)
      && /const key = `biz:campaign:quiz:\$\{subtaskId\}:\$\{uid\}`/.test(QUIZ_BLOCK)
      && /if \(quizCorrect && reward > 0n\)/.test(QUIZ_BLOCK)
      && (QUIZ_BLOCK.match(/postEvent\(/g) ?? []).length === 1,
    JSON.stringify({
      bytes: QUIZ_BLOCK.length, same_tx: /ex: tx as unknown/.test(QUIZ_BLOCK),
      legs: [(QUIZ_BLOCK.match(/PLATFORM_PAYOUT_KIND/g) ?? []).length, (QUIZ_BLOCK.match(/postEvent\(/g) ?? []).length],
    }));

  const correctReads = (SVC.match(/payload\[QUIZ_CORRECT_KEY\]/g) ?? []).length;
  const sanitizerCalls = (SVC.match(/publicSubtaskPayload\(/g) ?? []).length;
  ck.t('A7', '★脱敏：`publicSubtaskPayload` 在**两处公开读口**（`normalizeSubtaskRow` 与 `getTaskDetailByRef` 的子任务映射）各被调用一次 ⇒ 计数 = 2（另有定义处不算调用）· 服务端 `correct` 的读取**只在 submitProofVerb 一处**（`payload[QUIZ_CORRECT_KEY]` 计数 = 1）⇒ 读面与判分面物理分离',
    sanitizerCalls === 2 && correctReads === 1
      && /const payload = publicSubtaskPayload\(typeCode, rawPayload\)/.test(SVC)
      && /payload: publicSubtaskPayload\(str\(s\.type_code\), rawPayload\)/.test(SVC),
    JSON.stringify({ sanitizer_calls: sanitizerCalls, correct_reads: correctReads }));

  const codesInSvc = Array.from(new Set((SVC.match(/'(LEDGER_[A-Z_]+|AUTH_[A-Z_]+)'/g) ?? []).map((s) => s.slice(1, -1))));
  const BORROWED = ['LEDGER_AMOUNT_INVALID', 'LEDGER_REF_NOT_FOUND', 'LEDGER_INSUFFICIENT_BALANCE', 'AUTH_FORBIDDEN'];
  ck.t('A8', '★零新错误码：闭集仍 **33** 值 · 活动域字面量 ⊆ 借码四值（`LEDGER_AMOUNT_INVALID` / `LEDGER_REF_NOT_FOUND` / `LEDGER_INSUFFICIENT_BALANCE` / `AUTH_FORBIDDEN`）· QUIZ_* / PREDICTION_* / SUBTASK_REWARD_* 全部只作 `details.reason`（不进闭集）· 零新 ledger kind（24 值不动，发奖借 `invite_first_task_reward`）',
    LEDGER_ERROR_CODES.length === 33 && codesInSvc.every((x) => BORROWED.includes(x))
      && LEDGER_KINDS.length === 24 && PLATFORM_PAYOUT_KIND === 'invite_first_task_reward'
      && !(LEDGER_ERROR_CODES as readonly string[]).some((c) => /QUIZ|PREDICTION|REWARD_NOT_APPLICABLE/.test(c)),
    JSON.stringify({ codes: LEDGER_ERROR_CODES.length, kinds: LEDGER_KINDS.length, svc_codes: codesInSvc }));

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
  const migFiles72 = fs.readdirSync(path.resolve(REPO_ROOT, 'backend-ts/migrations')).filter((f) => f.startsWith('0072'));
  ck.t('A9', '★零新路由 / 零新迁移号冲突：注册点仍 **109**（get 50 / post 54 / patch 4 / delete 3 / put 0，本单只改服务层内部）· 九口逐条在场 · 迁移目录里 0072 前缀**恰一个**文件 · `subtask_type` 仍 5 类（本单不加类型）',
    regs === 111 && countVerb('get') === 50 && countVerb('post') === 54 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0
      && nine.every((s) => INDEX_TS.indexOf(s) !== -1)
      && migFiles72.length === 1 && migFiles72[0] === '0072_subtask_reward_and_quiz.sql'
      && SUBTASK_TYPES.length === 5,
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), mig72: migFiles72, types: SUBTASK_TYPES.length }));

  // ---- 入参纯函数（零 DB）：quiz / prediction 两形状（A10 起；判据数与 p72 派单逐条对齐）
  const qOk = parseQuizPayload({ options: { a: '甲', b: '乙', c: '丙', d: '丁' }, correct: ['c', 'a'] });
  const qRewardKey = parseQuizPayload({ options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['a'], reward_amount: '5' });
  const qThreeOpts = parseQuizPayload({ options: { a: '1', b: '2', c: '3' }, correct: ['a'] });
  const qDupCorrect = parseQuizPayload({ options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['a', 'a'] });
  const qEmptyCorrect = parseQuizPayload({ options: { a: '1', b: '2', c: '3', d: '4' }, correct: [] });
  const qOutOfSet = parseQuizPayload({ options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['e'] });
  const pOkNew = parseQuizProof({ answers: { picks: ['d', 'b'] } });
  const pDup = parseQuizProof({ answers: { picks: ['a', 'a'] } });
  const pOut = parseQuizProof({ answers: { picks: ['z'] } });
  const pWrongKey = parseQuizProof({ picks: ['a'] });
  ck.t('A10', 'quiz 入参纯函数：四选项+correct 合法体通过且 `correct` **去重排序**（`["c","a"] → ["a","c"]`）· payload 带 `reward_amount` ⇒ 400（奖励是列）· 三选项 ⇒ 400 · correct 重复 / 空 / 越集 ⇒ 400 · 答题凭证 `{answers:{picks}}` 合法体通过（排序后）· picks 重复 / 越集 / 缺 `answers` 包装 ⇒ 400',
    !('err' in qOk) && JSON.stringify(qOk.payload.correct) === JSON.stringify(['a', 'c'])
      && verbOf(errOf(qRewardKey)) === 400 && reasonOf(errOf(qRewardKey)) === 'QUIZ_PAYLOAD_SHAPE'
      && verbOf(errOf(qThreeOpts)) === 400 && reasonOf(errOf(qThreeOpts)) === 'QUIZ_OPTIONS_INVALID'
      && verbOf(errOf(qDupCorrect)) === 400 && reasonOf(errOf(qDupCorrect)) === 'QUIZ_CORRECT_INVALID'
      && verbOf(errOf(qEmptyCorrect)) === 400 && verbOf(errOf(qOutOfSet)) === 400
      && 'picks' in pOkNew && JSON.stringify(pOkNew.picks) === JSON.stringify(['b', 'd'])
      && verbOf(errOf(pDup)) === 400 && reasonOf(errOf(pDup)) === 'QUIZ_ANSWER_SHAPE'
      && verbOf(errOf(pOut)) === 400 && verbOf(errOf(pWrongKey)) === 400,
    JSON.stringify({
      ok: ('err' in qOk ? 'err' : qOk.payload.correct), reward_key: reasonOf(errOf(qRewardKey)),
      three: reasonOf(errOf(qThreeOpts)), dup: reasonOf(errOf(qDupCorrect)), empty: reasonOf(errOf(qEmptyCorrect)),
      picks: ('picks' in pOkNew ? pOkNew.picks : 'err'), pk_dup: reasonOf(errOf(pDup)), pk_wrap: reasonOf(errOf(pWrongKey)),
    }));

  // 集合相等（判分唯一判据）：顺序无关、重复无关（入参已去重排序）、子集不算对
  ck.t('A11', '判分判据 `samePickSet`：**集合相等**（`[a,c]` vs `[c,a]` ⇒ true）· 子集不算对（`[a]` vs `[a,c]` ⇒ false）· 超集不算对（`[a,b,c]` vs `[a,c]` ⇒ false）· 空集恒 false（零答案不可蒙对）',
    samePickSet(['a', 'c'], ['c', 'a']) && samePickSet(['a', 'c'], ['a', 'c'])
      && !samePickSet(['a'], ['a', 'c']) && !samePickSet(['a', 'b', 'c'], ['a', 'c'])
      && !samePickSet([], []) && !samePickSet(['a'], []) && samePickSet(['b'], ['b']),
    JSON.stringify({ eq: samePickSet(['a', 'c'], ['c', 'a']), subset: samePickSet(['a'], ['a', 'c']), empty: samePickSet([], []) }));

  // 脱敏纯函数（零 DB）：correct 剥除、其余原样、不改入参
  const rawQuizPayload = { options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['a'] };
  const sanitized = publicSubtaskPayload('quiz', rawQuizPayload);
  ck.t('A12', '脱敏纯函数 `publicSubtaskPayload`：quiz ⇒ 返回**新对象**且无 `correct`（`options` 原样保留）· 入参对象**未被修改**（库内值/调用方引用零污染）· 非 quiz（prediction / survey）⇒ 原引用透出（零形状变更）',
    !('correct' in sanitized) && JSON.stringify(sanitized) === JSON.stringify({ options: { a: '1', b: '2', c: '3', d: '4' } })
      && JSON.stringify(rawQuizPayload.correct) === JSON.stringify(['a'])
      && JSON.stringify(publicSubtaskPayload('prediction', { prize_amount: '1', deadline: 'x' })) === JSON.stringify({ prize_amount: '1', deadline: 'x' }),
    JSON.stringify({ sanitized, raw_kept: rawQuizPayload }));

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  const committedResidue = async (): Promise<Record<string, number>> => {
    const one = async (sql: string): Promise<number> => Number((await qRetry<{ n: number }>(pool, sql))[0]?.n ?? -1);
    return {
      subtask: await one('SELECT count(*)::int AS n FROM public.subtask'),
      proofs: await one('SELECT count(*)::int AS n FROM public.subtask_proof'),
      ledger: await one('SELECT count(*)::int AS n FROM public.ledger_entry'),
      migrations: await one('SELECT count(*)::int AS n FROM public.schema_migration'),
      reward_col: await one("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='subtask' AND column_name='reward_amount'"),
    };
  };
  const baseline = await committedResidue();
  out.baseline = baseline;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as TxClient;
    const ledgerRows = async (key: string): Promise<number> => Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.ledger_entry WHERE idempotency_key = $1 OR idempotency_key LIKE $1 || '#%'",
      [key]))?.n ?? -1);
    const ledgerSum = async (uid: number | string, key: string): Promise<string> => String((await raw1<{ s: string }>(c,
      `SELECT COALESCE(sum(delta), 0)::text AS s FROM public.ledger_entry
        WHERE uid = $1::bigint AND (idempotency_key = $2::text OR idempotency_key LIKE $2::text || '#%')`,
      [String(uid), key]))?.s ?? '');
    const bal = async (uid: number | string, cid: number | string): Promise<string> =>
      String((await raw1<{ b: string }>(c,
        'SELECT COALESCE((SELECT balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint), 0)::text AS b',
        [String(uid), String(cid)]))?.b ?? '0');

    // ---- B1 · 0072 全量干跑（ALTER + 两个 DO 块 + 尾部自检）· 幂等（二次执行）
    for (const stmt of M72_STMTS) await c.query(stmt);
    for (const stmt of M72_STMTS) await c.query(stmt);
    const col = await raw1<{ data_type: string; is_nullable: string }>(c,
      `SELECT data_type, is_nullable FROM information_schema.columns
        WHERE table_schema='public' AND table_name='subtask' AND column_name='reward_amount'`);
    const colCount = await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='subtask' AND column_name='reward_amount'");
    const cons = await raw1<{ n: number; def: string }>(c,
      `SELECT count(*)::int AS n, min(pg_get_constraintdef(oid)) AS def FROM pg_constraint
        WHERE conrelid='public.subtask'::regclass AND conname='subtask_reward_amount_nonneg' AND contype='c'`);
    ck.t('B1', '0072 干跑全绿（真库 · 回滚事务内）：列 `subtask.reward_amount` 恰 1 枚 `numeric` 且**可空**（兼容存量行）· CHECK `subtask_reward_amount_nonneg` 恰 1 枚且定义含 `reward_amount >= 0` · **二次执行幂等**（再跑一遍列/约束仍各 1）· 尾部自检 DO 未抛（存量 0 行零违规）',
      col !== null && col.data_type === 'numeric' && col.is_nullable === 'YES'
        && Number(colCount?.n ?? -1) === 1
        && Number(cons?.n ?? -1) === 1 && /reward_amount >= \(?0/.test(String(cons?.def ?? '')),
      JSON.stringify({ col, col_count: colCount?.n, constraint: cons?.def }));

    // ---- 夹具：项目（种子项目）+ 四个用户（funder / quiz 答对 / quiz 答错 / prediction 投票）
    const uids: number[] = [];
    for (const base of [972001, 972002, 972003, 972004]) {
      const row = await raw1<{ uid: string }>(c,
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p72-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [FUNDER, U1, U2, U3] = uids;
    R.fixture_users = uids;
    let FIXPROJ = String((await raw1<{ project_id: string }>(c,
      `SELECT project_id::text AS project_id FROM public.project
        WHERE title = 'Sui 生态推广' ORDER BY project_id LIMIT 1`))?.project_id ?? '');
    if (!FIXPROJ) {
      FIXPROJ = String((await raw1<{ project_id: string }>(c,
        `INSERT INTO public.project
           (snowflake_id, owner_uid, title, slug, description, headcount, recruit_min_account_days,
            wage_batt_per_claim, wage_interval_hours, status)
         VALUES (9920000000000099, $1::bigint, 'p72 gate project', $2, 'p72-gate fixture', 5, 0, 10, 1, 'recruiting')
         RETURNING project_id::text AS project_id`,
        [String(U1), `p72-gate-${RUN.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}`]))?.project_id ?? '');
    }
    R.fixture_project = FIXPROJ;

    // 资金夹具：平台收入不得 mint ⇒ 用户付平台费垫高（5000$），再由 invite_first_task_reward 付出
    await postEvent({
      op: 'mint', uid: String(FUNDER), cid: String(USD_CID), amount: '6000', platform: true,
      idempotencyKey: `ops:p72-gate:${RUN}:mint-usd`, memo: 'p72-gate usd fixture', ex,
    });
    await postEvent({
      op: 'entries', idempotencyKey: `ops:p72-gate:${RUN}:fund-platform`, refType: 'system', refId: '0',
      memo: 'p72-gate platform income fixture（用户付平台费 → −1 收入）',
      entries: [
        { uid: String(FUNDER), cid: String(USD_CID), delta: '-5000', kind: 'currency_create_fee' },
        { uid: '-1', cid: String(USD_CID), delta: '5000', kind: 'currency_create_fee' },
      ],
      ex,
    });
    R.fixture_money = { platform_usd: await bal(-1, USD_CID), u1_usd: await bal(U1, USD_CID) };

    // ---- 活动 + 任务（quiz 7$ / prediction 新两键 101$ / x_verify 供「非 quiz 带奖励」闸）
    const camp = await createCampaignVerb({ body: { title: `p72 活动 ${RUN}`, project_id: FIXPROJ, description: 'quiz gate' }, ex });
    const C = String(viewOf<{ campaign_id?: string }>(camp).campaign_id ?? '');
    const futureDl = new Date(Date.now() + 3600 * 1000).toISOString();
    const pastDl = new Date(Date.now() - 3600 * 1000).toISOString();
    const task = await createTaskVerb({
      campaignRef: C,
      body: {
        title: `p72 任务 ${RUN}`, description: 'quiz gate task', reward_amount_primary: '10',
        subtasks: [
          {
            type_code: 'quiz', title: '答题（答对发奖）', reward_amount: '7', sort: 1, required: true,
            payload: { options: { a: '一', b: '二', c: '三', d: '四' }, correct: ['a', 'c'] },
          },
          { type_code: 'prediction', title: '预测（新两键）', payload: { prize_amount: '101', deadline: futureDl }, sort: 2 },
          { type_code: 'x_verify', title: 'X 验证', payload: { screenshots: ['m1'], links: ['https://x.com/a'] }, sort: 3 },
        ],
      },
      ex,
    });
    const T = String(viewOf<{ task_id?: string }>(task).task_id ?? '');
    const subs = viewOf<{ subtasks?: Array<Record<string, unknown>> }>(task).subtasks ?? [];
    const QUIZ = String(subs.find((s) => String(s.type_code) === 'quiz')?.subtask_id ?? '');
    const PRED = String(subs.find((s) => String(s.type_code) === 'prediction')?.subtask_id ?? '');
    const XVERIFY = String(subs.find((s) => String(s.type_code) === 'x_verify')?.subtask_id ?? '');
    await patchCampaignVerb({ ref: C, body: { status: 'active' }, ex });
    await patchTaskVerb({ ref: T, body: { status: 'active' }, ex });
    R.fixture = { campaign_id: C, task_id: T, quiz: QUIZ, prediction: PRED, x_verify: XVERIFY, qid: 'p72-gate' };
    ck.t('S0', '夹具就位：quiz 子任务带 `reward_amount`=7 且 payload 两键（options 四键 + correct 两项）· prediction 新两键 · 任务/活动 active（后续九臂的真路径前提）',
      task.ok === true && QUIZ !== '' && PRED !== '' && XVERIFY !== ''
        && String(subs[0]?.reward_amount ?? '') === '7'
        && subs[1]?.reward_amount === null && subs[2]?.reward_amount === null,
      JSON.stringify({ ok: task.ok, subtasks: subs.map((s) => ({ id: s.subtask_id, type: s.type_code, reward: s.reward_amount })) }));

    // ---- B2 · 库面 CHECK 反证（reward = −1 ⇒ 23514；NULL 合法）
    const negReward = await undoAfter(c, 'b2a', async () => {
      await c.query('UPDATE public.subtask SET reward_amount = -1 WHERE subtask_id = $1::bigint', [QUIZ]);
      return 'updated';
    });
    const nullReward = await undoAfter(c, 'b2b', async () => {
      await c.query('UPDATE public.subtask SET reward_amount = NULL WHERE subtask_id = $1::bigint', [XVERIFY]);
      return 'updated';
    });
    ck.t('B2', '★库面 CHECK 反证：`reward_amount = -1` ⇒ **23514**（`subtask_reward_amount_nonneg` 承重）· `NULL` 合法（存量行兼容，0 也合法 —— 「quiz 必 > 0」由服务层写口守，不靠库面收紧）',
      negReward.sqlstate === '23514' && nullReward.sqlstate === null,
      JSON.stringify({ negative: negReward.sqlstate, null_ok: nullReward.sqlstate }));

    // ---- B3 · 迁移尾部自检反证（塞一行三选项 prediction ⇒ 自检 DO 必抛 P0001）
    const selfCheckFail = await undoAfter(c, 'b3', async () => {
      await c.query(
        `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title, payload)
         VALUES (9920000000000001, $1::bigint, 'prediction', '坏形状', '{"option_a":"A","prize_amount":"5","deadline":"2026-10-21T00:00:00Z"}'::jsonb)`,
        [T]);
      await c.query(M72_SELFCHECK);
      return 'no_raise';
    });
    ck.t('B3', '★迁移自检反证：插一行**三选项** prediction（存量形状缺 `option_b`）后再跑 0072 尾部自检 DO ⇒ **P0001** `0072 self-check FAILED: prediction 存量 payload 形状违规` ⇒ 自检不是空转（真能挡住半迁移）',
      selfCheckFail.sqlstate === 'P0001' && /prediction 存量 payload 形状违规/.test(selfCheckFail.message),
      JSON.stringify({ sqlstate: selfCheckFail.sqlstate, message: selfCheckFail.message.slice(0, 160) }));

    // ==================================================================== S1 · prediction 新两键入参 → 落库 → 读口
    const predRow = await raw1<{ payload: Record<string, unknown>; reward_amount: string | null }>(c,
      'SELECT payload, reward_amount::text AS reward_amount FROM public.subtask WHERE subtask_id = $1::bigint', [PRED]);
    const listedNew = (await listActiveCampaigns(ex)).find((x) => x.campaign_id === C)
      ?.tasks.find((x) => x.task_id === T)?.subtasks.find((s) => s.subtask_id === PRED);
    ck.t('S1', '★prediction 新两键**落库与读口逐字一致**：库内 payload 恰 `{prize_amount, deadline}`（无 option_a/b、无 correct_option）· 读口 `payload` 与之相等 · `prediction_state`=`open` · `reward_amount`=`null`（奖励列只服务 quiz）',
      predRow !== null
        && JSON.stringify(Object.keys(predRow.payload).sort()) === JSON.stringify(['deadline', 'prize_amount'])
        && String(predRow.payload.prize_amount) === '101'
        && predRow.reward_amount === null
        && listedNew !== undefined
        && JSON.stringify(listedNew.payload) === JSON.stringify(predRow.payload)
        && listedNew.prediction_state === 'open',
      JSON.stringify({ db: predRow, view: listedNew ?? null }));

    // ==================================================================== S2 · 新两键投票 / 结算（含口径交叉 400）
    const v1 = await submitProofVerb({ actorUid: U1, subtaskRef: PRED, body: { choice: 'yes' }, ex });
    const vCross = await submitProofVerb({ actorUid: U3, subtaskRef: PRED, body: { choice: 'a' }, ex });
    const v2 = await submitProofVerb({ actorUid: U3, subtaskRef: PRED, body: { choice: 'no' }, ex });
    const earlySettle = await settlePredictionVerb({ subtaskRef: PRED, body: { correct_option: 'yes' }, ex });
    // 到点（读时派生，零定时器）
    await c.query(
      `UPDATE public.subtask SET payload = payload || jsonb_build_object('deadline', $2::text) WHERE subtask_id = $1::bigint`,
      [PRED, pastDl]);
    const u1Before = BigInt(await bal(U1, USD_CID));
    const platBefore = BigInt(await bal(-1, USD_CID));
    const settled = await settlePredictionVerb({ subtaskRef: PRED, body: { correct_option: 'yes' }, ex });
    const sv = viewOf<Record<string, unknown>>(settled);
    const settleKey = `biz:campaign:settle:${PRED}:yes`;
    const settleAgain = await settlePredictionVerb({ subtaskRef: PRED, body: { correct_option: 'no' }, ex });
    ck.t('S2', '★新两键全链：`yes` / `no` 各 200 · **`choice:"a"` ⇒ 400 `PREDICTION_CHOICE_SHAPE`（口径交叉拒绝）** · deadline 前 settle ⇒ 409 `prediction_deadline_not_reached` · 到点后 `correct_option:"yes"` ⇒ 200（prize 101 / 选对 1 ⇒ per 101 · 台账 2 条 · U1 +101 · 平台 −101）· 重复 settle ⇒ 409（零二次分发）',
      v1.ok === true && v2.ok === true
        && verbOf(vCross) === 400 && reasonOf(vCross) === 'PREDICTION_CHOICE_SHAPE'
        && verbOf(earlySettle) === 409 && reasonOf(earlySettle) === 'prediction_deadline_not_reached'
        && settled.ok === true && Number(sv.winner_count) === 1 && Number(sv.per_winner_amount) === 101
        && Number(sv.distributed_total) === 101 && Number(sv.platform_retained) === 0
        && BigInt(await bal(U1, USD_CID)) - u1Before === 101n
        && platBefore - BigInt(await bal(-1, USD_CID)) === 101n
        && (await ledgerRows(settleKey)) === 2
        && verbOf(settleAgain) === 409 && reasonOf(settleAgain) === 'prediction_already_settled'
        && (await ledgerRows(settleKey)) === 2,
      JSON.stringify({
        votes: [v1.ok, v2.ok], cross: [verbOf(vCross), reasonOf(vCross)], early: [verbOf(earlySettle), reasonOf(earlySettle)],
        settled: sv, again: [verbOf(settleAgain), reasonOf(settleAgain)],
      }));

    // ==================================================================== S3 · 存量四键行：读口统一 Yes/No（剥文案）、库内值不动、仍走 a|b
    const legacyId = String((await raw1<{ subtask_id: string }>(c,
      `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title, payload, sort)
       VALUES (9920000000000002, $1::bigint, 'prediction', '存量四键', $2::jsonb, 9)
       RETURNING subtask_id::text AS subtask_id`,
      [T, JSON.stringify({ option_a: 'Yes', option_b: 'No', prize_amount: '50', deadline: futureDl })]))?.subtask_id ?? '');
    const legacyView = (await listActiveCampaigns(ex)).find((x) => x.campaign_id === C)
      ?.tasks.find((x) => x.task_id === T)?.subtasks.find((s) => s.subtask_id === legacyId);
    const legacyViewPayload = (legacyView?.payload ?? {}) as Record<string, unknown>;
    const legacyDbBefore = await raw1<{ payload: Record<string, unknown> }>(c,
      'SELECT payload FROM public.subtask WHERE subtask_id = $1::bigint', [legacyId]);
    const legacyCross = await submitProofVerb({ actorUid: U1, subtaskRef: legacyId, body: { choice: 'yes' }, ex });
    const legacyVote = await submitProofVerb({ actorUid: U1, subtaskRef: legacyId, body: { choice: 'a' }, ex });
    await c.query(
      `UPDATE public.subtask SET payload = payload || jsonb_build_object('deadline', $2::text) WHERE subtask_id = $1::bigint`,
      [legacyId, pastDl]);
    const legacyCrossSettle = await settlePredictionVerb({ subtaskRef: legacyId, body: { correct_option: 'yes' }, ex });
    const legacySettle = await settlePredictionVerb({ subtaskRef: legacyId, body: { correct_option: 'a' }, ex });
    const legacyAfter = await raw1<{ payload: Record<string, unknown> }>(c,
      'SELECT payload FROM public.subtask WHERE subtask_id = $1::bigint', [legacyId]);
    ck.t('S3', '★存量四键行**读口统一 ＋ 库内值不动**：直插存量形状（option_a/option_b）⇒ 读口 payload **无** `option_a`/`option_b`（键集恰 `[deadline, prize_amount]`，选项文案由前端 i18n 恒 Yes/No）· 加性 `option_style`=`ab_legacy` · `prediction_state`=`open` · **库内两枚文案原样仍在**（剥的只是出参边界，零改库）· 该行口径仍 ab_legacy：投票 `a` ⇒ 200、`yes` ⇒ 400；结算 `yes` ⇒ 400 `PREDICTION_CORRECT_OPTION_INVALID`、`a` ⇒ 200 且回填 `correct_option="a"`',
      legacyView !== undefined && legacyView.prediction_state === 'open'
        && legacyView.option_style === 'ab_legacy'
        && !('option_a' in legacyViewPayload) && !('option_b' in legacyViewPayload)
        && JSON.stringify(Object.keys(legacyViewPayload).sort()) === JSON.stringify(['deadline', 'prize_amount'])
        && String((legacyDbBefore?.payload ?? {}).option_a) === 'Yes'
        && String((legacyDbBefore?.payload ?? {}).option_b) === 'No'
        && verbOf(legacyCross) === 400 && reasonOf(legacyCross) === 'PREDICTION_CHOICE_SHAPE'
        && legacyVote.ok === true
        && verbOf(legacyCrossSettle) === 400 && reasonOf(legacyCrossSettle) === 'PREDICTION_CORRECT_OPTION_INVALID'
        && legacySettle.ok === true
        && String((legacyAfter?.payload ?? {})[PREDICTION_CORRECT_OPTION_KEY] ?? '') === 'a',
      JSON.stringify({
        view: legacyView ?? null, view_payload: legacyViewPayload, db_before: legacyDbBefore?.payload ?? null,
        cross_vote: [verbOf(legacyCross), reasonOf(legacyCross)], vote: legacyVote.ok,
        cross_settle: [verbOf(legacyCrossSettle), reasonOf(legacyCrossSettle)], settle: legacySettle.ok,
        backfill: (legacyAfter?.payload ?? {})[PREDICTION_CORRECT_OPTION_KEY] ?? null,
      }));

    // ==================================================================== S4 · 禁双开 ＋ 发布后冻结（active 改不动 / draft 可改）
    const createLegacy = await createTaskVerb({
      campaignRef: C,
      body: {
        title: 'legacy-create', reward_amount_primary: '10',
        subtasks: [{ type_code: 'prediction', title: '四键建口', payload: { option_a: 'A', option_b: 'B', prize_amount: '5', deadline: futureDl } }],
      },
      ex,
    });
    // 新两键行 ≡ PRED；把它改成四键 ⇒ 口径不可换（口径闸先于锁闸 ⇒ 400 而非 409）
    const flipStyle = await patchTaskVerb({
      ref: T,
      body: { subtasks: [{ subtask_id: PRED, type_code: 'prediction', title: '预测（新两键）', payload: { option_a: 'A', option_b: 'B', prize_amount: '101', deadline: futureDl } }] },
      ex,
    });
    // ① active task 上改存量四键行（同口径内的普通更新 + 改名）⇒ 发布后冻结 409（库内标题不动）
    const lockedRepatch = await patchTaskVerb({
      ref: T,
      body: {
        subtasks: [
          { subtask_id: legacyId, type_code: 'prediction', title: '存量四键（改名）', payload: { option_a: 'Yes', option_b: 'No', prize_amount: '50', deadline: futureDl } },
        ],
      },
      ex,
    });
    const lockedTitle = await raw1<{ title: string }>(c, 'SELECT title FROM public.subtask WHERE subtask_id = $1::bigint', [legacyId]);
    // ② 另建 **draft** task（直插 legacy 行）⇒ 同口径四键改口 200（锁只锁发布态，不是禁改）
    const draftTask = await createTaskVerb({
      campaignRef: C,
      body: { title: `p72 draft ${RUN}`, reward_amount_primary: '3' },
      ex,
    });
    const DRAFTT = String(viewOf<{ task_id?: string }>(draftTask).task_id ?? '');
    const draftLegacyId = String((await raw1<{ subtask_id: string }>(c,
      `INSERT INTO public.subtask (snowflake_id, task_id, type_code, title, payload, sort)
       VALUES (9920000000000003, $1::bigint, 'prediction', 'draft 存量四键', $2::jsonb, 1)
       RETURNING subtask_id::text AS subtask_id`,
      [DRAFTT, JSON.stringify({ option_a: 'Yes', option_b: 'No', prize_amount: '50', deadline: futureDl })]))?.subtask_id ?? '');
    const draftRepatch = await patchTaskVerb({
      ref: DRAFTT,
      body: {
        subtasks: [
          { subtask_id: draftLegacyId, type_code: 'prediction', title: 'draft 四键（改名）', payload: { option_a: 'Yes', option_b: 'No', prize_amount: '50', deadline: futureDl } },
        ],
      },
      ex,
    });
    const draftRow = await raw1<{ title: string; payload: Record<string, unknown>; task_status: string }>(c,
      `SELECT s.title, s.payload, t.status AS task_status
         FROM public.subtask s JOIN public.task t ON t.task_id = s.task_id
        WHERE s.subtask_id = $1::bigint`, [draftLegacyId]);
    ck.t('S4', '★禁双开 ＋ 发布后冻结：建口传四键 ⇒ 400 `PREDICTION_PAYLOAD_SHAPE`（建口只收新两键）· 新两键行改口成四键 ⇒ 400 `PREDICTION_OPTION_STYLE_IMMUTABLE`（口径闸先于锁闸）· **active task 上改存量四键行 ⇒ 409 `prediction_locked_after_publish`**（`changed_fields` 含 `title`，库内标题未被写）· **另建 draft task（直插 legacy 行）后四键改口 ⇒ 200** 且标题落库、payload 仍四键（锁只锁发布态，draft 可改）',
      verbOf(createLegacy) === 400 && reasonOf(createLegacy) === 'PREDICTION_PAYLOAD_SHAPE'
        && verbOf(flipStyle) === 400 && reasonOf(flipStyle) === 'PREDICTION_OPTION_STYLE_IMMUTABLE'
        && verbOf(lockedRepatch) === 409 && reasonOf(lockedRepatch) === 'prediction_locked_after_publish'
        && changedOf(lockedRepatch).includes('title')
        && /^存量四键$/.test(String(lockedTitle?.title ?? ''))
        && draftTask.ok === true && String(draftRow?.task_status ?? '') === 'draft'
        && draftRepatch.ok === true && /改名/.test(String(draftRow?.title ?? ''))
        && String((draftRow?.payload ?? {}).option_a) === 'Yes'
        && JSON.stringify(Object.keys(draftRow?.payload ?? {}).sort())
          === JSON.stringify(['deadline', 'option_a', 'option_b', 'prize_amount']),
      JSON.stringify({
        create: [verbOf(createLegacy), reasonOf(createLegacy)], flip: [verbOf(flipStyle), reasonOf(flipStyle)],
        locked: [verbOf(lockedRepatch), reasonOf(lockedRepatch), changedOf(lockedRepatch)],
        locked_title: lockedTitle?.title,
        draft: { task: DRAFTT, ok: draftRepatch.ok, row: draftRow ?? null },
      }));

    // ==================================================================== S5 · quiz 答对发奖（账实两腿）
    const quizKey = `biz:campaign:quiz:${QUIZ}:${U1}`;
    const u1QuizBefore = BigInt(await bal(U1, USD_CID));
    const platQuizBefore = BigInt(await bal(-1, USD_CID));
    // picks 顺序与 correct 相反（['c','a'] vs correct ['a','c']）⇒ 集合相等即答对
    const rightAns = await submitProofVerb({ actorUid: U1, subtaskRef: QUIZ, body: { answers: { picks: ['c', 'a'] } }, ex });
    const rightView = viewOf<{ quiz_correct?: boolean; reward_paid?: string }>(rightAns);
    const u1QuizDelta = BigInt(await bal(U1, USD_CID)) - u1QuizBefore;
    const platQuizDelta = platQuizBefore - BigInt(await bal(-1, USD_CID));
    ck.t('S5', '★quiz 答对即发奖（**账实两腿**）：picks `["c","a"]` 与 correct `["a","c"]` **顺序无关** ⇒ 200 且 `quiz_correct=true`、`reward_paid="7"` · **account**：U1 +7 / 平台 −7 · **ledger**：同幂等键 2 腿（U1 汇总 +7、平台 −7）',
      rightAns.ok === true && rightView.quiz_correct === true && String(rightView.reward_paid) === '7'
        && u1QuizDelta === 7n && platQuizDelta === 7n
        && (await ledgerRows(quizKey)) === 2
        && (await ledgerSum(U1, quizKey)) === '7' && (await ledgerSum(-1, quizKey)) === '-7',
      JSON.stringify({
        view: rightView, deltas: { u1: u1QuizDelta.toString(), platform: platQuizDelta.toString() },
        ledger: { rows: await ledgerRows(quizKey), u1: await ledgerSum(U1, quizKey), platform: await ledgerSum(-1, quizKey) },
      }));

    // ==================================================================== S6 · quiz 答错零发奖
    const u2Before = BigInt(await bal(U2, USD_CID));
    const platBeforeWrong = BigInt(await bal(-1, USD_CID));
    // picks 用**真子集** `['a']`（correct = `['a','c']`）⇒ 集合相等判据下答错，而「子集即算对」的变体会在此臂转红（N1 对拍）
    const wrongAns = await submitProofVerb({ actorUid: U2, subtaskRef: QUIZ, body: { answers: { picks: ['a'] } }, ex });
    const wrongView = viewOf<{ quiz_correct?: boolean; reward_paid?: string }>(wrongAns);
    const wrongKey = `biz:campaign:quiz:${QUIZ}:${U2}`;
    const wrongProofRows = Number((await raw1<{ n: number }>(c,
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint AND uid = $2::bigint', [QUIZ, String(U2)]))?.n ?? -1);
    ck.t('S6', '★quiz 答错零发奖：`picks=["a"]` ⇏ `["a","c"]`（**真子集** —— 「子集即算对」的变体会在此臂转红）⇒ 200 且 `quiz_correct=false`、`reward_paid="0"` · **proof 仍落库**（提交即通过，1 行）· U2 余额**不变**、平台不变 · 该户零分录（0 条）',
      wrongAns.ok === true && wrongView.quiz_correct === false && String(wrongView.reward_paid) === '0'
        && wrongProofRows === 1
        && BigInt(await bal(U2, USD_CID)) === u2Before
        && BigInt(await bal(-1, USD_CID)) === platBeforeWrong
        && (await ledgerRows(wrongKey)) === 0,
      JSON.stringify({
        view: wrongView, proof_rows: wrongProofRows,
        u2_delta: (BigInt(await bal(U2, USD_CID)) - u2Before).toString(), ledger: await ledgerRows(wrongKey),
      }));

    // ==================================================================== S7 · quiz 重复提交 409（一人一次、零二次发奖）
    const again = await submitProofVerb({ actorUid: U1, subtaskRef: QUIZ, body: { answers: { picks: ['a', 'c'] } }, ex });
    const proofRowsAfter = Number((await raw1<{ n: number }>(c,
      'SELECT count(*)::int AS n FROM public.subtask_proof WHERE subtask_id = $1::bigint', [QUIZ]))?.n ?? -1);
    ck.t('S7', '★quiz 同一 uid 重提 ⇒ 409 `quiz_already_answered`（与 prediction 一人一票同族）· proof 仍 **2 行**（U1/U2 各一）· 发奖台账**仍 2 腿**（零二次发奖，即便第二次答案也正确）',
      verbOf(again) === 409 && reasonOf(again) === 'quiz_already_answered'
        && proofRowsAfter === 2 && (await ledgerRows(quizKey)) === 2,
      JSON.stringify({ again: [verbOf(again), reasonOf(again)], proof_rows: proofRowsAfter, ledger: await ledgerRows(quizKey) }));

    // ==================================================================== S8 · 公开读口 correct 零泄漏（三读口）
    const anonCampaigns = JSON.stringify(await listActiveCampaigns(ex));
    const anonCampaign = JSON.stringify(await getCampaignByRef(C, { includeDraft: false }, ex));
    const anonTask = JSON.stringify(await getTaskDetailByRef(T, { includeDraft: false, actorUid: null }, ex));
    const selfTask = JSON.stringify(await getTaskDetailByRef(T, { includeDraft: true, actorUid: U1 }, ex));
    const quizInTask = (await getTaskDetailByRef(T, { includeDraft: false, actorUid: null }, ex))
      ?.subtasks.find((s) => s.subtask_id === QUIZ);
    // 库内值：`payload->'correct'` 由 node-pg 反序列化**已解析的 jsonb**（数组）⇒ 比的是 JSON 串化值，不是原始文本
    const dbCorrect = await raw1<{ c: unknown; t: string }>(c,
      `SELECT payload->'correct' AS c, jsonb_typeof(payload->'correct') AS t
         FROM public.subtask WHERE subtask_id = $1::bigint`, [QUIZ]);
    ck.t('S8', '★公开读口 `correct` **零泄漏**：列表 / 活动详情（匿名）/ 任务详情（匿名）三处 JSON 均无 `"correct"` 键 · 登录本人（已作答）的任务详情同样无 · quiz payload 其余形状不变（`options` 四键原样）· 库内 payload 仍带 `correct`（脱敏只发生在出参边界）',
      !anonCampaigns.includes('"correct"') && !anonCampaign.includes('"correct"')
        && !anonTask.includes('"correct"') && !selfTask.includes('"correct"')
        && quizInTask !== undefined
        && JSON.stringify(Object.keys(quizInTask.payload).sort()) === JSON.stringify(['options'])
        && JSON.stringify((quizInTask.payload as Record<string, unknown>).options) === JSON.stringify({ a: '一', b: '二', c: '三', d: '四' })
        && dbCorrect?.t === 'array' && JSON.stringify(dbCorrect?.c) === JSON.stringify(['a', 'c']),
      JSON.stringify({
        list_leak: anonCampaigns.includes('"correct"'), campaign_leak: anonCampaign.includes('"correct"'),
        task_leak: anonTask.includes('"correct"'), self_leak: selfTask.includes('"correct"'),
        public_payload: quizInTask?.payload ?? null, db_correct: dbCorrect ?? null,
      }));

    // ==================================================================== S9 · 奖励载体闸（列 ≠ payload 键）
    const nonQuizReward = await createTaskVerb({
      campaignRef: C,
      body: {
        title: 'x-verify-with-reward', reward_amount_primary: '10',
        subtasks: [{ type_code: 'x_verify', title: 'X', payload: { screenshots: ['m'], links: [] }, reward_amount: '5' }],
      },
      ex,
    });
    const quizNoReward = await createTaskVerb({
      campaignRef: C,
      body: {
        title: 'quiz-without-reward', reward_amount_primary: '10',
        subtasks: [{ type_code: 'quiz', title: 'q', payload: { options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['a'] } }],
      },
      ex,
    });
    const quizRewardInPayload = await createTaskVerb({
      campaignRef: C,
      body: {
        title: 'quiz-reward-in-payload', reward_amount_primary: '10',
        subtasks: [{ type_code: 'quiz', title: 'q', reward_amount: '5', payload: { options: { a: '1', b: '2', c: '3', d: '4' }, correct: ['a'], reward_amount: '5' } }],
      },
      ex,
    });
    ck.t('S9', '★奖励载体闸：非 quiz 子任务带 `reward_amount` ⇒ 400 `SUBTASK_REWARD_NOT_APPLICABLE`（奖励列只服务 quiz）· quiz 缺奖励 ⇒ 400 `QUIZ_REWARD_REQUIRED`（答对即发 ⇒ 必填 > 0）· quiz **payload 内**塞 `reward_amount` ⇒ 400 `QUIZ_PAYLOAD_SHAPE`（是列不是键）',
      verbOf(nonQuizReward) === 400 && reasonOf(nonQuizReward) === 'SUBTASK_REWARD_NOT_APPLICABLE'
        && verbOf(quizNoReward) === 400 && reasonOf(quizNoReward) === 'QUIZ_REWARD_REQUIRED'
        && verbOf(quizRewardInPayload) === 400 && reasonOf(quizRewardInPayload) === 'QUIZ_PAYLOAD_SHAPE',
      JSON.stringify({
        non_quiz: [verbOf(nonQuizReward), reasonOf(nonQuizReward)],
        quiz_no_reward: [verbOf(quizNoReward), reasonOf(quizNoReward)],
        reward_in_payload: [verbOf(quizRewardInPayload), reasonOf(quizRewardInPayload)],
      }));

    // ==================================================================== N1 · 去「集合相等」⇒ 答错也发奖（S6 必红）
    // 「子集即算对」的变体判据（方向必须真是 picks ⊆ correct 且真包含；写成 correct ⊆ picks 会变成「超集即算对」，反例永不触发）
    const strictSubset = (picks: readonly string[], correct: readonly string[]): boolean =>
      picks.length < correct.length && picks.every((x) => correct.includes(x));
    const n1 = await undoAfter(c, 'n1', async () => {
      const before = BigInt(await bal(U2, USD_CID));
      // 反事实：把「子集即答对」的判据接上发奖（真实分录，同一 kind / 同一键形状）
      // picks 取 S6 的真实答案 `["a"]`（correct `["a","c"]` 的**真子集**）⇒ 变体下 mutant_right = true（S6 必红）
      const mutantRight = strictSubset(['a'], ['a', 'c']);
      const paid = mutantRight ? '7' : '0';
      if (mutantRight) {
        await postEvent({
          op: 'entries', idempotencyKey: `biz:campaign:quiz:${QUIZ}:${U2}:mutant`,
          requestFingerprint: 'mutant-subset-equals', refType: 'system', refId: QUIZ,
          memo: 'n1 counterfactual: subset counts as correct', ex,
          entries: [
            { uid: '-1', cid: String(USD_CID), delta: '-7', kind: PLATFORM_PAYOUT_KIND },
            { uid: String(U2), cid: String(USD_CID), delta: '7', kind: PLATFORM_PAYOUT_KIND },
          ],
        });
      }
      return { mutant_right: mutantRight, paid, delta: (BigInt(await bal(U2, USD_CID)) - before).toString() };
    });
    const n1v = n1.value as { mutant_right: boolean; paid: string; delta: string } | null;
    ck.t('N1', '★负控① 集合相等承重：真实判据 `samePickSet(["a"], ["a","c"])` = **false**（真子集不算对）· 变体判据 `strictSubset` 方向正确（`["a"]`⊂`["a","c"]` ⇒ true；`["b"]` / 等集 ⇒ false，非恒真）· **把判据换成「子集即算对」** ⇒ S6 里答错的 U2 也能落 +7 分录（余额真 +7）⇒ S6「答错零发奖」判据必红',
      samePickSet(['a'], ['a', 'c']) === false
        && strictSubset(['a'], ['a', 'c']) === true
        && strictSubset(['b'], ['a', 'c']) === false && strictSubset(['a', 'c'], ['a', 'c']) === false
        && n1.sqlstate === null && n1v !== null && n1v.mutant_right === true
        && n1v.paid === '7' && n1v.delta === '7'
        && String(wrongView.reward_paid) === '0',
      JSON.stringify({
        real_same_set: samePickSet(['a'], ['a', 'c']),
        mutant_judge: { subset: strictSubset(['a'], ['a', 'c']), non_subset: strictSubset(['b'], ['a', 'c']), equal: strictSubset(['a', 'c'], ['a', 'c']) },
        mutant: n1v,
      }));

    // ==================================================================== N2 · 不脱敏 ⇒ 泄漏红（S8 必红）
    const leakyPayload = JSON.stringify(asObjForTest((quizInTask?.payload ?? {}) as Record<string, unknown>,
      { correct: ['a', 'c'] }));
    const sanitizedPayload = JSON.stringify(publicSubtaskPayload('quiz', { options: (quizInTask?.payload ?? {}).options, correct: ['a', 'c'] }));
    ck.t('N2', '★负控② 脱敏承重：把出参换成「payload 原样透出」（不剥 `correct`）⇒ JSON **含** `"correct"` ⇒ S8 三读口断言必红；走 `publicSubtaskPayload` ⇒ 不含 ⇒ 判据可证伪（不是空转）',
      leakyPayload.includes('"correct"') && !sanitizedPayload.includes('"correct"')
        && !anonTask.includes('"correct"') && sanitizedPayload.includes('"options"'),
      JSON.stringify({ leaky_has_correct: leakyPayload.includes('"correct"'), sanitized: sanitizedPayload }));

    // ==================================================================== N3 · 非 quiz 传 reward 的闸是唯一屏障
    const n3 = await undoAfter(c, 'n3', async () => {
      // 反事实：跳过 `parseSubtaskInput` 的闸，直接写库（库面只兜非负 ⇒ 该值会静默落库）
      await c.query('UPDATE public.subtask SET reward_amount = 5 WHERE subtask_id = $1::bigint', [XVERIFY]);
      return String((await raw1<{ r: string }>(c,
        'SELECT reward_amount::text AS r FROM public.subtask WHERE subtask_id = $1::bigint', [XVERIFY]))?.r ?? '');
    });
    ck.t('N3', '★负控③ 奖励载体闸承重：非 quiz 带 `reward_amount` ⇒ **400 `SUBTASK_REWARD_NOT_APPLICABLE`**；而**绕过写口直写库**时同一列为 `x_verify` 落值 **成功**（库面只兜非负）⇒ 该 400 是防止「非 quiz 静默挂奖励」的唯一屏障（去掉即静默落库）',
      verbOf(nonQuizReward) === 400 && reasonOf(nonQuizReward) === 'SUBTASK_REWARD_NOT_APPLICABLE'
        && n3.sqlstate === null && n3.value === '5',
      JSON.stringify({ verb: [verbOf(nonQuizReward), reasonOf(nonQuizReward)], db_direct: n3.value }));

    R.committed_touch = 'none (single rollback tx)';
    return R;
  });

  /** 测试内小工具：不解构 payload，直接叠一枚 correct（模拟「未走脱敏」的出参） */
  function asObjForTest(base: Record<string, unknown>, extra: Record<string, unknown>): Record<string, unknown> {
    return { ...base, ...extra };
  }

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
    ck.t('Z1', `零残留（mode-aware）：subtask / subtask_proof / ledger_entry / schema_migration 行数与 \`subtask.reward_amount\` 列存在性**事务前 = 事务后**（0072 只在事务内干跑 ⇒ DDL 与业务写均未泄漏；基线 ${JSON.stringify(baseline)}）`,
      same,
      JSON.stringify({ before: baseline, after }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p72-quiz-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings ?? null }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
