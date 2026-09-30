# P4-B4c-ii-b · 商品线 + 交易所线：接线与横竖屏 UX 收口（Kong）

> **状态：已完成（逐段回写完毕，无残留 `NOT_MEASURED` 占位；唯一性口径见 §7）。**
> 单元：`P4-B4c-ii-b`｜角色：Kong（前端接线 + UX）｜日期：2026-09-30（CST）
> 产物目录：`backend-ts/.p4-artifacts/b4ciib-20260930T220842+0800/{logs,post}/**`
> 硬边界自证：只写 `frontend/**` + 本报告 + `backend-ts/.p4-artifacts/b4ciib-*/**` + `backend-ts/scripts/p4z-b4ciib-*.ts`；
> `backend-ts/src/**`（并发单元在改）、`migrations/**`、任何 spec、`docs/seafood.master-plan.md`、`.env.local`、
> 既有 audit/qa 件、`docs/design/style-preview.html`、主题 token **值** —— 零改动（§8）。

---

## 0. 结论摘要

| 项 | 结果 | 读数（可 grep） |
|---|---|---|
| 商品线（上架/列表/详情/购买/退款） | **已接线**（7 条已注册路径） | §1.1 / §5 |
| 交易所线（挂单/单撤/全撤/订单簿/成交流水/我的挂单） | **已接线**（6 条已注册路径） | §1.2 / §5 |
| 红 A1 `npm run build` | **exit 0** | `BUILD_EXIT=0`（§4） |
| 红 A2 `npx vitest run src/test/unit` | **exit 0；105 例 / 12 文件全过**（基线 90 ⇒ **+15**） | `UNIT_EXIT=0` · `Tests 105 passed (105)`（§4） |
| 红 B 真实 HTTP 读数（5788） | **22 个读数点；14/14 断言旗标 true**；产物内 token 字节 = 0 | `HTTP_EXIT=0`（§5） |
| 红 C 主题同构（日/夜 rect 逐值 diff） | **4 页 diff = 0**（含 1 处真因修复） | `GEOM_EXIT=0`（§6） |
| 四项确认 ① 审核入口按权限隐藏 | **已落**（2 文件；非 admin 不渲染 + **不请求**队列） | §2-① |
| 四项确认 ② 「流水」未注册 ⇒ 空态、不自造 | **已落**（账本流水只空态；成交流水走**另一个已注册面**） | §2-② |
| 四项确认 ③ 新增单测 ≥ 6（总数 ≥ 96） | **+15 例**（`src/test/unit/listing-market.test.jsx`） | §2-③ / §4 |
| 四项确认 ④ sunset 面调用清理 | **逐条处置（4 文件 / 6 处）**，含 1 条**与派单前提不符**的实测登记 | §2-④ |

---

## 1. 接线清单（逐条 `文件:行号`；后端行号 = `backend-ts/src/index.ts` 现取）

### 1.1 商品线（`frontend/src/pages/listings/**`）

| 面 | 已注册路径（后端行号） | 前端落点（`文件:行号`） | 幂等键 | 金额来源 |
|---|---|---|---|---|
| 上架 | `POST /api/listing`（`:1492`） | `pages/listings/listing-api.js:65` · 页面 `PublishListingPage.jsx:41` | **前端供键** `cli:` | A 类**供给侧自主出价**（§4.8.1） |
| 上架状态迁移 | `PATCH /api/listing/:listingId`（`:1545`） | `listing-api.js:77` · 页面 `PublishListingPage.jsx:56` | 无键面 | — |
| 列表 | `GET /api/prize/all`（`:382`） | `listing-api.js:52` · 页面 `ListingsPage.jsx:38` | 无键（读） | 读侧换源 `listing`（`database.ts:1008`） |
| 详情 | `GET /api/prize/:bID`（`:433`） | `listing-api.js:55` · 页面 `ListingDetailPage.jsx:33` | 无键（读） | — |
| 我的商品订单 | `GET /api/prize-item`（`:546`） | `listing-api.js:58` · 页面 `ListingsPage.jsx:53` | 无键（读） | `listing_order`（`database.ts:1066`，买家轴） |
| 购买 | `POST /api/listing/:listingId/buy`（`:1569`） | `listing-api.js:84` · 页面 `ListingDetailPage.jsx:49` | **前端供键**（fail-loud） | **服务端取数**（payload 仅 `create_key`+`quantity`） |
| 退款 | `POST /api/listing-orders/:orderId/refund`（`:1590`） | `listing-api.js:88` · 页面 `ListingsPage.jsx:73` | **服务端派生** | 服务端取数（只传 `order_id`） |

