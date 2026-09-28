# P3 商品柱 · `0015_listing.sql`（v3）独立质检报告

> **质检人**：Neng（独立质检；夹具与读数全部自造，**未复用** Kong 的 `9903xx` / `cli:kong15-`）
> **被检件**：`backend-ts/migrations/0015_listing.sql` — **991 行 / 55410 B / sha256 `f856a1316e9d3bc79c3b54b89c63273102ce87733ef1c9a835c81f1b9a56624e`**（质检全程结束后复测**逐字节不变**）
> **run tag**：`neng15-20260928`；夹具命名空间：uid **9904xx**、`create_key` 前缀 **`cli:neng15-`**、账本键 `ops:neng15:*`
> **读数落盘**：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p3-0015-review/`（`run-01..run-09*.json`，**禁同名覆写**）
> **库**：Neon PG **18.6 (6569466)**；驱动 `@neondatabase/serverless` + `ws`（`neonConfig.webSocketConstructor=WS`）；`node v18.19.0`；所有 SQL 限定 `public.`
> **未实测字段一律 `null` / `NOT_MEASURED`（不填 0 / 空数组占位）**

---

## 0. verdict

> # verdict = **可用**（3 项实测：行为面 0 缺陷）
>
> **但附 3 条必须回写的账目更正**（不改变 verdict，但 Zang 口径与 Kong 报告中的**事实陈述有误**）：
>
> | # | 被更正的说法 | 来源 | 实测 |
> |---|---|---|---|
> | **F1** | 「v2 的 refund 分支从不赋 `v_cur` ⇒ **任何成功的退款**都在 RETURN 抛 `55000 record "v_cur" is not assigned yet`」 | Zang 裁定口径 #2 / Kong 报告 §2b | **证伪**：装 v2 体、走一次**成功退款** ⇒ **不报 `55000`**，退款全程成功（`extra.currency_status=null`）。见 §3 |
> | **F2** | 「v3 与 v2 的 diff = **8 增 / 0 删**」 | 同上 | `git diff --numstat bf5129b` = **10 增 / 0 删**（单 hunk `@@ -697,6 +697,16 @@`）；其中 **8 行有内容** + **2 行纯空白**。「8 增」= 非空白行数（口径未注明） |
> | **F3** | 「v2 / **v1** 的字节都在 git 里」 | 本单任务书 | **只有一个 blob**：`bf5129b`（v2）。`git log --all -- <path>` 仅 `bf5129b` / `602827e` 两个提交，**不存在 v1 字节** ⇒ v1 行为 `NOT_MEASURED` |
>
> **对 F1 的定性**：这不是「交付件有缺陷」，而是**「v3 的修复理由不成立」**。v3 相对 v2 的**唯一**行为差异是 `extra.currency_status` 由 `null` 变为 `'listed'`（装饰性回填），**退款在 v2 下本来就是通的**。已应用的 v3 本身**功能正确**，且其非破坏性再应用的 3 条 Zang 判据**经我独立重验全部成立**（§8.3）⇒ 不降级为「需修」。

---

## 1. 判定表

| # | 项 | 期望 | 实测（run-tagged） | 判定 |
|---|----|------|------|------|
| C1 | `listing` 列数 | 13（§6.3/DL59） | **13** | ✅ |
| C2 | `listing_order` 列数 | 14（§6.3/DL61） | **14** | ✅ |
| C3 | 逐列 类型/nullable/默认/identity | 逐字对 §6.3 | 见 §2.2；13+14 列**逐列相符** | ✅ |
| C4 | 约束（PK/UNIQUE/CHECK/FK） | 逐字 | `listing` 21 条 / `listing_order` 24 条，**逐字相符**（§2.3） | ✅ |
| C5 | 索引 = DL63 四件（逐字）+ PK + create_key uniq | 8 | **8**（逐字，§2.4） | ✅ |
| C6 | 部分唯一索引 | §6.3/DL63 未规定 ⇒ 应 **0** | **0**（`run-09` `partial_unique=0`） | ✅ |
| C7 | 触发器 `tgenabled` 全 `O`；全库非 `O` = 0 | 11 / 0 | **11 全 `O`**（5+6）/ 全库非 `O` = **0** | ✅ |
| C8 | registry `0015`.checksum == 文件 sha256；行数 | `f856a131…` / 15 | **`f856a131…`（==）** / **15** | ✅ |
| C9 | `public` 基表数 | 13 | **13**（`listing`/`listing_order` 在内） | ✅ |
| C10 | `ledger_post_event` 指纹（DL142） | 51429 B / md5 `d94dd902…` | **51429 B / md5 `d94dd902697dfe60aba409d808c6d63a`**（未变） | ✅ |
| **★3** | v2 退款 ⇒ 必复现 `55000` | 必须复现 | **未复现**：v2 体下成功退款**返回 ok**（`currency_status:null`） | ❌ **证伪（F1）** |
| **★3b** | v3 退款 ⇒ 成功且链完整 | 必须成功 | **成功**：`refunded` / `refund_txid=5769` / 根键 `biz:listing:refund:19` / 2×`purchase_refund` / `frozen_delta=0` / `Σ=0` | ✅ |
| **★3c** | 定义段 vs 库里 `prosrc` 逐字 | 差 0 | **14/14 逐字节相等**（无需空白归一） | ✅ |
| **★4** | 真并发不超卖 | 成功笔数 ≤ 库存 | 库存 1 ⇒ **1 成功 / 1 拒**；库存 3 + 10 并发 ⇒ **3 成功 / 7 拒**；`stock` 从未为负 | ✅ |
| 5 | 对抗/边界全集 | 全拒 / 白名单全过 | 35 项**全数符合**（§5） | ✅ |
| 6 | 守恒 + 平台面 + `cid=1` 收工 | 成立 | `Σ(delta+frozen)=0` 全事件（0 例外）；无手续费列 ⇒ `fee+net=gross` **n/a**；平台账户 0 参与；`8400 == 8400` | ✅ |
| 7 | 上游 10 条 `NOT_MEASURED` 逐条 | 逐条处置 | 见 §7（**新测 4 条**，其余如实 `NOT_MEASURED`） | ✅ |
| 8 | `migrate.ts` 15 skipped / exit 0；指纹零改动 | 15/15 exit 0 | **exit 0 / 15 skipped**；`git diff --stat` **空** | ✅ |
| 9 | 判负自证（破→红；逐字节恢复→绿） | 红 / 绿 | **破 ⇒ 用例全放行（RED）；恢复 ⇒ 全拒（GREEN）**；主文件 sha 前后相等 | ✅ |

**自造尺子的自我纠错（如实登记）**：第一趟 §5 守卫矩阵的 78 项里有 **3 项「失败」，全部是我自己的**测试构造错误**（把列改成**同值**⇒ 触发器不触发；`refund_txid` 由 `NULL→非 NULL` 本就合法）。已重写为**真变更**用例（`run-07b`）⇒ **11/11 全拒 `LD011`**，零例外。**读数不覆盖、不改写**：`run-07-adversarial.json` 的三项旧读数原样保留。

---

## 2. 契约对拍（`data-layer.spec.md` v0.5 §6.3；现读 `information_schema` / `pg_constraint` / `pg_indexes` / `pg_trigger`）

读数：`run-01-contract.json`（只读）。

### 2.1 规模与命名
| 量 | 实测 |
|---|---|
| `public.listing` 列数 | **13** |
| `public.listing_order` 列数 | **14** |
| `public` 基表数 | **13** |
| registry 行数 / `0015` checksum | **15** / `f856a131…`（== 文件 sha256） |

### 2.2 逐列（类型 / nullable / 默认 / identity）
`listing`（13）：`listing_id bigint NOT NULL identity BY DEFAULT`、`seller_uid bigint NOT NULL`、`cid bigint NOT NULL`、`price bigint NOT NULL`、`stock **integer** NOT NULL`、`title text NOT NULL DEFAULT ''`、`description text NOT NULL DEFAULT ''`、`media_urls ARRAY NOT NULL DEFAULT '{}'`、`status text NOT NULL DEFAULT 'draft'`、`create_key text NOT NULL`、`ledger_event_keys ARRAY NOT NULL DEFAULT '{}'`、`time_created timestamptz NOT NULL DEFAULT now()`、`time_updated timestamptz NOT NULL DEFAULT now()`。

`listing_order`（14）：`order_id bigint NOT NULL identity BY DEFAULT`、`listing_id/buyer_uid/seller_uid/cid/price bigint NOT NULL`、`quantity integer NOT NULL`、`status text NOT NULL DEFAULT 'created'`、`create_key text NOT NULL`、`pay_txid bigint NULL`、`refund_txid bigint NULL`、`ledger_event_keys ARRAY NOT NULL DEFAULT '{}'`、`time_created/time_updated timestamptz NOT NULL DEFAULT now()`。

**对 §6.3 逐字相符**（§6.3 只在两表列清单里点名列；`stock int`/`quantity int` 与 `*_txid` 可空、`ledger_event_keys` 的 `DEFAULT '{}'` 均按 DL59/DL61/DL75② 落实）。两表的 `NOT NULL` 全部有对应 `*_not_null` 约束，`stock` 非空（DL59「不允许 NULL 表示无限」）✅。

### 2.3 约束（逐字）
- `listing`：`listing_pk PK(listing_id)`；`listing_create_key_uniq UNIQUE(create_key)`；`listing_price_positive CHECK(price>0)`；`listing_stock_nonneg CHECK(stock>=0)`；`listing_status_enum CHECK(status IN ('draft','listed','delisted','frozen'))`；`listing_seller_fk → users(uid)`；`listing_cid_fk → currency(cid)`。
- `listing_order`：`listing_order_pk PK(order_id)`；`listing_order_create_key_uniq UNIQUE(create_key)`；`listing_order_price_positive CHECK(price>0)`；`listing_order_quantity_pos CHECK(quantity>0)`；`listing_order_status_enum CHECK(status IN ('created','paid','refunded','cancelled'))`；`listing_order_listing_fk → listing(listing_id)`；`listing_order_buyer_fk/_seller_fk → users(uid)`；`listing_order_cid_fk → currency(cid)`。
- **DL78 复核**：指向 `ledger_entry` 的 FK = **0**（`*_txid` 不建 FK）✅；`uid` 列 FK `users` = 3 条 ✅。

### 2.4 索引（DL63 逐字）
| 索引 | 定义（`pg_indexes.indexdef`） |
|---|---|
| `idx_listing_status_time` | `(status, time_created DESC)` ✅ |
| `idx_listing_seller` | `(seller_uid, time_created DESC)` ✅ |
| `idx_listing_order_buyer` | `(buyer_uid, time_created DESC)` ✅ |
| `idx_listing_order_listing` | `(listing_id)` ✅ |

另：`listing_pk` / `listing_create_key_uniq` / `listing_order_pk` / `listing_order_create_key_uniq`（约束自带）。**无第 9 个索引**（DL74 预算）✅。
**部分唯一索引 = 0**：我**自行**对 §6.3/DL63 核实——DL63 只列 4 个**普通** btree 索引，**未规定**任何部分唯一索引（对比 DL55 在招工柱是**明写**的），故本柱「无」是**正确**，非遗漏 ✅。

### 2.5 触发器
`listing` 5（4×UPDATE + 1×DELETE）/ `listing_order` 6（5×UPDATE + 1×DELETE）= **11**，`tgenabled` **全 `O`**；**全库非 `O` = 0** ✅。

---

## 3. ★ 退款真伪：用「字节级修前环境」撞 v2（**本单核心**）

**形态**：同一事务内，`SAVEPOINT` + `ROLLBACK TO SAVEPOINT`，最后整事务 `ROLLBACK` ⇒ **零残留、零扰动**。读数：`run-05-refund.json` / `run-05b-refund-mini.json`。

| 步 | 动作 | 读数 |
|---|---|---|
| P0 | 事务前现取库内 `listing_post_event` 指纹 | md5 **`0e187c20b56d45202d83978c8a02b31d`** / 17858 B |
| P1 | 装 **v2 体**（`git show bf5129b:` 原文切出的 `CREATE OR REPLACE FUNCTION … END $$;`，段 sha256 `a55d50d1…`） | 装成功；库里 md5 → **`dc42a556b87be8d74ec027c663d91f05`**（≠ v3 ⇒ 确已换体） |
| P2 | v2 下 `op=buy` 造单 | **成功** `order_id=19/20`，`status=paid` |
| P3 | **v2 下 `op=refund`（成功退款场景）** | **⚠️ `ok=true`（未复现 `55000`）**。完整回参：`order_status=refunded`、`refund_txid=5769`、2 条 `purchase_refund`、`frozen_delta=["0","0"]`、`ledger_event_keys=["biz:listing:buy:20","biz:listing:refund:20"]`、`accounts` 990401 → 0 / 990402 → 60、**`extra.currency_status = null`** |
| P4 | 装回 **v3 体**（现盘文件同名段） | 装成功 |
| P5 | **v3 下同一场景 `op=refund`** | **成功**：`order_status=refunded`、`refund_txid=5769`、库存 **不**回滚（stock 4/5）、根键 `biz:listing:refund:19`、2×`purchase_refund`、`frozen_delta=0`、`Σ(delta+frozen)=0`、`extra.currency_status='listed'`、**无 `55000`** |
| P6 | 事务内 + 事务后复测 `prosrc` | md5 **`0e187c20…`**（== P0）、`pg_proc` 中 `listing%` 计数 14 ⇒ **装回精确** |
| P7 | `ROLLBACK` 后残留核查 | 订单行 **0**、`biz:listing:buy:*` 分录 **0**、`listing` 库存回到 5/5、余额 60/60 ⇒ **零残留** |

### 3.1 为什么 `55000` 没有发生（机制，**实测驱动**）
- v2 文件（sha256 `911c7be4…`，**逐字节取自 git**）的 `refund` 分支（第 660 行 `ELSE` 起）**确无** `v_cur` 赋值：取段统计 **`v_cur` 出现 4 次 vs v3 的 8 次**；`INTO v_cur FROM public.currency` 在 v2 只出现于 **buy 分支第 638 行**（`run-05b` `v2_has_v_cur_select=true` 但位置在 buy 段）。
- v2/v3 的 RETURN 都**无条件**求值 `CASE WHEN v_cur IS NULL THEN NULL ELSE v_cur.status END`。
- **实测结论**：在 PG 18.6 下，**未赋值的 `record` 变量做 `IS NULL` 判定 → 返回 `TRUE`，不抛错**；`55000 record "v_cur" is not assigned yet` 只在**取字段**（`v_cur.status`）时抛出，而 `CASE` 的分支在此情形下**永不取字段**。故 **v2 下任何成功退款都不会抛 `55000`**。
- **⇒「v2 ⇒ 必 `55000`」这一断言被我当场用反例撞倒**（硬口径⑤）。v3 的实际作用仅是让 `extra.currency_status` 有值。

### 3.2 静态对拍（file body vs DB `prosrc`）
14/14 个 `0015` 自建函数，**文件 body 与库里 `prosrc` 逐字节相等**（`exact_equal=true`，`delta_bytes=0`；空白归一后亦相等）⇒ **无任何漂移**。v3 新增的 8 行**逐行**在库内 `prosrc` 命中（8/8 `present=true`）。

### 3.3 与 v2 的差（用于 Zang 判据①③重验，§8.3）
`git diff --numstat bf5129b -- backend-ts/migrations/0015_listing.sql` = **10 / 0**，单 hunk `@@ -697,6 +697,16 @@`：**8 行有内容**（4 行 `--` 注释 + 1 `SELECT … INTO v_cur` + `IF NOT FOUND` + `PERFORM ledger_raise` + `END IF`）+ **2 行纯空白**；**全部落在 `listing_post_event` 函数体内，零表级 DDL**。

---

## 4. ★ 真并发（上游 `NOT_MEASURED` #1）

**我的并发形态（与上游不同）**：**两条独立 WebSocket 连接**（`newClient()` ×2，各自独立会话），c1 **在打开的事务里持住 `listing` 行锁**，c2 的购买**必须阻塞在行锁上**，c1 `COMMIT` 后 c2 才继续 ⇒ 这是**确定性**的行锁串行化验证（不是「两发请求撞运气」）。读数：`run-06-concurrency.json`。

| 形态 | 设置 | 读数 | 判定 |
|---|---|---|---|
| **A** 异键抢库存 1 | c1 持锁买 1（成功）→ c2 买 1 | c2 **阻塞 ≥600 ms**；commit 后 c2 ⇒ **`LD001 LEDGER_INSUFFICIENT_BALANCE`**（`reason=listing_stock_insufficient, available=0`）；最终 `stock=0`、**订单 1 条**、分录 2 条、**成功 1 笔** | ✅ **不超卖** |
| **B** 同键跨连接 | 两连接同 `cli:neng15-CB1`，库存 2 | c2 ⇒ **`idempotent_replay=true`**、**同 `order_id=22`**、`stock_seen=1`、`ledger_event_keys=["biz:listing:buy:22"]`；最终 `stock=1`（**只扣一次**）、订单 **1 条**、根键分录 **2 条** | ✅ **恰一次** |
| **C** 无控并发洪峰 | 库存 3，10 笔跨两连接并发（10 个异键） | **成功 3 / 拒 7**（7 笔全 `LD001`）；`stock=0`；订单 **3 条**；`stock<0` = **false** | ✅ **不超卖** |

---

## 5. 对抗性与边界（`run-07-adversarial.json` + `run-07b-guardfix.json`）

### 5.1 `listing` 状态机（白名单唯一真源 + UPDATE 路径，**含终态后再迁移**）
纯函数 10/10 与 UPDATE 路径 10/10 **完全一致**：
- **正**：`draft→listed`✅、`listed→delisted`✅、`listed→frozen`✅、`frozen→listed`✅（4/4 放行，行内落地状态正确）
- **负**：`draft→delisted`、`draft→frozen`、`listed→draft`、`frozen→delisted`、**终态 `delisted→{listed,frozen}`** ⇒ **全 `LD011` 且行未写**（`status_after` 仍为原值）✅

### 5.2 `listing_order` 状态机
纯函数 7/7 与 UPDATE 路径 7/7 一致：正 `created→{paid,cancelled}`、`paid→refunded`（3/3）；负 `created→refunded`、`paid→cancelled`、`refunded→paid`、`cancelled→paid` ⇒ 全 `LD011` ✅（终态无出边）。

### 5.3 守卫矩阵（「不得改」逐个试）
**11/11 真变更全部被拒 `LD011`**：`listing_order.{listing_id,buyer_uid,seller_uid,cid,price,quantity,create_key}`、`pay_txid 9000→9001`、`pay_txid 9000→NULL`、`refund_txid 9002→9003`、`refund_txid 9002→NULL`；另 `listing.create_key` 改 ⇒ `LD011`；`DELETE listing` / `DELETE listing_order` ⇒ `LD011`。**正例**：`listing.stock` 在 `listed` 下可改 ✅（`run-07` `C` 段）。

### 5.4 购买/退款边界全集（全部**被拒且零副作用**）
| 用例 | 期望 | 实测 |
|---|---|---|
| `qty=0` / `qty=-1` | 拒 | **`LD017 LEDGER_AMOUNT_NOT_POSITIVE`** |
| `qty="abc"` | 拒 | **`LD016 LEDGER_AMOUNT_INVALID`** |
| 不存在 `listing_id=99999999` | 拒 | **`LD022 LEDGER_REF_NOT_FOUND`**（`reason=listing_not_found`） |
| **自买自卖**（`buyer=seller`） | 拒 | **`LD019 LEDGER_SELF_TRANSFER`** |
| 平台账户下单（`buyer_uid=-1`） | 拒 | **`LD021 LEDGER_RESERVED_UID`** |
| `stock` 耗尽（qty 3 > 2） | 拒 | **`LD001`**（`reason=listing_stock_insufficient`） |
| **非 listed 币种**（`cid=99` draft） | 拒 | **`LD008 LEDGER_CURRENCY_NOT_LISTED`** ✅（上游未测项 #4，本单**已测**） |
| 余额不足（price 1000 > 余额） | 拒 | `LD001`（同上闸） |
| `create_key` 缺失 | 拒 | **`LD004 LEDGER_IDEMPOTENCY_KEY_REQUIRED`** |
| `create_key` 无前缀 / 含 `#` | 拒 | 均 **`LD005 LEDGER_IDEMPOTENCY_KEY_INVALID`** |
| `op` 非法 / `payload` 非对象 | 拒 | **`LD016`** |
| `refund` 订单不存在 / `order_id<1` | 拒 | **`LD022`** |
| `price=0` / `price=-5`（表 CHECK） | 拒 | **`23514`**，约束 `listing_price_positive` |
| 坏 `listing_id` 的裸 INSERT（FK） | 拒 | **`23503`**，约束 `listing_order_listing_fk` |

