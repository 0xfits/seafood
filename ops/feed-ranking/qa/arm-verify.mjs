// QA AC3 复核：单快照内算「有评分 vs 中性」的逐行差值 + 相对序不变式
import fs from 'node:fs';
import { sql } from './db.mjs';

const ARM_SELLER = 970101;
const arm = JSON.parse(fs.readFileSync('ops/feed-ranking/qa/readings/arm-insert.json', 'utf8'));
if (Number(arm.ratee_uid) !== ARM_SELLER) throw new Error('fixture seller drift');

// 同一语句内 now() 恒定 ⇒ recency 相同，差值只可能来自评分臂
const rows = await sql`
  WITH agg AS (
    SELECT ratee_uid, avg(stars)::float8 AS mean_stars FROM public.rating GROUP BY ratee_uid
  ),
  base AS (
    SELECT l.listing_id, l.seller_uid, l.time_created,
           EXTRACT(EPOCH FROM (now() - l.time_created)) / 86400.0 AS age_raw
    FROM public.listing l
  )
  SELECT b.listing_id, b.seller_uid,
         (1.0 / (1.0 + GREATEST(b.age_raw, 0.0)))::float8 AS recency,
         COALESCE(a.mean_stars, 3.0)::float8 AS stars_actual,
         (0.8 * (1.0 / (1.0 + GREATEST(b.age_raw, 0.0))) + 0.2 * (COALESCE(a.mean_stars, 3.0) / 5.0))::float8 AS score_actual,
         (0.8 * (1.0 / (1.0 + GREATEST(b.age_raw, 0.0))) + 0.2 * (3.0 / 5.0))::float8 AS score_counterfactual_neutral
  FROM base b LEFT JOIN agg a ON a.ratee_uid = b.seller_uid
`;

const per = rows.map((r) => ({
  id: Number(r.listing_id),
  seller: Number(r.seller_uid),
  recency: r.recency,
  stars_actual: r.stars_actual,
  score_actual: r.score_actual,
  score_counterfactual_neutral: r.score_counterfactual_neutral,
  delta: r.score_actual - r.score_counterfactual_neutral,
}));
const armRows = per.filter((p) => p.seller === ARM_SELLER);
const otherRows = per.filter((p) => p.seller !== ARM_SELLER);
const maxArmDeviation = Math.max(...armRows.map((p) => Math.abs(p.delta - 0.08)));
const maxOtherDeviation = Math.max(...otherRows.map((p) => Math.abs(p.delta)));

// 顺序：with-rating oracle vs 反事实中性 oracle vs API
const byOrder = (list) => [...list].sort((x, y) =>
  (y.score - x.score) || (new Date(y.tc) - new Date(x.tc)) || (y.id - x.id));
const oracleWR = JSON.parse(fs.readFileSync('ops/feed-ranking/qa/readings/oracle-with-rating.json', 'utf8')).rows;
const oracleBase = JSON.parse(fs.readFileSync('ops/feed-ranking/qa/readings/oracle-baseline.json', 'utf8')).rows;
const apiWR = JSON.parse(fs.readFileSync('ops/feed-ranking/qa/readings/api-with-rating.json', 'utf8'));

const orderWR = oracleWR.map((r) => r.id);
const orderBase = oracleBase.map((r) => r.id);
const apiOrder = apiWR.all60_ids;

const subseq = (arr, keep) => arr.filter((id) => keep.has(id));
const otherSet = new Set(otherRows.map((p) => p.id));
const armSet = new Set(armRows.map((p) => p.id));
const otherRelativeBefore = subseq(orderBase, otherSet);
const otherRelativeAfter = subseq(orderWR, otherSet);
const armRelativeBefore = subseq(orderBase, armSet);
const armRelativeAfter = subseq(orderWR, armSet);

const armRanksAfter = orderWR.map((id, i) => ({ id, rank: i + 1 })).filter((x) => armSet.has(x.id));
const armRanksBefore = orderBase.map((id, i) => ({ id, rank: i + 1 })).filter((x) => armSet.has(x.id));

const checks = {
  rating_row_present_once: null, // filled below
  arm_rows_count_12: armRows.length === 12,
  arm_delta_exactly_0_08_within_1e_12: maxArmDeviation <= 1e-12,
  non_arm_delta_exactly_0_within_1e_12: maxOtherDeviation <= 1e-12,
  api_order_equals_oracle_with_rating: apiOrder.join(',') === orderWR.join(','),
  order_actually_changed_vs_baseline: orderBase.join(',') !== orderWR.join(','),
  other_rows_relative_order_unchanged: otherRelativeBefore.join(',') === otherRelativeAfter.join(','),
  arm_rows_relative_order_unchanged: armRelativeBefore.join(',') === armRelativeAfter.join(','),
  arm_block_contiguous: (() => {
    const idx = orderWR.map((id, i) => (armSet.has(id) ? i : -1)).filter((i) => i >= 0);
    return idx.every((v, i) => i === 0 || v === idx[i - 1] + 1);
  })(),
  arm_block_moved_into_top3_slot: Math.min(...armRanksAfter.map((r) => r.rank)) === 3,
  score_not_in_api_rows: apiWR.checks.score_not_in_response_rows === true,
};

const cnt = (await sql`SELECT count(*)::int AS n FROM public.rating WHERE ratee_uid = ${ARM_SELLER}`)[0].n;
checks.rating_row_present_once = cnt === 1;

const out = {
  taken_at: new Date().toISOString(),
  arm_seller: ARM_SELLER,
  arm_listing_count: armRows.length,
  max_arm_deviation_from_0_08: maxArmDeviation,
  max_non_arm_deviation_from_0: maxOtherDeviation,
  arm_sample: armRows.slice(0, 3),
  other_sample: otherRows.slice(0, 3),
  order_baseline: orderBase,
  order_with_rating: orderWR,
  api_order_with_rating: apiOrder,
  arm_ranks_before: armRanksBefore,
  arm_ranks_after: armRanksAfter,
  other_relative_before: otherRelativeBefore,
  other_relative_after: otherRelativeAfter,
  checks,
};
out.verdict = Object.entries(checks).every(([k, v]) => v === true) ? 'PASS' : 'FAIL';
fs.writeFileSync('ops/feed-ranking/qa/readings/arm-verify.json', JSON.stringify(out, null, 2));
console.log('verdict', out.verdict);
for (const [k, v] of Object.entries(checks)) console.log(' ', k, '=', v);
console.log('max arm dev', maxArmDeviation, 'max other dev', maxOtherDeviation);
console.log('arm ranks before', armRanksBefore.map((r) => r.rank).join(','), '-> after', armRanksAfter.map((r) => r.rank).join(','));
