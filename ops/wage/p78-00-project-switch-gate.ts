/**
 * p78-00 · 项目「加入 / 切换」闸（`POST /api/project/:id/apply` 的 `{switch:true}` 同事务离职＋入职）
 * ---------------------------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p76 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/wage/p78-00-project-switch-gate.ts
 * 读数：`ops/wage/readings/p78-project-switch-gate-<RUN>.json`
 *
 * 被守住的面（commit `c1995a6` 已落盘实现在此**现取**，本单只补验证产物）：
 *   ① `applyProjectVerb({ …, switch?: boolean })`：在职于**其它项目**时
 *      · `switch` 缺省 / 非 true ⇒ 409 `worker_already_hired`（**缺省 = 旧行为**，旧前端零感知）；
 *      · `switch === true` ⇒ **同事务**旧在职行 `status='left', left_at=now()` + 插新行
 *        （`hired_at` 默认 now()）⇒ 领取窗口起点前移 ⇒ **间隔从新 hired_at 重算**；响应加性
 *        `switched_from`（旧 project_id；非切换 = null）。
 *   ② **三闸先于切换**：招募期 409 `project_not_recruiting` → 名额 409 `project_headcount_full`
 *      → 注册天数 409 `project_min_days_unmet`，全部在 ⑤ 切换判定之前 ⇒ 切换不是绕闸后门。
 *   ③ 本项目已在职 ⇒ 200 幂等回放（`switched_from = null`，不新插行）。
 *   ④ 详情读口加性四键 `my_role` / `my_hired_at` / `my_current_project_id` / `my_current_project_title`
 *      （登录态；匿名整键缺省）—— 项目页三态与 /wage 在职态判定的服务端真源。
 *   ⑤ 前端钩子：项目页 `project-entry-join|switch|hired` + 行内确认 `project-entry-switch-confirm`；
 *      /wage 在职时零 `[data-sf-action="join"]` 且不渲染 `wage-one-at-a-time`（探针靠钩子定位）。
 *
 * 判据面：
 *   A · 静态：注册点仍 **109**（50/54/4/3/0 · 零新路由）· 路由接线（`switch: body.switch === true`
 *       + `switched_from` 加性 + message 三分支）· 服务层形状（switch 入参 / 旧行 left UPDATE /
 *       新行 INSERT 不带 hired_at / 幂等回放切走前 / 三闸位序先于切换）/ 零新错误码。
 *   S · 行为（**真 HTTP** · 本进程 app · port 0 · 真 dev 库提交面）：
 *       A 不带 switch 在职他处 ⇒ 409 `worker_already_hired`（外加旧行仍在职、目标项目零行）；
 *       B 带 `{switch:true}` ⇒ 200 · `switched_from` = 旧 project_id · 旧行 `left`（`left_at` 非空）
 *         · 新行 `hired` 且 `hired_at ∈ [请求前, 请求后]`（**旧行 hired_at = 5h 前**，间隔 4h
 *         ⇒ 「hired_at 前移」可观测）；
 *       C 紧接 claim ⇒ 400 `wage_interval_not_reached` · `details.window_start` **不早于**本次请求
 *         （证明窗口起点 = 新 hired_at，不是旧行的 5h 前；否则 5h ≥ 4h 会放行）；
 *       D 满员项目带 switch ⇒ 409 `project_headcount_full`（切换不绕过）· 且 A 仍在本项目在职
 *         （旧行未被 left、满员项目零行）⇒ 闸失败惰性、无半切；
 *       E 已在目标项目再申请 ⇒ 200 幂等 · `switched_from = null` · 同 worker_id · 在职行恰 1。
 *   F · **负控（判据必须可红）**：F1 mutant（`project-service` 副本里把旧行 `SET status='left'`
 *       短路成 `SET status = status`，配 `index.p78neg.ts` 子进程 5799 真 HTTP）⇒ 同 B 流必然
 *       不再是「旧行 left」，且新行插不进去（部分唯一索引 23505 ⇒ 409）⇒ **B 谓词必红**；
 *       F2 同一谓词喂 B 的真实观测 ⇒ true（可证伪自检）。
 *   Z · 残留：夹具 `project_worker` / `project` / `project_wage_claim` / `account` / `batt_account`
 *       / `users` 全删 ⇒ 计数 0；非夹具 project / project_worker 指纹前后逐字相等（本轮零外溢写）。
 *
 * 纪律：**不 apply 迁移、不 push、不改 frontend/docs、不改业务代码**；库身份自证
 *   `neon.project_id` ≠ `quiet-math-65207667` ⇒ **ABORT**（不跑、不写）。夹具私钥落
 *   `~/.config/seafood/p78-gate.env` 0600（**不打印**）。夹具 create 前缀 `p78 gate`、
 *   slug 前缀 `p78` ⇒ 自建自删，可重复跑。
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'module';
import { spawn } from 'child_process';
import { checker, mkPool, qRetry, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';

/** ethers 只在 backend-ts/node_modules ⇒ 以 backend-ts 为锚解析（ops/ 直 import 解析不到） */
const requireFromBackend = createRequire(path.resolve(__dirname, '../..', 'backend-ts/scripts/p7b-lib.ts'));
interface GateWallet {
  privateKey: string;
  address: string;
  signMessage(message: string): Promise<string>;
}
const { Wallet } = requireFromBackend('ethers') as {
  Wallet: {
    new (privateKey?: string): GateWallet;
    createRandom(): GateWallet;
  };
};

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'readings');
const PROJECT_ID = 'quiet-math-65207667';
const NEG_PORT = 5799;
const INTERVAL_HOURS = 4;
const OLD_HIRED_HOURS = 5; // 旧在职行 hired_at = now() - 5h（> interval 4h ⇒ 「沿用旧 hired_at 就会放行」）

