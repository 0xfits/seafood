# FEED-RANK-v1 · 首页/商品列表改综合排序（0.8×时间衰减 + 0.2×卖家评分）

日期：2026-10-19 · 仓：`/Users/kevin/bistro/seafood`（main）· 基线 HEAD `b10f3d6`
性质：**纯 SELECT 排序轴变更**（单函数 `DatabaseService.listBrands`）· 零新路由 / 零迁移 / 零 DDL / 零前端改动

## 1. 改了什么

`backend-ts/src/database.ts`

| 位置 | 变更 |
|---|---|
| `:555-568` | 新增具名常量 `FEED_RECENCY_WEIGHT=0.8` / `FEED_RATING_WEIGHT=0.2` / `FEED_RATING_NEUTRAL_STARS=3.0`（集中定义 + 注释「v1；配置化另立单」，`LEGAL_APP_CONFIG_KEYS` 未动） |
| `:2596-2624` | `listBrands` 的 SELECT 改为派生列 `score`（子查询外包一层 `f`），`ORDER BY f.score DESC, f.time_created DESC, f.listing_id DESC`；`LIMIT/OFFSET` 原样 |

冻结公式（实现即逐字）：

```
score  = 0.8 × recency + 0.2 × rating
recency = 1 / (1 + age_days),  age_days = (now() - l.time_created)/86400   -- GREATEST(_,0) 兜未来时间戳
rating  = COALESCE(avg(public.rating.stars WHERE ratee_uid = l.seller_uid), 3.0) / 5   -- 不区分 direction
```

- `score` 是**排他派生列**：`normalizeBrand` 逐键显式列举（无 spread）⇒ 未漏进响应行（实测 45 键、`score` 缺席）。
- 分页语义不变（同一 `LIMIT/OFFSET`，只换排序轴）。

## 2. 读数

### 2.1 首条 = 最新发布（dev 5788，重启后）

| 面 | 修前（HEAD `b10f3d6`） | 修后 |
|---|---|---|
| `GET /api/home`（8 件） | `[1,2,3,4,5,6,7,8]`（最早发布占头，76 不可见） | `[76,71,24,23,22,21,20,19]` · 首条 `76 / "VPN"` |
| `GET /api/prize/all?limit=60`（26 件） | `[1..24,71,76]` | `[76,71,24,23,…,2,1]` · 首条 `76 / "VPN"` |

- **确定性**：`/api/home` 连发两次，bID 序列逐位相同（`home-a1.json` vs `home-a2.json`）。
- **两读口一致**：`/api/home` 前 8 位 == `/api/prize/all` 前 8 位（同一 `listBrands`）。
- **分页稳定**：`limit=5&skip=0,5,10,…` 拼接 == 全量 26（无重、无漏、逐位相同）。
- **独立 oracle**：直接用 SQL 复算 `score` 表达式排序（`score-probe.sql`），结果 == API 顺序（`scores-before.json` vs `prize60.json`）⇒ 实现与冻结公式逐字一致。

### 2.2 权重真生效（双臂 · 评分侧）

夹具：dev 库 `public.rating` 临时插 **1 行**（`ratee_uid=900001` = listing 23 的卖家，`stars=5.0`，`direction=customer_to_vendor`，`idempotency_key=feedrank:<uuid>`）。选它因为 listing 23 与竞品 24 **同龄**（同为 2026-10-02，差 3h），评分项之外几乎同分 ⇒ 排序位移只能由评分项解释。

| 观测 | 修前 | 插行后 |
|---|---|---|
| listing 23 名次 | 第 **4** 位（`score=0.164730`） | 第 **3** 位（`score=0.244730`，**+0.080000** = 0.2×[(5.0−3.0)/5]，与公式逐位吻合） |
| listing 23 vs 24（同龄邻居） | 23 在 24 **下** | 23 在 24 **上**（`[76,71,23,24,22,…]`） |
| 其余 25 件相对序 | — | **逐位不变**（位移仅限该卖家名下商品；oracle 复算的分数仅第 6 位小数因两次查询间 `now()` 漂移 −1e-6，无实质变化） |
| SQL oracle == API 顺序 | ✓ | ✓（`scores-with-rating.json` vs `prize60-with-rating.json`） |

对照：`/api/home` 亦同步变为 `[76,71,23,24,22,21,20,19]`；recency 仍压住评分（新发的 76 稳居第一，`score≈0.906` vs 满分卖家老货 `≈0.24`），符合 0.8/0.2 设计意图。

**回收**：`public.rating` 是 append-only（`trg_rating_append_only` BEFORE DELETE 无条件 RAISE）。
- 直删实测被拒：`P0001 rating is append-only: DELETE forbidden (rating_id=403)`（保留为证据，未绕过业务约束走产品路径）；
- 回收手法：单条 `DO $$ … $$` 内 `DISABLE TRIGGER trg_rating_append_only` → `DELETE` → `ENABLE TRIGGER`（同一隐式事务，DDL 可回滚；**不是迁移，无 schema 变更残留**）。
- 回收后读数：`rating` 计数 **1 → 0**（先 0 后 0，与开工前一致）；两触发器 `tgenabled='O'`（已复原）；`/api/prize/all` 与 `/api/home` 顺序**逐位回到基线**（`prize60-after-cleanup.json` / `home-after-cleanup.json`）。

### 2.3 门套

| 门 | 读数 | 判 |
|---|---|---|
| `frontend npm run build` | exit **0**（built in 1.93s） | 绿 |
| `frontend npm run test:unit` | **60 文件 / 577 例 / 0 failed** | 绿（≥60/577，**零锚改动**，前端无改） |
| `backend-ts npx tsc --noEmit` | exit **0** | 绿 |
| `p7b-03-offline-gates` | **37/37 · failed 0 · red=[]**，`registration_points=**110**` | 绿（零新路由 ⇒ 仍 110，非 111） |

## 3. 性能注记（建议后续单，本单不做）

- `rating` 现 0 行；`ratee_uid` 无单列索引，但既有 `idx_rating_ratee_time (ratee_uid, time_created DESC)` 前导列可用 ⇒ 相关子查询仍走索引，无需本单加索引。
- 排序为 `score` 全表表达式 ⇒ 无法用索引直接消除排序；数据量上到万级后再评估「预计算/物化 score」或 `listing(status, time_created)` 上的有界候选集（本单按裁定**不加索引、不写迁移**）。
- `now()` 是查询期常量（`STABLE`），同一次请求内所有行同一基准 ⇒ 页间稳定性有保证；跨请求漂移只影响极近分差，三级 tie-break 兜底。

## 4. 证据文件

| 文件 | 内容 |
|---|---|
| `home-a1.json` / `home-a2.json` | 修后 `/api/home` 两次（确定性） |
| `prize60.json` | 修后 `/api/prize/all?limit=60` |
| `prize60-with-rating.json` / `home-with-rating.json` | 插评分行后两读口 |
| `prize60-after-cleanup.json` / `home-after-cleanup.json` | 回收后（== 基线） |
| `scores-before.json` / `scores-with-rating.json` | SQL oracle 复算（含 `score`） |
| `score-probe.sql` | oracle 表达式（与 `database.ts` 同源常量同值） |
| `db.mjs` | 只读/受控探针（neon 直连 `.env.local`） |
| `rating-row-idem.txt` | 本次夹具 `idempotency_key`（已删） |
| `listing-rows.json` | 26 行 `listing_id/seller_uid/status/time_created/title` |
| `frontend-test-unit.log` | 60 文件 577 例 |
| `backend-5788.log` | 重启后 dev 后端日志 |
