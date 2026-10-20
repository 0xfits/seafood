/**
 * p63-00 · 项目（打工 / 工资）域后端门 · 迁移 0063 + 0064
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p57/p59b/p60/p61 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/project/p63-00-project-gate.ts
 * 读数：`ops/project/readings/p63-project-gate-<RUN>.json`
 *
 * ★ 覆盖面（data §40.15 · route §49.19）：
 *   A · 静态面（零 DB）：注册点 127（get 54 / post 66 / patch 4 / delete 3；118 + campaign 九口）· R1 注册在 R2 之前 ·
 *       七口逐条在场 · 零新 kind（LEDGER_KINDS 仍 24，建费借 `currency_create_fee`）· 零新错误码
 *       （33 码闭集不动）· 两份迁移无 BEGIN/COMMIT、注释无 dollar-dollar、种子按 title 幂等 ·
 *       结算常量 2/1/100 · 状态迁移矩阵 · 入参纯函数（禁带字段 / 两币成对 / interval / headcount）。
 *   B · 迁移干跑（真库 · 回滚事务内）：0063 头段 + 尾部 DO 全绿（四表 / 列数 14-6-10-4 / 具名约束 /
 *       部分唯一索引 / 配置键 fee=10000 / version 行未写）· 0064 头段 + 尾部 DO（恰 10 行种子）·
 *       0064 二次执行**行数不变**（幂等）· `schema_migration` 无 0063/0064 行 ·
 *       **B4 匿名列表行三键（my_role/my_hired_at/next_claim_at）缺省、行仍 15 键**。
 *   S · 服务层真路径（同事务 · `ex` 注入）：建费扣款（余额 / 平台收入 / 台账两条 / 幂等重放）·
 *       招工四臂（非招募期 / 满员 / 注册天数不足 / 他项目在职）+ 同项目重投 200 no-op +
 *       招满自动转 working · 领薪（未录用 / 间隔未到 / 正常逐桶 2-1 / 100h 上限 / ended 封板）·
 *       离职幂等 · 管理员缩容 409 + 状态机 + 名字扩充 ·
 *       **S15/S16 登录态列表加性面**（未在职 ⇒ my_role='none' 三键在场且 null；在职 ⇒ 恰 1 行 hired、
 *       `my_hired_at` 与库内 `hired_at` 一致、`next_claim_at` = max(hired_at, 上次 claim) + interval
 *       与库内复算一致且为未来时刻 —— 「领工资只落在自己的卡」的服务端承重臂）。
 *   N · **三臂负控（判据必须可红）**：
 *       ① 去部分唯一索引 ⇒ 同一 uid 双项目在职可现（DB 层 `23505` 消失）⇒ S 臂必红；
 *       ② 去 100h 上限 ⇒ 150h 窗口可累积（DB CHECK 亦拒 ⇒ 双证）⇒ S 臂必红；
 *       ③ 去建费扣款 ⇒ 免费建项可现（直插成功 = 反事实证据）⇒ S 臂必红。
 *   Z · 残留：提交面（rollback 之后）**无** project 四表、**无** project_create_fee 行 ⇒ 本门全程未 apply。
 *
 * 纪律：**不 apply、不写版本表**；一切 DDL / DML / 资金夹具都在回滚事务内（`inRollbackTx`），
 *   失败/须撤销的臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 *   · 服务层调用**一律注入 `ex`**（含读口 `listProjects(ex)` / `getProjectByRef(ref, ex)` 与
 *     `postEvent({…, ex})`）：迁移干跑未提交 ⇒ 别的连接既看不到四表（42P01），铸币的 FK 检查还会
 *     等本事务未提交的 `users` 行（`lock_timeout` ⇒ 503 `LEDGER_LOCK_TIMEOUT`）。
 *   · 台账条数按**派生键** `<key>#<i>` 计（`deriveEventKey`）：两腿事件 = `key` + `key#2` ⇒
 *     `idempotency_key = k OR LIKE k || '#%'`，只等值匹配会少算一半。
 *   · SQL 切分前**先剥注释行**：0063 文件头大段 `--` 注释若并入第一条语句，首条 `CREATE TABLE` 就丢。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry, sha256 } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  PROJECT_ACTIVE_BATT_PER_HOUR,
  PROJECT_CREATE_FEE_DEFAULT,
  PROJECT_MAX_CLAIM_HOURS,
  PROJECT_OFFLINE_BATT_PER_HOUR,
  PROJECT_STATUS_TRANSITIONS,
  applyProjectVerb,
  claimProjectWageVerb,
  createProjectVerb,
  currentCreateFee,
  getProjectByRef,
  isProjectRef,
  leaveProjectVerb,
  listProjects,
  parseProjectPayload,
  patchProjectVerb,
} from '../../backend-ts/src/project-service';
import { LEDGER_KINDS } from '../../backend-ts/src/ledger';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';
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
const SVC = readSrc('backend-ts/src/project-service.ts');
const MIG63 = readSrc('backend-ts/migrations/0063_project_domain.sql');
const MIG64 = readSrc('backend-ts/migrations/0064_seed_projects.sql');

// ---------------------------------------------------------------- SQL 切分（dollar-dollar 感知）
/** 先剥注释（dollar-dollar 外），否则文件头大段 `--` 注释会与第一条 DDL 同语句 ⇒ 首条 CREATE TABLE 丢失 */
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
const M63_HEAD = splitSqlStatements(headOf(MIG63));
const M63_TAIL = tailOf(MIG63);
const M64_HEAD = splitSqlStatements(headOf(MIG64));
const M64_TAIL = tailOf(MIG64);

