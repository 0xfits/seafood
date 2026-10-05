# S36 / B14 · 隐式 identity-PK 插入三级盘点 + S36b 类级门与 R1 最小方案

> 角色：Kong（实现方，子代理）· 仓库 `/Users/kevin/bistro/seafood`（Express/TS + Neon PG18）
> 本单性质：**S36 的收尾单（S36b）**——上一单把盘点全做完但**报告未落盘**（工具迭代耗尽）；本单补写报告、
> 新立独立门、给 R1 最小方案草案（仅登记）。
> 硬口径遵守：**零产品改动**（未改 `backend-ts/src/**` / `frontend/**` / `migrations/**` / `docs/*.spec.md` /
> `docs/OPEN-ITEMS.md` / `docs/seafood.master-plan.md`）；连库**仅**进程内 `dotenv`（本单门与交叉复核**零 DB**）；
> **未** `pkill -f` / `killall`；**未**启停 5787/5788；**未** commit / push；**未** `npm install`；原始输出不用 `.log`。
> 产物目录：`backend-ts/.s36-artifacts/s36-20261005T050358Z/`（本单只**追加** `gate-*` 前缘件，**未覆盖**上单既有件）

---

## §0 对锚（开工前）

```
$ cd /Users/kevin/bistro/seafood && git log --oneline -3
1c52e2a docs: §5.355/v0.355 —— ★我裁 B6（两套取数入口）＝维持路径②并关闭（四条现取证据：p7a-03 已 PASS 基线 0 /
        错误链已统一 / fetchApiJson 已只做加法扩展 / ledger-api 唯一差异=顶层游标；合并=改契约触 91 文件、
        风险>>收益）+ 派 S35（Jing 规范收口）∥ S36（B14 只读盘点三级分级）
cc85754 chore: S33 死 CSS 阶段二（admin.html 未被服务/零引用/不引 styles.css ⇒ card/badge 约束解除；删 139 分片
        465 行，styles.css 1523->1060；三件判据全绿含浏览器复合形态探针 + revert 清单）+ S34 B16 定性
        （有意加严⇒前推 Y3/Y6 + REL_GREEN 闸门，未放宽判据）+ 台账 B12二/B16 闭环与新增 B17
771badc docs: §5.353/v0.353 —— 派 S33（B12 阶段二：先解 card/badge 约束 ⇒ 删第二批 + 三件判据含复合形态探针）
        ∥ S34（B16：p3v-00 Y3/Y6 定性，有意加严⇒前推 / 误伤⇒改判据，判不准即停下报回）

$ git status --porcelain | wc -l
295
```

**★ 开工时 tracked「M」只有两项，且均**非**本单所改（开工前既存）**：
```
 M docs/OPEN-ITEMS.md
 M docs/route-layer.spec.md
```
其余 `??` 为历次单既存的未跟踪产物目录（`.p8s*-artifacts/`、`.s36-artifacts/`、`frontend/.s33-artifacts/` 等）。

### §0.2 收工对锚（**开工后 HEAD 被并发会话推进，登记**）

```
$ git log --oneline -3            # 收工时
513ff5b docs: §5.356/v0.356 —— S35 核盘（route-layer v2.26 / 删除列=0 / 快照 cmp=0）+ S36 截断（盘点齐·报告未落盘）
        与 ★我亲验 188 处分级 R1=11/R2=43/R3=134 + 我的初判（**R2 立门优于改 43 处 / R1 登记 watch**）+ 派 S36b 收尾
ccfb23a docs: S35 —— B6 裁定落规范（route-layer v2.25⇒v2.26 ...）+ 快照 + delta + 台账 B6 翻为闭环
1c52e2a docs: §5.355/v0.355 —— ★我裁 B6 ... + 派 S35 ∥ S36（B14 只读盘点三级分级）      ← **本单开工锚**

$ git status --porcelain | wc -l
294                               # 294 = 开工 295 − 那两项 tracked M（已被上述 docs 提交收录）
$ git status --porcelain | grep -c '^ M'
0
```

**说明（不洗白）**：开工后、收工前，**并发会话（Zang 的 docs 单）**把 `docs/OPEN-ITEMS.md` /
`docs/route-layer.spec.md` 提交为 `ccfb23a` / `513ff5b` 两笔 docs 提交 ⇒ 开工时那两项「M」**已不在工作区**。
本单**自始至终未 commit / push、未改任何 tracked 文件**（`git status --porcelain | grep -c '^ M'` == 0），
故跟踪面上**本单零 tracked 改动**成立。
**★ 与派单初判对齐**：Zang 在 `513ff5b` 里写的初判是「**R2 立门优于改 43 处 / R1 登记 watch**」——
与本单交付（立独立门 + R1 仅登记草案）**一致**。

**上单已交产物（本单直接读、未重盘）**：`backend-ts/.s36-artifacts/s36-20261005T050358Z/`
`identity-columns.json` · `identity-columns.raw.json` · `implicit-inserts.json`（188 处逐处）·
`inventory-tables.md` · `r2-not-covered.txt`（43 处）· `raw-readings.txt` · `fn-md5.raw.json` · 三个只读探针
（`s36-probe-identity.ts` / `s36-scan-inserts.ts` / `s36-probe-fns.ts`）。

**本单新增三项**：
```
?? docs/audit/s36-implicit-identity-pk-inventory.md                          # 本报告
?? backend-ts/scripts/s36-00-identity-pk-form-gate.ts                        # ★ 新门
?? backend-ts/scripts/s36-00-identity-pk-form-gate.baseline.json             # 门基线（23 列 + 43 登记）
```
产物（追加到上单目录，`gate-*` 前缘）：`gate-realrepo-green.json` · `gate-selftest.txt` ·
`gate-negcontrol-01-baseline-green.json` / `-02-injected-red.json` / `-03-restored-green.json` ·
`gate-static-ddl-crosscheck.json` · `gate-readings.txt`。

**本单 tsc 双配置（硬口径①）**：
```
$ npx tsc --noEmit                                       # tsconfig.json（src/**）
TSC_SRC_EXIT=0
$ npx tsc -p tsconfig.scripts.json --noEmit | grep -c "error TS"
96                                                       # 开工前 = 96（存量债）
$ diff <(sort before) <(sort after)   -> IDENTICAL        # 新增错 = 0；grep 's36-00' -> 0 命中
```

---

## §1 真源表与列（双路取证）

### 1.1 路线 A —— 活库 `information_schema`（上单探针，逐列取证）

出处：`identity-columns.raw.json` / `s36-probe-identity.ts`（pg 直连 `information_schema.columns`，schema=`public`）。

```
identity_or_serial_cols_public = 23
  is_identity = YES            = 22
  serial(nextval default)      = 1        （schema_migration.id）
  tables_with_identity         = 23
  public BASE TABLE 总数       = 34
```

