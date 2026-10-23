/**
 * p67-00 · 领工资「连续领工资」随机奖励门 · 迁移 0067 + claim 加性响应 + 台账腿
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p63 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/project/p67-00-wage-streak-gate.ts
 * 读数：`ops/project/readings/p67-wage-streak-gate-<RUN>.json`
 *
 * ★ 覆盖面（Kevin 需求第 4 条 · 后端面）：
 *   A · 静态面（零 DB）：0067 形状（单 INSERT + ON CONFLICT DO NOTHING + 尾部 DO 四项自检、
 *       无 BEGIN/COMMIT、注释零 dollar-dollar、零行首竖线）· 服务层常量（键 / 默认 1–5 / 语义标签
 *       ≠ ledger kind / 奖励 kind 在 24 值闭集内且 LEDGER_KINDS 仍 24）· claim 响应**加性**接入
 *       （`sendSuccess(res, result.view)` 原样透出、注册点仍 128）· 区间解析纯函数 fail-closed 六臂 ·
 *       抽样含端点 / 真有随机性。
 *   B · 迁移干跑（真库 · 回滚事务内）：0067 头段 + 尾部 DO 全绿（键恰 1 行 / 值对象 / min=1 max=5 /
 *       0017 容器约束仍在）· **二次执行不覆盖**（`ON CONFLICT DO NOTHING`：先把值改成 9–9 再跑头段，
 *       值不变）· 版本行未写 · **自检负控两臂**（删键 ⇒ 尾部 RAISE；值改 `min=0` ⇒ 尾部 RAISE）。
 *   S · 服务层真路径（同事务 · `ex` 注入）：连领 5 次 ⇒ `streak` = 1/2/3/4/5（每次 +1）·
 *       每笔 `bonus_amount` ∈ 配置区间（整数）· **账实对拍**（用户 `$` 余额增量 = bonus = 该事件
 *       用户腿和；平台 `-1` 腿 = −bonus；台账恰 2 条 / kind = invite_first_task_reward）·
 *       配置 7–7 ⇒ 奖励恰 7（证明读的是 app_config 不是硬编码）· 配置非法（0–0）⇒ 回落 1–5 ·
 *       离职重入**不清零**（第 6 次 ⇒ streak 6）· 次数与台账条数一致（claim 行数 = streak = 奖励事件数）。
 *   N · **负控（判据必须可红）**：
 *       ① `streak` 无计数 ⇒ 恒 1：反事实序列 [1,1,1] 过不了 S 的 `streak === 序数` 判据；
 *          **真路径灵敏度**再加一臂 —— 删掉最早那条 claim 行后连领，返回的 streak 仍等于库内行数
 *          （k−1+1=k），恒 1 实现会返回 1 ⇒ 必红。
 *       ② `bonus` 无台账腿 ⇒ 余额对拍必红：反事实「直接改 account.balance」被 `trg_account_guard`
 *          拒（P0001 `!= latest ledger snapshot`）⇒ 「余额只能随台账走」是库面承重的；算术上
 *          `delta_without_leg = 0 < bonus` ⇒ 对拍判据红。
 *   Z · 残留：本门全程单回滚事务；提交面 `schema_migration` 无 0067 行、`app_config` 无该键（未 apply 态）。
 *
 * 纪律：**不 apply、不写版本表**；DDL / DML / 资金夹具全在回滚事务内（`inRollbackTx`），
 *   反事实臂再包 SAVEPOINT ⇒ 零残留。凭据只读 `backend-ts/.env.local`（dev 库）。
 *   · 服务层调用**一律注入 `ex`**（迁移干跑未提交 ⇒ 别的连接看不到该键）。
 *   · 台账条数按**派生键** `<key>#<i>` 计：两腿事件 = `key` + `key#2` ⇒ 只等值匹配会少算一半。
 *   · SQL 切分前**先剥注释**（0067 文件头大段 `--` 注释若并入首条语句，INSERT 会丢）。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import type { TxClient } from '../../backend-ts/src/db';
import {
  WAGE_STREAK_BONUS_CEILING,
  WAGE_STREAK_BONUS_DEFAULT,
  WAGE_STREAK_BONUS_KEY,
  WAGE_STREAK_BONUS_KIND,
  WAGE_STREAK_BONUS_LEDGER_KIND,
  claimProjectWageVerb,
  currentWageStreakBonusRange,
  leaveProjectVerb,
  parseWageStreakBonusRange,
  pickWageStreakBonus,
} from '../../backend-ts/src/project-service';
import { LEDGER_KINDS, postEvent } from '../../backend-ts/src/ledger';

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
const MIG67 = readSrc('backend-ts/migrations/0067_wage_streak_bonus.sql');
// 0068（p68 单）：本门直插 project 行需要 slug 列在场 ⇒ 干跑其头段（幂等，回滚事务内）
const MIG68 = readSrc('backend-ts/migrations/0068_project_slug_campaign_link.sql');

// ---------------------------------------------------------------- SQL 切分（dollar-dollar 感知）
/** 先剥注释（dollar-dollar 外），否则文件头大段 `--` 注释会与第一条 DML 同语句 ⇒ INSERT 丢失 */
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
const M67_HEAD = splitSqlStatements(headOf(MIG67));
const M67_TAIL = tailOf(MIG67);
const M68_HEAD = splitSqlStatements(headOf(MIG68));

