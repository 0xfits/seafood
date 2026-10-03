# P9③ 实现续跑单（不 apply）· 评分 / 时效 / 订单状态机（发货·收货）

- **单号**：P9③ 实现【收口单】（Kong）
- **依据（真源 · 冻结）**：
  - `docs/data-layer.spec.md` **v0.23 §32**（`R-9-27`..`R-9-35` 就地注）
  - `docs/route-layer.spec.md` **v2.16 §29**（§29.12 裁定落位 · `R-9-33`）
  - `docs/requirements/p9-four-role-economy.md` §2 / §3
  - `docs/seafood.master-plan.md` §5.241 / §5.242
- **仓库**：`/Users/kevin/bistro/seafood`（**推送即上线 ⇒ 本单不 push**）
- **★ 硬边界**：**不 apply 任何迁移**；**不改已 apply 迁移**（`0015`/`0029` 等）；错误码闭集 **33 不动**；**不碰** `docs/*.spec.md` / `master-plan` / `docs/qa/**`；**不 `git add/commit/push`**；不 `npm install`；不碰/打印 `.env*`；**禁 `pkill -f`/`killall`**；不得启停 5787/5788；库面写一律事务内 + 末尾 `ROLLBACK`；**严禁 UPDATE `app_config`**；受控实例只用 5796/5797。

---

## 0. 开工锚（现取）

- **HEAD** = `72f1910`（分支 `main`）；开工前 `git status --porcelain` = **21 条已修改**（P9③ 实现面）+ 大量未跟踪产物目录（历史单产物）。收尾归因见 §9。
- **注册点逐 verb（现取）** = **85**：`get 36 / post 46 / put 0 / patch 1 / delete 2`（和 = 85）——`grep -cE '^[[:space:]]*app\.(get|post|put|patch|delete)\(' src/index.ts` = 85。
- **迁移数** = **30** 个 `.sql`（`0001`..`0031`，缺号 `0018`）；**本单零新增 / 零 apply / 零改已 apply 迁移**。两新迁移文件（**未 apply**）：`0030_listing_order_status_extend.sql` · `0031_rating_and_order_event.sql`。

## 1. 编译验证 + 注册点复取（① 收口复跑）

- **`tsc --noEmit`（backend-ts）退出码 = 0**（`0` 行输出）。
- **注册点 = 85 逐 verb 逐字**：`{get:36, post:46, put:0, patch:1, delete:2}`（`get 34→36` / `post 43→46` = P9③ 5 新口；`put/patch/delete` 不变）。
- 5 新口逐条注册**恰 1 处**：`GET /api/rating/summary` · `GET /api/timeliness` · `POST /api/rating` · `POST /api/listing-orders/:orderId/ship` · `POST /api/listing-orders/:orderId/receive`。

## 2. 冻结计数前推逐处（② 逐文件:行 · 旧 ⇒ 新 · 出处）

> 沿 `R-8-22`：注册点 `80→85`（5 新口），迁移 `28→30`（+`0030`/`0031`）。**未删任何断言**（仅前推期望值；各门「缩进注入」负对照以 `REG_POINTS_FROZEN + 1` 现算，自动随常量前推）。

| 文件:行 | 冻结常量 | 旧 ⇒ 新 | 依据 |
|---|---|---|---|
| `p8-s2-fee-rebate-gate.ts:72-73` | `REG_COUNT === …` + 说明串 | `80` ⇒ `85` | 注册点 +5（`P9③ 评分/时效/订单 5 新口 +5`） |
| `p8-s3-deposit-gate.ts:66` | `REG_POINTS_FROZEN` | `80` ⇒ `85` | 注册点 +5 |
| `p8-s3-deposit-gate.ts:76` | `MIGRATIONS_FROZEN` | `28` ⇒ `30` | +`0030` / +`0031` |
| `p8-s3b-address-gate.ts:63` | `REG_POINTS_FROZEN` | `80` ⇒ `85` | 注册点 +5 |
| `p8-s3b-address-gate.ts:65` | `MIGRATIONS_FROZEN` | `28` ⇒ `30` | +`0030` / +`0031` |
| `p8-s4-currency-review-gate.ts:61` | `REG_POINTS_FROZEN` | `80` ⇒ `85` | 注册点 +5 |
| `p8-s4-currency-review-gate.ts:63` | `MIGRATIONS_FROZEN` | `28` ⇒ `30` | +`0030` / +`0031` |
| `p8-s5-compliance-gate.ts:70` | `REG_POINTS_FROZEN` | `80` ⇒ `85` | 注册点 +5 |
| `p8-s5-compliance-gate.ts:72` | `MIGRATIONS_FROZEN` | `28` ⇒ `30` | +`0030` / +`0031` |
| `p8-s6-site-text-gate.ts:70` | `REG_POINTS_FROZEN` | `80` ⇒ `85` | 注册点 +5 |
| `p8-s6-site-text-gate.ts:75` | `PER_VERB_FROZEN` | `{get:34,post:43,put:0,patch:1,delete:2}` ⇒ `{get:36,post:46,…}` | 逐 verb 同前推 |
| `p8-s6-site-text-gate.ts:14` · `:115` | 头注释 / 说明串 | `80`（`34/43`）⇒ `85`（`36/46`） | 同 |
| **★ 收口附加** `p8-s7-batt-checkin-gate.ts:75` | `REG_POINTS_FROZEN` | `80` ⇒ `85` | P9③ 5 新口（续跑单遗漏，收口补前推） |
| **★ 收口附加** `p8-s7-batt-checkin-gate.ts:76` | `PER_VERB_FROZEN` | `{34,43}` ⇒ `{36,46}` | 同 |
| **★ 收口附加** `p8-s7-batt-checkin-gate.ts:13` | 头注释 A 组 | `80`（`34/43`）⇒ `85`（`36/46`） | 同 |
| **★ 收口附加** `p8-s7-batt-checkin-gate.ts:87-90` | `handlerBlock` 收口边界 | 「切到下一注册点」⇒ 先收本路由顶层 `});` | 修阻断：P9③ 在两路由间插顶层 helper `sendOrderTransition`，旧边界把它误并进 `BLOCK_MAKEUP`，令 `F2` 假红（详见 §7） |
| `p8-s8-rating-timeliness-gate.ts:59-60` | `REG_POINTS_FROZEN` / `PER_VERB_FROZEN` | 新门**天生** `85` / `{36,46}` | P9③ 新门 |

### 2.1 四 i18n 计数测试逐处（未删断言；仅前推期望值 + 逐字登记订正注释）

