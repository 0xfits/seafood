import { readQuery, closePools } from '../src/db';
(async () => {
  const k = await readQuery(`SELECT key, updated_by, time_updated FROM public.app_config ORDER BY key`);
  console.log('app_config_keys', JSON.stringify(k, null, 1));
  const rp = await readQuery(`SELECT value FROM public.app_config WHERE key='rating_policy'`);
  console.log('rating_policy', JSON.stringify(rp));
  const mx = await readQuery(`SELECT (SELECT max(uid) FROM public.users) AS max_uid, (SELECT max(order_id) FROM public.listing_order) AS max_ord, (SELECT max(job_id) FROM public.job) AS max_job, (SELECT max(rating_id) FROM public.rating) AS max_rating`);
  console.log('maxes', JSON.stringify(mx));
  const ap = await readQuery(`SELECT key, value FROM public.app_config WHERE key IN ('batt_policy','checkin_policy','rating_policy')`);
  console.log('policies', JSON.stringify(ap));
  await closePools(); process.exit(0);
})().catch(async e => { console.error(String(e)); await closePools(); process.exit(2); });
