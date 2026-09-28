/**
 * P3-M-00 · 只读基线探针（迁移前）：库态指纹 + 账本助手清点 + 缺口排查用的库级真值。
 * 只读：本脚本**不执行任何写语句**（除 schema_migration 表的存在性探测也是 SELECT）。
 * 读法：`node --require ts-node/register` 或 `npx ts-node --transpile-only scripts/p3m-00-state.ts`
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  mkPool, raw, raw1, save, sha256, md5, mkPool as _mk, OUT_DIR, RUN,
} from './p3m-lib';

const main = async () => {
  const p = mkPool();
  try {
    const registry = await raw<{ version: string; name: string; checksum: string; applied_at: string }>(
      p, 'SELECT version, name, checksum, applied_at::text AS applied_at FROM public.schema_migration ORDER BY version',
    );
    const tables = await raw<{ table_name: string }>(
      p, `SELECT table_name FROM information_schema.tables
           WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY table_name`,
    );
    const views = await raw<{ table_name: string }>(
      p, `SELECT table_name FROM information_schema.views WHERE table_schema='public' ORDER BY table_name`,
    );
    const funcs = await raw<{ proname: string; args: string; bytes: number; md5: string }>(
      p, `SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args,
                 octet_length(p.prosrc) AS bytes, md5(p.prosrc) AS md5
            FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' ORDER BY p.proname, 2`,
    );

    const helperChecks: Record<string, boolean> = {};
    for (const sig of [
      'public.ledger_post_event(jsonb)', 'public.ledger_raise(text,jsonb)',
      'public.ledger_int_amount(text,text)', 'public.ledger_uid_arg(text,text)',
      'public.ledger_max_single_amount()', 'public.ledger_kind_ok(text)',
      'public.ledger_assert_currency_op(public.currency,text)',
      'public.ledger_payload_amount(jsonb,integer,text,text)',
      'public.ledger_foreign_namespace_roots()',
    ]) {
      const r = await raw1<{ ok: boolean }>(p, `SELECT to_regprocedure($1) IS NOT NULL AS ok`, [sig]);
      helperChecks[sig] = !!r?.ok;
    }

    // ---- ledger_post_event 体：op / currency_op 取值面（现取，不凭记忆）
    const lpe = await raw1<{ prosrc: string }>(
      p, `SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ledger_post_event'`,
    );
    const src = lpe?.prosrc ?? '';
    const lpePath = path.join(OUT_DIR, `p3m-${RUN}-ledger_post_event.prosrc.sql`);
    fs.mkdirSync(OUT_DIR, { recursive: true });
    if (src && !fs.existsSync(lpePath)) fs.writeFileSync(lpePath, src);
    const tokens = ['entries', 'hold', 'hold_release', 'settle', 'mint', 'transfer', 'release', 'freeze', 'reversal', 'job_escrow', 'trade'];
    const tokenHits = Object.fromEntries(tokens.map((t) => [t, (src.match(new RegExp(`'${t}'`, 'g')) || []).length]));
    const notIn = [...src.matchAll(/v_op\s+NOT IN\s*\(([^)]*)\)/g)].map((m) => m[1].replace(/\s+/g, ' '));
    const curOpLines = src.split('\n').map((l) => l.trim()).filter((l) => /currency_op/i.test(l)).slice(0, 24);

    // ---- 错误码域：谁藏着 code 白名单
    const codeHolders = await raw<{ proname: string; bytes: number }>(
      p, `SELECT p.proname, octet_length(p.prosrc) AS bytes FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.prosrc LIKE '%LEDGER_UNKNOWN_KIND%' ORDER BY p.proname`,
    );
    const raiseSrc = await raw1<{ prosrc: string }>(
      p, `SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ledger_raise' LIMIT 1`,
    );
    const codes = [...new Set((raiseSrc?.prosrc ?? '').match(/LEDGER_[A-Z_]+/g) || [])].sort();
    const aco = await raw1<{ prosrc: string }>(
      p, `SELECT p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
           WHERE n.nspname='public' AND p.proname='ledger_assert_currency_op' LIMIT 1`,
    );

    // ---- 数据结构事实
    const usersCols = await raw(
      p, `SELECT column_name, is_nullable, column_default, data_type, identity_generation
            FROM information_schema.columns WHERE table_schema='public' AND table_name='users'
           ORDER BY ordinal_position`,
    );
    const uidWindow = await raw(p, 'SELECT uid::text AS uid FROM public.users WHERE uid BETWEEN 990501 AND 990504 ORDER BY uid');
    const uidSeq = await raw1(p, `SELECT last_value::text AS last_value, is_called FROM public.users_uid_seq`);
    const listedCur = await raw(
      p, `SELECT c.cid::text AS cid, c.symbol, c.decimals, c.status, c.owner_uid::text AS owner_uid,
                 c.total_supply::text AS total_supply,
                 (SELECT count(*)::text FROM public.account a WHERE a.cid=c.cid AND a.balance>0) AS holders,
                 (SELECT COALESCE(max(a.balance),0)::text FROM public.account a WHERE a.cid=c.cid AND a.uid>0) AS max_bal
            FROM public.currency c WHERE c.status='listed' ORDER BY c.cid LIMIT 40`,
    );
    const cid1 = await raw1(
      p, `SELECT (SELECT COALESCE(sum(balance+frozen),0)::text FROM public.account WHERE cid=1) AS sum_bal_frozen,
                 (SELECT COALESCE(sum(balance),0)::text FROM public.account WHERE cid=1) AS sum_bal,
                 (SELECT COALESCE(sum(frozen),0)::text FROM public.account WHERE cid=1) AS sum_frozen,
                 (SELECT total_supply::text FROM public.currency WHERE cid=1) AS total_supply`,
    );
    const platform = await raw(
      p, `SELECT uid::text AS uid, cid::text AS cid, balance::text AS balance, frozen::text AS frozen
            FROM public.account WHERE uid IN (0,-1,-2,-3) ORDER BY uid, cid LIMIT 40`,
    );
    const ledgerTotal = await raw1(p, 'SELECT count(*)::text AS n FROM public.ledger_entry');
    const kinds = await raw(p, `SELECT k::text AS kind, public.ledger_kind_ok(k) AS ok FROM (
        VALUES ('purchase'),('sale'),('purchase_refund'),('hold'),('hold_release'),('hold_forfeit'),
               ('trade'),('trade_fee'),('job_escrow'),('job_payout'),('job_fee'),('transfer'),
               ('mint'),('burn'),('reversal'),('commission'),('listing_fee'),('listing_deposit'),
               ('currency_create_fee'),('job_escrow_refund')) AS t(k)`,);
    const trgEnabled = await raw1(
      p, `SELECT count(*) FILTER (WHERE tgenabled='O')::text AS enabled,
                 count(*) FILTER (WHERE tgenabled<>'O')::text AS not_enabled
            FROM pg_trigger WHERE NOT tgisinternal`,
    );

    // ---- 命名空间/外来中间态闸（发现非本单所为的 0016 痕迹 ⇒ 立即停手）
    const nsPre = await raw1(p, `SELECT
        to_regclass('public.market_order') IS NULL AS market_order_absent,
        to_regclass('public.market_trade') IS NULL AS market_trade_absent,
        to_regclass('public.candle_view') IS NULL AS candle_view_absent,
        (SELECT count(*) FROM public.schema_migration WHERE version='0016') AS registry_0016_rows,
        (SELECT count(*) FROM public.ledger_entry WHERE event_root_key LIKE 'biz:market:%') AS biz_market_entries,
        (SELECT count(*) FROM public.ledger_entry WHERE event_root_key LIKE 'cli:kong16%') AS kong16_entries,
        (SELECT count(*) FROM public.ledger_entry WHERE event_root_key LIKE 'ops:p3m:%') AS p3m_entries`);

    const out = {
      run: RUN,
      db_url_present: !!process.env.DATABASE_URL_UNPOOLED,
      schema_version: registry.length ? registry[registry.length - 1].version : null,
      registry_rows: registry.length,
      registry_tail: registry.slice(-3).map((r) => ({ version: r.version, name: r.name, checksum: r.checksum, applied_at: r.applied_at })),
      public_base_tables: tables.map((t) => t.table_name),
      public_base_table_count: tables.length,
      public_views: views.map((v) => v.table_name),
      public_functions_count: funcs.length,
      public_functions: funcs,
      helper_checks: helperChecks,
      ledger_post_event: { bytes: Buffer.byteLength(src), md5: md5(src), tokens: tokenHits, v_op_NOT_IN: notIn, currency_op_lines: curOpLines, prosrc_file: src ? lpePath : null },
      code_holders: codeHolders,
      ledger_raise_codes_count: codes.length,
      ledger_raise_codes: codes,
      ledger_assert_currency_op_prosrc: (aco?.prosrc ?? '').slice(0, 4000),
      users_columns: usersCols,
      uid_window_9905xx_pre: uidWindow,
      users_uid_seq: uidSeq,
      listed_currencies: listedCur,
      cid1_invariant: cid1,
      platform_accounts: platform,
      ledger_entry_total: ledgerTotal,
      kinds_check_20: kinds,
      trigger_enabled_global: trgEnabled,
      namespace_pre: nsPre,
    };
    const file = save('state-pre', out);
    console.log(JSON.stringify({
      artifact: file,
      schema_version: out.schema_version,
      registry_rows: out.registry_rows,
      table_count: out.public_base_table_count,
      tables: out.public_base_tables,
      namespace_pre: out.namespace_pre,
      uid_window_free: out.uid_window_9905xx_pre.length === 0,
      listed_currency_count: listedCur.length,
      cid1_invariant: cid1,
      ledger_entry_total: ledgerTotal,
      functions: out.public_functions_count,
      views: out.public_views,
      helpers: helperChecks,
      ledger_post_event_bytes: out.ledger_post_event.bytes,
      v_op_not_in: notIn,
      code_holders: codeHolders,
      kinds_bad: kinds.filter((k) => !k.ok).map((k) => k.kind),
    }, null, 2));
  } finally {
    await p.end().catch(() => undefined);
  }
};

main().catch((e) => {
  console.error('p3m-00 fatal:', String((e as Error)?.message || e).slice(0, 400));
  process.exit(2);
});
