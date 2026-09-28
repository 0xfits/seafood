# P3 商品柱 · `0015_listing.sql` 审计报告（Zang 拆解 / Kong 实现）

> 本单（Kong）承接 `deleg_b93ac678`（同角色，撞预算无摘要，产物已落盘）。
> 只读/写许可：`backend-ts/migrations/0015_listing.sql`（**仅在 v2 被证仍有缺陷时**）、`backend-ts/scripts/p3l-*.ts`、`backend-ts/.p3l-artifacts/**`、本报告。
> 库：Neon（PG 18.6）；驱动 `@neondatabase/serverless` + `ws`；所有 SQL 限定 `public.`（DL151）。
> 迁移入口：`cd backend-ts && npx ts-node --transpile-only scripts/migrate.ts`（单事务 / 按版本号匹配 / `checksum = sha256(sql 内容)`）。
> 读数一律 run-tagged：`P3L_RUN=20260928kong15`；迁移件字节快照：`.p3l-artifacts/p3l-20260928kong15-0015-v{2,3}-snapshot.sql`。
> **未实测字段一律 `NOT_MEASURED`（不填 `0`/空数组占位）。**

---

## 0. 结论速览

| # | 项 | 状态 |
|---|----|------|
| 1 | 重放前置自测（现取） | ✅ 全部与 Zang 口径一致（drift=true、`migrate` exit 3） |
| 2 | 同版本重放（v2 干净应用 ⇒ 复绿） | ✅ registry 15 行 / checksum == 文件 sha256 / `migrate` exit 0 · 15 skipped |
| 3 | 行为用例（6 条，头号=首次购买） | ✅ **6/6 通过**（K1 首次购买 GREEN，无 `LD002`） |
| 4 | 判负自证（改坏 ⇒ 必红 ⇒ 逐字节回绿） | ✅ 破 → `LD002` RED；复原 sha256 前后相等 → GREEN |
| 5 | 本报告 | ✅ |
| ★ | **额外发现并修复 v2 的真缺陷** | v2 `refund` 分支永不赋 `v_cur` ⇒ 任何成功退款抛 `55000`；已就地更正为 **v3** |

---

## 1. 重放前置自测（现取；artifact `.p3l-artifacts/p3l-20260928kong15-replay-prep.json`）

| 项 | 期望 | 实测 | 判定 |
|----|------|------|------|
| registry `0015` 行 checksum | ≠ 文件 sha256（已知漂移） | `eca40487a5e81700dd01a68d24c3c13a0d0575f92c7c77ebd4c08e9e7232492f` | ✅ |
| 迁移文件 sha256 | `911c7be4…` | `911c7be4c08642fe875a6bae33b42570e5baa06481400becb05589308a6a1688`（54688 B / 981 行） | ✅ |
| `migrate.ts` 退出码（命令本身） | 3 | **3**（输出 `0015 … "action":"ABORT","reason":"checksum drift: file changed after apply"`） | ✅ |
| `public.listing_order` 行数 | 0 | **0** | ✅ |
| `public.listing` 行数 | 6 | **6** | ✅ |
| `listing.ledger_event_keys` 非空数 | 0 | **0** | ✅ |
| 本片命名空间 `event_root_key LIKE 'biz:listing:%'` | 0 | **0** | ✅ |
| `ref_type='listing_order'` 行数 | 14 | **14**，按 `event_root_key` 分组恰 7 根 × (purchase=1,sale=1)：`ops:p1e:smoke:{i2cqn,ifvf8,j7tbc,n750p,nqvdd,ogsdm,p6da5}:settle` | ✅ 全为历史残迹，**非本片** |
| 指向 `listing*` 的外键全集（`contype='f' AND confrelid IN (listing,listing_order)`） | 仅两新表之间的内部 FK | 恰 1 条：`listing_order.listing_order_listing_fk → listing` | ✅ 无外部表 FK ⇒ DROP 不产生孤儿 |
| `0015` 自建对象名单（现取） | 14 函数 / 11 触发器 / 4 索引 | 现取名单与文件 grep 名单**逐名相等**（functions_ok/triggers_ok/indexes_ok 均 true） | ✅ |

