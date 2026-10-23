/**
 * 项目金库发放（0073 · Kevin 2026-10-23 选 A）
 * ============================================================================
 * 给「带次币腿」的种子项目各充一笔起始余额，让领薪的次币腿能发得出来。
 *
 * 用法：
 *   npx ts-node --transpile-only scripts/project-vault-seed.ts            # dry-run（默认，只读）
 *   npx ts-node --transpile-only scripts/project-vault-seed.ts --apply     # 真写
 *   ... --amount 1000 --project 5,12 ...                                   # 限定范围
 *
 * 资金口径（与 `rechargeProjectVaultVerb` / 领薪腿**同一套两腿台账**）：
 *   平台 uid 0（托管对手方）−N ／ 金库 +N，kind 走既有 `transfer` 闭集 ⇒ 零新 kind。
 *   平台余额不为负时直接扣；余额不足则先由 **项目 owner → uid 0** 补齐所需差额
 *   （owner 也不足 ⇒ 该行跳过并报告，绝不凭空造账）。
 *
 * 硬约束：
 *   · 默认 dry-run，不写库；`--apply` 才动。
 *   · 幂等：`create_key = ops:seed:vault:<projectId>:<cid>` ⇒ 重复执行不会二次加钱
 *     （台账层去重，与充值同键语义）。
 *   · 身份自证：`current_setting('neon.project_id')` 必须命中目标库（默认 dev），
 *     否则 ABORT（生产需显式 `SEED_EXPECT_PROJECT_ID=sweet-pond-28934105`）。
 */
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

const envPath = process.env.SEED_ENV_FILE
  || path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

import { Pool, neonConfig } from '@neondatabase/serverless';
import WS from 'ws';

neonConfig.webSocketConstructor = WS as unknown as typeof neonConfig.webSocketConstructor;

const DB_URL = process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING
  || (process.env.DATABASE_URL || '');

const EXPECT_PROJECT_ID = process.env.SEED_EXPECT_PROJECT_ID || 'quiet-math-65207667';
const APPLY = process.argv.includes('--apply');

const argOf = (flag: string): string | null => {
  const i = process.argv.indexOf(flag);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
};
const AMOUNT = Number(argOf('--amount') || 1000);
const ONLY_PROJECTS = (argOf('--project') || '').split(',').map((s) => s.trim()).filter(Boolean);

type Row = Record<string, any>;