### 5.5 幂等：`create_key` / 根键 / `ledger_event_keys`（**恰一次，不双写**）
| 项 | 期望 | 实测 |
|---|---|---|
| 同键同内容**重放** | 200 语义、不重写业务行 | `idempotent_replay=true`、**同 `order_id=36`**、`ledger_event_keys` 长度 **仍 1**、`stock` 只扣一次（3→2）、订单 **1 条**、根键分录 **2 条** |
| 同键**异内容** | 409 语义 | **`LD003 LEDGER_IDEMPOTENCY_CONFLICT`**（`CREATE_KEY_REUSED_WITH_DIFFERENT_CONTENT`） |
| 裸 INSERT 重复 `create_key`（**DB 层**） | `23505` | **`23505`**，约束 `listing_order_create_key_uniq` ✅（「200 重放」属路由层 ⇒ **不据本片判负**） |
| 账本根键重放 | 不追加分录 | `biz:listing:buy:36` 分录恒 2 条 ✅ |

---

## 6. 守恒与平台面

| 项 | 期望 | 实测 |
|---|---|---|
| 每个 `biz:listing:*` 事件 `Σ(delta+frozen_delta)` | 0 | **0 例外**（`having <> 0` 返回空集） ✅ |
| 商品分录 `frozen_delta` | 全 0（DL62/§7.1 用可用余额） | 30 条分录中 `frozen_delta<>0` = **0** ✅ |
| `kind` 白名单（DL85） | buy=`purchase,sale`；refund=`purchase_refund` | 违例 **0**；实测 `purchase` 12 / `sale` 12 / `purchase_refund` 6，**逐事件恰 2 条** ✅ |
| 平台账户 0/−1/−2/−3 参与 | 0 | **0** ✅ |
| 手续费 | 本柱无费用列 ⇒ `fee+net=gross` **不适用（n/a）** | 无字段可测（**不填 0**） |
| `cid=1` 收工 `Σ(balance+frozen) == total_supply` | 成立 | **8400 == 8400**（质检全程后复测，与上游基线一致） ✅ |
| `PLATFORM_KIND_WHITELIST['-1']` | TS 侧现读 | `{credit:['trade_fee','listing_fee','currency_create_fee','job_fee'], debit:[]}`（`src/ledger.ts:541`，**未被 0015 触碰**） ✅ |