### 1.2 交易所线（`frontend/src/pages/market/**`；经 `src/pages/ShardPage.jsx` 薄壳挂到既有 `/shard` 路由）

| 面 | 已注册路径（后端行号） | 前端落点（`文件:行号`） | 幂等键 |
|---|---|---|---|
| 挂单 | `POST /api/order`（`:751`） | `pages/market/market-api.js:63` · 页面 `MarketPage.jsx:109` | **前端供键**（fail-loud，§9.B B11） |
| 单撤 | `DELETE /api/order/:oID`（`:805`） | `market-api.js:74` · 页面 `MarketPage.jsx:128` | **服务端派生** |
| 全撤 | `DELETE /api/order`（`:782`） | `market-api.js:77` · 页面 `MarketPage.jsx:139` | **服务端派生**（逐单） |
| 订单簿 | `GET /api/market/:base_cid/orderbook`（`:829`） | `market-api.js:52` · 页面 `MarketPage.jsx:62` | 无键（读） |
| 成交流水 | `GET /api/market/:base_cid/trades`（`:844`） | `market-api.js:55` · 页面 `MarketPage.jsx:63` | 无键（读） |
| 我的挂单 | `GET /api/order`（`:729`） | `market-api.js:45` · 页面 `MarketPage.jsx:83` | 无键（读） |

> **路由**：`src/App.jsx:20-22`（导入）+ `:83-85`（`listing` / `listing/new` / `listing/:listingId`）；
> 交易所线**复用既有 `path="shard"`** 与 `shell/nav.js` 的 `shard` 项 ⇒ **导航项与断点骨架零改动**。

### 1.3 横竖屏 UX（同时交付）

| 维度 | 承载 | 读数（可 grep） |
|---|---|---|
| 窄屏单列 + 底部 tab | `shell/*`（单断点 767px，4c-i 交付，本单未改） | `tabbar_display_portrait:"grid"` / `tabbar_display_wide:"none"`；390×844 与 1440×900 的两页结构签名 `signature_equal_wide_vs_portrait=true`（4/4 页） |
| 宽屏多栅格 | `listings.css`（1 → ≥768px 2 → ≥1024px `var(--sf-st-feed-cols)` 4 列）· `market.css`（行情/盘口各 2 列） | §6 元数据；元素数与签名两档一致 |
| 四态齐备（加载/成功/失败/空） | 每页 `data-sf-phase` + `sf-*-empty` 空态 + R107 字符串文案 | 单测 4 例（空态/失败态）+ §6 `contains_object_object=false`（4/4 页） |
| 无 `[object Object]` | 错误一律经 `src/auth.js` 的 R107 链（`fetchApiJson`→`apiErrorMessage`） | 探针 `contains_object_object=false`；单测两例显式断言 |

---

## 2. 四项确认（逐项处置）

### ① 审核入口按权限隐藏 —— **已落**

- 后端唯一真源：`GET /api/tasklist/pending-verification`（`index.ts:1095`）与 `/count`（`:1082`）均 `requireAdmin(req,res,'review_tasks')`；非 admin ⇒ `403 AUTH_FORBIDDEN`。
- 前端处置（**不把 403 当首屏反馈**）：
  - `pages/jobs/JobReviewPage.jsx:6`（导入 `admin-utils`）· `:24-38`（取 `/api/admin/me` 能力集 + `canReview`）· `:40-46`（无权限 ⇒ 不发队列读）· `:80-96`（能力集未回 ⇒ 加载空态；无 `review_tasks` ⇒ `data-sf-m="jobs-review-denied"` 无权限空态，整页不可进入审核动作面）。
  - `pages/jobs/PublishJobPage.jsx:6`/`:22-34`（同判定）· `:82`（审核入口 `<Link data-sf-m="jobs-review-link">` **仅在 `canReview` 时渲染**）。
