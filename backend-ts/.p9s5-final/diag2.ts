/**
 * P9⑤ 收尾单诊断：逐 step 隔离定位 p8-s10 K 段首抛（LD016）。
 * 用**修正后**的 `referral_bind(child,parent)` 顺序；每 step SAVEPOINT 隔离。事务末尾 ROLLBACK。
 * 探针不入 scripts/；原始输出 .json。
 */
import * as fs from 'fs';
import * as path from 'path';
import { withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { planJobSettlement, computeFee } from '../src/commission';

const evmOf = (uid: number) => `0x${uid.toString(16).padStart(40, '0')}`;
const SENT = 'P9S5_DIAG2_ROLLBACK';
(async () => {
  const log: Record<string, string> = {};
  const out = path.resolve(__dirname, `diag2-${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z')}.json`);
  try {
    await withTransaction(async (tx: TxClient) => {
      const step = async (name: string, fn: () => Promise<unknown>) => {
        await tx.query(`SAVEPOINT s_${name}`);
        try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT s_${name}`); log[name] = 'OK ' + JSON.stringify(v).slice(0, 220); }
        catch (e) { await tx.query(`ROLLBACK TO SAVEPOINT s_${name}`).catch(() => {}); const er = e as { code?: string; message?: string; details?: unknown; detail?: string }; log[name] = `ERR ${er.code}:${er.message} detail=${er.detail ?? ''} ${JSON.stringify(er.details ?? {})}`.slice(0, 400); }
      };
      await step('users', async () => {
        for (const uid of [9600001, 9600002, 9600003, 9600004, 9600011, 9600012, 9600013, 9600014, 9600015]) {
          await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last) VALUES ($1, $2, '', false, now(), now())`, [uid, evmOf(uid)]);
        }
        return 'inserted';
      });
      const bind = (c: number, p: number) => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [c, p]).then((r) => r.rows[0]);
      await step('bindU1', () => bind(9600001, 9600002));
      await step('bindU2', () => bind(9600002, 9600003));
      await step('bindU3', () => bind(9600003, 9600004));
      await step('bindD1', () => bind(9600011, 9600001));
      await step('bindD2', () => bind(9600012, 9600011));
      await step('bindD3', () => bind(9600013, 9600012));
      await step('refUp', () => tx.query(`SELECT child_uid::text, parent_uid::text, depth::text FROM public.referral WHERE child_uid IN (9600001,9600002,9600003,9600011,9600012,9600013) ORDER BY child_uid`).then((r) => r.rows));
      await step('grant', () => DatabaseService.grantSignupInviteBatt(9600014, tx).then((r) => ({ outcome: r.outcome, batt: r.batt, granted: r.grantedBatt })));
      await step('job', async () => { await tx.query(`INSERT INTO public.job (employer_uid, worker_uid, cid, reward, create_key) VALUES ($1, $2, 1, 100000, $3)`, [9600004, 9600001, 'p9s5:diag2:job']); return 'ok'; });
      await step('jobid', () => tx.query(`SELECT job_id::text AS j FROM public.job WHERE create_key='p9s5:diag2:job'`).then((r) => r.rows));
      const jid = (log.jobid && log.jobid.startsWith('OK')) ? JSON.parse(log.jobid.slice(3))[0].j : '1';
      await step('settleFt', () => DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: jid }, tx).then((r) => ({ outcome: r.outcome, recipients: r.recipientUids, total: r.totalUsdFromPlatform })));
      await step('plan6', () => planJobSettlement({ jobId: '1', employerUid: 9600004, workerUid: 9600001, cid: 1, gross: 100000, ex: tx }).then((p) => ({ M: p.M, fee: p.fee, fee_credit_uid: p.fee_credit_uid, layers: p.layers.length })));
      log.computeFee = computeFee(100000, 1000).toString();
      await step('plan0', () => planJobSettlement({ jobId: '2', employerUid: 9600014, workerUid: 9600015, cid: 1, gross: 100000, ex: tx }).then((p) => ({ M: p.M, fee: p.fee, fee_credit_uid: p.fee_credit_uid })));
      await step('k5neg', () => tx.query(`SELECT ledger_assert_platform_mutation(-1::bigint, 'job_fee', 'debit')`).then((r) => r.rows[0]));
      throw new Error(SENT);
    });
  } catch (e) { if (String((e as Error)?.message) !== SENT) log.TX_ERR = String((e as Error)?.message).slice(0, 300); }
  fs.writeFileSync(out, JSON.stringify(log, null, 1) + '\n', 'utf8');
  console.log(JSON.stringify(log, null, 1));
  console.log('OUT=' + out);
  await closePools().catch(() => undefined);
})();