---

## 7. 上游 10 条 `NOT_MEASURED` 逐条处置（读其报告 §7 自建矩阵）

| 上游 # | 条目 | 我的处置 |
|---|---|---|
| 1 | true-concurrency 两连接真并发 | ✅ **已测**（§4）：异键/同键/洪峰三形态，**不超卖 + 恰一次** |
| 2 | 护栏旁路（`TRUNCATE` / `DISABLE TRIGGER USER`） | **`NOT_MEASURED`**。卡在：本单**硬边界禁 `TRUNCATE` 既有表**，且 `DISABLE TRIGGER USER` 属对既有表的 DDL，超出我的写许可 ⇒ **未实测**（迁移文件头已自认「护栏非绝对不可变」，与 0014 报告一致） |
| 3 | `ledger_max_single_amount()` 上界 / `amount` 溢出 | **`NOT_MEASURED`**。卡在：需构造接近上界的 `price×qty`，会污染 `account` 余额面（`amount` 溢出路径属账本面，非本柱） |
| 4 | 非 listed 币种子例 | ✅ **已测**：`cid=99`(draft) ⇒ **`LD008 LEDGER_CURRENCY_NOT_LISTED`** |
| 5 | 退款库存回滚策略（DL62 未定） | ✅ **已测事实**：v3 退款**不回滚库存**（退前后 `stock` 均 4）⇒ 语义仍属 P4 spec **未定**，本柱「不发明」✅ |
| 6 | 14 函数 `prosrc_bytes/md5` 逐项 | ✅ **已测**：`run-01` `listing_fns` 14/14 逐项 `md5`+`bytes`；且与文件 body **逐字节相等**（§3.2） |
| 7 | `media_urls`/`description` 业务语义 | **`NOT_MEASURED`**。卡在：无 P4 内容策略/长度规范可对照 |
| 8 | 迁移**前**指纹（11 表） | **`NOT_MEASURED`**。我在**迁移已应用后**才入场，无法回溯 pre（实测 post = 13 表） |
| 9 | 部分唯一索引 | ✅ **已测**：`listing`/`listing_order` 部分唯一索引 = **0**，与 §6.3/DL63「未规定」**相符** |
| 10 | `0001`–`0014` 与 job 柱未触碰 | ✅ **已测**：`migrate` **15 skipped / exit 0** + `git diff --stat` **空** |