| # | 文件:行 | 旧值 | 新值（现取） | 出处 |
|---|---|---|---|---|
| 1 | `i18n-batch-b4a.test.jsx:143` | `{top:114, flat:953}` | `{top:117, flat:988}` | `+ratingPanel(12)+timelinessPanel(11)+listingOrders(12)` ⇒ 顶层 +3 / 拍平 +35 |
| 2 | `i18n-batch-b4b.test.jsx:256` | `{top:114, flat:953}` | `{top:117, flat:988}` | 同上（`zh/en/hk/vn` 四语现取全 = `{top:117, flat:988}`） |
| 3 | `i18n-batch-b5.test.jsx:256` | `{top:114, flat:953}` | `{top:117, flat:988}` | 同上 |
| 4 | `i18n-violation-closeout.test.jsx:81` | 节点 `3812` | 节点 `3952` | 拍平 `953→988` ⇒ 节点 `988×4 = 3952`（`p4z-i18nviol-global.mjs` 现取「作用域命中节点数 = 3952」） |

- **现取（`test:unit` 实测打印）**：`[B4a] locale 键数读数 {"zh":{"top":117,"flat":988},…四语同}` · `[I18N-VIOL] 全量 locale 作用域命中节点数 = 3952（键 988 × 语 4）；命中 = 0`。**`top / flat / 节点 = 117 / 988 / 3952`**（**说明**：下单文本所注 `3532` 与实测不符，实测三读数以本节 117/988/3952 为准）。
- `NEW_KEY_TOTAL`：`ratingPanel`/`timelinessPanel`/`listingOrders` 为**新增顶层命名空间**（不入 `NEW_NS` 清单）⇒ `NEW_KEY_TOTAL = 175` 断言**逐字不变**。

### 2.2 附带冻结计数：`p6-btn-impl2` 文件清单 `9→10`

| 文件:行 | 冻结形态 | 旧 ⇒ 新 | 出处 |
|---|---|---|---|
| `frontend/src/test/unit/p6-btn-impl2.test.js:68-79` | JSX 文件清单 / 用法下限 | `9` 文件 ⇒ `10` 文件；`≥22` 处用法 | +新组件 `components/RatingTimelinessPanel.jsx`（挂 `.sf-btn`）；`it('… 10 个 JSX 文件、≥22 处用法 …')` 现取通过 |

## 3. 新门 `p8-s8-rating-timeliness-gate.ts`（③ 判据 A–H + 63/63）

- **性质**：**零 DB / 零网络 / 零 HTTP**（只 import 纯函数 + 读源码 / 迁移 / locale 文本）；自证 `db_connections:0` / `http_calls:0`；产物 `backend-ts/.p8s8-artifacts/p8s8-<RUN>/gate.json`。库面 leg **单列 `pending_apply[]`、不入 `checks`**（不得伪装绿）。
- **现取读数**：`total=63 passed=63 failed=0`（**EXIT 0**）；`pending_apply = 9`。

### 3.1 两迁移结构面（逐列 / 约束 / 索引 / 触发器 · 源码面）

**`0030_listing_order_status_extend.sql`（约束 + 函数级；零新增表/列/索引/触发器）**

| 对象 | 形态 | 出处 |
|---|---|---|
| `listing_order_status_enum` | `DROP CONSTRAINT IF EXISTS` + `ADD CONSTRAINT … CHECK (status IN ('created','paid','shipped','received','refunded','cancelled'))` ⇒ **恰 6 值**（前 4 值逐字承 `0015:176` 的 `created/paid/refunded/cancelled` ∪ `{shipped,received}`） | `:64-66` |
| `listing_order_status_transition_ok(p_from,p_to)` | `CREATE OR REPLACE FUNCTION … LANGUAGE sql IMMUTABLE`；CASE 出边：`created→{paid,cancelled}` · `paid→{shipped,refunded}` · `shipped→{received,refunded}` · `ELSE false`（`received/refunded/cancelled` 终态无出边） | `:104-111` |
| `listing_post_event(payload)` | `CREATE OR REPLACE FUNCTION`；退款闸放宽 `status <> 'paid'` ⇒ `IF v_order.status NOT IN ('paid','shipped') THEN`（`received` 仍不可退），拒绝 `reason='order_not_refundable'` 保留 | `:161`（闸位见 `C7` 现取） |

**`0031_rating_and_order_event.sql`**

| 表 | 列（逐字列序） | 约束 | 索引 | 触发器 |
|---|---|---|---|---|
| `public.rating` | **11 列**：`rating_id`(bigint identity) · `rater_uid`(bigint NN) · `ratee_uid`(bigint NN) · `target_type`(text NN) · `target_id`(bigint NN) · `direction`(text NN) · `stars`(numeric(5,4) NN) · `idempotency_key`(text NN) · `request_fingerprint`(text NN) · `memo`(text NN D '') · `time_created`(timestamptz NN D now()) | PK×1 `rating_pk` · FK×2 `rating_rater_fk`/`rating_ratee_fk` · CHECK×2 `rating_stars_rng`(0≤stars≤5) + `rating_direction_target_ck`(方向×标的) · UNIQUE×2 `rating_once_uniq(rater_uid,target_type,target_id)` + `rating_idem_uniq(idempotency_key)` | `idx_rating_ratee_time` · `idx_rating_target` | `trg_rating_append_only` |
| `public.listing_order_event` | **13 列**：`event_id`(identity) · `order_id`(bigint NN) · `event_type`(text NN) · `from_status`(text) · `to_status`(text) · `actor_uid`(bigint NN) · `txid`(bigint) · `idempotency_key`(text NN) · `request_fingerprint`(text NN) · `ref_type`(text) · `ref_id`(bigint) · `memo`(text) · `time_created`(timestamptz NN D now()) | PK×1 `listing_order_event_pk` · FK×2 `…_order_fk`/`…_actor_fk` · CHECK×1 `listing_order_event_type_enum`（**恰 6 值** = 状态集） · UNIQUE×1 `listing_order_event_idem_uniq` | `idx_listing_order_event_order_time` | `trg_listing_order_event_append_only` |

- **索引合计 = 3 枚**；**append-only 触发器 = 2 枚**（`BEFORE UPDATE OR DELETE` 无条件 `RAISE EXCEPTION` ⇒ 原生 `P0001`）。
- **`rating` 无预聚合/桶列**（`F3` 现取）⇒ 聚合必为**原始行派生**；原始评分行 append-only 留存。

### 3.2 判据组 A–H（现取 · 63/63 · 均含自证负对照）

