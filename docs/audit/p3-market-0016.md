# P5 交易所柱 `0016_market.sql` —— 交付 + 应用 + 行为用例 + 判负自证报告

> **上游权威件**：`docs/data-layer.spec.md` **v0.5**（md5 `ed8e2a1f19c86b39db880533ee1cbae8`，**开工时现取**，与 brief 逐字一致）§6.4（积分交易所）· §6.1 编号表 `0016` 行 · §6.4 引用的 DL64 / DL65 / DL66 / DL150 / DL67 / DL68 / DL69 · §6.7（DL74–DL80）· §7.1（③ 交易所逐动作）· §7.2（DL81/DL84–DL90）· §8（DL93–DL100 / DL149）· DL20 / DL46–DL48 / DL141–DL144 / DL151；
> `docs/ledger.spec.md` v0.12：R21 / R28 / R47 / R51 / R52 / R62 / R79 / R93 / R109；`docs/seafood.master-plan.md` §5.45 / §5.47 / §5.48 / §5.49。
> 库：Neon（PG 18.6）；驱动 `@neondatabase/serverless` + `ws`；**所有 SQL 显式限定 `public.`**（DL151）。迁移入口：`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts`。
> **读数口径（纪律②）**：行数/字节/sha256 一律**现取**；增删行数用 `git diff --numstat`（**含空白行**）；未跑到的字段一律 `NOT_MEASURED`，**不填 0 / 空数组占位**。
> **run tag**：artifact 文件名内嵌 UTC 时间戳（`p3m-<YYYYMMDDTHHMMSSZ>-<label>.json`，同名**拒写**）。

---

## 更正 / 登记注（`C1` · `C2`；原文逐字保留，`DL154` 留痕纪律）

> **`C1`（更正注 · 报告级）**：本报告 §6 / §11 关于「`TAKER_NOT_A_PARTY` 已被用例覆盖」的表述**作废**。理由：上游用例 `trade_taker_not_a_party` **名不符实** —— 探针 `backend-ts/scripts/p3m-02-cases.ts` 的 `SpareIds = { spareId: '0' }` 在 **L387 硬编码 `'0'`**，该字段全文件从未被赋值 ⇒ 该用例实际命中函数 L692 的「buy/sell 小于 1」闸，**函数 L697–701 的 `TAKER_NOT_A_PARTY` 闸零用例触达**。已由 `docs/qa/p3-0016-market-review.md` **§2** 用**三个真实有效挂单**（A 买 35 / B 卖 36 / C 第三方 37）补测：`taker_order_id = 37` ⇒ `LD016` / `LEDGER_AMOUNT_INVALID` / `{field: taker_order_id, value: 37, reason: TAKER_NOT_A_PARTY}`；对拍 `sell_order_id = '0'` ⇒ `LD022` / `order_not_found`（与上游 artifact 逐字相符）；三形态零副作用。**本注为 `TAKER_NOT_A_PARTY` 覆盖表述的唯一有效口径。**
>
> **`C2`（登记注 · 护栏边界，非缺陷）**：`market_order.amount_filled` 的**单调增**守卫**无法分辨**「经 `market_post_event` 的成交推进」与「绕过编排函数的裸 `UPDATE`」。实测：对 order 38 裸 `UPDATE amount_filled = 2` 后，业务表剩余额 **30** 与账户 `frozen` **50** 出现 **20** 的**对账缺口**；**排除该单后 `DL68` 判据 5 逐 uid 精确相等（`390 == 390`）**。定性 = `DL143`「编排函数是唯一写者」的**护栏边界**。Zang 裁定：**登记不重修**（跨柱一致性：`0015` 的 `listing.stock` 同类边界已被接受），并要求 **P5 路由层禁止对可变态裸写**。

---

## 0. 交付物清单

| # | 产物 | 现状（现取） | 状态 |
|---|---|---|---|
| 1 | `backend-ts/migrations/0016_market.sql` | 1201 行 / **70570 B** / sha256 `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df` | ✅ |
| 2 | 应用（干净 apply + rerun） | apply exit 0（`0016` applied，12515 ms）/ rerun **16/16 `skipped`**、exit 0 | ✅ |
| 3 | 只读探针 + run-tagged 读数 | `scripts/p3m-{lib,00-state,01-post,02-cases,03-falsify,04-view}.ts`；`.p3m-artifacts/` **11 份** | ✅ |
| 4 | 行为用例（要求 ≥6，实交 **10 条**）+ 判负自证 | 用例 **10/10 通过**；判负自证 **7/7 判定全真**（GREEN→RED→GREEN） | ✅ |
| 5 | 本报告 | `docs/audit/p3-market-0016.md` | ✅ |
| ★ | 受限小项（`docs/audit/p3-listing-0015.md` 两处更正注） | `git diff --numstat` = **10 / 0**（含空白行） | ✅ |

---

## 1. 迁移前基线（现取；artifact `.p3m-artifacts/p3m-20260928T100411Z-state-pre.json`）