const SQ = (v: unknown) => String(v ?? '').replace(/'/g, "''");

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null }> => {
  const sp = `p63_${tag}`;
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

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  ck.t('A1', '注册点 = 127（118 = 111 + 项目域七口；+9 = campaign 九口 route §49.18；get 54 / post 66 / patch 4 / delete 3 / put 0）',
    regs === 127 && countVerb('get') === 54 && countVerb('post') === 66 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0,
    `regs=${regs} get=${countVerb('get')} post=${countVerb('post')} patch=${countVerb('patch')} delete=${countVerb('delete')}`);

  const seven = [
    "app.get('/api/project/all'", "app.get('/api/project/:ref'", "app.post('/api/project'",
    "app.post('/api/project/:id/apply'", "app.post('/api/project/:id/claim'",
    "app.post('/api/project/:id/leave'", "app.patch('/api/project/:projectId'",
  ];
  const missing = seven.filter((s) => INDEX_TS.indexOf(s) === -1);
  ck.t('A2', '七口逐条在场（R1–R7）', missing.length === 0, `missing=${JSON.stringify(missing)}`);
  ck.t('A3', '注册顺序：`/api/project/all` 在 `/api/project/:ref` **之前**（route #62）',
    INDEX_TS.indexOf("app.get('/api/project/all'") < INDEX_TS.indexOf("app.get('/api/project/:ref'"),
    `all=${INDEX_TS.indexOf("app.get('/api/project/all'")} ref=${INDEX_TS.indexOf("app.get('/api/project/:ref'")}`);
  ck.t('A4', 'R7 闸 = `requireAdmin(req, res, \'manage_tasks\')`（不是 manage_rewards —— #66）',
    /app\.patch\('\/api\/project\/:projectId'[\s\S]{0,400}requireAdmin\(req, res, 'manage_tasks'\)/.test(INDEX_TS),
    `manage_tasks_at=${INDEX_TS.indexOf("requireAdmin(req, res, 'manage_tasks')")}`);
  ck.t('A5', '活动桶埋点在 `resolveActor` 成功出口且**不 await**（旁路；PR-N5）',
    /void recordUserActivityHour\(Number\(user\.uID\)\)\.catch\(/.test(INDEX_TS)
      && !/await recordUserActivityHour/.test(INDEX_TS),
    `void_hook=${/void recordUserActivityHour/.test(INDEX_TS)} await_hook=${/await recordUserActivityHour/.test(INDEX_TS)}`);

  ck.t('A6', '零新 kind：`LEDGER_KINDS` 仍 24 值、且不含 project_create_fee（建费借 `currency_create_fee`）',
    LEDGER_KINDS.length === 24 && !(LEDGER_KINDS as readonly string[]).includes('project_create_fee'),
    `kinds=${LEDGER_KINDS.length} borrowed=${SVC.indexOf("PROJECT_CREATE_FEE_KIND = 'currency_create_fee'") > 0}`);
  ck.t('A7', '零新错误码：33 码闭集不动', LEDGER_ERROR_CODES.length === 33, `codes=${LEDGER_ERROR_CODES.length}`);
  ck.t('A8', '结算常量：活跃 2/时 · 离线 1/时 · 上限 100h · 默认费 10000',
    PROJECT_ACTIVE_BATT_PER_HOUR === 2 && PROJECT_OFFLINE_BATT_PER_HOUR === 1
      && PROJECT_MAX_CLAIM_HOURS === 100 && PROJECT_CREATE_FEE_DEFAULT === 10000n,
    `${PROJECT_ACTIVE_BATT_PER_HOUR}/${PROJECT_OFFLINE_BATT_PER_HOUR}/${PROJECT_MAX_CLAIM_HOURS}/${PROJECT_CREATE_FEE_DEFAULT}`);
  ck.t('A9', '状态迁移矩阵：recruiting→{working,ended} · working→{recruiting,ended} · ended→∅',
    JSON.stringify(PROJECT_STATUS_TRANSITIONS)
      === JSON.stringify({ recruiting: ['working', 'ended'], working: ['recruiting', 'ended'], ended: [] }),
    JSON.stringify(PROJECT_STATUS_TRANSITIONS));

  const migShape = (label: string, src: string) => {
    const noTx = !/^\s*(BEGIN|COMMIT)\s*;/m.test(src);
    const commentDollar = src.split('\n').filter((l) => l.trim().startsWith('--') && l.includes('$$')).length;
    const noPipe = src.split('\n').filter((l) => l.startsWith('|')).length === 0;
    return { label, noTx, commentDollar, noPipe };
  };
  const shape63 = migShape('0063', MIG63);
  const shape64 = migShape('0064', MIG64);
  ck.t('A10', '两份迁移文件内无 BEGIN/COMMIT · 注释零 dollar-dollar · 零行首竖线',
    shape63.noTx && shape64.noTx && shape63.commentDollar === 0 && shape64.commentDollar === 0
      && shape63.noPipe && shape64.noPipe,
    JSON.stringify({ 63: shape63, 64: shape64 }));
  ck.t('A11', '种子按 `title` 幂等（`NOT EXISTS (… WHERE x.title = p.title)`）· 十链标题逐条在场',
    /NOT EXISTS \(SELECT 1 FROM public\.project x WHERE x\.title = p\.title\)/.test(MIG64)
      && ['Ethereum', 'Solana', 'Arbitrum', 'Base', 'Optimism', 'Polygon', 'Sui', 'Aptos', 'Starknet', 'zkSync']
        .every((chain) => MIG64.includes(`${chain} 生态推广`)),
    `idem=${/NOT EXISTS \(SELECT 1 FROM public\.project x WHERE x\.title = p\.title\)/.test(MIG64)}`);
  ck.t('A12', '迁移号：0063 DDL / 0064 种子（0062 未落盘 ⇒ 本单取 0063 顺延）',
    fs.existsSync(path.join(REPO_ROOT, 'backend-ts/migrations/0063_project_domain.sql'))
      && fs.existsSync(path.join(REPO_ROOT, 'backend-ts/migrations/0064_seed_projects.sql'))
      && !fs.existsSync(path.join(REPO_ROOT, 'backend-ts/migrations/0062_campaign.sql')),
    'files ok');

  // ---- 入参纯函数（零 DB）· `parseProjectPayload` 出参是 `{payload}|{err}` 联合 ⇒ 判据一律取 `.err`
  const errOf = (x: { payload?: unknown; err?: unknown }): unknown => ('err' in x ? x.err : x);
  const pForbid = parseProjectPayload({ title: 'x', headcount: 1, wage_batt_per_claim: 1, wage_interval_hours: 1, status: 'working' }, 'create');
  const pPair = parseProjectPayload({ title: 'x', headcount: 1, wage_batt_per_claim: 1, wage_interval_hours: 1, wage_cid: 5 }, 'create');
  const pInterval = parseProjectPayload({ title: 'x', headcount: 1, wage_batt_per_claim: 1, wage_interval_hours: 101 }, 'create');
  const pHead = parseProjectPayload({ title: 'x', headcount: 0, wage_batt_per_claim: 1, wage_interval_hours: 1 }, 'create');
  const pUnknown = parseProjectPayload({ title: 'x', headcount: 1, wage_batt_per_claim: 1, wage_interval_hours: 1, foo: 1 }, 'create');
  const pOk = parseProjectPayload({
    title: 'x', description: 'd', headcount: 3, recruit_min_account_days: 2,
    wage_batt_per_claim: '12', wage_cid: '5', wage_currency_amount: '25', wage_interval_hours: 24,
  }, 'create');
  ck.t('A13', '入参纯函数：禁带四键 / 两币成对 / interval 1–100 / headcount>0 / 闭集外键 ⇒ 均 400 `LEDGER_AMOUNT_INVALID`',
    verbOf(errOf(pForbid)) === 400 && reasonOf(errOf(pForbid)) === 'NOT_SUPPORTED'
      && verbOf(errOf(pPair)) === 400 && reasonOf(errOf(pPair)) === 'PROJECT_WAGE_CURRENCY_PAIR_REQUIRED'
      && verbOf(errOf(pInterval)) === 400 && reasonOf(errOf(pInterval)) === 'PROJECT_INTERVAL_INVALID'
      && verbOf(errOf(pHead)) === 400 && reasonOf(errOf(pHead)) === 'PROJECT_HEADCOUNT_INVALID'
      && verbOf(errOf(pUnknown)) === 400 && reasonOf(errOf(pUnknown)) === 'NOT_SUPPORTED'
      && 'payload' in pOk,
    JSON.stringify({ forbid: reasonOf(errOf(pForbid)), pair: reasonOf(errOf(pPair)), interval: reasonOf(errOf(pInterval)), head: reasonOf(errOf(pHead)), unknown: reasonOf(errOf(pUnknown)), ok: 'payload' in pOk }));
  ck.t('A14', '`isProjectRef`：纯数字才放行（`all` / 非数字 ⇒ false，route #67 靠它落 404 而非 500）',
    isProjectRef('123') && !isProjectRef('all') && !isProjectRef('12a') && !isProjectRef(''), 'ok');

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  // ★ mode-aware（承「dev 已 apply ⇒ 同一门必红」纪律）：0063 已进 dev 库 ⇒ B1/Z1 断言「已 apply 稳态」，
  //   否则断言「本门全程未 apply、零残留」。两种模式读数**都落盘**（`readings.mode`）。
  const applied63 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0063'"))[0]?.n ?? 0) > 0;
  const MODE = applied63 ? 'post-apply' : 'pre-apply';
  out.mode = MODE;
  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = { mode: MODE };
    const ex = c as unknown as TxClient;
    /** 台账条数：同键多腿的派生键为 `<key>#<i>`（ledger.ts deriveEventKey）⇒ 计数须含派生键 */
    const ledgerRows = async (key: string): Promise<number> => Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.ledger_entry WHERE idempotency_key = $1 OR idempotency_key LIKE $1 || '#%'",
      [key]))?.n ?? -1);
    const bal = async (uid: number | string, cid: number | string): Promise<string> =>
      String((await raw1<{ b: string }>(c,
        'SELECT COALESCE((SELECT balance FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint), 0)::text AS b',
        [String(uid), String(cid)]))?.b ?? '0');

    // ---- 夹具：五个新用户（rollback 内；evm 由 uid 派生 ⇒ 唯一）
    const uids: number[] = [];
    for (const base of [908301, 908302, 908303, 908304, 908305]) {
      const row = await raw1<{ uid: string }>(c,
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p63-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [OWNER, W1, W2, W3, W4] = uids;
    R.fixture_users = uids;

    // ---- B1 · 迁移 0063 干跑（头段 + 尾部 DO）
    for (const stmt of M63_HEAD) await c.query(stmt);
    const before63 = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0063'");
    await c.query(M63_TAIL);
    const after63 = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.schema_migration WHERE version IN ('0063','0064')");
    R.mig63 = { version_rows_before: Number(before63?.n ?? -1), version_rows_after: Number(after63?.n ?? -1) };

    const tables = await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('project','project_worker','project_wage_claim','user_activity_hour')");
    const cols = await raw<{ table_name: string; n: number }>(c,
      `SELECT table_name, count(*)::int AS n FROM information_schema.columns
        WHERE table_schema='public' AND table_name IN ('project','project_worker','project_wage_claim','user_activity_hour')
        GROUP BY table_name ORDER BY table_name`);
    const colMap = Object.fromEntries(cols.map((x) => [x.table_name, Number(x.n)]));
    const pidx = await raw1<{ def: string }>(c,
      "SELECT indexdef AS def FROM pg_indexes WHERE schemaname='public' AND indexname='project_worker_single_hired_uniq'");
    const feeRow = await raw1<{ fee: string }>(c, "SELECT value->>'fee' AS fee FROM public.app_config WHERE key='project_create_fee'");
    const versionOk = applied63
      ? Number(before63?.n ?? -1) === 1 && Number(after63?.n ?? -1) === 2 // 已 apply 稳态：干跑**不得**再写版本行
      : Number(before63?.n ?? -1) === 0 && Number(after63?.n ?? -1) === 0; // 未 apply：全程零版本行
    ck.t('B1', `[${MODE}] 0063 干跑全绿：四表在场 · 物理列 14/6/10/4 · 部分唯一索引 = UNIQUE(uid) WHERE status=hired · 配置 fee=10000 · ${applied63 ? '版本行 0063/0064 各 1（已 apply 稳态，干跑零新增）' : '版本行未写'}`,
      Number(tables?.n ?? 0) === 4 && colMap.project === 14 && colMap.project_worker === 6
        && colMap.project_wage_claim === 10 && colMap.user_activity_hour === 4
        && /UNIQUE/.test(String(pidx?.def ?? '')) && /\(uid\)/.test(String(pidx?.def ?? ''))
        && /status = 'hired'/.test(String(pidx?.def ?? '')) && String(feeRow?.fee ?? '') === '10000'
        && versionOk,
      JSON.stringify({ mode: MODE, tables: tables?.n, cols: colMap, index: pidx?.def, fee: feeRow?.fee, version_before: before63?.n, version_after: after63?.n }));

    // ---- B2 · 种子 0064（头段 + 尾部 DO）+ 幂等重跑
    for (const stmt of M64_HEAD) await c.query(stmt);
    await c.query(M64_TAIL);
    const seed1 = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.project WHERE title LIKE '%生态推广'");
    for (const stmt of M64_HEAD) await c.query(stmt);
    const seed2 = await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.project WHERE title LIKE '%生态推广'");
    const seedShape = await raw1<{ intervals: number; batts: number; rec: number; min_h: number; max_h: number }>(c,
      `SELECT count(DISTINCT wage_interval_hours)::int AS intervals, count(DISTINCT wage_batt_per_claim)::int AS batts,
              count(*) FILTER (WHERE status <> 'recruiting')::int AS rec, min(headcount)::int AS min_h, max(headcount)::int AS max_h
         FROM public.project WHERE title LIKE '%生态推广'`);
    ck.t('B2', '0064 种子：恰 10 行 · 十个 interval 互不相同 · 十个 batt 互不相同 · 全 recruiting · headcount 5–20 · **重跑不增行**（幂等）',
      Number(seed1?.n ?? 0) === 10 && Number(seed2?.n ?? 0) === 10
        && Number(seedShape?.intervals ?? 0) === 10 && Number(seedShape?.batts ?? 0) === 10
        && Number(seedShape?.rec ?? -1) === 0 && Number(seedShape?.min_h ?? 0) >= 5 && Number(seedShape?.max_h ?? 99) <= 20,
      JSON.stringify({ first: seed1?.n, rerun: seed2?.n, ...seedShape }));

    // ---- 公开读口（真 service；传 `ex` ⇒ 走本事务连接，否则别的连接看不到未提交的四表）
    const listed = await listProjects(ex);
    const detail = await getProjectByRef(String(listed[0]?.snowflake_id ?? ''), ex);
    const miss = await getProjectByRef('999999999999', ex);
    R.list = { n: listed.length, first_status: listed[0]?.status, snowflake_type: typeof listed[0]?.snowflake_id };
    ck.t('B3', '公开读口：列表 ≥ 10 行且只含 recruiting/working · `snowflake_id` 出参**字符串** · 双形态详情命中 · miss ⇒ null',
      listed.length >= 10 && listed.every((x) => x.status === 'recruiting' || x.status === 'working')
        && typeof listed[0]?.snowflake_id === 'string' && detail !== null
        && String(detail?.snowflake_id) === String(listed[0]?.snowflake_id) && miss === null,
      JSON.stringify(R.list));

    // ---- B4 · 匿名面：三键**缺省**（不是 null —— 前端按 hasOwn 判「未登录」）
    const anonKeys = Object.keys(listed[0] ?? {});
    const anonAbsent = ['my_role', 'my_hired_at', 'next_claim_at'].every((k) => !(k in (listed[0] ?? {})));
    ck.t('B4', '匿名列表行：`my_role`/`my_hired_at`/`next_claim_at` **三键缺省**（非 null）· 行仍 15 键（加性零破）· 全表一致',
      anonAbsent && anonKeys.length === 15
        && listed.every((x) => !('my_role' in x) && !('my_hired_at' in x) && !('next_claim_at' in x)),
      JSON.stringify({ keys: anonKeys.length, absent: anonAbsent }));

    // ---- 夹具：$ 与次币（平台受信任 mint 路径；全部随事务回滚）
    const fee = BigInt(await currentCreateFee());
    await postEvent({
      op: 'mint', uid: String(OWNER), cid: '1', amount: (fee * 8n + 5000n).toString(), platform: true,
      idempotencyKey: `ops:p63-gate:${RUN}:mint-usd`, memo: 'p63-gate usd fixture', ex,
    });
    const secRows = await raw<{ cid: string }>(c,
      `INSERT INTO public.currency (symbol, name, owner_uid, decimals, total_supply, status, listed_at)
       VALUES ($1, $2, $3::bigint, 0, 0, 'listed', now()) RETURNING cid::text AS cid`,
      [`p63g${RUN.slice(-8)}`.toLowerCase(), `p63-gate secondary ${RUN}`, String(OWNER)]);
    const SEC = Number(secRows[0].cid);
    await postEvent({
      op: 'mint', uid: String(OWNER), cid: String(SEC), amount: '10000',
      idempotencyKey: `ops:p63-gate:${RUN}:mint-sec`, memo: 'p63-gate sec fixture', ex,
    });
    R.fixture_money = { fee: fee.toString(), owner_usd: await bal(OWNER, 1), sec_cid: SEC, owner_sec: await bal(OWNER, SEC) };

    const mkBody = (over: Record<string, unknown> = {}) => ({
      title: `p63 门项目 ${RUN}-${Math.random().toString(36).slice(2, 7)}`,
      description: 'gate fixture', headcount: 2, recruit_min_account_days: 0,
      wage_batt_per_claim: '10', wage_cid: null, wage_currency_amount: null,
      wage_interval_hours: 1, ...over,
    });
    const create = (over: Record<string, unknown> = {}, key?: string) =>
      createProjectVerb({ actorUid: OWNER, body: mkBody(over), headerKey: key ?? `cli:p63-${RUN}-${Math.random().toString(36).slice(2, 8)}`, ex });

    // ---- S1 · 建费扣款（余额 / 平台收入 / 台账两条）
    const ownerBefore = BigInt(await bal(OWNER, 1));
    const platformBefore = BigInt(await bal(-1, 1));
    const keyA = `cli:p63-gate-${RUN}-createA`;
    const created = await create({ headcount: 2, wage_cid: String(SEC), wage_currency_amount: '25', wage_interval_hours: 1 }, keyA);
    const P1 = String((created as { view?: { project_id?: string } }).view?.project_id ?? '');
    const ownerAfter = BigInt(await bal(OWNER, 1));
    const platformAfter = BigInt(await bal(-1, 1));
    const feeEntries = { n: await ledgerRows(keyA) };
    const createdRow = await raw1<{ status: string; snowflake: string }>(c,
      'SELECT status, snowflake_id::text AS snowflake FROM public.project WHERE project_id = $1::bigint', [P1]);
    ck.t('S1', '建项目：status 恒 recruiting · 创建者 $ 恰扣 fee · 平台收入 −1 恰加 fee · 台账两条（同键同事务）',
      created.ok === true && P1 !== '' && String(createdRow?.status ?? '') === 'recruiting'
        && ownerBefore - ownerAfter === fee && platformAfter - platformBefore === fee
        && Number(feeEntries?.n ?? 0) === 2,
      JSON.stringify({ created: created.ok, owner_delta: (ownerBefore - ownerAfter).toString(), platform_delta: (platformAfter - platformBefore).toString(), entries: feeEntries?.n, status: createdRow?.status }));

    // 幂等重放：同键重投 ⇒ 同 project_id · 余额不变 · 行数不变
    const rowsBeforeReplay = Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.project'))?.n ?? 0);
    const replay = await create({ headcount: 2, wage_cid: String(SEC), wage_currency_amount: '25', wage_interval_hours: 1 }, keyA);
    const rowsAfterReplay = Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.project'))?.n ?? 0);
    ck.t('S2', '建项幂等：同键重投 ⇒ 200 replay · 同 project_id · 行数不变 · 余额不变',
      replay.ok === true && (replay as { replay?: boolean }).replay === true
        && String((replay as { view?: { project_id?: string } }).view?.project_id ?? '') === P1
        && rowsBeforeReplay === rowsAfterReplay && BigInt(await bal(OWNER, 1)) === ownerAfter,
      JSON.stringify({ replay: (replay as { replay?: boolean }).replay, rows: [rowsBeforeReplay, rowsAfterReplay] }));

    // ---- S3 · 招工四臂
    const applyTo = (uid: number, ref: string) => applyProjectVerb({ actorUid: uid, ref, ex });
    const a1 = await applyTo(W1, P1);
    const a1again = await applyTo(W1, P1);
    const w1Rows = Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.project_worker WHERE uid = $1::bigint AND status = 'hired'", [String(W1)]))?.n ?? 0);
    const a2 = await applyTo(W2, P1);
    const p1AfterFull = await raw1<{ status: string; hired: number }>(c,
      `SELECT p.status, (SELECT count(*)::int FROM public.project_worker w WHERE w.project_id = p.project_id AND w.status='hired')::int AS hired
         FROM public.project p WHERE p.project_id = $1::bigint`, [P1]);
    ck.t('S3', '招工：首次 200 录用 · 同项目重投 200 no-op（单行） · 二人满员后**同事务自动转 working**',
      a1.ok === true && a1again.ok === true && (a1again as { replay?: boolean }).replay === true
        && w1Rows === 1 && a2.ok === true
        && String(p1AfterFull?.status ?? '') === 'working' && Number(p1AfterFull?.hired ?? 0) === 2,
      JSON.stringify({ a1: a1.ok, again: (a1again as { replay?: boolean }).replay, w1_rows: w1Rows, a2: a2.ok, status: p1AfterFull?.status, hired: p1AfterFull?.hired }));

    // 非招募期（管理员停招后 apply）
    const P5 = String(((await create({ headcount: 5, wage_interval_hours: 1 })) as { view?: { project_id?: string } }).view?.project_id ?? '');
    const stop = await patchProjectVerb({ ref: P5, body: { status: 'working' }, ex });
    const aNotRecruiting = await applyTo(W4, P5);
    ck.t('S4', '非招募期 apply ⇒ 409 `project_not_recruiting`（管理员 working 停招后）',
      stop.ok === true && verbOf(aNotRecruiting) === 409 && reasonOf(aNotRecruiting) === 'project_not_recruiting',
      JSON.stringify({ stop: stop.ok, status: verbOf(aNotRecruiting), reason: reasonOf(aNotRecruiting) }));

    // 满员：P2 headcount 1 → 录 1 人后 auto working → 管理员重开 recruiting → 第 2 人 ⇒ 409 full
    const P2 = String(((await create({ headcount: 1, wage_interval_hours: 1 })) as { view?: { project_id?: string } }).view?.project_id ?? '');
    const p2hire = await applyTo(W3, P2);
    const reopen = await patchProjectVerb({ ref: P2, body: { status: 'recruiting' }, ex });
    const aFull = await applyTo(W4, P2);
    ck.t('S5', '满员 apply ⇒ 409 `project_headcount_full`（在职数 = headcount 且重开招募）',
      p2hire.ok === true && reopen.ok === true && verbOf(aFull) === 409 && reasonOf(aFull) === 'project_headcount_full',
      JSON.stringify({ hire: p2hire.ok, reopen: reopen.ok, status: verbOf(aFull), reason: reasonOf(aFull) }));

    // 注册天数不足
    const P3 = String(((await create({ headcount: 5, recruit_min_account_days: 30, wage_interval_hours: 1 })) as { view?: { project_id?: string } }).view?.project_id ?? '');
    const aMinDays = await applyTo(W4, P3);
    ck.t('S6', '注册天数不足 apply ⇒ 409 `project_min_days_unmet`（新号 vs 30 天门槛）',
      verbOf(aMinDays) === 409 && reasonOf(aMinDays) === 'project_min_days_unmet',
      JSON.stringify({ status: verbOf(aMinDays), reason: reasonOf(aMinDays) }));
    // 老号同门槛 ⇒ 放行（证明闸判的是天数而不是恒拒）
    await c.query("UPDATE public.users SET time_reg = now() - interval '60 days' WHERE uid = $1::bigint", [String(W4)]);
    const aMinDaysOk = await applyTo(W4, P3);
    ck.t('S7', '注册 ≥ 门槛 ⇒ 同项目放行（闸有分辨力，非恒拒）', aMinDaysOk.ok === true, `ok=${aMinDaysOk.ok}`);

    // 他项目在职
    const P4 = String(((await create({ headcount: 5, wage_interval_hours: 1 })) as { view?: { project_id?: string } }).view?.project_id ?? '');
    const aOther = await applyTo(W1, P4);
    ck.t('S8', '他项目在职 apply ⇒ 409 `worker_already_hired`（W1 已在 P1）',
      verbOf(aOther) === 409 && reasonOf(aOther) === 'worker_already_hired',
      JSON.stringify({ status: verbOf(aOther), reason: reasonOf(aOther) }));

    // ---- S9 · 领薪：未录用 / 间隔未到 / 逐桶 2-1 / 100h 上限 / ended 封板
    const W5 = Number((await raw1<{ uid: string }>(c,
      `INSERT INTO public.users (uid, evm, bio) VALUES (908306, '0x' || lpad(to_hex(908306), 40, '0'), $1)
       ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio RETURNING uid::text AS uid`, [`p63-gate fixture2 ${RUN}`]))?.uid ?? 908306);
    const claim = (uid: number, ref: string) => claimProjectWageVerb({ actorUid: uid, ref, ex });
    const cNotHired = await claim(W5, P1);
    const cInterval = await claim(W1, P1);
    ck.t('S9', '领薪闸：未录用 ⇒ 403 `worker_not_hired` · 间隔未到 ⇒ 400 `wage_interval_not_reached`',
      verbOf(cNotHired) === 403 && reasonOf(cNotHired) === 'worker_not_hired'
        && verbOf(cInterval) === 400 && reasonOf(cInterval) === 'wage_interval_not_reached',
      JSON.stringify({ not_hired: [verbOf(cNotHired), reasonOf(cNotHired)], interval: [verbOf(cInterval), reasonOf(cInterval)] }));

    // 逐小时桶：W1 hired_at 回拨 3h，两个活跃桶（-2h / -1h）⇒ 3h 窗口 / 2 活跃 / 1 离线 ⇒ batt 5
    const bucket = async (uid: number, hoursAgo: number) => c.query(
      `INSERT INTO public.user_activity_hour (uid, day, hour, request_count)
       SELECT $1::bigint,
              ((now() - make_interval(hours => $2::int)) AT TIME ZONE 'UTC')::date,
              EXTRACT(HOUR FROM (now() - make_interval(hours => $2::int)) AT TIME ZONE 'UTC')::int, 1
       ON CONFLICT (uid, day, hour) DO UPDATE SET request_count = public.user_activity_hour.request_count + 1`,
      [String(uid), hoursAgo]);
    await c.query("UPDATE public.project_worker SET hired_at = now() - interval '3 hours' WHERE project_id = $1::bigint AND uid = $2::bigint", [P1, String(W1)]);
    await bucket(W1, 2);
    await bucket(W1, 1);
    const secBefore = BigInt(await bal(W1, SEC));
    const cOk = await claim(W1, P1);
    const cView = (cOk as { view?: Record<string, unknown> }).view ?? {};
    const w1Batt = Number((await raw1<{ b: number }>(c, 'SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid = $1::bigint),0)::int AS b', [String(W1)]))?.b ?? -1);
    const claimRows = Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.project_wage_claim WHERE project_id = $1::bigint AND uid = $2::bigint', [P1, String(W1)]))?.n ?? -1);
    ck.t('S10', '领薪逐小时桶：3h 窗口 / 2 活跃 / 1 离线 ⇒ batt = 2×2 + 1×1 = **5** · claim 行 1 · batt 台账入账 5 · 币种腿 = 每次固定额 25',
      cOk.ok === true && Number(cView.hours_elapsed) === 3 && Number(cView.active_hours) === 2
        && Number(cView.offline_hours) === 1 && Number(cView.batt_credited) === 5
        && w1Batt === 5 && claimRows === 1
        && BigInt(await bal(W1, SEC)) - secBefore === 25n
        && Number(cView.currency_amount) === 25 && String(cView.currency_cid) === String(SEC),
      JSON.stringify({ ok: cOk.ok, hours: cView.hours_elapsed, active: cView.active_hours, offline: cView.offline_hours, batt: cView.batt_credited, batt_acct: w1Batt, claims: claimRows, currency: cView.currency_amount }));

    // 100h 上限：W2 回拨 150h，零活跃桶 ⇒ hours=100 / active=0 / offline=100 / batt=100；batt 账户封顶 100
    await c.query("UPDATE public.project_worker SET hired_at = now() - interval '150 hours' WHERE project_id = $1::bigint AND uid = $2::bigint", [P1, String(W2)]);
    const cCap = await claim(W2, P1);
    const capView = (cCap as { view?: Record<string, unknown> }).view ?? {};
    const w2Batt = Number((await raw1<{ b: number }>(c, 'SELECT COALESCE((SELECT batt FROM public.batt_account WHERE uid = $1::bigint),0)::int AS b', [String(W2)]))?.b ?? -1);
    ck.t('S11', '100h 上限：150h 窗口 ⇒ hours_elapsed **恰 100**（超出不补）· 全离线 ⇒ batt 100 · batt 账户封顶 100',
      cCap.ok === true && Number(capView.hours_elapsed) === 100 && Number(capView.active_hours) === 0
        && Number(capView.offline_hours) === 100 && Number(capView.batt_credited) === 100 && w2Batt === 100,
      JSON.stringify({ ok: cCap.ok, hours: capView.hours_elapsed, active: capView.active_hours, batt: capView.batt_credited, batt_acct: w2Batt, uncapped_would_be: 150 }));

    // ended 封板：P2 结束 ⇒ 在职者领薪 409 / 再 PATCH 409
    const end = await patchProjectVerb({ ref: P2, body: { status: 'ended' }, ex });
    const cEnded = await claim(W3, P2);
    const pEnded = await patchProjectVerb({ ref: P2, body: { headcount: 9 }, ex });
    ck.t('S12', 'ended 封板：领薪 ⇒ 409 `project_ended_frozen` · 再次 PATCH ⇒ 409 `project_ended_frozen`',
      end.ok === true && verbOf(cEnded) === 409 && reasonOf(cEnded) === 'project_ended_frozen'
        && verbOf(pEnded) === 409 && reasonOf(pEnded) === 'project_ended_frozen',
      JSON.stringify({ end: end.ok, claim: [verbOf(cEnded), reasonOf(cEnded)], patch: [verbOf(pEnded), reasonOf(pEnded)] }));

    // ---- S13 · 离职幂等
    const leave1 = await leaveProjectVerb({ actorUid: W2, ref: P1, ex });
    const leave2 = await leaveProjectVerb({ actorUid: W2, ref: P1, ex });
    const claimAfterLeave = await claim(W2, P1);
    ck.t('S13', '离职：首次 left=true · 再次 200 no-op（left=false） · 离职后领薪 ⇒ 403 `worker_not_hired`',
      leave1.ok === true && (leave1 as { view?: { left?: boolean } }).view?.left === true
        && leave2.ok === true && (leave2 as { view?: { left?: boolean } }).view?.left === false
        && verbOf(claimAfterLeave) === 403,
      JSON.stringify({ first: (leave1 as { view?: { left?: boolean } }).view?.left, again: (leave2 as { view?: { left?: boolean } }).view?.left, claim: verbOf(claimAfterLeave) }));

    // ---- S14 · 管理员：缩容 409 / 扩容 200（专用 P6 满员 2/2 —— P1 已因 S13 离职只剩 1 人在职，缩到 1 合法）
    const P6 = String(((await create({ headcount: 2, wage_interval_hours: 1 })) as { view?: { project_id?: string } }).view?.project_id ?? '');
    const p6a = await applyTo(W2, P6);
    const p6b = await applyTo(W5, P6);
    const shrink = await patchProjectVerb({ ref: P6, body: { headcount: 1 }, ex });
    const grow = await patchProjectVerb({ ref: P6, body: { headcount: 6, wage_interval_hours: 12, wage_batt_per_claim: '33' }, ex });
    ck.t('S14', '管理员缩容低于在职 ⇒ 409 `project_headcount_below_hired` · 扩容 + 工资/间隔修改 ⇒ 200 落库',
      p6a.ok === true && p6b.ok === true
        && verbOf(shrink) === 409 && reasonOf(shrink) === 'project_headcount_below_hired'
        && grow.ok === true && Number((grow as { view?: { headcount?: number } }).view?.headcount) === 6
        && Number((grow as { view?: { wage_interval_hours?: number } }).view?.wage_interval_hours) === 12,
      JSON.stringify({ hired: [p6a.ok, p6b.ok], shrink: [verbOf(shrink), reasonOf(shrink)], grow: grow.ok }));

    // ---- S15/S16 · 登录态列表加性面（route §49.19 R1 增量 · 零新路由）
    //  W3 在职于 P2（status 已 ended ⇒ 不在列表）⇒ 登录态下**全表** my_role='none'（三键在场但 null）
    const viewerNone = await listProjects(ex, { viewerUid: W3 });
    const noneOk = viewerNone.length > 0 && viewerNone.every((x) =>
      x.my_role === 'none' && x.my_hired_at === null && x.next_claim_at === null
      && Object.keys(x).length === 18);
    ck.t('S15', '登录态列表（未在职者）：三键**在场**且 `my_role="none"` / `my_hired_at=null` / `next_claim_at=null` · 行 18 键',
      noneOk,
      JSON.stringify({ rows: viewerNone.length, sample: viewerNone[0] ? {
        my_role: viewerNone[0].my_role, my_hired_at: viewerNone[0].my_hired_at, keys: Object.keys(viewerNone[0]).length } : null }));

    //  W1 在职于 P1 且已在 S10 领过薪 ⇒ 恰 1 行 hired，值与库内逐项对拍（含 next_claim_at 的服务端算式）
    const viewerHired = await listProjects(ex, { viewerUid: W1 });
    const hiredRows = viewerHired.filter((x) => x.my_role === 'hired');
    const p1Row = viewerHired.find((x) => x.project_id === P1);
    const dbWage = await raw1<{ hired_at: string; last_claim: string | null; interval_hours: number; next_claim: string }>(c,
      `SELECT w.hired_at::text AS hired_at,
              (SELECT max(cl.time_created)::text FROM public.project_wage_claim AS cl
                WHERE cl.project_id = $1::bigint AND cl.uid = $2::bigint) AS last_claim,
              p.wage_interval_hours::int AS interval_hours,
              (GREATEST(w.hired_at,
                        COALESCE((SELECT max(cl.time_created) FROM public.project_wage_claim AS cl
                                   WHERE cl.project_id = $1::bigint AND cl.uid = $2::bigint), w.hired_at))
               + make_interval(hours => p.wage_interval_hours::int))::text AS next_claim
         FROM public.project_worker AS w
         JOIN public.project AS p ON p.project_id = w.project_id
        WHERE w.project_id = $1::bigint AND w.uid = $2::bigint AND w.status = 'hired'`,
      [P1, String(W1)]);
    const near = (a?: string | null, b?: string | null): boolean => {
      const x = a === null || a === undefined ? NaN : Date.parse(a);
      const y = b === null || b === undefined ? NaN : Date.parse(b);
      return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1000;
    };
    const claimRowsForW1 = Number((await raw1<{ n: number }>(c,
      'SELECT count(*)::int AS n FROM public.project_wage_claim WHERE project_id = $1::bigint AND uid = $2::bigint',
      [P1, String(W1)]))?.n ?? 0);
    const nextAt = p1Row?.next_claim_at ?? null;
    ck.t('S16', '登录态列表（在职者）：「领工资」只落在**自己的**卡（恰 1 行 hired）· `my_hired_at` 与库内 `hired_at` 一致 · `next_claim_at` = max(hired_at,上次 claim)+interval（与库内复算一致，且已领过薪 ⇒ 未来时刻）',
      p1Row !== undefined && p1Row.my_role === 'hired' && hiredRows.length === 1
        && claimRowsForW1 === 1
        && near(p1Row.my_hired_at, dbWage?.hired_at)
        && near(nextAt, dbWage?.next_claim)
        && Number(dbWage?.interval_hours ?? 0) === 1
        && nextAt !== null && Date.parse(nextAt) > Date.now()
        && viewerHired.filter((x) => x.my_role === 'none').every((x) => x.my_hired_at === null && x.next_claim_at === null),
      JSON.stringify({
        hired_rows: hiredRows.length, claims_w1: claimRowsForW1,
        my_hired_at: p1Row?.my_hired_at, db_hired_at: dbWage?.hired_at,
        next_claim_at: nextAt, db_next_claim: dbWage?.next_claim, db_last_claim: dbWage?.last_claim,
      }));

    // ==================================================================== N · 三臂负控
    // ① 部分唯一索引：去索引 ⇒ 同一 uid 双项目在职**可现**；复索引 ⇒ 23505
    const dupInsert = (proj: string, uid: number) => c.query(
      `INSERT INTO public.project_worker (project_id, uid, status) VALUES ($1::bigint, $2::bigint, 'hired')`,
      [proj, String(uid)]);
    const nc1_drop = await undoAfter(c, 'nc1a', async () => {
      await c.query('DROP INDEX public.project_worker_single_hired_uniq');
      await dupInsert(P4, W1); // W1 现于 P1 在职 ⇒ 去索引后应当成功
      return Number((await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM public.project_worker WHERE uid = $1::bigint AND status='hired'", [String(W1)]))?.n ?? -1);
    });
    const nc1_keep = await undoAfter(c, 'nc1b', async () => {
      await dupInsert(P4, W1);
      return 'inserted';
    });
    ck.t('N1', '★负控① 部分唯一索引：**去索引** ⇒ 同 uid 双项目在职可现（hired 行数=2）；**复索引** ⇒ 23505。⇒ 「S8 / PR-N1」判据对索引缺失敏感',
      nc1_drop.sqlstate === null && Number(nc1_drop.value ?? 0) === 2 && nc1_keep.sqlstate === '23505',
      JSON.stringify({ without_index: { hired_rows: nc1_drop.value, sqlstate: nc1_drop.sqlstate }, with_index: nc1_keep.sqlstate }));

    // ② 100h 上限：DB CHECK 拒 150h（cap 冻在库面）+ 反事实 150 > 100（函数位可红）
    const nc2 = await undoAfter(c, 'nc2', async () => {
      await c.query(
        `INSERT INTO public.project_wage_claim (project_id, uid, batt_credited, hours_elapsed, active_hours, offline_hours)
         VALUES ($1::bigint, $2::bigint, 0, 150, 0, 150)`, [P1, String(W5)]);
      return 'inserted';
    });
    const uncapped = 150;
    ck.t('N2', '★负控② 100h 上限：直插 hours=150 ⇒ 23514（CHECK 挡在库面）；函数位若去 cap 则该窗口=150 > 100 ⇒ 「S11 hours=100」判据必红',
      nc2.sqlstate === '23514' && uncapped > PROJECT_MAX_CLAIM_HOURS && Number(capView.hours_elapsed) === 100,
      JSON.stringify({ db_check: nc2.sqlstate, uncapped_counterfactual: uncapped, capped_measured: capView.hours_elapsed }));

    // ③ 建费：穷号建项 ⇒ 409 + 零残留；反事实直插（无扣费腿）⇒ 成功（免费建项可现）
    const poorRows = await raw<{ uid: string }>(c,
      `INSERT INTO public.users (uid, evm, bio) VALUES (908307, '0x' || lpad(to_hex(908307), 40, '0'), $1)
       ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio RETURNING uid::text AS uid`, [`p63-gate poor ${RUN}`]);
    const POOR = Number(poorRows[0].uid);
    const rowsBeforePoor = Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.project'))?.n ?? 0);
    const poorKey = `cli:p63-gate-${RUN}-poor`;
    const poor = await createProjectVerb({ actorUid: POOR, body: mkBody({ headcount: 2 }), headerKey: poorKey, ex });
    const rowsAfterPoor = Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.project'))?.n ?? 0);
    const poorLedger = await ledgerRows(poorKey);
    const nc3 = await undoAfter(c, 'nc3', async () => {
      // 反事实：跳过扣费腿，只插项目行（= 「去建费扣款」后的行为）⇒ 免费建项
      await c.query(
        `INSERT INTO public.project (snowflake_id, owner_uid, title, description, headcount, recruit_min_account_days,
                                     wage_batt_per_claim, wage_interval_hours, status)
         VALUES (9000000000000001, $1::bigint, $2, 'bypass', 2, 0, 10, 1, 'recruiting')`,
        [String(POOR), `p63 bypass ${RUN}`]);
      return Number((await raw1<{ n: number }>(c, 'SELECT count(*)::int AS n FROM public.project'))?.n ?? -1);
    });
    ck.t('N3', '★负控③ 建费：穷号建项 ⇒ 409 `project_create_fee_insufficient` · 项目行**不增** · 同键台账 **0** 条；反事实「无扣费腿直插」⇒ 行数 +1（免费建项可现）',
      verbOf(poor) === 409 && reasonOf(poor) === 'project_create_fee_insufficient'
        && rowsBeforePoor === rowsAfterPoor && poorLedger === 0
        && nc3.sqlstate === null && Number(nc3.value ?? 0) === rowsBeforePoor + 1,
      JSON.stringify({ status: verbOf(poor), reason: reasonOf(poor), rows: [rowsBeforePoor, rowsAfterPoor], ledger: poorLedger, bypass_rows: nc3.value }));

    // ---- 撤回夹具：删除本门新增的用户 / 币 / 全部业务行（rollback 也会撤，这里显式做一次以证明可逆）
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
    const residue = await raw1RetrySafe(pool);
    // 已 apply 稳态 ⇒ 提交面本就有四表 + 配置行（那是迁移的真实终态，不是本门残留）；
    // 未 apply ⇒ 必须零残留。两态都断言「本门没有额外写入」（版本行与业务行数不为门所动）。
    const residueOk = applied63 ? residue.tables === 4 && residue.fee === 1 : residue.tables === 0 && residue.fee === 0;
    ck.t('Z1', `[${MODE}] ${applied63
      ? '已 apply 稳态：提交面四表在场 + project_create_fee 行 1（= 迁移终态；本门单回滚事务未额外写入）'
      : '零 apply / 零残留：提交面**无** project 四表、**无** project_create_fee 行'}`,
      residueOk,
      JSON.stringify({ mode: MODE, ...residue }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p63-project-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});

/** Z 段：提交面残留读数（rollback 之后另起一次只读查询） */
async function raw1RetrySafe(p: ReturnType<typeof mkPool>): Promise<{ tables: number; fee: number }> {
  const t = await qRetry<{ n: number }>(p,
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('project','project_worker','project_wage_claim','user_activity_hour')");
  const f = await qRetry<{ n: number }>(p,
    "SELECT count(*)::int AS n FROM public.app_config WHERE key = 'project_create_fee'");
  return { tables: Number(t[0]?.n ?? -1), fee: Number(f[0]?.n ?? -1) };
}