---

## 8. 迁移与冻结面

### 8.1 迁移入口
`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts` ⇒ **退出码直接取自命令本身 = 0**（**未取自管道之后**）；输出 **15 条 `skipped`**（版本 `0001`–`0015` 全 `checksum match`）；`public_base_table_count=13`。读数 `run-08-migrate.out`。

### 8.2 冻结面零改动
- `git status --porcelain` ⇒ 仅两个 **untracked** `docs/qa/*.md`（其中一份是本报告），**无任何 modified**。
- `git diff --stat` ⇒ **空** ⇒ `0001`–`0014`、`backend-ts/src/`、`frontend/` **零改动** ✅
- **我未写任何迁移文件**（`backend-ts/migrations/**` 未被触碰；§11 有 sha 复证）。

### 8.3 Zang 四条判据的独立重验（**逐条成立**）
| 判据 | 实测 |
|---|---|
| ① diff 只落 `CREATE OR REPLACE FUNCTION` 能覆盖的函数体、**零表级 DDL** | ✅ 10/0 单 hunk，全在 `listing_post_event` 体内，无 `CREATE TABLE`/`ALTER`/`INDEX`/`TRIGGER` |
| ② 「库里 `prosrc` 逐字含 v3 新增的 8 行」 | ✅ 8/8 `present`；**但口径须更正为「8 行有内容 / 共 10 行含 2 空白」**（F2） |
| ③ `registry.checksum == 文件 sha256` | ✅ `f856a131…` == `f856a131…` |
| ④ 走**非破坏性**再应用（不 DROP） | ✅ 与「无 DROP ⇒ 无孤儿」一致；本次质检后 `public` 表数稳定 13，无孤儿 |