| 项 | 读数 | 与 brief 真值 |
|---|---|---|
| `schema_version` | **0015** | 一致 |
| `schema_migration` 行数 | **15** | 一致 |
| `public` 基表数 | **13**（`account, commission_policy, currency, job, job_application, job_submission, ledger_entry, ledger_owner, listing, listing_order, referral, schema_migration, users`） | 一致 |
| `public` 视图数 | **0** | — |
| `public` 函数数 | **62** | — |
| `ledger_entry` 总行数 | **2471** | brief 写「2380+」⇒ 现取值为 2471 |
| `cid=1` 收工不变量 | `Σ(balance+frozen)` = **8400** == `total_supply` **8400**（余额 4878 + 冻结 3522） | 一致 |
| 全库非 `O` 触发器 | **0** | — |
| **外来 0016 中间态闸** | `market_order/market_trade/candle_view` 全 **absent**；registry `0016` 行 **0**；`event_root_key LIKE 'biz:market:%'` **0**、`'cli:kong16%'` **0**、`'ops:p3m:%'` **0** | ✅ **未触发「立停上报」** |
| uid 窗口 `990501..990504` | **空**（`users_uid_seq.last_value = 55`；`users.uid` 为 `BY DEFAULT` identity ⇒ 允许显式 uid） | ✅ |
| 账本助手（`to_regprocedure` 现取） | `ledger_post_event(jsonb)` ✅ / `ledger_raise(text,jsonb)` ✅ / `ledger_int_amount(text,text)` ✅ / `ledger_uid_arg(text,text)` ✅ / `ledger_max_single_amount()` ✅ / `ledger_assert_currency_op(public.currency,text)` ✅ / `ledger_kind_ok`（**2 参**：`p_kind,p_frozen_settle`，第 2 参有默认 ⇒ `0015` 的 1 参调用成立） | 见 §3 口径 D |
| `ledger_post_event` 的 op 面（现取 prosrc） | `v_op NOT IN ('mint','transfer','hold','hold_release','settle','entries')` ⇒ **合法 op 恰为这 6 个** | §3 口径 A |
| R28 状态矩阵（现取 `ledger_assert_currency_op` 体） | `mint{draft,listed}` / `transfer{四态}` / **`hold{listed}`** / `price{listed}` / **`hold_release{四态}`** / `settle{listed}`；越界 ⇒ `LEDGER_AMOUNT_INVALID/UNKNOWN_CURRENCY_OP`；状态不符 ⇒ `LEDGER_CURRENCY_FROZEN` / `LEDGER_CURRENCY_DELISTED` / `LEDGER_CURRENCY_NOT_LISTED` | 逐字一致 |
| 事件级守恒（现取 `ledger_post_event` 体 L544） | `IF NOT v_has_mb AND (Σdelta + Σfrozen_delta) <> 0 THEN LEDGER_AMOUNT_INVALID/EVENT_NOT_BALANCED`；R34/R39 家族要求 `hold/hold_release/job_escrow/job_escrow_refund/listing_deposit` 每 `(uid,cid,kind)` **恰 2 条** | 本柱设计依据 |
| `ledger_post_event` 指纹 | **51429 B / md5 `d94dd902697dfe60aba409d808c6d63a`**（`octet_length`；`length()`=45598 **字符**，两侧口径同 §5.47⑤） | **未变** |

---

## 2. §6.4 逐列落位（**不增删列、不自创列名**）

### 2.1 `public.market_order` —— §6.4 列清单 **13 列**（实测列数 13）

| # | 列名 | 类型 | nullable | 默认 / identity | §6.4 依据 |
|---|---|---|---|---|---|
| 1 | `order_id` | bigint | NOT NULL | `GENERATED BY DEFAULT AS IDENTITY` | `order_id PK` |
| 2 | `owner_uid` | bigint | NOT NULL | — | `owner_uid FK users` |
| 3 | `side` | text | NOT NULL | — | `side` |
| 4 | `base_cid` | bigint | NOT NULL | — | `base_cid FK currency` |
| 5 | `quote_cid` | bigint | NOT NULL | — | `quote_cid FK currency` |
| 6 | `price` | bigint | NOT NULL | — | `price bigint >0` |
| 7 | `amount` | bigint | NOT NULL | — | `amount bigint >0` |
| 8 | `amount_filled` | bigint | NOT NULL | `0` | `amount_filled bigint >=0` |
| 9 | `status` | text | NOT NULL | `'open'` | `status` |
| 10 | `create_key` | text | NOT NULL | — | `create_key text NOT NULL UNIQUE` |
| 11 | `ledger_event_keys` | text[] | NOT NULL | `'{}'` | `ledger_event_keys text[] NOT NULL DEFAULT '{}'` |
| 12 | `time_created` | timestamptz | NOT NULL | `now()` | `time_created` |
| 13 | `time_updated` | timestamptz | NOT NULL | `now()` | `time_updated` |

约束（逐名现取）：`market_order_pk` PK(`order_id`) / `market_order_create_key_uniq` UNIQUE(`create_key`) / `market_order_side_enum` CHECK(`side IN ('buy','sell')`)**〔取值来自 DL68 的 `side='buy'`/`'sell'` 分式，见 §3 口径 B〕** / `market_order_quote_cid_is_one` CHECK(`quote_cid = 1`)〔DL64「恒 = 1」〕/ `market_order_cid_distinct` CHECK(`base_cid <> quote_cid`)〔R39〕/ `market_order_price_positive` CHECK(`price > 0`) / `market_order_amount_positive` CHECK(`amount > 0`) / `market_order_amount_filled_nonneg` CHECK(`amount_filled >= 0`) / **`market_order_filled_le_amount` CHECK(`amount_filled <= amount`)**〔§6.4 注释逐字〕/ `market_order_status_enum` CHECK(`status IN ('open','partial','filled','cancelled')`)〔见 §3 口径 C〕/ FK `market_order_owner_fk → users(uid)` + `market_order_base_fk` + `market_order_quote_fk → currency(cid)`。

### 2.2 `public.market_trade` —— §6.4 列清单 **10 列**（实测列数 10；append-only）