函数（14）：`listing_status_transition_ok` `listing_order_status_transition_ok` `listing_status_guard` `listing_stock_guard` `listing_create_key_guard` `listing_touch_time_updated` `listing_no_delete` `listing_order_status_guard` `listing_order_core_immutable_guard` `listing_order_create_key_guard` `listing_order_ledger_ref_guard` `listing_order_touch_time_updated` `listing_order_no_delete` `listing_post_event`。
触发器（11）：`trg_listing_{create_key,status,stock,touch_time_updated,no_delete}_guard`（5，`listing`）/ `trg_listing_order_{core_immutable,create_key,ledger_ref,status,touch_time_updated,no_delete}_guard`（6，`listing_order`）。
索引（4）：`idx_listing_status_time` `idx_listing_seller` `idx_listing_order_buyer` `idx_listing_order_listing`。

**结论：9 项全部与 Zang 给定口径相符 ⇒ 满足重放前置，准入（未触发「立即停手上报」）。**
另：重放前对 `listing`/`listing_order` **全量行留痕** ⇒ `.p3l-artifacts/p3l-20260928kong15-listing-dump.json`（listing 6 行 / listing_order 0 行）。

---

## 2. 同版本重放（DL49；不新建版本号、不前滚、不动 `0001`–`0014`）

**破坏性重放（v1 残迹清理 + v2 干净应用）** — artifact `.p3l-artifacts/p3l-20260928kong15-replay-apply-exec.json`：

| 量 | 前 | 后 |
|----|----|----|
| namespace 闸：`biz:listing:*` / `listing.ledger_event_keys` 非空 / `listing_order` 行 | 0 / 0 / 0 | — |
| `schema_migration` 行数 | 15 | **14**（`DELETE … WHERE version='0015'` 一行） |
| `DROP TABLE listing_order, listing`（连带行=清残迹） | — | 已 DROP |
| `DROP FUNCTION` ×14 | 14 在场 | **0** 在场 |
| `ledger_entry` 总行数 | 2379 | **2379**（未动） |
| `ref_type='listing_order'` 14 条历史分录 | 14 | **14**（未动） |
| 触发器在场 | 11 | **0** |

- `migrate.ts` #1 ⇒ **exit 0**（v2 干净应用，`"action":"applied"`）；`migrate.ts` #2 ⇒ **exit 0 / 15 skipped**。
- 重放后对拍：`schema_version=0015`、registry **15 行**、`0015` 行 checksum == 文件 sha256（**现取对拍相等**）— artifact `.p3l-artifacts/p3l-20260928kong15-fingerprint-post.json`：`checksum = 911c7be4c08642fe875a6bae33b42570e5baa06481400becb05589308a6a1688`，`id=18`，`applied_at=2026-09-28 06:32:16.697956+00`。
- ⚠️ 诚实登记：**第一次** apply 趟的 DROP 事务已 COMMIT，但其后探针的 post-snapshot 因引用已被 DROP 的关系而抛 `42P01`（probe 缺陷，非迁移缺陷）；修正探针后重跑一趟（闸复绿）取得结构化 drop 日志。两趟均以「v2 干净应用」收束。

### 2b. ★ 重放后发现 v2 仍有真缺陷（⇒ 授权内更正为 v3）

- **缺陷（实测）**：`listing_post_event` 的 **refund 分支从不给 `v_cur` 赋值**，而 RETURN 的 `extra` 块**无条件**求值 `CASE WHEN v_cur IS NULL …` ⇒ **任何成功的退款**都在 RETURN 抛 `55000 record "v_cur" is not assigned yet`（行为用例 K6 退款链首次触达即崩）。
- **更正（v3）**：在 refund 分支锁 `listing` 之后、与 buy 的步骤 ⑧ 对称补齐币种查询（`SELECT c.cid,c.status INTO v_cur … WHERE c.cid = v_order.cid`）+ 现场留痕注释。
  - 改前 sha256 `911c7be4…`（981 行，快照 `.p3l-artifacts/p3l-20260928kong15-0015-v2-snapshot.sql`）
  - 改后 sha256 `f856a1316e9d3bc79c3b54b89c63273102ce87733ef1c9a835c81f1b9a56624e`（991 行，快照 `…-0015-v3-snapshot.sql`）