- 读数（单测三例，§4）：非 admin ⇒ 队列读调用数 `0`、入口 DOM 不存在；admin ⇒ 队列读调用数 `1`、入口存在。

### ② 「流水」只读接口未注册 ⇒ 保持空态、**不得自造** —— **已落（登记归批 6/7）**

- 事实（本片现取）：`grep -n "user/points\|user/ledger" backend-ts/src/index.ts` = **0 命中** ⇒ 账本流水读口**未注册**。
- 处置：`pages/market/MarketPage.jsx:224-231` 的「流水」板块 = **只有空态**（文案 = locale `ledger.flowEmpty`），零请求、零臆造；单测断言 `callsTo('/api/user/ledger').length===0` 且 `/api/user/points` 亦为 `0`。
- **口径澄清（防误读）**：同页另有「**成交流水**」板块 —— 那是 `GET /api/market/:base_cid/trades`（`:844`，**已注册**、只读、`market_trade` 表；实测 `200`），与「未注册的账本流水」是两个面，**不构成自造**。
- 登记：账本流水 / 积分读口 ⇒ **归批 6/7**。

### ③ 为新增交互补 ≥ 6 条单测 —— **+15 例**

- 新文件 `frontend/src/test/unit/listing-market.test.jsx`（15 个 `it`）：购买 payload 只有 `create_key`+`quantity`（伪造 price/seller 结构性被忽略）· 退款不传键 · 撤单/全撤不发 body · 上架带 `cli:` 键 · 读面路径 · PATCH `to_status` · tracker 同指纹同键/异指纹异键 · 订单簿按 `base_cid` · 交易所页空态 + **不请求**未注册读口 · R107 失败态字符串（无 `[object Object]`）· 审核入口按权限隐藏 ×3（非 admin 页面/入口/零请求；admin 才取队列）。
- 读数：`Tests 105 passed (105)`（基线 90 + 新增 15），`UNIT_EXIT=0`。
- **自曝**：首版因测试替身每次渲染返回新的 `t`（`useTranslation` mock）+ 页面 `useCallback(..., [.., t])` ⇒ 无限重渲染、vitest worker OOM（`ERR_WORKER_OUT_OF_MEMORY`）；改为**模块级稳定 `t`** 后全过。真机 i18next 的 `t` 稳定，故为**测试替身约束**，已在测试文件头逐字登记。

### ④ sunset 面调用清理 —— **逐条处置（4 文件 / 6 处）**

| # | 位置（`文件:行号`，行号 = 改动前） | 调用 | 处置 | 行为 |
|---|---|---|---|---|
| 1 | `pages/ShardPage.jsx:316` | `GET /api/shard` | **移除**（该页整体重写为交易所线，文件现为薄壳） | 恒空态面不再被调用；旧「碎片持仓」面板随页面消失 |
| 2 | `pages/ShardPage.jsx:318` | `GET /api/shard/transfer` | **移除** | 同上；流水展示改由**已注册**的 `/api/market/:base_cid/trades` 承担 |
| 3 | `pages/ShardPage.jsx:43-44` | `GET /api/market/${bID}/orderbook｜trades` | **移除**（`:bID` 已改 `base_cid` 语义，旧口径错） | 新页面按真实 `base_cid` 读数 |
| 4 | `pages/RewardPage.jsx:57` | `GET /api/shard` | **移除调用**（改 `Promise.resolve([])`） | `shardMap` 恒空 ⇒ 按空态渲染，不再显示臆造持仓 |
| 5 | `pages/ProfilePage.jsx:96` | `GET /api/shard` | **移除调用**（`loadShardHoldings` 只 `setShardHoldings([])`） | 空态容忍；迁移目标 `/api/user/points` 未注册 ⇒ 不迁、登记 |
| 6 | `pages/HomePage.jsx:119` | `GET /api/prize-item` | **保留（已空态容忍 `.catch(() => [])`）+ 登记偏差** | 见下 |