`trade_id` bigint identity PK / `base_cid` FK currency / `quote_cid` FK currency / `price` bigint / `amount` bigint / `buy_order_id` FK market_order / `sell_order_id` FK market_order / `taker_uid` FK users / `fee` bigint NOT NULL DEFAULT 0 / `time_created` timestamptz NOT NULL DEFAULT now()。
约束：`market_trade_pk` / `market_trade_price_positive` CHECK(`price > 0`) / `market_trade_amount_positive` CHECK(`amount > 0`) / `market_trade_fee_nonneg` CHECK(`fee >= 0`) / `market_trade_cid_distinct` / `market_trade_pair_distinct` CHECK(`buy_order_id <> sell_order_id`) / FK ×5。
**断言反面**（apply-time 自检强制）：`create_key` / `ledger_event_keys` / `time_updated` **不得**存在（§6.4 列清单未含 ⇒ 逐列照办；见 §3 口径 E）。

### 2.3 `public.candle_view` —— §6.4 **8 列**、**视图非表**（DL66 / C9）

列（现取类型）：`base_cid` bigint / `quote_cid` bigint / `bucket_start` **timestamptz** / `open` bigint / `high` bigint / `low` bigint / `close` bigint / `volume` **numeric**。
- `information_schema.tables` 中 `candle_view` **不在** `BASE TABLE`（`table_type='VIEW'`；`public` 视图清单 = `["candle_view"]`）⇒ DL66「不落表」成立；apply-time 自检亦断言其**不是**基表。
- 聚合口径（DL66 逐字）：`date_trunc('minute', time_created)` 分桶；`open`/`close` = 桶内首/末笔（`ORDER BY time_created, trade_id` 决定唯一序）、`high/low` = max/min、`volume` = Σ`amount`。
- **聚合语义已实测**（artifact `p3m-20260928T104700Z-view-candles.json`）：视图行与**独立** GROUP BY 聚合**逐桶逐字节相等** `view_equals_manual_aggregation=true`（7 桶；例 `2026-09-28 10:44:00+00 → open/high/low/close=10, volume=5`）。
- **桶宽缺口**：DL66 写 `'minute'|'hour'` 两档而视图列只有一个 `bucket_start` ⇒ 本迁移取**分钟桶**（小时档可由 `date_trunc('hour', bucket_start)` 上层聚合；**不新建第二个视图名** —— 那会自创对象名）。

### 2.4 函数 / 触发器 / 索引

| 类 | 对象 | 实测 |
|---|---|---|
| 函数 | `public.market_post_event(jsonb)` | **30194 B** / md5 **`74841611252726e1cc0f57cb46ea6c6d`**（`length()`=28848 字符） |
| 函数 | `public.market_order_status_transition_ok(text,text)` | 223 B / md5 `545518bcd9f0379119a944b5eefc370f` |
| 函数 | `public.market_order_status_guard()` | 474 B / md5 `3d14452a75bafc683c71bb892bcc717f` |
| 函数 | `public.market_trade_append_only()` | 256 B / md5 `9090b9683a4f31080edc75cdfbd87066` |
| 函数 | `ledger_post_event`（**未改**） | **51429 B / `d94dd902697dfe60aba409d808c6d63a`**（DL142） |
| 触发器（7，全 `tgenabled='O'`） | `market_order`: `trg_market_order_{amount_filled,core_immutable,create_key,status,touch_time_updated}_guard`（5×BEFORE UPDATE）+ `trg_market_order_no_delete`（BEFORE DELETE）；`market_trade`: `trg_market_trade_append_only`（**BEFORE UPDATE OR DELETE**） | 7/7 `O`；**全库非 `O` = 0** |
| 索引（**恰好 3**） | `market_order_pk` / `market_order_create_key_uniq` / `market_trade_pk` | 见下「部分唯一索引」 |
| 外键结构 | 指向 `market_*` 的外部 FK **只有** `market_trade_buy_fk` / `market_trade_sell_fk → market_order`；指向 `ledger_entry` 的 FK = **0**（R21/DL78） | ✅ |

**部分唯一索引：`0` 个 —— 判定为「无」，非遗漏。依据**：§6.4 **未列索引清单**（对照 §6.3 的 DL63 明列 4 个），而 DL74 规定「业务表索引按 §6 各表的清单执行，**新增须说明**」⇒ 本迁移**不擅自增**，只建约束自带索引（PK ×2 + `create_key` 唯一 ×1），并由 apply-time 自检**反断言**「不得有多出的索引」。

---

## 3. §6.4 缺口登记与工程口径（**不发明**；每条给依据与处置）

