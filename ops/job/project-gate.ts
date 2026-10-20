/**
 * job-project-gate · 发布悬赏前置闸（**发布者必须拥有且正在管理至少一个项目**）
 * ---------------------------------------------------------------------------
 * 规则（Kevin 2026-10-21 裁定）：`POST /api/job`（`publishJob`）的前提 =
 *   `project.owner_uid = 本人 ∧ status <> 'ended'` 至少 1 行；0 行 ⇒ 拒绝。
 *   错误体例 = 既有闭集 **403 `AUTH_FORBIDDEN` + `details.reason='project_required'`**
 *   （零新错误码 / 零新 kind / 零新路由 / 零新文案键）。
 *
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p63/p67 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/job/project-gate.ts
 * 读数：`ops/job/readings/job-project-gate-<RUN>.json`
 *
 * ★ 覆盖面：
 *   A · 静态面（零 DB）：闸在 `publishJob` **最前**（早于 create_key / employer / jobPostEvent）·
 *       read口 = 纯 SELECT（`owner_uid` 等值 + `status <> 'ended'` + LIMIT 1，零写）·
 *       错误体例字面（403 / AUTH_FORBIDDEN / project_required）· 注册点 **128** 不动（零新路由）·
 *       错误码闭集 33 不动 · kind 24 不动 · 闸真源只在服务层（路由零重复判定）· `ex` 注入贯通。
 *   S · 服务层真路径（回滚事务 · `ex` 注入）四臂 + 两正控：
 *       ① 无项目用户发布 ⇒ 403 `project_required` 且**零写库**（job 行 / 托管台账 / 余额+frozen 全不变）；
 *       ② 有 recruiting 项目 ⇒ 200 与改前一致（job +1 / 托管台账 2 腿 / 余额 −总额 / frozen +总额）；
 *       ③ 项目 ended ⇒ 403（ended = 终态封板、不算在管）；
 *       ④ 他人项目不算（owner 不匹配；哪怕本人是该项目的在职 worker）；
 *       ⑤ 正控：`working` 状态项目同样放行（非终态即算在管）；
 *       ⑥ 正控：同键重投仍 200 replay、不增行（闸不破坏既有幂等语义）。
 *   N · **负控（判据必须可红）**：把闸谓词中和成 `false &&`（TS 层等价于「去掉闸」，
 *       保留参数位与调用，不删整行）⇒ 无项目用户发布**可成功**（200 + job +1）⇒ S① 必红。
 *       中和方式 = 内存里 `typescript.transpileModule` 编译中和版源码后 `Module._compile`
 *       **不落盘**（零临时文件、零 git 残留）。
 *   Z · 残留：rollback 之后提交面无本门夹具（users / project / job / ledger）。
 *
 * 纪律：**不 apply、不写版本表**；一切 DML 都在回滚事务内（`inRollbackTx`），失败臂用 SAVEPOINT；
 *   凭据只读 `backend-ts/.env.local`（dev 库）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import { checker, inRollbackTx, mkPool, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import { publishJob } from '../../backend-ts/src/job-funds-service';
import { hasManagedProject } from '../../backend-ts/src/project-service';
import { LEDGER_KINDS, postEvent } from '../../backend-ts/src/ledger';
import { AUTH_ERROR_MESSAGES, LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const REPO_BACKEND = path.join(REPO_ROOT, 'backend-ts');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');

const INDEX_TS = readSrc('backend-ts/src/index.ts');
const JOB_SVC = readSrc('backend-ts/src/job-funds-service.ts');
const PROJ_SVC = readSrc('backend-ts/src/project-service.ts');
const JOB_SVC_PATH = path.join(REPO_BACKEND, 'src/job-funds-service.ts');

/** 取 `publishJob` 函数体（从导出点到下一个导出点），用于「闸在最前」的位置判据 */
const publishBody = (src: string): string => {
  const start = src.indexOf('export const publishJob');
  const end = src.indexOf('export const settleJob');
  return start < 0 || end < 0 ? '' : src.slice(start, end);
};
/** 取 `hasManagedProject` 函数体 */
const hasProjectBody = (src: string): string => {
  const start = src.indexOf('export const hasManagedProject');
  const end = src.indexOf('// ============================================================================\n// 建项目');
  return start < 0 || end < 0 ? '' : src.slice(start, end);
};