**★ 与派单前提不符的实测登记（`/api/prize-item` 不是 sunset 面）**：派单写「`/api/prize-item` 与 `/api/shard`（旧碎片/奖品面、已 sunset）」；
**实测**该路径 `200`、数据源 = `listing_order`（`database.ts:1066`，`buyer_uid=me AND status='paid'`），且是**退款面 `order_id` 的唯一已注册来源**
（读数 `O_mine_buyer_axis`：`contains_my_order=true`）⇒ 判为**保留路径 + 改语义（商品订单读面）**，不移除。
`/api/shard` 系确为 sunset（`deprecated:true` + 恒空态 + §5.2 明令禁止新代码调用）⇒ **全部移除**。

---

## 3. 幂等键逐面声明（服务端派生 vs 前端供键）

| 面 | 声明 | 依据（现取） | 前端行为 |
|---|---|---|---|
| `POST /api/listing` | **前端供键**（服务端**缺键会派生**，非 fail-loud） | `listing-service.ts:75-81` | `createListingPublishTracker()`（同一次操作重试 ⇒ 同键） |
| `PATCH /api/listing/:id` | 无键面 | `listing-service.ts:286` | 不传键 |
| `POST /api/listing/:id/buy` | **前端必供**（fail-loud） | `listing-funds-service.ts:111-114` | `createListingBuyTracker()` |
| `POST /api/listing-orders/:orderId/refund` | **服务端派生** | `migrations/0015_listing.sql:667` | **不传键**（自造键 = 新标识 = 第二次退款） |
| `POST /api/order`（挂单） | **前端必供**（fail-loud） | `market-service.ts:154`（§9.B B11） | `createOrderPlaceTracker()` |
| `DELETE /api/order/:oID` / `DELETE /api/order` | **服务端派生** | `migrations/0016_market.sql:625` | 不传键；**全撤不发 body**（query-only，§9.B B12） |
| 读面（列表/详情/我的订单/订单簿/成交/我的挂单） | 无键 | — | — |

---

## 4. 红线 A：build / 单测（**退出码一律管道外捕获**）

| 项 | 命令 | 退出码 | 读数 |
|---|---|---|---|
| A1 | `npm run build`（cwd `frontend/`） | `BUILD_EXIT=0` | 产物 `frontend/dist/**`（日志 `logs/build.log`） |
| A2 | `npx vitest run src/test/unit` | `UNIT_EXIT=0` | `Test Files 12 passed (12)` · `Tests 105 passed (105)`（基线 90 例 / 11 文件 ⇒ **+15 例 / +1 文件**，判据 ≥ 96 满足） |

> 两次 `BUILD_EXIT=0` / `UNIT_EXIT=0` 均在 **CSS 修复后的同一状态**复测（最后一次 = 报告同状态）。

---

## 5. 红线 B：真实 HTTP 读数（后端 `127.0.0.1:5788`；脚本 `backend-ts/scripts/p4z-b4ciib-01-http.ts`）

- 命令：`node_modules/.bin/ts-node --transpile-only scripts/p4z-b4ciib-01-http.ts <run>` ⇒ **`HTTP_EXIT=0`**
- 产物：`backend-ts/.p4-artifacts/b4ciib-20260930T220842+0800/post/b4ciib-http.json`（`SUMMARY.installments` = **22**；`token_bytes_in_artifact` = **0**，即产物无 token 字节）
- 夹具（现取，来自 DB + `GET /api/user` 探活）：`seller_uid=970001`（`$` 余额 1636071）· `buyer_uid=12`（136783）· `third_uid=11` · `listed_base_cids=[10,16,21,29,31,32,4]` · 夹具幂等键前缀 `cli:b4ciib:<TAG>:*`
- **14/14 断言旗标 = true**：

