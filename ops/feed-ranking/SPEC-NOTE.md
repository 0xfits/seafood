# SPEC-NOTE · 首页 / 商品列表「综合排序」契约登记（FEED-RANK v1）

- **单号** = `JING-SPEC-FEED-RANK` · **角色** = Jing（Specifier · 制度员）
- **日期** = 2026-10-19 · **仓** = `/Users/kevin/bistro/seafood` · **基线 HEAD** = `b10f3d6`
- **交付性质** = **只登记契约**（`docs/**` + 本件）；**零代码、零迁移、零生产 HTTP**
- **状态** = 契约冻结（v1）· 实现归 Kong / 质检归 Neng / 本笔**不 push**
- **正典位置** = `docs/route-layer.spec.md` **v2.42 §49** · `docs/seafood.master-plan.md` **§5.425 + 版本行 v0.342** · `docs/OPEN-ITEMS.md`（**`B35` / `B36`**，顶部 v2.43 块）

---

## 1. Kevin 定稿（逐字）

> 「首页 / 商品列表改**综合排序** —— **发布时间权重最大，额外权重给到发布者的评价分数**，后续完善算法。」

三项要点：① 排序口径 = **综合分**（不是单键）；② **时效主导**；③ 卖家评价 = **额外权重**（辅助项，不得压过时效）；④ 显式授权「后续完善算法」⇒ 挂账 `B35`。

## 2. 冻结契约（v1）

```text
score   = FEED_RECENCY_WEIGHT × recency + FEED_RATING_WEIGHT × rating   -- 0.8 / 0.2
recency = 1 / (1 + age_days)        age_days = GREATEST((now() − l.time_created) / 86400, 0)
rating  = COALESCE(avg(r.stars) WHERE r.ratee_uid = l.seller_uid, FEED_RATING_NEUTRAL_STARS) / 5
ORDER BY score DESC, l.time_created DESC, l.listing_id DESC
```

| 项 | 冻结值 | 说明 |
|---|---|---|
| `FEED_RECENCY_WEIGHT` | **0.8** | 发布时间权重（最大项） |
| `FEED_RATING_WEIGHT` | **0.2** | 卖家评价权重 |
| `FEED_RATING_NEUTRAL_STARS` | **3.0** | 无评分中性分（五星中位 ⇒ 不奖不罚） |
| 评分聚合轴 | `rating.ratee_uid` | **不分 `direction`**（只问「该卖家收到的分」） |
| 分母 | **5.0** | `stars numeric(5,4)` 值域 `0…5` |
| tie-break | `time_created DESC, listing_id DESC` | `listing_id` = PK ⇒ **全序无并列** |
| 分页 | 位置分页（`LIMIT/OFFSET`） | `skip/limit` 缺省与上下限**一字未改** |

**数值语义（代入中性 3.0 ⇒ 评分项恒 0.12）**

| 发布距今 | recency | score（无评分卖家） |
|---|---|---|
| 刚发布 | 1.0 | **0.92** |
| 1 天 | ≈0.5 | 0.52 |
| 7 天 | ≈0.125 | 0.22 |
| 30 天 | ≈0.032 | ≈0.146 |

满 5 星卖家 **+0.2**（上限 1.0）· 0 星卖家 **−0.12** ⇒ 评分**只做同档微调**，压不过时效（`0.2 < 0.8`）。

**常量纪律**：权重 / 中性分**只许以具名常量出现**（`backend-ts/src/database.ts:565-567` 编制时点现取），SQL 侧引用同源常量，**不得散落字面量**；**v1 不配置化**，且**不动 `app_config` 合法键**（`LEGAL_APP_CONFIG_KEYS` 零改动）。

## 3. 作用面（哪些口 · 零新路由）

| # | 读口 | 链（编制时点现取） | 参数 |
|---|---|---|---|
| 1 | `GET /api/prize/all` | `index.ts:605` → `listPrizes(skip, limit)`（`database.ts:4514`）→ `listBrands`（`:2590`） | `getPagination` |
| 2 | `GET /api/home` | `index.ts:913` → `listPrizes(0, prizeLimit)`（`:932`） | `prize_limit` 缺省 **8** / 上限 **16** |

- 唯一改动点 = `listBrands` 的 `ORDER BY` ⇒ 两口**必然同序**（判负 #6）。
- **注册点 `110`**（get 49 / post 57 / put 0 / delete 3 / patch 1 现取）⇒ **111 判负**。
- `job` 轴（`/api/task/all`、`/api/home.tasks`）**排序未动**。

## 4. 判负（6 条 · 质检必带）

| # | 输入 / 探针 | 期望 | 判负 |
|---|---|---|---|
| 1 | `/api/home` `data.prizes[0]`（`rating` 0 行库况） | = `time_created` 最大者 | 首条非最新 |
| 1′ | 库内有评分行时 | 逐条复算 `score` 与响应顺序**逐位相等** | 任一位不等 |
| 2 | 同库态连续两次请求同一 `skip/limit` | `bID` 数组逐位相同 | 顺序不同 |
| 3 | 响应行键集 | 45 键不变、`score` **零命中** | 出现 `score` / 新键 |
| 4 | 注册点复算 | `regs === 110` | 109 / 111 |
| 5 | `skip=0&limit=8` vs `skip=8&limit=8` | 交集 ∅ / 并集 16 | 重复 / 缺行 |
| 6 | `/api/prize/all?limit=8` vs `/api/home` | 前 8 条逐位相同 | 不一致 |

