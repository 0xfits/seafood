// QA 独立 oracle：自己写 SQL 复算 §49 公式（不引用 backend-ts 实现代码）
import fs from 'node:fs';
import { sql, dbIdentity } from './db.mjs';

const ident = await dbIdentity();

const rows = await sql`
  WITH agg AS (
    SELECT ratee_uid,
           avg(stars)::float8 AS mean_stars,
           count(*)::int AS n
    FROM public.rating
    GROUP BY ratee_uid
  ),
  base AS (
    SELECT l.listing_id,
           l.seller_uid,
           l.title,
           l.time_created,
           EXTRACT(EPOCH FROM (now() - l.time_created)) / 86400.0 AS age_days_raw
    FROM public.listing l
  )
  SELECT b.listing_id, b.seller_uid, b.title, b.time_created,
         b.age_days_raw::float8 AS age_days_raw,
         GREATEST(b.age_days_raw, 0.0)::float8 AS age_days,
         (1.0 / (1.0 + GREATEST(b.age_days_raw, 0.0)))::float8 AS recency,
         COALESCE(a.mean_stars, 3.0)::float8 AS stars_used,
         COALESCE(a.n, 0)::int AS rating_n,
         (0.8 * (1.0 / (1.0 + GREATEST(b.age_days_raw, 0.0)))
          + 0.2 * (COALESCE(a.mean_stars, 3.0) / 5.0))::float8 AS score
  FROM base b
  LEFT JOIN agg a ON a.ratee_uid = b.seller_uid
  ORDER BY score DESC, b.time_created DESC, b.listing_id DESC
`;

const out = rows.map((r, i) => ({
  rank: i + 1,
  id: Number(r.listing_id),
  seller: Number(r.seller_uid),
  title: r.title,
  tc: new Date(r.time_created).toISOString(),
  age_days: r.age_days,
  recency: r.recency,
  stars_used: r.stars_used,
  rating_n: r.rating_n,
  score: r.score,
}));

const tag = process.argv[2] || 'baseline';
const file = `ops/feed-ranking/qa/readings/oracle-${tag}.json`;
fs.writeFileSync(file, JSON.stringify({ taken_at: new Date().toISOString(), db: ident, rows: out }, null, 2));

console.log('db', JSON.stringify(ident), 'rows', out.length, '->', file);
for (const r of out) {
  console.log(String(r.rank).padStart(2), String(r.id).padStart(3), String(r.seller).padStart(7),
    r.age_days.toFixed(3), r.score.toFixed(6), r.stars_used.toFixed(2), String(r.title).slice(0, 26));
}
console.log('--- adjacent gaps ---');
for (let i = 0; i < out.length - 1; i++) {
  console.log(out[i].id, '->', out[i + 1].id, (out[i].score - out[i + 1].score).toExponential(3));
}