```
listing_price0_400 · listing_ok_200 · buy_ok_200 · buy_spoof_ignored · refund_ok_200
refund_stock_unchanged · refund_not_seller_403 · order_ok_200 · order_owner_spoof_ignored
orderbook_visible · orderbook_path1_empty · cancel_ok_200 · cancel_fee_not_refunded · cancel_all_ok_200
```

### 5.1 商品线（逐面 + 负例）

| 读数 | status | `error.code` / 关键值 |
|---|---|---|
| `L_neg_price0`（`price=0`） | **400** | `LEDGER_AMOUNT_NOT_POSITIVE` |
| `L_no_key_measured`（**缺 `create_key`**） | **200** | `data.created_key_derived=true`（服务端派生）⇒ **与派单预期「缺键 ⇒ 400」不符**，实测登记 |
| `L_ok` | **200** | `listing_id=18`，DB 行 `{status:"draft", price:"7", stock:"3", seller:"970001"}` |
| `L_replay_same_key`（同键重投） | **200** | `idempotent_replay`；`rows_for_key = 1`（**未落第二行**） |
| `L_transition_listed`（`PATCH to_status=listed`） | **200** | `Listing status transitioned`（draft→listed 才能被购买） |
| `L1_feed_visible`（`GET /api/prize/all`） | **200** | `listing_in_feed=true`，`feed_len=18` |
| `D1_detail_ok`（`GET /api/prize/18`） | **200** | 43 键（`bID/name/points/…`） |
| `D1_neg_miss_404` | **404** | detail-miss |
| `B_neg_no_key`（购买缺键） | **400** | `LEDGER_IDEMPOTENCY_KEY_REQUIRED` |
| **`B_ok_spoof_ignored`**（伪造 `price=1`/`seller_uid=11`/`buyer_uid=11`） | **200** | `order_row={order_id:7,buyer:12,seller:970001,price:7,quantity:1,status:"paid"}`；`ignored=true`；分录 `purchase −7 @12` + `sale +7 @970001`；回包含 `client_buyer_uid_ignored` ⇒ **金额与对手方服务端取数**（B8 成立） |
| `B_neg_self_purchase`（卖家自购） | **400** | `LEDGER_SELF_TRANSFER` |
| `O_mine_buyer_axis`（`GET /api/prize-item`） | **200** | `contains_my_order=true` ⇒ **买家轴读面可用**（非 sunset） |
| `R_neg_not_seller_403`（非卖方退款） | **403** | `AUTH_FORBIDDEN` + `details.reason=ACTOR_NOT_ALLOWED` |
| **`R_ok`**（卖方退款） | **200** | `stock_before=2` / `stock_after=2` ⇒ `stock_unchanged=true`（**既有单点裁定：退款不回滚库存**）；分录 `purchase_refund −7 @970001` + `purchase_refund +7 @12` |

### 5.2 交易所线（逐面 + 负例）

| 读数 | status | 关键值 |
|---|---|---|
| `M_neg_no_key`（挂单缺键） | **400** | `LEDGER_IDEMPOTENCY_KEY_REQUIRED`（§9.B B11 fail-loud） |
| **`M_ok_owner_spoof_ignored`**（伪造 `owner_uid=11`） | **200** | `order_row={order_id:25,owner:970001,base_cid:10,quote_cid:1,side:"buy",price:2,amount:3,status:"open"}`；`client_owner_uid_ignored="11"`；`ignored_owner=true`；`$` 冻结 `balance 1636071→1636065 / frozen 4112→4118`（= `amount×price = 6`） |
| `OB_ok_visible`（`GET /api/market/10/orderbook`） | **200** | `my_level={side:"buy",price:2,volume:3}` ⇒ 订单簿按 **`base_cid`** 聚合可见 |
| `OB_path1_only`（`GET /api/market/1/orderbook`） | **200** | `len=0` ⇒ **恒空态**（`base_cid=1` 与「`quote_cid` 恒 1、base≠quote」互斥）—— 派单里的「1」不得当 base 用，已登记 |
| `TR_ok_public`（成交流水） | **200** | `len=0`（无撮合 ⇒ 无成交；**不自造**） |
| **`MC_ok_fee_not_refunded`**（单撤） | **200** | `order_status="cancelled"`；冻结释放 `frozen 4118→4112 / balance 1636065→1636071`；分录 `hold_release ×2`（`frozen_delta −6` / `delta +6`）；`trade_fee_legs_on_cancel=0` ⇒ **手续费不退**（DL87） |
| `MC_neg_not_owner_403`（非 owner 撤单） | **403** | `AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED` |
| `MALL_ok_query_only`（全撤，**不发 body**） | **200** | `data.cancelled=1`；键集 `[cancelled,attempted,failed,orders,pair_lock,scope]`（query-only 口径成立） |