- **A 注册点**：`85` 逐 verb（`get 36/post 46/put 0/patch 1/delete 2`）+ 5 新口逐条恰 1 处；负对照缩进注入 ⇒ `85→86`。
- **B 5 新口形态**：全闸 `requireActor(req,res)`（零 `requireAdmin(`）；取数 `getRatingSummary(` / `getTimeliness(` / `submitRating(` / `transitionListingOrder(`；幂等键服务端派生（`biz:rating:` / `biz:listing:ship:` / `biz:listing:receive:`）；请求体 `targetType/targetId/direction/stars`；异常 `sendInfraMapped` 五标签。
- **C `0030`**：CHECK **恰 6 值**（`C1`）；允许逐条 `created→{paid,cancelled}` · `paid→{shipped,refunded}` · `shipped→{received,refunded}`（`C2`）；禁止逐条（越级 / 终态无出边 / 自环 / 自造状态）（`C3`）；`shipped→refunded` 允许（`C4`）；`received→refunded` 禁（`C5`）；`received` 无出边（`C6`）；退款闸放宽（`C7`）；旧形 `status <> 'paid'` 代码位不再出现（`C8`）。
- **D `0031`**：`rating` **11 列** / PK×1 FK×2 CHECK×2 UNIQUE×2 / 2 索引（`D1`-`D2`、`D5`）；`listing_order_event` **13 列** / UNIQUE×1 / `event_type` **6 值**（`D3`-`D4`）；2 append-only 触发器（`D6`）。
- **E 四要素必锚**：`E1 rater_uid` · `E2 ratee_uid` · `E3 (target_type,target_id)`（均 `NOT NULL`）· `E4 direction` **4 值闭集**（`poster_to_worker`/`worker_to_poster`/`vendor_to_customer`/`customer_to_vendor`，按 `target_type` 每侧恰 2）；聚合轴 = `r.ratee_uid = <uid>`。
- **F 四周期 + 查询期聚合**：`VALUES (30),(90),(360),(1000)` 恰 4 档；`r.time_created >= now() - make_interval(days => p.days)`（**查询期聚合**）；禁预聚合分桶（无桶列）；原始行保留。
- **G 默认值 + 兜底 + 四语**：`RATING_POLICY_DEFAULTS = {storageDecimals:4, displayDecimals:0, defaultStars:3.0}`；**★「无行 ⇒ 兜底值」独立负对照**——无行 ⇒ `source=constant` 且 `defaultStars=3.0`（`G2`）、有行 `defaultStars=4` ⇒ `source=config` 取真值（`G3`）、越界 `99` 钳 `5`（`G4`）；评分聚合守卫 `n > 0 ? round4(s / n) : policy.defaultStars`（`G5`）；比率 `d > 0 ? round4(n / d) : 1`（分母 0 ⇒ 100%）（`G6`）；时长无数据 ⇒ `null`（不填 0）（`G7`）；T1/T2 载体（`G8`）；四语键集相等 + `noData`（`G9`）；`statusLabel` 6 状态 + `unknown`（`G10`）；`en/vn` 零 CJK（`G11`）；六类口径泄漏 = 0（`G12`）。
- **H 零新增码 + `pending_apply` 如实登记**：`LEDGER_ERROR_CODES.length === 33`（不动）；5 口借既有码（`LEDGER_CURRENCY_INVALID_TRANSITION` / `LEDGER_AMOUNT_INVALID` / `LEDGER_REF_NOT_FOUND` + `AUTH_FORBIDDEN` 403）；稳定 `reason`（`ORDER_NOT_SHIPPABLE` / `ORDER_NOT_RECEIVABLE` / `RATING_ALREADY_DONE` / `RATING_STARS_OUT_OF_RANGE`）；`pending_apply[]` **9 条**（不入 `checks`）。

## 4. 判负三处（④ 仓外副本 + 变异 + 逐字红点 + 复原 + 主仓 `cmp`）

