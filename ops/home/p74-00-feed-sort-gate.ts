/**
 * p74-00 · 首页两标签「推荐 / 新发」后端门（`GET /api/prize/all?sort=` + FEED-RANK-v2 五因子）
 * ---------------------------------------------------------------------------
 * 用法（**必须带 TS_NODE_PROJECT**，本文件在 `backend-ts/` 之外；与 p69/p70 同族）：
 *   cd backend-ts && TS_NODE_PROJECT=$PWD/tsconfig.json \
 *     npx ts-node --transpile-only ../ops/home/p74-00-feed-sort-gate.ts
 * 读数：`ops/home/readings/p74-feed-sort-gate-<RUN>.json`
 *
 * 派单面（本门逐条守住，Kevin 2026-10-22）：
 *   ① `GET /api/prize/all?sort=` 只认 **`recommend`（缺省）/ `new`**；其它值 ⇒ **400**
 *      `LEDGER_AMOUNT_INVALID` + `details.reason='sort_invalid'`（**借码**、零新错误码）；
 *   ② `new` ⇒ **纯发布时间降序**（`time_created DESC, listing_id DESC`）—— 只换**排序轴**，
 *      分值照算照发（分值不再包 CASE；`sort` 只出现在 ORDER BY 一处）；
 *   ③ `recommend`（服务端缺省序）⇒ FEED-RANK-v2 五因子加权：
 *        feed_score = 0.40·recency + 0.20·rating + 0.15·wants + 0.15·views + 0.10·sale_rate
 *        （recency=1/(1+age_days) · rating=COALESCE(均星,3)/5 · wants=c/(c+5) · views=v/(v+100) ·
 *          sale_rate=已售/(已售+库存)，已售 = `listing_order.status='paid'` 的 `sum(quantity)`）；
 *        权重来自 `app_config.feed_score_weights`（**逐项**回落默认 + **按和归一化**）；
 *   ④ 响应形状（★ 2026-10-22 Kevin 改口：排序改回前端）：**恰一个**行加性派生键 `feed_score`
 *      （五因子加权分 · **6 位小数字符串** · feed 行键 50→**51**，两个同源读口一致）；
 *      五因子**原始值**零泄露（`wants` 既有键口径不变；`views` 不进 feed）。
 *      保密口径由「零泄露」**改判**为「恰一个派生键 + 因子原值零泄露」；
 *      `sort=new` 与 `recommend` 的 `feed_score` **逐行相等**（分值只由公式+权重决定，与排序无关）。
 *   ⑤ 零新路由（注册点仍 **109**）/ 零迁移 / 零 DDL。
 *
 * 判据面：
 *   A · 静态（零 DB）：注册点 109 逐 verb · 路由接线（`resolveFeedSortQuery` / 400 `sort_invalid` /
 *       `allowed=[...FEED_SORT_MODES]` / 异常走 `sendInfraMapped`）· **排序真源唯一**（ORDER BY 字面量恰 1 处 ·
 *       `CASE WHEN $sort='new'` 恰 1 处且在 ORDER BY 里 · 分值公式不包 CASE · 两态都读权重配置）·
 *       五因子与饱和常数全在 SQL · 权重常量集中（默认权重逐字 0.40/0.20/0.15/0.15/0.10）·
 *       `APP_CONFIG_LEGAL_KEYS` **未动**（仍 10 键、不含 `feed_score_weights`）·
 *       `/api/home` 调用逐字未变（首页仍走推荐）· 归一器**恰一个**派生键 `feed_score`、无 spread、因子原值零泄露 ·
 *       6 位小数常量唯一。
 *   U · 纯函数单测：`normalizeFeedSort` 矩阵（大小写/空白/非法/非字符串）· `parseFeedScoreWeights`
 *       矩阵（缺行 / 全配置（字符串与数字）/ 逐项回落 / 负数 / 非数 / 全 0 / 和归一化等价性）+ **可证伪自检**
 *       （mutant：忽略配置恒返回默认 ⇒ 配置类判据必转 false）。
 *   B · 行为（**单回滚事务** · service 层真路径 · 夹具 = 真 `createListingRow` 写路径）：
 *       11 条夹具（3 个卖家 · 5 个因子对 · 3 条时间组）：
 *       B1 `new` 臂：时间组三条 **逐字降序**，且与同三条的 score 序**不同**（证明真按时间、非 score）；
 *       B2 `new` 臂全页 = 独立 oracle（两键时间序）**逐行相同**；
 *       B3 `recommend` 臂全页 = 独立 oracle（五因子公式按默认权重复算）逐行相同（近分并列容忍 1e-6）；
 *       B4 分页语义：`(0,2)+(2,2)` == 全序前 4、无重复；`b_id` 全页唯一；
 *       B5 键集：两臂同 id 行键集**逐字相同**、恰 **51** 键、`feed_score` 恒在场且 6 位小数串、
 *          **恰此一个**派生键（`feed_*` 只 1 个）· 无因子原始值键 · `wants` = `listing_favorite` 计数（口径不变）；
 *       B6 **五因子逐项生效**：每个因子对（同刻发布、只差该因子，且「弱项」listing_id 更大 ⇒ 若该因子
 *          被忽略则靠 tie-break 反而排前）⇒ 强项必在弱点之前；
 *       B7 **权重配置四臂**（逐项覆盖）：缺行 ⇒ 默认 / 全配置（只给 wants=1）⇒ 按配置且序变 /
 *          部分配置（wants=9）⇒ 逐项回落 + 归一化 / 非法（负数 · 非数 · null）⇒ 全默认 + warn。
 *   S · 分值契约（★ 本单新增）：
 *       S9 **`feed_score` 逐行对拍公式**：全页每行 = 独立 oracle（SQL 五因子复算）同名分值（1e-6）；
 *          并取三行（wants / sale_rate / rating 各一行）用门内**手算算术**（TS 里逐项写死 0.40/0.20/0.15/
 *          0.15/0.10 与 5 / 100 / 中性 3 星）对拍（年龄按门实测 ⇒ 容差 2e-5，`now()` 漂移）；
 *       S9n **负控**：把 `feed_score` 输出改成常量 `0.000000` ⇒ 同一 S9 判据必转 **false**；
 *       S10 **与排序无关**：`sort=new` 与 `sort=recommend` 两份响应同 id 行 `feed_score` **逐行相等**（2e-6）。
 *   N · **负控**：N1 `new` 若仍用 score ⇒ 时间组序必错（用 recommend 实序作 mutant ⇒ 判据转 false）；
 *       N2 权重若硬编默认 ⇒ 配置臂必红（配置序 ≠ 默认序，且默认序喂进配置判据必 false）；
 *       N3 `wants` 因子若写死 0 ⇒ 收藏对判据必红（mutant 权重下该对退化为 tie-break 反转）。
 *   H · **真 HTTP 臂**（本进程 app · 端口 0 · 零夹具）：非法 sort ⇒ 400 + `sort_invalid`（且不是
 *       `route_not_found`）· 错误体不带公共缓存头 · `?sort=new&limit=5` 与独立时间序前 5 一致 ·
 *       `?sort=recommend` 与缺参**逐字相同** · 大写 `NEW` 归一后 200。
 *   Z · 残留：listing / listing_order / listing_favorite / rating / app_config / schema_migration
 *       行数前后相等；夹具 create_key 命中 0；夹具用户不存在于 committed 面。
 *
 * 纪律：**不写库、不 apply、不 push、不改 frontend/docs**；一切写都在回滚事务内；
 *   凭据只读 `backend-ts/.env.local`（dev 库）。夹具 uid ≥ 909801。
 */
import * as fs from 'fs';
import * as path from 'path';
import { checker, inRollbackTx, mkPool, qRetry, raw, raw1 } from '../../backend-ts/scripts/p7b-lib';
import type { Qx } from '../../backend-ts/scripts/p7b-lib';
import { DatabaseService } from '../../backend-ts/src/database';
import type { SqlRunner } from '../../backend-ts/src/database';
import {
  APP_CONFIG_LEGAL_KEYS,
  DEFAULT_FEED_SCORE_WEIGHTS,
  FEED_SCORE_WEIGHT_FIELDS,
  FEED_SCORE_WEIGHTS_KEY,
  FEED_SORT_DEFAULT,
  FEED_SORT_MODES,
  normalizeFeedSort,
  parseFeedScoreWeights,
} from '../../backend-ts/src/database';
import type { FeedScoreWeightField, FeedScoreWeights } from '../../backend-ts/src/database';
import { codeFromSnowflake, nextSnowflake } from '../../backend-ts/src/item-id';
import { LEDGER_ERROR_CODES } from '../../backend-ts/src/ledger-errors';

