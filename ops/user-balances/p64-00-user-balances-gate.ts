/**
 * p64-00 · 用户多币种余额读口 `GET /api/user/balances` 后端门
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p57/p58/p59b/p60/p61/p63/p65 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/user-balances/p64-00-user-balances-gate.ts
 * 读数：`ops/user-balances/readings/p64-user-balances-gate-<RUN>.json`
 *
 * 覆盖（Kevin 2026-10-20 需求：顶部菜单弹出层「积分」区改为多币种余额分行 + 没有的币种不显示）：
 *   A · 静态面（零 DB）：注册点 128（get 55 / post 66 / put 0 / delete 3 / patch 4）· 路由恰在场 1 次 ·
 *       注册在 catch-all 之前 · 闸 = `requireActor` 首句 · 私有缓存头 `private, no-store` + `Vary: Authorization` ·
 *       零新错误码（33）· 零新 kind（24）· 服务层纯 SELECT（无 INSERT/UPDATE/DELETE/DDL/upsert）·
 *       SQL 契约（`balance > 0` / `ORDER BY cid ASC` / `::text`）· 行键恰四键 · p7b-03 AC10-2 常量同步。
 *   B · 服务层真路径（同事务 · `ex` 注入 · 余额经 `postEvent` 铸造，**不直插 account**——`account_guard`
 *       要求新行 0/0、更新须与最新 `ledger_entry` 快照一致）：
 *       B1 余额 0 的币种**不出行**（cidZ）· B2 无 account 行的币种不出行（cidNA）· B3 cid **升序** ·
 *       B4 `$`（cid 1）恒首位 · B5 大数 `10000000000000001`（> 2^53）逐字 string，且自证 `Number()` 会变形 · B6 类型（cid number / balance string）·
 *       B7 行键恰四键 · B8 uid 作用域（他人余额不泄漏）· B9 无余额用户 ⇒ `[]` · B10 读口零写副作用（台账/账户行数不变）。
 *   H · HTTP 真链路（**进程内** `app.listen(0)` 临时端口，零端口占用冲突、零 5793–5799）：
 *       H1 未登录 ⇒ **401** `AUTH_UNAUTHORIZED`（R107 形状）· H2 坏 token ⇒ 401 ·
 *       H3 真 token 200 + `Cache-Control: private, no-store` + `Vary: Authorization` + 载荷与同 uid 服务层读数逐项一致 ·
 *       H4 **判负臂**：公开读口 `/api/currencies` 不得带 `no-store`（证明 H3 的头断言有分辨力）·
 *       H5 相邻路径 404（证明 H1 的 401 来自本路由而非 catch-all）。
 *   Z · 残留：回滚之后无本门夹具币种（`symbol LIKE 'qz%'` = 0）、无夹具账户（uid 区间 = 0）。
 *
 * 纪律：**不 apply、不写版本表**；一切夹具 DDL/DML 都在 `inRollbackTx` 内 ⇒ 零残留。
 *   凭据只读 `backend-ts/.env.local`（dev 库）。H3 会触发 `resolveActor` 成功出口的 `recordUserActivityHour`
 *   旁路 upsert（1 行、该 uid 当小时桶，产品既有行为，非本门夹具）—— 读数文件里显式披露。
 */
import * as fs from 'fs';
import * as path from 'path';
import type { AddressInfo } from 'net';
import { checker, inRollbackTx, mkPool, raw, raw1, qRetry } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import type { SqlRunner } from '../../backend-ts/src/database';
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
const DB_TS = readSrc('backend-ts/src/database.ts');
const P7B03 = readSrc('backend-ts/scripts/p7b-03-offline-gates.ts');

/** 路由处理体（从注册行起 1600 字符内；足够覆盖闸 + 缓存头 + 服务调用 + catch） */
const ROUTE_AT = INDEX_TS.indexOf("app.get('/api/user/balances'");
const ROUTE_BODY = ROUTE_AT === -1 ? '' : INDEX_TS.slice(ROUTE_AT, ROUTE_AT + 1600);
/** 服务方法体（到下一个 `static async` 之前） */
const SVC_AT = DB_TS.indexOf('static async listUserBalances(');
const SVC_BODY = SVC_AT === -1 ? '' : DB_TS.slice(SVC_AT, DB_TS.indexOf('static async ', SVC_AT + 10));

