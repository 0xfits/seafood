// P9④ 库面只读探针（Kong · 探针不落 scripts/ 扫面根；只读）
import { readQuery, closePools } from '../src/db';
(async () => {
  try {
    const r = await readQuery(`SELECT to_regclass('public.currency') AS cur, to_regclass('public.batt_account') AS batt, current_database() AS db`);
    const v = await readQuery(`SELECT version, checksum FROM public.schema_migration ORDER BY version DESC LIMIT 3`);
    const k = await readQuery(`SELECT pg_get_constraintdef(oid) AS d FROM pg_constraint WHERE conrelid='public.ledger_entry'::regclass AND conname='ledger_kind_enum'`);
    console.log('OK', JSON.stringify(r));
    console.log('SCHEMA', JSON.stringify(v));
    console.log('KIND', JSON.stringify(k));
  } catch (e) { console.log('ERR', (e as Error).message); }
  await closePools().catch(() => {});
})();
