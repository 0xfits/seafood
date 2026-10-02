/**
 * p7a-02-negctl.ts — 批 7-A ①(b) **「零写副作用」判负自证**（只读面 HTTP 探针 + 库侧自检）
 * ============================================================================
 * 为什么另起（而非复用 p7a-01-http.ts）：p7a-01 的 AC5 用「调用前后快照对拍」，
 *   对**在快照之前就已存在**的表是**盲的** —— 变异体在第一次库访问即建表，
 *   之后 before/after 都读到同一张表 ⇒ `identical=true` 会**误判 PASS**。
 *   ⇒ 本探针把基线取在**第一个 HTTP 调用之前**，任何「只读面建表/建索引」都抓得住。
 *
 * 判据（任一即 RED）：
 *   ① `public.p7a_neg_probe` 出现（探针表存在）；
 *   ② `information_schema.tables` 的 public 表数 ≠ 基线；
 *   ③ `pg_indexes` 的 public 索引数 ≠ 基线。
 * 收尾：`DROP TABLE IF EXISTS public.p7a_neg_probe`（**只清本单自建的探针表**，不碰任何既有行）；
 *       复核 public 表数回到基线。
 *
 * 用法：node_modules/.bin/ts-node --transpile-only scripts/p7a-02-negctl.ts <runDirAbs> <baseUrl>
 * 产物：<runDir>/p7a-02-negctl-<RUN>.json（不落 token / 密钥）
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { neon } from '@neondatabase/serverless';

dotenv.config({ path: '.env.local' });
dotenv.config();

const outDir = path.resolve(process.argv[2] || '');
if (!process.argv[2]) throw new Error('usage: <runDir> <baseUrl>');
const BASE = process.argv[3] || 'http://127.0.0.1:5793';
const RUN = path.basename(outDir);
fs.mkdirSync(outDir, { recursive: true });

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
if (!url) throw new Error('no DB url');
const sql = neon(url);
const SECRET = String(process.env.SECRET_KEY || '');
const b64u = (v: string | Buffer) => Buffer.from(v).toString('base64url');
const jwt = (uid: number | string) => {
  const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const p = b64u(JSON.stringify({ sub: String(uid), evm: `0x7a0${String(uid).padStart(5, '0')}`, exp: Math.floor(Date.now() / 1000) + 3600 }));
  const u = `${h}.${p}`;
  return `${u}.${crypto.createHmac('sha256', SECRET).update(u).digest('base64url')}`;
};
const fp = (t: string) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 12);

type Row = Record<string, unknown>;
const raw = async <T = Row>(query: string, params: unknown[] = []): Promise<T[]> => {
  const parts: string[] = [];
  const values: unknown[] = [];
  let buf = '';
  for (let i = 0; i < query.length; i += 1) {
    if (query[i] === '$' && /\d/.test(query[i + 1] ?? '')) {
      let j = i + 1; let num = '';
      while (j < query.length && /\d/.test(query[j])) { num += query[j]; j += 1; }
      parts.push(buf); buf = '';
      values.push(params[Number(num) - 1]);
      i = j - 1;
    } else buf += query[i];
  }
  parts.push(buf);
  const strings = Object.assign([...parts], { raw: [...parts] }) as unknown as TemplateStringsArray;
  return (await (sql as unknown as (s: TemplateStringsArray, ...v: unknown[]) => Promise<unknown>)(strings, ...values)) as T[];
};

const call = async (p: string, opts: { token?: string } = {}) => {
  const headers: Record<string, string> = {};
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  try {
    const res = await fetch(BASE + p, { headers, signal: AbortSignal.timeout(30000) });
    await res.text();
    return { status: res.status };
  } catch (e) {
    return { status: 'NETERR' as unknown as number, err: String(e).slice(0, 120) };
  }
};

const PROBE_TABLE = 'p7a_neg_probe';
const snapshot = async () => {
  const tb = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM information_schema.tables WHERE table_schema='public'`);
  const ix = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM pg_indexes WHERE schemaname='public'`);
  const ex = await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name='${PROBE_TABLE}'`);
  let rows: number | null = null;
  if (ex[0].n > 0) {
    try { rows = (await raw<{ n: number }>(`SELECT COUNT(1)::int AS n FROM public.${PROBE_TABLE}`))[0].n; } catch { rows = null; }
  }
  return { public_tables: tb[0].n, public_indexes: ix[0].n, probe_exists: ex[0].n > 0, probe_rows: rows };
};

async function main() {
  const out: Record<string, unknown> = { run: RUN, base: BASE, probe: 'p7a-02-negctl', secret_fp: fp(SECRET) };

  // ── 0) 基线（**第一个 HTTP 调用之前**）：先清掉本单自建的探针表（若上轮残留），再取数 ──
  await raw(`DROP TABLE IF EXISTS public.${PROBE_TABLE}`);
  const baseline = await snapshot();
  out.baseline = baseline;

  // 夹具：流水最多的真实用户
  const urows = await raw<{ uid: string; n: number }>(
    `SELECT uid::text AS uid, COUNT(1)::int AS n FROM public.ledger_entry WHERE uid > 0 GROUP BY uid ORDER BY n DESC LIMIT 2`);
  const primary = Number(urows[0].uid);
  const secondary = Number(urows[1]?.uid ?? urows[0].uid);
  out.fixtures = { primary_uid: primary, secondary_uid: secondary };
  const T1 = jwt(primary);
  const T2 = jwt(secondary);

  // ── 1) 24 次只读调用（与 p7a-01 同族路径组合）───────────────────────────────
  const paths = ['/api/user/ledger', '/api/user/ledger?limit=5', '/api/user/ledger?kind=transfer',
    '/api/user/ledger?limit=1', '/api/user/ledger?before_txid=240', '/api/user/ledger?cid=1'];
  const statuses: number[] = [];
  let calls = 0;
  for (let i = 0; i < 24; i += 1) {
    const r = await call(paths[i % paths.length], { token: i % 2 === 0 ? T1 : T2 });
    statuses.push(r.status); calls += 1;
  }
  out.calls = calls;
  out.statuses = statuses;

  // ── 2) 调用后快照 + 判负 ────────────────────────────────────────────────────
  const after = await snapshot();
  out.after_calls = after;
  const tablesChanged = after.public_tables !== baseline.public_tables;
  const indexesChanged = after.public_indexes !== baseline.public_indexes;
  const probeAppeared = !baseline.probe_exists && after.probe_exists;
  const reasons: string[] = [];
  if (probeAppeared) reasons.push(`public.${PROBE_TABLE} 出现（只读面建表）`);
  if (tablesChanged) reasons.push(`public 表数 ${baseline.public_tables} → ${after.public_tables}`);
  if (indexesChanged) reasons.push(`public 索引数 ${baseline.public_indexes} → ${after.public_indexes}`);
  out.zero_write_violations = reasons;
  out.verdict = reasons.length === 0 ? 'GREEN' : 'RED';

  // ── 3) 收尾：只清本单自建探针表，复核 public 表数回基线 ──────────────────────
  await raw(`DROP TABLE IF EXISTS public.${PROBE_TABLE}`);
  const post = await snapshot();
  out.after_cleanup = post;
  out.cleanup_ok = post.public_tables === baseline.public_tables && !post.probe_exists;

  const file = path.join(outDir, `p7a-02-negctl-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
  console.log(`WROTE ${file}`);
  console.log(`VERDICT ${out.verdict} violations=${reasons.length} cleanup_ok=${out.cleanup_ok}`);
  // 判负自证：RED（检出违规）⇒ exit 1；GREEN ⇒ 0。cleanup 未回基线亦判 1（残留即污染）。
  process.exitCode = (reasons.length === 0 && out.cleanup_ok) ? 0 : 1;
}

main().catch((e) => { console.error('ERR', e); process.exit(1); });