- **副本**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s3-copy`（镜像主仓；`backend-ts/node_modules` 可用）；**基线副本 `p8-s8` = 63/63（`exit 0`）**。
- **三变异（逐字红点）**：

| 变异 | 目标（副本）| 改动 | 副本门 | **红点（failed id）** | 复原 |
|---|---|---|---|---|---|
| **M1** `transition_ok` 放行 `received→refunded` | `migrations/0030_…extend.sql` | `WHEN 'shipped' THEN …` 后插 `WHEN 'received' THEN p_to IN ('refunded')` | `exit 1`（59/63） | **`C5`**（`received→refunded` 现 `allowed:true`）· **`C6`**（`received_out:["refunded"]`）· **`C3`**（`violations:[["received","refunded"]]`）· 连 **C2 的负对照自检**同步转红（`judge_fired:false`，自证负对照生效） | `exit 0`（63/63） |
| **M2** 去 `n > 0 ? … : defaultStars` 外层守卫 | `src/database.ts:4590` | `periods[days][role] = n > 0 ? round4(s / n) : policy.defaultStars;` ⇒ `… = round4(s / n);` | `exit 1`（62/63） | **`G5`**（`guard:false`） | `exit 0`（63/63） |
| **M3** 状态集回 4 值 | `migrations/0030_…extend.sql:66` | `CHECK (status IN (6 值))` ⇒ `CHECK (status IN ('created','paid','refunded','cancelled'))` | `exit 1`（62/63） | **`C1`**（`{"n":4,"set":["cancelled","created","paid","refunded"]}`） | `exit 0`（63/63） |

- **复原回绿**：三变异后各从主仓回拷 ⇒ 副本 `p8-s8` 复 = **63/63**（`exit 0`）。
- **主仓零写入（`cmp`）**：复原后主仓 vs 副本 —— `backend-ts/src/database.ts` · `backend-ts/migrations/0030_listing_order_status_extend.sql` · `backend-ts/scripts/p8-s7-batt-checkin-gate.ts` · `backend-ts/scripts/p8-s8-rating-timeliness-gate.ts` · `backend-ts/src/index.ts` **全部逐字节 SAME** ⇒ 变异只发生在副本。

## 5. 前端 + 四语（⑦ 命名空间 / 组件 / 接线 / 发货·收货按钮 / 2 新状态 / 泄漏 0）

- **四语各新增顶层**：`ratingPanel`（**12 键**）· `timelinessPanel`（**11 键**）· `listingOrders`（**12 键**，含 `statusLabel` **7 值**：`created/paid/shipped/received/refunded/cancelled/unknown` —— 含 2 新状态 `shipped`/`received`）；四语键集**逐语相等**（`G9`/`G10` 现取通过）。
- **计数现取**：`top 117 / flat 988 / 节点 3952`（四语同）。
- **组件 / 接线**：新组件 `frontend/src/components/RatingTimelinessPanel.jsx`；接线层 `frontend/src/rating-timeliness.js`（5 口）；`pages/ProfilePage.jsx` 接线评分/时效面板；`pages/listings/listing-api.js`（`:92` `shipListingOrder` / `:96` `receiveListingOrder`）；`pages/listings/ListingsPage.jsx` 发货/收货按钮面板 + 状态本地化。
- **泄漏读数**：`locale 裸命中 0 + 源面裸命中 0`（`I18N-VIOL` 总判 **PASS**）；新增键**值面**六类工程口径泄漏 = **0**（`G12`）；`en`/`vn` 新增键值**零 CJK**（`G11`）。`I18N-VIOL` 子面③报告硬编码中文文案字面量 35 个、其中**命中工程口径 1 个**（`pages/jobs/JobDetailPage.jsx:238`，**非本单新增、非 locale 值**；脚本已**单列登记**并以总判 PASS）——**如实登记，不藏**。

## 6. `R-9-35` 现取：T1/T2 载体（⑥ 逐表逐列 · 零迁移）

- **载体 = 现取 `public.job_submission` 既有两时间列（`0014_job_flow.sql` 已具，`R-9-35` 零迁移）**：

| 列 | 出处（`0014`） | 形态 | 用途 |
|---|---|---|---|
| `job_submission.time_created` | `:125` | `timestamptz NOT NULL DEFAULT now()` | **T1/T2 起点** |
| `job_submission.reviewed_at` | `:122` | `timestamptz`（可空 · 审核落定时写一次，`review_status <> 'pending'` 后冻结 · `:210/:234`） | **T1/T2 终点** |

- **查询（`database.ts getTimeliness` 现取）**：`t1`（雇主视角）= `FROM public.job_submission AS s JOIN public.job AS j ON j.job_id = s.job_id WHERE j.employer_uid = <uid> AND j.status = 'settled' AND s.review_status = 'approved' AND s.reviewed_at IS NOT NULL`，`avg(EXTRACT(EPOCH FROM (s.reviewed_at - s.time_created))/86400.0) AS d`；`t2`（worker 视角）同上，闸 `s.worker_uid = <uid>`。
- **结论**：T1/T2 **接上 `getTimeliness`**（`posterAvgDays` ← `t1` · `workerAvgDays` ← `t2`）；**无行 / 无 approved ⇒ `avg` 得 `NULL` ⇒ 服务端 `numOf` ⇒ `null` ⇒ 前端「暂无数据」（不填 0）**；**零新迁移**（两列均既有）。T3/T4（发货/收货时长）走 `listing_order_event`（`0031`，**未 apply** ⇒ `pending_apply`，§8）。

## 7. 硬门全量复跑（⑧ 退出码管道外捕获）

> 退出码一律 `cmd; rc=$?` **管道外捕获**。

| 门 | 命令（cwd） | 读数 | 退出码 |
|---|---|---|---|
| `tsc` | `backend-ts && npx tsc --noEmit` | 0 行 | **0** |
| 离线套件 | `backend-ts && npx ts-node --transpile-only scripts/p4z-tr1a-01-offline-tests.ts` | `total=126 passed=126 failed=0` | **0** |
| 前端 `build` | `frontend && npm run build` | `index-7hiOtQ13.js` 396.90 kB · `✓ built` | **0** |
| `test:unit` | `frontend && npm run test:unit` | `31 files / 276 passed`（**≥276**） | **0** |
| `p8-s1` | `p8-s1-app-config-gate.ts` | 24/24 | **0** |
| `p8-s2` | `p8-s2-fee-rebate-gate.ts` | 41/41 | **0** |
| `p8-s3` | `p8-s3-deposit-gate.ts` | 45/45 | **0** |
| `p8-s3b` | `p8-s3b-address-gate.ts` | 38/38 | **0** |
| `p8-s4` | `p8-s4-currency-review-gate.ts` | 79/79 | **0** |
| `p8-s5` | `p8-s5-compliance-gate.ts` | 117/117 | **0** |
| `p8-s6` | `p8-s6-site-text-gate.ts` | 64/64 | **0** |
| **`p8-s7`（带受控实例）** | `P8S7_BASE=http://127.0.0.1:5797 p8-s7-batt-checkin-gate.ts` | **56/56**（`pending_apply=0` · `db=7 http=9`） | **0** |
| **`p8-s7`（离线）** | `p8-s7-batt-checkin-gate.ts`（实例已 `kill -TERM`） | **53/56**（红 3 = **HTTP 类** `G8/G9/G10`；`db=7 http=1`） | **1**（预期） |
| `p8-s8` | `p8-s8-rating-timeliness-gate.ts` | **63/63**（`pending_apply=9` · `db=0 http=0`） | **0** |

- **注册点 = 85**；`p8-s1..s6` 现值**均未掉**（= 上表）。`p8-s1..s6` 合计 = `24+41+45+38+79+117+64` = **408/408**；`p8-s1..s8`（带实例）= `408+56+63` = **527/527**，全退出码 **0**。
- **★ `p8-s7` 双读数（沿 `R-9-26`）**：**带实例 = 56/56**（受控实例 `127.0.0.1:5797`）· **离线 = 53/56**（仅 3 HTTP 类红）。**续跑单遗漏的阻断已由收口修复**：① 注册点常量 `80→85` / `{34,43}→{36,46}`（否则 `A1/A2/A3/A5` 红）；② `handlerBlock` 边界先收本路由顶层 `});`（否则 `F2` 因 `BLOCK_MAKEUP` 误并 P9③ 顶层 helper `sendOrderTransition` 的 `AUTH_FORBIDDEN`/`LEDGER_REF_NOT_FOUND` 而**假红**）。修前实测 `p8-s7` 离线 = **48/56**（红 `A1/A2/A3/A5/F2/G8/G9/G10`），修后 = **53/56**。
- **收尾（精确 PID）**：受控实例 `node` **PID `91750`**（`:5797`）经 **`kill -TERM 91750`** 终止；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**（`rc=1`，无监听）。**未启停 5787/5788**、未 `pkill -f`/`killall`。
- **原始输出**：`backend-ts/.p9s3-closeout/{tsc.out, offline.out, frontend-build.out, frontend-testunit.out, p8-s1-…-s8-…gate.out}`（**无 `.log` 后缀**）。

## 8. `PENDING_APPLY` 清单与未测项

### 8.1 `PENDING_APPLY` 清单（新门 `pending_apply[]` 现取 · **9 条** · 单列、不入 `checks`）

