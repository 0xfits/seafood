import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';
dotenv.config({ path: '.env.local' }); dotenv.config();
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
type Row = Record<string, unknown>;
(async () => {
  const u = (await sql`SELECT uid::text AS uid, evm, is_admin FROM public.users ORDER BY uid LIMIT 40`) as Row[];
  console.log('users', JSON.stringify(u));
  const has = (await sql`SELECT uid::text AS uid FROM public.users WHERE uid IN (2,3,7,8,11,12,19,21,970001)`) as Row[];
  console.log('candidates_present', JSON.stringify(has));
  const sys = (await sql`SELECT cid::text AS cid, symbol FROM public.currency WHERE cid=1`) as Row[];
  console.log('sys_currency', JSON.stringify(sys));
})().catch((e)=>{console.error(e);process.exit(1)});