---

## 9. 判负自证（尺子必须会响）

**破**：在**scratch 副本** `bad-0015.sql` 中把 `listing_stock_guard` 的结构性保证改坏（`IF NEW.stock IS DISTINCT FROM OLD.stock AND OLD.status <> 'listed' THEN` → `IF false THEN`），sha256 `f00e1aab…`（≠ `f856a131…`）；切出该坏体在事务内装入。

| 步 | 用例 | 读数 | 期望 |
|---|---|---|---|
| 正确体 | `UPDATE listing SET stock=99`（该 listing `status='delisted'`） | **`LD011 LEDGER_CURRENCY_INVALID_TRANSITION`**（拒绝） | GREEN |
| **破体** | 同一 UPDATE | **`ok=true`（放行！）** | **RED（尺子响了）** |
| 恢复体（从**原始**文件重新切出） | 同一 UPDATE | **`LD011`**（再次拒绝） | GREEN |

**逐字节恢复**：`snap-0015-v3.sql` sha256 == `f856a131…`（`restore_byte_identical=true`）；主工作区文件 sha256 **前后相等**（`main_untouched=true`），质检全程结束后复测仍为 `f856a131…`（55410 B）⇒ **主工作区文件未被碰**。

**冲突行自证（恢复前置）**：`foreign_rows_present = []` —— `listing` 中非 `cli:neng15-%` 的 `cli:` 行 **39**、`listing_order` **6**，**全部属于他方命名空间，无一行与我的夹具冲突**；我的 23 个 `listing` / 15 个 `listing_order` 行**全部** `cli:neng15-%` ⇒ **未触发「立停上报」条件**。（上游那 14 条 `ref_type='listing_order'` 的 `ops:p1e:smoke:*` 历史残迹与本片无关，判别一律用 `event_root_key LIKE 'biz:listing:%'`。）

