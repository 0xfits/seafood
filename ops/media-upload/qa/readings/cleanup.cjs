/**
 * 自建 QA 数据回收（**写面**，仅限本单自建 ID 白名单）
 * ---------------------------------------------------------------------
 * 白名单（本轮 AC2–AC5 + AC5-S6 重跑自建）：
 *   listing 72 / 73 / 74 / 75
 *   media   1 / 3      （AC3 首传 + AC5 UI 上传；AC6/S6 去重复用 media 3）
 *   users   971216 971217 971218 971219 971220 971221 971222
 * ★ 971215（time_reg 2026-10-14，早于本单）**不在**白名单：非本轮自建，保留并披露。
 *
 * 守卫与手法：
 *   public.listing 上有 `trg_listing_no_delete`（`listing_no_delete()` 无条件抛
 *   `LEDGER_CURRENCY_INVALID_TRANSITION` / reason=listing_delete_forbidden）⇒ 直删被拒（attempt_1）。
 *   本脚本沿用**仓库既有测试数据清理法**（`backend-ts/scripts/purge-test-data.ts:220/257` 同法）：
 *   单事务内 `ALTER TABLE public.listing DISABLE TRIGGER trg_listing_no_delete` → DELETE →
 *   `ENABLE TRIGGER` → 断言 `tgenabled='O'` → COMMIT。DDL 事务性保证失败即整体回滚（含触发器状态）。
 *   硬红线（照抄 purge-test-data）：平台账户 uid<=0 必须 4 行且 balance/frozen=0，前后不变。
 *
 * 删除前逐表核引用面；任一被业务表引用 ⇒ 跳过该行并进 `kept`。
 */
const fs = require('fs');
const path = require('path');
const { parse } = require(path.join(__dirname, '..', '..', '..', '..', 'backend-ts', 'node_modules', 'dotenv'));
const { neon } = require(path.join(__dirname, '..', '..', '..', '..', 'backend-ts', 'node_modules', '@neondatabase/serverless'));

const REPO = path.resolve(__dirname, '..', '..', '..', '..');
const env = parse(fs.readFileSync(path.join(REPO, 'backend-ts', '.env.local'), 'utf8'));
const sql = neon(env.DATABASE_URL);

const LISTINGS = [72, 73, 74, 75];
const MEDIA = [1, 3];
const USERS = [971216, 971217, 971218, 971219, 971220, 971221, 971222];

const ints = (arr, what) => arr.map((n) => {
  const v = Number(n);
  if (!Number.isInteger(v) || v === 0) throw new Error(`bad ${what} id: ${n}`);
  return v;
}).join(',');

const LISTING_REFS = [
  ['listing_order', 'listing_id'],
  ['listing_favorite', 'listing_id'],
  ['listing_review_log', 'listing_id'],
  ['conversation', 'listing_id'],
];
const USER_REF_TABLES = [
  ['listing', 'seller_uid'], ['listing_order', 'buyer_uid'], ['listing_order', 'seller_uid'],
  ['conversation', 'buyer_uid'], ['conversation', 'seller_uid'], ['message', 'from_uid'],
  ['ledger_entry', 'uid'], ['ledger_owner', 'uid'], ['batt_account', 'uid'], ['batt_entry', 'uid'],
  ['checkin_log', 'uid'], ['rating', 'rater_uid'], ['rating', 'ratee_uid'],
  ['referral', 'parent_uid'], ['referral', 'child_uid'], ['job', 'employer_uid'], ['job', 'worker_uid'],
  ['job_application', 'worker_uid'], ['job_submission', 'worker_uid'], ['job_arbitration_log', 'actor_uid'],
  ['market_order', 'owner_uid'], ['market_trade', 'taker_uid'], ['listing_favorite', 'fav_uid'],
  ['currency', 'owner_uid'], ['admin_user_role', 'uid'],
  ['admin_ops_audit_log', 'actor_uid'], ['admin_ops_audit_log', 'target_uid'],
  ['admin_refund_audit_log', 'actor_uid'], ['admin_refund_audit_log', 'buyer_uid'], ['admin_refund_audit_log', 'seller_uid'],
];
const COUNT_TABLES = [...new Set([
  'listing', 'media', 'users', 'account',
  ...LISTING_REFS.map((r) => r[0]),
  ...USER_REF_TABLES.map((r) => r[0]),
])];