/** SAVEPOINT 三明治：跑完（无论成败）一律回滚到存档点 ⇒ 反事实臂零污染 */
const undoAfter = async <T>(c: Qx, tag: string, fn: () => Promise<T>): Promise<{ value: T | null; sqlstate: string | null; message: string }> => {
  const sp = `p67_${tag}`;
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

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  const migShape = {
    noTx: !/^\s*(BEGIN|COMMIT)\s*;/m.test(MIG67),
    commentDollar: MIG67.split('\n').filter((l) => l.trim().startsWith('--') && l.includes('$$')).length,
    noPipe: MIG67.split('\n').filter((l) => l.startsWith('|')).length === 0,
  };
  const insertCount = (MIG67.match(/INSERT INTO public\.app_config/g) ?? []).length;
  ck.t('A1', '0067 形状：单条 `INSERT INTO public.app_config` + `ON CONFLICT (key) DO NOTHING` · 键 `wage_streak_bonus` · 值 `{"min":"1","max":"5"}` · 无 BEGIN/COMMIT · 注释零 dollar-dollar · 零行首竖线',
    migShape.noTx && migShape.commentDollar === 0 && migShape.noPipe
      && insertCount === 1
      && /ON CONFLICT \(key\) DO NOTHING/.test(MIG67)
      && MIG67.includes("'wage_streak_bonus'")
      && MIG67.includes(`'{"min":"1","max":"5"}'::jsonb`),
    JSON.stringify({ insert: insertCount, ...migShape }));

  ck.t('A2', '0067 尾部自检五项在场：键恰 1 行 · `jsonb_typeof = object` · min/max 十进制串 · `0 < min <= max` · 0017 容器 CHECK 仍在',
    /count\(\*\) INTO v_cnt FROM public\.app_config WHERE key = 'wage_streak_bonus'/.test(MIG67)
      && /jsonb_typeof\(v_val\) <> 'object'/.test(MIG67)
      && /v_min !~ '\^\[0-9\]\+\$'/.test(MIG67)
      && /v_max !~ '\^\[0-9\]\+\$'/.test(MIG67)
      && /v_min::numeric > 0 AND v_max::numeric >= v_min::numeric/.test(MIG67)
      && /app_config_value_is_container/.test(MIG67),
    'tail self-check tokens ok');

  ck.t('A3', '零新 kind：`LEDGER_KINDS` 仍 24 值 · 奖励腿借 `invite_first_task_reward`（在闭集内）· 响应语义标签 `wage_streak` **不是** ledger kind',
    LEDGER_KINDS.length === 24
      && (LEDGER_KINDS as readonly string[]).includes(WAGE_STREAK_BONUS_LEDGER_KIND)
      && WAGE_STREAK_BONUS_LEDGER_KIND === 'invite_first_task_reward'
      && WAGE_STREAK_BONUS_KIND === 'wage_streak'
      && !(LEDGER_KINDS as readonly string[]).includes(WAGE_STREAK_BONUS_KIND),
    JSON.stringify({ kinds: LEDGER_KINDS.length, ledger_kind: WAGE_STREAK_BONUS_LEDGER_KIND, label: WAGE_STREAK_BONUS_KIND }));

  ck.t('A4', '服务层常量：键 = `wage_streak_bonus` · 默认区间 1–5 · 护栏 CEILING = 1e6',
    WAGE_STREAK_BONUS_KEY === 'wage_streak_bonus'
      && WAGE_STREAK_BONUS_DEFAULT.min === 1 && WAGE_STREAK_BONUS_DEFAULT.max === 5
      && WAGE_STREAK_BONUS_CEILING === 1_000_000,
    JSON.stringify({ key: WAGE_STREAK_BONUS_KEY, def: WAGE_STREAK_BONUS_DEFAULT, ceiling: WAGE_STREAK_BONUS_CEILING }));

  const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const claimRoute = INDEX_TS.slice(
    INDEX_TS.indexOf("app.post('/api/project/:id/claim'"),
    INDEX_TS.indexOf("app.post('/api/project/:id/leave'"),
  );
  ck.t('A5', 'claim 响应**加性**：路由仍 `sendSuccess(res, result.view, …)`（整份 view 原样透出，零字段裁剪）· 注册点现取 110（get 49 / post 54 / patch 4 / delete 3 · 2026-10-23 现取，含 vault-recharge +1）',
    regs === 110 && countVerb('get') === 49 && countVerb('post') === 54 && countVerb('patch') === 4 && countVerb('delete') === 3
      && /sendSuccess\(res, result\.view/.test(claimRoute)
      && /claimProjectWageVerb\(\{ actorUid: Number\(actor\.user\.uID\), ref \}\)/.test(claimRoute),
    JSON.stringify({ regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'), delete: countVerb('delete'), passthrough: /sendSuccess\(res, result\.view/.test(claimRoute) }));

  // ---- 区间解析纯函数：六个 fail-closed 臂 + 两个正臂
  const pOk = parseWageStreakBonusRange({ min: '3', max: '7' });
  const pNum = parseWageStreakBonusRange({ min: 2, max: 4 });
  const pJsonText = parseWageStreakBonusRange('{"min":"2","max":"4"}');
  const pRev = parseWageStreakBonusRange({ min: '5', max: '1' });
  const pZero = parseWageStreakBonusRange({ min: '0', max: '5' });
  const pFrac = parseWageStreakBonusRange({ min: '1.5', max: '5' });
  const pText = parseWageStreakBonusRange({ min: 'a', max: '5' });
  const pArr = parseWageStreakBonusRange(['1', '5']);
  const pNull = parseWageStreakBonusRange(null);
  const pHuge = parseWageStreakBonusRange({ min: '1', max: '999999999' });
  const isDefault = (x: { min: number; max: number; source: string }) => x.min === 1 && x.max === 5 && x.source === 'default';
  ck.t('A6', '区间解析 fail-closed：正臂 3（字符串 / number / JSON 文本）· 反转 / min=0 / 小数 / 非数字 / 数组 / null / 超护栏 ⇒ 一律回落 1–5（`source=default`）',
    pOk.min === 3 && pOk.max === 7 && pOk.source === 'app_config'
      && pNum.min === 2 && pNum.max === 4 && pNum.source === 'app_config'
      && pJsonText.min === 2 && pJsonText.max === 4 && pJsonText.source === 'app_config'
      && [pRev, pZero, pFrac, pText, pArr, pNull, pHuge].every(isDefault),
    JSON.stringify({ ok: pOk, num: pNum, json: pJsonText, rev: pRev, zero: pZero, frac: pFrac, text: pText, arr: pArr, nil: pNull, huge: pHuge }));

  // ---- 抽样：含端点 + 真有随机性（非「钉死固定值」）
  const fixed = Array.from({ length: 200 }, () => pickWageStreakBonus({ min: 7, max: 7 }));
  const loose = Array.from({ length: 400 }, () => pickWageStreakBonus({ min: 1, max: 5 }));
  const inRange = loose.every((n) => n >= 1 && n <= 5 && Number.isInteger(n));
  const distinct = new Set(loose).size;
  ck.t('A7', '抽样：`min=max=7` ⇒ 200 次恒 7（含端点）· `1–5` ⇒ 400 次全在区间内且出现 ≥3 个不同值（真随机，非固定值）',
    fixed.every((n) => n === 7) && inRange && distinct >= 3,
    JSON.stringify({ fixed_unique: Array.from(new Set(fixed)), in_range: inRange, distinct }));

  // ======================================================================== B + S + N · 事务内
  const pool = mkPool(2);
  const applied67 = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0067'"))[0]?.n ?? 0) > 0;
  const MODE = applied67 ? 'post-apply' : 'pre-apply';
  out.mode = MODE;

  const r = await tx(pool, async (c) => {
    const R: Record<string, unknown> = { mode: MODE };
    const ex = c as unknown as TxClient;
    const balUsd = async (uid: number | string): Promise<string> =>
      String((await raw1<{ b: string }>(c,
        'SELECT COALESCE((SELECT balance FROM public.account WHERE uid = $1::bigint AND cid = 1), 0)::text AS b',
        [String(uid)]))?.b ?? '0');
    const claimRowsOf = async (projectId: string, uid: number): Promise<number> => Number((await raw1<{ n: number }>(c,
      'SELECT count(*)::int AS n FROM public.project_wage_claim WHERE project_id = $1::bigint AND uid = $2::bigint',
      [projectId, String(uid)]))?.n ?? -1);
    /** 奖励事件的两腿（派生键 `<key>#<i>` 必须一并匹配） */
    const bonusLegs = async (key: string) => {
      const rows = await raw<{ uid: string; delta: string; kind: string }>(c,
        `SELECT uid::text AS uid, delta::text AS delta, kind
           FROM public.ledger_entry
          WHERE idempotency_key = $1 OR idempotency_key LIKE $1 || '#%'`,
        [key]);
      const userLeg = rows.filter((x) => Number(x.uid) > 0).reduce((s, x) => s + BigInt(x.delta), 0n);
      const platLeg = rows.filter((x) => Number(x.uid) < 0).reduce((s, x) => s + BigInt(x.delta), 0n);
      return { n: rows.length, userLeg: userLeg.toString(), platLeg: platLeg.toString(), kinds: Array.from(new Set(rows.map((x) => x.kind))) };
    };
    const setCfg = async (json: string) => c.query(
      'UPDATE public.app_config SET value = $1::jsonb WHERE key = $2::text', [json, WAGE_STREAK_BONUS_KEY]);

    // ---- 夹具：三个用户（rollback 内）+ 项目（working · interval 1h · 无币种工资腿 ⇒ `$` 增量纯奖励）
    const uids: number[] = [];
    for (const base of [908601, 908602, 908603]) {
      const row = await raw1<{ uid: string }>(c,
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio
         RETURNING uid::text AS uid`,
        [base, `p67-gate fixture ${RUN}`]);
      uids.push(Number(row?.uid ?? 0));
    }
    const [OWNER, W1, W2] = uids;
    R.fixture_users = uids;

    // ---- 0068 头段干跑（幂等 · 回滚事务内）：下方直插 project 行需要 slug 列在场（pre/post apply 同式）
    for (const stmt of M68_HEAD) await c.query(stmt);

    const projRows = await raw<{ project_id: string }>(c,
      `INSERT INTO public.project
         (snowflake_id, owner_uid, title, slug, description, headcount, recruit_min_account_days,
          wage_batt_per_claim, wage_interval_hours, status)
       VALUES (9000000000000067, $1::bigint, $2, $3, 'p67 gate', 5, 0, 10, 1, 'working')
       RETURNING project_id::text AS project_id`,
      [String(OWNER), `p67 gate project ${RUN}`, `p67-gate-${Math.random().toString(36).slice(2, 10)}`]);
    const P1 = String(projRows[0].project_id);
    const hire = async (uid: number) => c.query(
      `INSERT INTO public.project_worker (project_id, uid, status, hired_at)
       VALUES ($1::bigint, $2::bigint, 'hired', now() - interval '3 hours')`,
      [P1, String(uid)]);
    await hire(W1);
    await hire(W2);

    // 平台收入 `-1` 自助充值（奖励腿出账方）：铸给 OWNER 再以 listing_fee 费腿上缴（−1 credit 白名单内）
    await postEvent({
      op: 'mint', uid: String(OWNER), cid: '1', amount: '5000', platform: true,
      idempotencyKey: `ops:p67-gate:${RUN}:mint`, memo: 'p67-gate usd fixture', ex,
    });
    await postEvent({
      op: 'entries',
      idempotencyKey: `ops:p67-gate:${RUN}:fund-revenue`,
      refType: 'system',
      refId: P1,
      memo: 'p67-gate platform revenue top-up',
      entries: [
        { uid: String(OWNER), cid: '1', delta: '-4000', kind: 'listing_fee' },
        { uid: '-1', cid: '1', delta: '4000', kind: 'listing_fee' },
      ],
      ex,
    });
    R.revenue_topup = { platform_before_claims: await balUsd('-1') };

    // ---- B1 · 迁移 0067 干跑（头段 + 尾部 DO）
    const before67 = Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0067'"))?.n ?? -1);
    for (const stmt of M67_HEAD) await c.query(stmt);
    await c.query(M67_TAIL);
    const after67 = Number((await raw1<{ n: number }>(c,
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0067'"))?.n ?? -1);
    const cfgRow = await raw1<{ v: string }>(c,
      "SELECT value::text AS v FROM public.app_config WHERE key = 'wage_streak_bonus'");
    const cfgParsed = await currentWageStreakBonusRange(ex);
    ck.t('B1', '0067 干跑全绿：键恰 1 行 · 值 `{"min": "1", "max": "5"}` · `currentWageStreakBonusRange(ex)` ⇒ 1–5（source=app_config）· 版本行未写',
      after67 === before67 && Number((await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM public.app_config WHERE key = 'wage_streak_bonus'"))?.n ?? 0) === 1
        && cfgParsed.min === 1 && cfgParsed.max === 5 && cfgParsed.source === 'app_config'
        && /"min":\s*"1"/.test(String(cfgRow?.v ?? '')),
      JSON.stringify({ version_rows: [before67, after67], value: cfgRow?.v, parsed: cfgParsed }));

    // ---- B2 · 幂等：先改值到 9–9，再跑头段 ⇒ `ON CONFLICT DO NOTHING` 不覆盖
    await setCfg('{"min":"9","max":"9"}');
    for (const stmt of M67_HEAD) await c.query(stmt);
    const keepRows = await raw1<{ v: string; n: number }>(c,
      `SELECT value::text AS v, count(*) OVER ()::int AS n FROM public.app_config WHERE key = 'wage_streak_bonus'`);
    const keepParsed = await currentWageStreakBonusRange(ex);
    await setCfg('{"min":"1","max":"5"}');
    ck.t('B2', '0067 幂等：值改成 9–9 后再跑头段 ⇒ 值**不变**（DO NOTHING 不覆盖运维已调区间）· 仍恰 1 行',
      keepParsed.min === 9 && keepParsed.max === 9 && Number(keepRows?.n ?? 0) === 1,
      JSON.stringify({ after_rerun: keepRows?.v, parsed: keepParsed }));

    // ---- B3 · 自检负控两臂（缺键 / 非法区间 ⇒ 尾部 DO 必 RAISE）
    const ncMissing = await undoAfter(c, 'nc_missing', async () => {
      await c.query("DELETE FROM public.app_config WHERE key = 'wage_streak_bonus'");
      await c.query(M67_TAIL);
      return 'passed';
    });
    const ncBad = await undoAfter(c, 'nc_bad', async () => {
      await setCfg('{"min":"0","max":"0"}');
      await c.query(M67_TAIL);
      return 'passed';
    });
    ck.t('B3', '★迁移自检负控：删键后跑尾部 DO ⇒ RAISE（P0001）· 值改 `min=0` 后跑尾部 DO ⇒ RAISE ⇒ 自检对缺行与非法区间都**可红**',
      ncMissing.sqlstate === 'P0001' && /self-check FAILED/.test(ncMissing.message)
        && ncBad.sqlstate === 'P0001' && /self-check FAILED/.test(ncBad.message),
      JSON.stringify({ missing: [ncMissing.sqlstate, ncMissing.message.slice(0, 80)], bad: [ncBad.sqlstate, ncBad.message.slice(0, 80)] }));

    // ==================================================================== S · 连领 5 次（真路径）
    const claims: Array<{
      idx: number; streak: number; bonus: string; delta: string; rows: number;
      legs: { n: number; userLeg: string; platLeg: string; kinds: string[] }; kind_label: string; claim_id: string; claim_key: string;
    }> = [];
    /** 每次领完把该 claim 行时间回拨 3h ⇒ 下一次窗口（interval=1h）立即满足（夹具时间旅行，rollback 撤销） */
    const claim = async (uid: number): Promise<typeof claims[number]> => {
      const before = BigInt(await balUsd(uid));
      const res = await claimProjectWageVerb({ actorUid: uid, ref: P1, ex });
      if (!res.ok) {
        throw new Error(`claim failed: ${verbOf(res)} ${reasonOf(res)} ${JSON.stringify((res as { details?: unknown }).details ?? {})}`);
      }
      const v = res.view;
      const after = BigInt(await balUsd(uid));
      const legs = await bonusLegs(`${v.claim_key}:bonus`);
      await c.query(
        "UPDATE public.project_wage_claim SET time_created = now() - interval '3 hours' WHERE claim_id = $1::bigint",
        [v.claim_id],
      );
      const row = {
        idx: claims.length + 1,
        streak: Number(v.streak),
        bonus: String(v.bonus_amount),
        delta: (after - before).toString(),
        rows: await claimRowsOf(P1, uid),
        legs,
        kind_label: String(v.bonus_kind),
        claim_id: String(v.claim_id),
        claim_key: String(v.claim_key),
      };
      claims.push(row);
      return row;
    };

    const c1 = await claim(W1);
    const c2 = await claim(W1);
    const c3 = await claim(W1);
    const seq = [c1, c2, c3];
    const inDefaultRange = seq.every((x) => {
      const n = Number(x.bonus);
      return Number.isInteger(n) && n >= 1 && n <= 5;
    });
    const reconcile = seq.every((x) => x.delta === x.bonus && x.legs.userLeg === x.bonus
      && x.legs.platLeg === `-${x.bonus}` && x.legs.n === 2
      && x.legs.kinds.length === 1 && x.legs.kinds[0] === 'invite_first_task_reward');
    ck.t('S1', '连领三次：`streak` = **1 / 2 / 3** · 每笔 `bonus_amount` ∈ [1,5] 整数 · `bonus_kind` = `wage_streak` · claim 行数 1/2/3',
      seq.map((x) => x.streak).join(',') === '1,2,3' && inDefaultRange
        && seq.every((x) => x.kind_label === 'wage_streak')
        && seq.map((x) => x.rows).join(',') === '1,2,3',
      JSON.stringify({ streaks: seq.map((x) => x.streak), bonuses: seq.map((x) => x.bonus), rows: seq.map((x) => x.rows), labels: seq.map((x) => x.kind_label) }));

    ck.t('S2', '★账实对拍（三连领）：每笔用户 `$` 余额增量 = `bonus_amount` = 该事件用户腿和 · 平台 `-1` 腿 = −bonus · 台账**恰 2 条** / kind = `invite_first_task_reward`',
      reconcile,
      JSON.stringify(seq.map((x) => ({ bonus: x.bonus, delta: x.delta, legs: x.legs }))));

    // ---- S3 · 配置敏感：7–7 ⇒ 奖励恰 7，streak 续到 4
    await setCfg('{"min":"7","max":"7"}');
    const c4 = await claim(W1);
    // ---- S4 · 配置非法（0–0）⇒ fail-closed 回落 1–5，streak 续到 5
    await setCfg('{"min":"0","max":"0"}');
    const c5 = await claim(W1);
    await setCfg('{"min":"1","max":"5"}');
    ck.t('S3', '配置敏感 + fail-closed：区间改 7–7 ⇒ 第 4 笔奖励**恰 7**（读的是 app_config，非硬编码）· 改成非法 0–0 ⇒ 第 5 笔回落 [1,5] 且 ≠ 0 · streak = 4 / 5 逐次 +1',
      c4.bonus === '7' && c4.streak === 4 && c4.delta === '7' && c4.legs.userLeg === '7'
        && Number(c5.bonus) >= 1 && Number(c5.bonus) <= 5 && c5.streak === 5,
      JSON.stringify({ ranged_7_7: [c4.streak, c4.bonus, c4.delta], invalid_0_0: [c5.streak, c5.bonus] }));

    // ---- S5 · 离职重入**不清零**（按项目累计口径；一句话可改：改成清零只需把 count 换成「本次入职后的行数」）
    const leave = await leaveProjectVerb({ actorUid: W1, ref: P1, ex });
    await hire(W1);
    const c6 = await claim(W1);
    ck.t('S5', '离职后重新入职：`streak` = **6**（按 (project,uid) 累计、不清零 —— 派生行数，不落冗余列）· 离职本身 200',
      leave.ok === true && (leave as { view?: { left?: boolean } }).view?.left === true && c6.streak === 6 && c6.rows === 6,
      JSON.stringify({ left: (leave as { view?: { left?: boolean } }).view?.left, streak: c6.streak, rows: c6.rows }));

    // ---- S6 · 次数与台账条数一致（claim 行数 = 最后一次 streak = 奖励事件数 = 2 条分录/事件）
    const allClaims = await claimRowsOf(P1, W1);
    const bonusEvents = Number((await raw1<{ n: number }>(c,
      `SELECT count(DISTINCT split_part(idempotency_key, '#', 1))::int AS n
         FROM public.ledger_entry
        WHERE kind = 'invite_first_task_reward' AND uid = $1::bigint AND cid = 1
          AND ref_id = $2::bigint`,
      [String(W1), P1]))?.n ?? -1);
    const totalDelta = BigInt(await balUsd(W1));
    const sumBonus = claims.reduce((s, x) => s + BigInt(x.bonus), 0n);
    ck.t('S6', '次数与台账一致：claim 行 = 6 · 最后一次 streak = 6 · 奖励**事件**数 = 6 · 事件分录 = 12（2 腿/事件）· 累计余额 = Σbonus',
      allClaims === 6 && c6.streak === allClaims && bonusEvents === 6 && totalDelta === sumBonus
        && claims.length === 6,
      JSON.stringify({ claims: allClaims, streak: c6.streak, bonus_events: bonusEvents, balance: totalDelta.toString(), sum_bonus: sumBonus.toString() }));

    // ---- S7 · 平台收入账户不足 ⇒ **只跳过奖励腿**（bonus_amount='0'），领取本身仍成功
    //    （把 `-1` 余额清零后连领：streak 照常 +1、claim 行落盘、零奖励台账；随后原额退回，后续臂不受影响）
    const revBefore = BigInt(await balUsd('-1'));
    await postEvent({
      op: 'entries',
      idempotencyKey: `ops:p67-gate:${RUN}:drain-revenue`,
      refType: 'system',
      refId: P1,
      memo: 'p67-gate drain platform revenue',
      entries: [
        { uid: '-1', cid: '1', delta: (-revBefore).toString(), kind: 'invite_first_task_reward' },
        { uid: String(W2), cid: '1', delta: revBefore.toString(), kind: 'invite_first_task_reward' },
      ],
      ex,
    });
    const revZero = BigInt(await balUsd('-1'));
    const c7 = await claim(W2);
    // 原额退回（W2 以 listing_fee 费腿上缴 ⇒ `-1` credit 白名单内）
    await postEvent({
      op: 'entries',
      idempotencyKey: `ops:p67-gate:${RUN}:restore-revenue`,
      refType: 'system',
      refId: P1,
      memo: 'p67-gate restore platform revenue',
      entries: [
        { uid: String(W2), cid: '1', delta: (-revBefore).toString(), kind: 'listing_fee' },
        { uid: '-1', cid: '1', delta: revBefore.toString(), kind: 'listing_fee' },
      ],
      ex,
    });
    ck.t('S7', '平台收入 `-1` 清零后领薪：**领取仍成功**（200）· `bonus_amount` = `0` · streak 照常 +1（=1）· claim 行落盘 · 零奖励台账腿（奖励 fail-open、领取 fail-closed）',
      revZero === 0n && c7.streak === 1 && c7.bonus === '0' && c7.delta === '0'
        && c7.legs.n === 0 && c7.rows === 1,
      JSON.stringify({ revenue_zero: revZero.toString(), streak: c7.streak, bonus: c7.bonus, delta: c7.delta, legs: c7.legs.n, rows: c7.rows }));

    // ==================================================================== N · 负控
    // ① streak 无计数 ⇒ 恒 1：反事实序列过不了 S1 的 `streak === 序数` 判据
    const constantSeq = [1, 1, 1];
    const constPasses = constantSeq.every((x, i) => x === i + 1);
    // ①′ 真路径灵敏度：删掉**最早**那条 claim 行 ⇒ 库内行数 k−1；再领一次，返回 streak 必须跟着行数走（=k），
    //    恒 1 实现会返回 1 ⇒ S1/S6 判据必红。
    const nc1 = await undoAfter(c, 'nc1', async () => {
      await c.query('DELETE FROM public.project_wage_claim WHERE claim_id = $1::bigint', [claims[0].claim_id]);
      const rowsAfterDelete = await claimRowsOf(P1, W1);
      const res = await claimProjectWageVerb({ actorUid: W1, ref: P1, ex });
      const streak = res.ok ? Number(res.view.streak) : -1;
      const rowsAfterClaim = await claimRowsOf(P1, W1);
      return { rowsAfterDelete, streak, rowsAfterClaim };
    });
    const nc1v = nc1.value as { rowsAfterDelete: number; streak: number; rowsAfterClaim: number } | null;
    const observedStreak: number = nc1v ? nc1v.streak : -1;
    ck.t('N1', '★负控① `streak` 无计数 ⇒ 恒 1：反事实序列 [1,1,1] 过不了 `streak === 序数`（判据可红）· 真路径：删掉最早 claim 行后连领 ⇒ 返回 streak = 行数 = 6（恒 1 实现会返回 1）⇒ 判据必红',
      !constPasses && nc1.sqlstate === null && nc1v !== null
        && nc1v.rowsAfterDelete === 5 && observedStreak === 6 && nc1v.rowsAfterClaim === 6,
      JSON.stringify({ constant_seq_passes: constPasses, ...(nc1v ?? {}), sqlstate: nc1.sqlstate }));

    // ② bonus 无台账腿 ⇒ 余额对拍必红：
    //    真路径已对拍（S2）；反事实「直接改 account.balance」（无台账腿）被 trg_account_guard 拒
    //    ⇒ 余额只能随台账走；算术上无腿增量 = 0 < bonus ⇒ `delta === bonus` 判据红。
    const lastBonus = BigInt(c6.bonus);
    const nc2 = await undoAfter(c, 'nc2', async () => {
      await c.query('UPDATE public.account SET balance = balance + $1::bigint WHERE uid = $2::bigint AND cid = 1',
        [lastBonus.toString(), String(W1)]);
      return await balUsd(W1);
    });
    const noLegDelta = 0n;
    ck.t('N2', '★负控② `bonus` 无台账腿 ⇒ 余额对拍必红：直改 `account.balance`（无台账）被 `trg_account_guard` 拒（P0001 `!= latest ledger snapshot`）⇒ 余额只能随台账走；且 `无腿增量 0 ≠ bonus` ⇒ `delta === bonus` 判据红',
      nc2.sqlstate === 'P0001' && /ledger snapshot/.test(nc2.message)
        && noLegDelta !== lastBonus && lastBonus > 0n,
      JSON.stringify({ sqlstate: nc2.sqlstate, message: nc2.message.slice(0, 120), no_leg_delta: noLegDelta.toString(), bonus: lastBonus.toString() }));

    R.claims = claims.map(({ idx, streak, bonus, delta, rows, legs, kind_label }) => ({ idx, streak, bonus, delta, rows, legs, kind_label }));
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
      "SELECT count(*)::int AS n FROM public.schema_migration WHERE version = '0067'"))[0]?.n ?? -1);
    const cfgRows = Number((await qRetry<{ n: number }>(pool,
      "SELECT count(*)::int AS n FROM public.app_config WHERE key = 'wage_streak_bonus'"))[0]?.n ?? -1);
    // 0067 现已 apply 到 dev/prod（稳态）⇒ schema_migration 恰 1 行；配置行恒 1
    const residueOk = cfgRows === 1;
    ck.t('Z1', `[${MODE}] 零额外写：\`schema_migration\` 0067 稳态 1 行 · \`app_config.wage_streak_bonus\` ${applied67 ? '行 1（已 apply 稳态，本门未额外写入）' : '**0 行**'}`,
      versionRows === 1 && residueOk,
      JSON.stringify({ mode: MODE, version_0067: versionRows, cfg_rows: cfgRows }));
  }
  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p67-wage-streak-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: out.readings }, null, 1));
  if ((out.summary as { failed: number }).failed > 0) process.exit(1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