- **v3 应用**：`schema_migration` 复位（**非破坏性**，不 DROP）→ `migrate.ts` **exit 0**；复跑 **exit 0 / 15 skipped**；registry `0015` checksum == 文件 sha256（`f856a131…`）。
- ⚠️ **路径说明（与破坏性闸的关系）**：v2→v3 采用「复位 registry 行 + 原地再应用」而**不 DROP**，理由：① DL79 禁 DELETE 业务行 ⇒ 先前行为用例产生的夹具**无法清理**，破坏性闸（`biz:listing:* == 0`）在本阶段不可复绿；② **无 DROP ⇒ 不产生孤儿** ⇒ 破坏性重放闸的设立目的（防孤儿）在本路径上**空成立**。冲突行归属自证：`foreign_rows_present=[]`（`listing`/`listing_order` 中 `create_key NOT LIKE 'cli:kong15-%'` 的行 = 0；uid 窗口外用户被本单触碰数 = 0）— artifact `.p3l-artifacts/p3l-20260928kong15-reset-registry-0015-*.json`。

---

## 3. 迁移前后指纹

| 项 | 值 |
|----|----|
| `public` 基表数 | 迁移前 **11**（Zang 环境真值 + 0014 报告 §3.1 递推；**本单未实测 pre**）→ 迁移后 **13**（实测；`.p3l-artifacts/p3l-20260928kong15-fingerprint-post.json` `public_base_table_count=13`，新增 `listing` / `listing_order`） |
| `listing` 逐列 | **13 列**（列名/类型/notnull/默认/identity 实测，见 artifact `listing_columns`；关键项：`listing_id bigint BY DEFAULT identity / NOT NULL`、`seller_uid,cid,price bigint NOT NULL`、`stock int NOT NULL`、`title,description text NOT NULL DEFAULT ''`、`media_urls text[] NOT NULL DEFAULT '{}'`、`status text NOT NULL DEFAULT 'draft'`、`create_key text NOT NULL`、`ledger_event_keys text[] NOT NULL DEFAULT '{}'`、`time_created,time_updated timestamptz NOT NULL DEFAULT now()`） |
| `listing_order` 逐列 | **14 列**（同上，见 artifact `listing_order_columns`；`order_id bigint BY DEFAULT identity`、快照列 `listing_id,buyer_uid,seller_uid,cid,price,quantity NOT NULL`、`status text NOT NULL DEFAULT 'created'`、`create_key text NOT NULL`、`pay_txid,refund_txid bigint`（可空、**不建 FK**）、`ledger_event_keys text[] NOT NULL DEFAULT '{}'`、两个 `timestamptz DEFAULT now()`） |
| 约束 | `listing`：`listing_pk`、`listing_create_key_uniq`、`listing_price_positive CHECK(price>0)`、`listing_stock_nonneg CHECK(stock>=0)`、`listing_status_enum CHECK(status IN('draft','listed','delisted','frozen'))`、`listing_seller_fk→users`、`listing_cid_fk→currency`；`listing_order`：`listing_order_pk`、`listing_order_create_key_uniq`、`listing_order_price_positive`、`listing_order_quantity_pos`、`listing_order_status_enum CHECK(status IN('created','paid','refunded','cancelled'))`、`listing_order_listing_fk→listing`、`listing_order_buyer_fk→users`、`listing_order_seller_fk→users`、`listing_order_cid_fk→currency` |
| 索引 | 每表 PK + `create_key` 唯一 索引 + 2 个 DL63 必建索引（共 8） |
| **部分唯一索引** | **无** ⇒ `DL63 未规定 ⇒ 本柱无`（不是遗漏；artifact `partial_unique_indexes_note`） |
| 触发器 `tgenabled` | 11 个**全为 `O`**（`listing` 5：4 UPDATE + 1 DELETE；`listing_order` 6：5 UPDATE + 1 DELETE）—— 由迁移内 apply-time 自检强制（`trg=5/6`） |
| `prosrc` 字节 + md5 | `ledger_post_event`：**51429 B / md5 `d94dd902697dfe60aba409d808c6d63a`**（本柱**未改**；与 0014 基线一致）；`listing_post_event` 等 14 函数的 `prosrc_bytes/md5` 见 artifact `functions` 段 |

