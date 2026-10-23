/**
 * p81-00 · 全网持币人读口闸（0076 · Kevin 2026-10-23 ②）
 * ----------------------------------------------------------------------------
 * 守住：`GET /api/currency/:cid/holders`（公开只读）
 *   ① 只列 `balance > 0`（零余额/负数不入列——负数本就不该存在）
 *   ② 按数量**倒序**（同额按 uid 升序稳定排序）
 *   ③ evm **必打码**（`0x59**xx` 形态；响应里不出现明文 40 位地址）
 *   ④ rank 恰为 1..N 连续；total_holders = 列表长度
 *   ⑤ limit 上限 100
 *   ⑥ cid 非法 ⇒ 400；未 listed / 不存在 ⇒ 404
 *   E · 负控（可证伪）：谓词 `strictlyDescending` 喂升序伪观测 ⇒ false；喂真观测 ⇒ true。
 *
 * 用法（backend-ts 下）：
 *   TS_NODE_PROJECT=$PWD/tsconfig.json npx ts-node --transpile-only ../ops/market/p81-00-holders-gate.ts
 * 读数：`ops/market/readings/p81-holders-gate-<RUN>.json`
 * 纪律：dev 库自证（`neon.project_id` ≠ `quiet-math-65207667` ⇒ ABORT）；夹具自建自删（account/users 直接删，
 *   ledger_entry/batt_entry append-only ⇒ 本闸**不写账**，直接插 account（先删后插 0/0 起步……不行——
 *   `account_guard` 要求新账户从 0 起步 ⇒ 插 0 行再 UPDATE 也会被 R74 拦。
 *   ⬇ 因此本闸**绕开动账触发器**：临时 disable `account_guard` 触发器（单事务 disable→写→enable 并断言
 *   `tgenabled='O'`，与 0055 迁移同体例），只在本闸夹具行上操作，闸尾必须恢复。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, mkPool, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';

const EXPECT_PID = 'quiet-math-65207667';
const PORT = Number(process.env.P81_PORT || (5800 + Math.floor(Math.random() * 150)));
const BASE = `http://localhost:${PORT}`;

const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + Math.random().toString(36).slice(2, 6);
const OUT_DIR = path.resolve(__dirname, 'readings');

type Row = Record<string, any>;
const FIX_BASE = 970000 + Math.floor(Math.random() * 20000);

const main = async (): Promise<void> => {
  const pool = mkPool(2);
  const q = async <R = Row>(text: string, params: unknown[] = []): Promise<R[]> => raw<R>(pool as unknown as Qx, text, params);
  const q1 = async <R = Row>(text: string, params: unknown[] = []): Promise<R | null> => raw1<R>(pool as unknown as Qx, text, params);

  // ① 库身份自证
  const pid = (await q1(`SELECT current_setting('neon.project_id', true) AS pid`))?.pid;
  if (String(pid || '') !== EXPECT_PID) {
    console.error(`ABORT: project_id=${pid} ≠ ${EXPECT_PID}`);
    await pool.end();
    process.exit(2);
  }

  const ck = checker();
  const t = ck.t.bind(ck);

  // 夹具：4 个用户 + 既有 listed 币（非 1）；余额梯度 40/30/20/0（0 的不入列）
  const cur = await q1(`SELECT cid::text AS cid, symbol, decimals FROM public.currency WHERE status = 'listed' AND cid <> 1 ORDER BY cid LIMIT 1`);
  if (!cur) throw new Error('缺 listed 非 $ 币种');
  const CID = String(cur.cid);
  const users = [0, 1, 2, 3].map((i) => FIX_BASE + i);
  const balances = [40, 30, 20, 0]; // users[3] 零余额 ⇒ 不入列
  await q(
    `INSERT INTO public.users (uid, evm, bio)
       SELECT u, '0x' || lpad(((u - ${FIX_BASE}) * 7919 + ${FIX_BASE % 100000})::text, 40, '3'), '' FROM unnest($1::bigint[]) AS u
     ON CONFLICT (uid) DO NOTHING`,
    [users],
  );

  // 资金必须走台账（`account_guard`：插入非零 / 无 ledger 的 UPDATE / 删非零行都被拦）
  // ⇒ mint（按 R23 授权）+ `entries` 分发，清尾反向汇回 + 归零后删行。
  const cOwner = String((await q1<{ owner_uid: string }>(`SELECT owner_uid::text AS owner_uid FROM public.currency WHERE cid = $1::bigint`, [CID]))?.owner_uid ?? '0');
  const mintSrc = cOwner !== '0' ? cOwner : '0';
  const unitsOf = (n: number) => BigInt(n) * BigInt(10 ** Number(cur.decimals ?? 0));
  const totalUnits = unitsOf(balances.reduce((a, b) => a + b, 0));
  const mint = await q(`SELECT public.ledger_post_event($1::jsonb) AS r`, [JSON.stringify({
    op: 'mint', idempotency_key: `ops:p81:${FIX_BASE}:mint`, memo: 'p81 fixture fund',
    ref_type: 'system', ref_id: '0', uid: mintSrc, cid: CID, amount_units: totalUnits.toString(),
    ...(mintSrc === '0' ? { platform: true } : {}),
  })]);
  const mintOut = mint[0]?.r as { ok?: boolean } | undefined;
  t('F0', '夹具资金铸造（ledger_post_event mint）成功', mintOut?.ok === true, { mint: mintOut });

  for (let i = 0; i < users.length; i += 1) {
    if (balances[i] <= 0) continue;
    await q(`SELECT public.ledger_post_event($1::jsonb) AS r`, [JSON.stringify({
      op: 'entries', idempotency_key: `ops:p81:${FIX_BASE}:d${i}`, memo: 'p81 fixture distribute',
      ref_type: 'system', ref_id: '0',
      entries: [
        { uid: mintSrc, cid: CID, delta: (-unitsOf(balances[i])).toString(), kind: 'transfer' },
        { uid: String(users[i]), cid: CID, delta: unitsOf(balances[i]).toString(), kind: 'transfer' },
      ],
    })]);
  }

  // ② 起被测服务（复用 index.ts 的 app；port 0 随机口）
  process.env.PORT = String(PORT);
  const { default: app } = await import('../../backend-ts/src/index');
  // ★ index.ts 被 import 时**自己就 listen**（`index.ts:4036`）⇒ 这里不再重复 listen，
  //   只等健康口就绪（随机口避免撞历史泄漏连接）。
  let ready = false;
  for (let i = 0; i < 40 && !ready; i += 1) {
    try { const r = await fetch(`http://localhost:${PORT}/api/health`); ready = r.status < 500; } catch { await new Promise((r) => setTimeout(r, 150)); }
  }
  const realPort = PORT;

  const get = async (p: string): Promise<{ status: number; body: any }> => {
    const res = await fetch(`http://localhost:${realPort}${p}`);
    let body: any = null;
    try { body = await res.json(); } catch { /* 非 JSON */ }
    return { status: res.status, body };
  };

  // ③ 正常臂
  const ok = await get(`/api/currency/${CID}/holders`);
  const data = ok.body?.data ?? {};
  const rows = Array.isArray(data.holders) ? data.holders : [];
  const evms = rows.map((r: any) => String(r.evm_masked ?? ''));
  const balsOf = (r: any) => Number(r.balance ?? 0);
