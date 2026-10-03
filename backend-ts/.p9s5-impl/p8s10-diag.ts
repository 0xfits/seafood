import { withTransaction, closePools, TxClient } from '../src/db';
import { DatabaseService } from '../src/database';
import { planJobSettlement } from '../src/commission';
const evmOf = (uid: number) => `0x${uid.toString(16).padStart(40, '0')}`;
const SENT = 'DIAG_ROLLBACK';
(async () => {
  const log: Record<string, string> = {};
  try {
    await withTransaction(async (tx: TxClient) => {
      const step = async (name: string, fn: () => Promise<unknown>) => {
        await tx.query(`SAVEPOINT s_${name}`);
        try { const v = await fn(); await tx.query(`RELEASE SAVEPOINT s_${name}`); log[name] = 'OK ' + JSON.stringify(v).slice(0, 160); }
        catch (e) { await tx.query(`ROLLBACK TO SAVEPOINT s_${name}`).catch(() => {}); const er = e as { code?: string; message?: string; details?: unknown }; log[name] = `ERR ${er.code}:${er.message} ${JSON.stringify(er.details ?? {})}`; }
      };
      await step('users', async () => {
        for (const uid of [9600001, 9600002, 9600003, 9600004, 9600011, 9600012, 9600013, 9600014, 9600015]) {
          await tx.query(`INSERT INTO public.users (uid, evm, bio, is_admin, time_reg, time_login_last) VALUES ($1, $2, '', false, now(), now())`, [uid, evmOf(uid)]);
        }
        return 'inserted';
      });
      await step('bind1', () => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600002, 9600001]).then((r) => r.rows));
      await step('bind2', () => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600003, 9600002]).then((r) => r.rows));
      await step('bind3', () => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600004, 9600003]).then((r) => r.rows));
      await step('bind4', () => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600001, 9600011]).then((r) => r.rows));
      await step('bind5', () => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600011, 9600012]).then((r) => r.rows));
      await step('bind6', () => tx.query(`SELECT public.referral_bind($1::bigint, $2::bigint)`, [9600012, 9600013]).then((r) => r.rows));
      await step('grant', () => DatabaseService.grantSignupInviteBatt(9600014, tx));
      await step('job', async () => { await tx.query(`INSERT INTO public.job (employer_uid, worker_uid, cid, reward, create_key) VALUES ($1, $2, 1, 100000, $3)`, [9600004, 9600001, 'p8s10:diag']); return 'ok'; });
      await step('jobid', () => tx.query(`SELECT job_id::text AS j FROM public.job WHERE create_key='p8s10:diag'`).then((r) => r.rows));
      await step('settle', () => DatabaseService.settleInviteFirstTaskReward({ jobIdRaw: (log.jobid ? JSON.parse(log.jobid.slice(3))[0].j : '1') }, tx));
      await step('plan6', () => planJobSettlement({ jobId: '1', employerUid: 9600004, workerUid: 9600001, cid: 1, gross: 100000, ex: tx }).then((p) => ({ M: p.M, fee: p.fee, fee_credit_uid: p.fee_credit_uid })));
      await step('plan0', () => planJobSettlement({ jobId: '2', employerUid: 9600014, workerUid: 9600015, cid: 1, gross: 100000, ex: tx }).then((p) => ({ M: p.M, fee: p.fee_credit_uid })));
      throw new Error(SENT);
    });
  } catch (e) { if (String((e as Error)?.message) !== SENT) console.log('TX_ERR', String((e as Error)?.message).slice(0, 200)); }
  console.log(JSON.stringify(log, null, 1));
  await closePools().catch(() => undefined);
})();
