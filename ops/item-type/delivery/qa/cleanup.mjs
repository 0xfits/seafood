// 回收本单自建夹具（listing 标题前缀 IT4-QA-%）
// 体例：仓内 purge-test-data.ts / 技能册「listing 行默认删不掉」——单事务 DISABLE→DELETE→ENABLE，
// 事务内与事后各查 pg_trigger.tgenabled='O'；先核引用面（listing_order/conversation/ledger_entry 必须 0）。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const REPO = '/Users/kevin/bistro/seafood';
const QA = path.join(REPO, 'ops/item-type/delivery/qa');
const OUT = process.env.OUT_FILE || path.join(QA, 'readings/cleanup-purge.json');
const LIKE = process.env.LIKE || 'IT4-QA-%';
const req = createRequire(path.join(REPO, 'backend-ts/package.json'));
const { neon } = req('@neondatabase/serverless');

const envText = fs.readFileSync(path.join(REPO, 'backend-ts/.env.local'), 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
const sql = neon(env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL);

const TABLES = ['listing', 'listing_order', 'conversation', 'message', 'ledger_entry', 'listing_favorite', 'listing_review_log', 'content_translation', 'media'];
const counts = async () => {
  const o = {};
  for (const t of TABLES) o[t] = (await sql(`SELECT count(*)::int AS n FROM public.${t}`))[0].n;
  return o;
};

const projectId = (await sql`SELECT current_setting('neon.project_id', true) AS pid`)[0].pid;
const before = await counts();
const mine = await sql`SELECT listing_id, title, status, item_type FROM public.listing WHERE title LIKE ${LIKE} ORDER BY listing_id`;
const ids = mine.map((r) => Number(r.listing_id));
const one = async (q) => (await q)[0].n;
const refs = {
  listing_order: await one(sql`SELECT count(*)::int AS n FROM public.listing_order o JOIN public.listing l USING (listing_id) WHERE l.title LIKE ${LIKE}`),
  conversation: await one(sql`SELECT count(*)::int AS n FROM public.conversation c JOIN public.listing l USING (listing_id) WHERE l.title LIKE ${LIKE}`),
  listing_favorite: await one(sql`SELECT count(*)::int AS n FROM public.listing_favorite f JOIN public.listing l USING (listing_id) WHERE l.title LIKE ${LIKE}`),
  listing_review_log: await one(sql`SELECT count(*)::int AS n FROM public.listing_review_log r JOIN public.listing l USING (listing_id) WHERE l.title LIKE ${LIKE}`),
  content_translation: await one(sql`SELECT count(*)::int AS n FROM public.content_translation t JOIN public.listing l ON t.entity_id = l.listing_id::text AND t.entity_type = 'listing' WHERE l.title LIKE ${LIKE}`),
  ledger_entry: await one(sql`SELECT count(*)::int AS n FROM public.ledger_entry e JOIN public.listing l ON e.ref_id::text = l.listing_id::text WHERE l.title LIKE ${LIKE}`),
  message: await one(sql`SELECT count(*)::int AS n FROM public.message m JOIN public.conversation c USING (conversation_id) JOIN public.listing l USING (listing_id) WHERE l.title LIKE ${LIKE}`),
};
const blockers = ['listing_order', 'conversation', 'listing_favorite', 'ledger_entry', 'message'].filter((k) => refs[k] !== 0);

let transaction = null;
if (!blockers.length && ids.length) {
  const beforeTrigger = (await sql`SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.listing'::regclass AND tgname = 'trg_listing_no_delete'`)[0].tgenabled;
  const tx = await sql.transaction([
    sql`ALTER TABLE public.listing DISABLE TRIGGER trg_listing_no_delete`,
    sql`SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.listing'::regclass AND tgname = 'trg_listing_no_delete'`,
    sql`DELETE FROM public.content_translation WHERE entity_type = 'listing' AND entity_id IN (SELECT listing_id::text FROM public.listing WHERE title LIKE ${LIKE})`,
    sql`DELETE FROM public.listing_review_log WHERE listing_id IN (SELECT listing_id FROM public.listing WHERE title LIKE ${LIKE})`,
    sql`DELETE FROM public.listing WHERE title LIKE ${LIKE} RETURNING listing_id`,
    sql`ALTER TABLE public.listing ENABLE TRIGGER trg_listing_no_delete`,
    sql`SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.listing'::regclass AND tgname = 'trg_listing_no_delete'`,
  ]);
  transaction = {
    trigger_before: beforeTrigger,
    trigger_disabled_inside_tx: tx[1][0].tgenabled,
    translation_rows_deleted: (tx[2] || []).length,
    review_log_rows_deleted: (tx[3] || []).length,
    listing_deleted: (tx[4] || []).map((r) => Number(r.listing_id)),
    trigger_enabled_inside_tx: tx[6][0].tgenabled,
  };
}

const after = await counts();
const triggerAfter = (await sql`SELECT tgenabled FROM pg_trigger WHERE tgrelid = 'public.listing'::regclass AND tgname = 'trg_listing_no_delete'`)[0].tgenabled;
const leftover = await sql`SELECT listing_id, title FROM public.listing WHERE title LIKE ${LIKE}`;

const postRefs = { listing_by_id: 0, content_translation: 0, listing_review_log: 0, listing_order: 0, conversation: 0, listing_favorite: 0, message: 0 };
for (const id of ids) {
  postRefs.listing_by_id += await one(sql`SELECT count(*)::int AS n FROM public.listing WHERE listing_id = ${id}`);
  postRefs.content_translation += await one(sql`SELECT count(*)::int AS n FROM public.content_translation WHERE entity_type = 'listing' AND entity_id = ${String(id)}`);
  postRefs.listing_review_log += await one(sql`SELECT count(*)::int AS n FROM public.listing_review_log WHERE listing_id = ${id}`);
  postRefs.listing_order += await one(sql`SELECT count(*)::int AS n FROM public.listing_order WHERE listing_id = ${id}`);
  postRefs.conversation += await one(sql`SELECT count(*)::int AS n FROM public.conversation WHERE listing_id = ${id}`);
  postRefs.listing_favorite += await one(sql`SELECT count(*)::int AS n FROM public.listing_favorite WHERE listing_id = ${id}`);
  postRefs.message += await one(sql`SELECT count(*)::int AS n FROM public.message WHERE conversation_id IN (SELECT conversation_id FROM public.conversation WHERE listing_id = ${id})`);
}

const out = {
  at: new Date().toISOString(), like: LIKE, project_id: projectId,
  fixtures: mine, fixture_ids: ids,
  reference_counts_before_delete: refs, blockers, transaction,
  trigger_tgenabled_after: triggerAfter,
  counts_before: before, counts_after: after,
  delta: Object.fromEntries(TABLES.map((t) => [t, before[t] - after[t]])),
  listing_before: before.listing, listing_after: after.listing,
  leftover_rows: leftover,
  post_delete_reference_counts: postRefs,
  zero_reference_surface: Object.values(postRefs).every((n) => n === 0),
  trigger_restored: triggerAfter === 'O' && (transaction ? transaction.trigger_disabled_inside_tx === 'D' && transaction.trigger_enabled_inside_tx === 'O' : true),
};
fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