| # | 库面 leg | 原因 |
|---|---|---|
| 1 | `0030` · 活体 `listing_order_status_enum` = 6 值（DROP+ADD） | 本单**不 apply** 迁移 ⇒ 活体约束值集不可验；源码面 6 值 + 正/负自检已验（`C1`-`C3`） |
| 2 | `0030` · `listing_order_status_transition_ok` 活体行为（允许/禁止逐条） | `CREATE OR REPLACE FUNCTION` 未执行 ⇒ 活体白名单不可验；源码面函数体已验（`C2`-`C6`） |
| 3 | `0030` · 退款闸放宽活体（`status NOT IN ('paid','shipped')`） | `listing_post_event` 未 `CREATE OR REPLACE` ⇒ 活体退款闸不可验 |
| 4 | `0031` · `rating` + `listing_order_event` 两表 + 约束 + 索引落库 | 结构未落库；源码面内容契约 / apply-time 自检块已验（`D1`-`D6`） |
| 5 | `0031` · 两 append-only 触发器真行为（UPDATE/DELETE ⇒ `P0001`） | 触发器未落库 ⇒ 活体拒绝不可验 |
| 6 | `getRatingSummary` 活体：无行 uid ⇒ `defaultStars=3.0` · 有行 ⇒ 真均值 | 需 apply `0031` + 真库 ⇒ 本门零连接；源码面兜底守卫 + 纯函数负对照已验（`G2`-`G5`） |
| 7 | `getTimeliness` 活体：T1/T2 载体（`job_submission`）+ T3/T4 事件表 + 无行 ⇒ 暂无数据 | 需真库（`listing_order_event` 未落库）⇒ 本门零连接 |
| 8 | `transitionListingOrder` 活体状态机（ship: `paid→shipped` / receive: `shipped→received` · 越级 409 · 非归属 403） | 需 apply `0030`/`0031` + 真库；HTTP 面需受控实例 |
| 9 | 5 新口真 HTTP 200 / 401（受控实例探针） | 本门**零网络**（`http_calls:0`）；真 HTTP 读数需受控实例另册 |

### 8.2 未测项（逐项原因 · **禁填 0/空**）

| # | 未测项 | 原因 |
|---|---|---|
| 1 | `0030`/`0031` apply 后的 **DB 级效果**（6 值约束活体 / `transition_ok` 活体白名单 / 退款闸活体 / 两表·约束·索引·触发器落库） | **硬边界**：本单**不 apply 任何迁移** ⇒ 无法连库取证（`PENDING_APPLY`，见 §8.1）。 |
| 2 | 5 新口**真 HTTP** 状态码与响应体（无 token 401 / 有 token 200 / 越级 409 / 非归属 403） | 属 P9③ 新口；本单受控实例仅用于 `p8-s7` 回归（未打 5 新口真 HTTP）；且需 apply `0030`/`0031` + 真库 ⇒ 未跑。 |
| 3 | `getRatingSummary` / `getTimeliness` 的**真库端到端**（无行⇒3.0 / 有行⇒真均值 / T1/T2 真耗时 / 四周期分档真读数） | 同上：需 apply + 真库；属库面 leg，`PENDING_APPLY`。 |
| 4 | `transitionListingOrder` 发货/收货**端到端真库链路**（状态回写 + 事件行同生同灭 · 幂等重放） | 同上：需 apply `0030`/`0031` + 真库；属库面 leg，`PENDING_APPLY`。 |
| 5 | 前端评分/时效面板 + 发货/收货按钮的**浏览器渲染**与 i18n 实渲染（四语切换目视） | 需真实浏览器 + 受控实例；本单只读源码 / 单测（`test:unit 276` 含 i18n 计数与泄漏面，但非该组件实渲染断言）。 |
| 6 | 两 append-only 触发器的**运行期拒绝**（`UPDATE`/`DELETE` ⇒ 原生 `P0001`） | 触发器未落库 ⇒ 运行期行为未测（`PENDING_APPLY`）。 |
| 7 | 四周期（30/90/360/1000）**查询期聚合的运行期数值** | 依赖真库评分行与时钟；本单仅验源码判据（`F1`-`F4`）⇒ 运行期数值未测。 |

## 9. 结论

- **本单（P9③ 收口）4 件全交付、逐条给读数**：
  - **① 三变异判负（仓外副本）**：基线 `63/63` ⇒ **M1 ⇒ `C5`+`C6`(+`C3`+C2 负对照自检)** · **M2 ⇒ `G5`** · **M3 ⇒ `C1`**（逐字红点见 §4）⇒ 复原回绿 `63/63`；主仓 `cmp` **逐字节 SAME**。
  - **② 硬门全量复跑**：`tsc 0` · 前端 `build 0` · `test:unit 276` · 离线 `126/126` · `p8-s1..s6` = `408/408` · `p8-s7` 带实例 **56/56** / 离线 **53/56** · `p8-s8` **63/63**（`pending_apply=9`）· 注册点 **85**。
  - **③ 报告回填**：本文件（含两迁移结构面 + 判据 A–H + 三判负红点 + 冻结计数逐处表 + `R-9-35` 现取 + `PENDING_APPLY` 9 + 未测项逐项原因）。
  - **④ 收尾**：首尾 `git status` 归因（本节）· 未跟踪产物清单（不提交）· 报告自证。
- **★ 续跑单遗漏阻断已修（本单为 `scripts/p8-*.ts` 写者）**：`p8-s7` 注册点常量 `80→85`·`{34,43}→{36,46}`；`handlerBlock` 边界改「先收本路由顶层 `});`」以修 `F2` 假红（§7）。**未改 `src/**` 业务逻辑**（`src/index.ts`/`src/database.ts` 相对开工无新增差异）。
- **硬口径遵守**：**未 apply 任何迁移** · **未改已 apply 迁移** · **未改 `src/**` 逻辑**（除修复阻断时的 `scripts/**` 边界） · 错误码闭集 **33 不动** · **未碰** `docs/*.spec.md` / `master-plan` / `docs/qa/**` · **未 `git add/commit/push`** · 未 `npm install` · 未碰 / 未打印 `.env*` · 未 `pkill -f` / `killall` · 未启停 5787/5788 · 库面 leg 一律 `PENDING_APPLY`（`p8-s7` 库面段 = 只读 + 事务内 `ROLLBACK`；本单**零库面写**）· 受控实例仅 `5797` 且收尾精确 `kill -TERM`。
- **库面 leg = `PENDING_APPLY`（如实登记、不得伪装绿）**：`0030`/`0031` DB 级效果待 apply 后另册取证（§8）。
### 9.1 首尾 `git status --porcelain` 逐条归因

- **开工（首）** = **21 条已修改**（**无** `p8-s7`）+ 未跟踪产物；**收尾（尾）** = **22 条已修改**（**+** `scripts/p8-s7-batt-checkin-gate.ts`）+ 未跟踪（**+** 本单报告 + 本单产物目录）。