> **未测/不自造**：撮合成交（M3）**无已注册端点** ⇒ 不调用、不评估；`market_trade` 读数只来自既有流水（实测 `len=0`）。

---

## 6. 红线 C：主题同构回归（`frontend/scripts/p4z-b4ciib-geometry.mjs` ⇒ `GEOM_EXIT=0`）

口径：日/夜两档对同一套 DOM 逐元素 `getBoundingClientRect` 逐值比较；附三条对照（尺子灵敏度 1px 刻意错位 / 同档两次逐字节一致 / 390×844 ↔ 1440×900 结构签名）。产物 `post/b4ciib-geometry.json`（Chrome 154.0.8037.58）。

| 页面 | `geometry_diff_count` | 出现/量测元素 | `skin_changed` | `contains_object_object` | 扰动可判 | 扰动复位逐字节 | 同档重复逐字节 | 横竖屏签名 |
|---|---|---|---|---|---|---|---|---|
| `/listing`（商品列表） | **0** | 10 / 43 | true | **false** | true | true | true | 一致 |
| `/listing/new`（上架） | **0** | 12 / 43 | true | **false** | true | true | true | 一致 |
| `/listing/1`（详情） | **0** | 12 / 43 | true | **false** | true | true | true | 一致 |
| `/shard`（交易所线） | **0** | 21 / 43 | true | **false** | true | true | true | 一致 |

- **真因修复留痕（本单唯一一处几何修复）**：首测 `/shard` 为 `diff=14`。诊断（`frontend/scripts/p4z-b4ciib-diag.mjs` → `post/b4ciib-ticker-diag.json`）查得根因**不是**文本度量：
  行情条 `[data-sf-m="mkt-ticker"]` 的描边用了 `--sf-ticker-border`，而该**主题 token 在日档值 = `none`**（`theme/tokens.js` DAY）
  ⇒ `border: 1.5px solid none` 无效、日档 `border-width=0px` vs 夜档 `1px`（`box-sizing:content-box`）⇒ 盒高 86 vs 88（+2px，级联出 14 处 rect 差）。
  修法（`pages/market/market.css`）：描边宽度取**结构常量** `--sf-st-stroke-w`、颜色改用**两档都是颜色**的 `--sf-card-border`，并加 `box-sizing: border-box` + 固定盒高 `--sf-k-ticker-h` ⇒ 复测 **4/4 页 diff = 0**。
- `page_errors` = 4 × `ReferenceError: tailwind is not defined`（5 个外域 CDN 被探针 abort：`cdn.tailwindcss.com` 等）⇒ 属**探针环境**性质（Tailwind Play CDN 不可用），非本单代码缺陷；本单新页面**零 Tailwind 类**，已由 §1.3 的 token-only 规则保证。

---

## 7. 探针自曝（这把尺子可能的失效方式）

