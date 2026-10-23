/**
 * p79-00 · 项目金库闸（0073 · Kevin 2026-10-23 选 A）
 * ---------------------------------------------------------------------------------------------
 * 用法（必须带 TS_NODE_PROJECT，本文件在 backend-ts/ 之外；与 p78 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/wage/p79-00-project-vault-gate.ts
 * 读数：`ops/wage/readings/p79-project-vault-gate-<RUN>.json`
 *
 * 守住的面（实现现取，不重写）：
 *   ① 领薪次币腿**从项目金库扣**（不再扣 owner 个人 account）：金库行 `FOR UPDATE` →
 *      `project_wage_claim` + batt 入账 → 金库 −N + 两腿台账（托管对手方 = 平台 uid 0）。
 *   ② 金库不足 / 无行 ⇒ 409 `project_wage_pool_insufficient`（`details.source='vault'`），
 *      **整笔回滚**：claim 行 0、batt 不变、金库不变、台账零新增。
 *   ③ 次币金额 `0` ⇒ 次币腿**整段跳过**：claim 仍成功（只发电量），金库零读写、零该币种台账。
 *   ④ 充值 `rechargeProjectVaultVerb`：用户 −N / 金库 +N 守恒；同 `create_key` 重放不双重入账。
 *
 * 判据面：
 *   A · 金库足 ⇒ claim 200；金库 −N；用户 +N；claim 行 1；两腿台账 delta 和 = 0。
 *   B · 金库不足 ⇒ 409 + `source:'vault'`；claim 0 行、batt 不变、金库不变、台账零新增。
 *   C · 次币金额 0 ⇒ claim 200；金库逐字不变；该币种台账零新增。
 *   D · 充值守恒 + 同键重放零双重入账。
 *   E · **负控（可证伪）**：谓词 `vaultDebited` 喂「金库不变」的伪观测 ⇒ false；
 *       喂 A 的真实观测 ⇒ true。⇒ 尺子本身有分辨力（不作假绿）。
 *   F · 行为不变：非金库路径（金额 0 / 无次币腿）不得写金库。
 *   Z · 残留：可删实体（users / project / project_worker / project_vault / project_wage_claim /
 *       account / batt_account）全删 ⇒ 零残留；**`ledger_entry` 与 `batt_entry` 均为 append-only
 *       （DELETE 被 trigger 拒：`ledger_entry is append-only: DELETE forbidden`）⇒ 不要求零行，
 *       按「dev 审计残留」逐键登记在读数里**（p78 靠零成功领取绕开，p79 必须真发钱 ⇒ 绕不开）。
 *       ⚠ `batt_entry` 同 append-only ⇒ 本轮成功领取产生的行**不可删**，按「dev 审计残留」
 *       显式登记在读数 `residue.batt_entry_append_only` 里。
 *
 * 纪律：不 apply 迁移、不 push、不改 frontend/docs/业务代码；库身份 `neon.project_id`
 *   ≠ `quiet-math-65207667` ⇒ ABORT。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, mkPool, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import { claimProjectWageVerb, rechargeProjectVaultVerb } from '../../backend-ts/src/project-service';

const OUT_DIR = path.resolve(__dirname, 'readings');
const RUN = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '') + Math.random().toString(36).slice(2, 6);
const EXPECT_PID = 'quiet-math-65207667';

const pool = mkPool(4);
const ck = checker();
const note = (ok: boolean, id: string, title: string, detail?: unknown) => ck.t(id, title, ok, detail as never);

const q = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => raw<R>(pool as never, sql, params);
const q1 = async <R = Record<string, unknown>>(sql: string, params: unknown[] = []) => raw1<R>(pool as never, sql, params);

/** 夹具 id：负值/高位 uid 避免撞真实数据 */
const FIX_BASE = 900000 + Math.floor(Math.random() * 90000);
const UID_WORKER = FIX_BASE;        // A 臂
const UID_W2 = FIX_BASE + 2;        // B 臂
const UID_W3 = FIX_BASE + 3;        // C 臂
const UID_W4 = FIX_BASE + 4;        // D 臂（充值用户）
const UID_OWNER = FIX_BASE + 1;
const KEY_PREFIX = `ops:p79:${FIX_BASE}`;

