# P4-B3e · 交易所（market）资金编排 — 交付报告（M1 挂单 / M2 撤单 / M3 成交 + **DL68 币对级串行化**）

- **run tag** = `b3e-20260930T024237` · **产物目录（绝对路径）** = `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b3e-20260930T024237/`
- 权威 = `docs/route-layer.spec.md` **v0.6**（§4.1 关闭集 / §4.2 M1·M2·M3 / §4.3 资金四栏 / §4.4-5·9·13·14 / §4.5 幂等键总表 / §3.1-3.3）；`docs/data-layer.spec.md` **v0.7**（**DL85 / DL87 / DL90** + **DL68（v0.6 加注）** / DL64 / DL141–DL144）
- 报告口径：凡写「**实测**」= 本报告内的读数可在下节产物 JSON 里 `grep` 到；**代码推断**一律标 `【推断】`；未测一律 `NOT_MEASURED`（**不填 0 / 不填空**）。
- **产物清单（全部 run-tagged、绝对路径、同名拒写）**：
  - `…/b3e-20260930T024237/00-inventory.md`（**落盘先行的「本片事件与端点清单」**）
  - `…/b3e-01-snapshot-pre.json` / `…/b3e-01-snapshot-post.json`（**全账户逐行 dump** + 逐 kind + market 快照 + 不变量）
  - `…/b3e-02-e2e.json`（M1/M2/M3 端到端 21 用例 + 逐腿取证 + 并发 P1/P2）
  - `…/b3e-03-lockprobe.json`（DB 侧命名 reason 探针 + 币对锁占位基线对照）

## 0 结论摘要（先给结论）

1. **M1/M2/M3 三段全部落地**，唯一资金写路径 = 迁移既有 `public.market_post_event($1::jsonb)`（**零自拼分录 / 零新 kind / 零新白名单**）：`hold`×2（挂单）/ `hold_release`×2（撤单）/ `trade`×4 + `trade_fee`×2（成交）。
2. **DL68 币对级串行化 = 本片交付**：写语句外层 CTE 取 `pg_advisory_xact_lock(base_cid::int4, quote_cid::int4)`；**用独立会话持 (4,1) 锁 1.5s 期间，服务层同币对调用被阻塞 +961ms（2001ms vs 对照 1040ms）**；并发同币对两笔成交 = **恰 1 成功 / 无超额成交**（`amount_filled 1 ≤ amount 1`）。
3. **手续费不可退 = 实测**：撤单事件 `trade_fee` 增量 **0**（`T13`），只释放剩余在冻额 1000 = (5−4)×1000。
4. **不变量**：`$`（cid=1）`Σtotal` **2,000,000 → 2,000,000 不变**；逐 kind 增量 = **事件 × 分录条数**（`hold +42=21×2`、`trade +32=8×4`、`trade_fee +16=8×2`、`hold_release +6=3×2`）**逐等式成立** ⇒ **两次幂等重投合计零新增分录**；`23514` **未触发**；**孤儿分录 0**；负余额 0；**非 mint/burn 事件逐事件 `Σ(delta+frozen_delta)=0`**。
5. **注册点 53 → 53（不变）**；本片**新增 3 条「已实现·未注册」**（§1.8 表格式待补行见 §7）⇒ **未认领 3 条、认领 0 条**。
6. **本片不涉佣金**（§4.2 M1/M2/M3 与 §4.3 交易所行**均无** `commission` 要求 ⇒ 不做不假设）；**不实现第 7 条分录**（价差改善 = §12.2-13 明文待裁）。

## 1 端点与登记（先现取）

