/**
 * P9② QA 收尾单 · ③ L5 库面：schema_migration checksum 双对拍 + 零净写终证（Neng 自写，只读）
 * 用法：cd backend-ts && npx ts-node --transpile-only .p9s2qa-closeout/l5-checksum.ts
 */
import '../src/env';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { readQuery, closePools } from '../src/db';

const MIG_DIR = path.resolve(__dirname, '..', 'migrations');
const sha256 = (p: string) => crypto.createHash('sha256').update(fs.readFileSync(p, 'utf8'), 'utf8').digest('hex');

(async () => {
  const out: Record<string, unknown> = {};
  const q = async (t: string, p?: unknown[]) => readQuery<Record<string, unknown>>(t, p);

  out.counts = await q(`SELECT max(version) AS maxv, count(*)::int AS n FROM public.schema_migration`);
  const rows = await q(`SELECT version, name, checksum FROM public.schema_migration ORDER BY version`);
  out.applied = rows.length;

  const files = fs.readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort();
  out.files = files.length;
  const pairs: Array<Record<string, unknown>> = [];
  let mismatch = 0;
  for (const r of rows) {
    const ver = String(r.version);
    const fname = files.find(f => f.startsWith(ver + '_') || f.startsWith(ver));
    if (!fname) { pairs.push({ version: ver, name: r.name, file: null, match: null }); continue; }
    const fileSha = sha256(path.join(MIG_DIR, fname));
    const match = fileSha === String(r.checksum);
    if (!match) mismatch += 1;
    pairs.push({ version: ver, db: String(r.checksum).slice(0, 16), file: fileSha.slice(0, 16), match, fname });
  }
  out.mismatch = mismatch;
  // 重点两行逐字
  const focus = ['0027', '0028', '0029'];
  out.focus = pairs.filter(p => focus.includes(String(p.version)));
  out.all_pairs_full = pairs;
  // 零净写终证：生产计数快照
  out.netwrite = await q(`SELECT
    (SELECT count(*)::int FROM public.schema_migration) AS schema_rows,
    (SELECT count(*)::int FROM public.app_config) AS appcfg_rows,
    (SELECT count(*)::int FROM public.batt_account) AS batt_rows,
    (SELECT count(*)::int FROM public.batt_entry) AS batt_entry_rows,
    (SELECT count(*)::int FROM public.checkin_log) AS checkin_rows,
    (SELECT count(*)::int FROM public.checkin_makeup_log) AS makeup_rows,
    (SELECT count(*)::int FROM public.job WHERE job_id >= 990000) AS probe_jobs`);
  out.focus_detail = await q(`SELECT version, name, checksum FROM public.schema_migration WHERE version IN ('0028','0029') ORDER BY version`);

  console.log(JSON.stringify(out, null, 1));
  await closePools();
})().catch((e) => { console.error('L5_FAIL', String((e as Error)?.message || e).slice(0, 300)); process.exit(1); });
