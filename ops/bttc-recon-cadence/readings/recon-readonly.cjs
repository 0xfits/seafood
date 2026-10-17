// 只读对账探针（零写 · 命令里不含连接串 · 串从 600 权限的 env 文件读入、永不打印）
// 用法：node recon-readonly.cjs [envFile]
// 纪律：本文件只发 SELECT；不开事务、不 SET、不写任何表。
const { createRequire } = require('module');
const fs = require('fs');
const path = require('path');

const REPO = '/Users/kevin/bistro/seafood';
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');

const envFile = process.argv[2] || path.join(process.env.HOME, '.config/seafood/prod-db.env');
const envText = fs.readFileSync(envFile, 'utf8');
const pick = (k) => {
  const m = envText.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : '';
};
const url = pick('DATABASE_URL_UNPOOLED') || pick('POSTGRES_URL_NON_POOLING') || pick('DATABASE_URL');
if (!url) { console.log('ABORT=no_database_url'); process.exit(3); }
if (!/^postgres(ql)?:\/\//.test(url)) { console.log('ABORT=bad_url_shape'); process.exit(3); }
console.log('ENVFILE=', envFile, 'URL_PRINTED=no');

const out = {};
(async () => {
  const sql = neon(url);

  out.identity = (await sql`SELECT current_setting('neon.project_id', true) AS project_id,
                                   current_setting('neon.branch_id', true) AS branch_id,
                                   current_database() AS db`)[0];

  out.counts = (await sql`SELECT
      (SELECT count(*)::int FROM public.currency)   AS currency,
      (SELECT count(*)::int FROM public.ledger_entry) AS ledger_entry,
      (SELECT count(*)::int FROM public.account)    AS account,
      (SELECT count(*)::int FROM public.batt_account) AS batt_account,
      (SELECT count(*)::int FROM public.batt_entry) AS batt_entry,
      (SELECT count(*)::int FROM public.app_config) AS app_config`)[0];

  out.schema_top = (await sql`SELECT version, name FROM public.schema_migration ORDER BY version DESC LIMIT 2`);

  // ① 供应量 vs 账本（符号约定：burn 分录 delta 为负 ⇒ total_supply == Σmint + Σburn）
  out.supply_recon = await sql`
    SELECT c.cid::text AS cid, c.symbol, c.total_supply::text AS total_supply,
           COALESCE(l.sum_mint, 0)::text  AS sum_mint,
           COALESCE(l.sum_burn, 0)::text  AS sum_burn,
           (COALESCE(l.sum_mint,0) + COALESCE(l.sum_burn,0))::text AS ledger_derived,
           (c.total_supply - (COALESCE(l.sum_mint,0) + COALESCE(l.sum_burn,0)))::text AS diff
      FROM public.currency c
      LEFT JOIN (SELECT cid,
                        SUM(delta) FILTER (WHERE kind='mint') AS sum_mint,
                        SUM(delta) FILTER (WHERE kind='burn') AS sum_burn
                   FROM public.ledger_entry GROUP BY cid) l
             ON l.cid = c.cid
     ORDER BY c.cid`;

  // ② account.balance/frozen vs Σ ledger_entry.delta/frozen_delta 逐户
  out.account_drift = await sql`
    SELECT a.uid::text AS uid, a.cid::text AS cid,
           a.balance::text AS balance, COALESCE(s.d,0)::text AS sum_delta,
           (a.balance - COALESCE(s.d,0))::text AS diff_balance,
           a.frozen::text AS frozen, COALESCE(s.f,0)::text AS sum_frozen_delta,
           (a.frozen - COALESCE(s.f,0))::text AS diff_frozen
      FROM public.account a
      LEFT JOIN (SELECT uid, cid, SUM(delta) AS d, SUM(frozen_delta) AS f
                   FROM public.ledger_entry GROUP BY uid, cid) s
             ON s.uid = a.uid AND s.cid = a.cid
     WHERE a.balance <> COALESCE(s.d,0) OR a.frozen <> COALESCE(s.f,0)
     ORDER BY a.uid, a.cid`;

  // ③ batt_account.batt vs Σ batt_entry.delta 逐户
  out.batt_drift = await sql`
    SELECT b.uid::text AS uid, b.batt::int AS batt,
           COALESCE(e.d,0)::int AS sum_delta,
           (b.batt - COALESCE(e.d,0))::int AS diff
      FROM public.batt_account b
      LEFT JOIN (SELECT uid, SUM(delta) AS d FROM public.batt_entry GROUP BY uid) e
             ON e.uid = b.uid
     WHERE b.batt <> COALESCE(e.d,0)
     ORDER BY b.uid`;

  // ④ 事件级配对不变式（排除 mint/burn：它们本就单边）
  out.event_pairing = await sql`
    SELECT ref_type, ref_id::text AS ref_id,
           SUM(delta + frozen_delta)::text AS net, count(*)::int AS legs
      FROM public.ledger_entry
     WHERE kind NOT IN ('mint','burn')
     GROUP BY ref_type, ref_id
    HAVING SUM(delta + frozen_delta) <> 0
     ORDER BY ref_type, ref_id`;

  // ⑤ kind 分布（含 burn 是否存在历史绕行写）
  out.kinds = await sql`
    SELECT kind, count(*)::int AS n, SUM(delta)::text AS sum_delta
      FROM public.ledger_entry GROUP BY kind ORDER BY n DESC`;

  // ⑥ BTTC 币种行 + 策略键
  out.bttc_row = await sql`
    SELECT cid::text AS cid, symbol, name, decimals::int AS decimals, status,
           total_supply::text AS total_supply, is_platform_coin
      FROM public.currency WHERE symbol='BTTC'`;
  out.policy = await sql`SELECT key, jsonb_typeof(value) AS vtype, time_updated
                           FROM public.app_config WHERE key LIKE '%mint%' OR key LIKE '%batt%'`;

  fs.writeFileSync(path.join(__dirname, 'recon-prod-' + new Date().toISOString().replace(/[:.]/g,'') + '.json'),
    JSON.stringify(out, null, 2));
  console.log(JSON.stringify(out, null, 2));
})().catch((e) => { console.log('ERROR=', e && e.message); process.exit(1); });