| 表 | identity 列 | generation | is_identity | owned sequence | count | max(PK) | seq_next | seq_next ≤ max(PK) |
|---|---|---|---|---|---|---|---|---|
| admin_ops_audit_log | log_id | BY DEFAULT | YES | public.admin_ops_audit_log_log_id_seq | 5 | 9 | 10 | False |
| admin_refund_audit_log | log_id | BY DEFAULT | YES | public.admin_refund_audit_log_log_id_seq | 7 | 7 | 8 | False |
| batt_entry | txid | ALWAYS | YES | public.batt_entry_txid_seq | 58 | 605 | 637 | False |
| checkin_log | log_id | BY DEFAULT | YES | public.checkin_log_log_id_seq | 4 | 227 | 250 | False |
| checkin_makeup_log | log_id | BY DEFAULT | YES | public.checkin_makeup_log_log_id_seq | 2 | 60 | 99 | False |
| commission_policy | policy_id | BY DEFAULT | YES | public.commission_policy_policy_id_seq | 4 | 34 | 35 | False |
| currency | cid | BY DEFAULT | YES | public.currency_cid_seq | 15 | 36 | 339 | False |
| currency_review_log | log_id | BY DEFAULT | YES | public.currency_review_log_log_id_seq | 0 | 0 | 39 | False |
| currency_status_log | log_id | BY DEFAULT | YES | public.currency_status_log_log_id_seq | 7 | 7 | 65 | False |
| job | job_id | BY DEFAULT | YES | public.job_job_id_seq | 45 | 253 | 265 | False |
| job_application | application_id | BY DEFAULT | YES | public.job_application_application_id_seq | 19 | 65 | 66 | False |
| job_arbitration_log | log_id | BY DEFAULT | YES | public.job_arbitration_log_log_id_seq | 0 | 0 | 29 | False |
| job_submission | submission_id | BY DEFAULT | YES | public.job_submission_submission_id_seq | 40 | 247 | 249 | False |
| ledger_entry | txid | ALWAYS | YES | public.ledger_entry_txid_seq | 502 | 2470 | 2564 | False |
| listing | listing_id | BY DEFAULT | YES | public.listing_listing_id_seq | 24 | 24 | 45 | False |
| listing_order | order_id | BY DEFAULT | YES | public.listing_order_order_id_seq | 18 | 20 | 40 | False |
| listing_order_event | event_id | BY DEFAULT | YES | public.listing_order_event_event_id_seq | 0 | 0 | 377 | False |
| listing_review_log | log_id | BY DEFAULT | YES | public.listing_review_log_log_id_seq | 0 | 0 | 20 | False |
| market_order | order_id | BY DEFAULT | YES | public.market_order_order_id_seq | 25 | 26 | 27 | False |
| market_trade | trade_id | BY DEFAULT | YES | public.market_trade_trade_id_seq | 8 | 8 | 9 | False |
| rating | rating_id | BY DEFAULT | YES | public.rating_rating_id_seq | 0 | 0 | 377 | False |
| schema_migration | id | serial/nextval | NO | public.schema_migration_id_seq | 42 | 42 | 43 | False |
| users | uid | BY DEFAULT | YES | public.users_uid_seq | 64 | 971213 | 42 | True |

**★ 关键读数**：`seq_next ≤ max(PK)`（即「撞号前置条件」）**仅 `users` 一项为 True**（seq_next=42 ≤ max=971213）；
但 `users` 走 **`getNextUserId = MAX(uid)+1`** 的代码路径、**不占用该序列**（见 §3.3 与 §6/N6），
⇒ **当前 23 表中无任何一表满足撞号前置条件**（`schema_migration.seq_next=43 > max=42` 亦为 False）。

### 1.2 路线 B —— 仓内迁移文书静态 DDL 复核（本单新增的第二路）

出处：`gate-static-ddl-crosscheck.json`。解析 `migrations/*.sql` **外加** `scripts/migrate.ts`
（`schema_migration` 是**自举建表**，不在迁移文书内）的全部 `CREATE TABLE ... ( ... );` 块，
抓 `bigint GENERATED (ALWAYS|BY DEFAULT) AS IDENTITY` 与 `bigserial|serial`。

```
route_a_live   = 23 列（information_schema）
route_b_static = 23 列（DDL 文本解析）
agree          = 23 / 23   （generation 归一后逐项一致：22×BY DEFAULT + 1×ALWAYS + 1×serial）
命名差 1 项：static 侧为 pre-0006 的 "user"，live 侧为 0006 `ALTER TABLE public."user" RENAME TO users` 之后的 users
             —— 同一列，非分歧。
```

**双路一致性结论**：表×列集合 23/23 全等，generation 逐项一致。真源可锚。

> 说明（诚实口径）：两路**输出**独立，但**输入**同仓（一路连活库、一路读仓内 DDL）；对「活库 ≠ 仓内 DDL」的
> 情形（如库端人工 DDL 漂移）本单**不能**证伪 —— 见 §6/N7。

---

## §2 逐处盘点（188 处 · 三层）

**计数**：受体 188 = `src` 23 + `migrations` 36 + `scripts` 129；形态 = `omitted` **154** + `explicit` **34**。
下表逐字取自上单 `inventory-tables.md`（本单未重盘、未改数）。

# 逐处盘点（src）
| # | 文件:行 | 表 | identity 列 | 形态 | 上下文 | 级 |
|---|---|---|---|---|---|---|
| 1 | `src/commission.ts:257` | commission_policy | policy_id | omitted | src | **R3** |
| 2 | `src/database.ts:659` | currency_status_log | log_id | omitted | src | **R3** |
| 3 | `src/database.ts:745` | currency_status_log | log_id | omitted | src | **R3** |
| 4 | `src/database.ts:751` | currency_review_log | log_id | omitted | src | **R3** |
| 5 | `src/database.ts:818` | listing_review_log | log_id | omitted | src | **R3** |
| 6 | `src/database.ts:2158` | users | uid | explicit | src | **R3** |
| 7 | `src/database.ts:2846` | currency | cid | omitted | src | **R3** |
| 8 | `src/database.ts:3171` | job_arbitration_log | log_id | omitted | src | **R1** |
| 9 | `src/database.ts:3227` | listing | listing_id | omitted | src | **R3** |
| 10 | `src/database.ts:3799` | job_submission | submission_id | omitted | src | **R3** |
| 11 | `src/database.ts:3866` | job_application | application_id | omitted | src | **R3** |
| 12 | `src/database.ts:3992` | batt_entry | txid | omitted | src | **R3** |
| 13 | `src/database.ts:4605` | checkin_log | log_id | omitted | src | **R3** |
| 14 | `src/database.ts:4625` | batt_entry | txid | omitted | src | **R3** |
| 15 | `src/database.ts:4715` | checkin_makeup_log | log_id | omitted | src | **R3** |
| 16 | `src/database.ts:4814` | batt_entry | txid | omitted | src | **R3** |
| 17 | `src/database.ts:4959` | currency | cid | omitted | src | **R3** |
| 18 | `src/database.ts:5126` | batt_entry | txid | omitted | src | **R3** |
| 19 | `src/database.ts:5245` | batt_entry | txid | omitted | src | **R3** |
| 20 | `src/database.ts:5394` | rating | rating_id | omitted | src | **R3** |
| 21 | `src/database.ts:5554` | listing_order_event | event_id | omitted | src | **R3** |
| 22 | `src/database.ts:6195` | market_trade | trade_id | omitted | src | **R3** |
| 23 | `src/database.ts:6362` | market_order | order_id | omitted | src | **R3** |

