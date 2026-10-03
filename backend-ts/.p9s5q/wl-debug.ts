import { readQuery, closePools } from '../src/db';
(async () => {
  for (const [k, dir] of [['trade_fee','credit'], ['invite_first_task_reward','debit'], ['job_fee','debit']] as const) {
    try {
      const r = await readQuery<{ ok: boolean }>(
        `SELECT ledger_assert_platform_mutation(-1::bigint, $1::text, $2::text) IS NULL AS ok`, [k, dir]);
      console.log(k, dir, 'OK', JSON.stringify(r));
    } catch (e: any) {
      console.log(k, dir, 'ERR', e?.code, e?.message, JSON.stringify(e?.details ?? e?.detail ?? null));
    }
  }
  await closePools();
})();