| 归属 | 条目 | 说明 |
|---|---|---|
| **本单（P9③ 收口）** | `M backend-ts/scripts/p8-s7-batt-checkin-gate.ts` | 注册点常量前推 `80→85` + `handlerBlock` 边界修阻断（§7） |
| **本单（P9③ 收口）** | `?? docs/audit/p9-s3-rating-timeliness.md` | 本报告（**未跟踪新文件 · 不提交**） |
| **本单（P9③ 收口）** | `?? backend-ts/.p9s3-closeout/` | 本单原始输出（**不提交**） |
| **P9③ 实现交付面（已改）** | `M` `p8-s2..s6-*-gate.ts`(6) · `src/database.ts` · `src/index.ts` · 四 `locales/{zh,en,hk,vn}.json` · `ProfilePage.jsx` · `ListingsPage.jsx` · `listing-api.js` · 四 `i18n-*.test.jsx` · `p6-btn-impl2.test.js` | 续跑单已落；本单**未改**（除 `p8-s7`） |
| **P9③ 实现交付面（新增）** | `??` `migrations/0030_…extend.sql` · `migrations/0031_rating_and_order_event.sql` · `scripts/p8-s8-rating-timeliness-gate.ts` · `scripts/p8-s5-00-recon{,2,3}.ts` · `frontend/src/rating-timeliness.js` · `frontend/src/components/RatingTimelinessPanel.jsx` | P9③ 新增（**未跟踪 · 不提交**） |
| **历史产物（非本单）** | `M backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json` · `?? .p4-artifacts/p6tr1a-*` · `?? .p8s1..s8-artifacts/*`（旧 RUN） · `?? .p9s1qa-artifacts/` · `?? .p9s2-apply/` · `?? .p9s2c-apply/` · `?? .p9s2c-closeout/` · `?? .p9s2qa-*` · `?? .p9s3-r9-24/` | 历次单产物（**不提交**） |

### 9.2 未跟踪产物清单（**不提交**）

- **本单新增**：`backend-ts/.p9s3-closeout/`（原始输出 + `git-status-final.txt`）· `docs/audit/p9-s3-rating-timeliness.md`（本报告）。
- **P9③ 交付**：`backend-ts/migrations/0030…` · `0031…` · `backend-ts/scripts/p8-s8-rating-timeliness-gate.ts` · `backend-ts/scripts/p8-s5-00-recon{,2,3}.ts` · `frontend/src/rating-timeliness.js` · `frontend/src/components/RatingTimelinessPanel.jsx`。
- **历史单产物目录**（`.p4-artifacts/` / `.p8s1..s8-artifacts/` / `.p9s1qa-artifacts/` / `.p9s2*` / `.p9s3-r9-24/`）——沿既有惯例**留仓不提交**。

### 9.3 报告自证

- 行数 / 字节 / 「双下划线占位」命中计数 = **0**；「骨架占位括号行」命中计数 = **0**（见收尾原始输出）。

---

## 10. P9③ 库面收口【极小收尾单】追加（改名后复跑 · 四判负实测 · 收尾）

> **本节点追加于既有 §0–§9 之后；既有各节逐字未改写。** 上方 §3.2 / §8 的 `p8-s8` 读数（`63/63` · `pending_apply=9`）为**改名前 + `0030`/`0031` apply 前**历史读数；两迁移**已 apply**、且门内活体链 id 由 `C*` **改名 `V*`** 后，**以本节点读数为准**（§10.1 复跑）。
> 依据：`docs/seafood.master-plan.md` §5.245 / v0.245（★ 诚实标注「改名后未再复跑 ⇒ 必须复跑」）· `R-9-26`（含真 HTTP 腿的门 ⇒ 双读数）。

### 10.1 门 `p8-s8` 改名后复跑（**双读数** · 沿 `R-9-26`）

| 读数 | 命令（cwd = `backend-ts`） | `total/passed/failed` | `pending_apply` | `db/http` | 退出码 |
|---|---|---|---|---|---|
| **带受控实例**（`127.0.0.1:5797`） | `P8S8_BASE=http://127.0.0.1:5797 npx ts-node --transpile-only scripts/p8-s8-rating-timeliness-gate.ts` | **92 / 92 / 0** | **0** | **db=13 · http=11** | **0** |
| **离线**（无实例在听） | `npx ts-node --transpile-only scripts/p8-s8-rating-timeliness-gate.ts` | **92 / 89 / 3** | **0** | db=13 · http=1 | 1（预期） |

- **★ 改名后复跑结论**：**全绿无任何红**（`92/92` · `failed=0`）⇒ 上方 §3 的 `63/63` 与红点编号**已顺移对应**，语义一致、无真缺陷。
- **离线 3 红 = `H5`/`H6`/`H7`（`httpLive` 组）全为 HTTP 类**（`fetch failed` · 无实例在听）⇒ 属**环境差异**（`R-9-26`）；**未改判据放宽、未标 `SKIPPED` 假绿**。
- **计数前推（改名后）**：`checks` 组分布 = `dbBehavior 20 · routeShape 8 · migration0030 8 · migration0031 6 · dbStructure 6 · registration 5 · fourAnchors 4 · periodAggregation 4 · defaults 4 · defaultsNoRow 4 · locales 4 · closedSets 3 · httpLive 3` + 各 `SelfTest`（`routeShape 2 · locales 2 · registration 1 · migration0030 1 · migration0031 1 · fourAnchors 1 · periodAggregation 1 · defaultsNoRow 1 · closedSets 1 · pending 1`）。**门内活体链 id 由 `C1..C18` 顺移为 `V0..V19`**；`0030`/`0031` **源码面**判据仍用 `C*`/`D*` 前缀（未改名）。
- **产物**：`backend-ts/.p8s8-artifacts/p8s8-20261003T041417Z/gate.json`（带实例）· `…/gate.json`（离线 run）；本单存副本 `backend-ts/.p9s3-final-closeout/{p8-s8-instance-gate.json,p8-s8-offline-gate.json}`。

### 10.2 四段真链路逐段读数（活体 · 事务内 + 末尾 `ROLLBACK` · 改 `V*` 后编号）

> 全部出自带实例 `gate.json` 的 `readings.live` / `checks`（`V*` 与 `L*`）。**主库零写入**（事务内 `ROLLBACK`，见 `V19`）。

**① 评分提交链（`V1`–`V4`）**

| id | 判据 | **实测 actual** |
|---|---|---|
| `V1` | 四要素**服务端取数** ⇒ `inserted` | `{outcome:"inserted", rateeUid:981009, ratingId:65, stars:4}`（`rater_uid`=token 981001；`ratee_uid` 由 `job.worker_uid` 推导 = 981009） |
| `V2` | 幂等重放 ⇒ `replay` | `{outcome:"replay", rateeUid:981009, ratingId:null, stars:4}`（同 `idempotency_key` 二次 · `ON CONFLICT DO NOTHING`） |
| `V3` | 同侧二次 ⇒ `already_rated` | `{outcome:"already_rated", rateeUid:981009, ratingId:65, stars:null}`（`UNIQUE(rater_uid,target_type,target_id)` 两侧各一次） |
| `V4` | `stars=6` 超界 ⇒ 拒 | `{err:"23514\|…violates check constraint \"rating_stars_rng\"…"}`（值域 CHECK 兜底） |

