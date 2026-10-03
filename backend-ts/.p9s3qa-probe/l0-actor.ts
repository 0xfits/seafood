import { readQuery, closePools } from '../src/db';
(async () => {
  const rows = await readQuery(`SELECT log_id, uid, makeup_day, target_day, cost_usd, restored_streak_day, result, time_created FROM public.checkin_makeup_log WHERE uid=2::bigint ORDER BY log_id`);
  console.log(JSON.stringify(rows, null, 1));
  const cl = await readQuery(`SELECT log_id, uid, checkin_day, streak_day, reward_batt, time_created FROM public.checkin_log WHERE uid=2::bigint ORDER BY log_id DESC LIMIT 5`);
  console.log(JSON.stringify(cl, null, 1));
  const acct = await readQuery(`SELECT uid, batt FROM public.batt_account WHERE uid=2::bigint`);
  console.log('batt_acct', JSON.stringify(acct));
  await closePools(); process.exit(0);
})().catch(async e => { console.error(String(e)); await closePools(); process.exit(2); });