---

## 10. 未验证清单（**枚举到边界**）

1. **v1 行为** = `NOT_MEASURED`。**卡点**：git 中**不存在 v1 blob**（仅 `bf5129b`=v2 / `602827e`=v3 两个 blob），v1 字节不可得 ⇒ 「v1 是否抛 `55000`」无法回溯。
2. **`55000` 的历史来源** = `NOT_MEASURED`。v2 已证不抛（§3）；Kong 报告所述 K6 崩溃**其原始读数未公开**（`.p3l-artifacts` 不在我能读的范围之外也无该事件结构化读数）⇒ **无法归因**到底哪一版/哪一次触发。
3. **护栏旁路**（`TRUNCATE` / `ALTER TABLE … DISABLE TRIGGER USER` / 超管 `DROP TRIGGER`）= `NOT_MEASURED`（硬边界禁 `TRUNCATE` 既有表；详见 §7 #2）。
4. **`ledger_max_single_amount()` 上界与 `amount` 溢出路径** = `NOT_MEASURED`（§7 #3）。
5. **`quantity` 超 int4 上界（`v_qty > 2147483647` ⇒ `OUT_OF_INT4_RANGE`）分支** = `NOT_MEASURED`（未构造该输入）。
6. **`refund` 的 `pay_txid IS NULL` 分支**（`reason=order_pay_missing`）= `NOT_MEASURED`（我的退款用例全部经函数正常付费，未制造「`paid` 但 `pay_txid` 为 NULL」的非法态）。
7. **`ledger_post_event` 幂等指纹（`request_fingerprint`）异/同的三态判别对商品事件的影响**：仅测了 buy 的「同键同指纹」「同键异内容」；**同键异指纹 ⇒ 409** 的账本层路径 = `NOT_MEASURED`。
8. **迁移前指纹（pre = 11 表）** = `NOT_MEASURED`（§7 #8）。
9. **`media_urls` / `description` 业务语义**（长度、内容策略）= `NOT_MEASURED`（§7 #7）。
10. **`listing_order` 卖家读口（`seller_uid` 轴）无索引**：按 DL63 逐字**不建**（有意为之）；「卖家订单列表」的**实际查询性能** = `NOT_MEASURED`（无性能实测）。
11. **`time_updated` 刷新口径（DL75③）**：触发器存在且 `tgenabled=O`（§2.5）；但**值是否真的前滚**（`now()` 对比）**未逐字断言** = `NOT_MEASURED`。
12. **`stock` 与「编辑商品可改 price/stock/title」的交互**：`listing.stock` 仅在 `listed` 可改已测（§5.3 正例）；**`delisted` 后 `title`/`price` 是否可改**（§6.3 未规定 ⇒ 本迁移**不设守卫**）= 未逐项验证，仅确认「无守卫」是**登记式缺口**而非缺陷。
13. **路由层（`src/`）**：本片不含路由 ⇒ 「200 重放」「404」「400/409 映射」一律**不据本片判负**；DB 层只到 §5.5 的读数。