**② 汇总四周期与兜底（`V5`–`V8`）**

| id | 判据 | **实测 actual** |
|---|---|---|
| `V5` | 四周期分别读数 | `{30:5, 90:4, 360:3, 1000:3.25}`（四原始行 `-5d/-60d/-200d/-400d`） |
| `V6` | **有行 ⇒ 真均值** | `{poster:3, worker:4, vendor:3, customer:3, counts:{poster:0, worker:1, vendor:0, customer:0}}`（uid 981009 仅 1 条 4 星 ⇒ `worker=4 · counts.worker=1`） |
| `V7` | **无行 ⇒ 兜底值**（独立负对照） | `{source:"constant", defaultStars:3, p30:{poster:3,worker:3,vendor:3,customer:3,counts:{…全 0}}}` ⇒ **`source=constant` · `defaultStars=3.0` · 四角色皆 3.0（不因无行变 0/NaN）** |
| `V8` | **有行 ⇒ `source=config`**（事务内 **INSERT** `app_config.rating_policy`〔**禁 UPDATE**〕） | `{source:"config", defaultStars:4, p30:{poster:4,worker:4,vendor:4,customer:4}}` ⇒ `defaultStars=4` · 无行角色回落 4.0（取真值非兜底） |

**③ 时效 T1..T4（`V9`–`V11`）**

| id | 判据 | **实测 actual** |
|---|---|---|
| `V9` | T1/T2（载体 = `job_submission.time_created → reviewed_at` · `review_status='approved' AND j.status='settled'`） | `{t1_poster:3, t2_worker:3}`（雇主 981011 / 工人 981012） |
| `V10` | T3/T4（载体 = `listing_order_event.time_created`） | `{t3_vendor_ship:3, t4_customer_recv:4}`（卖家 981014 `paid→shipped` / 买家 981015 `paid→received`） |
| `V11` | **无数据 ⇒ `null`（不填 0）** | `{poster:null, worker:null, ship:null, recv:null}`（无 `job_submission` / 无事件行 uid） |

**④ 发货 / 收货 transition 与事件行同生同灭（`V12`–`V18`）· 退款闸（`V16`/`V17` · `L4`）**

| id | 判据 | **实测 actual** |
|---|---|---|
| `V12` | 发货 `paid→shipped` 状态回写 **且事件行同生** | `{outcome:"shipped", from:"paid", to:"shipped", status:"shipped", events:1}`（order 900202 事件行 = **1**） |
| `V13` | 收货 `shipped→received` 状态回写 **且事件行再现** | `{outcome:"received", from:"shipped", to:"received", status:"received", events:2}`（order 900202 事件行 = **2**） |
| `V14` | 非法 `created→shipped` ⇒ 拒 + **零残留** | `{outcome:"state_conflict", events:0, status:"created"}` |
| `V15` | 非归属 ⇒ `not_party` | `{outcome:"not_party"}`（买家对卖家订单发 ship） |
| `V16` | 退款闸**放宽** `shipped` **过状态闸** | `LD011\|LEDGER_CURRENCY_INVALID_TRANSITION\|{"field":"listing_order.pay_txid","reason":"order_pay_missing","status":"shipped","order_id":"900205"}` |
| `V17` | 退款闸**仍禁**（两读数对照） | `received`（900204）⇒ `{"field":"listing_order.status","reason":"order_not_refundable","status":"received"}` · `created`（900203）⇒ `…"reason":"order_not_refundable","status":"created"` |
| `V18` | 非法转移 / 退款拒绝 **零残留** | `{ev_900203:0, ev_900204:0, ev_900205:0}` |
| `L4` | 活体两读数对照（`R-9-29`） | 活体 `shipped→refunded` = **true**（可退）· `received→refunded` = **false**（仍禁） |

**结构面（只读 `L1`–`L6`）+ append-only（`V0`）+ `ROLLBACK` 零残留（`V19`）**

| id | 读数 |
|---|---|
| `L1` | 活体 `listing_order_status_enum` = **恰 6 值** `[cancelled, created, paid, received, refunded, shipped]` |
| `L2` | 活体 `transition_ok` **允许**逐条：`created→{paid,cancelled}` · `paid→{shipped,refunded}` · `shipped→{received,refunded}` 全 **true** |
| `L3` | 活体 **禁止**逐条：`created→{shipped,received}` · `paid→received` · `received→{refunded,paid}` · `refunded→paid` · `made_up→paid` 全 **false** |
| `L5` | 活体 `rating`：**11 列** / PK×1 FK×2 CHECK×2 UNIQ×2 / 2 具名索引（`idx_rating_ratee_time`·`idx_rating_target`）/ 1 append-only 触发器 |
| `L6` | 活体 `listing_order_event`：**13 列** / PK×1 FK×2 CHECK×1 UNIQ×1 / `event_type` **6 值** / 1 具名索引 / 1 append-only 触发器 |
| `V0` | 两 append-only 触发器**真行为**：UPDATE `rating` / DELETE `listing_order_event` ⇒ 原生 **`P0001`** |
| `V19` | 末尾 `ROLLBACK` ⇒ **主库零残留**：`baseline{rating:0,event:0,order:18}` == `after_rollback{rating:0,event:0,order:18}` |

**受控实例真 HTTP（`H5`–`H7` · 带实例）**：无 token 5 口逐口 **401** · 两读口带 token **200** · 三写口非法入参 **400/400/404/404**（零写落库）。

### 10.3 库面判负 4 处（**改名后逐字红点** · 仓外副本 + 复原回绿 + 主仓 `cmp`）

- **副本** = `/Users/kevin/.hermes/profiles/zang/cache/scratch/p9s3-copy`（rsync 镜像当前工作树 `backend-ts/{src,migrations,scripts}` + `frontend/src`；沿用副本 `node_modules` + `.env.local`）。**副本基线 `p8-s8`（带实例）= 92/92（`exit 0`）**。
- **四变异（逐字红点 · 改名后编号）**：