# 逐处盘点（migrations）
| # | 文件:行 | 表 | identity 列 | 形态 | 上下文 | 级 |
|---|---|---|---|---|---|---|
| 1 | `migrations/0001_ledger_core.sql:167` | currency | cid | explicit | mig-顶层DML | **R3** |
| 2 | `migrations/0004_ledger_post_event.sql:992` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 3 | `migrations/0004_ledger_post_event.sql:1016` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 4 | `migrations/0005_ledger_event_root_key.sql:1151` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 5 | `migrations/0005_ledger_event_root_key.sql:1176` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 6 | `migrations/0007_referral_and_commission_policy.sql:161` | commission_policy | policy_id | omitted | mig-顶层DML | **R3** |
| 7 | `migrations/0010_referral_bind_protocol_guard.sql:213` | users | uid | explicit | mig-DO块 | **R3** |
| 8 | `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:405` | users | uid | explicit | mig-DO块 | **R3** |
| 9 | `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:413` | currency | cid | omitted | mig-DO块 | **R2** |
| 10 | `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:422` | ledger_entry | txid | omitted | mig-DO块 | **R3** |
| 11 | `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:434` | ledger_entry | txid | omitted | mig-DO块 | **R3** |
| 12 | `migrations/0012_replay_pre_gate_before_balance_gate.sql:804` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 13 | `migrations/0012_replay_pre_gate_before_balance_gate.sql:829` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 14 | `migrations/0012_replay_pre_gate_before_balance_gate.sql:1175` | users | uid | explicit | mig-DO块 | **R3** |
| 15 | `migrations/0012_replay_pre_gate_before_balance_gate.sql:1180` | currency | cid | omitted | mig-DO块 | **R2** |
| 16 | `migrations/0013_job.sql:536` | job | job_id | omitted | mig-函数体 | **R3** |
| 17 | `migrations/0015_listing.sql:602` | listing_order | order_id | omitted | mig-函数体 | **R3** |
| 18 | `migrations/0016_market.sql:569` | market_order | order_id | omitted | mig-函数体 | **R1** |
| 19 | `migrations/0016_market.sql:830` | market_trade | trade_id | omitted | mig-函数体 | **R1** |
| 20 | `migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql:782` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 21 | `migrations/0020_ledger_post_event_hold_family_drop_listing_deposit.sql:807` | ledger_entry | txid | omitted | mig-函数体 | **R3** |
| 22 | `migrations/0023_admin_points_audit_daily_cap.sql:219` | admin_ops_audit_log | log_id | omitted | mig-函数体 | **R1** |
| 23 | `migrations/0023_admin_points_audit_daily_cap.sql:260` | admin_ops_audit_log | log_id | omitted | mig-函数体 | **R1** |
| 24 | `migrations/0024_admin_refund_audit.sql:180` | admin_refund_audit_log | log_id | omitted | mig-函数体 | **R1** |
| 25 | `migrations/0024_admin_refund_audit.sql:227` | admin_refund_audit_log | log_id | omitted | mig-函数体 | **R1** |
| 26 | `migrations/0030_listing_order_status_extend.sql:314` | listing_order | order_id | omitted | mig-函数体 | **R1** |
| 27 | `migrations/0034_ledger_op_burn_and_supply.sql:803` | ledger_entry | txid | omitted | mig-函数体 | **R1** |
| 28 | `migrations/0034_ledger_op_burn_and_supply.sql:828` | ledger_entry | txid | omitted | mig-函数体 | **R1** |
| 29 | `migrations/0035_fee_rate_range_extend.sql:68` | commission_policy | policy_id | omitted | mig-DO块 | **R3** |
| 30 | `migrations/0035_fee_rate_range_extend.sql:80` | commission_policy | policy_id | omitted | mig-DO块 | **R3** |
| 31 | `migrations/0035_fee_rate_range_extend.sql:92` | commission_policy | policy_id | omitted | mig-DO块 | **R3** |
| 32 | `migrations/0035_fee_rate_range_extend.sql:104` | commission_policy | policy_id | omitted | mig-DO块 | **R3** |
| 33 | `migrations/0035_fee_rate_range_extend.sql:116` | commission_policy | policy_id | omitted | mig-DO块 | **R3** |
| 34 | `migrations/0036_commission_policy_p9_5.sql:34` | commission_policy | policy_id | omitted | mig-顶层DML | **R3** |
| 35 | `migrations/0040_backfill_signup_batt.sql:146` | batt_entry | txid | omitted | mig-DO块 | **R3** |
| 36 | `migrations/0042_job_settle_per_submission.sql:235` | job | job_id | omitted | mig-函数体 | **R1** |