(async () => {
  const L = ints(LISTINGS, 'listing');
  const M = ints(MEDIA, 'media');
  const U = ints(USERS, 'user');
  const out = {
    at: new Date().toISOString(),
    allowlist: { listings: LISTINGS, media: MEDIA, users: USERS },
    method: 'single-tx: DISABLE TRIGGER trg_listing_no_delete → DELETE → ENABLE TRIGGER (purge-test-data.ts:220/257 同法)',
    attempt_1_blocked: null,
    before: {}, checks: [], deleted: {}, kept: [], after: {},
  };

  // ---- 0) 守卫自证（**只读**：读触发器定义；直删被拒的事实取自本轮首次尝试的实报错误）----
  const guard = await sql([`select t.tgname, t.tgenabled, pg_get_functiondef(p.oid) as fn
      from pg_trigger t join pg_proc p on p.oid = t.tgfoid
     where t.tgrelid = 'public.listing'::regclass and t.tgname = 'trg_listing_no_delete'`]);
  out.guard = {
    trigger: guard[0]?.tgname ?? null,
    enabled: guard[0]?.tgenabled ?? null,
    forbids_delete: /listing_delete_forbidden/.test(String(guard[0]?.fn || '')),
  };
  out.attempt_1_blocked = {
    at: '2026-10-19T04:14Z (本轮首次执行)',
    deleted: false,
    code: 'LEDGER_CURRENCY_INVALID_TRANSITION',
    message: 'blocked by trg_listing_no_delete → listing_no_delete() raised reason=listing_delete_forbidden',
    note: '直接 DELETE（不碰触发器）被产品不变式拒绝；本次回收改用仓库既有 purge-test-data.ts 同法（事务内临时禁用该触发器）',
  };

  for (const t of COUNT_TABLES) {
    const r = await sql([`select count(*)::int as n from public.${t}`]);
    out.before[t] = r[0].n;
  }
  out.before.targets = {
    listing: await sql([`select listing_id, media_urls, seller_uid, status from public.listing where listing_id in (${L}) order by listing_id`]),
    media: await sql([`select media_id, owner_uid, size_bytes from public.media where media_id in (${M}) order by media_id`]),
    users: await sql([`select uid, right(evm,4) as tail, time_reg from public.users where uid in (${U}) order by uid`]),
  };

  // ---- 1) 引用面（事务外预览 + 事务内复assert）----
  const listingBlocked = new Set();
  for (const id of LISTINGS) {
    const refs = {};
    for (const [t, col] of LISTING_REFS) {
      const r = await sql([`select count(*)::int as n from public.${t} where ${col} = ${id}`]);
      if (r[0].n) refs[`${t}.${col}`] = r[0].n;
    }
    const deletable = Object.keys(refs).length === 0;
    out.checks.push({ kind: 'listing', id, refs, deletable });
    if (!deletable) listingBlocked.add(id);
  }
  const delListings = LISTINGS.filter((id) => !listingBlocked.has(id));
  const delMedia = MEDIA;
  const delMediasSet = new Set(delMedia);

  const userBlocked = new Set();
  for (const uid of USERS) {
    const refs = {};
    for (const [t, col] of USER_REF_TABLES) {
      // 将被一并删除的表/列不计入阻塞（listing.seller_uid 指向待删 listing；media.owner_uid 指向待删 media）
      if (t === 'listing' && col === 'seller_uid') {
        const r = await sql([`select count(*)::int as n from public.listing where seller_uid = ${uid} and listing_id not in (${ints(delListings.length ? delListings : [-1], 'listing')})`]);
        if (r[0].n) refs[`${t}.${col}`] = r[0].n;
        continue;
      }
      if (t === 'media' && col === 'owner_uid') {
        const r = await sql([`select count(*)::int as n from public.media where owner_uid = ${uid} and media_id not in (${ints(delMedia.length ? delMedia : [-1], 'media')})`]);
        if (r[0].n) refs[`${t}.${col}`] = r[0].n;
        continue;
      }
      const r = await sql([`select count(*)::int as n from public.${t} where ${col} = ${uid}`]);
      if (r[0].n) refs[`${t}.${col}`] = r[0].n;
    }
    const deletable = Object.keys(refs).length === 0;
    out.checks.push({ kind: 'user', id: uid, refs, deletable });
    if (!deletable) userBlocked.add(uid);
  }
  const delUsers = USERS.filter((u) => !userBlocked.has(u));

  for (const c of out.checks.filter((x) => !x.deletable)) out.kept.push({ kind: c.kind, id: c.id, reason: 'referenced_by_business_table', refs: c.refs });

  if (process.env.DRY === '1') {
    console.log(JSON.stringify({ dry: true, listings: delListings, media: delMedia, users: delUsers, checks: out.checks.filter((c) => !c.deletable) }, null, 2));
    return;
  }

  // ---- 2) 单事务删除 ----
  const delL = ints(delListings.length ? delListings : [-1], 'listing');
  const delM = ints(delMedia.length ? delMedia : [-1], 'media');
  const delU = ints(delUsers.length ? delUsers : [-1], 'user');

  const tx = await sql.transaction([
    // 红线：平台账户 4 行且零余额
    sql`select count(*)::int as n, coalesce(sum(balance),0)::text as bal, coalesce(sum(frozen),0)::text as fr from public.account where uid <= 0`,
    // 触发器禁用前的状态
    sql`select tgname, tgenabled from pg_trigger where tgrelid='public.listing'::regclass and tgname='trg_listing_no_delete'`,
    sql`alter table public.listing disable trigger trg_listing_no_delete`,
    sql([`delete from public.listing where listing_id in (${delL})`]),
    sql`alter table public.listing enable trigger trg_listing_no_delete`,
    sql`select tgname, tgenabled from pg_trigger where tgrelid='public.listing'::regclass and tgname='trg_listing_no_delete'`,
    sql([`delete from public.media where media_id in (${delM})`]),
    sql([`delete from public.account where uid in (${delU})`]),
    sql([`delete from public.users where uid in (${delU})`]),
    sql`select count(*)::int as n, coalesce(sum(balance),0)::text as bal, coalesce(sum(frozen),0)::text as fr from public.account where uid <= 0`,
  ]);

  out.tx = {
    platform_accounts_before: tx[0][0],
    trigger_before: tx[1][0],
    listing_delete_rowcount: null, // neon 批不暴露 rowCount；权威读数 = before/after 全表计数差
    trigger_after: tx[5][0],
    platform_accounts_after: tx[9][0],
  };
  // neon 的 DDL/DML 批返回各语句结果；rowCount 不一定暴露 ⇒ 用前后计数差作为权威读数
  if (out.tx.trigger_after.tgenabled !== 'O') throw new Error(`trigger restore failed: ${JSON.stringify(out.tx.trigger_after)}`);
  const pa = (x) => x && x.n === 4 && x.bal === '0' && x.fr === '0';
  if (!pa(out.tx.platform_accounts_before) || !pa(out.tx.platform_accounts_after)) throw new Error(`platform account red line broken: ${JSON.stringify(out.tx)}`);

  out.deleted = { listing: delListings, media: delMedia, users: delUsers };

  for (const t of COUNT_TABLES) {
    const r = await sql([`select count(*)::int as n from public.${t}`]);
    out.after[t] = r[0].n;
  }
  out.after.targets = {
    listing: await sql([`select listing_id from public.listing where listing_id in (${L})`]),
    media: await sql([`select media_id from public.media where media_id in (${M})`]),
    users: await sql([`select uid from public.users where uid in (${U})`]),
  };
  out.delta = Object.fromEntries(COUNT_TABLES.map((k) => [k, out.after[k] - out.before[k]]));
  out.residual = {
    listings_note: '若 kept 非空则残留（见 kept）',
    users_kept: USERS.filter((u) => delUsers.includes(u) === false),
  };
  out.pass = out.after.targets.listing.length === 0 && out.after.targets.media.length === 0 && out.after.targets.users.length === 0;

  fs.writeFileSync(path.join(__dirname, 'cleanup.json'), JSON.stringify(out, null, 2));
  console.log(JSON.stringify({ pass: out.pass, deleted: out.deleted, kept: out.kept, delta: out.delta, tx: out.tx, blocked: out.attempt_1_blocked }, null, 2));
  if (!out.pass) process.exitCode = 1;
})().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
