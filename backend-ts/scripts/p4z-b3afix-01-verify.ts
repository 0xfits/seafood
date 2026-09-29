// p4z-b3afix-01-verify.ts — P4-B3a-FIX-A 验证（TS 模块断言 + DB 侧断言 + 真事件正/负对照 + 幂等/注册表）
// 用法：npx ts-node --transpile-only scripts/p4z-b3afix-01-verify.ts <outDir>
// 口径：每步单独 try/catch，读数落盘；不落 token/密钥本体。
import * as fs from 'fs';
import * as path from 'path';

const REPO = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || path.join(REPO, '.p4-artifacts', 'b3afix-run'));
fs.mkdirSync(outDir, { recursive: true });
const RUN = path.basename(outDir);

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
const ledger = require(path.join(REPO, 'src', 'ledger')) as {
  HOLD_KINDS: string[];
  LEDGER_KINDS: string[];
  assertPlatformAccountMutation: (u: bigint, k: string, d: 'credit' | 'debit') => void;
  postEvent: (i: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

const steps: Record<string, unknown> = {};
const run = async (name: string, fn: () => Promise<unknown> | unknown) => {
  try { steps[name] = { ok: true, result: await fn() }; }
  catch (e) {
    const anyE = e as Record<string, unknown>;
    steps[name] = {
      ok: false,
      error_code: anyE?.code ?? null,
      error_message: String(anyE?.message || e).slice(0, 200),
      details: anyE?.details ?? null,
    };
  }
  const s = steps[name] as Record<string, unknown>;
  console.log(`[${s.ok ? 'PASS' : 'FAIL'}] ${name} :: ${JSON.stringify(s.ok ? s.result : { code: s.error_code, msg: s.error_message, details: s.details }).slice(0, 300)}`);
};

const expectThrow = async (name: string, wantCode: string, fn: () => Promise<unknown> | unknown) => {
  try {
    await fn();
    steps[name] = { ok: false, error_message: 'NOT-REJECTED (不得出现)' };
  } catch (e) {
    const anyE = e as Record<string, unknown>;
    const code = String(anyE?.code ?? '');
    steps[name] = {
      ok: code === wantCode,
      result: code === wantCode ? `rejected as expected: ${code}` : `rejected with WRONG code: ${code}`,
      details: anyE?.details ?? null,
    };
  }
  const s = steps[name] as Record<string, unknown>;
  console.log(`[${s.ok ? 'PASS' : 'FAIL'}] ${name} :: ${JSON.stringify(s.ok ? s.result : { msg: s.error_message, details: s.details }).slice(0, 300)}`);
};

const countEntries = async () => Number(((await sql('SELECT count(*)::int AS n FROM public.ledger_entry')) as Array<{ n: number }>)[0].n);
const sigma = async () => String(((await sql('SELECT COALESCE(sum(balance+frozen),0)::text AS s FROM public.account')) as Array<{ s: string }>)[0].s);
const balancesOf = async (uid: string, cid: string) =>
  ((await sql(`SELECT balance::text AS b, frozen::text AS f FROM public.account WHERE uid = ${uid}::bigint AND cid = ${cid}::bigint`)) as Array<{ b: string; f: string }>)[0] ?? null;

const main = async () => {
  const out: Record<string, unknown> = { generated_at: new Date().toISOString(), run: RUN, phase: 'post-fix' };

  // ---------- A. 迁移注册表 ----------
  await run('registry_count_and_0019', async () => {
    const rows = (await sql(`SELECT version, name, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version`)) as Array<Record<string, string>>;
    return { count: rows.length, last: rows[rows.length - 1] };
  });

  // ---------- B. TS 侧：HOLD_KINDS / 白名单行为 ----------
  await run('ts_hold_kinds', () => ({
    hold_kinds: ledger.HOLD_KINDS,
    has_listing_deposit: ledger.HOLD_KINDS.includes('listing_deposit'),
    len: ledger.HOLD_KINDS.length,
  }));
  await run('ts_assert_platform_pos_listing_deposit_credit', () => {
    ledger.assertPlatformAccountMutation(-1n, 'listing_deposit', 'credit');
    return 'no-throw (已放行)';
  });
  await expectThrow('ts_assert_platform_neg_commission_credit', 'LEDGER_RESERVED_UID', () => {
    ledger.assertPlatformAccountMutation(-1n, 'commission', 'credit');
  });
  await expectThrow('ts_assert_platform_neg_listing_deposit_debit', 'LEDGER_RESERVED_UID', () => {
    ledger.assertPlatformAccountMutation(-1n, 'listing_deposit', 'debit');
  });

  // ---------- C. DB 侧：白名单函数直调 ----------
  await run('db_fn_pos_listing_deposit_credit', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-1::bigint,'listing_deposit','credit')`);
    return 'no-throw (已放行)';
  });
  await expectThrow('db_fn_neg_commission_credit', 'LD021', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-1::bigint,'commission','credit')`);
  });
  await expectThrow('db_fn_neg_listing_deposit_debit', 'LD021', async () => {
    await sql(`SELECT public.ledger_assert_platform_mutation(-1::bigint,'listing_deposit','debit')`);
  });

  // ---------- D. 夹具选择 ----------
  const cand = (await sql(`
    SELECT a.uid::text AS uid, a.cid::text AS cid, a.balance::text AS balance, c.symbol, c.status
      FROM public.account a
      JOIN public.currency c ON c.cid = a.cid
     WHERE a.uid > 0 AND a.balance >= 1
       AND EXISTS (SELECT 1 FROM public.account p WHERE p.uid = -1 AND p.cid = a.cid)
     ORDER BY a.uid, a.cid LIMIT 20`)) as Array<Record<string, string>>;
  out.fixture_candidates = cand;
  if (!cand.length) throw new Error('NO_FIXTURE_ACCOUNT (需要 uid>0 且 balance>=1 且该 cid 存在 -1 账户)');
  const fx = cand[0];
  out.fixture = fx;

  const AMT = 1;
  const KEY_POS = `cli:p4b3afix:${RUN}:pos:listing_deposit_to_platform`;
  const KEY_NEG = `cli:p4b3afix:${RUN}:neg:commission_to_platform`;
  const KEY_PAIR = `cli:p4b3afix:${RUN}:pos:listing_deposit_same_account_pair`;

  const n0 = await countEntries();
  const sig0 = await sigma();
  const bal0User = await balancesOf(fx.uid, fx.cid);
  const bal0P1 = await balancesOf('-1', fx.cid);

  // ---------- E. 正向：真事件「listing_deposit 消耗入 -1」----------
  await run('event_pos_listing_deposit_to_platform', async () => {
    const r = await ledger.postEvent({
      op: 'entries',
      idempotencyKey: KEY_POS,
      memo: 'p4b3afix positive: listing_deposit consumed into uid=-1',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
    return { txid: r.txid, entry_count: (r.entries as unknown[]).length, entries: r.entries, accounts: r.accounts };
  });

  // ---------- F. 负对照：非白名单 kind 贷 -1 必须仍拒 ----------
  await expectThrow('event_neg_commission_to_platform', 'LEDGER_RESERVED_UID', async () => {
    await ledger.postEvent({
      op: 'entries',
      idempotencyKey: KEY_NEG,
      memo: 'p4b3afix negative control: commission must NOT be creditable to uid=-1',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'commission' },
        { uid: '-1', cid: fx.cid, delta: `${AMT}`, kind: 'commission' },
      ],
    });
  });

  // ---------- G. 对照：同账户 hold 形状（HOLD_KINDS 移除后的形状差异）----------
  await run('event_pair_same_account_listing_deposit', async () => {
    const r = await ledger.postEvent({
      op: 'entries',
      idempotencyKey: KEY_PAIR,
      memo: 'p4b3afix control: same-account delta/frozen pair',
      entries: [
        { uid: fx.uid, cid: fx.cid, delta: `-${AMT}`, kind: 'listing_deposit' },
        { uid: fx.uid, cid: fx.cid, delta: '0', frozenDelta: `${AMT}`, kind: 'listing_deposit' },
      ],
    });
    return { txid: r.txid, entry_count: (r.entries as unknown[]).length };
  });

  const n1 = await countEntries();
  const sig1 = await sigma();
  out.deltas = {
    ledger_entry_n: { before: n0, after: n1, delta: n1 - n0 },
    sigma: { before: sig0, after: sig1, equal: sig0 === sig1 },
    user_account: { before: bal0User, after: await balancesOf(fx.uid, fx.cid) },
    platform_m1_account: { before: bal0P1, after: await balancesOf('-1', fx.cid) },
  };

  // ---------- H. 落表取证 ----------
  await run('entries_persisted', async () => ({
    pos: await sql(`SELECT txid::text, uid::text, cid::text, delta::text, frozen_delta::text, balance_after::text, kind, idempotency_key
                      FROM public.ledger_entry WHERE event_root_key = '${KEY_POS}' ORDER BY txid`),
    neg: await sql(`SELECT count(*)::int AS n FROM public.ledger_entry WHERE event_root_key = '${KEY_NEG}'`),
  }));

  // ---------- I. 迁移 SQL 幂等（原样重放本文件；走 Pool 简单查询，与 migrate.ts 同通道）----------
  await run('migration_0019_reapply_idempotent', async () => {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { Pool, neonConfig } = require('@neondatabase/serverless') as {
      Pool: new (o: Record<string, unknown>) => { connect: () => Promise<{ query: (q: string) => Promise<unknown>; release: () => void }>; end: () => Promise<void> };
      neonConfig: Record<string, unknown>;
    };
    neonConfig.webSocketConstructor = require('ws');
    const txUrl = String(process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || '');
    const pool = new Pool({ connectionString: txUrl, max: 1 });
    const client = await pool.connect();
    try {
      const body = fs.readFileSync(path.join(REPO, 'migrations', '0019_listing_deposit_platform_credit.sql'), 'utf8');
      await client.query(body);
      return `re-applied OK (${body.length} bytes, 无报错)`;
    } finally {
      client.release();
      await pool.end().catch(() => undefined);
    }
  });

  // ---------- J. 迁移后白名单/关闭集读数 ----------
  await run('db_fn_and_kind_readout', async () => {
    const fn = (await sql(`SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='ledger_assert_platform_mutation' AND n.nspname='public'`)) as Array<{ def: string }>;
    const chk = (await sql(`SELECT pg_get_constraintdef(c.oid) AS def FROM pg_constraint c WHERE c.conrelid='public.ledger_entry'::regclass AND c.conname='ledger_kind_enum'`)) as Array<{ def: string }>;
    const guard = (await sql(`SELECT position('''listing_deposit''' in pg_get_functiondef(p.oid)) AS has_deposit,
                                     position('HOLD_PAIR_REQUIRED' in pg_get_functiondef(p.oid)) AS has_hold_guard
                                FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                               WHERE p.proname='ledger_post_event' AND n.nspname='public'`)) as Array<Record<string, number>>;
    const pe = (await sql(`SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.proname='ledger_post_event' AND n.nspname='public'`)) as Array<{ def: string }>;
    const peLines = pe[0].def.split('\n');
    const guardIdx = peLines.findIndex((l) => l.includes('HOLD_PAIR_REQUIRED'));
    return {
      fn_def_m1_line: fn[0].def.split('\n').filter((l) => l.includes("'-1'") || l.includes('listing_deposit')),
      kind_check_def: chk[0].def,
      kind_check_value_count: (chk[0].def.match(/::text/g) || []).length,
      post_event_guard: guard[0],
      live_post_event_hold_list_line: peLines.filter((l) => l.includes("'job_escrow_refund'")),
      live_post_event_guard_hint_line: guardIdx >= 0 ? `def-line ${guardIdx + 1} (0-based ${guardIdx})` : 'NOT FOUND',
      live_post_event_total_lines: peLines.length,
    };
  });

  fs.writeFileSync(path.join(outDir, 'b3afix-01-verify.json'), JSON.stringify({ out, steps }, null, 1));
  console.log('WROTE ' + path.join(outDir, 'b3afix-01-verify.json'));
  console.log('SUMMARY ' + JSON.stringify(out.deltas));
};

main().catch((e) => { console.error('FATAL ' + String((e as Error)?.message || e)); process.exit(2); });