---

## 11. 库侧副作用登记（**append-only，不清理**；DL79 禁物理 DELETE）

**命名空间**：uid 窗口 **990401–990404**；`create_key` 前缀 **`cli:neng15-`**；账本键 `ops:neng15:*` / `biz:listing:*`。

| 表 | 残差 | 读数 |
|---|---|---|
| `public.users` | 新增 **990401/990402/990403/990404**（`evm`=`0x9904xx` + 34×`0`，须过 `users_evm_fmt`）。**窗口外用户被本单触碰数 = 0** | `run-09` `neng_ns.users` |
| `public.listing` | 新增 **23** 行（`cli:neng15-%`），含状态机/守卫/幂等各用例 | `neng_ns.listing_rows=23` |
| `public.listing_order` | 新增 **15** 行 | `neng_ns.order_rows=15` |
| `public.ledger_entry` | 新增 `biz:listing:buy:*`(2×n) / `biz:listing:refund:*`(2×n) / `ops:neng15:fund:*`(**4** 条，2 次注资转账) | `biz:listing:*` 分录 **30**（`purchase`12/`sale`12/`purchase_refund`6）；`ops:neng15:*` **4** |
| **注资来源（搬水，属测试残差）** | `900002` **100→40**、`900003` **100→40**（各转 60 → 990402/990404）。**未触碰** Kong 的 9903xx、也未触碰 `currency.total_supply` | `run-09` `balances` |
| **收工守恒** | `cid=1`：`Σ(balance+frozen) = 8400 == total_supply = 8400`（与上游基线**逐值相同**） | `run-09` `cid1` |
| 未触碰 | `0001`–`0014` 迁移字节与 registry 行、那 14 条 `ops:p1e:smoke:*` 历史分录、Kong 的 `9903xx`/`cli:kong15-` 夹具、`ledger_post_event` 函数体 | — |