# 逐处盘点（scripts）
| # | 文件:行 | 表 | identity 列 | 形态 | 上下文 | 级 |
|---|---|---|---|---|---|---|
| 1 | `scripts/ledger-smoke-db.ts:54` | currency | cid | omitted | scripts | **R2** |
| 2 | `scripts/ledger-smoke.ts:287` | ledger_entry | txid | omitted | scripts | **R3** |
| 3 | `scripts/ledger-smoke.ts:313` | currency | cid | omitted | scripts | **R2** |
| 4 | `scripts/migrate.ts:96` | schema_migration | id | omitted | scripts | **R3** |
| 5 | `scripts/p1c-04-kind-enum-verify.ts:50` | ledger_entry | txid | omitted | scripts | **R3** |
| 6 | `scripts/p1c-06-post-verify.ts:74` | ledger_entry | txid | omitted | scripts | **R3** |
| 7 | `scripts/p1e-01-latency.ts:36` | currency | cid | omitted | scripts | **R2** |
| 8 | `scripts/p1e-04-db-fn-probe.ts:64` | currency | cid | omitted | scripts | **R2** |
| 9 | `scripts/p1f-01-f1-collision.ts:210` | ledger_entry | txid | omitted | scripts | **R3** |
| 10 | `scripts/p1f-lib.ts:163` | currency | cid | omitted | scripts | **R2** |
| 11 | `scripts/p1t-00-bind-protocol-guard.ts:289` | users | uid | explicit | scripts | **R3** |
| 12 | `scripts/p2b-01-forensics.ts:74` | commission_policy | policy_id | omitted | scripts | **R3** |
| 13 | `scripts/p2b-01-forensics.ts:77` | commission_policy | policy_id | omitted | scripts | **R3** |
| 14 | `scripts/p2b-01-forensics.ts:80` | commission_policy | policy_id | omitted | scripts | **R3** |
| 15 | `scripts/p2b-01-forensics.ts:83` | commission_policy | policy_id | omitted | scripts | **R3** |
| 16 | `scripts/p2b-01-forensics.ts:86` | commission_policy | policy_id | omitted | scripts | **R3** |
| 17 | `scripts/p2b-01-forensics.ts:89` | commission_policy | policy_id | omitted | scripts | **R3** |
| 18 | `scripts/p2b-01-forensics.ts:92` | commission_policy | policy_id | omitted | scripts | **R3** |
| 19 | `scripts/p2b-01-forensics.ts:95` | commission_policy | policy_id | omitted | scripts | **R3** |
| 20 | `scripts/p2b-01-forensics.ts:98` | commission_policy | policy_id | omitted | scripts | **R3** |
| 21 | `scripts/p2b-02-cases.ts:49` | users | uid | explicit | scripts | **R3** |
| 22 | `scripts/p2d-00-commission-m-criteria.ts:152` | users | uid | explicit | scripts | **R3** |
| 23 | `scripts/p2qa-01-sigma-conservation.ts:215` | commission_policy | policy_id | omitted | scripts | **R3** |
| 24 | `scripts/p2qa-01-sigma-conservation.ts:243` | commission_policy | policy_id | omitted | scripts | **R3** |
| 25 | `scripts/p2qa-11-f1-f7.ts:53` | currency | cid | omitted | scripts | **R2** |
| 26 | `scripts/p2qa-11-f1-f7.ts:171` | currency | cid | omitted | scripts | **R2** |
| 27 | `scripts/p2qa-12-f3-f6-f2.ts:48` | currency | cid | omitted | scripts | **R2** |
| 28 | `scripts/p2qa-lib.ts:150` | users | uid | explicit | scripts | **R3** |
| 29 | `scripts/p2qa-lib.ts:160` | currency | cid | omitted | scripts | **R2** |
| 30 | `scripts/p2w-lib.ts:95` | users | uid | explicit | scripts | **R3** |
| 31 | `scripts/p2w-lib.ts:102` | currency | cid | omitted | scripts | **R2** |
| 32 | `scripts/p2x-lib.ts:102` | users | uid | explicit | scripts | **R3** |
| 33 | `scripts/p2x-lib.ts:109` | currency | cid | omitted | scripts | **R2** |
| 34 | `scripts/p3f-01-cases.ts:56` | job_application | application_id | omitted | scripts | **R3** |
| 35 | `scripts/p3f-01-cases.ts:105` | job_application | application_id | omitted | scripts | **R3** |
| 36 | `scripts/p3f-01-cases.ts:116` | job_submission | submission_id | omitted | scripts | **R2** |
| 37 | `scripts/p3f-01-cases.ts:122` | job_submission | submission_id | omitted | scripts | **R2** |
| 38 | `scripts/p3f-01-cases.ts:133` | job_submission | submission_id | omitted | scripts | **R2** |
| 39 | `scripts/p3f-01-cases.ts:150` | job_application | application_id | omitted | scripts | **R3** |
| 40 | `scripts/p3f-01-cases.ts:153` | job_application | application_id | omitted | scripts | **R3** |
| 41 | `scripts/p3f-01-cases.ts:162` | job_application | application_id | omitted | scripts | **R3** |
| 42 | `scripts/p3f-01-cases.ts:165` | job_application | application_id | omitted | scripts | **R3** |
| 43 | `scripts/p3f-01-cases.ts:168` | job_application | application_id | omitted | scripts | **R3** |
| 44 | `scripts/p3f-lib.ts:85` | users | uid | omitted | scripts | **R2** |
| 45 | `scripts/p3f-lib.ts:102` | job | job_id | omitted | scripts | **R2** |
| 46 | `scripts/p3f-lib.ts:119` | job_application | application_id | omitted | scripts | **R3** |
| 47 | `scripts/p3j-lib.ts:93` | users | uid | omitted | scripts | **R2** |
| 48 | `scripts/p3l-01-cases.ts:186` | listing | listing_id | omitted | scripts | **R3** |
| 49 | `scripts/p3l-01-cases.ts:187` | listing | listing_id | omitted | scripts | **R3** |
| 50 | `scripts/p3l-01-cases.ts:284` | listing_order | order_id | omitted | scripts | **R2** |
| 51 | `scripts/p3l-05-cases.ts:37` | users | uid | omitted | scripts | **R2** |
| 52 | `scripts/p3l-05-cases.ts:52` | listing | listing_id | omitted | scripts | **R3** |
| 53 | `scripts/p3l-05-cases.ts:241` | listing | listing_id | omitted | scripts | **R3** |
| 54 | `scripts/p3l-05-cases.ts:242` | listing | listing_id | omitted | scripts | **R3** |
| 55 | `scripts/p3l-09-first-purchase.ts:26` | users | uid | omitted | scripts | **R2** |
| 56 | `scripts/p3l-09-first-purchase.ts:44` | listing | listing_id | omitted | scripts | **R3** |
| 57 | `scripts/p3l-lib.ts:94` | users | uid | omitted | scripts | **R2** |
| 58 | `scripts/p3l-lib.ts:117` | listing | listing_id | omitted | scripts | **R3** |
| 59 | `scripts/p3m-02-cases.ts:212` | market_order | order_id | omitted | scripts | **R3** |
| 60 | `scripts/p3m-lib.ts:99` | users | uid | omitted | scripts | **R2** |
| 61 | `scripts/p3n-01-rca-legs.ts:230` | currency | cid | omitted | scripts | **R2** |
| 62 | `scripts/p3n-01-rca-legs.ts:233` | users | uid | explicit | scripts | **R3** |
| 63 | `scripts/p3n-01-rca-legs.ts:375` | users | uid | explicit | scripts | **R3** |
| 64 | `scripts/p3n-01-rca-legs.ts:382` | users | uid | explicit | scripts | **R3** |
| 65 | `scripts/p3p-02-cases.ts:48` | currency_status_log | log_id | omitted | scripts | **R3** |
| 66 | `scripts/p3p-02-cases.ts:90` | currency_status_log | log_id | omitted | scripts | **R3** |
| 67 | `scripts/p3p-03-falsify.ts:53` | currency_status_log | log_id | omitted | scripts | **R3** |
| 68 | `scripts/p3p-lib.ts:150` | users | uid | omitted | scripts | **R2** |
| 69 | `scripts/p3s-00-500-rca-probe.ts:290` | currency | cid | omitted | scripts | **R2** |
| 70 | `scripts/p3x-00-rebuild-replay.ts:701` | schema_migration | id | omitted | scripts | **R3** |
| 71 | `scripts/p4z-a1li-01-e2e.ts:107` | users | uid | omitted | scripts | **R2** |
| 72 | `scripts/p4z-audjk-01-probe.ts:145` | job | job_id | omitted | scripts | **R2** |
| 73 | `scripts/p4z-audjk-01-probe.ts:155` | job_application | application_id | omitted | scripts | **R3** |
| 74 | `scripts/p4z-b2a-01-fixture.ts:124` | users | uid | explicit | scripts | **R3** |
| 75 | `scripts/p4z-b2a-01-fixture.ts:140` | job | job_id | omitted | scripts | **R2** |
| 76 | `scripts/p4z-b2ahttp-02-patch-users-cols.ts:60` | users | uid | explicit | scripts | **R3** |
| 77 | `scripts/p4z-b2ahttp-02-patch-users-cols.ts:62` | users | uid | explicit | scripts | **R3** |
| 78 | `scripts/p4z-b2b-02-listing.ts:133` | users | uid | explicit | scripts | **R3** |
| 79 | `scripts/p4z-b2b-02-listing.ts:142` | job | job_id | omitted | scripts | **R2** |
| 80 | `scripts/p4z-b2b-02-listing.ts:152` | job_application | application_id | omitted | scripts | **R3** |
| 81 | `scripts/p4z-b2c-02-probe.ts:101` | users | uid | explicit | scripts | **R3** |
| 82 | `scripts/p4z-b3d-02-e2e.ts:88` | listing | listing_id | omitted | scripts | **R3** |
| 83 | `scripts/p4z-b3d-02-e2e.ts:148` | listing_order | order_id | omitted | scripts | **R2** |
| 84 | `scripts/p4z-b6audit-01-e2e.ts:111` | users | uid | explicit | scripts | **R3** |
| 85 | `scripts/p4z-b6audit-01-e2e.ts:222` | admin_ops_audit_log | log_id | omitted | scripts | **R3** |
| 86 | `scripts/p4z-b6audit-02-idemkey.ts:83` | admin_ops_audit_log | log_id | omitted | scripts | **R3** |
| 87 | `scripts/p4z-b6audit-02-idemkey.ts:87` | admin_ops_audit_log | log_id | omitted | scripts | **R3** |
| 88 | `scripts/p4z-b6audit-02-idemkey.ts:189` | schema_migration | id | omitted | scripts | **R3** |
| 89 | `scripts/p4z-b6audit-02-idemkey.ts:205` | users | uid | explicit | scripts | **R3** |
| 90 | `scripts/p4z-b6audit-02-idemkey.ts:209` | users | uid | explicit | scripts | **R3** |
| 91 | `scripts/p4z-b6audit-live-01.ts:158` | users | uid | explicit | scripts | **R3** |
| 92 | `scripts/p4z-b6audit-live-01.ts:296` | admin_ops_audit_log | log_id | omitted | scripts | **R3** |
| 93 | `scripts/p4z-tr1b-01-e2e-stub.ts:103` | job | job_id | omitted | scripts | **R2** |
| 94 | `scripts/p4z-tr1b-01-e2e-stub.ts:110` | listing | listing_id | omitted | scripts | **R3** |
| 95 | `scripts/p4z-tr1b-01-e2e-stub.ts:133` | job | job_id | omitted | scripts | **R2** |
| 96 | `scripts/p7b-06-fixture-setup.ts:39` | users | uid | explicit | scripts | **R3** |
| 97 | `scripts/p7b-06-fixture-setup.ts:65` | listing | listing_id | omitted | scripts | **R3** |
| 98 | `scripts/p7b-06-fixture-setup.ts:97` | listing_order | order_id | omitted | scripts | **R2** |
| 99 | `scripts/p8-s10-invite-reward-gate.ts:352` | users | uid | explicit | scripts | **R3** |
| 100 | `scripts/p8-s10-invite-reward-gate.ts:379` | job | job_id | omitted | scripts | **R2** |
| 101 | `scripts/p8-s3-01-effective.ts:117` | currency | cid | explicit | scripts | **R3** |
| 102 | `scripts/p8-s3b-01-effective.ts:94` | currency | cid | explicit | scripts | **R3** |
| 103 | `scripts/p8-s4-01-effective.ts:74` | currency | cid | explicit | scripts | **R3** |
| 104 | `scripts/p8-s5-01-real-chains.ts:218` | listing | listing_id | omitted | scripts | **R3** |
| 105 | `scripts/p8-s5-01-real-chains.ts:296` | listing | listing_id | omitted | scripts | **R3** |
| 106 | `scripts/p8-s7-batt-checkin-gate.ts:632` | checkin_log | log_id | omitted | scripts | **R3** |
| 107 | `scripts/p8-s8-rating-timeliness-gate.ts:576` | users | uid | explicit | scripts | **R3** |
| 108 | `scripts/p8-s8-rating-timeliness-gate.ts:579` | job | job_id | explicit | scripts | **R3** |
| 109 | `scripts/p8-s8-rating-timeliness-gate.ts:589` | job_submission | submission_id | explicit | scripts | **R3** |
| 110 | `scripts/p8-s8-rating-timeliness-gate.ts:591` | listing_order | order_id | explicit | scripts | **R3** |
| 111 | `scripts/p8-s8-rating-timeliness-gate.ts:597` | listing_order_event | event_id | explicit | scripts | **R3** |
| 112 | `scripts/p8-s8-rating-timeliness-gate.ts:603` | rating | rating_id | explicit | scripts | **R3** |
| 113 | `scripts/p8-s9-bttc-gate.ts:584` | currency | cid | omitted | scripts | **R2** |
| 114 | `scripts/qa-p1b-01-setup.ts:23` | currency | cid | omitted | scripts | **R2** |
| 115 | `scripts/qa-p1b-03-idem.ts:58` | ledger_entry | txid | omitted | scripts | **R3** |
| 116 | `scripts/qa-p1b-05-supplycap.ts:31` | currency | cid | omitted | scripts | **R2** |
| 117 | `scripts/qa-p1b-07-falsify.ts:73` | ledger_entry | txid | omitted | scripts | **R3** |
| 118 | `scripts/qa-p1b-07-falsify.ts:98` | ledger_entry | txid | omitted | scripts | **R3** |
| 119 | `scripts/qa-p1e-02b-api-collision.ts:30` | currency | cid | omitted | scripts | **R2** |
| 120 | `scripts/qa-p1e-05-neon-ab.ts:36` | currency | cid | omitted | scripts | **R2** |
| 121 | `scripts/qa-p1e-06-falsify.ts:54` | ledger_entry | txid | omitted | scripts | **R3** |
| 122 | `scripts/qa-p1e-09-migration-replay.ts:79` | currency | cid | omitted | scripts | **R2** |
| 123 | `scripts/qa-p1e-lib.ts:171` | currency | cid | omitted | scripts | **R2** |
| 124 | `scripts/verify-db-layer.ts:53` | ledger_entry | txid | omitted | scripts | **R3** |
| 125 | `scripts/verify-db-layer.ts:148` | ledger_entry | txid | omitted | scripts | **R3** |
| 126 | `scripts/verify-db-layer.ts:159` | ledger_entry | txid | omitted | scripts | **R3** |
| 127 | `scripts/verify-db-layer.ts:184` | ledger_entry | txid | omitted | scripts | **R3** |
| 128 | `scripts/verify-db-layer.ts:196` | ledger_entry | txid | omitted | scripts | **R3** |
| 129 | `scripts/verify-db-layer.ts:207` | ledger_entry | txid | omitted | scripts | **R3** |