// ★ 大数臂取值：单笔金额有 DB 上限 `ledger_max_single_amount() = 1e15`（`0004`），
//   故「余额」用 **10 笔 1e15 + 1** 铸成 = 10000000000000001 —— 它**恰好**越过 double 的 2^53 安全整数区
//   （`Number('10000000000000001')` 会回 10000000000000000）⇒ 「balance 必须逐字 string」这条臂有分辨力，
//   拿 1e15 这种仍可精确表示的数是坏尺子（怎么读都过）。
const BIG = '10000000000000001';
const BIG_STEP = '1000000000000000'; // 1e15 = DB 单笔上限，逐笔凑到 BIG

const stripComments = (s: string) => s.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
const SVC_CODE = stripComments(SVC_BODY);

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };
  const pool = mkPool(2);

  // ====================================================================== A · 静态面（零 DB）
  const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;
  const regs = countVerb('get') + countVerb('post') + countVerb('put') + countVerb('delete') + countVerb('patch');
  ck.t(
    'A1',
    '注册点 = 128（127 + 本口 GET；get 55 / post 66 / put 0 / delete 3 / patch 4）',
    regs === 128 && countVerb('get') === 55 && countVerb('post') === 66
      && countVerb('put') === 0 && countVerb('delete') === 3 && countVerb('patch') === 4,
    `regs=${regs} get=${countVerb('get')} post=${countVerb('post')} put=${countVerb('put')} delete=${countVerb('delete')} patch=${countVerb('patch')}`,
  );
  ck.t('A2', '路由 `GET /api/user/balances` 恰注册 1 次', (INDEX_TS.match(/app\.get\('\/api\/user\/balances'/g) ?? []).length === 1,
    `hits=${(INDEX_TS.match(/app\.get\('\/api\/user\/balances'/g) ?? []).length}`);
  ck.t('A3', '注册在 catch-all `app.use((req, res) =>` **之前**（否则恒 404）',
    ROUTE_AT > 0 && ROUTE_AT < INDEX_TS.indexOf('app.use((req, res) => {'),
    `route=${ROUTE_AT} catchall=${INDEX_TS.indexOf('app.use((req, res) => {')}`);
  ck.t('A4', '闸 = `requireActor` 首句（缺 token / 坏 token / 查无此人 ⇒ 既有 401，零新错误码）',
    /const actor = await requireActor\(req, res\);\s*\n\s*if \(!actor\) return;/.test(ROUTE_BODY) && ROUTE_BODY.indexOf('requireActor') < ROUTE_BODY.indexOf('listUserBalances'),
    `requireActor_at=${ROUTE_BODY.indexOf('requireActor')} svc_at=${ROUTE_BODY.indexOf('listUserBalances')}`);
  ck.t('A5', '私有缓存头：`setPrivateNoStore(res)` + `Vary: Authorization` 两者都在处理体内',
    ROUTE_BODY.indexOf('setPrivateNoStore(res)') > 0 && /setHeader\('Vary', 'Authorization'\)/.test(ROUTE_BODY),
    `noStore=${ROUTE_BODY.indexOf('setPrivateNoStore(res)')} vary=${ROUTE_BODY.indexOf("setHeader('Vary', 'Authorization')")}`);
  ck.t('A6', '零新错误码：`LEDGER_ERROR_CODES` 仍 33 码闭集', LEDGER_ERROR_CODES.length === 33, `codes=${LEDGER_ERROR_CODES.length}`);
  ck.t('A7', '零新 kind：`LEDGER_KINDS` 仍 24 值（本口纯读，不写台账）', LEDGER_KINDS.length === 24, `kinds=${LEDGER_KINDS.length}`);
  ck.t('A8', '服务层纯 SELECT（DL23）：无 INSERT / UPDATE / DELETE / DDL / upsert / 懒开户',
    SVC_CODE.length > 0 && !/\b(INSERT|UPDATE|DELETE|create table|alter table|upsert)\b/i.test(SVC_CODE),
    `svc_len=${SVC_CODE.length}`);
  ck.t('A9', 'SQL 契约：`balance > 0` 过滤 · `ORDER BY cid ASC` · `balance::text` 字符串下发 · `account JOIN currency`',
    /"balance"\s*>\s*0/.test(SVC_BODY) && /ORDER BY a\."cid" ASC/.test(SVC_BODY)
      && /a\."balance"::text/.test(SVC_BODY) && /JOIN public\.currency/.test(SVC_BODY),
    `gt0=${/"balance"\s*>\s*0/.test(SVC_BODY)} order=${/ORDER BY a\."cid" ASC/.test(SVC_BODY)} cast=${/a\."balance"::text/.test(SVC_BODY)}`);
  ck.t('A10', '行键**恰四键** `cid` / `symbol` / `name` / `balance`（无 spread、无多余键）',
    /return rows\.map\(\(row\) => \(\{\s*\n\s*cid: Number\(row\.cid\),\s*\n\s*symbol: String\(row\.symbol \?\? ''\),\s*\n\s*name: String\(row\.name \?\? ''\),\s*\n\s*balance: String\(row\.balance \?\? '0'\),\s*\n\s*\}\)\);/.test(SVC_BODY),
    `mapper_ok=${/cid: Number\(row\.cid\)/.test(SVC_BODY) && /balance: String\(row\.balance/.test(SVC_BODY)}`);
  ck.t('A11', '`p7b-03` 的 AC10-2 常量已同步前推（`regs === 128` 且文案写 128）',
    /ck\.t\('AC10-2'[\s\S]{0,900}regs === 128/.test(P7B03) && P7B03.indexOf('注册点 = 128') > 0,
    `const_ok=${/regs === 128/.test(P7B03)}`);

  // ====================================================================== B · 服务层真路径（回滚事务 · ex 注入）
  const uidBase = 990_000_000 + Number(String(Date.now()).slice(-6));
  const symA = `qz${RUN.slice(-6)}a`.toLowerCase();
  const symB = `qz${RUN.slice(-6)}b`.toLowerCase();
  const symZ = `qz${RUN.slice(-6)}z`.toLowerCase();
  const symNA = `qz${RUN.slice(-6)}n`.toLowerCase();

  const tx = await inRollbackTx(pool, async (c: Qx) => {
    const R: Record<string, unknown> = {};
    const ex = c as unknown as SqlRunner;

    // ---- 夹具：两个用户 + 四个币种（A/B 有余额、Z 余额 0、NA 无 account 行）
    const uid1 = uidBase;
    const uid2 = uidBase + 1;
    const mkUser = async (uid: number, tag: string) => {
      await raw(c,
        `INSERT INTO public.users (uid, evm, bio) VALUES ($1::bigint, $2, $3)`,
        [String(uid), '0x' + (RUN + tag + String(uid)).replace(/[^0-9a-f]/gi, '').toLowerCase().padEnd(40, '0').slice(0, 40), `p64-gate ${RUN}`]);
    };
    await mkUser(uid1, 'a');
    await mkUser(uid2, 'b');

    const maxCid = Number((await raw1<{ m: string }>(c, 'SELECT GREATEST(COALESCE(MAX(cid), 1000), 1000) AS m FROM public.currency'))!.m);
    const cidA = maxCid + 1;
    const cidB = maxCid + 2;
    const cidZ = maxCid + 3;
    const cidNA = maxCid + 4;
    const mkCur = async (cid: number, symbol: string, name: string) => {
      // 两条硬约束（都踩过）：
      //   ① status 必须 **listed**：`mint` 只对可铸币种放行（draft ⇒ 403 `LEDGER_UNAUTHORIZED_MINT`）；
      //   ② `owner_uid` + 必须取 **0（平台币）**：`owner_uid > 0` 的币种只允许 owner 自铸
      //      （`0004:595` R23）⇒ owner 取夹具 uid 时，给第二个用户铸同一币种必被 403。
      await raw(c,
        `INSERT INTO public.currency (cid, symbol, name, owner_uid, decimals, total_supply, status, listed_at)
         VALUES ($1::bigint, $2, $3, 0::bigint, 0, 0, 'listed', now())`,
        [String(cid), symbol, name]);
    };
    await mkCur(cidA, symA, `p64 gate ${symA}`);
    await mkCur(cidB, symB, `p64 gate ${symB}`);
    await mkCur(cidZ, symZ, `p64 gate ${symZ}`);
    await mkCur(cidNA, symNA, `p64 gate ${symNA}`);

    // account 新行必须 0/0（account_guard）⇒ 只建零行，余额一律经 postEvent 铸造
    const mkAcct = async (uid: number, cid: number) => {
      await raw(c, 'INSERT INTO public.account (uid, cid, balance, frozen) VALUES ($1::bigint, $2::bigint, 0, 0)', [String(uid), String(cid)]);
    };
    for (const cid of [1, cidA, cidB, cidZ]) await mkAcct(uid1, cid);
    await mkAcct(uid2, cidA);

    // ★ 故意**逆序**铸造（先 B 后 A）⇒ 若 ORDER BY 缺失/写反，B3 必红
    await postEvent({ op: 'mint', uid: String(uid1), cid: String(cidB), amount: '2345', platform: true,
      idempotencyKey: `ops:p64-gate:${RUN}:mint-b`, memo: 'p64-gate fixture B', ex });
    // 10 笔 1e15 + 1 ⇒ 越过 2^53 安全整数区（单笔受 DB 上限 1e15 约束，不能一笔到位）
    for (let i = 0; i < 10; i += 1) {
      await postEvent({ op: 'mint', uid: String(uid1), cid: String(cidA), amount: BIG_STEP, platform: true,
        idempotencyKey: `ops:p64-gate:${RUN}:mint-a${i}`, memo: 'p64-gate fixture A(step)', ex });
    }
    await postEvent({ op: 'mint', uid: String(uid1), cid: String(cidA), amount: '1', platform: true,
      idempotencyKey: `ops:p64-gate:${RUN}:mint-a-tail`, memo: 'p64-gate fixture A(tail +1)', ex });
    await postEvent({ op: 'mint', uid: String(uid1), cid: '1', amount: '999', platform: true,
      idempotencyKey: `ops:p64-gate:${RUN}:mint-usd`, memo: 'p64-gate fixture $', ex });
    await postEvent({ op: 'mint', uid: String(uid2), cid: String(cidA), amount: '7777', platform: true,
      idempotencyKey: `ops:p64-gate:${RUN}:mint-uid2`, memo: 'p64-gate fixture other uid', ex });

    const ledgerBefore = Number((await raw1<{ n: string }>(c,
      `SELECT count(*) AS n FROM public.ledger_entry WHERE uid = $1::bigint`, [String(uid1)]))!.n);

    // ---- 被测：真路径（同一条 SQL 与生产共用）
    const rows = await DatabaseService.listUserBalances(uid1, ex);
    const empty = await DatabaseService.listUserBalances(uidBase + 2, ex);
    const other = await DatabaseService.listUserBalances(uid2, ex);

    const ledgerAfter = Number((await raw1<{ n: string }>(c,
      `SELECT count(*) AS n FROM public.ledger_entry WHERE uid = $1::bigint`, [String(uid1)]))!.n);
    const acctAfter = Number((await raw1<{ n: string }>(c,
      `SELECT count(*) AS n FROM public.account WHERE uid = $1::bigint`, [String(uid1)]))!.n);

    R.fixture = { uid1: String(uid1), uid2: String(uid2), cidA, cidB, cidZ, cidNA, symA, symB, symZ, symNA, big: BIG };
    R.rows = rows;
    R.other_rows = other;
    R.empty_rows = empty;
    R.ledger_before = ledgerBefore;
    R.ledger_after = ledgerAfter;
    R.account_rows = acctAfter;
    return R;
  }, 3);

  if (tx.error || !tx.result) {
    ck.t('B0', '服务层夹具事务执行成功', false, `error=${String((tx.error as { message?: string })?.message ?? tx.error).slice(0, 200)}`);
    out.tx_error = String((tx.error as { message?: string })?.message ?? tx.error ?? '');
  } else {
    const R = tx.result as Record<string, any>;
    const rows = R.rows as Array<{ cid: number; symbol: string; name: string; balance: string }>;
    const { cidA, cidB, cidZ, cidNA, uid1, uid2 } = R.fixture;
    const cids = rows.map((r) => r.cid);
    ck.t('B0', '服务层夹具事务执行成功（余额经 `postEvent` 铸造，account 由 0/0 起）', true, `rows=${rows.length}`);
    ck.t('B1', `余额 0 的币种**不出行**（cidZ=${cidZ} 在 account 有行但为 0）`, !cids.includes(cidZ), `cids=${JSON.stringify(cids)}`);
    ck.t('B2', `无 account 行的币种不出行（cidNA=${cidNA}）`, !cids.includes(cidNA), `cids=${JSON.stringify(cids)}`);
    ck.t('B3', 'cid **升序**（逆序铸造后仍按 cid 排；缺失/写反必红）',
      JSON.stringify(cids) === JSON.stringify([...cids].sort((a, b) => a - b)) && cids.length === 3,
      `cids=${JSON.stringify(cids)}`);
    ck.t('B4', '`$`（cid 1）恒首位', cids[0] === 1, `first=${cids[0]}`);
    ck.t('B5', `大数逐字：cidA 余额 === "${BIG}"（string，未经过 Number；该值 Number() 会变形 ⇒ 臂有分辨力）`,
      rows.find((r) => r.cid === cidA)?.balance === BIG && String(Number(BIG)) !== BIG,
      `got=${JSON.stringify(rows.find((r) => r.cid === cidA)?.balance)} number_roundtrip=${String(Number(BIG))}`);
    ck.t('B6', '类型：`cid` = number · `balance` = string · `symbol`/`name` = 非空 string',
      rows.every((r) => typeof r.cid === 'number' && typeof r.balance === 'string' && typeof r.symbol === 'string' && String(r.symbol).length > 0
        && typeof r.name === 'string' && String(r.name).length > 0),
      `types=${JSON.stringify(rows.map((r) => [typeof r.cid, typeof r.balance]))}`);
    ck.t('B7', '行键**恰四键**（cid / symbol / name / balance；零多余键）',
      rows.every((r) => JSON.stringify(Object.keys(r).sort()) === JSON.stringify(['balance', 'cid', 'name', 'symbol'])),
      `keys=${JSON.stringify(rows.map((r) => Object.keys(r).sort()))}`);
    ck.t('B8', 'uid 作用域：他人账户余额不泄漏（uid2 的 cidA = 7777，与本 uid 的 bigint 上限不同源）',
      JSON.stringify((R.other_rows as typeof rows).map((r) => [r.cid, r.balance])) === JSON.stringify([[cidA, '7777']])
        && rows.find((r) => r.cid === cidA)?.balance === BIG,
      `other=${JSON.stringify(R.other_rows)}`);
    ck.t('B9', '无余额用户 ⇒ `[]`（不是 null、不是 500）', Array.isArray(R.empty_rows) && (R.empty_rows as unknown[]).length === 0,
      `empty=${JSON.stringify(R.empty_rows)}`);
    ck.t('B10', '读口**零写副作用**：台账条数不变、账户行数不变',
      R.ledger_before === R.ledger_after && R.account_rows === 4,
      `ledger ${R.ledger_before}→${R.ledger_after} account=${R.account_rows}`);
    out.fixture = R.fixture;
    out.rows = rows;
    out.other_rows = R.other_rows;
    out.empty_rows = R.empty_rows;
    void uid1; void uid2;
  }

  // ====================================================================== H · HTTP 真链路（进程内临时端口）
  let server: { close: (cb?: () => void) => void } | null = null;
  try {
    process.env.VERCEL = '1'; // 阻止 index.ts 自行 listen（否则会与面板 5788 抢端口）
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const app = require('../../backend-ts/src/index').default;
    // auth 必须在 index（其首行 import './env'）之后加载，否则 SECRET_KEY 未注入会 process.exit(1)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createSessionToken } = require('../../backend-ts/src/auth');

    const listening = app.listen(0, '127.0.0.1');
    server = listening;
    await new Promise<void>((resolve) => listening.once('listening', () => resolve()));
    const port = (listening.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}`;
    const doFetch = (globalThis as unknown as {
      fetch: (u: string, i?: unknown) => Promise<{ status: number; headers: { get(n: string): string | null }; json: () => Promise<any> }>;
    }).fetch;

    const noAuth = await doFetch(`${base}/api/user/balances`);
    const noAuthBody = await noAuth.json();
    ck.t('H1', '未登录 ⇒ **401** `AUTH_UNAUTHORIZED`（R107 形状：code / message / i18n_key / details）',
      noAuth.status === 401 && noAuthBody?.error?.code === 'AUTH_UNAUTHORIZED'
        && noAuthBody?.error?.i18n_key === 'auth.err.AUTH_UNAUTHORIZED'
        && typeof noAuthBody?.error?.message === 'string' && typeof noAuthBody?.error?.details === 'object',
      `status=${noAuth.status} body=${JSON.stringify(noAuthBody).slice(0, 160)}`);

    const badAuth = await doFetch(`${base}/api/user/balances`, { headers: { Authorization: 'Bearer not-a-jwt' } });
    const badBody = await badAuth.json();
    ck.t('H2', '坏 token ⇒ 401（同码，零新错误码）', badAuth.status === 401 && badBody?.error?.code === 'AUTH_UNAUTHORIZED',
      `status=${badAuth.status} code=${badBody?.error?.code}`);

    // 优先取「确有余额」的真用户（否则载荷为空、H3 变成 vacuous 臂，判据没有分辨力）
    const withBal = await qRetry<{ uid: string; evm: string; n: string }>(pool,
      `SELECT u.uid::text AS uid, u.evm, count(a.cid)::text AS n
         FROM public.users AS u
         JOIN public.account AS a ON a.uid = u.uid AND a.balance > 0
        WHERE u.evm ~ '^0x[0-9a-f]{40}$'
        GROUP BY u.uid, u.evm
        ORDER BY count(a.cid) DESC, u.uid ASC
        LIMIT 1`);
    const realUser = withBal.length ? withBal : await qRetry<{ uid: string; evm: string; n: string }>(pool,
      `SELECT uid::text AS uid, evm, '0' AS n FROM public.users WHERE evm ~ '^0x[0-9a-f]{40}$' ORDER BY uid ASC LIMIT 1`);
    if (!realUser.length) {
      ck.t('H3', '真 token 200（**环境性跳过**：dev 库无可用 users 行）', false, 'no_real_user（ENV_LIMITED）');
    } else {
      const uid = Number(realUser[0].uid);
      const token = createSessionToken({ uID: uid, evm: realUser[0].evm });
      const ok = await doFetch(`${base}/api/user/balances`, { headers: { Authorization: `Bearer ${token}` } });
      const body = await ok.json();
      const cc = String(ok.headers.get('cache-control') ?? '').toLowerCase();
      const vary = String(ok.headers.get('vary') ?? '').toLowerCase();
      const svc = await DatabaseService.listUserBalances(uid);
      const okRows = Array.isArray(body?.data) ? body.data : [];
      ck.t('H3', '真 token ⇒ 200 + `Cache-Control: private, no-store` + `Vary: Authorization` + 载荷与同 uid 服务层读数逐项一致',
        ok.status === 200 && body?.success === true && Array.isArray(body?.data)
          && cc.includes('private') && cc.includes('no-store') && vary.includes('authorization')
          && JSON.stringify(okRows) === JSON.stringify(svc)
          && okRows.every((r: any) => typeof r.balance === 'string' && typeof r.cid === 'number')
          && JSON.stringify(okRows.map((r: any) => r.cid)) === JSON.stringify([...okRows.map((r: any) => r.cid)].sort((a: number, b: number) => a - b))
          && (Number(realUser[0].n) > 0 ? okRows.length > 0 : true),
        `status=${ok.status} cc="${cc}" vary="${vary}" rows=${okRows.length} svc=${svc.length} same=${JSON.stringify(okRows) === JSON.stringify(svc)} real_balance_cids=${realUser[0].n}`);
      out.http = { uid: String(uid), status: ok.status, cache_control: cc, vary, rows: okRows, real_balance_cids: realUser[0].n };
      out.http_note = 'H3 触发 `resolveActor` 的 `recordUserActivityHour` 旁路 upsert（1 行该 uid 当小时桶，产品既有行为）';
    }

    // H4 判负臂：公开读口不得带 no-store（否则 H3 的头断言无分辨力）
    const pub = await doFetch(`${base}/api/currencies`);
    const pubCC = String(pub.headers.get('cache-control') ?? '').toLowerCase();
    ck.t('H4', '判负臂：公开读口 `/api/currencies` 的 `Cache-Control` **不含** `no-store`（证明 H3 头断言有分辨力）',
      pub.status === 200 && !pubCC.includes('no-store'), `status=${pub.status} cc="${pubCC}"`);

    // H4b 同族判负臂：公开 feed 走**共享缓存**（`public`）⇒ 证明「私有头」是本口专属、不是全局如此
    const feed = await doFetch(`${base}/api/prize/all?skip=0&limit=1`);
    const feedCC = String(feed.headers.get('cache-control') ?? '').toLowerCase();
    ck.t('H4b', '判负臂：公开 feed `/api/prize/all` 的 `Cache-Control` 含 `public` 且**不含** `no-store`（与 H3 恰相反）',
      feed.status === 200 && feedCC.includes('public') && !feedCC.includes('no-store'), `status=${feed.status} cc="${feedCC}"`);

    const near = await doFetch(`${base}/api/user/balancesX`, { headers: { Authorization: `Bearer ${'x.y.z'}` } });
    ck.t('H5', '相邻路径 ⇒ 404（证明 H1 的 401 来自本路由而非 catch-all）', near.status === 404, `status=${near.status}`);
  } catch (error) {
    ck.t('H0', 'HTTP 腿可跑（进程内 app.listen(0)）', false, `error=${String((error as { message?: string })?.message ?? error).slice(0, 200)}`);
  } finally {
    if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  }

  // ====================================================================== Z · 残留（回滚之后）
  try {
    const leftCur = await qRetry<{ n: string }>(pool, `SELECT count(*) AS n FROM public.currency WHERE symbol LIKE 'qz%'`);
    const leftAcct = await qRetry<{ n: string }>(pool,
      `SELECT count(*) AS n FROM public.account WHERE uid BETWEEN $1::bigint AND $2::bigint`, [String(uidBase), String(uidBase + 2)]);
    const leftUser = await qRetry<{ n: string }>(pool,
      `SELECT count(*) AS n FROM public.users WHERE bio LIKE 'p64-gate%'`);
    ck.t('Z1', '零残留：无本门夹具币种（`symbol LIKE qz%`）', Number(leftCur[0].n) === 0, `currency=${leftCur[0].n}`);
    ck.t('Z2', '零残留：无夹具账户行（uid 区间）', Number(leftAcct[0].n) === 0, `account=${leftAcct[0].n}`);
    ck.t('Z3', '零残留：无夹具用户（bio 标记）', Number(leftUser[0].n) === 0, `users=${leftUser[0].n}`);
  } catch (error) {
    ck.t('Z0', '残留复核可跑', false, `error=${String((error as { message?: string })?.message ?? error).slice(0, 160)}`);
  }

  await pool.end();
  const summary = ck.summary();
  const file = save('p64-user-balances-gate', { ...out, checks: ck.checks, summary });
  console.log(JSON.stringify(summary, null, 2));
  console.log(`[readings] ${file}`);
  process.exit(summary.failed === 0 ? 0 : 2);
})().catch((error) => {
  console.error('[p64 gate] fatal:', error);
  process.exit(1);
});