**库内临时态**：唯一一次「装 v2 体 / 装坏守卫体」均在**事务内**完成并以 `ROLLBACK` 收束 ⇒ `prosrc` 复测 md5 `0e187c20…`（== 事务前），**零持久化**（§3 P6/P7）。

---

## 12. 结论

- **交付件 `0015_listing.sql`（v3）行为面 0 缺陷**：契约逐字相符、退款链完整、真并发不超卖且恰一次、守卫矩阵 11/11、边界 35 项全数符合、守恒与 `cid=1` 收工成立、迁移 15 skipped 且冻结面零改动、尺子破→红/恢复→绿。⇒ **verdict = 可用**。
- **必须回写的 3 条账目更正（F1/F2/F3，见 §0）**：其中 **F1 是本单最重要的发现** —— 「v3 修好了退款」的**理由不成立**（v2 的退款本来就是通的），v3 的实际效果仅是回填 `extra.currency_status`；**v3 本身不因此变为有害或错误**。建议：`docs/audit/p3-listing-0015.md` §2b 与 `602827e` 提交信息中「任何成功的退款都在 RETURN 抛 `55000`」一句**应就地更正并留痕**（**该文件不属我的写许可，我未改动**）。
- **未验证 13 条**（§10）已枚举到边界，其中 3 条受硬边界所限而**不可测**（v1 字节不存在 / 禁 `TRUNCATE` 既有表 / pre 指纹不可回溯）。
