# P7-B · §7-32「管理员退款发起」实现——收口报告（Kong）

> 角色 = **Kong**（Builder） · 仓库 `/Users/kevin/bistro/seafood` · 分支 `main`。
> 本报告**逐节回填**（先骨架、后填读数），不以一次性写入收尾。运行标签见 §0。
> 硬口径：未测项写原因、**禁填 0 或空**；读数一律「命令 → 退出码 → 原文摘录」。

## §0 开工态与未回退

- 开工（会话开始）`git status --porcelain` = **20 行**，逐字（`RUN=20261002T0813Z`）：

```
 M backend-ts/scripts/p7b-03-offline-gates.ts
 M backend-ts/src/listing-funds-service.ts
 M docs/route-layer.spec.md
?? backend-ts/.p4-artifacts/p6tr1a-20261002T080355Z/
?? backend-ts/.p7b-artifacts/p7b-04-recon2-collect1.json
?? backend-ts/.p7b-artifacts/p7b-05-fixture-recon-collect1.json
?? backend-ts/.p7b-artifacts/p7b-06-fixture-setup-collect1.json
?? backend-ts/.p7b-artifacts/p7b-07-ac11-collect1.json
?? backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect1.json
?? backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect2.json
?? backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect2.stdout.json
?? backend-ts/.p7b-artifacts/p7b-ac04-migrate-idempotent-ac04.json
?? backend-ts/scripts/p7b-04-recon2.ts
?? backend-ts/scripts/p7b-05-fixture-recon.ts
?? backend-ts/scripts/p7b-06-fixture-setup.ts
?? backend-ts/scripts/p7b-07-ac11.ts
?? backend-ts/scripts/p7b-08-e2e-http.ts
?? docs/audit/p7-b-admin-refund.md
?? docs/audit/route-layer-v1.9-delta.md
?? docs/versions/route-layer.spec.v1.9.md
```
- `git log -1 --oneline`（开工）：**`b46bf9b`**（`docs: 批 7-B 护栏 PASS + 退款实现完成（我 apply 0024 并亲核：表/函数/触发器/零位移）+ 我三条裁定（R-A reason 口径 / R-B AC-11 判负改可复现三条 / R-C 夹具）+ 派收口∥spec v1.9 + §5.165/v0.165`）；`git rev-parse HEAD` = `b46bf9b0e959f747b1725e31b49914e50618a914`。**★ 并发事件（非本单）**：本轮进行中 HEAD 由 `b46bf9b` 前移至 **`d5f54d1`**（`docs/seafood.master-plan.md` **+34**、另一角色提交；**不含本单任何文件**）⇒ 本单工作树改动未受影响（`git status` 逐字对照见下）。
- 开工 sha 锚（本单收口二，逐件现取）：

| 件 | sha256 |
|---|---|
| `backend-ts/migrations/0024_admin_refund_audit.sql` | `b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d` |
| `backend-ts/src/listing-funds-service.ts`（本单改） | `9cc0e9c4c1b4c578265f2b66604493512f4f54d3b8151160d8b97cd6584971f8` |
| `backend-ts/src/ledger-errors.ts`（未碰） | `caff6f41cadc4ff39ab2306ebb4af3b0c27f716bf3e0cf0942443a41bac8fd95` |
| `backend-ts/scripts/p7b-03-offline-gates.ts`（本单改） | `1099fc47408deab3e88a058686e2631bfa1b480d0a5a07028a846e03ad8cd467` |
| `backend-ts/scripts/p7b-lib.ts`（未碰） | `5d80356ae34416a71a799a62485b5acb90bf292028fac940d9d142a1693bf01d` |