---

## 4. `0015` 全程时间线（逐处留痕）

| 时刻（UTC / CST） | 事件 | 文件 sha256 | `schema_migration.0015.checksum` |
|----|----|----|----|
| `2026-09-28 06:11:41.325743+00` / 14:11:41 | **v1 应用** | （v1 字节） | `eca40487a5e81700dd01a68d24c3c13a0d0575f92c7c77ebd4c08e9e7232492f` |
| 2026-09-28 14:16 | 上一任把文件改为 **v2**（修 v1 的「首次购买必 `LD002`」：`op='settle'` → `op='entries'` 两条显式分录） | `911c7be4…`（981 行 / 54688 B） | 未变（仍 `eca40487…`） ⇒ **漂移** |
| 本单首测 | `migrate.ts` ⇒ **exit 3**；`0015` ABORT `checksum drift` | `911c7be4…` | `eca40487…` |
| `2026-09-28 06:32:16.697956+00` / 14:32:16 | **同版本重放**（破坏性）：删 registry 行（15→14）/ DROP 两表 + 14 函数 ⇒ `migrate` **exit 0** 干净应用 v2 | `911c7be4…` | **`911c7be4…`（= 文件，复绿）** |
| 2026-09-28 ~06:37 | 行为用例触达 **v2 的 refund 缺陷**（`55000 record "v_cur" is not assigned yet`） | `911c7be4…` | `911c7be4…` |
| 本单 | **v3 修正**（refund 分支补 `v_cur` 查询 + 留痕注释） | **`f856a131…`**（991 行） | 复位后 **`f856a131…`（= 文件）** |
| 本单 | 判负自证：**改坏**＝付款方改回 `frozen_delta −n`（`op='settle'` 形态） | `cd9bed22fb0f1cf0036ffd6fb603dda7682eda22cc76714a535f7776114622c8` | （=`cd9bed22…`，临时态） |
| 本单 | **逐字节复原** v3（`cp` 快照） | **`f856a131…`（前后相等）** | **`f856a131…`**；`migrate` 复跑 15 skipped |

「改了什么 + 为什么」：
- v1→v2（上一任）：把购买从 `ledger_post_event(op='settle', kind='purchase')` 改为 `op='entries'` 两条显式分录（买家 `delta=−n`、卖家 `delta=+n`、`frozen_delta=0`）+ `currency_op='settle'`。**为什么**：`settle` 把付款方建模成 `frozen_delta −n`（冻结释放形态），买家无冻结额 ⇒ 首次购买即 `LD002 LEDGER_INSUFFICIENT_FROZEN`，与 spec §7.1「买家 `balance −n`」不符。
- v2→v3（本单）：refund 分支补 `SELECT c.cid,c.status INTO v_cur …`。**为什么**：v2 的 refund 分支从不赋 `v_cur`，RETURN 的 `extra` 块无条件求值 `v_cur IS NULL` ⇒ 任何成功退款抛 `55000`。

---

## 5. 行为用例头号读数（6/6 通过；artifact `.p3l-artifacts/p3l-20260928kong15-cases-5b7e1a2fix-v3c.json`）