| # | 缺口 / 张力 | 处置（本迁移实际做法） | 依据 |
|---|---|---|---|
| A | §6.4「撮合串行化所需对象」未点名具体对象 | 查库现取：串行化手段是**内建** `pg_advisory_xact_lock`（DL68 原文）⇒ **无新对象可建**。本迁移**未**在编排函数内加 advisory lock —— §7.1 的成交由**调用方给出的撮合决策**驱动（见 B），串行化属撮合服务；DL68 该行自标「**P0 未实测项**」⇒ 不预埋、不改口径 | DL68 · DL69（不建新表）· §6.1 `0016` 行「撮合串行化所需对象」 |
| B | **撮合算法（价格—时间优先 / 价差改善）§6.4 未定义** | **不发明撮合**：`op='trade'` 的 `buy_order_id`/`sell_order_id`/`price`/`amount`/`fee`/`fill_no` **由调用方显式给出**，本函数只做「业务行 + 分录同一事件」的**记账编排与守恒** | §6.4 无撮合规则行；DL141 只约束加锁顺序 |
| C | `market_order.status` 的**转移白名单** §6.4 未逐条枚举 | 取**最小集**：`open→{partial,filled,cancelled}`、`partial→{filled,cancelled}`；`filled`/`cancelled` = **终态**（负集 9 条已实测，见 K3） | DL68 的 `status IN ('open','partial')` + §7.1「撤单（全量或部分）」 |
| D | `side` 取值未枚举 | CHECK(`side IN ('buy','sell')`) | DL68「`side='buy'`/`side='sell'`」 |
| E | DL75「每张业务表三件套」 vs §6.4 的 `market_trade` 列清单**未含** `create_key`/`ledger_event_keys`/`time_updated` | **逐列照办**（不加）：`market_trade` 是 DL76 的**不可变族**（事件载体），其幂等由账本键 `biz:market:trade:…` 承担；DL75 的落点建议正是「全部**新表**」而 §6.4 是逐列契约 ⇒ 以逐列契约优先，冲突**登记**（apply-time 自检反断言这三列不存在） | §6.4 行清单 > DL75 的通用句；DL99 只对「无分录的写」要求业务侧幂等键 |
| F | `quote_cid` **恒 = 1** 如何落实 | CHECK `market_order_quote_cid_is_one` + 函数闸 `QUOTE_CID_MUST_BE_ONE`（双闸同判据） | DL64「恒 = 1 … 但要显式存列」 |
| G | **价差改善**（成交价 ≠ 买单限价）无处分录 | 显式拒：`MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`（实测 K5/b14）。理由：§7.1+DL85 把成交事件钉死为 **6 条分录**，价差改善需要第 7 条「释放多余冻结」⇒ 越白名单。**需要新裁定** | §7.1 ③ 成交行 + DL85「超范围即拒绝」 |
| H | **零额手续费**（`fee=0`）是否写 `trade_fee` | **不写**：此时成交事件 = `trade` ×4（实测 K3：4 条、kinds=`[trade]`、Σ=0）；`fee>0` 时 = `trade` ×4 + `trade_fee` ×2（实测 K1：6 条） | R44「零额手续费不写 fee 分录」的同族口径；DL85 的「2 条」按 `fee>0` 读 |
| I | `amount_filled` 只增不减（§6.4 只有 `>=0` 与 `<= amount`） | 加守卫：减 ⇒ 拒（`market_order_amount_filled_monotonic`）；超 `amount` 由 CHECK 拒（实测 23514） | §6.4 的 CHECK + DL68 判据 5 的自洽要求（推定，**已登记**） |
| J | R28 的币种状态闸该作用于哪个币 | 挂单/成交的 **base** 用既有 `ledger_assert_currency_op(cur,'hold')`（= listed 才可）；挂单/撤单的**分录币种**由账本按 `currency_op='hold'`/`'hold_release'` 判（**同真源，不造第二套矩阵**）。撤单用 `hold_release` ⇒ **四态全可**（冻结中的币也能解冻退钱） | R28 · 现取 `ledger_assert_currency_op` 体 |

---

## 4. 应用与幂等（artifact `p3m-20260928T102206Z-migrate-rerun.json`）

| 步 | 命令 | 退出码 | 读数 |
|---|---|---|---|
| 首轮 apply | `npx ts-node --transpile-only scripts/migrate.ts` | **0** | `"0016" →{"action":"applied","checksum":"f5ce7c79c584","ms":12515}`；**前 15 条全 `skipped`（checksum match）**；`schema_version=0016`；`public_base_table_count=15` |
| rerun | 同上 | **0** | `skipped = 16/16`，`non_skipped = []`；`ok=true`；`schema_version=0016`；tables 15 |

- **首次 apply 即成功**（无 `FAILED` / 无 `ABORT` 记录 ⇒ apply-time 自检（DL48）与整链路一次通过）。
- `schema_migration` 第 16 行（现取）：`version=0016` / `name=0016_market.sql` / `checksum=f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df`（**== 文件 sha256**，现取两侧）/ `applied_at=2026-09-28 10:20:11.637287+00`。
- ⚠️ **观察（非本单范围、未处置）**：registry 里 `0013` 行的 `name` 为 `0013_job_core.sql`，而盘上文件名为 `0013_job.sql`。`migrate.ts` 只按 `version` + `checksum` 匹配（不比对 `name`）⇒ **无功能影响**；本单**未**改动它（`0001`–`0015` 冻结）。

---

## 5. 库侧指纹（迁移后；artifacts `…T103457Z-fingerprint-post.json` 与 `…T104603Z-fingerprint-post.json`）

| 项 | 迁移前 | 迁移后（现取） |
|---|---|---|
| `public` 基表数 | **13** | **15**（+`market_order`、+`market_trade`；`candle_view` 是视图**不计**） |
| `public` 视图 | 0 | **1**（`candle_view`） |
| `schema_version` / registry 行数 | `0015` / 15 | **`0016`** / **16** |
| 逐列 | — | `market_order` **13 列** / `market_trade` **10 列** / `candle_view` **8 列**（§2 逐列） |
| 约束 / 索引 / 触发器 | — | 见 §2.4；触发器 **7/7 `O`**，全库非 `O` = **0**；索引**恰好 3**；部分唯一索引 **0**（依据见 §2.4） |
| 外部 FK | — | 仅 `market_trade.{buy,sell}_fk → market_order`；`→ ledger_entry` = **0** |
| `public` 函数数 | 62 | **71**（+9，全名列于 artifact：`market_post_event`、`market_order_status_transition_ok`、`market_order_{status,amount_filled,core_immutable,create_key,no_delete,touch_time_updated}_guard`、`market_trade_append_only`） |
| 不变量 | `cid=1` Σ(balance+frozen) = 8400 == `total_supply` 8400 | **8400 == 8400**（未变） |
| `ledger_post_event` | 51429 B / `d94dd902…` | **51429 B / `d94dd902697dfe60aba409d808c6d63a`（未变）** |