> ★ **#1 的边界**：只有在「评分项对全体等值」时才等价于「最新在首」；一旦 `rating` 有行，**必须**换成 #1′ 的复算式判据 —— 不得把「首条 = 最新」当无条件断言。

## 5. 现取读数（编制时点 · dev 本地实例 `5788`）

| 项 | 读数 |
|---|---|
| `/api/home` prizes | `[76, 71, 24, 23, 22, 21, 20, 19]` |
| 同口径第二次请求 | 同序列（**逐位相同**） |
| `/api/prize/all` `skip=0&limit=8` | 同序列 |
| `/api/prize/all` `skip=8&limit=8` | `[18, 17, 16, 15, 14, 13, 12, 11]`（交集 ∅ / 并集 **16**） |
| 响应行键数 | **45** · `score` **零命中** |
| `rating` 行数（dev） | **0**（`count(*) = 0`） |
| `rating` 索引（dev） | 5 条：`idx_rating_ratee_time` / `idx_rating_target` / `rating_pk` / `rating_once_uniq` / `rating_idem_uniq` |
| 注册点 | **110** |
| 旧口径同库读数 | `ORDER BY listing_id LIMIT 8 OFFSET 0` ⇒ `[1..8]`；`listing` 26 行 = `[1..24, 71, 76]` |

**★ 披露**：上表读数的服务端是**实现单在改未提交**的工作树（`M backend-ts/src/database.ts`）跑起来的本地实例 ⇒ 它证明「契约可实现」，**不是**验收结论；验收读数须由 Neng 在提交版上独立取。

## 6. 旧口径缺陷与归因二分

- **旧实现** = `ORDER BY l.listing_id` **升序** + `LIMIT` ⇒ 「越早发布越靠前」⇒ **新发布永远排队尾**；首页缺省取 8 ⇒ 只看得见最早 8 件。
- **实证**：dev `listing` 26 行，旧查询第 1 页 = `[1..8]`；新发 `76`（`seller_uid 970213` · `time_created 2026-10-19 04:55:51.714191+00`）**第 1 页永不可见**。
- **归因二分（诚实）**：① **代码** = 排序轴选错（本单修）；② **环境** = 报障那次发布落在 **dev 库**（生产无该行）—— **不属代码缺陷**，本单不改环境口径（`dev / 生产` 库分离是既有口径）。

## 7. 索引与性能（本单不加索引）

- `rating` 表已存在（`0031_rating_and_order_event.sql:56`），**复合索引 `idx_rating_ratee_time (ratee_uid, time_created DESC)` 已在**（`0031:85-86`）⇒ `WHERE r.ratee_uid = l.seller_uid` 走**前导列**，**「缺 `ratee_uid` 单列索引」不成立**。
- `rating` **0 行** ⇒ 聚合每次至多扫 0 行、`COALESCE` 恒落中性分 ⇒ 当前表现 = **严格发布时间倒序**。
- 上量后的真问题 = 「每行一次相关子查询」+「全表排序」（**不是缺索引**）⇒ 待有量后做 `EXPLAIN` 实测（挂 `B36`），**本单零 DDL**。

## 8. 本笔改动清单（纯追加 · 删除行 0）

| 文件 | 改动 | numstat |
|---|---|---|
| `docs/route-layer.spec.md` | 头部 **v2.42** 块（状态 / 修订入口 / 要点）+ 新 **§49**（49.1–49.7） | **+88 / −0** |
| `docs/seafood.master-plan.md` | 新 **§5.425**（A–H 段）+ 版本表 **v0.342** 行 | **+12 / −0** |
| `docs/OPEN-ITEMS.md` | 顶部 **v2.43** 块 + B 段末 **`B35` / `B36`** 两行 | **+4 / −0** |
| `ops/feed-ranking/SPEC-NOTE.md` | 本件（新） | 新文件 |

**自证（本笔提交 · `git show --numstat HEAD` 现取）**：`git show --numstat HEAD` = `4 0 docs/OPEN-ITEMS.md` / `88 0 docs/route-layer.spec.md` / `12 0 docs/seafood.master-plan.md` / `126 0 ops/feed-ranking/SPEC-NOTE.md` ⇒ **删除列全 0**、**提交恰含这 4 个文件**（无第五个文件）。
**未触碰**：`backend-ts/**`、`frontend/**`、`migrations/**`（`M backend-ts/src/database.ts` 属并行实现单，**不在本笔 commit**）。

## 9. 未做 / 挂账

| # | 项 | 去向 |
|---|---|---|
| 1 | 算法后续完善（成交量 / 好评数 / 新鲜度曲线权重） | `OPEN-ITEMS` **`B35`** |
| 2 | 卖家评分聚合 `EXPLAIN` 实测 + 排序权重配置化 | `OPEN-ITEMS` **`B36`** |
| 3 | 位置分页「窗口滑动」（翻页期间插入 ⇒ 跨页重漏） | **既有性质**，非本单引入；要修须改游标分页 = 另一单 |
| 4 | 前端「排序切换」UI（综合 / 最新 / 价格…） | **未登记、未做**（本轮只改默认排序） |
| 5 | 生产侧排序与 `rating` 行数实测 | 本笔不连生产 ⇒ `NOT_MEASURED` |

---

**一句话**：契约冻结 = 一个函数的一行 `ORDER BY`（`score DESC, time_created DESC, listing_id DESC`）+ 三个具名常量；零新路由、零迁移、零响应键变化；旧口径「新发排队尾」的根因已在 dev 现取坐实（`[1..8]` ⇒ `76` 不可见）。
