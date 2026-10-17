/**
 * AC7 · dev 只读取证（best-effort）：看 `users.tg_user_id` 是否存在负值。
 * 仅 SELECT；不写库；不读生产连接串（用 backend-ts/.env.local = dev）。
 * 跑法（cwd = backend-ts）：npx ts-node --transpile-only -P tsconfig.json ../ops/recon-alert/qa/probe/qa-ac7-dev-read.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { readQuery } from '../../../../backend-ts/src/db';

(async () => {
  const out: Record<string, unknown> = { probe: 'qa-ac7-dev-read', at: new Date().toISOString() };
  try {
    const sign = await readQuery<{ bound: string; positive: string; negative: string }>(
      `SELECT count(*) FILTER (WHERE tg_user_id IS NOT NULL)::text AS bound,
              count(*) FILTER (WHERE tg_user_id > 0)::text        AS positive,
              count(*) FILTER (WHERE tg_user_id < 0)::text        AS negative
         FROM public.users`,
    );
    const sample = await readQuery<{ uid: string; positive: boolean; digits: number }>(
      `SELECT uid, (tg_user_id > 0) AS positive, length(tg_user_id::text) AS digits
         FROM public.users WHERE tg_user_id IS NOT NULL ORDER BY uid LIMIT 5`,
    );
    out.ok = true;
    out.sign = sign[0];
    out.sample = sample;
    out.note = 'dev 只读（.env.local），仅 SELECT count/明细';
  } catch (e) {
    out.ok = false;
    out.note = `dev readonly failed: ${e instanceof Error ? e.message.slice(0, 160) : 'ERROR'}`;
  }
  const dir = path.resolve(__dirname, '..', 'readings');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.resolve(dir, 'AC7-dev-read.json');
  fs.writeFileSync(file, `${JSON.stringify(out, null, 1)}\n`, 'utf8');
  console.log(JSON.stringify({ saved: file, ...out }));
  process.exit(0);
})();