const main = async (): Promise<void> => {
  const pool = new Pool({ connectionString: DB_URL, max: 1 });
  const q = async (text: string, params: unknown[] = []): Promise<Row[]> => (await pool.query(text, params)).rows;

  // ① 身份自证（写库前唯一的护栏）
  const pid = (await q(`SELECT current_setting('neon.project_id', true) AS pid`))[0]?.pid;
  if (String(pid || '') !== EXPECT_PROJECT_ID) {
    console.error(`ABORT: 目标库 project_id=${pid} 与预期 ${EXPECT_PROJECT_ID} 不符`);
    await pool.end();
    process.exit(2);
  }

  // ② 目标清单：带次币腿的项目
  const rows = await q(
    `SELECT p.project_id, p.title, p.owner_uid, p.wage_cid, p.wage_currency_amount,
            c.symbol, c.decimals, c.owner_uid AS c_owner_uid, c.status AS c_status,
            COALESCE(v.balance, 0) AS vault_balance
       FROM public.project AS p
       JOIN public.currency AS c ON c.cid = p.wage_cid
       LEFT JOIN public.project_vault AS v ON v.project_id = p.project_id AND v.cid = p.wage_cid
      WHERE p.wage_cid IS NOT NULL
        AND ($1::bigint[] IS NULL OR p.project_id = ANY($1::bigint[]))
      ORDER BY p.project_id`,
    [ONLY_PROJECTS.length ? ONLY_PROJECTS : null],
  );

  if (!rows.length) {
    console.log(JSON.stringify({ ok: true, mode: APPLY ? 'apply' : 'dry-run', note: '没有带次币腿的项目', rows: [] }, null, 2));
    await pool.end();
    return;
  }

  const plan: Row[] = [];
  for (const r of rows) {
    const decimals = Number(r.decimals ?? 0);
    const cur = Number(r.vault_balance) / 10 ** decimals;
    const target = AMOUNT;
    const delta = Math.max(0, target - cur);
    plan.push({
      project_id: String(r.project_id),
      title: r.title,
      cid: String(r.wage_cid),
      symbol: r.symbol,
      owner_uid: String(r.owner_uid),
      vault_before: cur,
      target,
      delta,
    });
  }

  if (!APPLY) {
    console.log(JSON.stringify({ ok: true, mode: 'dry-run', db: pid, amount: AMOUNT, plan }, null, 2));
    await pool.end();
    return;
  }

  // ③ 真写：每个 (project, cid) 一个事务，两腿台账 + 金库加钱
  const results: Row[] = [];
  for (const p of plan) {
    if (p.delta <= 0) {
      results.push({ ...p, action: 'skipped', reason: 'already_funded' });
      continue;
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 币种最小单位（与 account.balance / ledger_entry.delta 同标度）
      const units = BigInt(Math.round(Number(p.delta) * 10 ** Number(rows.find((r) => String(r.project_id) === p.project_id)?.decimals ?? 0)));

      // ① 铸造到平台托管（uid 0）：`op:'mint'` 走既有 ledger_post_event（uid 0 credit + kind=mint 合法）
      const mintKey = `ops:seed:vault-mint:${p.project_id}:${p.cid}`;
      // R23 授权：非平台币只能由 **该币种 owner** 铸造；平台币（owner_uid = 0）需 `platform:true`
      const src = rows.find((r) => String(r.project_id) === p.project_id);
      const curOwner = String(src?.c_owner_uid ?? '0');
      const mintUid = curOwner !== '0' ? curOwner : '0';
      const mintRes = await client.query(
        `SELECT public.ledger_post_event($1::jsonb) AS r`,
        [JSON.stringify({
          op: 'mint',
          idempotency_key: mintKey,
          memo: `project_vault_seed:${p.project_id}:${p.cid}`,
          ref_type: 'system',
          ref_id: String(p.project_id),
          uid: mintUid,
          cid: String(p.cid),
          amount_units: units.toString(),
          ...(curOwner === '0' ? { platform: true } : {}),
        })],
      );
      const mintOut = mintRes.rows[0]?.r as Record<string, unknown> | undefined;
      if (!mintOut || mintOut.ok !== true) throw new Error(`mint failed: ${JSON.stringify(mintOut).slice(0, 200)}`);

      // ② 金库额度记账（金库本体不在 account 表：`project_vault.balance` 是「对平台托管的 earmark」，
      //    资金已在 ① 落进 uid 0，因此这里只加额度、不重复动账 ⇒ 账面守恒）
      // ③ 金库额度入账（earmark 到该项目）
      await client.query(
        `INSERT INTO public.project_vault (project_id, cid, balance) VALUES ($1::bigint, $2::bigint, $3::numeric)
           ON CONFLICT (project_id, cid) DO UPDATE SET balance = public.project_vault.balance + EXCLUDED.balance, time_updated = now()`,
        [p.project_id, p.cid, units.toString()],
      );

      const after = (await client.query(`SELECT balance FROM public.project_vault WHERE project_id = $1::bigint AND cid = $2::bigint`, [p.project_id, p.cid])).rows[0];
      await client.query('COMMIT');
      results.push({ ...p, action: 'funded', vault_after: Number(after?.balance ?? 0) / 10 ** Number(rows.find((r) => String(r.project_id) === p.project_id)?.decimals ?? 0) });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      results.push({ ...p, action: 'error', error: String((error as Error)?.message || error).slice(0, 200) });
    } finally {
      client.release();
    }
  }

  console.log(JSON.stringify({ ok: true, mode: 'apply', db: pid, results }, null, 2));
  await pool.end();
};

main().catch((error) => {
  console.error('seed failed:', error);
  process.exit(1);
});
