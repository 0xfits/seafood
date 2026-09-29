// p4z-b3afix2-04-holdpair-probe.ts — 只读：把 live 的 hold 家族配对查询原样套在 3 条同组用例上，看它到底会不会命中
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix2-04-holdpair-probe.ts <outDir>
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix2-run'));
fs.mkdirSync(outDir, { recursive: true });
for (const raw of fs.readFileSync(path.join(REPO, '.env.local'), 'utf8').split('\n')) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  const k = line.slice(0, i).trim();
  let v = line.slice(i + 1).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[k]) process.env[k] = v;
}
/* eslint-disable @typescript-eslint/no-var-requires */
const { neon } = require('@neondatabase/serverless') as { neon: (u: string) => (q: string) => Promise<unknown[]> };
const sql = neon(String(process.env.DATABASE_URL || ''));

const ENT = (legs: string) => `jsonb_build_array(${legs})`;

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), mode: 'READ-ONLY' };
  const cases: Array<[string, string]> = [
    ['3_legs_same_group_hold', ENT([
      `ledger_norm_entry(970001,1,-1,0,'hold',NULL,NULL,NULL,NULL,'k',NULL)`,
      `ledger_norm_entry(970001,1,0,1,'hold',NULL,NULL,NULL,NULL,'k#2',NULL)`,
      `ledger_norm_entry(970001,1,1,0,'hold',NULL,NULL,NULL,NULL,'k#3',NULL)`,
    ].join(','))],
    ['2_legs_same_group_hold', ENT([
      `ledger_norm_entry(970001,1,-1,0,'hold',NULL,NULL,NULL,NULL,'k',NULL)`,
      `ledger_norm_entry(970001,1,1,0,'hold',NULL,NULL,NULL,NULL,'k#2',NULL)`,
    ].join(','))],
    ['2_legs_two_kinds_one_each', ENT([
      `ledger_norm_entry(970001,1,-1,0,'hold',NULL,NULL,NULL,NULL,'k',NULL)`,
      `ledger_norm_entry(970001,1,1,0,'job_escrow',NULL,NULL,NULL,NULL,'k#2',NULL)`,
    ].join(','))],
  ];
  for (const [label, arr] of cases) {
    out[label] = await sql(`
      WITH ent AS (SELECT ${arr} AS v_entries)
      SELECT g.g_uid, g.g_cid, g.g_kind, g.n
        FROM ent, LATERAL (
          SELECT t.e->>'uid' AS g_uid, t.e->>'cid' AS g_cid, t.e->>'kind' AS g_kind, count(*)::int AS n
            FROM jsonb_array_elements(ent.v_entries) AS t(e)
           WHERE t.e->>'kind' IN ('hold','hold_release','job_escrow','job_escrow_refund')
           GROUP BY 1, 2, 3
          HAVING count(*) <> 2) g`);
  }
  // live 函数里该查询的原文（逐字）——直接用已落盘的 post def 文件切片，不经 SQL 正则
  const defTxt = fs.readFileSync(path.join(outDir, 'post-ledger_post_event.def.sql'), 'utf8').split('\n');
  out.live_query_text_lines_517_527 = defTxt.slice(516, 527).map((t, i) => `${517 + i}: ${t}`);
  fs.writeFileSync(path.join(outDir, 'b3afix2-04-holdpair-probe.json'), JSON.stringify(out, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3afix2-04-holdpair-probe.json'));
  for (const [label] of cases) console.log(label + ' => ' + JSON.stringify(out[label]));
};
main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