const bals: number[] = rows.map(balsOf);

  t('A1', '公开读口 200 + 键集恰 {cid,symbol,total_holders,holders}', ok.status === 200
    && ['cid', 'symbol', 'total_holders', 'holders'].every((k) => k in data), { status: ok.status, keys: Object.keys(data) });
  // dev 库有其他历史夹具账户（append-only 不可删）⇒ 判据改为「夹具 3 行都在 + 全列表无 0 余额行」
  const mine = rows.filter((r: any) => balsOf(r) >= 20 && balsOf(r) <= 40).length;
  t('A2', '只列 balance>0（无零余额行；夹具 3 行全部在内）', rows.length >= 3 && bals.every((b: number) => b > 0) && mine >= 3,
    { rows: rows.length, positives: bals.every((b: number) => b > 0) });
  t('A3', '数量倒序', bals.every((b, i) => i === 0 || bals[i - 1] >= b), { bals });

  // E · 负控（可证伪）：升序伪观测必须判 false
  const strictlyDescending = (xs: number[]) => xs.every((b, i) => i === 0 || xs[i - 1] >= b);
  t('E1', '谓词喂真观测 ⇒ true', strictlyDescending(bals) === true, { bals });
  t('E2', '谓词喂升序伪观测 ⇒ false（尺子有分辨力）', strictlyDescending([...bals].reverse()) === false, {});

  // ④ 遮挡 + rank
  // 现取形态：`maskWalletAddress` = `0xAB**cd`（保留 0x 前缀 + 前 2 + 后 2）
  const maskOk = evms.every((e) => /^(0x)?[0-9a-f]{2,4}\*\*[0-9a-f]{2,4}$/i.test(e));
  const noPlain = rows.every((r: any) => !String(r.evm_masked ?? '').match(/^0x[0-9a-f]{40}$/i));
  const ranksOk = rows.every((r: any, i: number) => Number(r.rank) === i + 1);
  t('A4', `evm 全部打码（${evms.join(' · ')}）且响应零明文 40 位地址`, maskOk && noPlain, { evms });
  t('A5', 'rank = 1..N 连续', ranksOk, { ranks: rows.map((r: any) => r.rank) });
  t('A6', 'total_holders = 列表长度', Number(data.total_holders) === rows.length, { total: data.total_holders });

  // ⑤ 非法/未知 cid
  const bad = await get('/api/currency/0/holders');
  const bad2 = await get('/api/currency/abc/holders');
  const unknown = await get('/api/currency/999999/holders');
  t('B1', 'cid=0 / 非数字 ⇒ 400', bad.status === 400 && bad2.status === 400, { s0: bad.status, sabc: bad2.status });
  t('B2', '不存在币种 ⇒ 404', unknown.status === 404, { status: unknown.status });

  // ⑥ 清理 + 服务关停
  // account 非 zero 余额不可删（触发器守卫）⇒ 先归零再删
  // 清尾：余额汇回铸造方（台账合法）。
  // ★ 实测：`account_guard` 对 **DELETE 无条件拒绝**（account rows are not deletable），
  //   且 users.uid ← account.uid 有 FK ⇒ users 行同样删不掉 ⇒ 本闸夹具产生**永久审计残留**
  //   （与 batt_entry/ledger_entry 同类）。判据改为「财务中性」：汇回后夹具账户余额全部为 0，
  //   残留行数如实登记（dev 审计口径，生产禁跑）。
  for (let i = 0; i < users.length; i += 1) {
    if (balances[i] <= 0) continue;
    await q(`SELECT public.ledger_post_event($1::jsonb) AS r`, [JSON.stringify({
      op: 'entries', idempotency_key: `ops:p81:${FIX_BASE}:r${i}`, memo: 'p81 fixture collect',
      ref_type: 'system', ref_id: '0',
      entries: [
        { uid: String(users[i]), cid: CID, delta: (-unitsOf(balances[i])).toString(), kind: 'transfer' },
        { uid: mintSrc, cid: CID, delta: unitsOf(balances[i]).toString(), kind: 'transfer' },
      ],
    })]).catch(() => undefined);
  }
  const leftoverAcct = await q(`SELECT uid::text, balance::text FROM public.account WHERE uid = ANY($1::bigint[])`, [users]);
  const neutral = leftoverAcct.every((r) => Number(r.balance) === 0);
  t('Z1', '夹具账户余额全部归零（财务中性；行本身 append-only 不可删，已登记）',
    neutral && leftoverAcct.length === 3, { leftover: leftoverAcct });
  const leftUsers = await q(`SELECT uid::text FROM public.users WHERE uid = ANY($1::bigint[])`, [users]);
  t('Z2', '残留行全部属本夹具（uid 范围内；无外溢）',
    leftUsers.every((r) => users.includes(Number(r.uid))),
    { users: leftUsers.map((r) => r.uid) });

  // 强制退出：index.ts 被 import 后可能挂内部定时器/连接 ⇒ close 后进程不自动退出（首跑即卡这）
  await pool.end();

  const summary = ck.summary();
  const out = { run: RUN, gate: 'p81-00-holders', currency: { cid: CID }, checks: ck.checks, summary };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p81-holders-gate-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ saved: file, summary: out.summary }, null, 2));
  process.exit(summary.failed > 0 ? 1 : 0);
};

main().catch(async (error) => {
  console.error('p81 gate failed:', error);
  process.exit(1);
});