---

## §3 三级分级与判据

```
分级读数   {'R1': 11, 'R2': 43, 'R3': 134}     Σ = 188
形态读数   {'omitted': 154, 'explicit': 34}
```

### 3.1 R1 —— 活体产品写路径的隐式取号（**11 处**）

**判据**：该 INSERT 落在**产品运行期真实写路径**上、省略 identity-PK 取全局序列，
且其宿主（TS `withTransaction` 回调 / SQL 函数体）**可回滚 + 可被调用侧重试**；
SQL 函数一律以 `md5(prosrc)` 验证**活体**（未被子序列的同名函数取代）。
出处：上单 `fn-md5.raw.json`；`src/database.ts:3171` 为 TS 侧同族项。

| # | 文件:行 | 表 | identity 列 | 上下文 | 判据/理由 |
|---|---|---|---|---|---|
| 1 | `migrations/0016_market.sql:569` | market_order | order_id | mig-function | 活体产品写路径（SQL 函数 market_post_event @ 0016）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 2 | `migrations/0016_market.sql:830` | market_trade | trade_id | mig-function | 活体产品写路径（SQL 函数 market_post_event @ 0016）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 3 | `migrations/0023_admin_points_audit_daily_cap.sql:219` | admin_ops_audit_log | log_id | mig-function | 活体产品写路径（SQL 函数 admin_points_adjust_post_event @ 0023）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 4 | `migrations/0023_admin_points_audit_daily_cap.sql:260` | admin_ops_audit_log | log_id | mig-function | 活体产品写路径（SQL 函数 admin_points_adjust_post_event @ 0023）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 5 | `migrations/0024_admin_refund_audit.sql:180` | admin_refund_audit_log | log_id | mig-function | 活体产品写路径（SQL 函数 listing_refund_post_event @ 0024）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 6 | `migrations/0024_admin_refund_audit.sql:227` | admin_refund_audit_log | log_id | mig-function | 活体产品写路径（SQL 函数 listing_refund_post_event @ 0024）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 7 | `migrations/0030_listing_order_status_extend.sql:314` | listing_order | order_id | mig-function | 活体产品写路径（SQL 函数 listing_post_event @ 0030）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 8 | `migrations/0034_ledger_op_burn_and_supply.sql:803` | ledger_entry | txid | mig-function | 活体产品写路径（SQL 函数 ledger_post_event @ 0034）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 9 | `migrations/0034_ledger_op_burn_and_supply.sql:828` | ledger_entry | txid | mig-function | 活体产品写路径（SQL 函数 ledger_post_event @ 0034）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 10 | `migrations/0042_job_settle_per_submission.sql:235` | job | job_id | mig-function | 活体产品写路径（SQL 函数 job_post_event @ 0042）；体内 RAISE ⇒ 事务回滚 + 调用侧重试 |
| 11 | `src/database.ts:3171` | job_arbitration_log | log_id | src | 产品路径；withTransaction 回调内插入（同事务可回滚） |

**R1 的活体验证（上单现取）**：`ledger_post_event@0034`、`job_post_event@0042`、`listing_post_event@0030`、
`market_post_event@0016`、`admin_points_adjust_post_event@0023`、`listing_refund_post_event@0024`
—— 各以 `md5(prosrc)` 与库内现役函数体**逐字节**对齐；
`0004/0005/0012/0020/0034` 的旧 `ledger_post_event` 体被后续迁移取代（8 处，落 R3「非活体」）。

### 3.2 R2 —— 「同表双形态」测试/校验面省略取号（**43 处**）

**判据（可复现的机械口径）**：一处**省略 identity-PK** 的 INSERT，其所在**表**在**全量三层面**中
同时存在至少一处**显式给号**，且该处落在**测试/校验面**（`scripts/**` 或迁移 `DO $$` 块内）。
这正是 **S29 型撞号机制**：夹具省略 PK 取 `nextval`，与同表某处**写死的固定号**共处同一取值域
⇒ **序列落后于表内 max 时必撞 PK**。