1. 几何探针**不联网**：同源 `/api/**` 落 `dist/index.html` ⇒ JSON 解析失败 ⇒ 页面进**失败态**；因此量的是「失败态 + 骨架」几何，**不覆盖有数据态**（行数多的列表/盘口）。
2. 探针把登录态写进 `localStorage['user']`（`uID:1`）⇒ 只量**已登录形态**；未登录形态 = **NOT_MEASURED**。
3. 每页 43 个选择器里只有 10–21 个在该页存在（其余 `null`）⇒ `diff=0` 是这 10–21 个元素的逐值相等，**不等于整页所有元素**；未纳入选择器的元素 = NOT_MEASURED。
4. 扰动对照只改**一个**元素的 `padding-top: 1px`：证明尺子对 1px 敏感，**不**证明每个读数都非退化。
5. HTTP 探针的 token 由 `SECRET_KEY` 自铸 ⇒ 只验**服务端信任链内**行为，**不**覆盖真登录流程；不覆盖 4 个 `410` 弃用面与未注册面。
6. 「8 处 `= $1::text` 写法」首版在 `listing_id/order_id`（bigint）上触发 `42883 operator does not exist: bigint = text` ⇒ 已改 `$1::bigint` 复跑成功（**首跑读数已作废，本报告只引最终 run**）。
7. 单测替身 `t` 的稳定性约束（§2-③ 自曝）—— `t` 不稳定会放大成无限重渲染，与本单产品代码无关。

---

## 8. 边界自证（未触碰清单）

- **零改动**：`backend-ts/src/**`、`backend-ts/migrations/**`、`docs/*.spec.md`、`docs/seafood.master-plan.md`、`backend-ts/.env.local`、`docs/design/style-preview.html`（只读）、既有 `docs/audit/*`、`frontend/src/theme/tokens.js`（token **值**未改，仅**引用**）。
- 本单**新增/改动**文件：
  - 新增：`frontend/src/pages/listings/{listing-api.js,listings.css,PublishListingPage.jsx,ListingsPage.jsx,ListingDetailPage.jsx}`、`frontend/src/pages/market/{market-api.js,market.css,MarketPage.jsx}`、`frontend/src/test/unit/listing-market.test.jsx`、`frontend/scripts/p4z-b4ciib-{geometry,diag}.mjs`、`backend-ts/scripts/p4z-b4ciib-01-http.ts`、本报告、`backend-ts/.p4-artifacts/b4ciib-20260930T220842+0800/**`。
  - 改动：`frontend/src/App.jsx`（3 路由 + 3 导入）、`frontend/src/locales/{zh,en,hk,vn}.json`（各 +`listings`/`market` 两段，**键集四语完全同集**）、`frontend/src/pages/ShardPage.jsx`（薄壳）、`frontend/src/pages/jobs/{JobReviewPage,PublishJobPage}.jsx`（审核入口权限闸）、`frontend/src/pages/{RewardPage,ProfilePage}.jsx`（移除 `/api/shard` 调用）。
- **禁项确认**：无 `git add/commit/push`；无 `npm install`；无 `npx playwright install`（复用本机 Chrome）；无删除型 SQL；无 `execute_code`；无常驻 dev server、未占端口；无 `pkill`/`killall`；未启停任何项目服务。
- 主题 token 纪律：新 CSS 只引用 `--sf-*` / `--sf-st-*`，**零颜色字面量**、**零 `[data-theme]` 分支**，并刻意**不**使用「日档值为 `none`」的主题 token 做描边（§6 真因）。

## 9. 未做 / 登记（跨批）

1. 商品**编辑**面（`POST /api/listing/:listingId`）未接线（仅接线状态迁移 `PATCH`）⇒ 登记跨批。
2. 「按卖家列订单」读口未注册 ⇒ 退款 `order_id` **手填**（沿用招工线缺读口时的既有处置，locale `listings.refundNote` 已明示）。
3. 币种读面未注册 ⇒ `cid` / `base_cid` 手填（locale `listings.cidNote` / `market.baseNote` 已明示）。
4. 撮合成交（M3）无端点 ⇒ 成交流水天然常空（不得自造）。
5. 账本流水（`/api/user/ledger`）与积分读口（`/api/user/points`）**未注册** ⇒ 归**批 6/7**。
6. 导航项标签值仍为旧词 `碎片市场`（key 集与断点骨架未动，改值 = `locales/*.json` 的 `shard` 键）⇒ 登记待裁（本单不做，避免与 4c-i 导航词表冲突）。