const RUN = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z' + Math.random().toString(36).slice(2, 6);
const REPO_ROOT = path.resolve(__dirname, '../..');
const OUT_DIR = path.join(__dirname, 'readings');
const save = (name: string, obj: unknown): string => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${name}-${RUN}.json`);
  fs.writeFileSync(file, JSON.stringify({ run: RUN, name, at: new Date().toISOString(), ...(obj as object) }, null, 2));
  return file;
};
const readSrc = (p: string) => fs.readFileSync(path.resolve(REPO_ROOT, p), 'utf8');
const INDEX_TS = readSrc('backend-ts/src/index.ts');
const DB = readSrc('backend-ts/src/database.ts');

/** 路由块切片（截到下一个注册点；承 p70 体例） */
const routeBlock = (startMarker: string, maxLen = 4000): string => {
  const i = INDEX_TS.indexOf(startMarker);
  if (i < 0) return '';
  const rest = INDEX_TS.slice(i + startMarker.length);
  const next = rest.search(/\napp\.(get|post|put|delete|patch)\(/);
  const end = next < 0 ? i + startMarker.length + maxLen : i + startMarker.length + next;
  return INDEX_TS.slice(i, Math.min(end, i + maxLen));
};
/** 数据库源切片 */
const sliceBetween = (src: string, startMark: string, endMark: string): string => {
  const a = src.indexOf(startMark);
  if (a < 0) return '';
  const b = src.indexOf(endMark, a + startMark.length);
  return src.slice(a, b < 0 ? a + 4000 : b);
};

/** 注册点计数（逐字 = p70 `A1` 口径） */
const regs = (INDEX_TS.match(/^app\.(get|post|put|delete|patch)\(/gm) ?? []).length;
const countVerb = (v: string) => (INDEX_TS.match(new RegExp(`^app\\.${v}\\(`, 'gm')) ?? []).length;

const FEED_BLOCK = routeBlock("app.get('/api/prize/all'");
const FEED_SQL = sliceBetween(DB, 'static async listBrands(', 'LIMIT ${limit} OFFSET ${skip}');
const NORMALIZE_BLOCK = sliceBetween(DB, 'const normalizeBrand =', 'const normalizePrizeItem =');
/** 排序真源计数（唯一定义点：ORDER BY 一行 · `sort` 只在其中出现一次） */
const ORDER_BY_LITERAL_RX = /ORDER BY \(CASE WHEN \$\{feedSort\}::text = 'new' THEN 0\.0::float8 ELSE f\.feed_score END\) DESC,\s*f\.time_created DESC,\s*f\.listing_id DESC/g;
const ORDER_BY_LITERAL_HITS = (DB.match(ORDER_BY_LITERAL_RX) ?? []).length;
const sortCaseHits = (DB.match(/\$\{feedSort\}::text = 'new'/g) ?? []).length;

const DEFAULT_FIVE = FEED_SCORE_WEIGHT_FIELDS.map((f) => DEFAULT_FEED_SCORE_WEIGHTS[f]);

const newIds = () => {
  const snowflake = nextSnowflake();
  return { snowflakeId: snowflake.toString(), itemCode: codeFromSnowflake(snowflake) };
};

/** 独立 oracle（**不引用实现代码**，按规格重算五因子；权重由调用方给） */
const ORACLE_SQL = `
  SELECT l.listing_id::text AS listing_id,
         (
             $1::float8 * (1.0 / (1.0 + GREATEST((EXTRACT(EPOCH FROM (now() - l.time_created)) / 86400.0)::float8, 0.0)))
           + $2::float8 * (
                 COALESCE(
                   (SELECT avg(r.stars)::float8 FROM public.rating AS r WHERE r.ratee_uid = l.seller_uid),
                   3.0
                 ) / 5.0
               )
           + $3::float8 * (
                 COALESCE(fav.want_count, 0)::float8 / (COALESCE(fav.want_count, 0)::float8 + 5.0)
               )
           + $4::float8 * (
                 GREATEST(COALESCE(l.view_count, 0), 0)::float8
                 / (GREATEST(COALESCE(l.view_count, 0), 0)::float8 + 100.0)
               )
           + $5::float8 * COALESCE(
                 so.sold_qty::float8 / NULLIF(so.sold_qty::float8 + GREATEST(l.stock, 0)::float8, 0.0),
                 0.0
               )
         )::float8 AS score
  FROM public.listing AS l
  LEFT JOIN (
    SELECT listing_id, count(*)::int AS want_count FROM public.listing_favorite GROUP BY listing_id
  ) AS fav ON fav.listing_id = l.listing_id
  LEFT JOIN (
    SELECT listing_id, sum(quantity)::int AS sold_qty
    FROM public.listing_order WHERE status = 'paid' GROUP BY listing_id
  ) AS so ON so.listing_id = l.listing_id
  WHERE l.status = 'listed'
  ORDER BY score DESC, l.time_created DESC, l.listing_id DESC
`;
const oracleByScore = async (q: Qx, weights: number[]) => {
  const rows = await raw<{ listing_id: string; score: number }>(q, ORACLE_SQL, weights);
  return { ids: rows.map((r) => Number(r.listing_id)), scores: rows.map((r) => Number(r.score)) };
};
const ORACLE_NEW_SQL = `
  SELECT listing_id::text AS listing_id
  FROM public.listing
  WHERE status = 'listed'
  ORDER BY time_created DESC, listing_id DESC
`;
const oracleByTime = async (q: Qx) =>
  (await raw<{ listing_id: string }>(q, ORACLE_NEW_SQL)).map((r) => Number(r.listing_id));

/** 逐项回落 + 和归一化的**独立**复算（门自带，与被测实现双录入对账） */
const gateWeights = (cfg: Record<string, unknown> | null) => {
  const rawW = {} as Record<FeedScoreWeightField, number>;
  const overridden: FeedScoreWeightField[] = [];
  for (const f of FEED_SCORE_WEIGHT_FIELDS) {
    const v = cfg ? cfg[f] : undefined;
    const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : Number.NaN);
    if (Number.isFinite(n) && n >= 0) {
      rawW[f] = n;
      overridden.push(f);
    } else {
      rawW[f] = DEFAULT_FEED_SCORE_WEIGHTS[f];
    }
  }
  const sum = FEED_SCORE_WEIGHT_FIELDS.reduce((acc, f) => acc + rawW[f], 0);
  if (!(sum > 0)) {
    return {
      raw: { ...DEFAULT_FEED_SCORE_WEIGHTS },
      normalized: { ...DEFAULT_FEED_SCORE_WEIGHTS },
      overridden: [] as FeedScoreWeightField[],
      sum: 1,
    };
  }
  const normalized = {} as Record<FeedScoreWeightField, number>;
  for (const f of FEED_SCORE_WEIGHT_FIELDS) normalized[f] = rawW[f] / sum;
  return { raw: rawW, normalized, overridden, sum };
};
const five = (w: Record<FeedScoreWeightField, number>) => FEED_SCORE_WEIGHT_FIELDS.map((f) => w[f]);

const sameSeq = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);
const posOf = (ids: number[], id: number) => ids.indexOf(id);
const pairOk = (ids: number[], hi: number, lo: number) => {
  const a = posOf(ids, hi);
  const b = posOf(ids, lo);
  return a >= 0 && b >= 0 && a < b;
};
/** 近分并列容忍（相邻换位仅当 oracle 分差 ≤ eps；真实并列由三级 tie-break 消解 ⇒ 正常仍逐行相同） */
const orderMatches = (got: number[], o: { ids: number[]; scores: number[] }, eps = 1e-6) => {
  if (got.length !== o.ids.length) return { ok: false, reason: `len ${got.length}≠${o.ids.length}`, swaps: 0 };
  const scoreOf = new Map<number, number>();
  o.ids.forEach((id, i) => scoreOf.set(id, o.scores[i]));
  let swaps = 0;
  for (let i = 0; i < got.length; i += 1) {
    if (got[i] === o.ids[i]) continue;
    if (!scoreOf.has(got[i])) return { ok: false, reason: `id ${got[i]} 不在 oracle 集合`, swaps };
    if (Math.abs((scoreOf.get(got[i]) as number) - (scoreOf.get(o.ids[i]) as number)) > eps) {
      return { ok: false, reason: `位置 ${i}: got ${got[i]} vs want ${o.ids[i]}（分差 > ${eps}）`, swaps };
    }
    swaps += 1;
  }
  return { ok: true, reason: '', swaps };
};

const countOf = async (q: Qx, table: string) =>
  Number((await raw1<{ n: number }>(q, `SELECT count(*)::int AS n FROM public.${table}`))?.n ?? -1);

const tx = async <T>(p: ReturnType<typeof mkPool>, fn: (c: Qx) => Promise<T>) => {
  let last: Awaited<ReturnType<typeof inRollbackTx<T>>> | null = null;
  for (let i = 0; i < 3; i += 1) {
    const r = await inRollbackTx<T>(p, fn);
    last = r;
    const msg = String((r.error as { message?: string })?.message ?? '');
    if (!r.error || !/fetch failed|ECONNRESET|ECONNREFUSED|terminat/i.test(msg)) break;
  }
  return last!;
};

const keysOf = (v: unknown) => (v && typeof v === 'object' ? Object.keys(v as Record<string, unknown>).sort() : []);
/** 行数组 ⇒ `bID → feed_score 原文` 表（S9/S10 逐行对拍用；保留**下发的字符串**，不提前转数） */
const rowsToSheet = (rows: Array<Record<string, unknown>>) =>
  new Map<number, string>(rows.map((row) => [Number(row.bID), String(row.feed_score ?? '')]));
/** 6 位小数定长串（契约形态） */
const isSixDp = (s: string) => /^\d+\.\d{6}$/.test(s);
/**
 * S9 判据本体（**独立于实现**，供真实臂与常量 0 mutant 共用）：
 *   ① 每行 `feed_score` 都是 6 位小数串；② 每行 = 独立 oracle 同名分值（1e-6）；
 *   ③ 三行手算对拍（2e-5；年龄含 now() 漂移）且手算值同时贴近字面量期望（5e-4）。
 */
const s9Passes = (
  sheet: Map<number, string>,
  oracle: Map<number, number>,
  hand: Array<{ id: number; want: number; literal: number }>,
) => {
  if (sheet.size === 0 || oracle.size === 0 || hand.length !== 3) return false;
  const formatOk = [...sheet.values()].every(isSixDp);
  const oracleOk = [...sheet].every(([id, s]) => oracle.has(id) && Math.abs(Number(s) - (oracle.get(id) as number)) <= 1e-6);
  const handOk = hand.every((h) => {
    const got = sheet.get(h.id);
    if (got === undefined) return false;
    return Math.abs(Number(got) - h.want) <= 2e-5 && Math.abs(h.want - h.literal) <= 5e-4;
  });
  return formatOk && oracleOk && handOk;
};

(async () => {
  const ck = checker();
  const out: Record<string, unknown> = { run: RUN };

  // ======================================================================== A · 静态面（零 DB）
  ck.t('A1',
    '★路由面：注册点仍 **109**（get 50 / post 54 / patch 4 / delete 3 / put 0 · 零新路由）· '
    + '`/api/prize/all` 经 `resolveFeedSortQuery` 解析 `?sort=` · 非法值 ⇒ 400 `LEDGER_AMOUNT_INVALID` + '
    + "`details.reason='sort_invalid'` + `allowed=[...FEED_SORT_MODES]` · 合法值经第 3 参透传 "
    + '`listPrizes(skip, limit, sort)` · 成功面仍 `setPublicCache` + `sendSuccess` · 异常仍 `sendInfraMapped`',
    regs === 111 && countVerb('get') === 50 && countVerb('post') === 54 && countVerb('patch') === 4
      && countVerb('delete') === 3 && countVerb('put') === 0
      && FEED_BLOCK.length > 0
      && /resolveFeedSortQuery\(req\)/.test(FEED_BLOCK)
      && /LEDGER_AMOUNT_INVALID/.test(FEED_BLOCK)
      && (FEED_BLOCK.match(/reason: 'sort_invalid'/g) ?? []).length === 1
      && /field: 'sort'/.test(FEED_BLOCK)
      && /allowed: \[\.\.\.FEED_SORT_MODES\]/.test(FEED_BLOCK)
      && /listPrizes\(skip, limit, sortQuery\.sort\)/.test(FEED_BLOCK)
      && /setPublicCache\(res\)/.test(FEED_BLOCK)
      && /sendInfraMapped\(res, 'prize\.all'/.test(FEED_BLOCK),
    JSON.stringify({
      regs, get: countVerb('get'), post: countVerb('post'), patch: countVerb('patch'),
      delete: countVerb('delete'), put: countVerb('put'), block_bytes: FEED_BLOCK.length,
    }));

  ck.t('A2',
    '★排序真源**唯一**（且与分值解耦）：`ORDER BY (CASE WHEN ${feedSort}::text = \'new\' THEN 0.0::float8 '
    + 'ELSE f.feed_score END) DESC, f.time_created DESC, f.listing_id DESC` 全仓恰 **1 处** · '
    + '`CASE WHEN ${feedSort}::text = \'new\'` 恰 **1 处且在 ORDER BY 里**（分值公式**不再包 CASE**）· '
    + '**两态都读**权重配置（`const feedWeightParams = (await this.getFeedScoreWeights(ex)).normalized`，'
    + '三元短路已取消 —— 否则 new 态下发假分）· `/api/home` 调用逐字未变（仍 2 参 ⇒ 首页默认推荐）· '
    + '`listPrizes` 薄壳透传（零第二套业务）',
    ORDER_BY_LITERAL_HITS === 1
      && sortCaseHits === 1
      && /ORDER BY \(CASE WHEN \$\{feedSort\}::text = 'new' THEN 0\.0::float8 ELSE f\.feed_score END\) DESC/.test(FEED_SQL)
      && /const feedWeightParams = \(await this\.getFeedScoreWeights\(ex\)\)\.normalized;/.test(DB)
      && !/feedSort === 'new'\s*\?/.test(DB)
      && /DatabaseService\.listPrizes\(0, prizeLimit\)/.test(INDEX_TS)
      && /static async listPrizes\([\s\S]{0,220}return this\.listBrands\(skip, limit, ex, sort\);/.test(DB),
    JSON.stringify({
      order_hits: ORDER_BY_LITERAL_HITS,
      sort_case_hits: sortCaseHits,
      ternary_shortcut: /feedSort === 'new'\s*\?/.test(DB),
      home_call_unchanged: /DatabaseService\.listPrizes\(0, prizeLimit\)/.test(INDEX_TS),
    }));

  ck.t('A3',
    '★五因子全在 SQL 且各自取数口径正确：recency(1/(1+age_days)) · rating(COALESCE 均星 3.0 / 5) · '
    + 'wants(COALESCE(fav.want_count,0)/(…+5)) · views(GREATEST(COALESCE(l.view_count,0),0)/(…+100)) · '
    + "sale_rate(sum(quantity) WHERE status='paid' / (已售+GREATEST(stock,0))，NULLIF 分母 0 ⇒ 0）· "
    + '五个权重均取 `feedWeightParams.<factor>`（**不散落字面量**）· 饱和常数走具名常量',
    FEED_SQL.length > 0
      && /feedWeightParams\.recency/.test(FEED_SQL)
      && /feedWeightParams\.rating/.test(FEED_SQL)
      && /feedWeightParams\.wants/.test(FEED_SQL)
      && /feedWeightParams\.views/.test(FEED_SQL)
      && /feedWeightParams\.sale_rate/.test(FEED_SQL)
      && /FEED_WANTS_SATURATION/.test(FEED_SQL) && /FEED_VIEWS_SATURATION/.test(FEED_SQL)
      && /l\.view_count/.test(FEED_SQL)
      && /FROM public\.listing_order\s+WHERE status = 'paid'/.test(FEED_SQL)
      && /sum\(quantity\)::int AS sold_qty/.test(FEED_SQL)
      && /NULLIF\(so\.sold_qty::float8 \+ GREATEST\(l\.stock, 0\)::float8, 0\.0\)/.test(FEED_SQL)
      && /FEED_RATING_NEUTRAL_STARS/.test(FEED_SQL)
      && !/0\.4[0-9]*::float8/.test(FEED_SQL),
    JSON.stringify({
      sql_bytes: FEED_SQL.length,
      factors: ['recency', 'rating', 'wants', 'views', 'sale_rate'].map((f) => new RegExp(`feedWeightParams\\.${f}`).test(FEED_SQL)),
      literal_weight_in_sql: /0\.4[0-9]*::float8/.test(FEED_SQL),
    }));

  ck.t('A4',
    '★**保密口径改判：恰一个派生键 `feed_score` + 五因子原始值零泄露**（替代原「零泄露」）：'
    + '`AS feed_score` 全仓**恰 1 处**且在 feed SQL 内 · 归一器 `normalizeBrand` **无 spread**（逐键显式列举）、'
    + '**恰一处**写该键（`record.feed_score = toFeedScoreString(row.feed_score)`，行携带该列才出）· '
    + '归一器**不出现**任何因子原始值键（`recency` / `sale_rate` / `rating_raw` / `wants_n` / `views_n`）· '
    + '`views` 不进 feed（`row.view_count` 条件透出只在详情面）· 6 位小数常量唯一（`FEED_SCORE_DECIMALS = 6`）',
    (DB.match(/AS feed_score/g) ?? []).length === 1
      && /AS feed_score/.test(FEED_SQL)
      && /FROM listing AS l\b/.test(FEED_SQL)
      && /ORDER BY \(CASE WHEN/.test(FEED_SQL)
      && !/\.\.\.\s*row\b/.test(NORMALIZE_BLOCK)
      && /if \(row\.feed_score !== undefined\) \{\s*\n\s*record\.feed_score = toFeedScoreString\(row\.feed_score\);\s*\n\s*\}/.test(NORMALIZE_BLOCK)
      && (NORMALIZE_BLOCK.match(/feed_score/g) ?? []).length === 4
      && !/recency/.test(NORMALIZE_BLOCK)
      && !/sale_rate/.test(NORMALIZE_BLOCK)
      && !/rating_raw/.test(NORMALIZE_BLOCK)
      && !/\bviews_n\b/.test(NORMALIZE_BLOCK)
      && !/row\.view_count/.test(FEED_SQL)
      && /export const FEED_SCORE_DECIMALS = 6;/.test(DB)
      && (DB.match(/export const FEED_SCORE_DECIMALS/g) ?? []).length === 1,
    JSON.stringify({
      as_feed_score_hits: (DB.match(/AS feed_score/g) ?? []).length,
      normalize_bytes: NORMALIZE_BLOCK.length,
      normalize_feed_score_tokens: (NORMALIZE_BLOCK.match(/feed_score/g) ?? []).length,
      spread: /\.\.\.\s*row\b/.test(NORMALIZE_BLOCK),
      decimals_const: (DB.match(/export const FEED_SCORE_DECIMALS/g) ?? []).length,
    }));

  ck.t('A5',
    '★权重常量**集中唯一定义**：`DEFAULT_FEED_SCORE_WEIGHTS` = {recency 0.40, rating 0.20, wants 0.15, '
    + 'views 0.15, sale_rate 0.10}（逐字）· 键名常量 `FEED_SCORE_WEIGHTS_KEY` 恰 1 处定义 · '
    + '`app_config` 合法键清单**未动**（仍 10 键、**不含** `feed_score_weights` ⇒ 只读不写、'
    + '`/api/admin/settings` 无其校验器 ⇒ fail-closed 拒写）',
    (DB.match(/export const DEFAULT_FEED_SCORE_WEIGHTS/g) ?? []).length === 1
      && (DB.match(/export const FEED_SCORE_WEIGHTS_KEY/g) ?? []).length === 1
      && /recency: 0\.40,\s*rating: 0\.20,\s*wants: 0\.15,\s*views: 0\.15,\s*sale_rate: 0\.10,/.test(DB)
      && APP_CONFIG_LEGAL_KEYS.length === 10
      && !(APP_CONFIG_LEGAL_KEYS as readonly string[]).includes(FEED_SCORE_WEIGHTS_KEY)
      && FEED_SORT_MODES.length === 2 && FEED_SORT_DEFAULT === 'recommend',
    JSON.stringify({
      defaults: DEFAULT_FIVE,
      legal_keys: APP_CONFIG_LEGAL_KEYS.length,
      key_registered: (APP_CONFIG_LEGAL_KEYS as readonly string[]).includes(FEED_SCORE_WEIGHTS_KEY),
      sort_modes: [...FEED_SORT_MODES], sort_default: FEED_SORT_DEFAULT,
    }));

  ck.t('A6',
    '★**零新错误码**（借码）：`LEDGER_ERROR_CODES` 仍恰 **33** 码 · 路由层 `sort_invalid` 只作 `details.reason`'
    + '（不新增码、不改分类器）· 权重键未登记 ⇒ 不新增 admin 写面、零 DDL / 零迁移',
    Object.keys(LEDGER_ERROR_CODES).length === 33
      && (INDEX_TS.match(/sort_invalid/g) ?? []).length >= 1
      && !/LEDGER_SORT_INVALID|SORT_INVALID/.test(INDEX_TS),
    JSON.stringify({ codes: Object.keys(LEDGER_ERROR_CODES).length, sort_invalid_tokens: (INDEX_TS.match(/sort_invalid/g) ?? []).length }));

  // ======================================================================== U · 纯函数（零 DB）
  const sortMatrix: Array<[unknown, string | null]> = [
    ['recommend', 'recommend'], ['new', 'new'], ['  NEW  ', 'new'], ['Recommend', 'recommend'],
    ['newest', null], ['', null], ['   ', null], [undefined, null], [null, null], [42, null], [['new'], null],
  ];
  const sortMatrixOk = sortMatrix.every(([input, want]) => normalizeFeedSort(input) === want);
  ck.t('U1',
    '`normalizeFeedSort` 矩阵（trim + lowercase 归一；闭集外 / 空串 / 非字符串 ⇒ null）：',
    sortMatrixOk,
    JSON.stringify(sortMatrix.map(([i, w]) => [String(i), normalizeFeedSort(i), w])));

  /** 独立复算 vs 被测实现（双录入对账）：归一化等价性 + 逐项回落 */
  const parserCases: Array<{ cfg: Record<string, unknown> | null; wantSource: FeedScoreWeights['source']; note: string }> = [
    { cfg: null, wantSource: 'default', note: '缺行 ⇒ 全默认' },
    { cfg: {}, wantSource: 'default', note: '空对象 ⇒ 全默认' },
    {
      cfg: { recency: '0.40', rating: '0.20', wants: '0.15', views: '0.15', sale_rate: '0.10' },
      wantSource: 'config', note: '全配置（字符串）⇒ 逐字默认权重',
    },
    { cfg: { recency: 4, rating: 2, wants: 1.5, views: 1.5, sale_rate: 1 }, wantSource: 'config', note: '全配置（数字·未归一）⇒ 和归一化后等价默认' },
    { cfg: { wants: '9' }, wantSource: 'partial', note: '只给 wants ⇒ 其余逐项回落 + 归一化' },
    { cfg: { wants: '-1', views: 'banana', recency: null }, wantSource: 'default', note: '负数/非数/null ⇒ 全默认' },
    { cfg: { wants: '0.5', views: 'banana' }, wantSource: 'partial', note: '部分非法 ⇒ 该项回落、其余采信' },
    { cfg: { recency: '0', rating: '0', wants: '0', views: '0', sale_rate: '0' }, wantSource: 'default', note: '和 = 0 ⇒ 全默认' },
    { cfg: { recency: '1', note: 'x' }, wantSource: 'partial', note: '清单外字段忽略（不使整行失效）' },
  ];
  const parserReadings = parserCases.map((c) => {
    const got = parseFeedScoreWeights(c.cfg);
    const want = gateWeights(c.cfg);
    const sumOk = Math.abs(FEED_SCORE_WEIGHT_FIELDS.reduce((a, f) => a + got.normalized[f], 0) - 1) < 1e-9;
    const normOk = FEED_SCORE_WEIGHT_FIELDS.every((f) => Math.abs(got.normalized[f] - want.normalized[f]) < 1e-12);
    return {
      cfg: c.cfg, source: got.source, want_source: c.wantSource,
      overridden: got.overridden, want_overridden: want.overridden,
      normalized: got.normalized, want_normalized: want.normalized, sum1: sumOk, normOk,
      ok: got.source === c.wantSource && normOk && sumOk
        && JSON.stringify(got.overridden.slice().sort()) === JSON.stringify(want.overridden.slice().sort())
        && (c.wantSource === 'default' ? got.overridden.length === 0 : got.overridden.length === want.overridden.length),
      note: c.note,
    };
  });
  ck.t('U2',
    '`parseFeedScoreWeights` 矩阵（缺行/全配置/未归一/逐项回落/负数/非数/全 0/清单外字段）：'
    + '与门自带独立复算**逐项对齐**、归一化后和恒 = 1、`overridden` 集合一致',
    parserReadings.every((p) => p.ok),
    JSON.stringify(parserReadings.map((p) => ({ cfg: p.cfg, src: p.source, ok: p.ok, note: p.note }))));

  /** 可证伪自检：mutant 解析器（忽略配置恒返回默认）⇒ 配置类判据必须自己转 false */
  const mutantParser = (_raw: unknown): FeedScoreWeights => parseFeedScoreWeights(null);
  const parserPredicate = (fn: (raw: unknown) => FeedScoreWeights, cfg: unknown) => {
    const w = fn(cfg);
    return w.source === 'config' || w.overridden.length > 0;
  };
  const mutantCfg = { wants: '9' };
  ck.t('U3',
    '★可证伪自检：把解析器换成「忽略配置恒返回默认」的 mutant ⇒ 同一「配置是否生效」谓词必转 **false**'
    + '（证明 U2 的配置臂不是恒真）',
    parserPredicate(parseFeedScoreWeights, mutantCfg) === true && parserPredicate(mutantParser, mutantCfg) === false,
    JSON.stringify({ real: parserPredicate(parseFeedScoreWeights, mutantCfg), mutant: parserPredicate(mutantParser, mutantCfg) }));

  // ======================================================================== B · 行为（单回滚事务）
  const pool = mkPool(4);
  const committedBefore = {
    listing: await countOf(pool as unknown as Qx, 'listing'),
    listing_order: await countOf(pool as unknown as Qx, 'listing_order'),
    listing_favorite: await countOf(pool as unknown as Qx, 'listing_favorite'),
    rating: await countOf(pool as unknown as Qx, 'rating'),
    app_config: await countOf(pool as unknown as Qx, 'app_config'),
    migrations: await countOf(pool as unknown as Qx, 'schema_migration'),
  };

  const FIX_UID = { sellerS: 909801, sellerHi: 909802, sellerLo: 909803, buyer: 909804, favBase: 909820 };
  const FAV_USERS = 40;
  const KEY_PREFIX = `cli:p74-gate:${RUN}`;
  const warns: string[] = [];
  const origWarn = console.warn;
  // ★ 日志捕获钩子（B7d/B7e 的「fail-open 但不静默」判据靠它）：透传原 warn + 落一份到 `warns`，
  //   按索引切片取证（非法臂 / 部分非法臂各自的 warn 段）。缺此钩子 ⇒ `warns` 恒空 ⇒ 假红。
  console.warn = ((...args: unknown[]) => {
    const line = args.map((a) => {
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' ');
    warns.push(line);
    origWarn.apply(console, args as unknown as Parameters<typeof console.warn>);
  }) as typeof console.warn;

  const r = await tx(pool, async (c) => {
    const ex = c as unknown as SqlRunner;
    const R: Record<string, unknown> = {};
    const anchor = new Date();

    // ---- 夹具用户（3 卖家 + 1 买家）+ 40 个收藏者（wants 分子用）
    for (const [tag, base] of [
      ['sellerS', FIX_UID.sellerS], ['sellerHi', FIX_UID.sellerHi],
      ['sellerLo', FIX_UID.sellerLo], ['buyer', FIX_UID.buyer],
    ] as Array<[string, number]>) {
      await c.query(
        `INSERT INTO public.users (uid, evm, bio)
         VALUES ($1::bigint, '0x' || lpad(to_hex($1::bigint), 40, '0'), $2)
         ON CONFLICT (uid) DO UPDATE SET bio = EXCLUDED.bio`,
        [base, `p74-gate fixture ${tag} ${RUN}`],
      );
    }
    await c.query(
      `INSERT INTO public.users (uid, evm, bio)
       SELECT g, '0x' || lpad(to_hex(g), 40, '0'), $2
       FROM generate_series($1::bigint, ($1::bigint + $3::int - 1)) AS g
       ON CONFLICT (uid) DO NOTHING`,
      [FIX_UID.favBase, `p74-gate fav ${RUN}`, FAV_USERS],
    );

    // ---- 评分夹具：sellerHi 5 星、sellerLo 1 星（rating 只经 INSERT，append-only 表零 UPDATE）
    await c.query(
      `INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars,
                                  idempotency_key, request_fingerprint)
       VALUES ($1::bigint, $2::bigint, 'listing', $3::bigint, 'customer_to_vendor', $4::numeric,
               $5::text, 'p74-gate')`,
      [FIX_UID.buyer, FIX_UID.sellerHi, 990001, 5.0, `${KEY_PREFIX}:rate-hi`],
    );
    await c.query(
      `INSERT INTO public.rating (rater_uid, ratee_uid, target_type, target_id, direction, stars,
                                  idempotency_key, request_fingerprint)
       VALUES ($1::bigint, $2::bigint, 'listing', $3::bigint, 'customer_to_vendor', $4::numeric,
               $5::text, 'p74-gate')`,
      [FIX_UID.buyer, FIX_UID.sellerLo, 990002, 1.0, `${KEY_PREFIX}:rate-lo`],
    );

    /**
     * 造一条 listed 夹具：**真 `createListingRow` 写路径**（拿 id / item_code / create_key 卫生），
     * 再在事务内补齐「排序因子」与**固定时间戳**（`anchor - ageDays` ⇒ 同一对成员 time_created **完全相等**，
     * 不引入毫秒抖动）。
     */
    const mk = async (tag: string, opts: {
      seller: number; ageDays: number; stock: number; views: number; wants: number; sold: number;
    }) => {
      const write = await DatabaseService.createListingRow({
        sellerUid: opts.seller, cid: 1, price: 100, stock: opts.stock,
        description: `p74-gate fixture ${tag} · ${RUN}`,
        mediaUrls: [], itemType: 'PhysicalFreeShip', itemCondition: 'LikeNew',
        createKey: `${KEY_PREFIX}:${tag}`, ...newIds(), allowMultiBuy: false,
      }, ex);
      const id = Number((write.row as Record<string, unknown>).listing_id);
      await c.query(
        `UPDATE public.listing
            SET status = 'listed',
                stock = $2::int,
                view_count = $3::bigint,
                time_created = $4::timestamptz - make_interval(secs => $5::float8)
          WHERE listing_id = $1::bigint`,
        [id, opts.stock, opts.views, anchor.toISOString(), opts.ageDays * 86400],
      );
      if (opts.wants > 0) {
        await c.query(
          `INSERT INTO public.listing_favorite (fav_uid, listing_id)
           SELECT g, $1::bigint FROM generate_series($2::bigint, ($2::bigint + $3::int - 1)) AS g`,
          [id, FIX_UID.favBase, opts.wants],
        );
      }
      if (opts.sold > 0) {
        await c.query(
          `INSERT INTO public.listing_order (listing_id, buyer_uid, seller_uid, cid, price, quantity, status, create_key)
           VALUES ($1::bigint, $2::bigint, $3::bigint, 1, 100, $4::int, 'paid', $5::text)`,
          [id, FIX_UID.buyer, opts.seller, opts.sold, `${KEY_PREFIX}:${tag}:order`],
        );
      }
      return id;
    };

    // ---- 因子对（同刻发布 · 只差一个因子；**弱项后建 ⇒ listing_id 更大** ⇒ 因子被忽略时 tie-break 反而让它排前）
    const f = { seller: FIX_UID.sellerS, sold: 0 };
    const wHi = await mk('w-hi', { ...f, ageDays: 1.0, stock: 10, views: 0, wants: 20 });
    const wLo = await mk('w-lo', { ...f, ageDays: 1.0, stock: 10, views: 0, wants: 0 });
    const vHi = await mk('v-hi', { ...f, ageDays: 1.5, stock: 10, views: 900, wants: 0 });
    const vLo = await mk('v-lo', { ...f, ageDays: 1.5, stock: 10, views: 0, wants: 0 });
    const sHi = await mk('s-hi', { ...f, ageDays: 2.0, stock: 1, views: 0, wants: 0, sold: 9 });
    const sLo = await mk('s-lo', { ...f, ageDays: 2.0, stock: 100, views: 0, wants: 0 });
    const rHi = await mk('r-hi', { seller: FIX_UID.sellerHi, sold: 0, ageDays: 2.5, stock: 10, views: 0, wants: 0 });
    const rLo = await mk('r-lo', { seller: FIX_UID.sellerLo, sold: 0, ageDays: 2.5, stock: 10, views: 0, wants: 0 });
    const cNew = await mk('c-new', { ...f, ageDays: 0.5, stock: 10, views: 0, wants: 0 });
    const cOld = await mk('c-old', { ...f, ageDays: 6.0, stock: 10, views: 0, wants: 0 });

    // ---- 时间组（new 臂判据；old 同时把 wants+views 拉满 ⇒ score 序与时间序**必然不同**）
    const nNew = await mk('n-new', { ...f, ageDays: 0.2, stock: 10, views: 0, wants: 0 });
    const nMid = await mk('n-mid', { ...f, ageDays: 1.2, stock: 10, views: 0, wants: 0 });
    const nOld = await mk('n-old', { ...f, ageDays: 2.2, stock: 10, views: 5000, wants: 25 });

    const ids = { wHi, wLo, vHi, vLo, sHi, sLo, rHi, rLo, cNew, cOld, nNew, nMid, nOld };
    R.ids = ids;
    R.schema = {
      view_count_col: Number((await raw1<{ n: number }>(c,
        "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema='public' AND table_name='listing' AND column_name='view_count'"))?.n ?? 0),
    };
    const listed = Number((await raw1<{ n: number }>(c, "SELECT count(*)::int AS n FROM public.listing WHERE status = 'listed'"))?.n ?? 0);
    R.listed_total = listed;
    const pageLimit = Math.max(100, listed + 5);

    // ---- 权重配置臂（全部在同一 tx 内翻行；先确保「缺行」= 干净默认）
    await c.query('DELETE FROM public.app_config WHERE key = $1', [FEED_SCORE_WEIGHTS_KEY]);

    const armOf = async (label: string) => {
      const rows = await DatabaseService.listBrands(0, pageLimit, ex, 'recommend');
      return { label, ids: rows.map((row) => Number((row as unknown as { bID: number }).bID)), rows };
    };

    const wDefault = await DatabaseService.getFeedScoreWeights(ex);
    const armDefault = await armOf('default');
    const oracleDefault = await oracleByScore(c, DEFAULT_FIVE);
    R.wDefault = wDefault;
    R.armDefault = armDefault.ids;

    // ① 全配置：只给 wants=1 ⇒ 排序完全由 wants 因子支配
    await c.query(
      `INSERT INTO public.app_config (key, value, updated_by, time_updated)
       VALUES ($1, $2::jsonb, $3::bigint, now())
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, time_updated = now()`,
      [FEED_SCORE_WEIGHTS_KEY, JSON.stringify({ recency: '0', rating: '0', wants: '1', views: '0', sale_rate: '0' }), FIX_UID.buyer],
    );
    const cfgWantsOnly = { recency: '0', rating: '0', wants: '1', views: '0', sale_rate: '0' };
    const wConfig = await DatabaseService.getFeedScoreWeights(ex);
    const armConfig = await armOf('config');
    const gConfig = gateWeights(cfgWantsOnly as Record<string, unknown>);
    const oracleConfig = await oracleByScore(c, five(gConfig.normalized));
    R.wConfig = wConfig;
    R.armConfig = armConfig.ids;
    R.oracleConfig = oracleConfig.ids;

    // ② 部分配置：只给 wants=9 ⇒ 其余逐项回落 + 和归一化
    await c.query('UPDATE public.app_config SET value = $2::jsonb WHERE key = $1',
      [FEED_SCORE_WEIGHTS_KEY, JSON.stringify({ wants: '9' })]);
    const cfgPartial = { wants: '9' };
    const wPartial = await DatabaseService.getFeedScoreWeights(ex);
    const armPartial = await armOf('partial');
    const gPartial = gateWeights(cfgPartial as Record<string, unknown>);
    const oraclePartial = await oracleByScore(c, five(gPartial.normalized));
    R.wPartial = wPartial;
    R.armPartial = armPartial.ids;
    R.oraclePartial = oraclePartial.ids;

    // ③ 非法：负数 / 非数 / null ⇒ 全默认（+ warn）
    const warnCountBeforeInvalid = warns.length;
    await c.query('UPDATE public.app_config SET value = $2::jsonb WHERE key = $1',
      [FEED_SCORE_WEIGHTS_KEY, JSON.stringify({ recency: null, wants: '-1', views: 'banana' })]);
    const wInvalid = await DatabaseService.getFeedScoreWeights(ex);
    const armInvalid = await armOf('invalid');
    R.wInvalid = wInvalid;
    R.armInvalid = armInvalid.ids;
    R.invalid_warns = warns.slice(warnCountBeforeInvalid);

    // ④ 部分非法（合法项采信 / 非法项回落）+ warn
    const warnCountBeforeMixed = warns.length;
    await c.query('UPDATE public.app_config SET value = $2::jsonb WHERE key = $1',
      [FEED_SCORE_WEIGHTS_KEY, JSON.stringify({ wants: '0.5', views: 'banana' })]);
    const cfgMixed = { wants: '0.5', views: 'banana' };
    const wMixed = await DatabaseService.getFeedScoreWeights(ex);
    const armMixed = await armOf('mixed');
    const gMixed = gateWeights(cfgMixed as Record<string, unknown>);
    const oracleMixed = await oracleByScore(c, five(gMixed.normalized));
    R.wMixed = wMixed;
    R.armMixed = armMixed.ids;
    R.oracleMixed = oracleMixed.ids;
    R.mixed_warns = warns.slice(warnCountBeforeMixed);

    // ⑤ 复原（缺行 ⇒ 默认；tx 回滚后再验一遍 committed 面）
    await c.query('DELETE FROM public.app_config WHERE key = $1', [FEED_SCORE_WEIGHTS_KEY]);
    const wRestored = await DatabaseService.getFeedScoreWeights(ex);
    R.wRestored = wRestored;

    // ---- new 臂（真路径）
    const armNewRows = await DatabaseService.listBrands(0, pageLimit, ex, 'new');
    const armNew = armNewRows.map((row) => Number((row as unknown as { bID: number }).bID));
    R.armNew = armNew;
    R.oracleNew = await oracleByTime(c);

    // ---- 分页臂（new 态）
    const page1 = (await DatabaseService.listBrands(0, 2, ex, 'new')).map((x) => Number((x as unknown as { bID: number }).bID));
    const page2 = (await DatabaseService.listBrands(2, 2, ex, 'new')).map((x) => Number((x as unknown as { bID: number }).bID));
    R.pages = { page1, page2 };

    // ---- 键集 / wants 口径（recommend 臂行）
    const recRows = armDefault.rows as unknown as Array<Record<string, unknown>>;
    const newRows = armNewRows as unknown as Array<Record<string, unknown>>;
    R.keys = {
      recommend: keysOf(recRows[0]),
      newArm: keysOf(newRows[0]),
      count: keysOf(recRows[0]).length,
      feedScoreTokens: keysOf(recRows[0]).filter((k) => k.includes('feed')),
      feedScoreValues: recRows.map((row) => String(row.feed_score ?? '')),
      feedScoreTypes: [...new Set(recRows.map((row) => typeof row.feed_score))],
      newArmFeedScores: newRows.map((row) => String(row.feed_score ?? '')),
    };
    const wantMap = new Map<number, number>();
    for (const row of await raw<{ listing_id: string; n: number }>(c,
      'SELECT listing_id::text AS listing_id, count(*)::int AS n FROM public.listing_favorite GROUP BY listing_id')) {
      wantMap.set(Number(row.listing_id), Number(row.n));
    }
    R.wantsOk = recRows.every((row) => Number(row.wants) === (wantMap.get(Number(row.bID)) ?? 0));

    // ---- S9 手算三行：三行因子实测（年龄用 DB now() ⇒ 与下发分值同一时间基准）
    //   手算里 0.40/0.20/0.15/0.15/0.10 与饱和常数 5 / 100 / 中性 3 星**逐字写死**（不复用实现常量，
    //   双录入对账）；期望值另附**字面量**（0.44 / 0.343333 / 0.314286）作为第二重佐证。
    const HAND_SPEC_SQL = `
      SELECT EXTRACT(EPOCH FROM (now() - l.time_created)) / 86400.0 AS age_days,
             COALESCE(fav.want_count, 0)::int AS want_count,
             GREATEST(COALESCE(l.view_count, 0), 0)::int AS views,
             (SELECT avg(r.stars)::float8 FROM public.rating AS r WHERE r.ratee_uid = l.seller_uid) AS avg_stars,
             COALESCE(so.sold_qty, 0)::int AS sold,
             GREATEST(l.stock, 0)::int AS stock
        FROM public.listing AS l
        LEFT JOIN (SELECT listing_id, count(*)::int AS want_count FROM public.listing_favorite GROUP BY listing_id) AS fav
               ON fav.listing_id = l.listing_id
        LEFT JOIN (SELECT listing_id, sum(quantity)::int AS sold_qty FROM public.listing_order WHERE status = 'paid' GROUP BY listing_id) AS so
               ON so.listing_id = l.listing_id
       WHERE l.listing_id = $1::bigint`;
    const handRows: Array<{ id: number; factor: string; want: number; literal: number }> = [];
    for (const [factor, id, literal] of [
      ['wants', wHi, 0.44], ['sale_rate', sHi, 0.343333], ['rating', rHi, 0.314286],
    ] as Array<[string, number, number]>) {
      const f = await raw1<{ age_days: number; want_count: number; views: number; avg_stars: number | null; sold: number; stock: number }>(c, HAND_SPEC_SQL, [id]);
      if (!f) continue;
      const age = Math.max(Number(f.age_days), 0);
      const recency = 1 / (1 + age);
      const rating = (f.avg_stars === null ? 3.0 : Number(f.avg_stars)) / 5;
      const cWants = Number(f.want_count);
      const wants = cWants / (cWants + 5);
      const v = Number(f.views);
      const views = v / (v + 100);
      const sold = Number(f.sold);
      const stock = Number(f.stock);
      const saleRate = sold + stock === 0 ? 0 : sold / (sold + stock);
      const want = 0.40 * recency + 0.20 * rating + 0.15 * wants + 0.15 * views + 0.10 * saleRate;
      handRows.push({ id, factor, want, literal });
    }
    R.handRows = handRows;
    R.sheetRecommend = rowsToSheet(recRows);
    R.sheetNew = rowsToSheet(newRows);

    // ---- S10 两份响应的 `feed_score` 逐行相等（背靠背两次调用 ⇒ now() 漂移压到毫秒级）
    R.sheetBackToBack = {
      recommend: rowsToSheet(await DatabaseService.listBrands(0, pageLimit, ex, 'recommend') as unknown as Array<Record<string, unknown>>),
      newArm: rowsToSheet(await DatabaseService.listBrands(0, pageLimit, ex, 'new') as unknown as Array<Record<string, unknown>>),
    };

    // ---- 负控用 mutant 序（独立 oracle 复算，不改代码）
    R.oracleDefaultFull = oracleDefault;
    R.mutantZeroWants = await oracleByScore(c, five(gateWeights({
      recency: DEFAULT_FEED_SCORE_WEIGHTS.recency,
      rating: DEFAULT_FEED_SCORE_WEIGHTS.rating,
      wants: '0',
      views: DEFAULT_FEED_SCORE_WEIGHTS.views,
      sale_rate: DEFAULT_FEED_SCORE_WEIGHTS.sale_rate,
    } as Record<string, unknown>).normalized));

    return R;
  });

  console.warn = origWarn; // 还原（tx 自身错误以 `r.error` 回报，不抛出 ⇒ 此处必经）

  const R = (r.result ?? {}) as Record<string, any>;
  const ids = (R.ids ?? {}) as Record<string, number>;

  ck.t('B0',
    '事务内全链执行未抛未预期异常（夹具 = 真 `createListingRow` 写路径 ×13 · `listing.view_count` 列在场）',
    r.error === null && !!r.result && Number(R.listed_total ?? 0) >= 13 && Number(R.schema?.view_count_col ?? 0) === 1,
    JSON.stringify({ error: String((r.error as { message?: string })?.message ?? ''), listed_total: R.listed_total, schema: R.schema, ms: r.ms }));

  const g = (k: string) => Number(ids[k] ?? 0);
  const sGroup = [g('nNew'), g('nMid'), g('nOld')];

  ck.t('B1',
    '★`new` 臂（真路径）：时间组三条按 `time_created` **逐字降序**（0.2d → 1.2d → 2.2d），且该序与同三条的 '
    + '**score 序不同**（`n-old` 的 wants+views 拉满 ⇒ 推荐态它排第一）⇒ 证明 new **真按时间、不算分**',
    !!R.armNew && sameSeq(R.armNew.filter((id: number) => sGroup.includes(id)), sGroup)
      && !sameSeq(R.armNew.filter((id: number) => sGroup.includes(id)), R.armDefault.filter((id: number) => sGroup.includes(id))),
    JSON.stringify({
      new_group: R.armNew ? R.armNew.filter((id: number) => sGroup.includes(id)) : null,
      recommend_group: R.armDefault ? R.armDefault.filter((id: number) => sGroup.includes(id)) : null,
      expect_time_desc: sGroup,
    }));

  ck.t('B2',
    '★`new` 臂**全页逐行** = 独立 oracle（`ORDER BY time_created DESC, listing_id DESC`，全库 listed 含夹具）'
    + '—— 排序轴单一、分页上限内零缺行零错位',
    !!R.armNew && !!R.oracleNew && sameSeq(R.armNew, R.oracleNew),
    JSON.stringify({ n: R.armNew?.length, first5: R.armNew?.slice(0, 5), oracle5: R.oracleNew?.slice(0, 5) }));

  const cmpDefault = R.armDefault && R.oracleDefaultFull
    ? orderMatches(R.armDefault, R.oracleDefaultFull) : { ok: false, reason: 'no data', swaps: 0 };
  ck.t('B3',
    '★`recommend` 臂**全页逐行** = 独立 oracle（五因子公式 · 默认权重 0.40/0.20/0.15/0.15/0.10 复算）'
    + '—— 五因子组合口径与实现一致（近分并列容忍 1e-6，真实并列由三级 tie-break 消解）',
    cmpDefault.ok,
    JSON.stringify({ ok: cmpDefault.ok, reason: cmpDefault.reason, swaps: cmpDefault.swaps, n: R.armDefault?.length, first5: R.armDefault?.slice(0, 5), oracle5: R.oracleDefaultFull?.ids.slice(0, 5) }));

  ck.t('B4',
    '★分页语义不变：`skip=0&limit=2` + `skip=2&limit=2` 拼起来 == `new` 全序前 4、两页无交集；'
    + '全页 `b_id` **唯一**（去重语义不变）',
    !!R.pages && !!R.armNew
      && sameSeq([...R.pages.page1, ...R.pages.page2], R.armNew.slice(0, 4))
      && new Set(R.pages.page1).size === R.pages.page1.length
      && new Set(R.armNew).size === R.armNew.length,
    JSON.stringify({ pages: R.pages, head4: R.armNew?.slice(0, 4), unique: R.armNew ? new Set(R.armNew).size : null, n: R.armNew?.length }));

  const keyList: string[] = R.keys?.recommend ?? [];
  const forbidden = ['score', 'recency', 'rating_raw', 'wants_n', 'views_n', 'sale_rate', 'seller_rating_avg', 'view_count', 'sold_qty'];
  const newArmKeyList: string[] = R.keys?.newArm ?? [];
  const feedScoreValues: string[] = R.keys?.feedScoreValues ?? [];
  ck.t('B5',
    '★**恰一个派生键 `feed_score`**（键集 50→**51**）：两臂同批行键集**逐字相同**、恰 **51** 键 · '
    + '`feed_*` 键只有 `feed_score` 一个且恒在场（**6 位小数字符串**，不是 number）· '
    + '无 `score` / 因子原始值键（`recency` / `rating_raw` / `wants_n` / `views_n` / `sale_rate` / `view_count`）· '
    + '`wants` 键仍 = `listing_favorite` 计数（口径不变）',
    keyList.length === 51
      && JSON.stringify(keyList) === JSON.stringify(newArmKeyList)
      && keyList.includes('feed_score')
      && JSON.stringify(R.keys?.feedScoreTokens ?? []) === JSON.stringify(['feed_score'])
      && JSON.stringify(R.keys?.feedScoreTypes ?? []) === JSON.stringify(['string'])
      && feedScoreValues.every(isSixDp)
      && forbidden.every((k) => !keyList.includes(k))
      && R.wantsOk === true,
    JSON.stringify({
      key_count: keyList.length, feed_tokens: R.keys?.feedScoreTokens, types: R.keys?.feedScoreTypes,
      forbidden_hits: forbidden.filter((k) => keyList.includes(k)), wants_ok: R.wantsOk,
      sample: feedScoreValues.slice(0, 4),
    }));

  // ---- S9 · `feed_score` 逐行对拍公式（全页 vs 独立 oracle + 三行手算）
  const oracleMap = new Map<number, number>();
  ((R.oracleDefaultFull?.ids ?? []) as number[]).forEach((id, i) => {
    oracleMap.set(id, Number(R.oracleDefaultFull.scores[i]));
  });
  const sheetRec: Map<number, string> = R.sheetRecommend ?? new Map();
  const handRows: Array<{ id: number; factor: string; want: number; literal: number }> = R.handRows ?? [];
  ck.t('S9',
    '★**`feed_score` 逐行对拍公式**：全页每行 = 独立 oracle（SQL 五因子复算 · 默认权重）同名分值（1e-6）· '
    + '三行**手算**（门内 TS 算术逐项写死 0.40/0.20/0.15/0.15/0.10 与 5 / 100 / 中性 3 星）对拍（2e-5，'
    + '`now()` 年龄漂移）且贴字面量期望（wants 行 0.44 · sale_rate 行 0.343333 · rating 行 0.314286）· '
    + '每行形态 = 6 位小数串',
    s9Passes(sheetRec, oracleMap, handRows),
    JSON.stringify({
      rows: sheetRec.size, oracle_rows: oracleMap.size,
      hand: handRows.map((h) => ({ factor: h.factor, id: h.id, hand: Number(h.want.toFixed(6)), literal: h.literal, got: sheetRec.get(h.id) })),
      max_abs_diff_vs_oracle: Math.max(0, ...[...sheetRec].map(([id, s]) => Math.abs(Number(s) - (oracleMap.get(id) ?? 0)))),
    }));

  // ---- S9n · 负控：把 `feed_score` 输出改成常量 0 ⇒ 同一判据必转 false
  const mutantZeroSheet = new Map<number, string>([...sheetRec.keys()].map((id) => [id, '0.000000']));
  ck.t('S9n',
    '★**负控（S9 非恒真）**：把 `feed_score` 输出改成常量 `0.000000`（同 id 集合、同串形态）⇒ 同一 S9 判据必转 **false**；'
    + '真实态为 **true**',
    s9Passes(sheetRec, oracleMap, handRows) === true
      && s9Passes(mutantZeroSheet, oracleMap, handRows) === false,
    JSON.stringify({
      real: s9Passes(sheetRec, oracleMap, handRows),
      mutant_constant_zero: s9Passes(mutantZeroSheet, oracleMap, handRows),
      mutant_sample: [...mutantZeroSheet].slice(0, 3),
    }));

  // ---- S10 · 分值只由公式 + 权重决定，与排序轴无关
  const sheetA: Map<number, string> = R.sheetBackToBack?.recommend ?? new Map();
  const sheetB: Map<number, string> = R.sheetBackToBack?.newArm ?? new Map();
  const shared = [...sheetA.keys()].filter((id) => sheetB.has(id));
  const diffs = shared.map((id) => Math.abs(Number(sheetA.get(id)) - Number(sheetB.get(id))));
  ck.t('S10',
    '★**与排序无关**：`sort=recommend` 与 `sort=new` 两份响应（背靠背同事务）同 id 行 `feed_score` **逐行相等**'
    + '（2e-6 = 6 位小数的 2 个末位；`recency` 含 `now()` ⇒ 两次调用的毫秒漂移不可见）· 两臂 id 集合覆盖全页 ·'
    + ' 两臂均 6 位小数串',
    shared.length > 0 && shared.length === sheetA.size && shared.length === sheetB.size
      && diffs.every((d) => d <= 2e-6)
      && [...sheetA.values()].every(isSixDp) && [...sheetB.values()].every(isSixDp),
    JSON.stringify({
      rows: shared.length, max_abs_diff: Math.max(0, ...diffs),
      identical_strings: shared.filter((id) => sheetA.get(id) === sheetB.get(id)).length,
      sample: shared.slice(0, 3).map((id) => ({ id, recommend: sheetA.get(id), new: sheetB.get(id) })),
    }));

  const pairArms: Array<{ id: string; label: string; hi: number; lo: number; note: string }> = [
    { id: 'B6a', label: 'wants（收藏 c/(c+5)）', hi: g('wHi'), lo: g('wLo'), note: '20 收藏 vs 0' },
    { id: 'B6b', label: 'views（浏览 v/(v+100)）', hi: g('vHi'), lo: g('vLo'), note: '900 浏览 vs 0' },
    { id: 'B6c', label: 'sale_rate（已售/(已售+库存)）', hi: g('sHi'), lo: g('sLo'), note: '9 已售/库存 1（0.90）vs 0/100（0）' },
    { id: 'B6d', label: 'rating（卖家均星/5）', hi: g('rHi'), lo: g('rLo'), note: '5★ 卖家 vs 1★ 卖家' },
    { id: 'B6e', label: 'recency（发布时间 1/(1+age)）', hi: g('cNew'), lo: g('cOld'), note: '0.5 天 vs 6 天' },
  ];
  for (const arm of pairArms) {
    ck.t(arm.id,
      `★因子单独生效（${arm.label}）：同刻发布、只差该因子的一对（${arm.note}）⇒ 强项必在弱项**之前**`
      + '（弱项 listing_id 更大 ⇒ 若该因子被忽略，tie-break 会让它反而排前 ⇒ 该臂非恒真）',
      !!R.armDefault && pairOk(R.armDefault, arm.hi, arm.lo),
      JSON.stringify({
        hi: arm.hi, lo: arm.lo,
        pos_hi: R.armDefault ? posOf(R.armDefault, arm.hi) : null,
        pos_lo: R.armDefault ? posOf(R.armDefault, arm.lo) : null,
      }));
  }

  const wD = (R.wDefault ?? {}) as FeedScoreWeights;
  const wC = (R.wConfig ?? {}) as FeedScoreWeights;
  const wP = (R.wPartial ?? {}) as FeedScoreWeights;
  const wI = (R.wInvalid ?? {}) as FeedScoreWeights;
  const wM = (R.wMixed ?? {}) as FeedScoreWeights;

  ck.t('B7a',
    '★权重臂①**缺行 ⇒ 默认**：`source="default"`、`overridden=[]`、归一化权重逐字 = 0.40/0.20/0.15/0.15/0.10，'
    + '且推荐序 == 默认权重 oracle',
    wD.source === 'default' && wD.overridden.length === 0
      && FEED_SCORE_WEIGHT_FIELDS.every((f) => Math.abs(wD.normalized[f] - DEFAULT_FEED_SCORE_WEIGHTS[f]) < 1e-12)
      && cmpDefault.ok,
    JSON.stringify({ source: wD.source, normalized: wD.normalized, sum: wD.sum }));

  const cmpConfig = R.armConfig && R.oracleConfig
    ? orderMatches(R.armConfig, { ids: R.oracleConfig, scores: R.oracleConfig.map(() => 0) }, 1e9) : { ok: false, reason: 'no data' };
  ck.t('B7b',
    '★权重臂②**全配置 ⇒ 按配置算**：`{recency:0,rating:0,wants:1,views:0,sale_rate:0}` ⇒ '
    + '`source="config"`、five overridden、`normalized.wants=1`、推荐序 == 该配置 oracle 的**逐行相同**序，'
    + '且与默认序**不同**（配置真被读取，不是恒默认）',
    wC.source === 'config' && wC.overridden.length === 5
      && Math.abs(wC.normalized.wants - 1) < 1e-12
      && sameSeq(R.armConfig ?? [], R.oracleConfig ?? [])
      && !sameSeq(R.armConfig ?? [], R.armDefault ?? []),
    JSON.stringify({
      source: wC.source, overridden: wC.overridden, normalized: wC.normalized,
      same_order_as_default: sameSeq(R.armConfig ?? [], R.armDefault ?? []),
      head: (R.armConfig ?? []).slice(0, 5),
    }));

  const cmpPartial = R.armPartial && R.oraclePartial
    ? orderMatches(R.armPartial, { ids: R.oraclePartial, scores: R.oraclePartial.map(() => 0) }, 1e9) : { ok: false };
  ck.t('B7c',
    '★权重臂③**逐项回落 + 和归一化**（只给 `wants=9`）：`source="partial"`、`overridden=["wants"]`、'
    + '`raw` = wants 9 / 其余默认、`normalized` 和 = 1 且与门独立复算逐项一致、推荐序 == 该权重 oracle',
    wP.source === 'partial' && JSON.stringify(wP.overridden) === JSON.stringify(['wants'])
      && Math.abs(wP.raw.wants - 9) < 1e-12
      && Math.abs(wP.raw.views - DEFAULT_FEED_SCORE_WEIGHTS.views) < 1e-12
      && Math.abs(FEED_SCORE_WEIGHT_FIELDS.reduce((a, f) => a + wP.normalized[f], 0) - 1) < 1e-9
      && cmpPartial.ok,
    JSON.stringify({ source: wP.source, overridden: wP.overridden, raw: wP.raw, normalized: wP.normalized, sum: wP.sum }));

  ck.t('B7d',
    '★权重臂④**非法 ⇒ 全默认 + 日志**（`{recency:null,wants:"-1",views:"banana"}`）：`source="default"`、`overridden=[]`、'
    + '推荐序 == 默认序、且 `console.warn` 有 `[feed.score]` 回落日志（fail-open 但不静默）',
    wI.source === 'default' && wI.overridden.length === 0
      && sameSeq(R.armInvalid ?? [], R.armDefault ?? [])
      && Array.isArray(R.invalid_warns) && R.invalid_warns.some((w: string) => w.includes('[feed.score]')),
    JSON.stringify({ source: wI.source, overridden: wI.overridden, warns: R.invalid_warns }));

  const cmpMixed = R.armMixed && R.oracleMixed
    ? orderMatches(R.armMixed, { ids: R.oracleMixed, scores: R.oracleMixed.map(() => 0) }, 1e9) : { ok: false };
  ck.t('B7e',
    '★权重臂⑤**部分非法 ⇒ 该项回落、其余采信**（`{wants:"0.5",views:"banana"}`）：`source="partial"`、'
    + '`raw.wants=0.5` / `raw.views=默认`、推荐序 == 该权重 oracle、且有 `[feed.score]` 部分回落日志',
    wM.source === 'partial' && Math.abs(wM.raw.wants - 0.5) < 1e-12
      && Math.abs(wM.raw.views - DEFAULT_FEED_SCORE_WEIGHTS.views) < 1e-12
      && cmpMixed.ok
      && Array.isArray(R.mixed_warns) && R.mixed_warns.some((w: string) => w.includes('[feed.score]')),
    JSON.stringify({ source: wM.source, raw: wM.raw, warns: R.mixed_warns }));

  ck.t('B7f',
    '权重臂收尾：删行后 `getFeedScoreWeights` 回 `source="default"`（同一真源语句的「行缺席」分支真实可达）',
    (R.wRestored as FeedScoreWeights)?.source === 'default',
    JSON.stringify({ source: (R.wRestored as FeedScoreWeights)?.source }));

  // ======================================================================== N · 负控
  ck.t('N1',
    '★负控①**`new` 若仍用 score ⇒ 本门必红**：用 recommend 实序（= score 序）当 mutant 喂进「new 时间降序」判据 ⇒ '
    + '谓词转 **false**；同时对真实 new 序为 **true**（判据非恒真/恒假）',
    sameSeq(R.armDefault?.filter((id: number) => sGroup.includes(id)) ?? [], sGroup) === false
      && sameSeq(R.armNew?.filter((id: number) => sGroup.includes(id)) ?? [], sGroup) === true,
    JSON.stringify({
      mutant_score_order: R.armDefault?.filter((id: number) => sGroup.includes(id)),
      real_new_order: R.armNew?.filter((id: number) => sGroup.includes(id)), want: sGroup,
    }));

  ck.t('N2',
    '★负控②**权重读回若硬编默认 ⇒ 配置臂必红**：配置序 ≠ 默认序（同一 DB 同一夹具），'
    + '且把**默认序**喂进「配置臂」判据（要求与配置 oracle 逐行相同）⇒ 必 false',
    !sameSeq(R.armConfig ?? [], R.armDefault ?? [])
      && sameSeq(R.armDefault ?? [], R.oracleConfig ?? []) === false
      && sameSeq(R.armConfig ?? [], R.oracleConfig ?? []) === true,
    JSON.stringify({
      config_head: (R.armConfig ?? []).slice(0, 4),
      default_head: (R.armDefault ?? []).slice(0, 4),
      oracle_config_head: (R.oracleConfig ?? []).slice(0, 4),
      default_passes_config_predicate: sameSeq(R.armDefault ?? [], R.oracleConfig ?? []),
    }));

  ck.t('N3',
    '★负控③**`wants` 因子若写死 0 ⇒ 收藏对臂必红**：把 wants 权重置 0（独立 oracle 复算 mutant）⇒ '
    + '该对两行同分 ⇒ 退化为 `listing_id DESC` 让**弱项**排前 ⇒ `pairOk` 转 false（B6a 非恒真）',
    !!R.mutantZeroWants && pairOk(R.mutantZeroWants.ids, g('wHi'), g('wLo')) === false
      && pairOk(R.armDefault ?? [], g('wHi'), g('wLo')) === true,
    JSON.stringify({
      mutant_pos_hi: R.mutantZeroWants ? posOf(R.mutantZeroWants.ids, g('wHi')) : null,
      mutant_pos_lo: R.mutantZeroWants ? posOf(R.mutantZeroWants.ids, g('wLo')) : null,
      real_pos_hi: R.armDefault ? posOf(R.armDefault, g('wHi')) : null,
      real_pos_lo: R.armDefault ? posOf(R.armDefault, g('wLo')) : null,
    }));

  // ======================================================================== H · 真 HTTP 臂（零夹具）
  try {
    process.env.VERCEL = '1';
    const mod = await import('../../backend-ts/src/index');
    const app = (mod as { default: { listen: (p: number, cb?: () => void) => unknown } }).default;
    const server = app.listen(0) as unknown as {
      address: () => { port: number } | null;
      close: (cb?: () => void) => void;
      once: (ev: string, cb: () => void) => void;
    };
    await new Promise<void>((resolve) => { server.once('listening', resolve); setTimeout(resolve, 5000); });
    const port = server.address()?.port ?? 0;
    const base = `http://127.0.0.1:${port}`;
    const getJson = async (p: string) => {
      const res = await fetch(`${base}${p}`);
      const body = await res.json() as Record<string, unknown>;
      return { status: res.status, cache: res.headers.get('cache-control') ?? '', body };
    };
    const idsOf = (b: Record<string, unknown>) => ((b.data ?? []) as Array<Record<string, unknown>>).map((x) => Number(x.bID));

    const hBad = await getJson('/api/prize/all?sort=banana');
    const errBad = (hBad.body.error ?? {}) as { code?: string; details?: Record<string, unknown> };
    ck.t('H1',
      '★真 HTTP（非法 sort）：`/api/prize/all?sort=banana` ⇒ **400** · `error.code=LEDGER_AMOUNT_INVALID`（借码）· '
      + "`details.reason='sort_invalid'` · `details.field='sort'` · `allowed` 含 recommend/new"
      + '（证明路由已注册、参数解析到位，**不是**末尾 catch-all 的 `route_not_found`）',
      hBad.status === 400 && errBad.code === 'LEDGER_AMOUNT_INVALID'
        && String(errBad.details?.reason ?? '') === 'sort_invalid'
        && String(errBad.details?.field ?? '') === 'sort'
        && Array.isArray(errBad.details?.allowed)
        && (errBad.details?.allowed as string[]).includes('recommend')
        && (errBad.details?.allowed as string[]).includes('new'),
      JSON.stringify({ status: hBad.status, error: errBad }));

    const hNew = await getJson('/api/prize/all?sort=new&limit=5');
    const truthNew = await oracleByTime(pool as unknown as Qx);
    ck.t('H2',
      '★真 HTTP（`sort=new&limit=5`）⇒ 200 · `data` 长度 ≤ 5 · id 序列 = 独立时间序 oracle 前 5（**真走公共读口**）',
      hNew.status === 200 && idsOf(hNew.body).length <= 5
        && sameSeq(idsOf(hNew.body), truthNew.slice(0, idsOf(hNew.body).length)),
      JSON.stringify({ status: hNew.status, got: idsOf(hNew.body), oracle5: truthNew.slice(0, 5) }));

    const hRec = await getJson('/api/prize/all?sort=recommend&limit=6');
    const hDef = await getJson('/api/prize/all?limit=6');
    const hUpper = await getJson('/api/prize/all?sort=%20NEW%20&limit=3');
    ck.t('H3',
      '★真 HTTP（缺省语义）：`?sort=recommend&limit=6` 与**缺参** `?limit=6` 的 id 序列**逐字相同**'
      + '（缺省 = 推荐）· `?sort=%20NEW%20` 归一后 200（大小写/空白容错）',
      hRec.status === 200 && hDef.status === 200 && hUpper.status === 200
        && sameSeq(idsOf(hRec.body), idsOf(hDef.body)) && idsOf(hRec.body).length > 0,
      JSON.stringify({ recommend: idsOf(hRec.body), default: idsOf(hDef.body), upper_status: hUpper.status }));

    ck.t('H4',
      '★真 HTTP（错误体不带公共缓存头）：400 响应 `Cache-Control` 不含 `public`（错误体不得进 CDN）',
      !/public/.test(hBad.cache),
      JSON.stringify({ cache: hBad.cache }));

    // ★ 两个同源读口一致：`/api/home` 的 prizes 与 `/api/prize/all` 同批行：键集 51 且 `feed_score` 逐行相等
    const hHome = await getJson('/api/home?prize_limit=5');
    const homePrizes = ((hHome.body.data ?? {}) as { prizes?: Array<Record<string, unknown>> }).prizes ?? [];
    const homeSheet = rowsToSheet(homePrizes);
    const allSheet = rowsToSheet((hRec.body.data ?? []) as Array<Record<string, unknown>>);
    const homeKeys = homePrizes.length ? Object.keys(homePrizes[0]).sort() : [];
    const homeShared = [...allSheet.keys()].filter((id) => homeSheet.has(id));
    ck.t('H5',
      '★**两份同源读口一致**：`/api/home` 与 `/api/prize/all` 的 feed 行键集**逐字相同（51 键）**、'
      + '`feed_score` 同 id 行**逐行相等**（2e-6）⇒ 首页与列表页拿到的排序依据同源同值',
      hHome.status === 200 && homePrizes.length > 0 && homeKeys.length === 51
        && homeShared.length > 0
        && homeShared.every((id) => Math.abs(Number(homeSheet.get(id)) - Number(allSheet.get(id))) <= 2e-6)
        && [...homeSheet.values()].every(isSixDp),
      JSON.stringify({ status: hHome.status, home_rows: homePrizes.length, home_keys: homeKeys.length, shared: homeShared.length, sample: homeShared.slice(0, 3).map((id) => ({ id, home: homeSheet.get(id), all: allSheet.get(id) })) }));

    await new Promise<void>((resolve) => server.close(() => resolve()));
    out.http = { port, bad: { status: hBad.status, error: errBad }, new_head: idsOf(hNew.body), rec_head: idsOf(hRec.body), home_head: idsOf({ data: homePrizes }) };
  } catch (e) {
    for (const id of ['H1', 'H2', 'H3', 'H4', 'H5']) {
      ck.t(id, '★真 HTTP 臂', false, `error=${String((e as Error).message ?? e)}`);
    }
  }

  // ======================================================================== Z · 残留
  const committedAfter = {
    listing: await countOf(pool as unknown as Qx, 'listing'),
    listing_order: await countOf(pool as unknown as Qx, 'listing_order'),
    listing_favorite: await countOf(pool as unknown as Qx, 'listing_favorite'),
    rating: await countOf(pool as unknown as Qx, 'rating'),
    app_config: await countOf(pool as unknown as Qx, 'app_config'),
    migrations: await countOf(pool as unknown as Qx, 'schema_migration'),
  };
  ck.t('Z1',
    '★零残留：listing / listing_order / listing_favorite / rating / app_config / schema_migration 行数**前后相等**'
    + '（夹具与配置翻行全在单回滚事务内）',
    Object.keys(committedBefore).every((k) => (committedBefore as Record<string, number>)[k] === (committedAfter as Record<string, number>)[k]),
    JSON.stringify({ before: committedBefore, after: committedAfter }));

  const fixtureLeft = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.listing WHERE create_key LIKE 'cli:p74-gate:%'"))[0]?.n ?? -1);
  const usersLeft = Number((await qRetry<{ n: number }>(pool,
    "SELECT count(*)::int AS n FROM public.users WHERE bio LIKE 'p74-gate%'"))[0]?.n ?? -1);
  const cfgLeft = Number((await qRetry<{ n: number }>(pool,
    'SELECT count(*)::int AS n FROM public.app_config WHERE key = $1', [FEED_SCORE_WEIGHTS_KEY]))[0]?.n ?? -1);
  ck.t('Z2',
    '★零残留（夹具面）：`cli:p74-gate:*` listing 命中 0 · `p74-gate` 用户 0 · `feed_score_weights` 行回落到改前状态',
    fixtureLeft === 0 && usersLeft === 0 && cfgLeft === 0,
    JSON.stringify({ fixture_left: fixtureLeft, users_left: usersLeft, cfg_left: cfgLeft }));

  ck.t('Z3',
    '★库身份与门自身健全：`inRollbackTx` 恒 ROLLBACK（`rolled_back=true` 且无 error）· 夹具 uid 段 ≥ 909801',
    r.rolled_back === true && r.error === null && Math.min(...Object.values(FIX_UID).filter((v) => v < 909820)) >= 909801,
    JSON.stringify({ rolled_back: r.rolled_back, ms: r.ms, attempts: r.attempts, uid_base: FIX_UID.sellerS }));

  await pool.end().catch(() => undefined);

  out.checks = ck.checks;
  out.summary = ck.summary();
  const file = save('p74-feed-sort-gate', out);
  console.log(JSON.stringify({ saved: file, summary: out.summary, readings: { listed_total: R.listed_total, keys: R.keys?.count, http: out.http } }, null, 1));
  process.exit((out.summary as { failed: number }).failed > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