**新表逐列 / 约束 / 索引 `indexdef` / 触发器 `tgenabled` 的完整机器读数**（含每条 `pg_get_constraintdef` 与 `pg_get_triggerdef`）落在 artifact `p3m-20260928T104603Z-fingerprint-post.json` 的 `market_order_columns` / `market_trade_columns` / `candle_view_columns` / `market_constraints` / `market_indexes` / `market_triggers` / `market_indexes[].indexdef` 段。

---

## 6. 行为用例（**10 条，10/10 通过**；artifact `.p3m-artifacts/p3m-20260928T104241Z-cases.json`）

夹具：uid **990501–990504**（`buyer/seller/seller2/spare`）；base 币 = **`cid=170` `p1u4P04B`（decimals=0，listed）**，基座水来自存量持有人 **954001**；`create_key` 前缀 **`cli:kong16-`**；运维/注资键前缀 **`ops:p3m:`**。本趟对象：`market_order` 26/27（+ 后续 33/34…），`market_trade` 7/8。

| id | 判定 | **头号读数（现取，逐字）** |
|---|---|---|
| **K1a** | ✅ | 买单挂单 `order_id=26`、`status=open`、`frozen_hold=50`、entries **2**、kinds `[hold]`、**Σ(delta+frozen_delta)=0**；buyer `$` **547/40 → 497/90**（balance −50、frozen +50）；账本 `ref_type='market_order'`、`ref_id=26` |
| **K1b** | ✅ | 卖单挂单 `order_id=27`、`frozen_hold=5`、kinds `[hold]`、Σ=0；seller base **179/0 → 174/5**（R34/R39：同 uid 同 cid 两条） |
| **K1** ★头号 | ✅ | **首笔成交**：`trade_id=7`、`txid=5899`、entries **6**、kinds `[trade,trade_fee]`、**Σ=0**；两条挂单 `partial/partial`、`amount_filled 3/3`；成交行 `amount=3 price=10 taker_uid=990501 fee=1`；买方 `$` **497/90 → 496/60**（frozen −30、可用 −1 = 手续费）、买方 base **21 → 24**（+3）；卖方 `$` **240**（+30）、base **174/2**（frozen −3）；平台 `−1` **9**（+1）；6 条分录 `ref_type='market_trade'`、`ref_id=7` |
| **K2** | ✅ | **DL149 不双写**：同键重放 trade ⇒ `idempotent_replay=true`、`txid=5899`（**同首次**）、`amount=3`、`buy_amount_filled=3`；重放 order ⇒ `true`、`txid=5897`；`ledger_entry` **2593 → 2593**（+0）、`market_trade` 行 **7 → 7**（+0）、`amount_filled` **3 → 3**、两挂单行与成交行 **JSON 逐字相等**、`ledger_event_keys` **逐字不变**（`["cli:kong16-…-sell1","biz:market:trade:26:1"]`） |
| **K3** | ✅ | 纯函数 **正 5/5**（`open→{partial,filled,cancelled}`、`partial→{filled,cancelled}`）、**负 9/9**（含 `filled→cancelled`、`cancelled→*`、`*→自身`）；**终态后再迁移**：一次性全额成交（`trade_id=8`、`fee=0` ⇒ **4 条**、kinds `[trade]`、Σ=0）后 `filled`(`amount_filled=5`)，再 `cancel` ⇒ **`LD011` / `MARKET_ORDER_STATE_INVALID`**，`ledger_entry` **2603 → 2603**（零写入） |
| **K4** | ✅ | **守卫矩阵 12/12 拒**：`owner_uid/side/base_cid/quote_cid/price/amount/create_key` 逐个改 ⇒ `LD011`；`amount_filled` 回退 ⇒ `LD011`；`amount_filled` 超额 ⇒ **`23514`**；`DELETE market_order` ⇒ `LD011`；`UPDATE market_trade` ⇒ **`LD029`**（`LEDGER_APPEND_ONLY_VIOLATION`）；`DELETE market_trade` ⇒ **`LD029`**；**对照项** `open→partial` 正常通过（`rows=1`，证明尺子不滥杀） |
| **K5** | ✅ | 边界 **18 条原始读数**：`op_unknown LD016/UNKNOWN_MARKET_OP`｜`side_unknown LD016/UNKNOWN_MARKET_SIDE`｜`price_zero LD017/LEDGER_AMOUNT_NOT_POSITIVE`｜`amount_zero LD017`｜`amount_negative LD017`｜`quote_cid_not_one LD016/QUOTE_CID_MUST_BE_ONE`｜`base_eq_quote LD016/BASE_QUOTE_CID_EQUAL`｜`key_no_prefix LD005/PREFIX_REQUIRED`｜`key_reserved_sep LD005/RESERVED_SEPARATOR`｜`owner_platform LD021/PLATFORM_OWNER_FORBIDDEN`｜`base_cid_not_found LD007/LEDGER_CURRENCY_NOT_FOUND`｜**`base_not_listed LD008/LEDGER_CURRENCY_NOT_LISTED`**｜`cancel_missing_order LD022/order_not_found`｜`trade_price_ne_buy_limit LD016/MARKET_PRICE_MUST_EQUAL_BUY_LIMIT`｜`trade_amount_over_remaining LD001/market_order_amount_insufficient`｜`trade_same_order_id LD019/self_trade_not_allowed`｜`trade_taker_not_a_party LD022/order_not_found`｜`insufficient_balance_hold LD001/LEDGER_INSUFFICIENT_BALANCE`；**不存在 FK**（裸 INSERT）⇒ **`23503` / `market_order_base_fk`** |
| **K5b** | ✅ | **自成交**（买/卖两单同 owner 990503）⇒ `LD019` + `reason=self_trade_not_allowed` + detail `{uid:990503, field:owner_uid, buy_order_id:33, sell_order_id:34}`（函数闸与账本 `v_from = v_to` 同判据双闸） |
| **K1c** | ✅ | **撤单**：`order_id=27` ⇒ `status=cancelled`、`frozen_hold=2`、entries **2**、kinds `[hold_release]`、Σ=0；seller base **174/2 → 171/0**（释放剩余冻结 2 回余额） |
| **K6** | ✅ | **结算链守恒**：本趟 **10 个事件全部 Σ(delta+frozen_delta)=0**，且 kind 恰在白名单内（`order→[hold]`、`cancel→[hold_release]`、`trade→[trade,trade_fee]` 或 `[trade]`）；**平台账户**：`uid=−1` 收 `trade_fee` **4 条**，`uid∈{0,−2,−3}` 在本柱命名空间 **0 行**；**`cid=1` 收工 Σ(balance+frozen) = 8400 == total_supply 8400**（前/后同值）；**DL68 判据 5 对账**（本片夹具）：账本在冻额 `$` **140** == business 表 `Σ(amount−amount_filled)×price` **140**，base **4** == **4**（26 张夹具挂单） |

