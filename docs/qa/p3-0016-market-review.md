# P3 交易所柱 `0016_market.sql` —— **独立质检报告（Neng）**

> **被检件（现取）**：`backend-ts/migrations/0016_market.sql` = **1201 行 / 70570 B / sha256 `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df`**（质检开始与结束两次现取，同值）
> **上游报告**：`docs/audit/p3-market-0016.md`（273 行）—— 本报告**不复用**其夹具与读数；凡引用其叙述处均**另行现取**核对。
> **库**：Neon（PG 18.6）· 驱动 `@neondatabase/serverless` + `ws`（`neonConfig.webSocketConstructor`）· node v18.19.0 · 所有 SQL 显式限定 `public.`（DL151）
> **本单命名空间（自造，独立于 Kong 的 `9905xx` / `cli:kong16-`）**：uid **`990601`–`990604`** · `create_key` 前缀 **`cli:neng16-`** · 事件根键 **`cli:neng16-*` / `biz:market:{trade,cancel}:<本单 order_id>` / `ops:neng16-*`**
> **读数落盘**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3-0016-review/`（run-tagged；`run-NN-*.json` + 探针 `.js` + `migrate-rerun.log`）；本报告为唯一仓内产物。
> **口径纪律**：未实测字段一律 `null` / `NOT_MEASURED`，**不填 0 / 空数组占位**。

---

## 0. VERDICT

# **可用**（verdict = 可用）

**理由（逐条对应下方判定表）**：

1. **契约零偏差**：§6.4 的三张对象逐列/逐约束/逐索引/逐触发器与库内现取**完全一致**（`market_order` **13 列**、`market_trade` **10 列**、`candle_view` **8 列**且**是 VIEW 非基表**；`CHECK (amount_filled <= amount)` 为 §6.4 注释逐字；索引**恰 3**、部分唯一索引 **0**；7 触发器全 `tgenabled='O'`、全库非 `O` = **0**；指向 `ledger_entry` 的 FK（自本柱任何表）= **0**）。
2. **行为面全绿**：状态机 16 格正/负全集与白名单逐格相符（含终态后再迁移全拒）；守卫矩阵 **12 拒 + 2 对照通过 + 1 边界记录**；余额不足 = **零副作用**；守恒 **41/41 事件 Σ(delta+frozen_delta)=0**；`cid=1` 收工不变量 **8400 == 8400** 未破。
3. **上游 12 条 `NOT_MEASURED` 的头号条（真并发）本单补测**：两买单抢同一卖单 ⇒ **不超卖**（txB 被 `LD001/market_order_amount_insufficient` 拒，`Σ成交 4 ≤ amount 5`，并抓到 `wait_event_type=Lock / wait_event=transactionid` 阻塞证据）；同币对两笔并发 ⇒ **无 `40P01` 死锁**；同键并发 ⇒ **恰一次**（第二次 `idempotent_replay=true`、同 `trade_id`/同 `txid`）。
4. **判负自证 7/7**：把 `market_order_status_transition_ok` 的终态 `ELSE false` 改 `ELSE true` ⇒ 尺子**响**（对 `filled` 单的直接 UPDATE 由「拒」变 `rowCount=1`，函数路拒因由 `MARKET_ORDER_STATE_INVALID` 变为 `market_order_nothing_to_release`）；同事务 `ROLLBACK` 后函数 md5 与目标单**逐位复原**；scratch 副本 sha256 三段证据齐；**主工作区文件零改动**。
5. **迁移/冻结面**：自跑 `migrate.ts` ⇒ **16/16 `skipped`、`applied=0`、`failed=0`、exit 0**；registry `0016.checksum` == 文件 sha256；`git status --porcelain` **全空**（`0001`–`0016`、`backend-ts/src/`、`frontend/`、`docs/*.spec.md`、`master-plan`、`docs/qa/p3-0015-listing-review.md` 零改动）；`ledger_post_event` **51429 B / md5 `d94dd902697dfe60aba409d808c6d63a`** 未变（DL142）。

**登记但**不阻塞**「可用」的两项条件（须由上游在 `docs/audit/**` 就地更正；均为**叙述/测试覆盖**问题，非迁移代码问题）**：

- **C1（必改文档）**：上游 §6 的用例 `trade_taker_not_a_party` **名不符实**。现取上游源码 `backend-ts/scripts/p3m-02-cases.ts`：**L209** 该用例把 `taker_order_id` 设为 `sellId`（**本身即当事方**），真正被拒的是 `sell_order_id = String(SpareIds.spareId)` 而 **L387** `SpareIds = { spareId: '0' }`（**硬编码 `'0'`，全文件从未被赋值**）⇒ 命中的是函数 **L692**「buy/sell 小于 1」闸，**函数 L697–701 的 `TAKER_NOT_A_PARTY` 闸从未被任何上游用例触达**。本单用**三个真实有效挂单**（A 买 / B 卖 / C 第三方）补测并**通过**（见 §2）。⇒ 上游 §6/§11 关于「已覆盖 `TAKER_NOT_A_PARTY`」的表述**须更正**。
- **C2（建议登记为已知边界）**：`market_order.amount_filled` 的**单调增**守卫**无法分辨**「经 `market_post_event` 的成交推进」与「绕过编排函数的裸 `UPDATE`」。本单（题面授权的守卫矩阵）对 order 38 裸 `UPDATE amount_filled=2` 后，业务表剩余额 **30** 与账户 `frozen` **50** 出现 **20** 的**对账缺口**；**排除该单后 DL68 判据 5 逐 uid 精确相等（390 == 390）**。属 DL143「编排函数是唯一写者」的**护栏边界**，非缺陷，但**须登记**（详见 §7 缺口 2）。

---

## 1. 读数索引（scratch，run-tagged）

| run | 标签 | 覆盖 |
|---|---|---|
| `run-01-contract-20260928T105440Z.json` | 契约 | 列/约束/索引/触发器/视图/FK/函数指纹/不变量/残留盘点 |
| `run-02-recon-20260928T105518Z.json` | 侦察 | `ledger_entry` 自引用 FK 定位、$ 持有人分布、`transfer` 入参契约 |
| `run-03a-opcontract-*.json` | 契约 | `ledger_post_event` 的 `ref_type` 白名单与必填闸 |
| `run-04-main-20260928T105729Z.json` | 行为 | 夹具 + **定向项三形态** + 真成交 + 状态机 16 格 + 守卫矩阵 + 余额不足 + 守恒 + 视图对拍 |
| `run-05-reconcile-20260928T105956Z.json` | 对账 | 命名空间锚定、fee 形态、平台白名单、冻结对账（**本趟发现自己按 txid 分组是错的**，见 §6 注） |
| `run-06b-concurrency-20260928T110526Z.json` / `…T110636Z.json` | 并发 | **两趟夹具失败**（前者探针格式化缺陷、后者 990603 余额不足）⇒ 无行为结论 |
| `run-06b-concurrency-20260928T110816Z.json` | 并发 | **T1/T2/T3 全部有效读数** |
| `run-07-reconcile2-20260928T110738Z.json` | 对账 | **按 `event_root_key` 重分组**的守恒 + 判据 5 逐 uid |
| `run-08-falsify-20260928T110926Z.json` | 判负 | GREEN→RED→ROLLBACK→GREEN + scratch 副本 sha256 + `foreign_rows_present` |
| `run-09-notmeasured-20260928T111120Z.json` | 边界 | **FATAL**（Neon TLS `socket disconnected`，且 990601 余额不足）⇒ 无结论 |
| `run-09b-notmeasured-20260928T111208Z.json` | 边界 | 费用承担方/价格闸/quote 闸/未 listed/未知 side/平台 uid/护栏旁路/收工盘点 |
| `migrate-rerun.log` | 迁移 | `16/16 skipped`、exit 0 |
| `pristine-0016_market.sql` / `broken-0016_market.sql` | 判负 | scratch 副本三段 sha256 |

**探针脚本**：`lib.js`、`probe-01-contract.js`、`probe-02-recon.js`、`probe-03a-opcontract.js`、`probe-04-main.js`、`probe-05-reconcile.js`、`probe-06b-concurrency.js`、`probe-07-reconcile2.js`、`probe-08-falsify.js`、`probe-09b-notmeasured.js`

---

## 2. ★ 定向项：`TAKER_NOT_A_PARTY` 闸的可达性（三形态对拍）

**夹具（本单自造，非复用）**：uid `990601`(A)/`990602`(B)/`990603`(C)/`990604`(D)；base=`cid 170`、quote=`cid 1`；
`order 35 = A 买单(990601, buy, price 10, amount 5)` / `order 36 = B 卖单(990602, sell, 10, 5)` / `order 37 = C 买单(990603, buy, 10, 5)`；
三单创建后 `status='open'`、`amount_filled=0` 且**均存在**（现取）。

| 形态 | 入参（现取） | 期望 | **实测（逐字）** | 命中闸 | 判定 |
|---|---|---|---|---|---|
| **FORM-1 真第三方**（本单补测的核心） | `taker_order_id=37`(C) / `buy_order_id=35`(A) / `sell_order_id=36`(B) / price 10 / amount 2 / fee 0 / fill_no 1 | 拒 `TAKER_NOT_A_PARTY` | **`LD016` / `LEDGER_AMOUNT_INVALID`**；detail `{"field":"taker_order_id","value":"37","reason":"TAKER_NOT_A_PARTY"}` | **函数 L697–701** | ✅ **闸可达且正确拒绝** |
| **FORM-2 `sell_order_id='0'`**（上游实际形态） | `taker_order_id=35` / `buy_order_id=35` / **`sell_order_id='0'`** / price 10 / amount 2 / fee 0 / fill_no 1 | 拒（`order_not_found` 族） | **`LD022` / `LEDGER_REF_NOT_FOUND`**；detail `{"field":"buy_order_id","value":"35","reason":"order_not_found","sell_order_id":"0"}` | **函数 L692**（buy/sell < 1） | ✅ 读数与上游 artifact **逐字相符** ⇒ 反证上游用例打的是这一族 |
| **FORM-3 `taker_order_id='0'`**（上游**标签暗示**的形态） | **`taker_order_id='0'`** / buy=35 / sell=36（两单均有效） | 拒 | **`LD016` / `LEDGER_AMOUNT_INVALID`**；detail `{"field":"taker_order_id","value":"0","reason":"TAKER_NOT_A_PARTY"}` | 函数 L697–701 | ⚠️ **仅作对照列出**：它虽也命中同一闸，但「第三方」是字面量 `'0'` —— **题面明令不得以此为定向项证据**，本单**不以它作判据** |

**零副作用（三形态合计）**：`market_order 30→30`、`market_trade 8→8`、`ledger_entry 2625→2625`（**三形态均被拒于写入之前**）。

**溯源（现取上游源码）**：
- `p3m-02-cases.ts` **L208–209**：`{ op:'trade', taker_order_id: sellId, buy_order_id: buyId, sell_order_id: String(SpareIds.spareId), … }` ⇒ **taker 本身是当事方**；
- `p3m-02-cases.ts` **L387**：`const SpareIds: { spareId: string } = { spareId: '0' };` ⇒ 全程**未被赋值**。

⇒ **结论**：上游 `trade_taker_not_a_party` 既未构造第三方，也未触达 `TAKER_NOT_A_PARTY` 闸；**该闸在质检前处于「零用例触达」状态**，本单 FORM-1 已把它补成**实测可达且拒绝正确**。

---

## 3. 契约对拍（§6.4 + DL64–69 / DL74–80）

### 3.1 逐列（`information_schema.columns` 现取，序/名/类型/default/identity 逐项）

**`public.market_order` —— 13 列（实测 13）**

| # | 列名 | 类型 | NOT NULL | default / identity | §6.4 |
|---|---|---|---|---|---|
| 1 | `order_id` | bigint | ✅ | **identity `BY DEFAULT`** | `order_id PK` ✅ |
| 2 | `owner_uid` | bigint | ✅ | — | `owner_uid FK users` ✅ |
| 3 | `side` | text | ✅ | — | `side` ✅ |
| 4 | `base_cid` | bigint | ✅ | — | `base_cid FK currency` ✅ |
| 5 | `quote_cid` | bigint | ✅ | — | `quote_cid FK currency` ✅ |
| 6 | `price` | bigint | ✅ | — | `price bigint >0` ✅ |
| 7 | `amount` | bigint | ✅ | — | `amount bigint >0` ✅ |
| 8 | `amount_filled` | bigint | ✅ | `0` | `amount_filled bigint >=0` ✅ |
| 9 | `status` | text | ✅ | `'open'::text` | `status` ✅ |
| 10 | `create_key` | text | ✅ | — | `create_key text NOT NULL UNIQUE` ✅ |
| 11 | `ledger_event_keys` | `text[]` | ✅ | `'{}'::text[]` | 同 ✅ |
| 12 | `time_created` | timestamptz | ✅ | `now()` | ✅ |
| 13 | `time_updated` | timestamptz | ✅ | `now()` | ✅ |

**`public.market_trade` —— 10 列（实测 10）**：`trade_id` bigint identity PK｜`base_cid`｜`quote_cid`｜`price`｜`amount`｜`buy_order_id`｜`sell_order_id`｜`taker_uid`｜`fee` bigint NOT NULL DEFAULT `0`｜`time_created` timestamptz NOT NULL DEFAULT `now()` —— **序/名/类型/default 与 §6.4 逐字一致**。
**§6.4 反面断言成立**：`market_trade` **无** `create_key` / `ledger_event_keys` / `time_updated`（`information_schema` 现取缺席）；`market_*` 内**无任何 `*txid` 列**。

**`public.candle_view` —— 8 列（实测 8）**：`base_cid` bigint / `quote_cid` bigint / `bucket_start` **timestamptz** / `open` bigint / `high` bigint / `low` bigint / `close` bigint / `volume` **numeric**。
**「视图非基表」成立**：`information_schema.tables` 中 `public` 视图清单 = `["candle_view"]`；`table_type='BASE TABLE'` 命中 `candle_view` 的行数 = **0**（DL66 / C9）。

### 3.2 约束（`pg_get_constraintdef` 现取）

- `market_order`：`market_order_pk` PK(order_id)｜`market_order_create_key_uniq` UNIQUE(create_key)｜CHECK `side = ANY('buy','sell')`｜CHECK **`quote_cid = 1`**｜CHECK `base_cid <> quote_cid`｜CHECK `price > 0`｜CHECK `amount > 0`｜CHECK `amount_filled >= 0`｜**CHECK `amount_filled <= amount`（§6.4 注释逐字）**｜CHECK `status = ANY('open','partial','filled','cancelled')`｜FK `owner_uid→users(uid)`、`base_cid→currency(cid)`、`quote_cid→currency(cid)`｜13× `NOT NULL`（PG18 具名 `*_not_null`）。
- `market_trade`：PK｜CHECK `price > 0`｜CHECK `amount > 0`｜CHECK `fee >= 0`｜CHECK `base_cid <> quote_cid`｜CHECK `buy_order_id <> sell_order_id`｜FK ×5：`base_cid`/`quote_cid`→`currency(cid)`、`buy_order_id`/`sell_order_id`→`market_order(order_id)`、`taker_uid`→`users(uid)`｜10× `NOT NULL`。

### 3.3 索引 / 部分唯一索引（DL74）

| 项 | 期望 | 实测 | 判定 |
|---|---|---|---|
| 索引总数 | **恰 3** | **3**：`market_order_pk`、`market_order_create_key_uniq`、`market_trade_pk`（`pg_indexes` 全 `indexdef` 现取） | ✅ |
| 部分唯一索引 | **0** | `pg_index` 现取 `indisunique AND indpred IS NOT NULL` 命中 **0 行** | ✅ |

**依据**：§6.4 **未列索引清单**（对照 §6.3 的 DL63 明列 4 个）⇒ 依 **DL74**「业务表索引按 §6 各表的清单执行，新增须说明」⇒ **不擅自增**，只建约束自带索引。**判定 = 「无」而非「遗漏」**（与上游同结论，本单**独立复核**）。

### 3.4 触发器（`pg_trigger` 含 `tgenabled` 现取）

| 表 | 触发器 | 事件 | `tgenabled` |
|---|---|---|---|
| `market_order` | `trg_market_order_amount_filled_guard` | BEFORE UPDATE FOR EACH ROW | `O` |
| `market_order` | `trg_market_order_core_immutable_guard` | BEFORE UPDATE | `O` |
| `market_order` | `trg_market_order_create_key_guard` | BEFORE UPDATE | `O` |
| `market_order` | `trg_market_order_status_guard` | BEFORE UPDATE | `O` |
| `market_order` | `trg_market_order_touch_time_updated` | BEFORE UPDATE | `O` |
| `market_order` | `trg_market_order_no_delete` | BEFORE DELETE | `O` |
| `market_trade` | `trg_market_trade_append_only` | **BEFORE UPDATE OR DELETE** | `O` |

**7/7 = `O`**；**全库 `tgenabled <> 'O'` 的非内部触发器 = 0**（现取）。✅

### 3.5 FK 方向（R21 / DL78）

- 自 `market_order` / `market_trade` 出发的 FK **共 8**：→ `users` ×2、→ `currency` ×4、→ `market_order` ×2。**指向 `ledger_entry` 的 = 0** ✅。
- **一处须澄清（上游 §2.4「→ `ledger_entry` = 0」表述不精确）**：按「以 `ledger_entry` 为被引用表」计，全库现取 **1** 条 —— `ledger_entry_reversal_of_txid_fkey`：`FOREIGN KEY (reversal_of_txid) REFERENCES ledger_entry(txid)`。它是 **`ledger_entry` 自身的自引用 FK**（`0001`–`0012` 期的既有对象，**非 `0016` 引入**）⇒ **本柱的结论不变**：**本柱任何表都不引用 `ledger_entry`**。建议上游把该句改为「自本柱各表出发、以 `ledger_entry` 为目标的 FK = 0（全库唯一的反向引用是 `ledger_entry` 的既有自引用 FK）」。

### 3.6 函数指纹（现取）

| 函数 | 字节 / md5 | 判定 |
|---|---|---|
| `market_post_event(jsonb)` | **30194 B / `74841611252726e1cc0f57cb46ea6c6d`** | ✅ 与上游同值 |
| `market_order_status_transition_ok(text,text)` | 223 B / `545518bcd9f0379119a944b5eefc370f` | ✅ |
| `market_order_status_guard()` | 474 B / `3d14452a75bafc683c71bb892bcc717f` | ✅ |
| `market_trade_append_only()` | 256 B / `9090b9683a4f31080edc75cdfbd87066` | ✅ |
| 其余 5 个守卫 | `amount_filled` `3d5d9f7cec1ebee3615630e5109e0f83` / `core_immutable` `7fb4b66858e754c2497dd7234aaa4b85` / `create_key` `369e40a0d2211b33cf51c6f9cd49180b` / `no_delete` `fdea82c4946cd0a319703704c7a4b41a` / `touch_time_updated` `02cd283c681f3259449b59141b5af903` | 现取 |
| `ledger_post_event(jsonb)` | **51429 B / `d94dd902697dfe60aba409d808c6d63a`**（DL142） | ✅ **未变** |

`public` 函数总数 = **71**（= 上游读数）。

---

## 4. 状态机正/负全集（含终态后再迁移）

**纯函数 16 格全量**（`SELECT public.market_order_status_transition_ok(from,to)`，现取）：

| from \ to | open | partial | filled | cancelled |
|---|---|---|---|---|
| **open** | **F** | **T** | **T** | **T** |
| **partial** | **F** | **F** | **T** | **T** |
| **filled** | F | F | **F** | **F** |
| **cancelled** | F | F | F | **F** |

⇒ 与 `open→{partial,filled,cancelled}` / `partial→{filled,cancelled}` / `filled`、`cancelled` 无出边**逐格相符**；负集（`*→自身` 4 格、`filled→cancelled`、`cancelled→*` 3 格）**全 F**。✅

**表级（经守卫触发器，现取）**：

| 动作 | 读数 | 判定 |
|---|---|---|
| `market_post_event(op='cancel')` on **filled** 单 35 | `LD011` / `LEDGER_CURRENCY_INVALID_TRANSITION` / `reason=MARKET_ORDER_STATE_INVALID` / `from=filled, to=cancelled, order_id=35` | ✅ 拒 |
| 同上 on **filled** 单 36 | 同形态（`order_id=36`） | ✅ 拒 |
| 直接 `UPDATE status='cancelled'` on filled 单 35（**绕过编排函数**） | `LD011` / `MARKET_ORDER_STATE_INVALID` | ✅ 拒（**双路同判据**） |
| `op='cancel'` on 单 37（open→cancelled） | ✅ 成功，`status=cancelled`、`hold_release ×2`、Σ=0 | ✅ 正路可通 |
| 直接 `UPDATE status='open'` on **cancelled** 单 37 | `LD011` / `MARKET_ORDER_STATE_INVALID` | ✅ 拒 |
| 直接 `UPDATE status='filled'` on **cancelled** 单 37 | `LD011` / `MARKET_ORDER_STATE_INVALID` | ✅ 拒 |
| **边界**：直接 `UPDATE status='open'` on **open** 单 38（同状态） | **不拒，`rowCount=1`** | ⚠️ **记录**：纯函数 `open→open = F`，但表级守卫用 `IS DISTINCT FROM` ⇒ **同值 UPDATE 视为无转移、不抛错**。语义上无转移发生，**判定为可接受，但登记为边界** |

---

## 5. 守卫矩阵（12 拒 + 2 对照 + 1 边界）

**命中对象**：`order 38`（uid 990604，open，price 10，amount 5，`amount_filled=1`）；`trade_id=9`（`market_trade`）。

| 目标 | 动作 | 期望 | **实测** | 判定 |
|---|---|---|---|---|
| `owner_uid` | UPDATE | 拒 | `LD011` / `reason=market_order_core_immutable` / `field=market_order.core_fields` | ✅ |
| `side` | UPDATE | 拒 | 同上 | ✅ |
| `base_cid` | UPDATE | 拒 | 同上 | ✅ |
| `quote_cid` | UPDATE | 拒 | 同上 | ✅ |
| `price` | UPDATE | 拒 | 同上 | ✅ |
| `amount` | UPDATE | 拒 | 同上 | ✅ |
| `create_key` | UPDATE | 拒 | `LD011` / `reason=market_order_create_key_immutable` / `field=market_order.create_key` | ✅ |
| `amount_filled` | 回退 `1→0` | 拒 | `LD011` / `reason=market_order_amount_filled_monotonic` / `field=market_order.amount_filled` | ✅ |
| `amount_filled` | 超额 `=99`（> amount 5） | **`23514`** | **`23514`** / `violates check constraint "market_order_filled_le_amount"`（`Failing row contains (38,…,99,partial,…)`） | ✅ |
| `market_order` | **DELETE** | 拒 | `LD011` / `reason=market_order_delete_forbidden` / `field=market_order` | ✅ |
| `market_trade` | **UPDATE** | 拒 | **`LD029`** / `LEDGER_APPEND_ONLY_VIOLATION` / `reason=market_trade_is_append_only` | ✅ |
| `market_trade` | **DELETE** | 拒 | **`LD029`** / 同上 | ✅ |
| **对照 1** | `UPDATE status open→partial`（合法转移） | 通过 | **`rowCount=1`** | ✅ **尺子不滥杀** |
| **对照 2** | `UPDATE amount_filled 1→2`（合法推进） | 通过 | **`rowCount=1`** | ✅ **尺子不滥杀** |

---

## 6. 守恒与平台面

> **本单自纠（记录）**：`run-05` 我误按 `txid` 分组求 Σ，得出「每 txid 非零」的错误外观；**现取证明本库 `ledger_entry.txid` 是「逐分录序号」而非「事件号」**（例：`biz:market:trade:35:1` 的 4 条分录 txid = 5937/5938/5939/5940）。`run-07` 改按 **`event_root_key`** 分组后，不变量成立。**此处登记以防误读。**

- **事件级守恒**：本单命名空间（`cli:neng16-*` / `biz:market:{trade,cancel}:<本单 order_id>` / `ops:neng16-*`，锚定 `ref_type/ref_id` 而非字符串）**41 个事件全部 `Σ(delta+frozen_delta) = 0`**，非零集合 = **`[]`**。
  - 例：`cli:neng16-A`（`hold` n=2，Σ=-50+50=0）；`biz:market:trade:36:2`（`trade,trade_fee` n=6，Σ=33+-33=0）；`biz:market:cancel:37`（`hold_release` n=2，Σ=50-50=0）；`ops:neng16-fund-*`（`transfer` n=2，Σ=0）。
  - **kind 白名单**：`op='order'`→`[hold]`；`op='cancel'`→`[hold_release]`；`op='trade'`→`[trade,trade_fee]`（`fee=0` 时 `[trade]`）。
- **成交量 vs `frozen_delta`**：`trade 9`（amount 2, price 10）⇒ 买方 quote `frozen_delta = -20`（= −amount×price）、卖方 base `frozen_delta = -2`（= −amount）；`trade 10`（amount 3）⇒ **-30 / -3**。逐笔相符。✅
- **`fee` 形态（R47 / DL85）**：
  - `fee=0`（trade 9）⇒ **4 条**（`[trade]`）；`fee=1`（trade 10）⇒ **6 条**（`[trade,trade_fee]`）。
  - trade 10 的 fee 分录：**taker 990602 `delta=-1` / `cid=1`** 与 **uid `-1` `delta=+1` / `cid=1`**；`fee_payer == taker_uid` 现取相符。
  - **taker = 买方**（本单补测，`run-09b` trade 23，fee=2）：`990601` cid1 `delta=-2`（`trade_fee`）+ `frozen_delta=-10`（`trade`）、`990601` cid170 `delta=+1`、`990602` cid170 `frozen_delta=-1`、`990602` cid1 `delta=+10`、`-1` `delta=+2` ⇒ **买方总付出 10+2=12 = 卖方得 10 + 平台得 2**，`Σ=0`。✅
- **平台账户白名单**：本单命名空间内 `uid <= 0` 的分录**只有 `uid = -1`**（`kind='trade_fee'`，Σ=+2/+1）；`uid ∈ {0,-2,-3}` 在本单 = **0 行**。✅
- **`cid=1` 收工不变量**：`Σ(balance+frozen)` = **8400** == `currency.total_supply` = **8400**（质检前 / 每轮后 / 收工**同值**）。`cid=170` 亦 `50000000 == 50000000`。✅
- **余额不足 = 零副作用**（`op='order'`，uid 990604，freeze 100000 > available 150）：`LD001` / `LEDGER_INSUFFICIENT_BALANCE` / detail `{cid:"1", uid:"990604", required:"100000", available:"150"}`；拒后 `market_order` 行数 **+0**、`ledger_entry` **+0**、`create_key='cli:neng16-Zpoor'` 行数 **0**、四个 uid 的 `account` 快照**逐字节不变**。✅
- **DL68 判据 5（挂单部分）逐 uid 对账**：`990601` 期望 **220** = `frozen` **220**；`990602` 卖侧 期望 **26** = cid170 `frozen` **26**；`990603` 期望 **170** = **170**；`990604` 期望 30 vs 实测 **50** ← **本单守卫矩阵的裸 UPDATE 所致**；**排除 990604 后 `390 == 390` 精确相等**。✅（缺口语义见 §0-C2）

---

## 7. ★ 真并发（上游 `NOT_MEASURED` 头号条）

**并发布局**：3 条独立 WS 连接（`c1`=tx-A、`c2`=tx-B、`c0`=只读/控制）；**显式 `BEGIN`**；第一笔调用 **`await`**（取得 `market_order` 行锁），第二笔**不 await 先行发出**，固定延时后 **COMMIT tx-A**，再 await 第二笔。逐笔 20 s 硬超时护栏。

| 子项 | 构造 | **头号读数（现取）** | 判定 |
|---|---|---|---|
| **T1 不超卖**：两不同买单抢**同一卖单**剩余 | 卖单 `S1=order 67`（amount 5）；买单 `B1=68`、`B2=69`；两笔各求 `amount=4` | txA：**成功** `trade_id=19` amount 4 ⇒ `S1.partial, amount_filled=4`；**阻塞证据**：`pg_stat_activity` `pid=5929, wait_event_type=Lock, wait_event=transactionid, state=active`；txB（A 提交后）：**`LD001` / `LEDGER_INSUFFICIENT_BALANCE` / `reason=market_order_amount_insufficient` / `side=sell` / `order_id=67` / `required=4` / `available=1`** ⇒ **拒**。`market_trade` on S1 = **1 行 / Σamount 4 ≤ 5**。`B2` 保持 `open, amount_filled=0` | ✅ **不超卖**（`oversell=false`） |
| **T2 同币对并发**：`(base_cid,quote_cid)=(170,1)` 两笔**同时**发 | 订单对 `B3/S3` 与 `B4/S4`（**彼此不相交**） | 两笔**同时 in-flight 3202 ms** 后**双双成功**（`trade_id=21 / 20`）；**`40P01` 死锁 = false**；期间观测到 **1 个 `Lock` 等待** —— 归因于**两笔共享交易对手账户行**（`990602` 的 cid `1` 与 `170` 同时参与两笔），即**账户行锁**（非订单行锁、非币对锁）造成的串行化 | ✅ 无死锁；**但币对级仍是多写者**（见下） |
| **T3 同键并发恰一次**：两连接发**完全相同**的 `op='trade'`（`taker_order_id=B5` + `fill_no=1` ⇒ 同键 `biz:market:trade:<B5>:1`） | `S5/B5` | 第一次 `created=true`（`trade_id=22, txid=6057`）；第二次 **`idempotent_replay=true`、`trade_id=22`（同）、`txid=6057`（同）、`created=false`**；`market_trade` on B5 **0 → 1**；期间观测到 1 个 `Lock` 等待；两单终态 `filled, amount_filled=3` | ✅ **恰一次**（`exactly_once=true`） |

**全局不超卖复核**：本单全部卖单 `traded ≤ amount` —— `67: 4/5`、`70: 3/3`、`72: 2/2`、`74: 3/3`。`cid=1` 收工 **8400 == 8400**。

### 7.1 `DL68` 缺位的影响面（如实登记）

- **缺位事实**：函数 `market_post_event` 的 `op='trade'` 分支**只做** `FOR UPDATE … ORDER BY o.order_id`（**按主键升序**锁两张挂单行，`DL141` 全序第 1 段，源码 L733–738）；**全迁移内不存在** `pg_advisory_xact_lock` 或任何币对级串行化对象。与 Zang 的口径一致（属撮合服务/路由层运行时手段，**不阻塞本柱**）。
- **影响面 1（已实测，安全）**：两笔成交**共享任一张挂单行** ⇒ 在 DB 层被行锁**串行化**，第二笔在拿到锁后**重读** `amount_filled` ⇒ **不可能超卖**（T1）。这是「无 advisory lock 也不超卖」的**真正原因**。
- **影响面 2（已实测，风险面）**：同一币对、**订单互不相交**的两笔成交**完全并发**（T2 双双成功）⇒ **DB 不提供币对级单写者保证**。就本柱的记账不变量而言无碍（每笔的守恒是局部的）；风险落在**调用方**：外部撮合决策若基于**无锁快照**算出，两笔决策可能同时「认领」同一挂单 —— 此时 DB 层会把后到者**拒绝**（`market_order_amount_insufficient`，如 T1），即**退化为拒绝而非超卖**。⇒ `DL68` 的 advisory lock 主要保障**吞吐/公平性与决策新鲜度**，在本柱口径下**不是资金安全漏洞**。
- **影响面 3（已实测）**：**共享交易对手账户**的两笔并发会被**账户行锁**串行化（T2 的 1 次 Lock 等待）。对同一 `(uid,cid)` 反复成交的撮合（现实高频形态）实际是**半串行**的。
- **影响面 4（已实测）**：**未观测到死锁**（两趟并发测试 `40P01` 均为 `false`）。机制：挂单行按**主键升序**固定加锁、账户按记账顺序更新 ⇒ 锁序全局一致，无法形成环。
- **影响面 5（未实测）**：PgBouncer transaction 模式下的会话级 advisory lock 行为（`ledger.spec` §16 #3 的原始疑点）在本柱范围外，**本单未测**。

---

## 8. 判负自证（GREEN → RED → GREEN；尺子必须会响）

**改坏的一处**：`public.market_order_status_transition_ok` 的终态 `ELSE false` ⇒ **`ELSE true`**。**双轨取证**：① 库内**同事务** `CREATE OR REPLACE` 后 `ROLLBACK`；② scratch 副本（仓外）文件级 sha256。

| 相 | 动作 | **读数（现取）** | 判定 |
|---|---|---|---|
| **GREEN（改坏前）** | 对 **filled** 单 35 直接 `UPDATE status='cancelled'` | **拒**：`LD011` / `reason=MARKET_ORDER_STATE_INVALID` / `from=filled,to=cancelled` | ✅ |
| | `market_post_event(op='cancel', order_id=35)` | **拒**：`LD011` / `MARKET_ORDER_STATE_INVALID` | ✅ |
| **RED（坏版装入，同事务内）** | 装入后函数 md5 = **`53c55392b89c09fb563e55459d9af133`**；纯函数 `('filled','cancelled')` = **`true`** | — | 坏版生效 |
| | 同一条直接 `UPDATE` | **不拒**：`rowCount=1`，事务内该单 `status` 变 **`cancelled`** | ✅ **尺子响** |
| | 同一条 `op='cancel'` | 拒因**变为** `market_order_nothing_to_release`（`field=market_order.amount_filled`）⇒ **不再是** `MARKET_ORDER_STATE_INVALID` | ✅ **尺子响**（K3 型断言必红） |
| **RED 修复自带** | **同事务 `ROLLBACK`** | 函数 md5 回 **`545518bcd9f0379119a944b5eefc370f`**；目标单 35 回 **`filled`**（`amount_filled=5`） | ✅ |
| **GREEN（复原后）** | 再发同两条 | **两路均拒** `LD011` / `MARKET_ORDER_STATE_INVALID`（与改坏前逐字相同） | ✅ **回绿** |
| **scratch 副本 sha256** | `pristine → broken → restored` | **`f5ce7c79c584805f…`（= 工作区）→ `d77742a80719b129…` → `f5ce7c79c584805f…`（= pristine）** | ✅ |
| **主工作区未被碰** | `migrations/0016_market.sql` | 质检首尾 sha256 **`f5ce7c79c584805f…` 相等**（1201 行 / 70570 B 同值） | ✅ |
| **零扰动** | 目标单 / 账本 | order 35 `filled → filled`；`ledger_entry` **2609 → 2609**（该相） | ✅ |
| **冲突行归属** | `foreign_rows_present` | **`{order_rows_not_neng16_nor_kong16: 0, my_order_owners_outside_9906xx: 0, my_trade_takers_outside_9906xx: 0, ledger_rows_ref_market_order_with_null_ref: 0}`** = **全空** | ✅ **未触发「立停上报」** |

**7/7 判定全真**：`green_before_rejects / red_broken_upd_succeeds / red_broken_fn_reason_changed / green_restored_rejects / sha_restored_eq_pristine / workspace_untouched / zero_perturbation`。

---

## 9. 附加边界面（本单补测，闭合部分 `NOT_MEASURED`）

| 边界 | 入参 | **实测** | 判定 |
|---|---|---|---|
| 未知 `op` | — | （上游 K5 覆盖；本单**未复测**） | `NOT_MEASURED` |
| 未知 `side` | `side='hold'` | **`LD016` / `LEDGER_AMOUNT_INVALID` / `reason=UNKNOWN_MARKET_SIDE` / `field=side`** | ✅ |
| `quote_cid ≠ 1` | `quote_cid='2'` | **`LD016` / `reason=QUOTE_CID_MUST_BE_ONE` / `field=quote_cid`**（**先于币种存在性检查**） | ✅ |
| base 未 listed | `base_cid=99`（`status='draft'`，现取） | **`LD008` / `LEDGER_CURRENCY_NOT_LISTED`** | ✅ |
| 平台 uid 作 owner | `owner_uid='-1'` | **`LD021` / `LEDGER_RESERVED_UID` / `reason=PLATFORM_OWNER_FORBIDDEN` / `field=owner_uid`** | ✅ |
| 成交价 ≠ 买单限价 | `price='11'`（买单限价 10） | **`LD016` / `reason=MARKET_PRICE_MUST_EQUAL_BUY_LIMIT` / `field=price`** | ✅ |
| 成交量超剩余 | `amount='99'` | **`LD001` / `reason=market_order_amount_insufficient` / `field=market_order.amount`** | ✅ |
| **护栏旁路 ①：`TRUNCATE`** | `BEGIN; TRUNCATE public.market_trade; … ROLLBACK;` | `market_trade` **19 → 0（`TRUNCATE` 未被拦）** → `ROLLBACK` 后 **19** | ⚠️ **旁路成立，如实登记**（DL65 自述的诚实边界） |
| **护栏旁路 ②：`DISABLE TRIGGER USER`** | `BEGIN; ALTER TABLE public.market_order DISABLE TRIGGER USER; UPDATE … status='cancelled' (filled) … ROLLBACK;` | UPDATE **`rowCount=1`，事务内 `status=cancelled`** → `ROLLBACK` 后 **`filled`** | ⚠️ **旁路成立，如实登记** |

> **两处旁路均按题面授权在事务内试后 `ROLLBACK`**；未对既有表做任何真 `TRUNCATE`/`DROP`；无残留（收工 `market_trade` = 19、单 35 = filled）。

---

## 10. 迁移与冻结面

| 项 | 期望 | **实测** | 判定 |
|---|---|---|---|
| 自跑 `npx ts-node --transpile-only scripts/migrate.ts` | 16/16 `skipped`、exit 0 | **`skipped=16`、`applied=0`、`failed=0`、`ok=true`、exit code `0`**（`actions` 逐条 `0001…0016: skipped`，`nonSkipped=[]`） | ✅ |
| 迁移后 `schema_version` / `public` 基表 | `0016` / 15 | `0016` / **15** | ✅ |
| registry `0016.checksum` == 现文件 sha256 | 相等 | **相等**（`f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df`，两侧现取） | ✅ |
| 文件规模 | — | **1201 行 / 70570 B** | ✅ |
| `0001`–`0015`、`backend-ts/src/`、`frontend/`、`docs/*.spec.md`、`docs/versions/`、`master-plan`、`p3-0015-listing-review.md` | 零改动 | **`git status --porcelain` 全空**（含 `backend-ts/migrations/` 逐条为空）；`git diff --stat` 于上述路径**无输出** | ✅ |
| `ledger_post_event`（DL142） | **51429 B / `d94dd902697dfe60aba409d808c6d63a` 不得变** | **51429 B / `d94dd902697dfe60aba409d808c6d63a`**（首取/末取同值） | ✅ |
| 全库非 `O` 触发器 | 0 | **0** | ✅ |

**注**：`migrate-rerun.log` 中 `views` 字段为 `[]`（`migrate.ts` 的该字段口径），而 `information_schema` 现取的 `public` 视图清单 = `["candle_view"]` ⇒ **以 `information_schema` 为准**；此为 `migrate.ts` 输出字段的**口径差异**，非对象缺失。

---

## 11. 逐项判定表

| # | 项 | 期望 | **实测** | 判定 |
|---|---|---|---|---|
| 1 | ★ 定向项：`TAKER_NOT_A_PARTY` 闸可达性（真第三方） | 拒 `LD016/TAKER_NOT_A_PARTY` | `LD016` / `TAKER_NOT_A_PARTY` / `field=taker_order_id, value=37`；三形态零副作用 | ✅ |
| 2 | 定向项与 `sell_order_id='0'` 形态**对拍不混** | 两形态读数可分辨 | FORM-2 = `LD022/order_not_found/buy_order_id=35`（与上游 artifact 逐字相符）；FORM-1 = `LD016/TAKER_NOT_A_PARTY/taker_order_id=37` | ✅ |
| 3 | §6.4 `market_order` **13 列**逐列 | 名/序/类型/default/identity 全符 | 13/13 相符 | ✅ |
| 4 | §6.4 `market_trade` **10 列**逐列 | 全符 + 无三件套 | 10/10 相符；`create_key/ledger_event_keys/time_updated` 缺席 | ✅ |
| 5 | §6.4 `candle_view` **8 列**且**非基表** | VIEW | 8 列相符；`table_type='BASE TABLE'` 命中 0 | ✅ |
| 6 | CHECK 逐条（含 `amount_filled <= amount` 注释逐字） | 全符 | 全符；`market_order_filled_le_amount CHECK ((amount_filled <= amount))` | ✅ |
| 7 | FK：uid→users / cid→currency / →market_order；**→ledger_entry = 0** | 相符 | 8 条全符；**本柱→`ledger_entry` = 0**（全库唯一反向引用是 `ledger_entry` 既有自引用 FK，已澄清） | ✅ |
| 8 | 索引**恰 3** / 部分唯一索引 **0** | 3 / 0 | **3** / **0**（依 §6.4 + DL74 判定为「无」） | ✅ |
| 9 | 触发器 `tgenabled` 全 `O`、全库非 `O` = 0 | 7 × `O` / 0 | 7 × `O` / **0** | ✅ |
| 10 | 状态机正/负全集 + 终态后再迁移 | 16 格相符 + 终态全拒 | 16 格逐格相符；`filled→cancelled`、`cancelled→*` 双路全拒；同状态 UPDATE 边界已登记 | ✅ |
| 11 | 守卫矩阵 `owner_uid/side/base_cid/quote_cid/price/amount/create_key` 逐个改 | 全拒 | **全拒**（`LD011`，两类 reason） | ✅ |
| 12 | `amount_filled` 回退 ⇒ 拒；超额 ⇒ `23514` | 拒 / 23514 | `LD011/…_monotonic` / **`23514`** | ✅ |
| 13 | `DELETE market_order` 拒；`UPDATE`/`DELETE market_trade` 拒 | 全拒 | `LD011/…_delete_forbidden`；`LD029` ×2 | ✅ |
| 14 | 对照项证明尺子不滥杀 | 通过 | `open→partial` `rowCount=1`；`amount_filled 1→2` `rowCount=1` | ✅ |
| 15 | ★ 真并发 ①：两买单抢同一卖单 ⇒ 不超卖 | `amount_filled ≤ amount`、Σ成交 ≤ amount | `4 ≤ 5`、txB 被拒、Lock 阻塞证据在案 | ✅ |
| 16 | ★ 真并发 ②：同币对并发 ⇒ 阻塞/死锁/超额 | 如实记录 | 双双成功、`40P01=false`、1 次账户行锁等待 | ✅（记为**币对级无串行化**） |
| 17 | ★ 真并发 ③：同 `fill_no` 同键并发 ⇒ 恰一次 | 一次 | `exactly_once=true`、同 `trade_id`/同 `txid` | ✅ |
| 18 | 每事件 `Σ(delta+frozen_delta) = 0` | 0 | **41/41 = 0**，非零集 `[]` | ✅ |
| 19 | 成交量与 `frozen_delta` 对拍 | −amount×price / −amount | trade 9/10/23 逐笔相符 | ✅ |
| 20 | `fee` 形态 `fee + net = gross` 与承担方 | 形态成立 | `fee=0`→4 条；`fee>0`→6 条；两笔（taker=卖 / taker=买）均 `Σ=0`、承担方 = taker | ✅ |
| 21 | 平台账户白名单（`trade_fee` 只入 `-1`；`0/-2/-3` 不得参与） | 是 | 只有 `-1`；`{0,-2,-3}` = 0 行 | ✅ |
| 22 | `cid=1` 收工 `Σ(balance+frozen) == total_supply` | 相等 | **8400 == 8400** | ✅ |
| 23 | 余额不足 = 零副作用 | 无挂单/无分录/无余额变动 | 行数 +0、分录 +0、`account` 快照逐字节不变 | ✅ |
| 24 | `candle_view` 聚合 vs 独立 GROUP BY **逐桶相等** | 相等 | **`view_equals_manual=true`（8/8 桶，JSON 逐字节）**；另给小时桶 rollup 交叉验证 | ✅ |
| 25 | DL68 判据 5 对账 | 逐 uid 相等 | 990601/990602/990603 **精确相等**；990604 缺口 20 = **本单裸 UPDATE 所致**；排除后 `390==390` | ✅（缺口已登记） |
| 26 | 上游 12 条 `NOT_MEASURED` 逐条处置 | 能测则测 | 见 §12（2 条转测、10 条如实 `NOT_MEASURED`） | ✅ |
| 27 | 迁移 rerun 16/16 `skipped`、exit 0 | 是 | 是（`exit 0`） | ✅ |
| 28 | registry checksum == 文件 sha256 | 相等 | 相等 | ✅ |
| 29 | 冻结面零改动（`git`） | 零 | `git status --porcelain` 全空 | ✅ |
| 30 | `ledger_post_event` 指纹不变（DL142） | `51429 B / d94dd902…` | 未变 | ✅ |
| 31 | 判负自证 GREEN→RED→GREEN + 恢复 | 7/7 | 7/7（含 scratch sha256 三段 + 工作区未碰） | ✅ |
| 32 | 冲突行归属 `foreign_rows_present` | `[]` | **全空** | ✅ |
| 33 | 上游用例**名不符实**（定向项发现） | — | **成立**：`TAKER_NOT_A_PARTY` 零用例触达；上游 §6/§11 叙述须更正 | ⚠️ **登记（C1）** |
| 34 | 护栏旁路（`TRUNCATE` / `DISABLE TRIGGER USER`） | 如实记录 | **两处均可旁路**（事务内试后 `ROLLBACK`） | ⚠️ **登记（诚实边界）** |

**失败项 / 拦下项**：**迁移对象零失败**；本单 4 处**探针自身缺陷**（已在 §1 登记，均**不产生行为结论**）：① `probe-04` 首趟 `users_evm_fmt` CHECK（伪造 evm 格式）；② `probe-06`（首版）在 T3 **先 await 两笔并发再提交**，自造死锁（**我的布局缺陷**，已改为「先 await 第一笔→发第二笔→提交第一笔→await 第二笔」）；③ `probe-06b` 首趟结果格式化器在成功分支崩溃；④ `probe-09`/`09b` 首趟 990601 余额耗尽 + 一次 Neon TLS 瞬断。

---

## 12. 上游 12 条 `NOT_MEASURED` 逐条处置

| # | 上游项 | 本单处置 | 读数 / 卡在哪 |
|---|---|---|---|
| 1 | **真并发** | ✅ **已转测** | §7：T1 不超卖 / T2 无死锁 / T3 恰一次，含 `Lock` 阻塞证据 |
| 2 | `DL68` `pg_advisory_xact_lock(hash(币对))` 撮合串行化 | ⛔ **`NOT_MEASURED`（未实现）** | 现取函数体确无该调用；**影响面已实测登记**（§7.1）；PgBouncer 会话级行为未测 |
| 3 | 价差改善（成交价 ≠ 买单限价） | ⛔ `NOT_MEASURED`（**语义**） | 本实现**显式拒绝**：实测 `LD016/MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`（§9）；「若放开」的语义未验证，**需新裁定** |
| 4 | 小时桶 K 线 | ⛔ `NOT_MEASURED` | 视图现取只有**分钟桶**（`date_trunc('minute',…)`）；小时档只能上层 rollup（本单给了 rollup 读数，**不等于**视图支持小时档） |
| 5 | 护栏旁路 `TRUNCATE` / `DISABLE TRIGGER USER` | ✅ **已转测** | §9：**两处均可旁路**（事务内试后 `ROLLBACK`，无残留） |
| 6 | `quote_cid ≠ 1`（未来多基础货币） | ✅ **已转测**（拒绝路径） | `LD016/QUOTE_CID_MUST_BE_ONE`（**未**验证「多基础货币成立」的未来形态语义） |
| 7 | `ledger_max_single_amount()` 上界 / bigint 溢出 | ⛔ `NOT_MEASURED` | 代码路径存在（`OVER_MAX_SINGLE_AMOUNT`）但本单**未触达** |
| 8 | maker 侧手续费口径 | ⛔ `NOT_MEASURED` | R47 只裁 taker；本单 T2/09b 只覆盖**taker = 卖 / taker = 买**两侧，**maker 侧未定义、未测** |
| 9 | 部分唯一索引 | ✅ **已转测 / 确认** | **0**（§3.3，依 §6.4 + DL74 判为「无」而非「遗漏」） |
| 10 | K 线在大表下的性能 | ⛔ `NOT_MEASURED` | 无性能脚本；DL150 的升级门槛（性能实测 + 新 DL 规则）未触达 |
| 11 | 多币对 / 其他 base 币的 K 线桶 | ⛔ `NOT_MEASURED` | `market_trade` 现取**只有** `base_cid=170, quote_cid=1` ⇒ 无第二个币对可对拍 |
| 12 | `migrate.ts` registry `name` 与文件名不一致 | ⛔ `NOT_MEASURED` | 本单**未复核** `0013` 行之 `name`；**非本柱范围** |

**自建矩阵结论**：12 条中 **4 条已转测**（#1 #5 #6 #9）、**8 条 `NOT_MEASURED`**（#2 #3 #4 #7 #8 #10 #11 #12）。

---

## 13. 未验证清单（**枚举到边界**）

1. **撮合应用层**：`DL68` 的 `pg_advisory_xact_lock(hash(币对))` 与「币对单写者进程模型」**均未实现** ⇒ 撮合服务层的串行化、决策新鲜度、公平性**完全未验证**。
2. **PgBouncer transaction 模式**下会话级 advisory lock 的行为（`ledger.spec` §16 #3）—— `NOT_MEASURED`。
3. **价差改善放开后的语义**（成交价 ≠ 买单限价时的第 7 条分录形态）—— 本实现拒绝，**未验证**。
4. **小时桶 K 线**（视图档位）；以及 **DL150 的升级门槛**（性能实测 + 新 DL 规则）—— `NOT_MEASURED`。
5. **多币对 K 线**：`market_trade` 现取仅有 `base_cid=170 / quote_cid=1` ⇒ 第二个币对的桶语义、`candle_view` 的 `GROUP BY` 多币对分组**未验证**。
6. **`ledger_max_single_amount()` 上界与 bigint 溢出边界**（`OVER_MAX_SINGLE_AMOUNT`、`EVENT_SUM_OUT_OF_RANGE`）—— `NOT_MEASURED`。
7. **maker 侧手续费口径**（R47 只裁承担方 = taker）—— maker 侧**无定义、未测**。
8. **K 线在大表下的性能**（DL150 门槛的实测读数）—— `NOT_MEASURED`。
9. **`market_order.ledger_event_keys` 与账本 `event_root_key` 的全量一致性（DL100）**：本单只在 4 张挂单上抽查（现取 `[cli:neng16-A, biz:market:trade:35:1, biz:market:trade:36:2]` 等），**未做全量闭环断言**。
10. **重放语义 R51/R52 的 `409` 指纹冲突分支**：本单只测了「同键 + 同指纹」（重放，T3）与「同键 + 同指纹串行重放」（上游 K2 族）；**同键 + 异指纹 ⇒ `LEDGER_IDEMPOTENCY_CONFLICT` 未测**。
11. **`create_key` 的键格式闸**（`PREFIX_REQUIRED` / `RESERVED_SEPARATOR` / `CONTROL_CHARACTER` / `TOO_LONG`）与**账本键前缀闸**—— 本单**未复测**（上游 K5 覆盖其中两项）。
12. **裸 `INSERT` 违反 FK ⇒ `23503`**（`market_order_base_fk` 等）—— 本单**未复测**。
13. **`uid = -3` 的 `transfer` 出账例外**（`ledger_post_event` 内的平台例外分支）—— `NOT_MEASURED`。
14. **`fee` 非整数字符串 / 负数字符串 / 超大值**的入参边界 —— 本单只测了 `fee=0`、`fee=1`、`fee=2`。
15. **卖单侧**的 `quote_cid ≠ 1`、**未 listed base**、**price≠限价** 路径 —— 本单只覆盖**买单侧**（三闸与 side 无关的概率高，但**未实测**）。
16. **`ALTER TABLE … DISABLE TRIGGER ALL`（含内部触发器）** 与 **`session_replication_role = replica`** 的旁路 —— 本单只测了 `DISABLE TRIGGER USER` 与 `TRUNCATE`。
17. **路由/服务层**（`src/**`）与本柱的接口约定 —— 本柱**本不含**路由；`DL151`（裸表名）、`R100`（平台账户）在**服务层**的落实**未验证**。
18. **`0013`–`0015` registry `name` 与文件名漂移**（上游 §4 观察项）—— 本单**未复核**。
19. **并发规模上限**：本单并发度 = 2；**>2 连接、长事务链、真实撮合负载下的锁等待分布/超时**未测。
20. **`candle_view` 的 `volume` 为 `numeric`**（对 `market_trade.amount` 求和）在极大表下的精度/性能 —— 未测。

---

## 14. 库侧副作用登记（**不清理**）

**自造夹具（命名空间 `9906xx` / `cli:neng16-`）**

- **`public.users`**：新增 **`990601` / `990602` / `990603` / `990604`**（`evm` 为合规格式占位地址）。窗口外 uid 被触碰数 = **0**。
- **`public.market_order`**：本单新增 **42 行**（全部 `create_key LIKE 'cli:neng16-%'`；owner 全部在 `9906xx`）。终态分布现取：`filled 12 / open 20 / partial 9 / cancelled 1`。
- **`public.market_trade`**：本单新增 **6 行**（append-only ⇒ **不可清理**）。
- **`public.ledger_entry`**：本单新增约 **+146 行**（`cli:neng16-*` 挂单 hold、`biz:market:{trade,cancel}:*`、`ops:neng16-fund-*` / `ops:neng16-topup*`）。其中 `event_root_key LIKE '%neng16%'` = **96 行**（不含 trade 事件，后者的键派生自 order_id）。
- **`public.currency`**：**未新增**；仅只读。
- **平台账户**：仅 **`uid = -1`** 因 `trade_fee` 增加（本单合计 `+3`，`cid=1`）；`uid ∈ {0,-2,-3}` 本单 **零分录**。
- **注资来源（搬水，非铸币）**：`$`(cid 1) 由既有持有人 **`990302`** 转账给出（`2808 → 1208`，共出 **1600**：500+200+200+300+400 之中成功的部分）；base(cid 170) 由既有持有人 **`954001`** 转账给出（`49799600 → 49799500`，出 **100**）。**`cid=1` 的 `total_supply` 未动**（8400 前后同值；`Σ(balance+frozen)` 亦 **8400**）。**未使用 `mint`**。
- **未清理理由**：DL79 禁物理删除业务行 + 题面「登记不清理」。

**未触碰**：`0001`–`0015` 的迁移字节与 registry 行、`0016` 文件本身（工作区 sha 首尾相等）、既有 13 张基表的结构与（除上述搬水外的）数据、`frontend/`、`backend-ts/src/`、`docs/*.spec.md`、`docs/versions/`、`docs/seafood.master-plan.md`、`docs/audit/**`、`docs/qa/p3-0015-listing-review.md`、`backend-ts/scripts/p3m-*`、`.p3m-artifacts/**`。
**未做**：commit / `git add` / push；未启常驻 server；未用 `pkill -f` / `killall`；未 `DROP` / 真 `TRUNCATE` 既有表；未新增/删除任何索引或触发器；**未改动任何函数体**（坏版函数仅在**同事务**内装入并 `ROLLBACK`，现取 md5 复原）。

---

## 15. 收工不变量（现取）

| 项 | 读数 |
|---|---|
| `cid=1` `Σ(balance+frozen)` / `total_supply` | **8400 / 8400**（相等） |
| `cid=170` `Σ(balance+frozen)` / `total_supply` | **50000000 / 50000000**（相等） |
| `ledger_post_event` | **51429 B / md5 `d94dd902697dfe60aba409d808c6d63a`**（DL142 未破） |
| 全库非 `O` 触发器 | **0** |
| `market_order` / `market_trade` / `ledger_entry` 总量 | **68 / 19 / 2755** |
| 本单文件 `0016_market.sql` | **1201 行 / 70570 B / sha256 `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df`**（首取 = 末取） |
| `git status --porcelain`（质检后，除本报告外） | **本报告为唯一新增仓内文件** |
