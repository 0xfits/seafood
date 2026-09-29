# P4-B3d · 商品（listing）资金编排 —— 审计报告

> **片名**：Unit P4-B3d / 商品资金编排（Kong）　**run tag** = `b3d-20260930T023156`
> **依据（唯一权威）**：`docs/route-layer.spec.md` **v0.5** + `docs/data-layer.spec.md` **DL85**
> **状态图例**：`[已实测]` = 下文可 `grep` 到支撑读数；`[代码推断]` = 未跑，只读源码得出；`NOT_MEASURED` = **未测**（**不当 0 / 不当空** 使用）。
> **写作纪律**：骸架先行、每段立即回写；产物 run-tagged + 绝对路径。
> **产物根（绝对路径）**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3d-20260930T023156/`

---

## §1 本片事件与端点清单（**先落盘 · 再动代码**）

### 1.1 事件清单

| 事件 | 端点（spec §4.2） | 编排函数 / DB 入口 | kind（§4.1 关闭集） | 必需字段 | 幂等键 | 资金四栏（§4.3） | 期望码（§4.2，实测见 §4） |
|---|---|---|---|---|---|---|---|
| **P2** 商品下单（付款即交付） | `POST /api/listing/:listingId/buy` | `public.listing_post_event(op='buy')`（`migrations/0015_listing.sql:449`） | **`purchase` ×1 + `sale` ×1（恰好两条，DL85）** | `create_key`(`cli:`)、`listing_id`、`buyer_uid`、`quantity`、`request_fingerprint` | **create_key** = `listing_order.create_key`（UNIQUE）；**事件根键** = `biz:listing:buy:<order_id>`（`0015:624`，函数派生） | 出钱 = **买家**（余额 `−price×qty`）；收钱 = **卖家**（`+price×qty`，`sale`）；**无平台费**（DL85 钉死恰好两条） | `409` LD001 `listing_stock_insufficient` / LD008 `listing_not_listed` / LD011；`400` LD019 `self_purchase_not_allowed`；`404` LD023 `listing_not_found` |
| **P4** 退款 | `POST /api/listing/order/:orderId/refund` | `public.listing_post_event(op='refund')`（`0015:661`） | **`purchase_refund` ×2（恰好两条，DL85）** | `order_id` | **事件根键** = `biz:listing:refund:<order_id>`（`0015:667`，函数派生） | 出钱 = **卖家**（余额 `−amount`）；收钱 = **买家**（`+amount`）；**无平台费** | `409` LD001/LD011 `order_not_refundable` / `order_pay_missing`；`404` LD023 |

**金额与对手方取数口径（派单硬口径 #1）**：`price` 与 `seller_uid` **一律在 DB 函数内从 `public.listing` 行取**（`v_amount := v_listing.price * v_qty`（`0015:590`）、`v_listing.seller_uid`（`0015:647`）、refund 侧从 `public.listing_order` 行取（`0015:710,721,724`））⇒ **服务层与路由层不传、不接受 price/seller 任何形式**。买方 `buyer_uid` 取 **token 的 actor**（服务层强制覆盖，见 §2.3；实测 §4 `P2_buy_spoof_attempt`）。

> **★ 上表「期望码」列 = 抄 spec §4.2 原文**；**实测发现 spec 的 `LDxxx` 编号有偏差** —— 见 **§6.4 待裁项 5**（spec 写 `404 LD023`，DB 实抛 `LD022 = LEDGER_REF_NOT_FOUND`；`LD023` 实为 `LEDGER_UNKNOWN_KIND`。**HTTP 码 404 与 `details.reason` 两侧一致，仅 `LDxxx` 编号不对**）。

### 1.2 端点注册判定（**先现取前端消费面**）

扫描命令（现取）：`grep -rho "/api/[a-zA-Z0-9/_:.\${}-]*" frontend/src | sort -u` ⇒ **50 条去重路径**（清单见 `.p4-artifacts/b3d-20260930T023156/b3d-00-frontend-paths.txt`；对该文件 `grep -c listing` ⇒ **0**）。

| 事件 | spec 目标路径 | 前端消费？ | 本片处置 |
|---|---|---|---|
| P2 | `POST /api/listing/:listingId/buy` | **否**（扫描 0 命中，`/api/listing*` 无任何读写路径） | **服务层交付；路由层随批 4**（硬口径 #6） |
| P4 | `POST /api/listing/order/:orderId/refund` | **否** | **服务层交付；路由层随批 4** |

**注册点基线 = 53**（`grep -cE '^app\.(get|post|put|delete|patch)\(' backend-ts/src/index.ts` = **53**[已实测]）。
**本片注册点变化 = 0（显式报数：53 → 53）** —— 因两条路径**前端零调用**（硬口径 #6「只允许注册前端确在叫的路径」）。`grep -c "listing-funds-service\|listing-service" src/index.ts` ⇒ **0**[已实测]（商品写口整条仍未接线，含 2b 的非资金口 —— 本片**未顺手替 2b 接线**，硬口径 #7）。

> **★ 硬边界冲突登记（须 Zang/Jing 收口）**：派单硬口径 #6 要求「前端零调用的新路径 ⇒ **必须登记进 spec §1.8 清单**」，但本片**硬边界**同时规定 `docs/** 只读`（禁止写任何 spec）。⇒ **本片无权写 `docs/route-layer.spec.md`**，故**以本报告为登记载体**：**请 Jing 在 spec v0.6 的 §1.8 补两行**（第 **9**/**10** 条）：
> `9 | POST /api/listing/:listingId/buy | src/listing-funds-service.ts:191（buyListing） | 前端零调用（本报告 §1.2 现取扫描） | 批 4`
> `10 | POST /api/listing/order/:orderId/refund | src/listing-funds-service.ts:261（refundListingOrder） | 前端零调用（本报告 §1.2 现取扫描） | 批 4`
> （两路径**均满足 §1.8 准入判据三条**：① 服务编排层有具名端点级 verb；② `src/index.ts` 无对应注册点（`grep` 现取 0 命中）；③ §4.2 P2/P4 有明文命名。）

