import { mkPool, raw } from '../../backend-ts/scripts/p7b-lib';
(async () => {
  const pool = mkPool(1);
  const r = await raw(pool,
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' ORDER BY ordinal_position");
  console.log(JSON.stringify(r, null, 0));
  await pool.end();
})().catch((e) => { console.error(e); process.exit(2); });