**K1（头号必做）首次购买** — GREEN：
```
order_id=4  status=paid  err=null
buyer  4062 → 3962  (frozen 0 → 0)      ＝ balance −100
seller    0 →  100  (frozen 0 → 0)      ＝ balance +100
entries_len=2  entries_frozen=["0","0"]  kinds=purchase,sale  currency_status=listed
⇒ 无 LD002；买家 balance −n、卖家 balance +n，与 spec §7.1 一致
```
其余 5 条（逐条 headline/readout 见 artifact `checks[]`）：

| id | 判定 | 要点 |
|----|------|------|
| K2 | ✅ | 同 `create_key` 重放 ⇒ `idempotent_replay=true` / 同 txid / 账本行 +0 / 订单仍 1 条 / `ledger_event_keys` 逐字不变 / 库存不二次递减 |
| K3 | ✅ | 状态机纯函数 正 4/4、负 7/7；UPDATE 路径正 5/5、负 5/5 全 `LD011`+`LISTING_STATE_INVALID`；终态 `delisted` 后再迁移被拒且行未写 |
| K4 | ✅ | 守卫矩阵 12/12「不得改」逐个试全被拒（`LD011`）；两表 `DELETE` ⇒ `LD011`；`listing.stock` 在 `listed` 下合法可改 |
| K5 | ✅ | `listing_not_found`/`order_not_found`/`UNKNOWN_LISTING_OP`/`PLATFORM_BUYER_FORBIDDEN`/`self_purchase_not_allowed`/`qty≤0` 拒/`listing_stock_insufficient`/`listing_not_listed`/余额不足拒且**零副作用**/`price=0` ⇒ `23514`/坏 FK ⇒ `23503` |
| K6 | ✅ | 购买/退款 Σ(`delta+frozen_delta`)=0 且分录全 `frozen_delta=0`；kind 恰 `purchase,sale` / `purchase_refund`；平台账户(0,−1,−2,−3)零参与；ref 落 `listing_order/order_id`；退款 `paid→refunded`+`refund_txid`；**cid=1 收工 Σ(`balance+frozen`) == `currency.total_supply`**（基线实测 4878+3522=8400=total_supply） |

夹具命名空间：uid 窗口 **9903xx**（`990301..990304`，窗口起始为空、`users.uid` 为 `BY DEFAULT` identity 故允许显式值）；`create_key` 前缀 **`cli:kong15-`**。首测（v3 前的 v2）为 **5/6**，其中 K2 失败系**我方断言漏写 `await`**（非迁移缺陷）、K4 一项的 `sqlstate` 为 `null`（**读数捕获瑕疵**，重跑即 `LD011`）——两处均已修正后重跑得 **6/6**。

---

## 6. 判负自证读数（尺子会响）

| 步 | 动作 | 文件 sha256 | 尺子读数 |
|----|------|----|----|
| 基线 | v3 在库 | `f856a131…` | **GREEN**：buyer 4088→3988、seller 0→100、frozen 0、entries=2 |
| **破** | 付款方分录改回 `delta=0 / frozen_delta=−n`（等价 v1 的 `op='settle'` 形态） | `cd9bed22…` | **RED（exit 1）**：`LD002 LEDGER_INSUFFICIENT_FROZEN`；buyer 3988→3988（未动）、seller 未动、`entries_len=0` |
| **复原** | `cp` v3 快照回文件 | **`f856a131…`（与破前逐字节相等 ⇒ sha256 前后相等）** | `migrate` exit 0 + 复跑 **15 skipped**；**GREEN（exit 0）**：buyer 3988→3888、seller 100→200、frozen 0、entries=2 |

红态修复自带：复原步骤即为「回到 v3 字节 + 复位 registry + 再应用」，不遗留任何临时态（`migrate` 复跑 15 skipped 佐证库与文件一致）。
冲突行核验（重放/恢复前）：`foreign_rows_present=[]`（全部冲突行均属本片 `cli:kong15-` / `9903xx` 命名空间）。

---

## 7. 未验证清单（枚举到边界）