- 开工（20 行）/ 收尾（**24 行**）两次 `git status --porcelain` 为凭（见 §6）。**收尾 = 开工 + 本轮新增 4 个未跟踪件**：`.p4-artifacts/p6tr1a-20261002T081336Z/`、`.p7b-artifacts/p7b-03-offline-gates-20261002T081337Zk4uu.json`、`.p7b-artifacts/p7b-03-offline-gates-20261002T081420Zr2sk.json`（**本单产物**）+ `docs/versions/route-layer.spec.v2.0.md`（**Jing 并发单**）；**跟踪面（`M` 三件 = `p7b-03` / `listing-funds-service` / `route-layer.spec.md`）逐字未变**。
- 禁改件（`0001`–`0024` 迁移、前端、`docs/*.spec.md`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**` 既有件）**逐字未动**；本单只**新增**探针脚本 + run-tagged 产物 + 本报告。
- 判负变异**只在仓外副本内做**（副本 sha 关系与开工/收尾 `git status` 空为凭，见 §4）。

## §1 现取契约与行号

### 1.1 本报告的两条裁定（派单方口径 · **逐字引用**）

- **S-1（派单方的预期错了）逐字**：「**AC-11(iii) 的期望改为「另一笔 200 + `idempotent_replay:true`（同 txid）」** —— 因为退款键由 `order_id` 派生 ⇒ 两笔同订单**必同键** ⇒ 第二笔是**幂等重放**（比 409 更好：不报错、不双扣）。**我派单里写的「另一笔 409」作废**（同 §5.16 类「未枚举到边界」教训）。已另派 **Jing** 就地订正 AC-11 文本。」⇒ 本报告 AC-11(iii) 判据以 **S-1** 为准（§3.2）。
- **S-2 逐字**：「**同键异内容 ⇒ 409**」在 **HTTP 面结构性不可达**（路由 `request_fingerprint` 恒由 `order_id` 派生）⇒ **正式载体 = DB 层**（`LD003 LEDGER_IDEMPOTENCY_CONFLICT`）；报告与 AC 表述改为「**DB 层实测 LD003；HTTP 面 `NOT_APPLICABLE` + 原因**」。」⇒ 本报告 e2e 第⑧项以 **S-2** 为准（§3.3-⑧）。

### 1.2 契约锚点（spec `docs/route-layer.spec.md` **v1.9**，`wc -l` = **3661**）

| 条款 | 现取行号 | 要点 |
|---|---|---|
| 顶部 v1.9 状态块 | `:163` | 两批落地事实 + Zang 终审回写 |
| §12.11.2 审计表契约 `public.admin_refund_audit_log` | `:3177`（v1.7 加注 `:3247`） | 13 列 / PK×1 FK×4 CHECK×2 UNIQUE×1 / idx×4 / trg×1 |
| §12.11.3 编排函数 `public.listing_refund_post_event(jsonb)` | `:3253`（v1.7 加注 `:3264`） | 同函数同语句「资金 + 审计」；无 `RAISE`；无 `Y` 兜底子句 |
| §12.11.4 路由与准入（Z1/Z6 + 硬约束②③） | `:3273` | 复用同路径 / 注册点 68 / 错误码闭集 33 不动 |
| §12.11.6 可证伪 AC-11/12/13 | `:3308`（AC-11 `:3314` / 判负 `:3315` / AC-12 `:3316` / AC-13 `:3317`） | — |
| §12.11.6 **v1.9 加注**（AC-11 判负改可复现三条 + AC-13⑥ 订正） | `:3327` | 判据①源码级 / ②竞争实测 / ③正向 |
| §12.12 附加硬约束①②③（T-1/T-2/T-3 终审） | `:3353` | 白名单捕获 / 拒收回执同提交 / INSERT 落在处理器内 |
| §12.12.6 AC-14 / AC-15 | `:3426` / `:3427` | 注入 `53300`/`XX000` ⇒ 503；拒绝面零残留 |
| §12.13 迁移 `0024` 已 apply 事实 | `:3443` | F-0024-1…9 |

### 1.3 代码 / SQL 锚点（现取行号）

| 件 | 行号 | 内容 |
|---|---|---|
| `src/listing-funds-service.ts` | `:55` | `REFUND_ROLLS_BACK_STOCK = false`（7-7 单点） |
| 同上 | `:76` | `REFUND_ACTOR_SCOPE = 'seller_or_admin'`（硬约束③ 单点升级） |
| 同上 | `:111` | `resolveRefundActorRoute`（本面**唯一**准入真源；`NOT_ADMIN` 已删） |
| 同上 | `:342` | `refundListingOrder`（P4 退款编排入口） |
| 同上 | `:394` | `DatabaseService.listingRefundPostEvent(payload)`（单语句） |
| `src/index.ts` | `:1930` | `app.post('/api/listing-orders/:orderId/refund', …)`（注册点；复用同路径） |
| `migrations/0024_admin_refund_audit.sql` | `:48` | `CREATE TABLE IF NOT EXISTS public.admin_refund_audit_log`（13 列） |
| 同上 | `:89` | `admin_refund_audit_log_append_only()`（append-only 守卫） |
| 同上 | `:132` | `CREATE OR REPLACE FUNCTION public.listing_refund_post_event(payload jsonb)` |
| 同上 | `:164` | `EXCEPTION WHEN SQLSTATE 'LD011' THEN`（白名单捕获；**唯一**代码命中） |
| 同上 | `:250` | §D apply-time 自检（`DO $$ … $$`，失败整体回滚） |

## §2 改动清单 numstat

**已跟踪面**（`git diff --numstat`，现取）：

| 件 | +/− | 属谁 |
|---|---|---|
| `backend-ts/src/listing-funds-service.ts` | **15 / 14** | **本单**（:62 单点升级为 actor 分流 + 兼买方禁令 + 走新编排函数） |
| `backend-ts/scripts/p7b-03-offline-gates.ts` | **18 / 2** | **本单**（收口二增 `AC15-s3` + 修 TS2367；收口一增 `AC13-NEG-5/6` + R-A 断言） |
| `docs/route-layer.spec.md` | 194 / 0 | **Jing 并发改写（非本单）** —— 本单**未改** `docs/*.spec.md` |

**本单新增（未跟踪）件**：`backend-ts/scripts/p7b-{00-recon,01-migration-dry-run,02-t2-capture,03-offline-gates,04-recon2,05-fixture-recon,06-fixture-setup,07-ac11,08-e2e-http}.ts` + `p7b-lib.ts`；产物 `backend-ts/.p7b-artifacts/p7b-*.json`；`docs/audit/p7-b-admin-refund.md`（本报告）。
**未 `git add/commit/push`；未 `npm install`；未碰 `.env*`；未启停 5787/5788。**

## §3 逐条 AC 读数

### AC-④ migrate 幂等

- 命令：幂等重跑迁移链（产物 `backend-ts/.p7b-artifacts/p7b-ac04-migrate-idempotent-ac04.json`）。
- 读数：`ok = true`；`schema_version = 0024`；`applied_now` = **23 条**，`action` 计数 = **`{'skipped': 23}`**，`reason` 计数 = `{'already applied, checksum match': 23}`。
- `0024` 条目逐字：`{version:0024, name:0024_admin_refund_audit.sql, action:skipped, reason:"already applied, checksum match", applied_at:"Fri Oct 02 2026 16:01:41 GMT+0800"}`。
- 结构面：`public_base_table_count = 25`，且 `admin_refund_audit_log` ∈ `public_base_tables`。
- **判定：AC-④ 通过（23/23 skipped、`0024` 幂等、checksum 未漂移）。**

### AC-11（R-B 三条替代判据 + R-C 夹具）

产物 `backend-ts/.p7b-artifacts/p7b-07-ac11-collect1.json`（`order = 11`，根键 `biz:listing:refund:11`）：

- **(i) 源码级**：`has_for_update_regproc = true`，`pos_regproc = 4183`，`pos_regprocedure = 4183`，`for_update_count = 5` ⇒ `position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) = 4183 > 0`。
- **(ii) 竞争实测**：`victim_blocked_ms = 871`，`victim_error = null` ⇒ 受害者阻塞时长 **871ms > 0**（`FOR UPDATE` 行锁串行化的正向证据）。
- **(iii) 正向（按 **S-1** 口径判）**：
  - `a`：`{outcome:"ok", ok:true, result:"applied", idempotent_replay:false, txid:"341"}`
  - `b`：`{outcome:"ok", ok:true, result:"applied", **idempotent_replay:true**, txid:"341"}`
  - ⇒ **另一笔 = 200 + `idempotent_replay:true` 且 txid 同为 341**，**恰 S-1 期望**（两笔同订单必同键 ⇒ 第二笔为幂等重放）。
  - 差分：`purchase_refund +2`、`rootkey_rows +2`（`biz:listing:refund:11` 恰 2 行）、`audit_applied +1`、`audit_rejected 0`、`Σ(cid=1) 位移 = "0"`、`order_status = {status:"refunded", refund_txid:"341"}`。
- **判定：AC-11 通过。** 注：产物内派生布尔 `verdict_iii.exactly_one_effective = false` 系**旧 R-B(iii) 口径**的派生值（已被 S-1 取代，不构成判据）——**判据 = 上述原始读数 + 差分四项**（Δpurchase_refund 恰 +2、status 恰转 refunded 一次、applied 审计恰 1 行、Σ 零位移）。
- **R-C 夹具**：`order 3` **未被消费、仍 `paid`**（`p7b-04-recon2-collect1.json` 内 `listing_order` 行 `order_id 3 / status "paid" / has_refund_txid false`）；AC-11 用**自建夹具** `order 11`（seller 900008 / buyer 900002 / 1×1 / paid）。

### HTTP E2E 十项（collect1 = 权威读数）

产物 `backend-ts/.p7b-artifacts/p7b-08-e2e-http-collect1.json`（`base = http://127.0.0.1:5793`；夹具 f1=8 / f2=9 / f3=10）：

| # | 项 | 读数（逐字摘） | 判定 |
|---|---|---|---|
| ① | 无 token | `401` + `{error:{code:"AUTH_UNAUTHORIZED", message:"AUTH_UNAUTHORIZED", i18n_key:"auth.err.AUTH_UNAUTHORIZED", details:{}}}`；顶层键 = `["error"]` | PASS |
| ② | 第三方 P（900007）退款 order 8 | `403` `AUTH_FORBIDDEN` `reason:"ACTOR_NOT_ALLOWED"`（`ref_id:"8"`）；顶层键 `["error"]` | PASS |
| ③ | 卖方 S1（900001）退款 order 8 | `200` `result applied`，`idempotent_replay:false`，`txid:"343"`，`ledger_idempotency_key:"biz:listing:refund:8"`，`kinds:["purchase_refund","purchase_refund"]`，`stock_rolled_back:false` | PASS |
| ④ | 管理员 A_ADMIN（900005）退款 order 9 | `200` `applied`，`txid:"345"`，`key:"biz:listing:refund:9"`，`actor_uid:"900005"`，`seller_uid:"900003"` | PASS |
| ⑤ | 管理员**兼买方** A_BUYER（900004）退款 order 10 | `403` `AUTH_FORBIDDEN` `reason:"ACTOR_NOT_ALLOWED"`（`actor_uid:"900004"`, `ref_id:"10"`） | PASS |
| ⑥ | admin 缺 `manage_points` A_NOPTS（900006）退款 order 10 | `403` `AUTH_FORBIDDEN` `reason:"PERMISSION_NOT_GRANTED"` | PASS |
| ⑦ | 幂等重投（S1 重投 order 8） | `200` + `message:"Listing order refunded (idempotent replay)"`，`data.idempotent_replay:true`，`txid:"343"`（同首投） | PASS |
| ⑧ | **同键异内容** | **HTTP 面 `NOT_APPLICABLE`**（S-2：路由 `request_fingerprint` 恒由 `order_id` 派生 ⇒ 结构性不可达）；**DB 层实测** = `{sqlstate:"LD003", message:"LEDGER_IDEMPOTENCY_CONFLICT", detail:{actual:"p7b:DIFFERENT-FP", expected:"77b48b2e…", idempotency_key:"biz:listing:refund:8"}}` | PASS（DB 层载体） |
| ⑨ | 审计 txid = 资金回执 txid（逐字） | `f1_response_txid "343" = f1_audit_txid "343"`；`f2_response_txid "345" = f2_audit_txid "345"` | PASS |
| ⑩ | 账本零位移（除本事件外） | `ledger_rows_delta 4`（= 2 事件 × 2 分录）、`purchase_refund_delta 4`、`sum_cid1_balance_shift "0"`、`sum_cid1_frozen_shift "0"`；根键新增恰 `refund:8` / `refund:9` 各 2 行 | PASS |

审计表（collect1 `after.refund_audit`）三行：`log_id 1 / actor 900008 / order 11 / applied / txid 341`；`log_id 2 / actor 900001 / order 8 / applied / txid 343`；`log_id 3 / actor 900005 / order 9 / applied / txid 345`。

### AC-12 / AC-13 / AC-14 / AC-15（引用既有 + 本轮重取）

**离线判据 `p7b-03-offline-gates.ts`（本轮重跑，产物 `p7b-03-offline-gates-20261002T081420Zr2sk.json`，`37/37` 绿）：**

- **AC-12**（防双真源）：`AC12-s1 position(purchase_refund) = -1`；`AC12-s2 position(public.listing_post_event() = 1112`；`AC12-s3 position(admin_refund_audit_log) = 1937` ⇒ 函数体内**无**资金腿字面量、**有**复用调用、**有**同语句审计。
- **AC-13**（actor 分流六正向 + 判负）：① 卖方 `seller`/200；② 管理员 `admin`/200；②′ 角色行管理员 `admin`/200；③ 管理员兼买方 `ACTOR_NOT_ALLOWED`/403；④ 第三方 `ACTOR_NOT_ALLOWED`/403；⑤ admin 缺键 `PERMISSION_NOT_GRANTED`/403；⑥（构造上不可达）⇒ `ACTOR_NOT_ALLOWED`。判负：`AC13-NEG-1`（卖方路也要求 admin ⇒ 卖方被拦，mutant got=`DENIED_NOT_ADMIN`）；`AC13-NEG-2`（删兼买方禁令 ⇒ mutant got=`admin`）；`AC13-NEG-3` `AUTH_REASONS` 闭集仍恰 3 值；`AC13-NEG-4` 本面 reason 全在闭集内；`AC13-NEG-5/6`（R-A：`NOT_ADMIN` 已移出本面值域）。
- **AC-14**（白名单捕获 · 禁兜底子句）：静态 `AC14-s1 position(WHEN OTHERS) = -1`；`AC14-s2 exc=1153 ld011=1178`；分类器面 `AC14-cls-{53300,XX000,58030}` 逐条 ⇒ `{code:"LEDGER_TX_TIMEOUT", http:503}`（**绝不得** 409/rejected_state）。
- **AC-15③**（子事务不波及其他对象 · 离线可复算）：`AC15-s3 exc=1153 rejected_insert=2191`（拒绝留痕 `INSERT` 的 `'rejected_state', NULL` 出现在 `EXCEPTION` 关键字**之后** ⇒ 落在处理器内）。**★ 本轮新增判据**（见 §6 自曝）。

**行为面（`p7b-01-migration-dry-run.ts` 干跑 · 回滚事务内 · 产物 `p7b-01-migration-dry-run-20261002T075750Zc5ud.json`，`41/41` 绿，`dry_run.error = null`，`mode ROLLBACK`，`Z-1 零位移` 通过）：**

- **AC-12/AC-14 真库函数定义复核**：`AC12-1 pos=-1` / `AC12-2 pos=955` / `AC14-1 pos=-1` / `AC14-2 exc=1274 ld011=1299` / `Z3-1 pos=-1`（无 `RAISE`）/ `Z4b-1 pos=-1`（无 advisory lock）。
- **AC-15（拒绝面）**（`order 1`，status=`created`）：`C1-reject {ok:false, result:"rejected_state", audit_logged:true}`；`C1-reason "order_not_refundable"`；`C1-zerofunds {rows:0, purchase_refund:0, rootkey1:"0"}`（**零资金残留**）；`C1-audit+1` 审计恰 1 行 `rejected_state`；`C1-txidnull null`；`C1-order-unchanged {status:"created"}`；`C2-conflict rows=1`（同键重投 `ON CONFLICT DO NOTHING`）。
- **AC-15③ 判负（行为面 M7）**：把审计行 `INSERT` 移进 `BEGIN` 子事务块 ⇒ `{total_rows_order1:0, rejected_rows_order1:0}`（**被拒留痕消失** ⇒ 判据成立：处理器内 `INSERT` 是留痕存活的条件）。
- **404 不留痕（T-3）**：`D1-404-propagates sqlstate="LD022"`；`D1-404-nomark 2->2`（审计表 Δ=0）。
- **append-only**：`E1-ao-update/delete` 均 `P0001`「admin_refund_audit_log is append-only」。
- **apply-time 自检变异（M1–M6）**：6 条变异全部被 §D 自检拦住（`P0001`），回滚后 `residue = null`。
- **成功腿（`order 3` 干跑）**：`B1-ok` / `B1-legs Δ=2` / `B1-audit1` 恰 1 行 `applied` / `B1-txid 333=333` / `B1-key biz:listing:refund:3` / `B1-fields 7/8/1/100` / `B1-no-stock 0→0` / `B1-status refunded`；`B2-replay` 与 `B2-zero {rows:0,purchase_refund:0}`（幂等重投零位移）。**（干跑在回滚事务内 ⇒ `order 3` 真库未被消费。）**

### 夹具残留登记（R-C 自建夹具 · 只读现取）

真源：`p7b-06-fixture-setup-collect1.json` 的 `residue_manifest` + 本轮只读探针（`scratch/p7b-round2-raw/residue-probe-20261002T0817Z.json`，uid ≥ 900000）。

| 对象 | 残留读数（现取） |
|---|---|
| `public.users`（uid 900001–900008，**8 行**） | 900001 / 900002 / 900003 / 900004 / 900005 / 900006 / 900007 / 900008 |
| `public.admin_role`（**2 行**） | `p7b_fixture_admin`（`P7B fixture admin (manage_points)`）、`p7b_fixture_nopts`（`P7B fixture admin without manage_points`） |
| `public.admin_role_permission`（**2 行**） | `p7b_fixture_admin → manage_points`、`p7b_fixture_nopts → read_users` |
| `public.admin_user_role`（**本夹具 3 行**） | `900004 → p7b_fixture_admin`、`900005 → p7b_fixture_admin`、`900006 → p7b_fixture_nopts`（另 `970213 → super_admin` 系 `0022` 既有、**非本夹具**） |
| `public.listing`（**1 行**） | `listing_id 23`（seller 900001 / cid 1 / price 1 / stock 100 / status `listed` / `create_key cli:p7b-fixture-listing-01`） |
| `public.listing_order`（**6 行**） | `8`（900001→900002）/`9`（900003→900002）/`10`（900001→900004）/`11`（900008→900002）/`12`（900001→900002）/`13`（900003→900002）；状态：**8 / 9 / 11 = `refunded`**（refund_txid `343`/`345`/`341`）、**10 / 12 / 13 = `paid`** |
| 账本供资 `transfer`（**6 行 / 3 事件**） | txid `335`(−10, uid 6)/`336`(+10, 900001)；`337`(−10, 6)/`338`(+10, 900003)；`339`(−10, 6)/`340`(+10, 900008)；`idempotency_key = ops:p7b:fund:collect1:{900001,900003,900008}` |
| 账本退款分录 `purchase_refund`（根键 **6 组 × 2 行**） | `biz:listing:refund:{2,6,7,8,9,11}` 各 **2 行**（8/9/11 = 本夹具事件；2/6/7 = 既有历史） |
| `public.admin_refund_audit_log`（**3 行**） | `log_id 1`（actor 900008 / order 11 / `applied` / txid `341` / `biz:listing:refund:11` / memo `p7b ac11 refund:11`）；`log_id 2`（900001 / order 8 / `applied` / txid `343` / `biz:listing:refund:8`）；`log_id 3`（900005 / order 9 / `applied` / txid `345` / `biz:listing:refund:9`） |
| 真库总量对照 | `public.ledger_entry = 335` 行；`Σ(cid=1) balance = 1989693` / `frozen = 10507`（**零位移**） |
| **`order 3`** | **未被消费、仍 `{status:"paid", refund_txid:null}`**（干跑在回滚事务内、HTTP E2E 未用它） |

## §4 判负自证（仓外副本内）

**纪律**：判负变异**只在仓外副本内做**；**严禁改主工作区任何被检文件**。

- 副本：`/Users/kevin/.hermes/profiles/zang/cache/scratch/p7b-negctl-20261002T081420Z/backend-ts`（`rsync -a` 复制，**排除 `node_modules`/`artifacts`/`.env*`/`.git`**；`node_modules` 以符号链接复用主工作区）。
- **副本 vs 主工作区 sha 关系（逐件 SAME）**：`migrations/0024_admin_refund_audit.sql`、`src/listing-funds-service.ts`、`src/ledger-errors.ts`、`scripts/p7b-03-offline-gates.ts`、`scripts/p7b-lib.ts` **全部 SAME**（`shasum -a 256` 逐件比对）。
- 驱动器：`scratch/p7b-negctl-driver.py`（读写在副本内）；原始输出：`scratch/p7b-negctl-out.txt`。
- 判据载体 = **副本的** `p7b-03-offline-gates.ts`（离线、确定；`AC14-s1` = `position('WHEN OTHERS')=0`；`AC15-s3` = 拒绝留痕 `INSERT` 落在 `EXCEPTION` 处理器内）。

| 阶段 | 副本 0024 sha256 | 副本 p7b-03 读数 |
|---|---|---|
| **① 基线（副本未变异）** | `b2495845…0aa31b1d` | exit 0，**37/37 绿**，`red=[]`；`AC14-s1 pos=-1` / `AC14-s2 exc=1153 ld011=1178` / `AC15-s3 exc=1153 rejected_insert=2191` |
| **② 变异 (a)** 白名单捕获 → `WHEN OTHERS`（`EXCEPTION WHEN SQLSTATE 'LD011' THEN` → `EXCEPTION WHEN OTHERS THEN`） | `c9aff64e…98db6d9` | exit **1**，**36/37**，**`red=["AC14-s1"]`**；`AC14-s1 pass=false reading=pos=1163` |
| **③ 复原 (a)** | `b2495845…0aa31b1d`（== 基线） | exit 0，**37/37 绿**，`red=[]` |
| **④ 变异 (b)** 把拒绝留痕 `INSERT` **移出 `EXCEPTION` 处理器**（移进 `BEGIN` 子事务块） | `da44be8d…8e2ddf` | exit **1**，**36/37**，**`red=["AC15-s3"]`**；`AC15-s3 pass=false reading=exc=1602 rejected_insert=1371`（**`1371 < exc`** ⇒ 落在处理器外） |
| **⑤ 复原 (b)** | `b2495845…0aa31b1d`（== 基线） | exit 0，**37/37 绿**，`red=[]` |

- **收尾副本 sha == 原始 sha**：`final copy 0024 sha == original? True`（`b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d`）。
- **两处判负均已做、均得「变异→红→复原→绿」**：**(a) 白名单 ↔ `WHEN OTHERS` ⇒ AC-14 判据（`AC14-s1`）必红**；**(b) 审计 `INSERT` 移出异常处理器 ⇒ AC-15③ 判据（`AC15-s3`）必红**。
- **零污染凭据**：判负前后两次主工作区 `git status --porcelain` = **24 行、逐字相同**（见 §6）；**主工作区任何被检文件 sha 未变**（副本比对用同一 sha 源）。

## §5 未做与 NOT_MEASURED（逐项原因）

1. **HTTP 面「同键异内容 ⇒ 409」= `NOT_APPLICABLE`**（**S-2**）：路由层 `request_fingerprint` 恒由 `order_id` 派生 ⇒ 同一订单的 HTTP 重投必同内容 ⇒ **结构性不可达**；正式载体 = **DB 层 `LD003 LEDGER_IDEMPOTENCY_CONFLICT`**（已实测，§3.3-⑧）。**非「未测」，是「结构性不存在该路径」。**
2. **AC-11(iii) 的 `verdict_iii.exactly_one_effective` 派生布尔**：产物内为 `false`，属**旧 R-B(iii) 口径**的派生值；按 **S-1** 重判 = 满足。**不重跑 `p7b-07`**（`order 11` 已被 collect1 消费为 `refunded`；重跑会得 `rejected_state` ⇒ 非同一前置）。**读数以 collect1 产物为准。**
3. **collect2 E2E 非有效读数**：`p7b-08-e2e-http-collect2.json` 系**默认参数**运行（`P7B_E2E_F1=5`（不存在）/`F2=6`（真库既有 `refunded` 单）/`F3=10`），**未复现 collect1 的夹具前置** ⇒ 其 ⑧→`LD022`、②③⑦→`404`、④→对 `order 6` 的**历史退款重放**（txid 219）**均为误配参数所致、非代码差异**。逐项对照见 §5.1。
4. **AC-14 的 `53300`/`XX000`「注入到已部署函数」**：本单**未**改真库已 apply 的 `listing_refund_post_event`（禁改 `migrations/**`；`0024` 已 apply）。**已测面** = ① 分类器（`p7b-03` `AC14-cls-*` ⇒ 503）；② 白名单机制（`p7b-02-t2-capture`：`whitelist_LD011` 被捕获、`53300`/`XX000`/`LD022` **向上抛**；`mutant_53300/XX000` 被兜底子句吞 ⇒ 判负机制成立）；③ 副本变异 `WHEN OTHERS ⇒ AC14-s1 红`（§4）。**未测面** = 对**真库函数体**在运行态注入基础设施错（需在测试库改函数体，本单不做）⇒ **`NOT_MEASURED` + 原因**。
5. **`tsc -p tsconfig.scripts.json --noEmit` 的「既有债逐条清单」**：本单只给**计数 + 差集**（§6.2），**未**逐文件枚举 77 条行号（属既有债、本单不修）⇒ 读该清单须取命令原文（`scratch/p7b-round2-raw/tsc-scripts-*.txt`）。

### 5.1 collect2 逐项读回 × collect1 对照

`p7b-08-e2e-http-collect2.json`（默认参数）逐项 vs `…collect1.json`（权威）：

| # | collect1（F1=8/F2=9/F3=10） | collect2（默认 F1=5/F2=6/F3=10） | 差异 |
|---|---|---|---|
| ① 无 token | `401 AUTH_UNAUTHORIZED` | `401 AUTH_UNAUTHORIZED` | **一致** |
| ② 第三方 | `403 ACTOR_NOT_ALLOWED`（order 8） | `404 LEDGER_REF_NOT_FOUND`（order 5 不存在） | **差异**（collect2 目标单不存在） |
| ③ 卖方 | `200 applied txid 343`（order 8） | `404 LEDGER_REF_NOT_FOUND` | **差异** |
| ④ 管理员 | `200 applied txid 345`（order 9） | `200 idempotent_replay txid 219`（order 6 历史退款重放） | **差异** |
| ⑤ 兼买方 | `403 ACTOR_NOT_ALLOWED`（order 10） | `403 ACTOR_NOT_ALLOWED`（order 10） | **一致** |
| ⑥ 缺 `manage_points` | `403 PERMISSION_NOT_GRANTED`（order 10） | `403 PERMISSION_NOT_GRANTED`（order 10） | **一致** |
| ⑦ 重投 | `200 replay txid 343` | `404 LEDGER_REF_NOT_FOUND` | **差异** |
| ⑧ 同键异内容 | DB 层 `LD003` | DB 层 `LD022`（order 5 不存在 ⇒ 未达幂等键层） | **差异**（均由「order 5 不存在」派生） |
| ⑨ txid 配对 | `343=343 / 345=345`（**配对**） | `f1_resp null ≠ f1_audit 343`；`f2_resp 219 ≠ f2_audit 345`（**不配对**） | **差异** |
| ⑩ 零位移 | `Δledger 4 / Δpurchase_refund 4`；Σ 位移 0 | `Δledger 0 / Δpurchase_refund 0`；Σ 位移 0 | **差异**（collect2 无成功退款事件） |

- **结论**：collect2 与 collect1 **3 项逐字一致（① 401 / ⑤ 兼买方 403 `ACTOR_NOT_ALLOWED` / ⑥ 缺键 403 `PERMISSION_NOT_GRANTED`）**、**7 项差异（②③④⑦⑧⑨⑩）**。**全部差异的单一根因 = collect2 以默认 `F1=5`/`F2=6` 运行、未复现夹具前置**（`order 5` 不存在、`order 6` 为真库既有 `refunded` 单）；**非代码面差异**（`listing-funds-service.ts` / `0024` 两轮间未变）。**权威读数 = collect1。**

## §6 自曝

1. **本单（收口二）改动**：`p7b-03-offline-gates.ts` 增 `AC15-s3`（AC-15③ 离线可复算判据）+ 修 `flatAdminMutant` 返回类型标注（消 `TS2367`）；`p7b-06-fixture-setup.ts` 修 `(out.users as unknown[]).length`（消 `TS18046`）。**未碰**任何 `migrations/**`（`0001`–`0024` 全冻结）、前端、`docs/*.spec.md`、`docs/seafood.master-plan.md`、`docs/qa/**`、`docs/audit/**` 既有件、`.env*`。
2. **两条硬门（改动后复跑）**：
   - `p4z-tr1a-01-offline-tests.ts` ⇒ **`SUMMARY total=126 passed=126 failed=0`**（exit 0，**126/126 不降**）；产物 `backend-ts/.p4-artifacts/p6tr1a-20261002T081336Z/offline-tests.json`。
   - `tsc -p tsconfig.scripts.json --noEmit`：**前（开工态）= 79 错 / 24 文件** ⇒ **后 = 77 错 / 22 文件**（**−2 错 / −2 文件**）；新报错行（sorted diff）= **0**；`p7b-*` 残留错 = **0**（原 `p7b-03:70 TS2367` 与 `p7b-06:43 TS18046` 已消）⇒ **本单新增/改动脚本贡献 0 新错**，且回到 spec §13.3 记的既有债基线 **77/22**。原始输出 `scratch/p7b-round2-raw/tsc-scripts-{before,after}-*.txt`。
   - `p7b-03-offline-gates.ts` 改后复跑 ⇒ **`37/37` 绿**（产物 `p7b-03-offline-gates-20261002T081420Zr2sk.json`）。
3. **判负只在仓外副本内做**（§4）；主工作区 `git status` 的**跟踪面**（`M` 三件 = `p7b-03-offline-gates.ts` / `listing-funds-service.ts` / `route-layer.spec.md`）**开工（20 行）/ 收尾（24 行）逐字未变**；收尾多出的 4 个未跟踪件见 §0（3 本单 + 1 Jing 并发 `spec.v2.0.md`）⇒ **零跟踪面位移；未改主工作区任何被检文件**。
4. **`order 3` 未被消费、仍 `paid`**（`p7b-04-recon2-collect1.json`）。
5. **`docs/route-layer.spec.md` 的 `194/0` 差异 = Jing 并发单**（`route-layer.spec.md` 正被 Jing 改写，本单**未改**其一个字节）。
6. **收尾**：本单**未自起 5793 实例**（本轮全离线：p4z 离线套件 / p7b-03 离线 / tsc / 仓外副本判负）⇒ 无本单 PID 可关；`lsof -nP -iTCP:5793-5799 -sTCP:LISTEN` = **空读数**（exit 1）。**5788 = 既有 bistro dev 栈**（PID **65096**，`node …/ts-node src/index.ts`，启动 10:02AM，属 `bistro/ctrl`）—— **非本单、未触碰、未启停**（口径：不得启停 5787/5788）。
7. **未测/边界**（逐项见 §5）：HTTP 同键异内容 `NOT_APPLICABLE`（S-2）；AC-14 真库运行态注入 `NOT_MEASURED`；collect2 非有效读数；`verdict_iii` 派生布尔属旧口径。
8. **纪律自检**：身份表一律 `users`（探针 SQL 全用 `public.users`/`public."users"`，绝不裸 `user`）；SQL 显式 `public.`；**未用 `pkill -f`/`killall`**；测试 uid 全 ≥ 900000；原始输出 run-tagged、**不用 `.log` 后缀**；**未 `git add/commit/push`**；**未 `npm install`**。