### 1.3 §1.8 准入判据自检 + 负向排除（本片新增 verb）

| verb | ① 端点级导出 | ② `index.ts` 注册点 | ③ spec 明文命名 | 结论 |
|---|---|---|---|---|
| `buyListing`（`src/listing-funds-service.ts:191`） | ✅ | **0** | ✅ §4.2 P2 | **入 §1.8 清单（批 4）** |
| `refundListingOrder`（`:261`） | ✅ | **0** | ✅ §4.2 P4 | **入 §1.8 清单（批 4）** |
| `listingEventView`（`:152`）/ `resolveBuyCreateKeyRequired`（`:109`） | 否（helper） | — | — | **负向排除（§1.8 注 1 类）** |

---

## §2 实现口径

### 2.1 改动面（`git status --porcelain` 现取；`git add/commit/push` 全程未执行）

| 文件 | 性质 | diff |
|---|---|---|
| `backend-ts/src/listing-funds-service.ts` | **新增**（317 行；sha256 `e1948bb667897608c337191c3b62abf65825987fa40b85257850062e2bef2157`） | — |
| `backend-ts/src/database.ts` | 修改（**+68 / −0**；sha256 `67d6aba3b2c52e355e50f445e609b1f40ab644c56708c60ab97e1514a220267b`） | 2 个 `static async` method（`listingPostEvent` `:1773` / `resolveListingOrder` `:1788`） |
| `docs/audit/p4-b3d-listing-funds.md` | 新增（本报告） | — |
| `backend-ts/scripts/p4z-b3d-0{0,1,2,3}-*.ts` | 新增（4 个探针；**未改** `p4z-01-probe.ts`） | — |
| `backend-ts/.p4-artifacts/b3d-20260930T023156/**` | 新增（产物） | — |

**禁写面现取核实**：`migrations/**`、`src/ledger.ts`、`src/ledger-errors.ts`、`src/commission.ts`、`frontend/**`、`backend-ts/.env.local`、`docs/**`（除 `docs/audit/p4-b3d-listing-funds.md`）、`docs/seafood.master-plan.md`、其它既有脚本/artifact ⇒ **`git status --porcelain` 逐条不外溢**[已实测]。
**`listing-funds-service.ts` 的 `./ledger` 引用唯一** = `:36` 错误映射助手（`ledgerErrorFromDbError` / `normalizeLedgerError`）；`./commission` 引用 **0** ⇒ 「**零自拼分录**」是**结构保证**、不是纪律声明（§4.0 R1 ② 同批 3b 口径）。

### 2.2 单语句原子（派单硬口径 #4）

业务行（`listing` / `listing_order`）+ 分录**同一条 SQL 语句**：`DatabaseService.listingPostEvent`（`src/database.ts:1773-1780`）**只**发

```
SELECT public.listing_post_event($1::jsonb) AS r
```