| # | 文件:行 | 表 | identity 列 | 上下文 | 判据/理由 |
|---|---|---|---|---|---|
| 1 | `migrations/0011_commission_assert_closure_and_referral_depth_guard.sql:413` | currency | cid | mig-do | 迁移内 DO 块自检探针省略 PK，且同表存在显式给号（S29 型） |
| 2 | `migrations/0012_replay_pre_gate_before_balance_gate.sql:1180` | currency | cid | mig-do | 迁移内 DO 块自检探针省略 PK，且同表存在显式给号（S29 型） |
| 3 | `scripts/ledger-smoke-db.ts:54` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 4 | `scripts/ledger-smoke.ts:313` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 5 | `scripts/p1e-01-latency.ts:36` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 6 | `scripts/p1e-04-db-fn-probe.ts:64` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 7 | `scripts/p1f-lib.ts:163` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 8 | `scripts/p2qa-11-f1-f7.ts:53` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 9 | `scripts/p2qa-11-f1-f7.ts:171` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 10 | `scripts/p2qa-12-f3-f6-f2.ts:48` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 11 | `scripts/p2qa-lib.ts:160` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 12 | `scripts/p2w-lib.ts:102` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 13 | `scripts/p2x-lib.ts:109` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 14 | `scripts/p3f-01-cases.ts:116` | job_submission | submission_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 15 | `scripts/p3f-01-cases.ts:122` | job_submission | submission_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 16 | `scripts/p3f-01-cases.ts:133` | job_submission | submission_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 17 | `scripts/p3f-lib.ts:85` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 18 | `scripts/p3f-lib.ts:102` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 19 | `scripts/p3j-lib.ts:93` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 20 | `scripts/p3l-01-cases.ts:284` | listing_order | order_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 21 | `scripts/p3l-05-cases.ts:37` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 22 | `scripts/p3l-09-first-purchase.ts:26` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 23 | `scripts/p3l-lib.ts:94` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 24 | `scripts/p3m-lib.ts:99` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 25 | `scripts/p3n-01-rca-legs.ts:230` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 26 | `scripts/p3p-lib.ts:150` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 27 | `scripts/p3s-00-500-rca-probe.ts:290` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 28 | `scripts/p4z-a1li-01-e2e.ts:107` | users | uid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 29 | `scripts/p4z-audjk-01-probe.ts:145` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 30 | `scripts/p4z-b2a-01-fixture.ts:140` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 31 | `scripts/p4z-b2b-02-listing.ts:142` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 32 | `scripts/p4z-b3d-02-e2e.ts:148` | listing_order | order_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 33 | `scripts/p4z-tr1b-01-e2e-stub.ts:103` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 34 | `scripts/p4z-tr1b-01-e2e-stub.ts:133` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 35 | `scripts/p7b-06-fixture-setup.ts:97` | listing_order | order_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 36 | `scripts/p8-s10-invite-reward-gate.ts:379` | job | job_id | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 37 | `scripts/p8-s9-bttc-gate.ts:584` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 38 | `scripts/qa-p1b-01-setup.ts:23` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 39 | `scripts/qa-p1b-05-supplycap.ts:31` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 40 | `scripts/qa-p1e-02b-api-collision.ts:30` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 41 | `scripts/qa-p1e-05-neon-ab.ts:36` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 42 | `scripts/qa-p1e-09-migration-replay.ts:79` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |
| 43 | `scripts/qa-p1e-lib.ts:171` | currency | cid | scripts | 探针/夹具省略 PK，且同表存在显式给号（S29 型撞号机制） |

按表：`currency 22` · `users 8` · `job 7` · `job_submission 3` · `listing_order 3`。
按层：`scripts 41` + `migrations(DO 块) 2`。

### 3.3 R3 —— 其余（**134 处**）：显式给号 / 单形态 / 非活体 / 无回滚语义

| 处数 | 理由（上单逐处 reason 归并） |
|---|---|
| 59 | 探针/夹具省略 PK，但同表无显式给号 |
| 34 | 显式给号（identity 列在列清单内出现） |
| 21 | 产品路径；单语句 CTE 自动提交（无回滚语义） |
| 8 | 非活体：函数 ledger_post_event 已被后续迁移取代（活体=0034） |
| 8 | 迁移内 DO 块（种子/回填/自检）；同表无显式给号 |
| 2 | 迁移顶层 DML（种子/回填）；无回滚语义 |
| 1 | 非活体：函数 job_post_event 已被后续迁移取代（活体=0042） |
| 1 | 非活体：函数 listing_post_event 已被后续迁移取代（活体=0030） |

**R3 的四类**：
1. **显式给号（34 处）**：identity 列出现在列清单内 —— 本类**不省略** PK，是 R2 的「对侧形态」。
2. **单形态表的隐式取号（59 + 8 处）**：同表**无**显式给号 ⇒ 无「撞号对」，风险仅剩「回滚耗号（gaps）」。
3. **非活体函数体（10 处）**：`ledger_post_event` 8 / `listing_post_event` 1 / `job_post_event` 1
   —— 函数体已被后续迁移取代，非现役。
4. **无回滚语义（2 处顶层 DML + 21 处 src 单语句 CTE）**：插入即自动提交，无事务回滚面。

---

## §4 与 S29 修法对拍

### 4.1 S29 做了什么

`docs/audit/s29-s8-v1-fixture-anchor.md`（上单之外既存报告）：S29 因 `p8-s8` 的 `V1` 红点
（`duplicate key value violates unique constraint "job_submission_pk"`，`Key (submission_id)=(246) already exists`）
把该门夹具的 **3 处**隐式取号改为**显式取自门内固定保留窗口（≥900000）**：

| # | 表 | 改后显式 id | 门内行 |
|---|---|---|---|
| ① | `job_submission` | `900901` | `scripts/p8-s8-rating-timeliness-gate.ts:589` |
| ② | `listing_order_event` | `900921/922/923/924` | 同门 `:597` |
| ③ | `rating` | `900911/912/913/914` | 同门 `:603` |

修法抉择（S29 §2.2 原文口径）：**不**用「插入后读回真实 id」——因为它**治不了撞号**
（撞号发生在**隐式取号那一刻**，读回的前提是插入已成功）；也**不用** `OVERRIDING SYSTEM VALUE`。
该窗口与门内既有先例同段：uid `9810xx` / job `900001-900002` / order `900201-900205` / event `900921-900924` /
rating `900911-900914` / target `900011-900014`。

### 4.2 对拍读数（**已覆盖 0 / 未覆盖 43 全量**）

| 项 | 读数 |
|---|---|
| S29 覆盖处数 | **3**（`p8-s8` 的 job_submission:589 / listing_order_event:597 / rating:603） |
| 那 3 处现形态 | **explicit**（identity 列已在列清单内）⇒ 依 R2 判据**已脱离 R2** |
| R2 中已被 S29 覆盖 | **0** |
| R2 未覆盖（= 本门基线全量） | **43 / 43** |
| 判据一致性 | S29 的三处**现在**由本门按「显式给号」侧计入；其**表**（job_submission / listing_order_event / rating）仍在 `both_form_tables` 中，本门对同表**其余**省略处仍报 ⇒ 覆盖关系清晰、无重叠 |

**★ S29 与 S36 的计数差异（不洗白，登记）**：S29 §4 的「同族扫面」记 **63 处 / 20 个脚本**（`scripts/*.ts`，
含单形态表）；本单 `scripts` 层**省略** identity-PK 计 **100 处**，其中**双形态表**仅 **41 处**（= R2 的 scripts 部分）。
两数**口径不同**（时间点 / 是否递归子目录 / 是否限定双形态表 / 期间脚本增删）⇒ **不逐一对上**，
登记为**差异**而非矛盾（见 §6/N8）。