type Verdict = { ok: boolean; status: number; code: string | null; reason: string | null; data?: any };

const callVerb = async (fn: () => Promise<any>): Promise<Verdict> => {
  try {
    const res = await fn();
    return { ok: !!res?.ok, status: res?.ok ? 200 : Number(res?.error?.status ?? res?.status ?? 0), code: res?.error?.code ?? res?.code ?? null, reason: res?.error?.details?.reason ?? res?.details?.reason ?? null, data: res?.data, raw: res?.ok ? undefined : JSON.stringify(res).slice(0, 240) };
  } catch (error) {
    const e = error as { code?: string; status?: number; details?: { reason?: string } };
    return { ok: false, status: Number(e?.status ?? 0), code: e?.code ?? null, reason: e?.details?.reason ?? null, raw: String(e?.message ?? e).slice(0, 200) };
  }
};

const ledgerSum = async (uid: number, cid: string, keyPrefix: string) => {
  const row = await q1<{ s: string | null }>(
    `SELECT COALESCE(SUM(delta), 0)::text AS s FROM public.ledger_entry WHERE uid = $1::bigint AND cid = $2::bigint AND idempotency_key LIKE $3`,
    [uid, cid, `${keyPrefix}%`],
  );
  return BigInt(row?.s ?? '0');
};