---

## 7. 判负自证（尺子必须会响；artifact `.p3m-artifacts/p3m-20260928T104520Z-falsify.json`）

**改坏的一处结构性保证**：`public.market_order_status_transition_ok` 的 `ELSE false`（终态无出边）⇒ `ELSE true`（终态出边被打开）。**改在 scratch 副本**（`$TMPDIR/p3m-0016-scratch-<run>.sql`），**主工作区文件只被读**。

| 相 | 动作 | 读数（现取） | 判定 |
|---|---|---|---|
| **GREEN（改坏前，库内原版）** | 对 `filled` 夹具单（`order_id=1`）直接 `UPDATE status='cancelled'` | **拒**：`LD011` / `LEDGER_CURRENCY_INVALID_TRANSITION` / `reason=MARKET_ORDER_STATE_INVALID` / detail `{from:"filled", to:"cancelled", order_id:"1"}` | ✅ 期望 |
| | 同状态经 `market_post_event(op='cancel')` | **拒**：`LD011` / `MARKET_ORDER_STATE_INVALID` | ✅ 期望 |
| **RED（装入坏版函数，字节取自 scratch 副本）** | 同一条 `UPDATE` | **不拒**：`rowCount = 1`（终态被改写！）⇒ **尺子响** | ✅ **RED 达成** |
| | 经 `market_post_event(op='cancel')` | 拒因**变为** `market_order_nothing_to_release`（**不再是** `MARKET_ORDER_STATE_INVALID`）⇒ K3 断言必红 | ✅ **RED 达成** |
| **RED 修复自带** | `ROLLBACK`（同一事务） | 坏版函数被撤销：`prosrc` md5 `ebef7432…` ⇒ **回 `545518bcd9f0379119a944b5eefc370f`**；被改的单 `status` 回 `filled` | ✅ |
| **GREEN（复原后）** | scratch 副本**逐字节回写** pristine | sha256：`f5ce7c79…`（pristine）→ `cbcf7653…`（broken）→ **`f5ce7c79…`（restored，与 pristine 相等）** | ✅ |
| | 再量同一条 `UPDATE` / 函数 | **拒**：`LD011` / `MARKET_ORDER_STATE_INVALID`（两路同前） | ✅ **GREEN 回绿** |
| 主工作区未被碰 | `migrations/0016_market.sql` | sha256 前后 **`f5ce7c79…` 相等**；`mtime` 前后相等；`size` **70570 B → 70570 B**（同值） | ✅ |
| 零扰动 | 目标单 / 账本 | `status: filled → filled`；`ledger_entry` **2609 → 2609** | ✅ |
| 冲突行归属 | `foreign_rows_present` | **`[]`**（`market_order` 非 `cli:kong16-%` = 0；owner 出窗 = 0；`market_trade` taker 出窗 = 0；`ref_id IS NULL` 的 `market_order` 行 = 0） | ✅ **未触发「立停上报」** |

**7/7 判定全真**：`green_before_rejects / red_broken_upd_succeeds / red_broken_fn_reason_changed / green_restored_rejects / sha_after_equal_pristine / workspace_untouched / zero_perturbation`。

---

## 8. 未验证清单（枚举到边界；一律 `NOT_MEASURED`，不填 0）