---

## §5 R1 最小方案草案（**仅登记、本单零实施**）

> 本节只给**选项与代价**，不改任何产品码 / 迁移 / 门套。实施与否由 Zang 裁。

### 5.1 R1 逐处风险

**共同机制**：产品写路径省略 identity-PK ⇒ 取**全局序列**；而 PG 序列**不随事务 ROLLBACK 回退**
⇒ ① 失败/重试**消耗号段**（gaps）；② 当 **`seq_next ≤ max(PK)`** 时 ⇒ **隐式取号必撞 PK**
⇒ 产品写路径直接报错（**生产面**缺陷，非测试面）。

| # | 站点 | 表.列 | generation | 为何风险（本单判读） |
|---|---|---|---|---|
| 1 | `src/database.ts:3171` | job_arbitration_log.log_id | BY DEFAULT | TS `withTransaction` 回调内插入；同事务任何后续失败 ⇒ 整体回滚而号已耗；与 `job_post_event` 同请求链 |
| 2 | `migrations/0016_market.sql:569` | market_order.order_id | BY DEFAULT | 活体 `market_post_event`；`ON CONFLICT (create_key) DO NOTHING` 后 `IF NOT FOUND ⇒ ...` ⇒ **有重试/重读分支** |
| 3 | `migrations/0016_market.sql:830` | market_trade.trade_id | BY DEFAULT | 同上函数第二处（成交行）；`IF NOT v_replay` 门内 |
| 4 | `migrations/0023:219` | admin_ops_audit_log.log_id | BY DEFAULT | 活体 `admin_points_adjust_post_event`；**拒绝留痕行**（`result='rejected_daily_cap'`）——最该留痕的路径也走隐式取号 |
| 5 | `migrations/0023:260` | admin_ops_audit_log.log_id | BY DEFAULT | 同函数**成功**留痕行（`IF NOT v_replay`） |
| 6 | `migrations/0024:180` | admin_refund_audit_log.log_id | BY DEFAULT | 活体 `listing_refund_post_event` 的 **EXCEPTION 处理器内**拒绝留痕（子事务回滚**不**波及本行 ⇒ 必落库） |
| 7 | `migrations/0024:227` | admin_refund_audit_log.log_id | BY DEFAULT | 同函数另一处拒绝留痕分支 |
| 8 | `migrations/0030:314` | listing_order.order_id | BY DEFAULT | 活体 `listing_post_event` 建单；**同表存在夹具固定号**（p8-s8 `900201-900205`）⇒ **真·端到端撞号对** |
| 9 | `migrations/0034:803` | ledger_entry.txid | **ALWAYS** | 活体 `ledger_post_event` 事件根分录；**ALWAYS** ⇒ 唯一能改成显式给号的手段是 `OVERRIDING SYSTEM VALUE` |
| 10 | `migrations/0034:828` | ledger_entry.txid | **ALWAYS** | 同函数派生分录循环内（`FOR v_i IN 1..v_n-1`）⇒ 每次事件多行，号段消耗最快 |
| 11 | `migrations/0042:235` | job.job_id | BY DEFAULT | 活体 `job_post_event` 建岗；**同表存在夹具固定号**（p8-s8 `900001-900002`）⇒ **真·端到端撞号对** |

**分级（本单判读）**：**高** = 8 / 11（`listing_order`、`job`：与夹具固定号**同域**，撞号对已成立，仅差序列涨上去）；
**中** = 2/3/9/10（大写入量或 `ALWAYS` 特例）；**低** = 1/4/5/6/7（审计留痕面，当前 `seq_next` 远高于 `max`）。

### 5.2 三个点名选项的评估

| 选项 | 适用性 | 代价 / 结论 |
|---|---|---|
| **A. `OVERRIDING SYSTEM VALUE`（显式给号）** | **仅 `ALWAYS` 列必需**（本清单只有 `ledger_entry.txid` 的 #9/#10 两处）；`BY DEFAULT` 列只要把列写进列清单即可，无需该子句 | 产品路径**必须自己知道要分配哪个号** ⇒ 需引入**运行期号段分配器**（仓内 `scripts/ns-alloc.ts` 是**只读扫描命名空间的探针工具**，不是运行期分配器）⇒ 改动面大、且**与 identity 的设计意图相反**（identity 就是让 DB 取号）。**对产品路径不建议**。 |
| **B. 值预取（先插后读回 / `RETURNING`）** | **现状已经是这个形态**（`INSERT ... RETURNING * INTO v_order/v_job`） | **治不了撞号**：撞号发生在**取号那一刻**，读回的**前提是插入已成功**。它只解决「插入后需要那个新 id 去断言」的场景，本清单**无一处**如此。⇒ **不适用**。 |
| **C. `SAVEPOINT` / 子事务** | **不适用** | 子事务只能**缩小回滚范围**，**不能**阻止 `nextval` 消耗（PG 序列非事务性）⇒ 既治不了 gaps、也治不了撞号。0011/0024 里既有的子事务+哨兵回滚块正是**这个现象**的现场（`raw-readings.txt:204` 记载：行回滚但序列推进不撤）。 |

### 5.3 本单登记的建议（**未实施**；选项 D，非派单点名，供裁）

**D-1（最小、零产品改动）**：**不动**产品取号口径，改加**结构性保证**：
① 迁移收口/巡检对每张 identity 表做 `setval(seq, max(pk)+1, false)` 对齐；
② 新增一条**只读断言门**「∀ identity 表：`seq_next > max(pk)`」（可复用本门同族的类级自证口径）；
③ 夹具一律锚固定保留窗口（S29 已做 3 处；R2 剩余 43 处按同法收敛）。

| | 代价 | 收益 | 风险 |
|---|---|---|---|
| D-1① | 一处巡检 SQL（迁移文书追加一行） | 直接消除撞号前置条件 | 巡检须**有人跑**；未跑期间条件仍可能被污染 |
| D-1② | 一条离线门（零 DB 需要活体读数 ⇒ 或作在线巡检） | 把「撞号」从产品面**前移**到门前 | 门的读数依赖活库 ⇒ 非纯离线 |
| D-1③ | 43 处夹具逐个锚定（脚本面，可分批） | 与 S29 同法，**已被实证有效** | 43 处面不小；固定窗口 `900xxx` 与序列长期**无隔离保证**（见 §6/N8） |