const verbOf = (r: unknown): number => {
  const x = r as { ok?: boolean; status?: number };
  return x?.ok ? 200 : Number(x?.status ?? 0);
};
const reasonOf = (r: unknown) => String(((r as { details?: { reason?: unknown } })?.details?.reason) ?? '');
const codeOf = (r: unknown) => String((r as { code?: unknown })?.code ?? '');
const replayOf = (r: unknown) => (r as { replay?: boolean })?.replay === true;
const viewOf = (r: unknown) => ((r as { view?: Record<string, unknown> })?.view ?? {}) as Record<string, unknown>;

/**
 * 负控用的**中和版** publishJob（纯内存编译，零落盘）：
 *   `if (!(await hasManagedProject(actor.uid, ex))) {` ⇒ `if (false && !(…) {`
 *   —— 只中和谓词、保留调用与参数位（`p7b` 纪律：不删整行，否则测到的是语法不是闸）。
 * 中和次数必须**恰 1**，否则本臂作废（判据自证）。
 */
const loadNeutralizedPublishJob = (): { publishJob: (p: { actorUid: number; body: Record<string, unknown> | undefined }, ex?: TxClient) => Promise<unknown>; replaced: number } => {
  // ★ `typescript` 只在 `backend-ts/` 的 devDependencies 里 ⇒ 用 createRequire 钉到该 package.json
  //   （本文件在 `ops/job/`，裸 require 解析不到）
  const tsRequire = createRequire(path.join(REPO_BACKEND, 'package.json'));
  const ts = tsRequire('typescript') as {
    transpileModule: (src: string, opts: Record<string, unknown>) => { outputText: string };
    ModuleKind: { CommonJS: number };
    ScriptTarget: { ES2020: number };
  };
  const NodeModule = tsRequire('module') as {
    Module: {
      new (id: string, parent?: unknown): { filename: string; paths: string[]; exports: Record<string, unknown>; _compile: (code: string, filename: string) => void };
      _nodeModulePaths: (p: string) => string[];
    };
  };
  const src = fs.readFileSync(JOB_SVC_PATH, 'utf8');
  const GATE = 'if (!(await hasManagedProject(actor.uid, ex))) {';
  const NEUTRAL = 'if (false && !(await hasManagedProject(actor.uid, ex))) {';
  const replaced = src.split(GATE).length - 1;
  const js = ts.transpileModule(src.split(GATE).join(NEUTRAL), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: JOB_SVC_PATH,
  }).outputText;
  const m = new NodeModule.Module(JOB_SVC_PATH, undefined);
  m.filename = JOB_SVC_PATH;
  m.paths = NodeModule.Module._nodeModulePaths(path.dirname(JOB_SVC_PATH));
  m._compile(js, JOB_SVC_PATH);
  const exp = m.exports as {
    publishJob: (p: { actorUid: number; body: Record<string, unknown> | undefined }, ex?: TxClient) => Promise<unknown>;
  };
  return { publishJob: exp.publishJob, replaced };
};

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  ck.t('A1', '注册点 = 128 不动（get 55 / post 66 / patch 4 / delete 3 / put 0）⇒ **零新路由**',
    regs === 128 && countVerb('get') === 55 && countVerb('post') === 66 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0,
    `regs=${regs} get=${countVerb('get')} post=${countVerb('post')} patch=${countVerb('patch')} delete=${countVerb('delete')} put=${countVerb('put')}`);

  const jobRouteCount = (INDEX_TS.match(/^app\.post\('\/api\/job'/gm) ?? []).length;
  ck.t('A2', '`POST /api/job` 注册恰 1 处（未新增/未拆口）', jobRouteCount === 1, `routes=${jobRouteCount}`);

  const PB = publishBody(JOB_SVC);
  const gateAt = PB.indexOf('hasManagedProject(actor.uid');
  const keyAt = PB.indexOf('resolveJobCreateKeyRequired');
  const postAt = PB.indexOf('jobPostEvent(payload, ex)');
  const employerAt = PB.indexOf('body.employer_uid');
  ck.t('A3', '★ 闸在 `publishJob` **最前**：早于 create_key 形状闸 / employer 闸 / `jobPostEvent`（任何写库）',
    PB.length > 0 && gateAt > 0 && gateAt < keyAt && keyAt < postAt && gateAt < employerAt,
    JSON.stringify({ gate: gateAt, create_key: keyAt, employer: employerAt, post_event: postAt }));

  const gateBlock = PB.slice(Math.max(0, gateAt - 60), gateAt + 360);
  ck.t('A4', '错误体例 = 403 `AUTH_FORBIDDEN` + `details.reason=\'project_required\'`（既有闭集，零新码）',
    /fail\(\s*403,\s*\n?\s*'AUTH_FORBIDDEN'/.test(PB) && /reason:\s*'project_required'/.test(PB)
      && gateBlock.includes("'AUTH_FORBIDDEN'") && gateBlock.includes("reason: 'project_required'"),
    `block=${gateBlock.replace(/\s+/g, ' ').slice(0, 180)}`);

  const HP = hasProjectBody(PROJ_SVC);
  ck.t('A5', '读口 `hasManagedProject` = **纯 SELECT**：`FROM public.project` · `owner_uid = $1::bigint` · `status <> \'ended\'` · `LIMIT 1` · 零写关键字',
    HP.length > 0 && /FROM public\.project/.test(HP) && /owner_uid = \$1::bigint/.test(HP)
      && /status <> 'ended'/.test(HP) && /LIMIT 1/.test(HP)
      && !/\b(INSERT|UPDATE|DELETE|TRUNCATE|INSERT\s+INTO)\b/i.test(HP),
    `bytes=${HP.length} write_kw=${/\b(INSERT|UPDATE|DELETE)\b/i.test(HP)}`);

  // ★ `AUTH_FORBIDDEN` 属 **AUTH_* 码域**（`auth.err.*`，与 ledger 33 码闭集并列、不进闭集）——
  //   本闸借它 = 借既有闭集、零新码；同时断言它**不在** 33 码表里（证明没有顺手往闭集加码）。
  ck.t('A6', '零新错误码：`LEDGER_ERROR_CODES` 仍 33 · `AUTH_FORBIDDEN` 在 **AUTH_* 域**且不在 33 码闭集（借既有体例）',
    LEDGER_ERROR_CODES.length === 33
      && Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, 'AUTH_FORBIDDEN')
      && !(LEDGER_ERROR_CODES as readonly string[]).includes('AUTH_FORBIDDEN'),
    `codes=${LEDGER_ERROR_CODES.length} auth_domain=${Object.prototype.hasOwnProperty.call(AUTH_ERROR_MESSAGES, 'AUTH_FORBIDDEN')} in_ledger=${(LEDGER_ERROR_CODES as readonly string[]).includes('AUTH_FORBIDDEN')}`);
  ck.t('A7', '零新 kind：`LEDGER_KINDS` 仍 24（发布仍只 `job_escrow`）',
    LEDGER_KINDS.length === 24, `kinds=${LEDGER_KINDS.length}`);

  ck.t('A8', '闸真源**只在服务层**：路由文件零 `project_required` / 零 `hasManagedProject`（不在路由重复判定）',
    !INDEX_TS.includes('project_required') && !INDEX_TS.includes('hasManagedProject'),
    `idx_reason=${INDEX_TS.indexOf('project_required')} idx_has=${INDEX_TS.indexOf('hasManagedProject')}`);

  ck.t('A9', '`ex` 注入贯通：`publishJob(..., ex?: TxClient)` 且 `jobPostEvent(payload, ex)`（门可在回滚事务内跑真路径）',
    /export const publishJob = async \(params: \{[\s\S]{0,200}\}, ex\?: TxClient\)/.test(JOB_SVC)
      && /jobPostEvent\(payload, ex\)/.test(JOB_SVC),
    `sig=${/ex\?: TxClient\)/.test(PB)} pass_ex=${/jobPostEvent\(payload, ex\)/.test(PB)}`);

  // ======================================================================== B/S/N · 事务内
  const pool = mkPool(2);
  const applied63 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0063'"))[0]?.n ?? 0) > 0;
  out.project_migration_applied = applied63;
  if (!applied63) {
    ck.t('B0', '前置：dev 库已 apply 0063（`project` 表在场，闸可判）', false, 'schema_migration 0063 缺行');
  }

  let nc: { publishJob: (p: { actorUid: number; body: Record<string, unknown> | undefined }, ex?: TxClient) => Promise<unknown>; replaced: number } | null = null;
  let ncError = '';
  try {
    nc = loadNeutralizedPublishJob();
  } catch (e) {
    ncError = String((e as { message?: string })?.message ?? e).slice(0, 300);
  }
  out.nc_load = { loaded: nc !== null, replaced: nc?.replaced ?? 0, error: ncError || null };

  const r = await inRollbackTx<Record<string, unknown>>(pool, async (c) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as TxClient;

    // ---- 夹具：五个用户（rollback 内；evm 由 uid 派生 ⇒ 唯一）
    const mkUser = async (uid: number, tag: string) => {
      await raw1(c,
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio`,
        [uid, `job-project-gate ${tag} ${RUN}`]);
      return uid;
    };
    const U_NONE = await mkUser(918701, 'no-project');
    const U_REC = await mkUser(918702, 'recruiting-owner');
    const U_END = await mkUser(918703, 'ended-owner');
    const U_OTHER = await mkUser(918704, 'other-owner');
    const U_WORK = await mkUser(918705, 'working-owner');
    R.fixture_users = [U_NONE, U_REC, U_END, U_OTHER, U_WORK];

    // 资金：受信任平台 mint（每条独立 user ⇒ 独立账户；随事务回滚）
    for (const uid of [U_NONE, U_REC, U_END, U_OTHER, U_WORK]) {
      await postEvent({
        op: 'mint', uid: String(uid), cid: '1', amount: '1000000', platform: true,
        idempotencyKey: `ops:jobproj-gate:${RUN}:mint:${uid}`, memo: 'job-project-gate usd fixture', ex,
      });
    }

    // 项目夹具：直插（owner / status 是本闸的唯一判据面；snowflake 用固定高位避免碰撞）
    let sf = 8800000000000000000n;
    const mkProject = async (owner: number, status: string, tag: string): Promise<string> => {
      sf += 1n;
      const row = await raw1<{ project_id: string }>(c,
        `INSERT INTO public.project
           (snowflake_id, owner_uid, title, description, headcount, recruit_min_account_days,
            wage_batt_per_claim, wage_cid, wage_currency_amount, wage_interval_hours, status)
         VALUES ($1::bigint, $2::bigint, $3::text, $4::text, 3, 0, 10, NULL, NULL, 1, $5::text)
         RETURNING project_id::text AS project_id`,
        [sf.toString(), String(owner), `job-proj-gate ${tag} ${RUN}`, `gate fixture ${RUN}`, status]);
      return String(row?.project_id ?? '');
    };
    const P_REC = await mkProject(U_REC, 'recruiting', 'recruiting');
    const P_WORK = await mkProject(U_WORK, 'working', 'working');
    const P_END = await mkProject(U_END, 'ended', 'ended');
    const P_OTHER = await mkProject(U_OTHER, 'recruiting', 'other');
    R.fixture_projects = { rec: P_REC, work: P_WORK, ended: P_END, other: P_OTHER };

    // 「只是受雇」夹具：U_NONE 是 U_OTHER 项目的在职 worker（证明「受雇 ≠ 管理」）
    await raw1(c,
      `INSERT INTO public.project_worker (project_id, uid, status, hired_at)
       VALUES ($1::bigint, $2::bigint, 'hired', now())`,
      [P_OTHER, String(U_NONE)]);

    // ---- 只读取数器（零写）
    const jobRows = async () => Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.job'))?.n ?? -1);
    const escrowRows = async () => Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.ledger_entry WHERE idempotency_key LIKE 'biz:job:escrow:%'"))?.n ?? -1);
    const ledgerRows = async () => Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.ledger_entry'))?.n ?? -1);
    const bal = async (uid: number, cid = 1) => String((await raw1<{ b: string }>(c,
      'SELECT COALESCE((SELECT balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint), 0)::text AS b',
      [String(uid), String(cid)]))?.b ?? '0');
    const frz = async (uid: number, cid = 1) => String((await raw1<{ f: string }>(c,
      'SELECT COALESCE((SELECT frozen FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint), 0)::text AS f',
      [String(uid), String(cid)]))?.f ?? '0');

    const publish = (uid: number, tag: string, over: Record<string, unknown> = {}) =>
      publishJob({
        actorUid: uid,
        body: {
          create_key: `cli:jobproj-${RUN}-${tag}`,
          cid: '1', reward: '100', headcount: '1',
          title: `jobproj ${tag} ${RUN}`, description: `job-project-gate ${tag}`,
          ...over,
        },
      }, ex);

    // ---- 读口单测（直调，同一个 ex）：no-project ⇒ false；recruiting / working ⇒ true；ended ⇒ false；他人项目 ≠ 我的
    const hp = {
      none: await hasManagedProject(U_NONE, ex),
      rec: await hasManagedProject(U_REC, ex),
      work: await hasManagedProject(U_WORK, ex),
      ended: await hasManagedProject(U_END, ex),
      other: await hasManagedProject(U_OTHER, ex),
    };
    R.has_managed_project = hp;
    ck.t('S1', '读口四态：无项目 false · recruiting true · working true · **ended false**（终态封板不算在管）· 他人自有项目 true',
      hp.none === false && hp.rec === true && hp.work === true && hp.ended === false && hp.other === true,
      JSON.stringify(hp));

    // ---- S2 · 臂①：无项目用户发布 ⇒ 403 project_required 且**零写库**
    const before = { jobs: await jobRows(), escrow: await escrowRows(), ledger: await ledgerRows(), bal: await bal(U_NONE), frz: await frz(U_NONE) };
    const denied = await publish(U_NONE, 'no-project');
    const after = { jobs: await jobRows(), escrow: await escrowRows(), ledger: await ledgerRows(), bal: await bal(U_NONE), frz: await frz(U_NONE) };
    R.arm_denied = { status: verbOf(denied), code: codeOf(denied), reason: reasonOf(denied), before, after };
    ck.t('S2', '★臂① 无项目用户发布 ⇒ 403 `AUTH_FORBIDDEN` + `project_required` 且**零写库**（job 行 / 托管台账 / 余额 / frozen 全不变）',
      verbOf(denied) === 403 && codeOf(denied) === 'AUTH_FORBIDDEN' && reasonOf(denied) === 'project_required'
        && before.jobs === after.jobs && before.escrow === after.escrow && before.ledger === after.ledger
        && before.bal === after.bal && before.frz === after.frz,
      JSON.stringify(R.arm_denied));

    // ---- S3 · 臂②：有 recruiting 项目 ⇒ 发布 200（与改前一致：job +1 / 托管 2 腿 / 余额 −100 / frozen +100）
    const recBefore = { jobs: await jobRows(), escrow: await escrowRows(), bal: await bal(U_REC), frz: await frz(U_REC) };
    const ok = await publish(U_REC, 'recruiting');
    const recAfter = { jobs: await jobRows(), escrow: await escrowRows(), bal: await bal(U_REC), frz: await frz(U_REC) };
    const okView = viewOf(ok);
    R.arm_allowed = {
      status: verbOf(ok), created: okView.created, job_id: okView.job_id,
      jobs: [recBefore.jobs, recAfter.jobs], escrow: [recBefore.escrow, recAfter.escrow],
      bal_delta: (BigInt(recBefore.bal) - BigInt(recAfter.bal)).toString(),
      frz_delta: (BigInt(recAfter.frz) - BigInt(recBefore.frz)).toString(),
    };
    ck.t('S3', '★臂② 有 recruiting 项目 ⇒ 200 与改前一致（job +1 · 托管台账 +2 腿 · 余额 −100 · frozen +100 · `created=true`）',
      verbOf(ok) === 200 && okView.created === true && recAfter.jobs === recBefore.jobs + 1
        && recAfter.escrow === recBefore.escrow + 2
        && BigInt(recBefore.bal) - BigInt(recAfter.bal) === 100n
        && BigInt(recAfter.frz) - BigInt(recBefore.frz) === 100n,
      JSON.stringify(R.arm_allowed));

    // ---- S4 · 臂③：项目 ended ⇒ 403
    const endedBefore = { jobs: await jobRows(), bal: await bal(U_END), frz: await frz(U_END) };
    const deniedEnded = await publish(U_END, 'ended');
    const endedAfter = { jobs: await jobRows(), bal: await bal(U_END), frz: await frz(U_END) };
    R.arm_ended = { status: verbOf(deniedEnded), reason: reasonOf(deniedEnded), before: endedBefore, after: endedAfter };
    ck.t('S4', '★臂③ 项目 `ended` ⇒ 403 `project_required`（零写库）',
      verbOf(deniedEnded) === 403 && reasonOf(deniedEnded) === 'project_required'
        && endedBefore.jobs === endedAfter.jobs && endedBefore.bal === endedAfter.bal && endedBefore.frz === endedAfter.frz,
      JSON.stringify(R.arm_ended));

    // ---- S5 · 臂④：他人项目不算（U_NONE 是 U_OTHER 项目的在职 worker，但自己不拥有任何项目）
    const workerRows = Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.project_worker WHERE uid = $1::bigint AND status = 'hired'", [String(U_NONE)]))?.n ?? 0);
    const deniedOther = await publish(U_NONE, 'other-project-worker');
    R.arm_owner_mismatch = { hired_rows: workerRows, status: verbOf(deniedOther), reason: reasonOf(deniedOther) };
    ck.t('S5', '★臂④ 他人项目不算：本人在他人项目**在职**（hired 1 行）但零自有项目 ⇒ 仍 403 `project_required`',
      workerRows === 1 && verbOf(deniedOther) === 403 && reasonOf(deniedOther) === 'project_required',
      JSON.stringify(R.arm_owner_mismatch));

    // ---- S6 · 正控：`working` 状态项目放行（`<> 'ended'` 口径 = 非终态皆算在管）
    const okWorking = await publish(U_WORK, 'working');
    const okOther = await publish(U_OTHER, 'other-owner');
    R.arm_working = { status: verbOf(okWorking), created: viewOf(okWorking).created, other_owner_status: verbOf(okOther) };
    ck.t('S6', '正控：`working` 项目所有者 ⇒ 200 · 他人（自有 recruiting 项目）⇒ 200（闸不误拦活跃态）',
      verbOf(okWorking) === 200 && viewOf(okWorking).created === true && verbOf(okOther) === 200,
      JSON.stringify(R.arm_working));

    // ---- S7 · 正控：闸不破坏既有幂等语义（同键重投 ⇒ 200 replay、不增行）
    const jobsBeforeReplay = await jobRows();
    const replay = await publish(U_REC, 'recruiting');
    const jobsAfterReplay = await jobRows();
    R.arm_replay = { replay: replayOf(replay), job_id: viewOf(replay).job_id, jobs: [jobsBeforeReplay, jobsAfterReplay] };
    ck.t('S7', '正控：同 create_key 重投 ⇒ 200 `idempotent_replay` · 同 job_id · 行数不变',
      verbOf(replay) === 200 && replayOf(replay) === true
        && String(viewOf(replay).job_id) === String(viewOf(ok).job_id)
        && jobsAfterReplay === jobsBeforeReplay,
      JSON.stringify(R.arm_replay));

    // ---- N · 负控：把闸谓词中和成 `false &&`（= 去掉闸）⇒ 无项目用户发布**可成功**
    const ncUser = await mkUser(918706, 'negative-control');
    await postEvent({
      op: 'mint', uid: String(ncUser), cid: '1', amount: '1000000', platform: true,
      idempotencyKey: `ops:jobproj-gate:${RUN}:mint:${ncUser}`, memo: 'job-project-gate nc fixture', ex,
    });
    const ncJobsBefore = await jobRows();
    let ncResult: unknown = null;
    try {
      const mod = nc as NonNullable<typeof nc>;
      ncResult = await mod.publishJob({
        actorUid: ncUser,
        body: {
          create_key: `cli:jobproj-${RUN}-nc`, cid: '1', reward: '100', headcount: '1',
          title: `jobproj nc ${RUN}`, description: 'job-project-gate negative control',
        },
      }, ex);
    } catch (e) {
      ncError = String((e as { message?: string })?.message ?? e).slice(0, 200);
    }
    const ncJobsAfter = await jobRows();
    R.negative_control = {
      neutralized_at: nc?.replaced ?? 0, status: verbOf(ncResult), created: viewOf(ncResult).created,
      jobs: [ncJobsBefore, ncJobsAfter], error: ncError || null,
      note: '闸被中和 ⇒ 无项目用户**发布成功**（job +1）⇒ 若门仍报红以外的绿，说明判据对闸不敏感',
    };
    ck.t('N1', '★负控（判据可红）：中和闸谓词（`false &&`，恰 1 处替换、零落盘）⇒ **无项目用户发布成功 200 + `created=true` + job 行 +1** ⇒ 臂① 必红',
      (nc?.replaced ?? 0) === 1 && verbOf(ncResult) === 200 && viewOf(ncResult).created === true
        && ncJobsAfter === ncJobsBefore + 1,
      JSON.stringify(R.negative_control));

    return R;
  });

  if (r.error) {
    out.tx_error = String((r.error as { message?: string })?.message ?? r.error).slice(0, 400);
    ck.t('X', '事务内全链执行未抛未预期异常', false, `error=${out.tx_error}`);
  } else {
    out.readings = r.result;
  }

  // ======================================================================== Z · 残留（rollback 之后）
  if (!r.error) {
    const z = await (async () => {
      const jobs = await qRetry<{ n: number }>(pool,
        "SELECT count(*)::int AS n FROM public.job WHERE create_key LIKE 'cli:jobproj-%'");
      const projects = await qRetry<{ n: number }>(pool,
        "SELECT count(*)::int AS n FROM public.project WHERE description LIKE 'gate fixture %'");
      const users = await qRetry<{ n: number }>(pool,
        "SELECT count(*)::int AS n FROM public.users WHERE bio LIKE 'job-project-gate %'");
      return { jobs: Number(jobs[0]?.n ?? -1), projects: Number(projects[0]?.n ?? -1), users: Number(users[0]?.n ?? -1) };
    })();
    ck.t('Z1', '零残留：提交面无本门夹具（job / project / users 各 0 行）· 本门单回滚事务',
      z.jobs === 0 && z.projects === 0 && z.users === 0, JSON.stringify(z));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('job-project-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
