// p4z-b3afix2-00-probe.ts — P4-B3a-FIX-A2 取证探针（**只读**；禁写业务数据）
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix2-00-probe.ts <outDir> <tag>
// 用途：现取 live `pg_get_functiondef('public.ledger_post_event')` 完整原文并落盘（产物），
//       定位 hold 家族 IN 列表的准确行号 + 上下文；并取迁移注册表 / kind 关闭集 / 断言函数读数。
// tag = pre | post（决定产物文件名，便于逐字 diff）。
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix2-run'));
const tag = String(process.argv[3] || 'pre');
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
const url = String(process.env.DATABASE_URL || process.env.POSTGRES_URL || '');
if (!url) throw new Error('NO_DATABASE_URL');
const sql = neon(url);

const attempt = async (label: string, q: string) => {
  try { return { label, ok: true, rows: await sql(q) }; }
  catch (e) {
    const anyE = e as Record<string, unknown>;
    return { label, ok: false, error: String(anyE?.message || e).slice(0, 300), code: anyE?.code ?? null };
  }
};

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), mode: 'READ-ONLY', tag };

  // ---------- 1. live ledger_post_event 完整原文（逐字落盘） ----------
  const pe = (await sql(`SELECT pg_get_functiondef(p.oid) AS def, p.oid::text AS oid, md5(pg_get_functiondef(p.oid)) AS md5,
                                length(pg_get_functiondef(p.oid))::int AS len, p.prosrc IS NOT NULL AS has_src
                           FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                          WHERE p.proname = 'ledger_post_event' AND n.nspname = 'public'`)) as Array<Record<string, unknown>>;
  if (!pe.length) throw new Error('NO_FN ledger_post_event');
  const def = String(pe[0].def);
  const defPath = path.join(outDir, `${tag}-ledger_post_event.def.sql`);
  fs.writeFileSync(defPath, def);

  const lines = def.split('\n');
  const holdListLines: Array<{ line_no: number; text: string }> = [];
  lines.forEach((l, i) => {
    if (l.includes("'job_escrow_refund'")) holdListLines.push({ line_no: i + 1, text: l });
  });
  const listingDepositLines: Array<{ line_no: number; text: string }> = [];
  lines.forEach((l, i) => {
    if (l.includes('listing_deposit')) listingDepositLines.push({ line_no: i + 1, text: l });
  });
  const holdPairLines: Array<{ line_no: number; text: string }> = [];
  lines.forEach((l, i) => {
    if (l.includes('HOLD_PAIR_REQUIRED')) holdPairLines.push({ line_no: i + 1, text: l });
  });

  // IN 列表整段上下文（±3 行）
  const ctx: Array<{ line_no: number; text: string }> = [];
  if (holdListLines.length) {
    const c = holdListLines[0].line_no;
    for (let i = Math.max(1, c - 3); i <= Math.min(lines.length, c + 3); i++) ctx.push({ line_no: i, text: lines[i - 1] });
  }

  out.fn_meta = { oid: pe[0].oid, md5: pe[0].md5, len: pe[0].len, line_count: lines.length, def_path: defPath };
  out.hold_family_in_list_lines = holdListLines;
  out.listing_deposit_occurrences = listingDepositLines;
  out.hold_pair_required_lines = holdPairLines;
  out.in_list_context_pm3 = ctx;

  // ---------- 2. 其余只读取数 ----------
  const queries: Array<[string, string]> = [
    ['registry', `SELECT version, name, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version`],
    ['registry_count', `SELECT count(*)::int AS n FROM public.schema_migration`],
    ['kind_check_def', `SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conrelid = 'public.ledger_entry'::regclass AND c.conname = 'ledger_kind_enum'`],
    ['kind_count_text_occurrences', `SELECT (length(pg_get_constraintdef(c.oid)) - length(replace(pg_get_constraintdef(c.oid), '::text', ''))) / 6 AS n FROM pg_constraint c WHERE c.conrelid = 'public.ledger_entry'::regclass AND c.conname = 'ledger_kind_enum'`],
    ['fn_assert_mutation_def', `SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE p.proname = 'ledger_assert_platform_mutation' AND n.nspname = 'public'`],
    ['probe_neg_listing_deposit_credit', `SELECT public.ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'credit') AS r`],
    ['probe_neg_commission_credit', `SELECT public.ledger_assert_platform_mutation(-1::bigint, 'commission', 'credit') AS r`],
    ['probe_neg_m1_debit', `SELECT public.ledger_assert_platform_mutation(-1::bigint, 'listing_deposit', 'debit') AS r`],
    ['account_sigma', `SELECT COALESCE(sum(balance+frozen),0)::text AS s FROM public.account`],
    ['entry_count', `SELECT count(*)::int AS n FROM public.ledger_entry`],
    ['pool_pids_list', `SELECT pg_backend_pid()::text AS pid`],
  ];
  for (const [label, q] of queries) out[label] = await attempt(label, q);

  const p = path.join(outDir, `${tag}-probe.json`);
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('WROTE ' + p);
  console.log('FN_META ' + JSON.stringify(out.fn_meta));
  console.log('HOLD_LIST_LINES ' + JSON.stringify(holdListLines));
  console.log('LISTING_DEPOSIT_LINES ' + JSON.stringify(listingDepositLines));
  console.log('HOLDPAIR_LINES ' + JSON.stringify(holdPairLines));
  console.log('CTX ' + JSON.stringify(ctx, null, 0));
  console.log('REGISTRY_COUNT ' + JSON.stringify((out.registry_count as { rows?: unknown }).rows));
};

main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