**建议优先级**：`listing_order`(R1#8) + `job`(R1#11) 两处撞号对 **>** D-1② 序列领先巡检 **>** R2 43 处夹具锚定分批。

---

## §6 未做与 NOT_MEASURED（**不洗白**）

> 口径声明：上一单的 `blockers` / `not_measured` **无独立落盘件**（上单只落盘了 §0 列的产物，未落盘结果 JSON）。
> 以下清单 = **依据上单产物 + 派单口径可核对的复原**，**非原文照抄**；凡不能核对的一律标 `[复原]`（见 §7.4）。

### 6.1 上单 blockers（逐条）

| # | blocker | 状态 |
|---|---|---|
| B1 | **报告未落盘**：盘点全部做完（188 处逐处 + 三级 + R2 43 + 活体 md5 验证），但**未产出** `docs/audit/s36-*.md` | 本单**已消除**（本报告即为该交付） |
| B2 | 工具迭代耗尽：上单在「扫描器 v3 去注释」迭代中耗尽预算，收敛在 `implicit-inserts.raw.json` + 手工归并的 `implicit-inserts.json` | 本单**未重盘**（按派单「直接读」），故 B2 的**中间产物口径**（手工归并的标准）**未被本单独立复核** |
| B3 | 上单未产出**可执行门**；R2 的 43 处仅以文本清单（`r2-not-covered.txt`）存在，**无机械防线** | 本单**已消除**（`s36-00-identity-pk-form-gate.ts` + 基线 43） |

### 6.2 上单 not_measured（逐条）

| # | NOT_MEASURED | 本单是否补测 |
|---|---|---|
| N1 | **未逐处活体复现** 43 处 R2 的撞号行为（只给机制判定，未逐点跑；S29 只对 `job_submission` 一处实证过 `Key (submission_id)=(246) already exists`） | **否**，未补（本单零 DB 写、只读） |
| N2 | `序列 vs max` 是**瞬时快照**；任一提交型探针跑一次即可能改变 ⇒「当前无表撞态」是**瞬时结论** | **否**，未补（本单未连库重取） |
| N3 | **未做并发实验**（两实例并跑会撞固定夹具 id：`users.uid` 9810xx / `job.job_id` 900001-2 等） | **否** |
| N4 | **未跑全量门套**回归；未对照 `p7b-03` / `p8-*` 的计数常数 | **否**（本单按硬口径④**不改**既有门套注册面） |
| N5 | **未改** `src/**` / `migrations/**`（不在允许面）⇒ R1 与 R3 的产品面取号**未有任何实施** | **否**，本单 §5 仅登记草案 |
| N6 | `users.seq_next(42) ≤ max(971213)` 的**成因未活体复现**；「走 `getNextUserId=MAX(uid)+1` 故不占序列」是**代码阅读推断**，非实测取号行为 | **否**，本单沿用该推断并**显式标注为推断** |
| N7 | 仓外 / 部署库（Neon 分支）的 identity 状态**未测**；仅本机活库快照 | **否** |
| N8 | 夹具固定窗口 `900xxx` 与各表序列的**长期安全性未验证**（序列若涨到 900000 即**再撞**） | **否**，本单在 §5.3 表内**复述为风险** |
| N9 | `implicit-inserts.raw.json` 记 `comment_only = 1`，该处**未逐条定性** | **否** |
| N10 | 扫描面**限型**：`src/*.ts` + `migrations/*.sql` + `scripts/*.{ts,js,mjs,cjs}`；**未**扫 `scripts/*.sql` / `migrations/*.ts` / 其它扩展名 | 本单门沿用**同一限型**（保证口径可比），故**仍未覆盖** |

### 6.3 本单自身未做（追加）

| # | 未做 |
|---|---|
| M1 | R1 **零实施**（§5 只有草案与代价评估） |
| M2 | **未**把 `s36-00` 纳入全量门套（硬口径④）；仅在 §7.5 给**建议**，由 Zang 裁 |
| M3 | 判负为**仓外副本 + 内存**两法；**未**做「主仓内注入」的等价实验（取「主仓零残留」优先的口径） |
| M4 | **未**做跨库/多环境对拍；**未**重连库重取序列快照 |
| M5 | **未**测并发下门的稳定性；门的扫描为单进程一次性快照 |
| M6 | **未**对 R1 的 11 处做活体撞号实验（§5.1 的「分级」是**代码阅读 + 快照对照**的判读，非实测） |

---

## §7 自曝

1. **★ 自帚（真实假阳性，已修）**：本门首跑把**自身源码里判负夹具的字符串字面量**计为受体
   （`scripts/s36-00-identity-pk-form-gate.ts` 内 9 处 `INSERT INTO currency (...)` 文本）⇒ 读数一度为
   `受体 197 / 命中 48 / 新增 5`（**红**）。已加**自帚**（`SELF_REL` 排除本门文件）⇒ 回到 `188 / 43 / 0`。
   这是扫描器**必然**要面对的形态（既存脚本里大量 `INSERT` 也是字符串字面量，如 `p3f-lib.ts:85`），
   登记为**假阳性一次**。
2. **判据有意窄化（非疏漏，但请裁）**：本门把**命中面**限定在**测试/校验面**（`scripts/**` + 迁移 `DO $$` 块）。
   产品面（`src/**` 5 处 + 迁移**函数体** 4 处 = **9 处**，含 R1 的 listing_order/job）**不报**。
   若 Zang 认为产品面也该红，须改判据 ⇒ 该 9 处会**立即变成新命中**（其中 4 处属 R1）。这是**有意的口径选择**，
   理由：R1/R3 的产品取号是「序列本来的用法」，其风险形态（耗号/撞号）与夹具面不同，用同一门混报会**淹没信号**。
3. **invalid 口径缺陷（实现期暴露，已修）**：初版写「命中==0 ⇒ 断言无效」，结果把 `--selftest` 的**正当零命中**
   正控例（POS1/POS2）误判为 `invalid`（selftest 一度 4/6）。已改为「**基线非空且命中为 0** ⇒ 无效」，
   selftest 现 **7/7**。属**口径**缺陷，非实现瑕疵。
4. **基线来源与「自证循环」的边界**：门基线 `43` 取自**上单独立盘点**（`implicit-inserts.json` 的 `level==R2`），
   **不是**本门自产 ⇒ 两路**扫描器实现独立**（上单：正则 + 上下文分类；本门：dollar-quote 作用域分类器），
   结果**逐条一致**（188/188 受体、43/43 命中，`file:line:table` 三重键差集为空）。**但**：
   两路的 **identity 表映射同源**（都源自 `identity-columns.json` / `baseline.identity_pk`）⇒
   「真源」不是两条独立取路，只是**同源不同用**。§1.2 才是真正的第二路（静态 DDL），但它复核的是**表/列**，
   不是**插入点**。
5. **§1 静态路径首轮 21/23（解析器缺陷，登记）**：首轮漏 `users.uid`（`migrations/0002_user_identity.sql` 用
   **带引号**表名 `"user"`，我的正则未处理引号标识符）与 `schema_migration.id`（`bigserial` 定义在
   `scripts/migrate.ts:52`，**不在** `migrations/`）。补齐（引号 + `migrate.ts`）后 **23/23**。
6. **R1 分级是我的判读，非实测**：§5.1 的「高/中/低」基于「该表是否已有夹具固定号（撞号对是否已成立）」+
   当前序列快照；**未**做活体撞号实验（§6/M6）。
7. **序列快照的时效性**：§1.1 的 `seq_next / max(PK)` 与「无表满足撞号前置条件」都是**瞬时结论**
   （复述 §6/N2）；本单**未**重新连库取数核验。
8. **命名/归属的边界**：`scripts/ns-alloc.ts` 被我在 §5.2 描述为「**只读扫描命名空间的探针工具**」——
   依据是 S29 报告 §2.2 的表述，**本单未独立复核**该脚本的当前实现。
9. **未做**：`--selftest` 全绿**不**等于「判据在真实仓上被证伪过」；真实仓的证伪由**判负**（仓外副本注入）
   承担，且该判负是**合成注入**（新增文件），**非**对既存 43 处的逐处证伪。

---

## §7.5 关于「是否纳入全量门套」的建议（**仅建议，Zang 裁**）

按硬口径④，本单**未改** `scripts/p7b-03-offline-gates.ts` / `p8-*` 门 / 任何计数常数。
建议如下（**未实施**）：

- `p7b-03-offline-gates.ts` 是**硬编码检查清单**（非脚本注册表），因此「纳入门套」= 新增一条调用或
  新增一个**同族计数点**，两种都会**动既有门面**（前者改脚本体、后者改计数常数）。
- 本门**天然适合**做**离线**面的一部分：零 DB / 零网络 / 只读 / 退出码语义清晰（0 绿 / 3 红 / 2 致命）。
- **建议**：以**独立门**形式保留（`npx ts-node --transpile-only scripts/s36-00-identity-pk-form-gate.ts`），
  由 Zang 决定是否在前推的「全量门」编排里加一行；**不建议**现在并入 `p7b-03`（会与其 89 注册点等
  计数常数纠缠，且本门基线 43 会随 R2 收敛而下调，需要独立维护节奏）。