| # | 路径 | 方法 | 前端消费读数（`grep -rho "/api/[a-z0-9/_:.-]*" frontend/src`） | 处置 | 注册点 |
|---|---|---|---|---|---|
| 1 | `/api/order` | POST | `frontend/src/pages/ShardPage.jsx:176`（body `{bID,side,price,volume}`） | **改接** → `placeMarketOrder`（M1） | 既有 `src/index.ts:741` |
| 2 | `/api/order/:oID` | DELETE | `ShardPage.jsx:314` | **改接** → `cancelMarketOrder`（M2） | 既有 `src/index.ts:795` |
| 3 | `/api/order` | DELETE | `ShardPage.jsx:328`（body 式全撤） | **改语义** → 逐单 `op='cancel'`；**入参走 query、不读 body**（§1 #27 / §7-5） | 既有 `src/index.ts:772` |
| 4 | `/api/market/order`、`DELETE /api/market/order/:orderId`、撮合成交入参路径 | POST/DELETE/POST | **前端零调用**（实测 `frontend/src` 内 `/api/market/` 仅 `orderbook`/`trades` 两个**读口**） | §1.1 新命名 / §4.2 M3（撮合服务调用）⇒ **只交付服务层**，路由随批 4 | **不注册** |

- **注册点报数**：`grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts` = **53**（片前）/ **53**（片后）⇒ **变化 0**。`src/index.ts` 行数 1216 → **1254**。
- **前端同步项（新增，须进 §2.4）**：**S-b3e-1** `POST /api/order` 的 `create_key` 必填 ⇒ 旧前端形状（无键）**实测 `400 LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（T04）⇒ 前端须补键（同 §2.4 S1/S10 族）；**S-b3e-2** `DELETE /api/order` 的 body 式全撤（S4）⇒ 后端已不读 body（T17 用 query 通路成功）；**S-b3e-3** `POST /api/order` 成功面键集已变（旧 = `MarketOrderRecord`；新 = 本片 view 键集，见 §3.5）—— 前端仅 toast 无键依赖，风险低但**登记**。

## 2 改动清单（最小改动 · 只碰允许面）

| 文件 | 改动 | 落点 |
|---|---|---|
| `backend-ts/src/market-service.ts` | **新建**（589 行）：`placeMarketOrder:239` / `cancelMarketOrder:366` / `cancelAllMarketOrders:389` / `matchMarketOrders:448`；三个单点判定常量 `MATCH_FILL_NO_REQUIRED:73`、`MARKET_FEE_RATE_SOURCE:85`、`MARKET_PAIR_LOCK:97`·`MARKET_PAIR_LOCK_SCOPE:101` | 唯一 `./ledger` 引用 = 错误映射助手（`R1②` 结构保证） |
| `backend-ts/src/database.ts` | **+5 method**：`marketPostEvent:1804`（**唯一写路径**，含 `pg_advisory_xact_lock` @ `:1811`）、`resolveMarketOrder:1827`（只读）、`resolveMarketCounterparty:1873`（只读、**服务端选对手方**）、`listOpenMarketOrderIds:1916`（只读）、`currentFeeRateBp:1934`（只读） | 无 DDL、无直接 `account`/`ledger_entry` 写 |
| `backend-ts/src/index.ts` | 3 条既有路由改接/改语义 + 1 行 import（`:28`） | 注册点 **53 → 53** |
| `backend-ts/scripts/p4z-b3e-0{1,2,3}-*.ts` | 快照 / e2e / 锁探针（**未改** `p4z-01-probe.ts`） | — |
| `docs/audit/p4-b3e-market-funds.md` | 本报告 | — |

**未碰**：`migrations/**`、`src/ledger.ts`、`src/ledger-errors.ts`、`src/commission.ts`、`frontend/**`、`backend-ts/.env.local`、任何 `docs/**` spec；**零 git 写**；**零删除型 SQL**。

## 3 三个单点判定 + 撮合口径（无 spec 明文处的口径，**均单点可改**）

1. **D-1 `fill_no` 必填 fail-loud（不派生）** = `market-service.ts:73`。理由：§4.5 事件根键 `biz:market:trade:<taker_order_id>:<fill_no>` 的 `fill_no` **无法由不可变业务标识唯一确定**；任何「按已有成交笔数 +1」派生对**同一次撮合决策的重投不幂等**（会拿到 `n+1` ⇒ 新键 ⇒ 若订单仍有余量则**再成交一次 = 重复交割**）。⇒ 依 §4.4-14 判据族（无自然键 ⇒ 响亮拒绝）。**实测**：缺 `fill_no` ⇒ `400 LEDGER_AMOUNT_INVALID` + `reason=FILL_NO_REQUIRED`（T11）。
2. **D-2 手续费服务端取数** = `market-service.ts:85`。`fee = (成交量 × 买单限价 × fee_rate_bp + 5000) / 10000`（**半进位** = §4.3 J5 的「全项目唯一取整点」同族）；`fee_rate_bp` 取自 **`commission_policy`**（§4.4-11 逐字「费率真源 = `commission_policy.fee_rate_bp`（唯一真源）」）。**实测**：现行政策 `fee_rate_bp = 100`（`b3e-01-snapshot-pre.json` `commission_policy`），成交额 3000 ⇒ `fee = 30`（T06）；`trade_fee` ×2 入 `-1`（DL87）。**客户端传 `fee` 被丢弃并登记**（T06 `client_inputs_ignored.client_fee = "0"`）。
3. **D-3 币对锁形态** = `market-service.ts:97`。取**两参 int4** `pg_advisory_xact_lock(base_cid::int4, quote_cid::int4)`（DL68 原文为 `hash(币对)`）：**语义等价、无哈希碰撞、探针可逐字复现**；锁作用域 = 语句级隐式事务（`xact` 变体在语句结束释放）⇒ 覆盖整个 `market_post_event`。**作用域 = 三 op 全纳管**（备选：仅 `trade`；见 §7 待裁 5）。
4. **对手方选择口径（服务端）** = §3.4。
5. **服务端取数的边界（硬口径 #4 的落法）**：M1 的 `price`/`amount` = **用户自己的限价单条款**（同族 = §4.4-13「`job.reward` 是业务约定额 ⇒ 不适用金额服务端取数」）；**M1 的 `owner_uid` = token actor**（客户端传值被丢弃并登记 `client_owner_uid_ignored`）；**M1 的 `quote_cid` 缺省 = 服务端恒 `1`**（DL64），显式传值原样交 DB（`QUOTE_CID_MUST_BE_ONE` 真源仍在函数内）；**M3 的 `price`/`buy_order_id`/`sell_order_id`/`fee` 一律服务端取数，客户端传值全部丢弃并登记**（T06 `client_inputs_ignored` 四键）。
6. **对手方选择（`resolveMarketCounterparty`）**：同 `(base_cid,quote_cid)` · 反向 · `status ∈ {open,partial}` · 有余量 · **可成交**（taker=buy ⇒ `o.price ≤ 买单限价`；taker=sell ⇒ `o.price ≥ 卖单限价`）· 排序 = **价优 → `time_created` → `order_id`**（确定性全序）· **优先非自身**；**无「非自身」候选**才退到含自身 ⇒ 让 DB 的 `self_trade_not_allowed` **响亮拒绝**。**成交价恒 = 买单限价**（DL85 明令）⇒ 事件恒 4/6 条分录、**不产生多余冻结 ⇒ 无第 7 条分录**。

## 4 逐项实测读数（支撑文件 = `b3e-02-e2e.json` / `b3e-03-lockprobe.json`）

### 4.1 M1 挂单（`hold` ×2，同 uid 同 cid）

| 用例 | 输入 | 结果（读数） |
|---|---|---|
| **T01** 买单（`bID=4, price=1000, volume=5`, `create_key=cli:p4b3e30024237:buy1`） | HTTP `POST /api/order` | **200**；`order_id=1`；`ledger_idempotency_key = cli:p4b3e30024237:buy1`（**创建键即事件根键**，§4.5）；**逐腿 2 条**：`uid 11 cid 1 (delta −5000, frozen_delta 0)` + `uid 11 cid 1 (delta 0, frozen_delta +5000)` ⇒ **同账户 `balance↔frozen`**、`Σ(delta+frozen)=0` |
| **T05** 卖单（`side=sell, price=1000, volume=4`） | HTTP | **200**；`order_id=2`；逐腿 2 条：`uid 970001 cid 4 (−4 / 0)` + `(0 / +4)` ⇒ 卖单冻结 **base**（DL64/DL90） |
| **T02** 幂等重投（同键**同内容**） | HTTP | **200** + 顶层 `idempotent_replay:true`；`order_id` 仍 `1`；**新增分录 0**（见 §5 的逐 kind 等式） |
| **T03** 同键**异内容**（`volume 5→6`） | HTTP | **409 `LEDGER_IDEMPOTENCY_CONFLICT`**（§4.5 契约：响亮拒绝、非静默 replay）；`details.reason` = **NOT_MEASURED**（见 §6） |
| **T04** **缺键**（= 旧前端 `{bID,side,price,volume}` 原样） | HTTP | **400 `LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（fail-loud，与 DB 同码）⇒ 前端同步项 S-b3e-1 |
| **T09** 卖出无持仓（buy2 无 cid 4） | HTTP | **409 `LEDGER_INSUFFICIENT_BALANCE`**（余额/持仓不足） |

### 4.2 M2 撤单（`hold_release` ×2）+ **手续费不可退**

| 用例 | 输入 | 结果（读数） |
|---|---|---|
| **T13** 单撤 order 1（已成交 4/5） | HTTP `DELETE /api/order/1` | **200**；`order_status='cancelled'`、`frozen_hold=1000`、事件键 `biz:market:cancel:1`；**逐腿 2 条** `uid 11 cid 1 (0/−1000)` + `( +1000/0)`；**释放额 = (5−4)×1000 = 1000 ✓** |
| **T13 手续费不可退** | 同一次撤单前后计数 | `counts_before.trade_fee_n = 4` → `counts_after.trade_fee_n = 4` ⇒ **`trade_fee_delta = 0`**（DL87：手续费是**消耗**不是冻结）；`hold_release_n 0→2`、`trade_n 8→8`（不冲正成交） |
| **T14** 幂等重投（同 `order_id`） | HTTP | **200** + `idempotent_replay:true`；**零新增分录** |
| **T15** 越权（buy2 撤 seller 的单） | HTTP | **403 `AUTH_FORBIDDEN` + `details.reason=ACTOR_NOT_ALLOWED`**（与 3c/3d 同族；**备选 = 404 越权隐藏**，见 §7 待裁 6） |
| **T16** 未知 id / 非数字 id | HTTP | **404 `LEDGER_REF_NOT_FOUND`** + `{ref_type:'market_order', ref_id:'99999999'\|'abc', field:'order_id', reason:'order_not_found'}`（§3.1 三类 404 可分辨） |
| **T17** **全撤**（`DELETE /api/order`，**query 式**，body 传 `{}` 被忽略） | HTTP | **200**；`attempted=2`、`cancelled=2`（逐单 `[3,4]` 全 `cancelled`）⇒ §4.2 M2「逐单」+ §1 #27「不读 body」 |

### 4.3 M3 成交（`trade` ×4 + `trade_fee` ×2）

| 用例 | 结果（读数） |
|---|---|
| **T06 部分成交**（taker = 买单 order 1，`amount=3, fill_no=1`；body **故意**塞 `price/buy_order_id/sell_order_id/fee` 全部无效值） | **200**；`kinds = ['trade','trade','trade','trade','trade_fee','trade_fee']`、`entry_count=6`（**DL85 恰好 6 条**）；`turnover=3000`、`fee=30`、`fee_rate_bp=100`；**服务端选择的对手方** = `buy_order_id=1 / sell_order_id=2`、`buy_price=1000`；`client_inputs_ignored = {price:"1", buy_order_id:"1", sell_order_id:"1", fee:"0"}`（**客户端传价/传对手方/传费全部丢弃并登记**）；`counterparty_selected_server_side=true`。**逐腿 6 条**（`T06-legs.legs`）：`11/1 −3000(f)` → `11/4 +3` → `970001/4 −3(f)` → `970001/1 +3000` → **`11/1 −30`（trade_fee，taker）** → **`−1/1 +30`（trade_fee，平台收入）**；`Σ(delta+frozen)=0` |
| **T07 全额成交**（taker = 卖单 order 2 余量 1） | **200**；`trade_id=2`、`fee=10`；**业务行读数**（DB 直读）`order 2: amount_filled=4/4 status='filled'`；`ledger_event_keys = [cli:…:sell1, biz:market:trade:1:1, biz:market:trade:2:1]`（§4.5 两把成交键 + 创建键） |
| **T06b 幂等重投**（同 taker + 同 `fill_no`） | **200** + `replay:true`；**新增分录 0**（见 §5 等式） |
| **T08 自成交**（同 owner 买卖对，服务端选择退到含自身） | **400 `LEDGER_SELF_TRANSFER`**；DB 侧命名 reason 实测 = **`self_trade_not_allowed`**（`b3e-03-lockprobe.json` `A3_self_trade.detail_parsed.reason`，携带 `uid=970001` 与 buy/sell_order_id） |
| **T10 成交量 > 对手余量**（amount 5 > 余 1） | **409 `LEDGER_INSUFFICIENT_BALANCE`**（DB 侧 reason `market_order_amount_insufficient` = 函数体 `0016:794`/`:802` 逐字；HTTP 面 reason **NOT_MEASURED**） |
| **T11 缺 `fill_no`**（D-1） | **400 `LEDGER_AMOUNT_INVALID` + `reason=FILL_NO_REQUIRED`**（服务层闸；DB 侧对「空串」的原始 reason 实测 = `NOT_DECIMAL_INTEGER`，见 §6-③） |
| **T12 未知 taker id** | **404 `LEDGER_REF_NOT_FOUND` + `reason:'order_not_found'`**（服务层；未进 DB） |

### 4.4 并发面（DL68 的**必须实测项**）

| 探针 | 读数 |
|---|---|
| **P1 同币对两笔并发成交**（base=16；两买单 A/B 同时抢同一卖单 1 手） | `successes = 1`（A 200 / B 404 `no_matchable_counterparty` —— 卖单已被 A 吃尽 ⇒ 无对手方）；**卖单终态 `amount_filled=1 ≤ amount=1 status='filled'`、`oversell=false`** ⇒ 「**恰一次成交、无超额成交**」（DL68 v0.6 ②a 的口径） |
| **P2 币对锁**（外部会话持 `pg_advisory_xact_lock(4,1)` **1500ms**；期间调服务层成交） | **同币对 (4,1) 调用 elapsed = 2001ms**（阻塞）vs **随后一次调用 elapsed = 1040ms**（无锁竞争）⇒ **差 +961ms ≈ 剩余持锁时间**；`blocked_assert = true`。**鉴别力说明**：本机 `neon` HTTP 驱动 + 服务层 3 次只读 + 1 次写 ⇒ **单次固有开销 ~1.0–2.9s**（`b3e-03-lockprobe.json` `baseline.match_ms = 2941`；持锁 2500ms 的并发批 `both_elapsed_ms = 4297` ⇒ **比无竞争基线多 1356ms**）。**同币对阻塞 = 已被「外部会话持同一把锁」这一独立事实证明**（不同键的锁不会互相等待）；**异币对是否并行 = NOT_MEASURED**（未逐调用计时，§6-④） |
| **P1 的另一解释（诚实边界）** | 行级 `FOR UPDATE`（DB 函数内既有）单独也能给出「不超卖」⇒ P1 证明的是**不变量**，**不是**币对级串行化本身；**币对级串行化的直接读数 = P2**（同键阻塞）。**DL68 残余**：**对手方选择在锁外**（服务层只读）⇒ DL68 v0.6 ②c 的「**撮合决策新鲜度**」残余**仍在**（并发同币对时后到者在锁内被 DB 闸拒绝，**不会**超卖）；消除残余需「选择也进锁内」的**交互式事务**方案（`src/db.ts` 的 R55/R56 事务层已存在）⇒ **§7 待裁 1** |

## 5 不变量对拍（**交 Zang 自算**：`b3e-01-snapshot-pre.json` / `-post.json` 含**全账户逐行 dump**）

| 口径 | pre | post | 判定 |
|---|---|---|---|
| `account` 行数 | 12 | 23 | +11（3 只读夹具账户开立 + cid4/16/21 的 base 账户） |
| **`Σtotal`（cid=1，`$`）** | **2,000,000** | **2,000,000** | **不变 ✓**（基线 2,000,000 自证） |
| `Σtotal`（**全币种**，跨币种相加仅作对账） | 2,000,000 | 2,020,100 | **+20,100 = 3 次 `mint` 新供给**：cid4 `decimals=2` ⇒ '100'→**10,000** + cid16 `decimals=2` ⇒ **10,000** + cid21 `decimals=0` ⇒ **100**（**算术逐笔对账成立**；`mint` 是设计上的非守恒事件） |
| `Σbalance` / `Σfrozen`（全币种） | 1,995,998 / 4,002 | 2,009,627 / 10,473 | 差额全部落在 cid4/16/21（`$` 侧见上） |
| `ledger_entry` 总行 | 86 | 189 | **+103** |
| **逐 kind 增量（增量 == 事件 × 条数）** | — | `hold +42` = **21 单 × 2** ✓；`trade +32` = **8 成交 × 4** ✓；`trade_fee +16` = **8 × 2** ✓；`hold_release +6` = **3 撤单 × 2** ✓；`mint +3`（夹具）；`transfer +4`（夹具供资） | **5 个等式逐条成立** ⇒ **T02/T06b/T14 三次幂等重投合计新增分录 = 0**（若有重复落账，等式即破） |
| `commission` / `job_*` / `purchase` / `sale` / `listing_*` / `currency_create_fee` 增量 | — | **全部 0** | **不串味**（DL85 事件级白名单口径；本片未碰任何其它柱） |
| **逐事件守恒** `Σ(delta+frozen_delta)=0` | 2 事件非零 | 5 事件非零（**+3 = 3 次 `mint`**） | **本片全部事件（21 挂单 + 3 撤单 + 8 成交）逐事件守恒 ✓**；非零者**全部**为 `mint`（合法非守恒） |
| **孤儿分录**（`ref_type ∈ {market_order, market_trade}` 而 `ref_id` 无对应业务行） | 0 | **0** | ✓ |
| 负余额/负冻结行 | 0 | **0** | ✓ |
| `23514`（CHECK 违例） | — | **未触发** | 失败面全部走命名错误码（`LD005`/`LD016`/`LD019`/`LD002`/`LD001`/`LD023`），无裸 CHECK 违例 |
| 逐腿取证 | — | **挂单 = 同账户 2 腿 `balance↔frozen`**（T01/T05）；**成交 = `trade`×4 全在 `balance`（`frozen_delta` 非零的 2 腿 = 双方出账侧）+ `trade_fee`×2 全在 `balance`**（T06）；**无预期外的 `frozen` 变动**（成交事件 `frozen` 变动恰 2 条，均在买卖双方出账腿） | ✓ |

## 6 NOT_MEASURED（**禁当 0/空使用**）+ 探针自曝

**NOT_MEASURED**：
1. **`details.reason` 字符串（HTTP 面）**：T03 / T08 / T10 的 reason **未测到** —— 根因 = `neon` HTTP 驱动**不携带 `detail`**（读数里逐条标 `detail_unavailable: driver_did_not_carry_detail`）。**T08 的 reason（`self_trade_not_allowed`）已由 DB 侧探针 A3 补测**；**T03（`CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT`，函数体 `0016:537`）与 T10（`market_order_amount_insufficient`，`0016:794`/`:802`）的 reason 仍为 NOT_MEASURED**（A1 探针**自身写错键**未触发，见自曝 ①）—— 二者**状态码 + 错误码**均已实测（409/`LEDGER_IDEMPOTENCY_CONFLICT`、409/`LEDGER_INSUFFICIENT_BALANCE`）。
2. **`fee = 0 ⇒ 只 4 条分录`分支**：本片 8 笔成交 `fee` **全 > 0**（`trade_fee` 恒 8×2）⇒ 该分支 **未触发 ⇒ NOT_MEASURED**。
3. **缺 `fill_no` 的 DB 原始 reason**：DB 对**空串**给出 `NOT_DECIMAL_INTEGER`（A2 实测），对 `fill_no ≤ 0` 才给 `FILL_NO_REQUIRED`；**服务层对「缺失」直接给 `FILL_NO_REQUIRED`**（前置闸，同码 `LEDGER_AMOUNT_INVALID`/400）⇒ **口径差异已登记（§7 待裁 7）**，**服务层那一路的 DB 行为 = 不适用**。
4. **异币对并行性**（持锁期间异币对调用的绝对完成时刻）：**NOT_MEASURED**（探针未逐调用计时；仅整批耗时）。
5. **`423`（币种 `frozen`）面 / `401`（无 token）面**：**NOT_MEASURED**（本片无冻结币种夹具；401 面属路由层既有 `requireActor`，本片未测）。
6. **`GET /api/order`（读口）键集**：本片**未动**读口 ⇒ 其 12 键冻结面不受影响（`【推断】`：读口未改，非本轮读数）。

**探针自曝（§5.7④⑧⑨）**：
1. **`A1`（DB 侧 409 reason）探针写错键**：我用 `KEYS('buy1')`（前缀 `cli:<TAG>:lp:`）去撞 `cli:<TAG>:buy1` ⇒ **未触发冲突**、而是**新落了一张真实买单**（cid4 buy 1234×5）⇒ **A1 读数作废**（该单已计入 post 快照的 `hold +42` 等式，**不影响任何不变量**）。**教训：幂等冲突探针必须逐字复用库内既有键**。
2. **P2 的 `blocked_assert` 判据不具鉴别力**：对照组也有 ~1.0s 固有开销 ⇒ 该断言只作参考；本报告改用「**独立会话持同键锁 ⇒ 调用被延后**」+「**elapsed 差 ≈ 剩余持锁时间**」两条联合判据，并明写鉴别力边界。
3. **P2 的 `executed_after_lock_pair: true` 是硬编码声明、不是读数** ⇒ 已在本报告中弃用该字段作证据。
4. **P1 中我预期的对手方与实际成交对象不同**：预期吃 `lock_sell21`，实际吃更早的 `selfsell21`（价时优先 FIFO **正确**）⇒ 探针预期错、实现行为对（读数为证：`order 21 status='open' amount_filled=0`）。
5. **夹具 `mint` 金额形态**：我传 `'100'` 是**十进制字符串**（按 `currency.decimals` 换算）⇒ 实落 **10,000 / 10,000 / 100** 最小单位（本意 100/100/100）⇒ 夹具量级 100×，**不破任何不变量**（已在 §5 逐笔对账）。
6. **本报告未把「代码推断」写成「实测」**：标 `【推断】` 者仅 2 处（§6-6、§7 待裁项中的备选方案影响面）。

## 7 待裁 / 待补（交 Zang；**不得自行写 spec**）

**§1.8 表格式待补行（本片新增「已实现·未注册」= 3 条；「认领 0 条 / 未认领 3 条」）**：

| # | 路径（未注册） | 服务层落点（`文件:行号`） | 为何未注册 | 由哪一批注册 |
|--:|---|---|---|---|
| 1 | `POST /api/market/order` | `src/market-service.ts:239`（`placeMarketOrder`） | 前端零调用（`frontend/src` 内 `/api/market/` 命中只有 `orderbook`/`trades` 两个读口）；§1.1 新命名未上线；既有 `/api/order` 已承载同能力（已改接） | **批 4** |
| 2 | `DELETE /api/market/order/:orderId` | `src/market-service.ts:366`（`cancelMarketOrder`） | 同上；既有 `DELETE /api/order/:oID` 已承载同能力（已改接） | **批 4** |
| 3 | 撮合成交入参路径（§4.2 M3「撮合服务调用」） | `src/market-service.ts:448`（`matchMarketOrders`） | 触发者 = **撮合服务**，前端零调用；本片按「新路径 ⇒ 服务层交付、路由随批 4」处理 | **批 4 / P5 撮合服务交付** |

**待裁项（均给可选方案，本片取默认值）**：

| # | 议题 | 本片取值（实测支撑） | 备选 |
|--:|---|---|---|
| 1 | **DL68 残余：对手方选择是否也进锁内** | **不进**（选择是锁前的一次只读）⇒ 变更已串行化、**撮合决策新鲜度**残余（P2 实测同键阻塞） | **方案 B**：把「锁 → 选择 → 写」放进 `src/db.ts` 的交互式事务（R55/R56 已存在）⇒ 残余归零；代价 = 多一次事务往返 + 需在 `database.ts` 承载选择 SQL |
| 2 | **D-2 费率真源与计价口径** | `fee_rate_bp = commission_policy` 现行政策（实测 100）+ `fee = 成交额 × 费率`（半进位） | ① 改服务端常量（`TODO: Kevin 定值`，同 3a 下限常量先例）；② 改口径为 `数量 × 费率`（§4.3 的 `amount` 字面读法）⇒ 单点改 `market-service.ts:85` |
| 3 | **D-1 `fill_no` 必填** | **必填 fail-loud**（实测 400） | 由撮合服务在决策内给出 + 缺省按「已有成交笔数 +1」派生（**需**补「重复交割」的判负用例与幂等约束；本片**不**自选） |
| 4 | **对手方选择口径** | 可成交 + 价优 → `time_created` → `order_id`；优先非自身（实测 T06/T07/P1） | 由撮合服务传入对手方 ⇒ **与派单硬口径 #4「不得接受客户端传对手方」冲突**，须先改口径 |
| 5 | **币对锁作用域** | `order\|cancel\|trade` 三 op 全纳管 | 仅 `trade`（DL68 的字面强制项）⇒ 单点改 `market-service.ts:101` |
| 6 | **M2 越权语义** | **403 `AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`**（与 3c/3d 同族，实测 T15） | **404**（DL111/DL124「越权隐藏、不泄露存在性」）—— 二选一须 Zang 定 |
| 7 | **缺 `fill_no` 的码面** | 服务层 `400 LEDGER_AMOUNT_INVALID` + `reason=FILL_NO_REQUIRED` | 与 DB 原样一致（空串 ⇒ `NOT_DECIMAL_INTEGER`，A2 实测）⇒ 单点改 `market-service.ts` 的 ② 段 |

**登记（不需要裁定，仅备查）**：
- **佣金（十级返佣）本片不涉**：§4.2 M1/M2/M3 与 §4.3 交易所行**均无** `commission`；`trade_fee` **全额入 `-1`**（实测 T06 第 6 腿），**不是**佣金池 `-2`。
- **第 7 条分录（价差改善释放）不实现**：DL85 v0.6 加注 + §12.2-13 明文待裁 ⇒ 本片成交价**恒 = 买单限价**、**不可成交不选**（不产生多余冻结）。
- **旧直写路径现无调用方**：`DatabaseService.placeOrder:3102` / `cancelOrder:3194` / `cancelAllOrders:3256` 在 3 条路由改接后 **`grep` 调用点 = 0**，且旧实现写 `account`（违 R1）、引用**不存在的列** `bID/uID/volume_total/volume_filled`（迁移后 schema 为 `owner_uid/base_cid/amount/amount_filled`）⇒ **归批 4 收口**（同族先例 = `markTaskProgressChecked`/`rejectPendingTaskProgress`）。
- **`POST /api/order` 成功面键集已变**（旧 = `MarketOrderRecord` 12 键族；新 = 本片 view）⇒ 前端同步项 **S-b3e-3**。

## 8 声明（边界自证）

- `tsc --noEmit -p tsconfig.json` = **0 错误**（片后现取；退出码直接取，未过管道）。
- **零 git 写**（无 `git add/commit/push`）；**零删除型 SQL**；**零 `migrations/**` 改动**；**零 spec 改动**（`docs/**` 只读）；**未改** `src/ledger.ts` / `src/ledger-errors.ts` / `src/commission.ts` / `frontend/**` / `.env.local` / `p4z-01-probe.ts`；**未 `npm install`**。
- 服务重启**只走面板**：`POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}` ⇒ `/health` **200**（`schema_version=0020`）；**未用** `pkill -f` / `killall`。
- 产物**零 token / 零密钥字节**（只落 `SECRET_KEY` 的 12 位指纹 `token_fingerprint`）。
