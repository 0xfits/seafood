import '../src/env';
import { readQuery, closePools } from '../src/db';
(async () => {
  const q = async (t: string, p?: unknown[]) => readQuery<Record<string, unknown>>(t, p);
  const r = await q(`SELECT
    (SELECT COALESCE(b.batt,0) FROM public.batt_account b WHERE b.uid = 999999999)::text AS inner_form,
    COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid = 999999999),0)::text AS outer_form,
    ((SELECT COALESCE(b.batt,0) FROM public.batt_account b WHERE b.uid = 999999999) < 9)::text AS inner_lt9,
    (COALESCE((SELECT b.batt FROM public.batt_account b WHERE b.uid = 999999999),0) < 9)::text AS outer_lt9`);
  console.log(JSON.stringify(r[0], null, 1));
  await closePools();
})().catch((e) => { console.error('C15_FAIL', String((e as Error)?.message || e).slice(0,200)); process.exit(1); });