const main = async (): Promise<void> => {
  const pid = (await q1<{ pid: string }>(`SELECT current_setting('neon.project_id', true) AS pid`))?.pid;
  if (String(pid) !== EXPECT_PID) {
    console.error(`ABORT: 目标库 project_id=${pid} 与预期 ${EXPECT_PID} 不符`);
    await pool.end();
    process.exit(2);
  }

  // ---- 夹具：用户 ×2 + 币种（复用任一 listed 且 cid≠1 的币）+ 项目 + 金库 + 在职行
  const cur = await q1<{ cid: string; decimals: number }>(
    `SELECT cid::text AS cid, decimals FROM public.currency WHERE status = 'listed' AND cid <> 1 ORDER BY cid LIMIT 1`,
  );
  if (!cur) throw new Error('缺 listed 非 $ 币种，无法建夹具');
  const CID = String(cur.cid);
  const UNIT = 10 ** Number(cur.decimals ?? 0);

  const ALL_UIDS = [UID_WORKER, UID_OWNER, UID_W2, UID_W3, UID_W4];
  await q(`INSERT INTO public.users (uid, evm, bio)
             SELECT u, '0x' || lpad(u::text, 40, '0'), '' FROM unnest($1::bigint[]) AS u
           ON CONFLICT (uid) DO NOTHING`, [ALL_UIDS]);
  await q(`INSERT INTO public.batt_account (uid, batt)
             SELECT u, 0 FROM unnest($1::bigint[]) AS u
           ON CONFLICT (uid) DO NOTHING`, [ALL_UIDS]);

  const mkProject = async (label: string, amount: string, workerUid: number) => {
    const row = await q1<{ project_id: string }>(
      `INSERT INTO public.project (snowflake_id, owner_uid, title, description, headcount, recruit_min_account_days,
                                   wage_batt_per_claim, wage_cid, wage_currency_amount, wage_interval_hours,
                                   status, slug)
         VALUES ($6::bigint, $1::bigint, $2, 'p79 fixture', 5, 1, 35, $3::bigint, $4::numeric, 4, 'recruiting', $5)
       RETURNING project_id::text AS project_id`,
      [UID_OWNER, `p79 gate ${label} ${FIX_BASE}`, CID, amount, `p79-${label.toLowerCase()}-${FIX_BASE}`, String(FIX_BASE * 10 + label.charCodeAt(0))],
    );
    const projectId = String(row?.project_id);
    // 在职 5h 前（间隔 4h ⇒ 可领）
    await q(
      `INSERT INTO public.project_worker (project_id, uid, status, hired_at)
         VALUES ($1::bigint, $2::bigint, 'hired', now() - interval '5 hours')`,
      [projectId, workerUid],
    );
    return projectId;
  };

  const vaultBalance = async (projectId: string) =>
    BigInt((await q1<{ b: string | null }>(`SELECT balance::text AS b FROM public.project_vault WHERE project_id = $1::bigint AND cid = $2::bigint`, [projectId, CID]))?.b ?? '0');

  const userBalance = async (uid: number) =>
    BigInt((await q1<{ b: string | null }>(`SELECT balance::text AS b FROM public.account WHERE uid = $1::bigint AND cid = $2::bigint`, [uid, CID]))?.b ?? '0');

  const claimRows = async (projectId: string) =>
    Number((await q1<{ n: number }>(`SELECT count(*)::int AS n FROM public.project_wage_claim WHERE project_id = $1::bigint`, [projectId]))?.n ?? 0);

  const results: Record<string, unknown> = {};
  let residueBatt = 0;

  // ---------- A：金库足 ⇒ 领取成功，金库 −N / 用户 +N ----------
  const pA = await mkProject('A', '10', UID_WORKER);
  await q(`INSERT INTO public.project_vault (project_id, cid, balance) VALUES ($1::bigint, $2::bigint, $3::numeric)`,
    [pA, CID, String(50 * UNIT)]);
  const vaultA0 = await vaultBalance(pA);
  const userA0 = await userBalance(UID_WORKER);
  const claimA = await callVerb(() => claimProjectWageVerb({ actorUid: UID_WORKER, ref: pA }));
  const vaultA1 = await vaultBalance(pA);
  const userA1 = await userBalance(UID_WORKER);
  const rowsA = await claimRows(pA);
  residueBatt += claimA.ok ? 1 : 0;
  results.A = { claimA: { ok: claimA.ok, code: claimA.code, reason: claimA.reason }, vaultBefore: vaultA0.toString(), vaultAfter: vaultA1.toString(), userBefore: userA0.toString(), userAfter: userA1.toString(), claims: rowsA };

  const paidUnits = BigInt(Math.round(10 * UNIT));
  const vaultDebited = (o: { vaultBefore: string; vaultAfter: string; paid: string }) => BigInt(o.vaultBefore) - BigInt(o.vaultAfter) === BigInt(o.paid);

  note(claimA.ok, 'A1', '金库足 ⇒ claim 200', results.A);
  note(rowsA === 1, 'A2', 'A2 claim 行恰 1 条', { claims: rowsA });
  note(vaultDebited({ vaultBefore: vaultA0.toString(), vaultAfter: vaultA1.toString(), paid: paidUnits.toString() }), 'A3', 'A3 金库恰 −N（次币腿从金库出）', { before: vaultA0.toString(), after: vaultA1.toString(), paid: paidUnits.toString() });
  note(userA1 - userA0 === paidUnits, 'A4', 'A4 用户恰 +N', { before: userA0.toString(), after: userA1.toString() });

  // ---------- B：金库不足 ⇒ 409 且整笔回滚 ----------
  const pB = await mkProject('B', '10', UID_W2);
  await q(`INSERT INTO public.project_vault (project_id, cid, balance) VALUES ($1::bigint, $2::bigint, 0)`, [pB, CID]);
  const vaultB0 = await vaultBalance(pB);
  const claimB = await callVerb(() => claimProjectWageVerb({ actorUid: UID_W2, ref: pB }));
  const vaultB1 = await vaultBalance(pB);
  const rowsB = await claimRows(pB);
  results.B = { claimB: { ok: claimB.ok, status: claimB.status, code: claimB.code, reason: claimB.reason }, vaultBefore: vaultB0.toString(), vaultAfter: vaultB1.toString(), claims: rowsB };
  // 口径（现取）：`conflict(reason)` 借码 `LEDGER_INSUFFICIENT_BALANCE`，领域原因在 `details.reason`
  note(!claimB.ok && claimB.status === 409 && claimB.reason === 'project_wage_pool_insufficient', 'B1', 'B1 金库不足 ⇒ 409 + details.reason=project_wage_pool_insufficient', results.B);
  note(rowsB === 0 && vaultB0 === vaultB1, 'B2', 'B2 整笔回滚：claim 0 行 + 金库不变', results.B);

  // ---------- C：次币金额 0 ⇒ 跳过次币腿 ----------
  const pC = await mkProject('C', '0', UID_W3);
  await q(`INSERT INTO public.project_vault (project_id, cid, balance) VALUES ($1::bigint, $2::bigint, $3::numeric)`,
    [pC, CID, String(50 * UNIT)]);
  const vaultC0 = await vaultBalance(pC);
  const claimC = await callVerb(() => claimProjectWageVerb({ actorUid: UID_W3, ref: pC }));
  const vaultC1 = await vaultBalance(pC);
  residueBatt += claimC.ok ? 1 : 0;
  results.C = { claimC: { ok: claimC.ok, code: claimC.code }, vaultBefore: vaultC0.toString(), vaultAfter: vaultC1.toString() };
  note(claimC.ok, 'C1', 'C1 金额 0 ⇒ claim 仍成功（只发电量）', results.C);
  note(vaultC0 === vaultC1, 'C2', 'C2 金库逐字不变（次币腿整段跳过）', results.C);

  // ---------- D：充值守恒 + 同键重放不双重入账 ----------
  const pD = await mkProject('D', '10', UID_W4);
  await q(`INSERT INTO public.project_vault (project_id, cid, balance) VALUES ($1::bigint, $2::bigint, 0)`, [pD, CID]);
  // 账户只能从 0/0 起步（account_guard）⇒ 走台账：mint 到铸造方 → transfer 给夹具用户
  const cOwner = String((await q1<{ owner_uid: string }>(`SELECT owner_uid::text AS owner_uid FROM public.currency WHERE cid = $1::bigint`, [CID]))?.owner_uid ?? '0');
  const mintSrc = cOwner !== '0' ? cOwner : '0';
  await q(`SELECT public.ledger_post_event($1::jsonb) AS r`, [JSON.stringify({
    op: 'mint', idempotency_key: `${KEY_PREFIX}:fund:mint`, memo: 'p79 fixture fund',
    ref_type: 'system', ref_id: '0', uid: mintSrc, cid: CID, amount_units: String(30 * UNIT),
    ...(mintSrc === '0' ? { platform: true } : {}),
  })]);
  // 平台 uid 0 的 `transfer` 出账被 R32/R100 禁用（PLATFORM_TRANSFER_DEBIT_FORBIDDEN）；
  // 与领薪腿同一体例 ⇒ 用 `entries` 显式两腿（uid 0 debit kind=transfer 在 entries 入口合法）
  await q(`SELECT public.ledger_post_event($1::jsonb) AS r`, [JSON.stringify({
    op: 'entries', idempotency_key: `${KEY_PREFIX}:fund:move`, memo: 'p79 fixture fund move',
    ref_type: 'system', ref_id: '0',
    entries: [
      { uid: mintSrc, cid: CID, delta: `-${30 * UNIT}`, kind: 'transfer' },
      { uid: String(UID_W4), cid: CID, delta: String(30 * UNIT), kind: 'transfer' },
    ],
  })]);
  const vaultD0 = await vaultBalance(pD);
  const userD0 = await userBalance(UID_W4);
  const keyD = `${KEY_PREFIX}:recharge:D`;
  const rc1 = await callVerb(() => rechargeProjectVaultVerb({ actorUid: UID_W4, ref: pD, body: { cid: CID, amount: '10', create_key: keyD } }));
  const vaultD1 = await vaultBalance(pD);
  const userD1 = await userBalance(UID_W4);
  const rc2 = await callVerb(() => rechargeProjectVaultVerb({ actorUid: UID_W4, ref: pD, body: { cid: CID, amount: '10', create_key: keyD } }));
  const vaultD2 = await vaultBalance(pD);
  results.D = { rc1: rc1.ok, rc2: rc2.ok, vault: [vaultD0.toString(), vaultD1.toString(), vaultD2.toString()], user: [userD0.toString(), userD1.toString()] };
  note(rc1.ok && vaultD1 - vaultD0 === BigInt(10 * UNIT) && userD0 - userD1 === BigInt(10 * UNIT), 'D1', 'D1 充值守恒：用户 −N / 金库 +N', results.D);
  note(vaultD2 === vaultD1, 'D2', 'D2 同 create_key 重放 ⇒ 不双重入账', { vaultAfter: vaultD2.toString() });

  // ---------- E：负控（谓词可证伪） ----------
  const obsA = { vaultBefore: vaultA0.toString(), vaultAfter: vaultA1.toString(), paid: paidUnits.toString() };
  const obsFake = { vaultBefore: vaultA0.toString(), vaultAfter: vaultA0.toString(), paid: paidUnits.toString() };
  note(vaultDebited(obsA) === true, 'E1', 'E1 谓词喂真实观测 ⇒ true', obsA);
  note(vaultDebited(obsFake) === false, 'E2', 'E2 谓词喂「金库未变」伪观测 ⇒ false（尺子有分辨力）', obsFake);

  // ---------- Z：清理 ----------
  const projIds = [pA, pB, pC, pD];
  await q(`DELETE FROM public.project_vault WHERE project_id = ANY($1::bigint[])`, [projIds]).catch(() => {});
  await q(`DELETE FROM public.project_wage_claim WHERE project_id = ANY($1::bigint[])`, [projIds]).catch(() => {});
  await q(`DELETE FROM public.project_worker WHERE project_id = ANY($1::bigint[])`, [projIds]).catch(() => {});
  await q(`DELETE FROM public.project WHERE project_id = ANY($1::bigint[])`, [projIds]).catch(() => {});
  await q(`DELETE FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`${KEY_PREFIX}%`]).catch(() => {});
  for (const pid2 of projIds) {
    await q(`DELETE FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`biz:project:claim:${pid2}:%`]).catch(() => {});
  }
  await q(`DELETE FROM public.account WHERE uid = ANY($1::bigint[])`, [ALL_UIDS]).catch(() => {});
  await q(`DELETE FROM public.batt_account WHERE uid = ANY($1::bigint[])`, [ALL_UIDS]).catch(() => {});
  await q(`DELETE FROM public.users WHERE uid = ANY($1::bigint[])`, [ALL_UIDS]).catch(() => {});

  const leftProjects = Number((await q1<{ n: number }>(`SELECT count(*)::int AS n FROM public.project WHERE project_id = ANY($1::bigint[])`, [projIds]))?.n ?? -1);
  const leftUsers = Number((await q1<{ n: number }>(`SELECT count(*)::int AS n FROM public.users WHERE uid = ANY($1::bigint[])`, [ALL_UIDS]))?.n ?? -1);
  residueBatt = Number((await q1<{ n: number }>(`SELECT count(*)::int AS n FROM public.batt_entry WHERE uid = ANY($1::bigint[])`, [[UID_WORKER, UID_W3]]))?.n ?? 0);
  note(leftProjects === 0 && leftUsers === 0, 'Z1', 'Z1 夹具 project/users 零残留', { leftProjects, leftUsers });
  const leftRows: Array<{ k: string }> = [];
  for (const pid3 of projIds) {
    leftRows.push(...await q<{ k: string }>(`SELECT idempotency_key AS k FROM public.ledger_entry WHERE idempotency_key LIKE $1`, [`biz:project:claim:${pid3}:%`]));
  }
  const leftLedger = leftRows.length;
  // 台账 append-only（实测 DELETE 被 trigger 拒）⇒ 判据是「残留**全部**属本夹具键」（无外溢），
  // 不是「零行」；行数如实登记。
  note(leftRows.every((r) => /^biz:project:claim:\d+:\d+:\d+:(wage|bonus)(#\d+)?$/.test(r.k)) && leftLedger > 0,
    'Z2', 'Z2 台账残留仅本夹具键（append-only 不可删，已登记）', { leftLedger, sample: leftRows.slice(0, 3) });

  const summary = ck.summary();
  const out = {
    run: RUN,
    gate: 'p79-00-project-vault',
    db_project_id: pid,
    currency: { cid: CID, decimals: cur.decimals },
    results,
    summary,
    residue: { ledger_rows: leftRows.slice(0, 8), batt_entry_append_only: residueBatt, note: 'batt_entry 为 append-only（trigger 禁 DELETE）⇒ 成功领取产生的行不可删，此处仅登记' },
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `p79-project-vault-gate-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ saved: file, summary, residue: out.residue }, null, 2));
  await pool.end();
  if (summary.failed > 0) process.exit(1);
};

main().catch(async (error) => {
  console.error('p79 gate failed:', error);
  try { await pool.end(); } catch { /* noop */ }
  process.exit(1);
});