1. **真并发**（两连接抢同一 `market_order` 行 / 同一币对撮合 / 同键并发新事件）：未实测。
2. **DL68 的 `pg_advisory_xact_lock(hash(币对))` 撮合串行化**：**未实现**（DL68 自标 P0 未实测；撮合决策在调用方 ⇒ 本函数只做记账编排）。落地撮合服务时**须**补测与补裁。
3. **价差改善**（成交价 ≠ 买单限价）：本实现显式拒绝（§3 口径 G）⇒ 语义未验证，需新裁定。
4. **小时桶 K 线**：未实现（只做分钟桶）；DL150 的升级门槛（性能实测 + 新 DL 规则）未触达。
5. **护栏旁路**：`TRUNCATE market_order/market_trade`、`ALTER TABLE … DISABLE TRIGGER USER`：未实测（既有表禁 TRUNCATE；本表 TRUNCATE 会毁掉 append-only 审计残差）。
6. **`quote_cid ≠ 1`（未来多基础货币）**：被 CHECK + 函数闸拒绝，未实测（DL64 明写未来形态）。
7. **`ledger_max_single_amount()` 上界与 bigint 溢出的具体边界**：代码路径存在（`OVER_MAX_SINGLE_AMOUNT`）但**未触达**。
8. **maker 侧手续费口径**：R47 只裁「承担方 = taker」⇒ maker 侧未定义（未验证）。
9. **部分唯一索引**：§6.4 未规定 ⇒ 本柱无（判定「无」而非「遗漏」）。
10. **K 线在大表下的性能**：未实测（DL150 的性能实测脚本未建）。
11. **多币对 / 其他 base 币的 K 线桶**：本单只对 `base_cid=170` 逐桶对拍（其余币对未逐一验证）。
12. **`migrate.ts` registry `name` 列与文件名不一致**（§4 观察项）：非本单范围，未处置。

---

## 9. 库侧副作用登记（**不清理**）

- **`public.users`**：新增 uid **990501 / 990502 / 990503 / 990504**（窗口 9905xx；窗口外用户被本单触碰数 = 0）。
- **`public.market_order`**：**26 行**（全 `create_key LIKE 'cli:kong16-%'`、owner 全在 9905xx；出窗行 = 0）。含两次探针缺陷运行（`…T103505Z` / `…T103647Z`）与最终趟的夹具，状态分布 `open/partial/filled/cancelled` 各有。
- **`public.market_trade`**：**8 行**（append-only ⇒ 不可清理）。
- **`public.ledger_entry`**：**2471 → 2609（+138）**；其中 `biz:market:*` **46 条**（hold/cancel/trade 事件）、`cli:kong16-*` **52 条**（挂单 hold 事件）、`ops:p3m:*` **40 条**（注资/搬水）。**平台账户**：仅 `−1` 因 `trade_fee` 增加（终态 9）；`0/−2/−3` 无本柱分录。
- **注资来源**：`$` 由既有存量账户搬水（`transfer`，只动可用余额）；base 币（`cid=170`）由存量持有人 **954001** 转入本单夹具。**`cid=1` 的 `total_supply` 未动**（8400 前后同值；`Σ(balance+frozen)` 亦 8400）。
- **未清理理由**：DL79 禁物理删除业务行 + 题面「登记不清理」。
- **未触碰**：`0001`–`0015` 的迁移字节与 registry 行、既有 13 张基表的结构与（除上述搬水外的）数据、`frontend/`、`src/`、`docs/*.spec.md`、`docs/qa/**`、`docs/versions/**`、`docs/seafood.master-plan.md`。

---

## 10. 受限小项落地（`docs/audit/p3-listing-0015.md`，**仅那两处**）

现取：195 行 / 21625 B / sha256 `d3285b634a2a22d1c6ebaee2283a84f6a3fc349b6b8f26c227ad08c578028013`；`git diff --numstat docs/audit/p3-listing-0015.md` = **10 / 0**（**含空白行**口径）。

1. **§2b 加更正注**（原文逐字保留不删）：说明已由 `docs/qa/p3-0015-listing-review.md` §3 用**字节级 v2 体**（`git show bf5129b:` + 同事务 `ROLLBACK`）**证伪** —— v2 下成功退款**全程 ok**（仅 `extra.currency_status=null`）；机制 = 未赋值 `record` 的 `IS NULL` 返回 `TRUE`、`55000` 只在**取字段**时抛；**v3 的实际效果 = 回填 `extra.currency_status`**；并指出该断言**无自身读数支撑**（其 3 份 cases artifacts 里 `55000`/`v_cur` **零命中**）。
2. **§5 首测叙述加更正注**：首测 **5/6** 的失败项是 **K2（漏 `await`）与 K4（`sqlstate` 为 `null`）**，**不含 K6、不含 `55000`**（并指出与 §2b 的自相矛盾，§2b 已就地更正）。

---

## 11. 逐项判定表

| # | 项 | 判定 | 证据 |
|---|---|---|---|
| 1 | `0016_market.sql` 新建、逐列照 §6.4（不增删列 / 不自创列名）、自带幂等 + apply-time 自检 | ✅ **通过** | §2 逐列（13/10/8）+ §2.4 对象清单；§3 七条缺口**逐条登记**；§4 首次 apply 即 exit 0（自检未拦） |
| 2 | 应用（干净 apply） | ✅ **通过** | §4：exit 0、`0016 applied`、`schema_version=0016`、registry 16 行、checksum == 文件 sha256 |
| 3 | 再跑一次 ⇒ 全 `skipped`、exit 0 | ✅ **通过** | §4：**16/16 `skipped`**、`non_skipped=[]`、exit 0 |
| 4 | 只读探针 `p3m-*.ts` + run-tagged 读数落 `.p3m-artifacts/` | ✅ **通过** | 6 支探针（含 5 支只读）；**11 份** artifact，文件名内嵌 UTC 时间戳、同名拒写（`save()` 内置） |
| 5 | 行为用例 ≥6 条 + 判负自证 | ✅ **通过** | 用例 **10/10**；判负自证 **7/7**（GREEN→RED→GREEN + sha 相等 + 工作区未被碰 + 零扰动） |
| 6 | 报告 `docs/audit/p3-market-0016.md` | ✅ **通过** | 本文件 |
| 7 | 受限小项（0015 报告两处更正注） | ✅ **通过** | §10（+10/−0，含空白行；原文保留） |