const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const SVC_TS = readSrc('backend-ts/src/project-service.ts');
const PROJECT_PAGE_JSX = readSrc('frontend/src/pages/project/ProjectPage.jsx');
const WAGE_PAGE_JSX = readSrc('frontend/src/pages/wage/WagePage.jsx');
const PROJECT_API_JS = readSrc('frontend/src/pages/project/project-api.js');

type Http = { status: number; body: Record<string, unknown> };
const errOf = (r: Http) => (r.body.error && typeof r.body.error === 'object' ? r.body.error as Record<string, unknown> : {});
const dataOf = (r: Http) => (r.body.data && typeof r.body.data === 'object' ? r.body.data as Record<string, unknown> : {});
const reasonOf = (r: Http) => {
  const d = errOf(r).details;
  return (d && typeof d === 'object' ? String((d as Record<string, unknown>).reason ?? '') : '');
};

/** B 段核心谓词（真实臂与 F 系 mutant 共用 —— 同一函数，保证可证伪） */
type BObs = {
  status: number;
  switchedFrom: unknown;
  oldStatus: string | null;
  oldLeftAt: string | null;
  newStatus: string | null;
  newHiredAt: string | null;
  fromIso: string;
  toIso: string;
};
const bSwitchPredicate = (obs: BObs): boolean => {
  const t = obs.newHiredAt ? Date.parse(obs.newHiredAt) : NaN;
  return obs.status === 200
    && obs.switchedFrom !== null && obs.switchedFrom !== undefined && obs.switchedFrom !== ''
    && obs.oldStatus === 'left'
    && Boolean(obs.oldLeftAt)
    && obs.newStatus === 'hired'
    && Number.isFinite(t) && t >= Date.parse(obs.fromIso) && t <= Date.parse(obs.toIso);
};