| 变异 | 目标（副本） | 改动 | 副本门 | **红点（failed id · 改名后）** | 复原 |
|---|---|---|---|---|---|
| **M1** 去无行守卫（评分聚合） | `backend-ts/src/database.ts:4590` | `periods[days][role] = n > 0 ? round4(s / n) : policy.defaultStars;` ⇒ `periods[days][role] = round4(s / n);` | `92→89/92`（`exit 1`） | **`V7`**（`p30` 四角色 = `null`）· **`V8`**（config 路径四角色 = `null`）· **`G5`**（`guard:false`） | `92/92` |
| **M2** 时效 `null→0`（`numOf` 定义清零） | `backend-ts/src/database.ts:4747` | `(v===null||v===undefined?null:Number(v))` ⇒ `Number(v ?? 0)` | `91/92`（`exit 1`） | **`V11`**（`{poster:0,worker:0,ship:0,recv:0}`） | `92/92` |
| **M3** 状态集回 4 值 | `backend-ts/migrations/0030_listing_order_status_extend.sql:66` | `CHECK (status IN (6 值))` ⇒ `CHECK (status IN ('created','paid','refunded','cancelled'))` | `91/92`（`exit 1`） | **`C1`**（`{n:4, set:["cancelled","created","paid","refunded"]}`） | `92/92` |
| **M4** 放行 `received→refunded` | `backend-ts/migrations/0030_…extend.sql` `transition_ok` | `ELSE false` 前插 `WHEN 'received' THEN p_to IN ('refunded')` | `88/92`（`exit 1`） | **`C5`**（`allowed:true`）· **`C6`**（`received_out:["refunded"]`）· **`C3`**（`violations:[["received","refunded"]]`）· 连 **`C2` 的自证负对照**同步转红（`migration0030SelfTest` 组 · `judge_fired:false` ⇒ 自证负对照生效） | `92/92` |

- **复原回绿**：四变异后各从主仓回拷 ⇒ 副本 `p8-s8`（带实例）复 = **92/92**（`exit 0`）。
- **主仓零写入（`cmp`）**：复原后主仓 vs 副本 —— `backend-ts/src/database.ts` · `backend-ts/src/index.ts` · `backend-ts/migrations/0030_…extend.sql` · `backend-ts/migrations/0031_rating_and_order_event.sql` · `backend-ts/scripts/p8-s8-rating-timeliness-gate.ts` **全部逐字节 SAME** ⇒ 变异只发生在副本。
- **★ 一处如实登记（不藏）**：M3 **首跑**曾连带 `H6` 报 `GET /api/rating/summary: 503`（**瞬时环境抖动**）；**同变异复跑** ⇒ 红点收敛为**仅 `C1`**（`H6=200`）⇒ 判为**环境瞬时态**，**非变异效应**。

### 10.4 `pending_apply[]` 归零 + `PENDING_RESOLVED` 9 条

- **`pendingApply[]` = 空（0 条）**；`H4` 实测 = `{pending_apply:0, resolved:9}`。原 §8.1 的 **9 条**库面 pending **逐条转真 checks**：`0030` 活体 6 值（`L1`）/ 活体白名单（`L2`/`L3`/`L4`）/ 退款闸放宽（`V16`/`V17`）· `0031` 两表 + 约束 + 索引（`L5`/`L6`）/ 两 append-only 触发器（`V0`）· `getRatingSummary` 活体（`V5`–`V8`）· `getTimeliness` 活体（`V9`–`V11`）· `transitionListingOrder` 活体（`V12`–`V15`）· 5 新口真 HTTP（`H5`–`H7`）。**未伪装绿**。

### 10.5 未测项（逐项原因 · **禁填 0/空**）

| # | 未测项 | 原因 |
|---|---|---|
| 1 | 前端评分/时效面板（`RatingTimelinessPanel.jsx`）+ 发货/收货按钮（`ListingsPage.jsx`）的**浏览器实渲染**与四语切换**目视** | 需真实浏览器 + 受控实例渲染环境；本门仅验源码面 / locale 键集与泄漏（`G9`–`G12`）与单测，**非该组件实渲染断言** ⇒ 未跑。 |
| 2 | 5 新口**成功写路径**的 HTTP 端到端（带 token + 合法入参 ⇒ `200` 且落库） | 门只验「读口 200」+「写口**非法入参** `400`/`404`（零写）」；**合法写**只在函数级真链路验（事务内 `ROLLBACK`，见 §10.2），**未走 HTTP 成功写** ⇒ 未跑。 |
| 3 | 生产环境 `0030`/`0031` 的 **schema_version 推进 / 上线效果** | 属**上线单**范围（本单**不 apply / 不 push**）⇒ 不在本单。 |
| 4 | 「门被判负后 **`p8-s7`** 是否连带」 | 本单只复跑 `p8-s8`；`p8-s7` 未复跑（非本单必做项）⇒ 未跑。 |

- **★ 登记（既有设计 · 非本单新增）**：`p8-s7` 的 HTTP leg 含 `POST /api/checkin`（⇒ `200`）**属 `p8-s7` 既有设计**（沿 `R-9-26` 先例），**非本单新增**。

### 10.6 收尾（精确 PID + `lsof` 空 + 首尾 `git status` 归因 + 报告自证）

- **受控实例**：`node` 监听 **PID `14181`**（`:5797`）经 **`kill -TERM 14181`** 终止 ⇒ `ps -p 14181` = **gone**；`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空**（`rc=1`）。**未启停 5787/5788**（现取仍由外部持有：`5787` PID `30475` · `5788` PID `65096`）· **未** `pkill -f` / `killall`。
- **首尾 `git status --porcelain` 归因**：**开工 = 22 条已修改 + 158 条未跟踪**；**收尾 = 22 条已修改 + 159 条未跟踪（共 181 行）**。**已修改 22 条逐条恒等**（本单为 `scripts/p8-s8*` 与报告写者，**未改任何 tracked 文件**）。**+1 条未跟踪 = `?? backend-ts/.p9s3-final-closeout/`**（本单原始输出 · **不提交**）。`?? backend-ts/.p8s8-artifacts/`（新 run）已含于既有未跟踪目录内；`?? docs/audit/p9-s3-rating-timeliness.md` 开工即已 `??`（本单**追加内容**，仍**不提交**）。
- **报告自证**（现取 · 亦见 `backend-ts/.p9s3-final-closeout/report-selfcheck.txt`）：「双下划线占位符」命中计数 = **0** · 「骨架占位括号行」命中计数 = **0**（行数 / 字节以自证文件为准）；原始输出 = `backend-ts/.p9s3-final-closeout/{p8-s8-instance.out, p8-s8-offline.out, p8-s8-instance-gate.json, p8-s8-offline-gate.json, mutations.json, git-status-final.txt, report-selfcheck.txt}`（**无 `.log` 后缀**）。
- **未跟踪产物清单（不提交）**：本单新增 `backend-ts/.p9s3-final-closeout/`；其余沿既有惯例留仓不提交。