—— 一条语句 = 一个隐式事务；函数内「锁业务行（`FOR UPDATE`）→ 派生分录 → 调 `ledger_post_event` → 回写 `pay_txid`/`refund_txid`/`ledger_event_keys`/`status`/`stock`」全部同生同灭（§4.0 R2 / DL20 / DL141 全序「业务行先于 currency/account」，`0015:543-544,669-670`）[已实测：`P2_buy_happy` 同一次调用内 `stock 3→1` + `order.status=paid` + `pay_txid=88` + 2 条分录 `txid 88,89` 一起落库，见 §4.3]。

### 2.3 服务端取数（派单硬口径 #1）

| 值 | 取数点 | 服务层是否可见/可传 |
|---|---|---|
| `amount = price × quantity` | DB 函数 `0015:590`（refund 侧 `0015:710`） | **不可传**（请求契约无 price） |
| `seller_uid` | DB 函数 `0015:647`（refund 侧 `0015:721,724`） | **不可传**（请求契约无 seller_uid） |
| `buyer_uid` | 服务层 `buyListing` 注入 `String(actor.uid)`（`src/listing-funds-service.ts:214` 一带） | **客户端传值被丢弃**（`:207` 只留审计痕迹 `client_buyer_uid_ignored`） |

### 2.4 幂等（派单硬口径 #5）

| 面 | 机制 | 真源 |
|---|---|---|
| 创建键 | `listing_order.create_key`（UNIQUE）；**缺失 ⇒ fail-loud `400 LD005`**，**不派生**（§4.4-14 口径：内容派生会让「同内容的两笔不同下单」碰撞成 200 重放 = 静默丢单） | 服务层 `src/listing-funds-service.ts:109`；DB `0015:499-502` |
| 事件根键 | 函数**确定性派生**（调用方不得自造，DL95）：`biz:listing:buy:<order_id>` / `biz:listing:refund:<order_id>` | `0015:624,667` |
| **同键同内容** | **`200` replay**（`idempotent_replay:true`）：**不产生第二条分录、不重写业务行、不第二次扣库存、不追加 `ledger_event_keys` 项**（DL144①/DL149） | `0015:628-629,676-678,760-782`[已实测 §4.3/§4.5] |
| **同键异内容** | **`409 LEDGER_IDEMPOTENCY_CONFLICT`**，DB 侧 `reason = CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT`（`0015:556-563`，业务侧对应 DL144②） | [已实测 §4.3/§4.4] |

**幂等键含实体自然标识**：buy 的根键 = `biz:listing:buy:<order_id>`（**`order_id` 是实体自然标识**，不是内容哈希）⇒ 与 2a/3b 先例同族；本片**未做**「缺键就从内容派生」（硬口径 #5 逐字禁止）。

### 2.5 ★7-7 单点判定（派单硬口径 #3 · **待 Kevin 一句话可改**）

| 项 | 值 | 单点落点 | 改法 |
|---|---|---|---|
| **退款是否回滚 `listing.stock`** | **`false`（不回滚）** —— Kevin 未表态 ⇒ 取默认值 | **`src/listing-funds-service.ts:55`**（`export const REFUND_ROLLS_BACK_STOCK = false;`，带完整注释）；真源 = `migrations/0015_listing.sql:773-781`（frozen migration 注释逐字：「DL62：库存回滚策略由 P4 spec 定 ⇒ 本迁移**不复原库存**（不发明）」） | ① 改「回滚」⇒ 需**新迁移**（本片禁改 `migrations/**`）；或 ② 在 `listingPostEvent` 的**同一语句**内补 `UPDATE public.listing SET stock = stock + n`（必须同事务，否则破坏硬口径 #4）。**两处本片均未做** |

**可观测投影**：每次回执的视图里带 `stock_rolled_back`（`src/listing-funds-service.ts:166` 一带）⇒ 将来一句话改常量，回执即变[已实测：`P2_buy_happy` view `stock_rolled_back:false`；`P4_refund_happy` 同]。

**第二处单点（spec 未定义、服务层自定 · 同样「一句话可改」）**：`REFUND_ACTOR_IS_SELLER_ONLY = true`（`src/listing-funds-service.ts:62`）—— §4.2 P4 的必需字段**只有 `order_id`**，**未定义 actor** ⇒ 本片取**最严**口径「只有卖方（`listing_order.seller_uid`）可发起退款」（资金从卖方余额出 ⇒ 由出资方发起）。**待 Zang 确认**（见 §6.4 待裁项 2）。

---

## §3 before 台账（全账户 dump + 逐 kind + `listing` 快照）