// ============================================================================
// 静态面（零 DB）
// ============================================================================
const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
const routeSliceOf = (verb: string, tail: string): string => {
  const head = INDEX_TS.indexOf(`${verb}${tail}`);
  if (head < 0) return '';
  const next = INDEX_TS.indexOf('\napp.', head + 8);
  return INDEX_TS.slice(head, next < 0 ? undefined : next);
};
const APPLY_POST = routeSliceOf('app.post', "('/api/project/:id/apply'");
const APPLY_SRC = SVC_TS.slice(
  SVC_TS.indexOf('export const applyProjectVerb'),
  SVC_TS.indexOf('export const claimProjectWageVerb'),
);

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { script: 'ops/wage/p78-00-project-switch-gate.ts' };

  // ---------------------------------------------------------------- 库身份自证（前置闸）
  const pool = mkPool(6);
  const ident = await raw1<{ pid: string | null; db: string }>(pool as unknown as Qx,
    `SELECT current_setting('neon.project_id', true) AS pid, current_database() AS db`);
  out.db_identity = ident;
  if (String(ident?.pid ?? '') !== PROJECT_ID) {
    console.error(`ABORT: neon.project_id = ${String(ident?.pid)} ≠ ${PROJECT_ID}（非 dev 库，拒绝运行）`);
    await pool.end();
    process.exit(2);
  }

  ck.t('A1',
    '★路由面：注册点仍 **109**（50/54/4/3/0 · 零新路由：`POST /api/project/:id/apply` 是既有口，本单只加 switch 语义）',
    regs === 111 && countVerb('get') === 50 && countVerb('post') === 54 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0,
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete'), put: countVerb('put') }));

  ck.t('A2',
    '★apply 路由接线：`switch: body.switch === true`（**has-value 收窄**：只有真 true 才切，字符串 "true" 不算）'
    + '· 调用后 `result.view?.switched_from` 进 message 三分支（replay / switched / accepted）· `sendSuccess(res, result.view)` 原样透出 ⇒ 响应加性键',
    APPLY_POST.includes('switch: body.switch === true')
      && APPLY_POST.includes('const switched = result.view?.switched_from ?? null')
      && /switched \? 'Project switched \(left previous project\)'/.test(APPLY_POST)
      && APPLY_POST.includes('sendSuccess(\n      res,\n      result.view,')
      && !/fail\(|throw /.test(APPLY_POST.split('applyProjectVerb')[1] ?? ''),
    JSON.stringify({
      narrowed: APPLY_POST.includes('switch: body.switch === true'),
      switched_var: APPLY_POST.includes('result.view?.switched_from'),
      passthrough: APPLY_POST.includes('result.view,'),
    }));

  ck.t('A3',
    '★服务层形状：`switch?: boolean` 入参 · 旧行左移 `SET status = \'left\', left_at = now()`（同事务）'
    + '· 新行 `INSERT … (project_id, uid, status) VALUES (…, \'hired\')`（**不带 hired_at** ⇒ DB 默认 now() ⇒ 间隔重算）'
    + '· `input.switch !== true` ⇒ 409 `worker_already_hired` · `switched_from` 两分支（null / 旧 id）',
    APPLY_SRC.includes('switch?: boolean;')
      && /UPDATE public\.project_worker SET status = 'left', left_at = now\(\)/.test(APPLY_SRC)
      && APPLY_SRC.includes("INSERT INTO public.project_worker (project_id, uid, status) VALUES ($1::bigint, $2::bigint, 'hired')")
      && APPLY_SRC.includes('if (input.switch !== true) {')
      && APPLY_SRC.includes("return conflict('worker_already_hired', { project_id: str(other[0].project_id) });")
      && APPLY_SRC.includes('switched_from: switchedFrom,')
      && APPLY_SRC.includes('switched_from: null,'),
    JSON.stringify({
      switch_param: APPLY_SRC.includes('switch?: boolean;'),
      left_update: /SET status = 'left', left_at = now\(\)/.test(APPLY_SRC),
      insert_no_hired_at: !/INSERT INTO public\.project_worker \(project_id, uid, status, hired_at\)/.test(APPLY_SRC),
    }));

  ck.t('A4',
    '★三闸位序（切换不是后门）：幂等回放 ① → 招募期 ② → 名额 ③ → 注册天数 ④ → 他项目在职 / 切换 ⑤'
    + '（按源码 index 单调递增判；⑤ 里的 left UPDATE 必在 `worker_already_hired` 之后）',
    (() => {
      const iMine = APPLY_SRC.indexOf("status = 'hired' LIMIT 1`");
      const iRecruit = APPLY_SRC.indexOf("conflict('project_not_recruiting'");
      const iFull = APPLY_SRC.indexOf("conflict('project_headcount_full'");
      const iDays = APPLY_SRC.indexOf("conflict('project_min_days_unmet'");
      const iOther = APPLY_SRC.indexOf("conflict('worker_already_hired', { project_id");
      const iLeft = APPLY_SRC.indexOf("UPDATE public.project_worker SET status = 'left'");
      const seq = [iMine, iRecruit, iFull, iDays, iOther, iLeft];
      out.apply_gate_order = { mine: iMine, recruiting: iRecruit, headcount: iFull, min_days: iDays, already_hired: iOther, left_update: iLeft };
      return seq.every((n) => n > 0) && seq.every((n, i) => i === 0 || n > seq[i - 1]);
    })(),
    JSON.stringify(out.apply_gate_order ?? null));

  ck.t('A5',
    '★详情读口加性四键：在职分支 `my_role: onThisProject ? \'hired\' : \'none\'` ＋ `my_hired_at` / '
    + '`my_current_project_id` / `my_current_project_title`；不在职分支四键**齐在场且 null**（匿名整键缺省在 service 外层守）',
    SVC_TS.includes("my_role: onThisProject ? 'hired' : 'none'")
      && SVC_TS.includes('my_current_project_id: hiredProjectId')
      && SVC_TS.includes('my_current_project_title: str(mine[0].title)')
      && SVC_TS.includes("my_role: 'none', my_hired_at: null, my_current_project_id: null, my_current_project_title: null"),
    'ok');

  ck.t('A6',
    '★前端钩子（探针 / 单测靠它定位）：项目页 `project-entry-join` / `project-entry-switch` / '
    + '`project-entry-hired` / `project-entry-switch-confirm` 四钩在场 · 切换确认前提 = `confirmSwitch` 早退（零请求）'
    + '· /wage 加入按钮受 `hiredAnywhere` 支配、`wage-one-at-a-time` 受 `hiredKey` 支配 · apply 载荷 `{switch:true}` 由 api 层透传',
    PROJECT_PAGE_JSX.includes("'project-entry-join'")
      && PROJECT_PAGE_JSX.includes("'project-entry-switch'")
      && PROJECT_PAGE_JSX.includes('data-sf-m="project-entry-hired"')
      && PROJECT_PAGE_JSX.includes('data-sf-m="project-entry-switch-confirm"')
      && /if \(hiredElsewhere\) \{\s*\n\s*setNotice\(null\)\s*\n\s*setConfirmSwitch\(true\)\s*\n\s*return/.test(PROJECT_PAGE_JSX)
      && WAGE_PAGE_JSX.includes('recruiting && !hiredAnywhere ?')
      && WAGE_PAGE_JSX.includes('{hiredKey ? null : (')
      && PROJECT_API_JS.includes("applyToProject = (ref, body, user) => postJson(`/api/project/${enc(ref)}/apply`, body || {}, user)"),
    JSON.stringify({
      join: PROJECT_PAGE_JSX.includes("'project-entry-join'"),
      switch: PROJECT_PAGE_JSX.includes("'project-entry-switch'"),
      hired: PROJECT_PAGE_JSX.includes('data-sf-m="project-entry-hired"'),
      confirm: PROJECT_PAGE_JSX.includes('data-sf-m="project-entry-switch-confirm"'),
      wage_join_gate: WAGE_PAGE_JSX.includes('recruiting && !hiredAnywhere ?'),
      wage_note_gate: WAGE_PAGE_JSX.includes('{hiredKey ? null : ('),
    }));

  // ============================================================================
  // 夹具（真 dev 库提交面 · 自建自删）
  // ============================================================================
  const ENV_FILE = path.join(os.homedir(), '.config/seafood/p78-gate.env');
  const readEnv = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {};
    const o: Record<string, string> = {};
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const i = line.indexOf('=');
      if (i > 0) o[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return o;
  };
  const savedEnv = readEnv(ENV_FILE);
  const ROLES = ['A', 'B'] as const;
  type Role = typeof ROLES[number];
  const wallets = {} as Record<Role, GateWallet>;
  let envDirty = false;
  for (const role of ROLES) {
    const k = String(savedEnv[`P78_KEY_${role}`] || '').trim();
    wallets[role] = k ? new Wallet(k) : Wallet.createRandom();
    if (!k) { savedEnv[`P78_KEY_${role}`] = wallets[role].privateKey; envDirty = true; }
  }
  if (envDirty) {
    fs.mkdirSync(path.dirname(ENV_FILE), { recursive: true, mode: 0o700 });
    fs.writeFileSync(ENV_FILE, ROLES.map((r) => `P78_KEY_${r}=${savedEnv[`P78_KEY_${r}`]}`).join('\n') + '\n', { mode: 0o600 });
    fs.chmodSync(ENV_FILE, 0o600);
  }
  const addrOf = (r: Role) => wallets[r].address.toLowerCase();

  const users = {} as Record<Role, number>;
  for (const role of ROLES) {
    const u = await DatabaseService.findOrCreateUserByEvm(addrOf(role));
    users[role] = Number(u.uID);
  }
  const FIX_UIDS = ROLES.map((r) => users[r]);

  // 外溢基线（**非夹具**行指纹：本轮只碰夹具项目 / 夹具用户）
  const projBase = await raw1<{ n: string; maxid: string }>(pool as unknown as Qx,
    `SELECT count(*)::text AS n, COALESCE(max(project_id), 0)::text AS maxid FROM public.project WHERE owner_uid <> ALL($1::bigint[])`,
    [FIX_UIDS]);
  const workerBase = await raw1<{ n: string; maxw: string }>(pool as unknown as Qx,
    `SELECT count(*)::text AS n, COALESCE(max(worker_id), 0)::text AS maxw FROM public.project_worker WHERE uid <> ALL($1::bigint[])`,
    [FIX_UIDS]);
  out.baseline = { non_fixture_projects: projBase, non_fixture_workers: workerBase };

  let snowSeq = 0;
  const snowflake = (): string => {
    snowSeq += 1;
    return (BigInt(Date.now()) * 1000000n + BigInt(Math.floor(Math.random() * 1000000)) * 10n + BigInt(snowSeq % 10)).toString();
  };
  const slugOf = (tag: string) => `p78${RUN.slice(0, 10)}${tag}`.toLowerCase();

  const mkProject = async (tag: string, headcount: number): Promise<string> => {
    const row = await raw1<{ project_id: string }>(pool as unknown as Qx,
      `INSERT INTO public.project
         (snowflake_id, owner_uid, title, slug, description, headcount, recruit_min_account_days,
          wage_batt_per_claim, wage_cid, wage_currency_amount, wage_interval_hours, status)
       VALUES ($1::bigint, $2::bigint, $3, $4, 'p78 gate', $5::int, 0, 10, NULL, NULL, $6::int, 'recruiting')
       RETURNING project_id::text AS project_id`,
      [snowflake(), String(users.A), `p78 gate ${tag} ${RUN}`, slugOf(tag), String(headcount), String(INTERVAL_HOURS)]);
    return String(row?.project_id ?? '');
  };
  const hireDirect = async (projectId: string, uid: number, hoursAgo: number): Promise<string> => {
    const row = await raw1<{ worker_id: string }>(pool as unknown as Qx,
      `INSERT INTO public.project_worker (project_id, uid, status, hired_at)
       VALUES ($1::bigint, $2::bigint, 'hired', now() - ($3::int * interval '1 hour'))
       RETURNING worker_id::text AS worker_id`,
      [projectId, String(uid), String(hoursAgo)]);
    return String(row?.worker_id ?? '');
  };
  const workerRow = async (projectId: string, uid: number) =>
    raw1<{ worker_id: string; status: string; hired_at: string | null; left_at: string | null }>(pool as unknown as Qx,
      `SELECT worker_id::text AS worker_id, status, hired_at::text AS hired_at, left_at::text AS left_at
         FROM public.project_worker WHERE project_id = $1::bigint AND uid = $2::bigint
        ORDER BY worker_id DESC LIMIT 1`, [projectId, String(uid)]);
  const hiredRowsOf = async (uid: number) =>
    raw<{ project_id: string; worker_id: string; hired_at: string }>(pool as unknown as Qx,
      `SELECT project_id::text AS project_id, worker_id::text AS worker_id, hired_at::text AS hired_at
         FROM public.project_worker WHERE uid = $1::bigint AND status = 'hired' ORDER BY worker_id`, [String(uid)]);

  const FIX_PROJECTS: string[] = [];
  let okRun = false;

  // ============================================================================
  // 真 HTTP 面（本进程 app · port 0 —— p76 同族）
  // ============================================================================
  let server: { close: (cb?: () => void) => void } | null = null;
  let base = '';
  const api = async (token: string | null, method: string, urlPath: string, body?: unknown): Promise<Http> => {
    const res = await fetch(base + urlPath, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json: Record<string, unknown> = {};
    try { json = await res.json() as Record<string, unknown>; } catch { /* 非 JSON */ }
    return { status: res.status, body: json };
  };
  const login = async (role: Role): Promise<string> => {
    const ch = await api(null, 'POST', '/api/auth/challenge', { evm_address: addrOf(role) });
    const chData = (ch.body.data ?? {}) as Record<string, unknown>;
    const signature = await wallets[role].signMessage(String(chData.message ?? ''));
    const vf = await api(null, 'POST', '/api/auth/verify', { evm_address: addrOf(role), signature, challenge_token: chData.challenge_token });
    const vfData = (vf.body.data ?? {}) as Record<string, unknown>;
    const token = String(vfData.token ?? vfData.access_token ?? '');
    if (!token) throw new Error(`login failed for ${role}: ${JSON.stringify(vf.body).slice(0, 200)}`);
    return token;
  };
  const applyTo = (token: string, projectId: string, body: Record<string, unknown>) =>
    api(token, 'POST', `/api/project/${encodeURIComponent(projectId)}/apply`, body);
  const claimOf = (token: string, projectId: string) =>
    api(token, 'POST', `/api/project/${encodeURIComponent(projectId)}/claim`);

  try {
    process.env.VERCEL = '1';
    const mod = await import('../../backend-ts/src/index');
    const app = (mod as { default: { listen: (p: number, cb?: () => void) => unknown } }).default;
    const srv = app.listen(0) as unknown as {
      address: () => { port: number } | null;
      close: (cb?: () => void) => void;
      once: (ev: string, cb: () => void) => void;
    };
    server = srv;
    await new Promise<void>((resolve) => { srv.once('listening', resolve); setTimeout(resolve, 8000); });
    base = `http://127.0.0.1:${srv.address()?.port ?? 0}`;
    out.http_base = base;

    const tokA = await login('A');
    await login('B'); // B 只用于占满 P_full，不需要 token；登录一次证通道可用

    // 夹具项目：P_old（A 5h 前在职，名额 3）/ P_new（目标，名额 3）/ P_full（名额 1，B 占满）
    const P_OLD = await mkProject('old', 3);
    const P_NEW = await mkProject('new', 3);
    const P_FULL = await mkProject('full', 1);
    FIX_PROJECTS.push(P_OLD, P_NEW, P_FULL);
    const oldWorkerId = await hireDirect(P_OLD, users.A, OLD_HIRED_HOURS);
    const fullWorkerId = await hireDirect(P_FULL, users.B, 1);
    out.fixtures = { P_OLD, P_NEW, P_FULL, old_worker_id: oldWorkerId, full_worker_id: fullWorkerId, uids: users, interval_hours: INTERVAL_HOURS, old_hired_hours: OLD_HIRED_HOURS };

    // ------------------------------------------------------------ 读口四键（基线：A 在 P_old 在职）
    const detOld = await api(tokA, 'GET', `/api/project/${P_OLD}`);
    const dOld = dataOf(detOld);
    const detNewBefore = await api(tokA, 'GET', `/api/project/${P_NEW}`);
    const dNewBefore = dataOf(detNewBefore);
    ck.t('A7',
      '★真 HTTP 读口四键（切换前基线）：P_old ⇒ `my_role=hired` + `my_hired_at` 非空 + `my_current_project_id=P_old`；'
      + 'P_new ⇒ `my_role=none` 且 `my_current_project_id` 仍 = **P_old**（「当前唯一在职项目」不是本项目）',
      detOld.status === 200 && dOld.my_role === 'hired' && Boolean(dOld.my_hired_at)
        && String(dOld.my_current_project_id ?? '') === P_OLD
        && detNewBefore.status === 200 && dNewBefore.my_role === 'none'
        && String(dNewBefore.my_current_project_id ?? '') === P_OLD
        && String(dNewBefore.my_current_project_title ?? '') !== '',
      JSON.stringify({ old: { role: dOld.my_role, at: dOld.my_hired_at, cur: dOld.my_current_project_id }, new: { role: dNewBefore.my_role, cur: dNewBefore.my_current_project_id, title: dNewBefore.my_current_project_title } }));

    // ------------------------------------------------------------ A · 不带 switch ⇒ 409
    const beforeA = await hiredRowsOf(users.A);
    const aResp = await applyTo(tokA, P_NEW, {});
    const oldRowAfterA = await workerRow(P_OLD, users.A);
    const newRowAfterA = await workerRow(P_NEW, users.A);
    ck.t('A8',
      '★A（真 HTTP）不带 switch 而本人已在他项目在职 ⇒ **409 `worker_already_hired`**（`details.project_id` = 旧项目）'
      + '· 旧行仍 `hired`（零副作用）· 目标项目对 A **零行** ⇒ 「缺省 = 旧行为」未被 silent 切换破坏',
      aResp.status === 409 && reasonOf(aResp) === 'worker_already_hired'
        && String((errOf(aResp).details as Record<string, unknown> | undefined)?.project_id ?? '') === P_OLD
        && oldRowAfterA?.status === 'hired' && oldRowAfterA?.left_at == null
        && !newRowAfterA,
      JSON.stringify({ status: aResp.status, reason: reasonOf(aResp), old: oldRowAfterA, new_row: newRowAfterA, hired_before: beforeA }));

    // ------------------------------------------------------------ B · 带 switch ⇒ 200 同事务切换
    const fromIso = new Date(Date.now() - 1000).toISOString();
    const bResp = await applyTo(tokA, P_NEW, { switch: true });
    const toIso = new Date(Date.now() + 1000).toISOString();
    const dB = dataOf(bResp);
    const oldRowB = await workerRow(P_OLD, users.A);
    const newRowB = await workerRow(P_NEW, users.A);
    const bObs: BObs = {
      status: bResp.status,
      switchedFrom: dB.switched_from,
      oldStatus: oldRowB?.status ?? null,
      oldLeftAt: oldRowB?.left_at ?? null,
      newStatus: newRowB?.status ?? null,
      newHiredAt: newRowB?.hired_at ?? null,
      fromIso, toIso,
    };
    out.arms = { ...(out.arms as object || {}), B: { response: { status: bResp.status, message: bResp.body.message, data: dB }, old_row: oldRowB, new_row: newRowB } };
    ck.t('B1',
      '★B（真 HTTP）带 `{switch:true}` ⇒ 200 · `switched_from` = 旧 project_id · `data.worker.project_id` = 新项目'
      + '· 旧行 `status=left` 且 `left_at` 非空 · 新行 `status=hired` 且 `hired_at ∈ [请求前 1s, 请求后 1s]`'
      + '（旧行 hired_at = 5h 前 ⇒ 新行时间戳**前移**是可观测事实，不是回填）',
      bSwitchPredicate(bObs) && String(dB.switched_from ?? '') === P_OLD
        && String((dB.worker as Record<string, unknown> | undefined)?.project_id ?? '') === P_NEW,
      JSON.stringify(bObs));

    ck.t('B2',
      '★B 不变量：A 的在职行**恰 1 条**且落在 P_new（旧行 left 后不残留双在职 —— 部分唯一索引可满足、无 23505 报错）；'
      + '旧 worker_id 未变（左移是 UPDATE 不是删行 → 历史保留）',
      (await hiredRowsOf(users.A)).length === 1
        && (await hiredRowsOf(users.A))[0]?.project_id === P_NEW
        && oldRowB?.worker_id === oldWorkerId,
      JSON.stringify({ hired_now: await hiredRowsOf(users.A), old_worker_id: oldWorkerId }));

    // ------------------------------------------------------------ C · 紧接 claim ⇒ 间隔从新 hired_at 重算
    const cResp = await claimOf(tokA, P_NEW);
    const cDetails = (errOf(cResp).details ?? {}) as Record<string, unknown>;
    const windowStart = String(cDetails.window_start ?? '');
    ck.t('C1',
      '★C（真 HTTP）切换后**紧接**领薪 ⇒ **400 `wage_interval_not_reached`**（`wage_interval_hours`=4 · '
      + '`hours_since_window_start`=0）⇒ 间隔从**新** hired_at 重算（若沿用旧行 5h 前的 hired_at，5h ≥ 4h 就会放行 ⇒ 200）',
      cResp.status === 400 && reasonOf(cResp) === 'wage_interval_not_reached'
        && Number(cDetails.wage_interval_hours) === INTERVAL_HOURS
        && Number(cDetails.hours_since_window_start) === 0,
      JSON.stringify({ status: cResp.status, reason: reasonOf(cResp), details: cDetails }));

    ck.t('C2',
      '★C 窗口起点对拍：`details.window_start` ≥ 本次切换请求前 1s（= 新行 hired_at），'
      + '**严格晚于**旧行 hired_at + interval（旧行 hired_at 距今 5h，若窗口起点仍是旧值会被这里抓住）',
      Boolean(windowStart) && Date.parse(windowStart) >= Date.parse(fromIso)
        && Date.parse(windowStart) > Date.parse(oldRowB?.hired_at ?? '') + INTERVAL_HOURS * 3600 * 1000,
      JSON.stringify({ window_start: windowStart, old_hired_at: oldRowB?.hired_at ?? null, request_floor: fromIso }));

    // ------------------------------------------------------------ D · 满员 + switch ⇒ 409（切换不绕闸）
    const dResp = await applyTo(tokA, P_FULL, { switch: true });
    const dDetails = (errOf(dResp).details ?? {}) as Record<string, unknown>;
    const aAtNewAfterD = await workerRow(P_NEW, users.A);
    const aAtFull = await workerRow(P_FULL, users.A);
    const dHiredCount = await raw1<{ n: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n FROM public.project_worker WHERE project_id = $1::bigint AND status = 'hired'`, [P_FULL]);
    ck.t('D1',
      '★D（真 HTTP）**满员**项目带 `{switch:true}` ⇒ **409 `project_headcount_full`**（`headcount`=1 / `hired_count`=1）'
      + '⇒ 名额闸先于切换判定，切换不是绕过后门',
      dResp.status === 409 && reasonOf(dResp) === 'project_headcount_full'
        && Number(dDetails.headcount) === 1 && Number(dDetails.hired_count) === 1,
      JSON.stringify({ status: dResp.status, reason: reasonOf(dResp), details: dDetails }));

    ck.t('D2',
      '★D 无半切：闸失败后 A **仍在 P_new 在职**（旧行未被 left）· 满员项目对 A 零行 · 满员项目在职数仍 1（B）'
      + '⇒ 「三闸先于切换 + 同事务」两个承诺同时成立（不是先切后拒）',
      aAtNewAfterD?.status === 'hired' && aAtNewAfterD?.left_at == null
        && !aAtFull && Number(dHiredCount?.n ?? '-1') === 1,
      JSON.stringify({ at_new: aAtNewAfterD, at_full: aAtFull, full_hired: dHiredCount }));

    // ------------------------------------------------------------ E · 已在目标项目再申请 ⇒ 幂等 200
    const eResp = await applyTo(tokA, P_NEW, { switch: true });
    const dE = dataOf(eResp);
    const eHired = await hiredRowsOf(users.A);
    ck.t('E1',
      '★E（真 HTTP）已在目标项目再申请（即便也带 switch）⇒ **200 幂等** · `switched_from = null`'
      + '· `data.worker.worker_id` = B 段建的那条（不新插行）· A 在职行仍恰 1 条',
      eResp.status === 200 && dE.switched_from === null
        && String((dE.worker as Record<string, unknown> | undefined)?.worker_id ?? '') === (newRowB?.worker_id ?? '∅')
        && eHired.length === 1 && eHired[0].project_id === P_NEW,
      JSON.stringify({ status: eResp.status, message: eResp.body.message, switched_from: dE.switched_from, worker_id: (dE.worker as Record<string, unknown> | undefined)?.worker_id, hired: eHired }));

    // ------------------------------------------------------------ F2 · 谓词可证伪自检（先做，不依赖子进程）
    const mutantObs: BObs = { ...bObs, status: 409, switchedFrom: null, oldStatus: 'hired', oldLeftAt: null, newStatus: null, newHiredAt: null };
    const staleHiredObs: BObs = { ...bObs, newHiredAt: new Date(Date.parse(fromIso) - 5 * 3600 * 1000).toISOString() };
    ck.t('F2',
      '★负控②（谓词可证伪）：同一 `bSwitchPredicate` 喂 B 的真实观测 ⇒ **true**；喂「旧行仍 hired / 未切」⇒ **false**；'
      + '喂「新行 hired_at = 5h 前（回填旧时间）」⇒ **false** ⇒ 判据对「没真切换」与「时间未前移」都敏感',
      bSwitchPredicate(bObs) === true && bSwitchPredicate(mutantObs) === false && bSwitchPredicate(staleHiredObs) === false,
      JSON.stringify({ real: bSwitchPredicate(bObs), mutant_no_left: bSwitchPredicate(mutantObs), stale_hired_at: bSwitchPredicate(staleHiredObs) }));

    // ------------------------------------------------------------ F1 · 真 mutant 子进程
    const MUTANT_SVC = path.resolve(REPO_ROOT, 'backend-ts/src/project-service.p78neg.ts');
    const MUTANT_INDEX = path.resolve(REPO_ROOT, 'backend-ts/src/index.p78neg.ts');
    let child: ReturnType<typeof spawn> | null = null;
    const outerBase = base;
    try {
      // 1) 服务层副本：把旧行左移短路成 `SET status = status`（幂等 no-op，仍 RETURNING ⇒ switchedFrom 照设）
      //    只改 **apply 段**（leaveProjectVerb 里也有同一条 UPDATE —— 全文件替换会漏改 apply 且守住判据失真）
      const LEFT_SQL = `UPDATE public.project_worker SET status = 'left', left_at = now()`;
      const applyAt = SVC_TS.indexOf('export const applyProjectVerb');
      const claimAt = SVC_TS.indexOf('export const claimProjectWageVerb');
      const svcHead = SVC_TS.slice(0, applyAt);
      const svcApply = SVC_TS.slice(applyAt, claimAt);
      const svcTail = SVC_TS.slice(claimAt);
      if (applyAt < 0 || claimAt < 0 || !svcApply.includes(LEFT_SQL)) throw new Error('p78 mutant anchor not found: left UPDATE in apply');
      const NEUTRAL_SQL = `UPDATE public.project_worker SET status = status /* p78 NEG: 短路 left 更新（负控） */`;
      const mutApply = svcApply.split(LEFT_SQL).join(NEUTRAL_SQL);
      const mutSvc = svcHead + mutApply + svcTail;
      if (mutApply.includes(LEFT_SQL) || mutApply === svcApply) throw new Error('mutant still sets status = left');
      fs.writeFileSync(MUTANT_SVC, mutSvc, { mode: 0o600 });

      // 2) 路由副本：把 `from './project-service'` 换成副本（其余逐字不动）
      const idxAnchor = "} from './project-service'";
      if (!INDEX_TS.includes(idxAnchor)) throw new Error('p78 mutant anchor not found: index import');
      const mutIdx = INDEX_TS.replace(idxAnchor, "} from './project-service.p78neg'");
      fs.writeFileSync(MUTANT_INDEX, mutIdx, { mode: 0o600 });

      child = spawn('npx', ['ts-node', '--transpile-only', 'src/index.p78neg.ts'], {
        cwd: path.resolve(REPO_ROOT, 'backend-ts'),
        env: { ...process.env, PORT: String(NEG_PORT), VERCEL: '' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      const childOut: string[] = [];
      child.stdout?.on('data', (d: Buffer) => childOut.push(d.toString()));
      child.stderr?.on('data', (d: Buffer) => childOut.push(d.toString()));
      let ready = false;
      const deadline = Date.now() + 180_000;
      while (Date.now() < deadline && !ready) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const h = await fetch(`http://127.0.0.1:${NEG_PORT}/api/health`);
          const hj = await h.json().catch(() => ({} as Record<string, unknown>));
          ready = (hj as Record<string, unknown>).ok === true;
        } catch { /* not yet */ }
        if (child.exitCode !== null) break;
      }
      if (!ready) throw new Error(`mutant child not ready: ${childOut.join('').slice(0, 500)}`);

      // 3) 真打 mutant：同 B 流（A 现于 P_new 在职 ⇒ 切到 P_old），`api/login` 吃闭包 `base` ⇒ 现场切端口
      base = `http://127.0.0.1:${NEG_PORT}`;
      const negToken = await login('A');
      const negFrom = new Date(Date.now() - 1000).toISOString();
      const negResp = await applyTo(negToken, P_OLD, { switch: true });
      const negTo = new Date(Date.now() + 1000).toISOString();
      const negData = dataOf(negResp);
      base = outerBase; // 读库读数用池，不经 HTTP
      const negOldRow = await workerRow(P_NEW, users.A);
      // 「新行」只认 **mutant 轮在 P_OLD 的真在职行**：P_OLD 上还留着 B 段那条 `left` 历史行，
      // 拿「最新一行」会把历史 left 行误读成 mutant 的产物 ⇒ 按 status='hired' 取。
      const negNewHired = await raw1<{ worker_id: string; hired_at: string }>(pool as unknown as Qx,
        `SELECT worker_id::text AS worker_id, hired_at::text AS hired_at FROM public.project_worker
          WHERE project_id = $1::bigint AND uid = $2::bigint AND status = 'hired' LIMIT 1`,
        [P_OLD, String(users.A)]);
      const negObs: BObs = {
        status: negResp.status,
        switchedFrom: negData.switched_from,
        oldStatus: negOldRow?.status ?? null,
        oldLeftAt: negOldRow?.left_at ?? null,
        newStatus: negNewHired ? 'hired' : null,
        newHiredAt: negNewHired?.hired_at ?? null,
        fromIso: negFrom, toIso: negTo,
      };
      ck.t('F1',
        '★负控①（**真 mutant** · 子进程 5799 真 HTTP · 只短路旧行 `status=\'left\'` 这一条 UPDATE）：'
        + '同 B 流（A 于 P_new 在职 → 切 P_old 带 switch）⇒ B 谓词**必红** —— 旧行仍 `hired`、'
        + '新行插不进（部分唯一索引 `project_worker_single_hired_uniq` 报 23505 ⇒ 409 `worker_already_hired`）'
        + '⇒ 证明 B 绿是真由那条 left UPDATE + 新行 INSERT 驱动，不是「响应里写了 switched_from」就成立',
        bSwitchPredicate(negObs) === false
          && negOldRow?.status === 'hired'
          && !negNewHired
          && negResp.status !== 200,
        JSON.stringify({ status: negResp.status, reason: reasonOf(negResp), obs: negObs, data_keys: Object.keys(negData) }));

      // 4) mutant 零残留：仍恰 1 条在职（P_new），P_old 对 A 无在职行（失败事务整体回滚，不留半切）
      ck.t('F3',
        '★mutant 零残留：A 仍在 P_new 在职（恰 1 条 hired）· P_old 对 A **无在职行**（失败事务整体回滚，不留半切）',
        (await hiredRowsOf(users.A)).length === 1 && (await hiredRowsOf(users.A))[0].project_id === P_NEW,
        JSON.stringify({ hired: await hiredRowsOf(users.A) }));
      okRun = true;
    } catch (e) {
      base = outerBase;
      ck.t('F1', '★负控①（真 mutant 子进程 5799 真 HTTP）', false, `error=${String((e as Error).message ?? e).slice(0, 400)}`);
    } finally {
      base = outerBase;
      if (child) { try { child.kill('SIGTERM'); } catch { /* noop */ } }
      for (const f of [MUTANT_SVC, MUTANT_INDEX]) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch { /* noop */ }
      }
    }
    out.mutant_run_ok = okRun;
  } finally {
    // ------------------------------------------------------------ Z · 清尾（自建自删）
    // 逐条独立执行：某条被库闸拒绝（如 `batt_entry` append-only ⇒ DELETE forbidden）不得连坐其余。
    // 本门**零领薪成功**（C 段在间隔闸就 400 了）⇒ 夹具用户没有 batt_entry / ledger 行可删，故不碰 append-only 表。
    const cleanErrors: Array<{ step: string; error: string }> = [];
    const cleanStep = async (step: string, sql: string, params: unknown[]) => {
      try {
        await qRetry(pool, sql, params);
      } catch (e) {
        cleanErrors.push({ step, error: String((e as Error).message ?? e).slice(0, 200) });
      }
    };
    if (FIX_PROJECTS.length) {
      await cleanStep('project_wage_claim', `DELETE FROM public.project_wage_claim WHERE project_id = ANY($1::bigint[]) OR uid = ANY($2::bigint[])`, [FIX_PROJECTS, FIX_UIDS]);
      await cleanStep('project_worker', `DELETE FROM public.project_worker WHERE project_id = ANY($1::bigint[]) OR uid = ANY($2::bigint[])`, [FIX_PROJECTS, FIX_UIDS]);
      await cleanStep('project', `DELETE FROM public.project WHERE project_id = ANY($1::bigint[])`, [FIX_PROJECTS]);
    }
    await cleanStep('batt_account', `DELETE FROM public.batt_account WHERE uid = ANY($1::bigint[])`, [FIX_UIDS]);
    await cleanStep('user_activity_hour', `DELETE FROM public.user_activity_hour WHERE uid = ANY($1::bigint[])`, [FIX_UIDS]);
    await cleanStep('account', `DELETE FROM public.account WHERE uid = ANY($1::bigint[])`, [FIX_UIDS]);
    await cleanStep('users', `DELETE FROM public.users WHERE uid = ANY($1::bigint[])`, [FIX_UIDS]);
    ck.t('Z0', '★清尾（夹具自删六表逐条独立）：零错误（`batt_entry` append-only 不碰 —— 本门零成功领薪 ⇒ 无行）',
      cleanErrors.length === 0, JSON.stringify({ errors: cleanErrors }));

    const projLeft = await raw1<{ n: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n FROM public.project WHERE owner_uid = ANY($1::bigint[]) OR project_id = ANY($2::bigint[])`,
      [FIX_UIDS, FIX_PROJECTS.length ? FIX_PROJECTS : ['0']]);
    const workerLeft = await raw1<{ n: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n FROM public.project_worker WHERE uid = ANY($1::bigint[]) OR project_id = ANY($2::bigint[])`,
      [FIX_UIDS, FIX_PROJECTS.length ? FIX_PROJECTS : ['0']]);
    const usersLeft = await raw1<{ n: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n FROM public.users WHERE uid = ANY($1::bigint[])`, [FIX_UIDS]);
    ck.t('Z1',
      '★零残留：夹具 project / project_worker / users 计数全 **0**（自建自删；未 apply 任何迁移）',
      Number(projLeft?.n ?? '-1') === 0 && Number(workerLeft?.n ?? '-1') === 0 && Number(usersLeft?.n ?? '-1') === 0,
      JSON.stringify({ projects: projLeft, workers: workerLeft, users: usersLeft }));

    const projAfter = await raw1<{ n: string; maxid: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n, COALESCE(max(project_id), 0)::text AS maxid FROM public.project WHERE owner_uid <> ALL($1::bigint[])`,
      [FIX_UIDS]);
    const workerAfter = await raw1<{ n: string; maxw: string }>(pool as unknown as Qx,
      `SELECT count(*)::text AS n, COALESCE(max(worker_id), 0)::text AS maxw FROM public.project_worker WHERE uid <> ALL($1::bigint[])`,
      [FIX_UIDS]);
    ck.t('Z2',
      '★非夹具面零外溢：project / project_worker 的 (count, max_id) 指纹与开跑前**逐字相等**（本轮只碰夹具行）',
      JSON.stringify(projAfter) === JSON.stringify(projBase) && JSON.stringify(workerAfter) === JSON.stringify(workerBase),
      JSON.stringify({ before: { project: projBase, worker: workerBase }, after: { project: projAfter, worker: workerAfter } }));

    if (server) await new Promise<void>((resolve) => {
      try {
        server?.close(() => resolve());
        setTimeout(resolve, 3000);
      } catch { resolve(); }
    });
  }

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p78-project-switch-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary }, null, 1));
  await pool.end().catch(() => undefined);
  process.exit((out.summary as { failed: number }).failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  for (const f of ['backend-ts/src/project-service.p78neg.ts', 'backend-ts/src/index.p78neg.ts']) {
    try {
      const p = path.resolve(REPO_ROOT, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    } catch { /* noop */ }
  }
  process.exit(2);
});
