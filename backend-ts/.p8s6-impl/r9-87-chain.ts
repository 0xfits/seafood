/**
 * R-9-87 真链路（事务内自造夹具 + 末尾 ROLLBACK，零生产态改动）
 * ============================================================================
 * 查询文本**逐字取自源码文件**（不手抄）：
 *   · 修复侧 = 主仓 `backend-ts/src/database.ts`
 *   · 修复前对照臂 = **仓外副本** `…/r9-8687-neg/nopri/src/database.ts`（仅把「本人优先键」降位）
 * 夹具（不存在的 uid 段 99xxxxx，全在单事务内、末尾 ROLLBACK）：
 *   · appOther：application_id = 991001 ∧ job_id = 991002 ∧ worker_uid = 9900012（他人）
 *   · appMine ：application_id = 991004 ∧ job_id = 991001 ∧ worker_uid = 9900013（本人）
 *   ⇒ 传 identifier = 991001（= 他人的 application_id ∧ 本人的 job_id）⇒ 必修得**本人**。
 * 用法（cwd = backend-ts）：npx ts-node --transpile-only .p8s6-impl/r9-87-chain.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, txQuery, closePools, TxClient } from '../src/db';

const MAIN_DB = path.resolve(__dirname, '..', 'src', 'database.ts');
const NEG_DB = process.env.R987_NEG_DB
  || path.resolve('/Users/kevin/.hermes/profiles/zang/cache/scratch/r9-8687-neg/nopri/src/database.ts');

const extractQuery = (file: string): string => {
  const t = fs.readFileSync(file, 'utf8');
  const anchor = t.indexOf('static async resolveJobApplication');
  if (anchor < 0) throw new Error('anchor missing: ' + file);
  const m = t.slice(anchor).match(/firstRow\(await sql`([\s\S]*?)`\)/);
  if (!m) throw new Error('sql template missing: ' + file);
  return m[1];
};
const render = (q: string, identifier: number, workerUid: number): string =>
  q.replace(/\$\{identifier\}/g, String(identifier)).replace(/\$\{workerUid\}/g, String(workerUid));

const SENT = 'R987-ROLLBACK-SENTINEL';
const X = 991001;            // 撞号值
const J_OTHER = 991002;      // 他人申请所在 job
const APP_OTHER = 991001;    // 他人申请的 application_id = X
const APP_MINE = 991004;     // 本人申请的 application_id
const W_OTHER = 9900012;
const W_ME = 9900013;
const EMP = 9900011;

const evmOf = (n: number) => '0x' + String(n).padStart(40, '0');

interface Reading { arm: string; identifier: number; workerUid: number; applicationId: number | null; ownerUid: number | null; ownership: string | null; }

const main = async () => {
  const qFixed = extractQuery(MAIN_DB);
  const qBroken = extractQuery(NEG_DB);
  const results: Record<string, unknown> = {};
  const fails: string[] = [];
  let readings: Reading[] = [];

  try {
    await withTransaction(async (tx: TxClient) => {
      // 夹具：3 user / 2 job / 2 job_application（FK：job→users,currency；job_application→job,users）
      const cidRow = await txQuery<{ cid: string }>(tx, `SELECT cid::text FROM public.currency ORDER BY cid LIMIT 1`);
      const cid = Number(cidRow[0]?.cid ?? 1);
      for (const u of [EMP, W_OTHER, W_ME]) {
        await txQuery(tx, `INSERT INTO public.users (uid, evm, bio) VALUES ($1, $2, '')`, [u, evmOf(u)]);
      }
      await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, title, create_key) VALUES ($1,$2,$3,1,'r987-other','r987:job:${J_OTHER}')`, [J_OTHER, EMP, cid]);
      await txQuery(tx, `INSERT INTO public.job (job_id, employer_uid, cid, reward, title, create_key) VALUES ($1,$2,$3,1,'r987-mine','r987:job:${X}')`, [X, EMP, cid]);
      await txQuery(tx, `INSERT INTO public.job_application (application_id, job_id, worker_uid, status, create_key) VALUES ($1,$2,$3,'applied','r987:app:${APP_OTHER}')`, [APP_OTHER, J_OTHER, W_OTHER]);
      await txQuery(tx, `INSERT INTO public.job_application (application_id, job_id, worker_uid, status, create_key) VALUES ($1,$2,$3,'applied','r987:app:${APP_MINE}')`, [APP_MINE, X, W_ME]);

      const probe = async (arm: string, sqlText: string, identifier: number, workerUid: number): Promise<Reading> => {
        const rows = await txQuery<{ application_id: string; worker_uid: string; ownership: string }>(
          tx, render(sqlText, identifier, workerUid));
        const r = rows[0];
        return { arm, identifier, workerUid,
          applicationId: r ? Number(r.application_id) : null,
          ownerUid: r ? Number(r.worker_uid) : null,
          ownership: r ? String(r.ownership) : null };
      };

      readings = [
        await probe('fixed@collision', qFixed, X, W_ME),      // 必修：解到本人 appMine
        await probe('broken@collision', qBroken, X, W_ME),    // 修复前：解到他人 appOther
        await probe('fixed@jobid_only', qFixed, J_OTHER, W_OTHER), // 容错语义：仅命中 job_id 面仍可用
      ];
      throw new Error(SENT); // ★ 强制 ROLLBACK
    });
  } catch (e) {
    if (String((e as Error)?.message) !== SENT) throw e;
  }

  const [c1, c2, c3] = readings;
  const ok = {
    fixed_resolves_self: c1.applicationId === APP_MINE && c1.ownerUid === W_ME && c1.ownership === 'self',
    broken_resolves_other: c2.applicationId === APP_OTHER && c2.ownerUid === W_OTHER && c2.ownership === 'other',
    broken_red_judge: c2.applicationId !== APP_MINE,          // 判负键：去键后必红（解析到他人）
    where_tolerance_kept: c3.applicationId === APP_OTHER && c3.ownership === 'self', // 仍接受 job_id
  };
  for (const [k, v] of Object.entries(ok)) if (!v) fails.push(k);

  // 复核夹具确已回滚（事务外读同一 id ⇒ 应为 0 行）
  const after = await txQueryFlag();
  results.query_fixed_source = MAIN_DB;
  results.query_broken_source = NEG_DB;
  results.query_fixed_text = render(qFixed, X, W_ME);
  results.query_broken_text = render(qBroken, X, W_ME);
  results.readings = readings;
  results.assertions = ok;
  results.rollback_verified = after;
  results.failures = fails;
  console.log('R987_CHAIN=' + JSON.stringify(results, null, 2));
  await closePools();
  process.exit(fails.length ? 1 : 0);
};

// 事务外（只读）核验夹具未落库：走只读池单语句
const txQueryFlag = async (): Promise<{ users_after: number; jobs_after: number; apps_after: number }> => {
  const { readQuery } = await import('../src/db');
  const u = await readQuery<{ n: string }>(`SELECT COUNT(1)::text AS n FROM public.users WHERE uid IN (9900011,9900012,9900013)`);
  const j = await readQuery<{ n: string }>(`SELECT COUNT(1)::text AS n FROM public.job WHERE job_id IN (991001,991002)`);
  const a = await readQuery<{ n: string }>(`SELECT COUNT(1)::text AS n FROM public.job_application WHERE application_id IN (991001,991004)`);
  return { users_after: Number(u[0].n), jobs_after: Number(j[0].n), apps_after: Number(a[0].n) };
};

main().catch(async (e) => { console.error('R987_CHAIN_FAIL', e); await closePools().catch(() => undefined); process.exit(2); });