**产物**：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3d-20260930T023156/b3d-01-snapshot-pre.json`（sha256 `25f35121af1197dc07ff332803e949d98a876428396f70ac87108f838b36c419`）

**① 全账户 dump（逐行 `uid/cid/balance/frozen`）与 Σ**[已实测]

| uid/cid | balance | frozen |
|---|---|---|
| 2/1 | 7600 | 4002 |
| 3/1 | 1386 | 0 |
| 4/1 | 4 | 0 |
| 5/1 | 6 | 0 |
| 6/1 | 990 | 0 |
| 970001/1 | 1974795 | 0 |
| （另 4 行 balance=0 / frozen=0；共 **10 行**） | | |

- **rows = 10**，**Σbalance = 1995998**，**Σfrozen = 4002**，**Σtotal = 2000000** ✅（**= 派单给定基线 2000000**，**未 ≠**，无需停下查）
- **负值行 = 0**

**② `ledger_entry` 逐 kind 计数与总数**[已实测]

| kind | n | kind | n |
|---|---|---|---|
| `commission` | 4 | `job_payout` | 6 |
| `currency_create_fee` | 20 | `listing_deposit` | 16 |
| `hold` | 4 | `mint` | 2 |
| `job_escrow` | 10 | `transfer` | 4 |
| `job_escrow_refund` | 4 | **总数** | **76** |
| `job_fee` | 6 | | |

- **逐 kind 之和 = 76 = 总数** ✅（闭合）；`ref_type='listing_order'` 的**孤儿分录**（根键不以 `biz:listing:` 开头） = **0**
- 与 spec §1.8 的「`ledger_entry` 42 → 76（Δ34）」**逐位一致** ⇒ 基线可复算

**③ `listing` / `listing_order` 快照**[已实测]

| 项 | pre |
|---|---|
| `listing` 行数 / 其中 `status='listed'` | **12 / 0** |
| `listing.stock` **负值行** | **0**（`23514` 非负 CHECK 未被触发过的证据面） |
| `listing_order` 行数 | **0** |

---

## §4 端到端取证（真 token · HTTP + 服务层）

**产物**：`…/b3d-20260930T023156/post/e2e.json`（sha256 `d1f52795ad1bf4e0cc31d87cea6a769aa9dec34395df3ac16bc168d639370a97`）
**DB 层补测**：`…/post/db-reason.json`（sha256 `3b06e395a5b27777204107dbdd2d0cd7217441874e3b28c1c7bb3c6ead2cb230`）

### 4.1 环境与 token

| 项 | 读数 |
|---|---|
| 服务 | sid `seafood-api`（`:5788`）；重启**只走面板** `POST 127.0.0.1:5555/api/restart {sid}` ⇒ `200 {"sid":"seafood-api","ok":true,"state":"running","pid":66079,"msg":"已启动"}`；**重启后 `/health` 200**（wait **2219 ms**）；`schema_version = 0020` |
| 真 token | 候选 2 个，**胜出 = `env-SECRET_KEY(.env.local)`**（`/api/admin/me` ⇒ **200**）；密钥本体**不落盘**（只记候选名 + token 指纹）；**产物 `leak_check`：`eyJ` = 0 / 密钥出现次数 = 0** |

### 4.2 路径注册面（**预期 404**）

| id | HTTP | **实测** |
|---|---|---|
| `HTTP_buy_404` | `POST /api/listing/13/buy` | **404**（体为裸文案、非 JSON ⇒ `code=null`） |
| `HTTP_refund_404` | `POST /api/listing/order/1/refund` | **404**（同上） |

> 与 spec §1.3 已登记一致：未注册路径落 404、**兜底体尚未对齐 `R107`**（批 4 收口项）；本片**未注册** ⇒ 该面**零变化**。

### 4.3 P2 购买（DL85 恰好两条）

| id | 期望 | **实测** |
|---|---|---|
| `P2_buy_happy` | 200 | **200**。`order_id=2`（listing 13，买家 uid 8，卖家 uid 7）；**`amount=200` = `price 100 × qty 2`（服务端取数）**；事件根键 `biz:listing:buy:2`；**恰好 2 条分录** = `purchase`（uid 8 `balance −200`，`balance_after=4800`）+ `sale`（uid 7 `+200`，`balance_after=5200`）；**逐腿 `frozen_delta = 0`**；**事件 Σδ = 0 / Σ(frozen_delta) = 0**；`listing.stock 3 → 1`；`order.status=paid`、`pay_txid=88`、`ledger_event_keys=['biz:listing:buy:2']`；回执 `event_kinds='purchase,sale'`、`entry_count=2` ✅ **DL85** |
| `P2_buy_spoof_attempt` | 200 且**伪造入参全被忽略** | **200**。请求体带 `price:'1'` / `seller_uid=THIRD` / `buyer_uid=THIRD` ⇒ **全部被忽略**：2 条分录 = uid 8 `purchase −100` / uid 7 `sale +100`；**`amount = 100 = listing.price 100 × qty 1`（用的不是客户端传的 `price=1`）**；卖家 = `listing.seller_uid`（uid 7，**不是** THIRD）；买家 = **actor**（uid 8，**不是** THIRD）✅ **硬口径 #1 兑现** |
| `P2_buy_replay_same_key` | 200 + `idempotent_replay:true`，**零新增分录、零二次扣库存** | **200 / `idempotent_replay=true`**；分录**仍 2 条**、**txid 集合逐位相同**（`[88,89]`）；**`stock` 重投前后 = `1` → `1`**（未二次扣）；`ledger_event_keys` 未追加 ✅ |
| `P2_buy_same_key_diff_content` | **409** | **409 `LEDGER_IDEMPOTENCY_CONFLICT`**；DB 层 `sqlstate=LD003`、`reason=CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT`（§4.4 DB 补测）；分录**仍 2 条**（未增） |

### 4.4 P2 负例（**零残留**）

| id | 请求 | **实测（服务层侧 HTTP 码 / code）** | DB 层真源（`db-reason.json`） |
|---|---|---|---|
| `P2_neg_stock_insufficient` | `L_EMPTY`（`stock=0`）买 1 | **409 / `LEDGER_INSUFFICIENT_BALANCE`** | `sqlstate=LD001`、`reason=listing_stock_insufficient`、`field=listing.stock`、`required=1 available=0` |
| `P2_neg_self_purchase` | 卖家 uid 7 买自己的 listing 13 | **400 / `LEDGER_SELF_TRANSFER`** | `sqlstate=LD019`、`reason=self_purchase_not_allowed` |
| `P2_neg_unknown_listing` | listing 999999999 | **404 / `LEDGER_REF_NOT_FOUND`** | `sqlstate=LD022`、`reason=listing_not_found` |
| `P2_neg_nonnumeric_listing` | `:listingId = abc` | **404 / `LEDGER_REF_NOT_FOUND`**（服务层；`details.reason=listing_not_found`） | 不入函数（服务层形状闸） |
| `P2_neg_no_create_key` | 无 `create_key` | **400 / `LEDGER_IDEMPOTENCY_KEY_REQUIRED`** | `sqlstate=LD004`（同码，双道闸一致） |
| `P2_neg_bad_prefix` | `create_key='zzz:1'` | **400 / `LEDGER_IDEMPOTENCY_KEY_INVALID`**（`reason=PREFIX_REQUIRED`） | `sqlstate=LD005`、`reason=PREFIX_REQUIRED` |
| `P2_neg_zero_qty` | `quantity='0'` | **400 / `LEDGER_AMOUNT_NOT_POSITIVE`** | 同族（服务层形状闸先行） |
| `P2_neg_insufficient_balance` | `L_PRICEY`（price 1e8）买 1 | **409 / `LEDGER_INSUFFICIENT_BALANCE`** | `sqlstate=LD001`、`required=100000000`、`available=4900` |

**零残留取证**[已实测]：全部负例后 `listing_order` 总行数 = **3**（= 夹具 1 行 `created` + 本片 2 行成功单）；`L_EMPTY` 的 `stock` 仍 `0`、`status='listed'`（未被改写）；`listing.stock` 负值行 = **0**（`23514` 非负 CHECK **未触发**）。

### 4.5 P4 退款（DL85 恰好两条 · ★7-7 不回滚）

| id | 期望 | **实测** |
|---|---|---|
| `P4_refund_happy` | 200 | **200**。`order_id=2`；根键 `biz:listing:refund:2`；**恰好 2 条分录** = `purchase_refund`（uid **7 卖家** `−200`）+ `purchase_refund`（uid **8 买家** `+200`）；**逐腿 `frozen_delta=0`**、**Σδ=0**；**卖家 `5300 → 5100`（−200）**、**买家 `4700 → 4900`（+200）**；`order.status=refunded`、`refund_txid=92`、`ledger_event_keys=['biz:listing:buy:2','biz:listing:refund:2']`；**`stock` 0 → 0（★7-7 = 不回滚）**；回执 `event_kinds='purchase_refund'`、`entry_count=2`、`stock_rolled_back:false` ✅ **DL85** |
| `P4_refund_replay` | 200 + replay | **200 / `idempotent_replay=true`**；分录**仍 2 条**、txid 集合逐位相同（`[92,93]`）；`stock` 仍 `0` ✅ |
| `P4_neg_non_owner_third` | **403** | **403 `AUTH_FORBIDDEN`**，`details={reason:ACTOR_NOT_ALLOWED, field:actor.uid, required_uid:7}`（服务层构造 ⇒ `details` **完整可见**） |
| `P4_neg_non_owner_buyer` | **403** | **403 `AUTH_FORBIDDEN`** + `ACTOR_NOT_ALLOWED`（**买家本人**亦不可发起 ⇒ 口径一致，非「非卖家即拒」的偶然） |
| `P4_neg_order_not_refundable` | **409** | **409 / `LEDGER_CURRENCY_INVALID_TRANSITION`**；DB 层 `sqlstate=LD011`、`reason=order_not_refundable`、`status=created`（以**夹具 `status='created'` 订单**构造）；**退款分录 = 0** |
| `P4_neg_unknown_order` | **404** | **404 / `LEDGER_REF_NOT_FOUND`**（`reason=order_not_found`）；**退款分录 = 0** |
| `P4_neg_nonnumeric_order` | **404** | **404 / `LEDGER_REF_NOT_FOUND`**（服务层形状闸） |

### 4.6 逐腿台账（供 Zang 自算 · 逐事件枚举等式）

| 事件 | 根键 | 腿数 | 逐腿（uid / kind / δ / frozen_δ） | 事件 Σδ | 事件 Σfrozen_δ |
|---|---|---|---|---|---|
| P2 happy | `biz:listing:buy:2` | **2** | 8 / `purchase` / −200 / 0　·　7 / `sale` / +200 / 0 | **0** | **0** |
| P2 spoof | `biz:listing:buy:3` | **2** | 8 / `purchase` / −100 / 0　·　7 / `sale` / +100 / 0 | **0** | **0** |
| P4 happy | `biz:listing:refund:2` | **2** | 7 / `purchase_refund` / −200 / 0　·　8 / `purchase_refund` / +200 / 0 | **0** | **0** |

**「不得出现预期外的 `frozen` 变动」**[已实测]：上述 6 条分录 `frozen_delta` 全 = `0`，`frozen_after` 全 = `0`；`Σfrozen` 台账前后**逐位相同**（见 §5）。

---

## §5 after 台账 + 不变量对拍

**产物**：`…/b3d-01-snapshot-post2.json`（sha256 `3995eff589ff715d360057b59923a948a86982d9642b2e0a5842d6d6269fbf86`；**post2** = 在 DB 层补测**之后**所取 ⇒ 兼作「DB 补测零残留」校验）；`…/post/invariant-diff.txt`（逐行 diff 原文）。

**① 资金不变量（pre → post2）**[已实测]

| 量 | pre | post2 | 判定 |
|---|---|---|---|
| `account` 行数 | 10 | **12**（+2 = 本片新用户 uid 7/8 的 `$` 账户） | — |
| **Σbalance** | 1995998 | **1995998** | **不变** ✅ |
| **Σfrozen** | 4002 | **4002** | **不变** ✅（零 `frozen` 变动） |
| **Σtotal** | **2000000** | **2000000** | **不变** ✅（**= 派单基线**；购买/退款全是**纯转移**） |
| 负值行 | 0 | **0** | ✅ |

**② 逐行变化（全账户 dump 的 diff，原文见 `invariant-diff.txt`）**[已实测]

| uid/cid | balance | frozen |
|---|---|---|
| **NEW 7/1**（卖方） | 0 → **5100** | 0 → 0 |
| **NEW 8/1**（买方） | 0 → **4900** | 0 → 0 |
| DIFF 970001/1（夹具供资方） | 1974795 → **1964795**（−10000） | 4002 → **4002**（不变） |

**闭合校验**：`−10000`（供资方）= `+5100 + 4900`（两个新账户）✅ **逐分闭合**；ΔΣbalance = **0** ✅。
> **口径提醒（探针自曝 3）**：`970001` 的 **−10000** 是**本片夹具**经 `fundFromResidual`（`kind='transfer'` ×4 腿）的转移，**不是**买/卖事件的分录 —— 对拍时须与 P2/P4 的 6 条分录分开。

**③ `ledger_entry` 逐 kind 与增量**[已实测]

| kind | pre | post2 | 增量 |
|---|---|---|---|
| `purchase` | 0 | **2** | **+2** |
| `sale` | 0 | **2** | **+2** |
| `purchase_refund` | 0 | **2** | **+2** |
| `transfer`（**夹具供资**） | 4 | **8** | **+4** |
| 其余 9 个 kind（`commission`/`currency_create_fee`/`hold`/`job_*`/`listing_deposit`/`mint`） | — | **逐位不变** | **0** |
| **总数** | **76** | **86** | **+10** |

**逐事件枚举等式闭合**：`P2 事件 × 2`（happy + spoof，各 2 腿 = `purchase`+`sale`）⇒ 4；`P4 事件 × 1`（2 腿 = `purchase_refund`×2）⇒ 2；`夹具供资 × 2`（各 2 腿 = `transfer`）⇒ 4。**4 + 2 + 4 = 10 = Δ总数** ✅（**增量 == 事件数 × 分录条数**逐项闭合）。
**种类侧闭合**：`purchase 2 + sale 2 + purchase_refund 2 + transfer 4 = 10` ✅。

**④ 其他不变量**[已实测]

| 量 | pre | post2 | 判定 |
|---|---|---|---|
| `listing` 行数 / `status='listed'` | 12 / 0 | **15 / 3**（+3 = 本片 3 个夹具 listing；`L_HAPPY` 买/退后**仍 `listed`**） | 预期 |
| `listing.stock` 负值行 | 0 | **0** | ✅ `23514` **未触发** |
| `listing_order` 行数 | 0 | **3** | ✅（无孤儿单：= 夹具 1 + 成功单 2，负例零残留） |
| `ref_type='listing_order'` **孤儿分录**（根键不以 `biz:listing:` 开头） | 0 | **0** | ✅ **无孤儿分录**（每条新分录都可归到本片一个业务状态变化） |
| `stock` 轨迹（listing 13） | —（新建 3） | **3 →（buy 2）1 →（spoof buy 1）0 →（refund）0** | ★7-7 = **不回滚** ✅ |

---

## §6 `tsc --noEmit` 与 §5.7 自曝

### 6.1 编译门禁

`node_modules/.bin/tsc --noEmit` ⇒ **退出码 0**（**直接取退出码，不经管道之后**）[已实测]。

### 6.2 `NOT_MEASURED`（**未测项，禁当 0 / 空使用**）

| # | 未测项 | 为何未测 | 本报告如何标注 |
|---|---|---|---|
| 1 | **`details.reason` 经「HTTP → neon HTTP 驱动 → 服务层」响应体的取值** | neon HTTP 驱动**不搬运 PG `DETAIL`** ⇒ 服务层响应体里该子字段恒为 `{"detail_unavailable":"driver_did_not_carry_detail"}`（`src/ledger.ts` 的既有标记手法）。**8 例负例**命中（见 §4.4/§4.5 的 DB 层列） | 服务层侧标 **NOT_MEASURED**；**同值已由 `p4z-b3d-03-dbreason.ts` 经 `pg` 直连补测**（`post/db-reason.json`）⇒ DB 层为 `[已实测]`，**两者须分开引用** |
| 2 | **refund 的 `order_pay_missing` 分支**（`status='paid'` 而 `pay_txid IS NULL`） | 该状态组合在 `0015` 的状态机下**不可达**（`buy` 必设 `pay_txid`；`status='paid'` 的行必然有 `pay_txid`）；构造需绕过 `listing_order_status_guard` | **NOT_MEASURED**（`[代码推断]`：该闸在 `0015:687-691`，**已读源码、未跑**） |
| 3 | **并发同键 race**（`listing_order_create_race_lost`，`0015:611-614`） | 需双事务并发压测；本片为功能片 | **NOT_MEASURED** |
| 4 | **`listing` 状态闸 `listing_not_listed`** | 夹具未造非 `listed` 的 listing 下购买（`L_*` 三个均 `listed`） | **NOT_MEASURED**（`[代码推断]`：`0015:571-575`） |
| 5 | **币种状态闸**（`draft/frozen/delisted` 单位下购买） | cid=1（`$`）恒 `listed`；造 draft 单位需另一条夹具链 | **NOT_MEASURED**（`[代码推断]`：`currency_op='settle'` 在账本内落实，`0015:653`） |
| 6 | **`401`（无 token）** 面 | 两条路径**未注册** ⇒ 无 HTTP 面可测（404 先行） | **NOT_MEASURED**（非 0、非空） |

### 6.3 探针自曝

1. `scripts/p4z-b3d-00-probe.ts` **首版引用了不存在的列** `public.currency.supply` ⇒ 实跑报 `column "supply" does not exist`（**未生成任何产物**；删列后重跑成功）。
2. **越界目录自曝**：`p4z-b3d-01-snapshot.ts` 的 `post2` 标签**首次**被误写入 `backend-ts/.p4z-tmp-post2/`（**在允许写面之外**）⇒ **已 `rm -rf` 删除**，并以 run-tagged 路径 `.p4-artifacts/b3d-20260930T023156/`（标签 `post2`）重跑；本报告引用的一律是 run-tagged 产物。**登记为口径缺陷**（该次误写的读数与 run-tagged 版逐位相同，但**已弃用**）。
3. **夹具转移与业务分录必须分开看**：`fundFromResidual` 给卖方/买方各供资 5000 ⇒ 供资方 `970001` **−10000**、`kind='transfer'` **+4 腿**。它与 P2/P4 的 6 条分录**同在一次前后快照里** ⇒ 任何「Δ = 10」的读数都必须按 §5③ 的枚举等式拆分（本报告已拆）。
4. 本片**未**触发任何 `migrations` 变更、**未**改 kind 集合/白名单、**未**执行 `npm install`、**未**执行 `git add/commit/push`、**未**用 `execute_code`、**未**用 `pkill`/`killall`（重启只走面板 `{sid}` 路由，且重启后先等 `/health` 200 ⇒ **2219 ms** 达成）。

### 6.4 待裁 / 待收口项（交付 Zang）

| # | 项 | 本片取值 | 需要谁的一句话 |
|---|---|---|---|
| 1 | **★7-7 退款是否回滚 `listing.stock`** | **不回滚**（`REFUND_ROLLS_BACK_STOCK = false`，`src/listing-funds-service.ts:55`） | **Kevin**（改「回滚」需新迁移，或在 `listingPostEvent` 同事务补 `UPDATE`） |
| 2 | **退款发起人**（spec §4.2 P4 **未定义 actor**） | **仅卖方**（`REFUND_ACTOR_IS_SELLER_ONLY = true`，`:62`） | **Zang**（是否放行买方 / 管理员） |
| 3 | **spec §1.8 登记**（两条路径） | 本片**无权写 spec**（`docs/**` 只读）⇒ 已按 §1.2 的格式写好待抄两行 | **Jing**（v0.6 补 §1.8 第 9/10 条） |
| 4 | **404 兜底未对齐 `R107`**（两条路径实测裸文案） | 本片未注册 ⇒ 零变化 | 批 4 收口 |
| 5 | **★ spec §4.2 的 `LDxxx` 编号与 DB 实抛 SQLSTATE 有偏差**（本片实测）：spec §4.2 P2/P4 写 `404 LD023` + `listing_not_found` / `order_not_found`；**DB 实抛 `LD022 = LEDGER_REF_NOT_FOUND`**（`src/ledger.ts:1051`），而 **`LD023` 实为 `LEDGER_UNKNOWN_KIND`**（`ledger.ts:1052`）⇒ spec 该处编号疑误（另 §4.4-6「平台/保留 uid 前置闸 ⇒ `400 LD022`」亦与 `LD022=REF_NOT_FOUND` 不自洽）。**其余逐条对齐**：`409 LD001 listing_stock_insufficient` ✅、`400 LD019 self_purchase_not_allowed` ✅（code = `LEDGER_SELF_TRANSFER`）、`409 LD011 order_not_refundable` ✅、`400 LD004/LD005`（缺键/坏前缀）✅。**HTTP 码与 `details.reason` 两侧逐条一致，仅 `LDxxx` 编号不对** | 无需改码（**实现跟随 DB 真源**，spec 侧编号待订正） | **Jing/Zang**（spec 侧订正；本片无权写 spec） |

### 6.5 声明

- 本片**只写**：`backend-ts/src/listing-funds-service.ts`（新增）、`backend-ts/src/database.ts`（+68/−0）、`docs/audit/p4-b3d-listing-funds.md`、`backend-ts/scripts/p4z-b3d-0{0,1,2,3}-*.ts`、`backend-ts/.p4-artifacts/b3d-20260930T023156/**`。
- **未改**：`migrations/**`、`src/ledger.ts`、`src/ledger-errors.ts`、`src/commission.ts`、`frontend/**`、`.env.local`、任何 spec、`docs/seafood.master-plan.md`、其它既有脚本/artifact；**未**改 kind 集合/白名单；**未**删数据（无删除型 SQL）；**未** `git add/commit/push`。
- 本报告凡写「实测」处均可 `grep` 到支撑读数（锚点 = 上列 run-tagged 产物的字段路径）；`[代码推断]` 与 `NOT_MEASURED` 已逐项显式标注，**未**把代码推断写成实测。
- **端点注册点：53 → 53（显式报数，变化 = 0）**。