**失败 / 拦下项（与叙述一一对应，逐条列全）**

| 处 | 现象 | 归因 | 处置 |
|---|---|---|---|
| 探针 `p3m-02` 第 **1** 趟 | `FATAL`：`LD011 / MARKET_ORDER_STATE_INVALID`（对**已 filled** 的单执行 cancel ⇒ 函数按设计抛错，但该调用**未包在 `expectReject` 里**） | **探针用例顺序缺陷**（K3 的全额成交把 K1 的挂单填满，导致其后 K1c 的撤单失去标的） | 改为「K3 另起一对单」，重跑 ⇒ 通过 |
| 探针 `p3m-02` 第 **2** 趟 | `FATAL`：**`42P02 there is no parameter $1`** | **探针缺陷**（K6 的 `recon` 查询里写了 `$1::bigint` 却未传参） | 改为字面量内插（BASE 现取自库），重跑 ⇒ 通过 |
| 探针 `p3m-02` 第 **3** 趟 | **6/10**：`K1 / K2 / K5 / K1c` 红 | **全部为探针断言缺陷**（K1/K1c：用**绝对值**比对余额而夹具跨多趟累加 ⇒ 应为相对增量；K2：拿「创建时」的 `ledger_event_keys` 与重放响应比，而成交事件**本就**会向两挂单追加键 ⇒ 应比「重放前后」；K5：把 `LEDGER_AMOUNT_NOT_POSITIVE` 的 sqlstate 写成 `22023`，实测是 **`LD017`**） | 逐条改断言（相对增量 / 前后快照比较 / `LD017`），重跑 ⇒ **10/10** |
| **迁移本身** | **无失败项** | — | 首次 apply 即 exit 0；无 `FAILED` / 无 `ABORT` / 无 drift；`0001`–`0015` 未被触碰 |

> 说明：上表三趟红**全部**发生在**探针**层，与迁移对象无关；对应读数分别落 `.p3m-artifacts/p3m-20260928T103505Z-cases-FATAL.json`、`…T103647Z-cases-FATAL.json`、`…T103826Z-cases.json`（**同名拒写**，故三次运行各留一份）。

---

## 12. 冻结面零改动自证（现取）

- `git status --porcelain`（仓库根）：仅 **1 个 ` M docs/audit/p3-listing-0015.md`**（受限小项）+ 本单**新增未跟踪**产物（`backend-ts/migrations/0016_market.sql`、`backend-ts/scripts/p3m-*.ts`、`backend-ts/.p3m-artifacts/`、`docs/audit/p3-market-0016.md`）。
- `backend-ts/migrations/` 的 git 状态只有 `?? 0016_market.sql` ⇒ **`0001`–`0015` 零改动**（与 §4 的 15 条 `skipped/checksum match` 互为佐证）。
- **未写**：`backend-ts/src/**`（本单不接路由）、`frontend/**`、`docs/*.spec.md`、`docs/qa/**`、`docs/versions/**`、`docs/seafood.master-plan.md`、`scripts/p3f-*`/`p3l-*`/`p3s1-*`、`.p3f-/.p3l-/.p3s1-artifacts/**`。
- **未做**：commit / `git add` / push；未启常驻 server；未用 `pkill -f` / `killall`；未 `DROP`/`TRUNCATE` 既有表；未动既有 13 张表的**数据**（除 §9 登记的搬水）。
- `ledger_post_event` 51429 B / `d94dd902697dfe60aba409d808c6d63a` **未变**（DL142）；`ledger_post_event` / `job_post_event` / `listing_post_event` 的函数体**本单一字未改**。

---

## 附：本单新增 / 修改产物（现取 sha256 与尺寸）

| 路径 | 行 / 字节 | sha256 |
|---|---|---|
| `backend-ts/migrations/0016_market.sql` | 1201 / 70570 | `f5ce7c79c584805f1d97bb2468475b2ce10b770ef4dabd16e2ea79d5531b76df` |
| `backend-ts/scripts/p3m-lib.ts` | 184 / 9884 | （artifact 同目录；逐文件 sha256 见 `.p3m-artifacts/` 内各 `run` 段与该文件系统快照） |
| `backend-ts/scripts/p3m-00-state.ts` | 177 / 9750 | 同上 |
| `backend-ts/scripts/p3m-01-post.ts` | 135 / 7327 | 同上 |
| `backend-ts/scripts/p3m-02-cases.ts` | 389 / 30033 | 同上 |
| `backend-ts/scripts/p3m-03-falsify.ts` | 162 / 10392 | 同上 |
| `backend-ts/scripts/p3m-04-view.ts` | — / 2795 | `958b95d50c115579ddb66c35416bc24c56e48cd9e6d22580edc24db806c9d3e9` |
| `backend-ts/.p3m-artifacts/` | **11 份** run-tagged 读数 | `…-state-pre.json`、`…-ledger_post_event.prosrc.sql`、`…-migrate-rerun.json`、`…-fingerprint-post.json`（×2）、`…-cases.json`（×2）、`…-cases-FATAL.json`（×2）、`…-falsify.json`、`…-view-candles.json` |
| `docs/audit/p3-market-0016.md` | 本文件（**自指** sha256 不作判据；行数/字节/现取 sha256 见本单终局终端读数） | — |
| `docs/audit/p3-listing-0015.md`（仅两处加注） | 195 / 21625 | `d3285b634a2a22d1c6ebaee2283a84f6a3fc349b6b8f26c227ad08c578028013` |
