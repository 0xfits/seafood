/**
 * qa-p7a-zw.ts —— **Neng 独立质检（批 7-A）L3(b)/L4**：只读面「零写副作用」强探针（DL23）
 * 关键：**基线取在首个 HTTP 调用之前**（若基线取在多次调用之后，对「首次访问才建表」的变异是盲的）。
 * 用法：npx ts-node --transpile-only .p7aqa-artifacts/scripts/qa-p7a-zw.ts <RUN> <baseUrl> [calls]
 * 判据：≥20 次 /api/user/ledger 调用前后，四表行数/Σ、public 表数/索引数、表名/索引名集合**逐字不变**。
 * 收尾：DROP 本探针可能出现的自建表 public.p7aqa_zw_probe，并复核 public 表数回 25。
 */
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' }); dotenv.config();
type Row = Record<string, unknown>;
const RUN = process.argv[2] || 'ZW-QA001';
const BASE = process.argv[3] || 'http://127.0.0.1:5793';
const N = Number(process.argv[4] || 24);
const OUTDIR = `.p7aqa-artifacts/${RUN}`;
fs.mkdirSync(OUTDIR, { recursive: true });
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
const callSql = sql as unknown as (q: string, p?: unknown[]) => Promise<Row[]>;
const SECRET = String(process.env.SECRET_KEY || '');

const b64u = (v: string) => Buffer.from(v).toString('base64url');
const jwt = (uid: number, evm: string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};

const SNAP = `
  SELECT (SELECT COUNT(1)::int FROM public.ledger_entry) AS ledger_rows,
         (SELECT COALESCE(SUM(delta),0)::text FROM public.ledger_entry) AS ledger_sum_delta,
         (SELECT COUNT(1)::int FROM public.account) AS account_rows,
         (SELECT COALESCE(SUM(balance),0)::text FROM public.account) AS account_sum_balance,
         (SELECT COUNT(1)::int FROM public.users) AS users_rows,
         (SELECT COUNT(1)::int FROM public.currency) AS currency_rows,
         (SELECT COUNT(1)::int FROM information_schema.tables WHERE table_schema='public') AS public_tables,
         (SELECT COUNT(1)::int FROM pg_indexes WHERE schemaname='public') AS public_indexes,
         (SELECT string_agg(table_name::text, ',' ORDER BY table_name) FROM information_schema.tables WHERE table_schema='public') AS table_names,
         (SELECT string_agg(indexname::text, ',' ORDER BY indexname) FROM pg_indexes WHERE schemaname='public') AS index_names,
         (SELECT COUNT(1)::int FROM information_schema.tables WHERE table_schema='public' AND table_name='p7aqa_zw_probe') AS zw_probe_exists
`;
const snap = async (): Promise<Row> => (await callSql(SNAP, []))[0];

(async () => {
  const fx = JSON.parse(fs.readFileSync('.p7aqa-artifacts/FIXTURE-P7AQA001/fixture-P7AQA001.json', 'utf8'));
  const uid = Number(fx.fixture.uids.A); const evm = String(fx.fixture.evm_a);
  const token = jwt(uid, evm);
  const out: Row = { run: RUN, probe: 'qa-p7a-zw', base: BASE, planned_calls: N };

  // ★ 基线：**首个 HTTP 调用之前**
  const before = await snap();
  out.before = before;

  const plan = ['?limit=10', '?limit=3', '', '?kind=transfer', '?cid=35', '?limit=abc'];
  const responses: Row[] = [];
  let calls = 0;
  for (let i = 0; i < N; i += 1) {
    const q = plan[i % plan.length];
    const r = await fetch(`${BASE}/api/user/ledger${q}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => null) as Row | null;
    const n = Array.isArray(j?.data) ? (j!.data as unknown[]).length : null;
    responses.push({ q, status: r.status, n });
    calls += 1;
  }
  const after = await snap();
  out.calls = calls;
  out.after = after;

  const keys = Object.keys(before as Row);
  const diffs = keys.filter((k) => String((before as Row)[k]) !== String((after as Row)[k]));
  out.diff_keys = diffs;
  const violations: string[] = [];
  if (diffs.length) violations.push(`快照字段变化: ${diffs.join(',')}`);
  if (String((after as Row).public_tables) !== '25') violations.push(`public 表数 ${(before as Row).public_tables} → ${(after as Row).public_tables}`);
  if (String((after as Row).public_indexes) !== '65') violations.push(`public 索引数 ${(before as Row).public_indexes} → ${(after as Row).public_indexes}`);
  if (String((after as Row).zw_probe_exists) !== '0') violations.push('public.p7aqa_zw_probe 出现（只读面建表）');
  out.violations = violations;
  out.verdict = violations.length === 0 ? 'GREEN' : 'RED';

  // 收尾：DROP 自建探针表（若变异建出）+ 复核
  await callSql('DROP TABLE IF EXISTS public.p7aqa_zw_probe', []);
  const post = await snap();
  out.after_cleanup = { public_tables: post.public_tables, public_indexes: post.public_indexes, zw_probe_exists: post.zw_probe_exists };
  out.cleanup_ok = String(post.public_tables) === '25' && String(post.zw_probe_exists) === '0';

  fs.writeFileSync(`${OUTDIR}/qa-zw-${RUN}.json`, JSON.stringify(out, null, 1));
  console.log(JSON.stringify({ run: RUN, verdict: out.verdict, calls, violations, before_tables: (before as Row).public_tables, after_tables: (after as Row).public_tables, cleanup_ok: out.cleanup_ok, after_cleanup: out.after_cleanup }, null, 1));
  process.exitCode = violations.length === 0 ? 0 : 1;
})().catch((e) => { console.error('ZW-FAILED', String(e).slice(0, 600)); process.exit(2); });