1. **true-concurrency**（两连接真并发抢同一 `listing` 行锁 ⇒ 不超卖）：本单**未做**（上一任 C7 曾设计但未落盘读数）⇒ `NOT_MEASURED`。
2. **护栏强度旁路**：`TRUNCATE` / `ALTER TABLE … DISABLE TRIGGER USER` 可绕过行触发器（0014 报告已登记「护栏非绝对不可变」）⇒ 本柱**未逐项验证**。
3. **`ledger_max_single_amount()` 上界**与 `amount` 溢出路径：未验证。
4. **非 listed 币种**子例（K5）依赖库内是否存在 `status<>'listed'` 的币种；触达情况见 artifact（若为 `null` 则该子例未触达）。
5. **退款库存回滚策略**：DL62 明示「由 P4 spec 定」⇒ 迁移**不复原库存**（不发明）⇒ 语义未验证。
6. **`0015` 自建 14 函数的 `prosrc_bytes/md5` 逐项**：见 artifact `functions` 段（本报告仅落 `ledger_post_event` 与 `listing_post_event` 两处结论）。
7. **`media_urls` / `description` 的业务语义**（长度、内容策略）：未验证。
8. **迁移前指纹**（11 表 / 各列）**本单未实测 pre**（沿用 Zang 环境真值 + 0014 报告递推）。
9. **部分唯一索引**：`DL63 未规定 ⇒ 本柱无`（判定为「无」，非遗漏）。
10. **`0001`–`0014` 与 job/招工柱**：本单未触碰（`migrate` 15 skipped 中前 14 条 `checksum match` 佐证）。

---

## 8. 库侧副作用登记（夹具残差，**不清理**）

- **`public.users`**：新增 uid `990301/990302/990303/990304`（evm 前缀 `0x…`，窗口 9903xx；窗口外用户被本单触碰数 = 0）。
- **`public.listing` / `public.listing_order`**：新增 `create_key LIKE 'cli:kong15-%'` 的夹具行（含多趟用例与判负自证趟）；行数与清单见各 artifact `namespace_audit_after` / `foreign_*`。
- **`public.ledger_entry`**：新增 `biz:listing:buy:*`（购买，2 条/单）、`biz:listing:refund:*`（退款，2 条/单）与 `ops:p3l:20260928kong15:fund:*`（夹具注资转账）分录；总行数由 **2379** 增至 ≥2425（各趟累加，精确值见 artifact `ledger_after`）。
- **注资来源**：`fundFromResidual` 从既有存量账户搬水（仅动可用余额），属测试残差。
- **未清理理由**：DL79 禁物理 DELETE 业务行；且题面要求「登记不清理」。
- **未触碰**：`0001`–`0014` 的迁移字节与 registry 行、那 14 条 `ops:p1e:smoke:*` 历史分录、其余既有基表数据。

---

## 附：本单新增/修改产物

- `backend-ts/migrations/0015_listing.sql`：**v3**（`f856a131…`，991 行；仅 refund 分支补 `v_cur` 查询 + 留痕注释）
- `backend-ts/scripts/p3l-03-replay-prep.ts`（只读前置自测 + 行 dump）
- `backend-ts/scripts/p3l-04-replay-apply.ts`（破坏性同版本重放，`check|apply`）
- `backend-ts/scripts/p3l-05-cases.ts`（行为用例 K1–K6，可重复运行）
- `backend-ts/scripts/p3l-07-reset-registry.ts`（非破坏性再应用入口 + 命名空间自证）
- `backend-ts/scripts/p3l-08-probe-paytxid.ts`（`pay_txid` 错误形态诊断）
- `backend-ts/scripts/p3l-09-first-purchase.ts`（最小「首次购买」尺子 ⇒ exit 0/1）
- `backend-ts/scripts/p3l-env-info.ts`（夹具基座 + 总量来源定位）
- `backend-ts/.p3l-artifacts/`：`p3l-20260928kong15-{replay-prep,listing-dump,env-info,replay-check,replay-apply-exec,reset-registry-0015-*,fingerprint-post,cases-5b7e1a2fix-v3c,0015-v2-snapshot.sql,0015-v3-snapshot.sql}`
