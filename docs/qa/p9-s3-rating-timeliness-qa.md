# P9③ 终审质检（Neng · 被检面 `627032b`）· 评分 / 时效 + `R-9-7` 发货收货

- **被检面（钉死）**：`627032bddf8970318ce3f2ed0be23cc1c46709d9`（★ 已 push ⇒ 生产已上线 `schema_version` `0031`）
- **质检方**：Neng（独立重取；不采信交付方 / 派单方转引；探针 / 夹具**自写**，不复用 Kong 的）
- **固定副本**：`git worktree add --detach <scratch>/qaP9s3 627032b` + 软链 `node_modules`（前后端）+ `backend-ts/.env.local`；收尾 `worktree remove --force`
- **硬约束**：库面写一律事务内 + 末尾 `ROLLBACK`；**严禁 UPDATE `app_config`**（策略键事务内 `INSERT`）；**禁 apply 迁移**；仅写 `docs/qa/**` 与本单产物；不 `git add/commit/push`；不 `npm install`；不碰 / 不打印 `.env*`；禁 `pkill -f`/`killall`；不启停 `5787`/`5788`；探针不得放进 `backend-ts/scripts/`；原始输出不用 `.log` 后缀。

---

## 0. 开工锚（现取）

- **主仓 `git log -1` 现取**：`14af511f2eea40c730d9a8c2dc822491b7d89aa8`（`docs(p9-3): §5.248/v0.248 —— P9③ 终审质检实质面全绿 verdict 通过（21/21 · 判负 4/4 · 硬门全绿 · checksum 一致）+ 唯一缺口报告回填 + 派极小收尾`；提交时间 `2026-10-03 12:34:37 +0800`）
- **被检面钉**：`627032bddf8970318ce3f2ed0be23cc1c46709d9`；**祖先核**：`git merge-base --is-ancestor 627032b HEAD` = `true`（rc=0）
- **漂移（`627032b..HEAD`）**：`git diff --stat 627032b HEAD` = `docs/seafood.master-plan.md | 66 ++++…`（**仅 1 文件 · +66/-0**）⇒ **漂移仅 docs**（零代码 / 零迁移 / 零被检报告漂移）
- **工作树 vs 被检面（受检面文件）**：`git diff --stat 627032b -- backend-ts/src backend-ts/migrations backend-ts/scripts frontend/src` = **空**（无差异）
- **首 `git status --porcelain`**：共 **157 行** = **1 × `M`**（`backend-ts/.p4-artifacts/b4c-20260930T210239/geometry.json`，既有产物）+ **156 × `??`**（`.p4/.p8s*/.p9s*` 产物目录、`p8-s5-00-recon*.ts` 遗留探针、本报告）—— **零触碰 `src/` / `migrations/` / `docs/audit/`**。

---

## 1. L0 现取（活体 · 只读）

> 手法：自写只读探针 `backend-ts/.p9s3qa-probe/l0-schema.ts`（`readQuery` 单语句只读）。产物 `.p9s3qa-artifacts/l0-schema-20261003T042506Z.json`。

- `schema_version` = **`0031`**；`schema_migration` 行数 = **30**；基础表 = **34**。
- **`rating` = 恰 11 列**（列序）：`rating_id · rater_uid · ratee_uid · target_type · target_id · direction · stars · idempotency_key · request_fingerprint · memo · time_created`。
  约束 = PK×1 `rating_pk` · FK×2 `rating_rater_fk`/`rating_ratee_fk` · CHECK×2 `rating_direction_target_ck` / `rating_stars_rng`（`0 ≤ stars ≤ 5`）· UNIQUE×2 `rating_once_uniq(rater_uid,target_type,target_id)` / `rating_idem_uniq(idempotency_key)`。
  索引 5 枚（含 `idx_rating_ratee_time` · `idx_rating_target`）；**append-only 触发器 1 枚** `trg_rating_append_only`（`BEFORE DELETE OR UPDATE ON public.rating … EXECUTE FUNCTION rating_append_only()`）。
- **`listing_order_event` = 恰 13 列**（列序）：`event_id · order_id · event_type · from_status · to_status · actor_uid · txid · idempotency_key · request_fingerprint · ref_type · ref_id · memo · time_created`。
  约束 = PK×1 `listing_order_event_pk` · FK×2 `…_order_fk`/`…_actor_fk` · CHECK×1 `listing_order_event_type_enum`（**恰 6 值**：`created/paid/shipped/received/refunded/cancelled`）· UNIQUE×1 `listing_order_event_idem_uniq`。
  索引 3 枚（含 `idx_listing_order_event_order_time`）；**append-only 触发器 1 枚** `trg_listing_order_event_append_only`。
- **`listing_order` status CHECK = 恰 6 值**：`created · paid · shipped · received · refunded · cancelled`。
- **`transition_ok` 读数**（活体函数逐条）：允许 = `created→paid` ✓ · `created→cancelled` ✓ · `paid→shipped` ✓ · `paid→refunded` ✓ · `shipped→received` ✓ · `shipped→refunded` ✓；禁止 = `created→shipped` ✗ · `created→received` ✗ · `paid→received` ✗ · `received→refunded` ✗ · `received→paid` ✗ · `refunded→paid` ✗。
- 基线计数：`rating`=0 · `listing_order_event`=0 · `listing_order`=18 · `schema_migration`=30。

---

## 2. L2 四段真链路独立重取（自写探针） + 反向判负

> 手法：自写探针 `backend-ts/.p9s3qa-probe/l2-realchain.ts`（库面写一律事务内 + 末尾 `ROLLBACK`）。产物 `.p9s3qa-artifacts/l2-realchain-20261003T042651Z.json`。

**链路总判 = 21/21 · failed 0**；且 **零净写**（`L2-Z0`：baseline `{rating:0,event:0,order:18,users:56}` == after `{rating:0,event:0,order:18,users:56}`）。

- **① 评分四读数**：`inserted`（四要素服务端取数 · ratee=7710002 · stars=4）· `replay`（同键二次 · 取真值 stars=4）· `already_rated`（同侧异键 · `UNIQUE(rater_uid,target_type,target_id)` 兜底）· `stars=6` 越界 ⇒ 拒 **`23514`**（`rating_stars_rng` 值域 CHECK 兜底）。
- **② 汇总四周期**：`30=5 · 90=4 · 360=3 · 1000=3.25`（四原始行）；**有行**（uid 7710002 · 1 条 4 星）⇒ `worker=4 · counts.worker=1`。
- **③ ★ 无行 / 有行兜底**：**无行**（空表）⇒ `source=constant` · `defaultStars=3.0` · 四角色皆 3.0（不因无行变 0/NaN）；**有行（config）**⇒ `source=config` · `defaultStars=4` ⇒ 无行角色回落 4.0（取真值非兜底）。
- **④ 时效**：T1/T2（`job_submission.time_created→reviewed_at`）⇒ `poster=3 · worker=3`；T3/T4（`listing_order_event.time_created`）⇒ `ship=3 · recv=4`；**无数据 ⇒ 四值 `null`**（不填 0）。
- **⑤ 发货 / 收货**：`paid→shipped` ⇒ 状态回写 `shipped` 且**事件行同生**（events=1）；`shipped→received` ⇒ 状态回写 `received` 且**事件行再现**（events=2）；非法 `created→shipped` ⇒ `state_conflict` · 事件 0 · status 仍 `created`；非归属（买方发 ship）⇒ `not_party`。
- **⑥ 退款闸**：`shipped` **过状态闸**（仅因 `pay_txid` 缺 ⇒ `order_pay_missing`）⇄ `received` / `created` ⇒ `order_not_refundable`。
- **★ `C-15` 负对照**：内层 `(SELECT COALESCE(col,0) …)` 对无行 ⇒ **`null`** ⇄ 外层 `COALESCE((SELECT col …),0)` ⇒ **`0`**。

**反向判负（仓外副本 `p9s3-copy` · 基线离线 89/92）· 四变异逐条必红、复原回绿、`cmp` SAME**：

| 变异 | 位置 | 触红（信号） | 复原 |
| --- | --- | --- | --- |
| **M1** 去无行守卫（评分聚合） | `backend-ts/src/database.ts` | **`G5` · `V7` · `V8`**（`92→89/92` · rc=1） | 回绿 92/92 |
| **M2** 时效 `null→0`（`numOf` 定义清零） | `backend-ts/src/database.ts` | **`V11`**（`92→91/92` · rc=1） | 回绿 92/92 |
| **M3** 状态集回 4 值（`0030` CHECK） | `backend-ts/migrations/0030_…sql` | **`C1`**（`92→91/92` · rc=1） | 回绿 92/92 |
| **M4** 放行 `received→refunded` | `0030_…sql` `transition_ok` | **`C3` · `C5` · `C6` · `C2` 自检（selftest）**（`92→88/92` · rc=1） | 回绿 92/92 |

- 复原后 `cmp` 逐文件 **SAME**：`src/database.ts` · `migrations/0030…sql` · `migrations/0031…sql` · `scripts/p8-s8-…ts` · `src/index.ts`；`RESTORE` 读数 = `92/92 · failed 0 · pending_apply 0 · rc 0`。

---

## 3. L3 同族自判：新顶层 helper 是否再污染门块边界

> 手法：自写切块探针逐门复刻 `handlerBlock` 边界。产物 `.p9s3qa-artifacts/l3-samefamily-scan.txt`。

- **`p8-s7` 块边界锚（新形）= 「本路由顶层 `});`」（`:92`）**：`handlerBlock`（`scripts/p8-s7-batt-checkin-gate.ts:84`）先收 `if (/^\}\);/.test(lines[i])) { end = i + 1; break; }`（落 `:92`），再兜底下一注册点 `^\s*app\.(get|post|put|delete|patch)\(`。注释明载动因：P9③ 在两路由间插入顶层 helper 后，旧「切到下一注册点」会把 helper 内的码误并进本 handler 令 `F2` 假红。
- **`sendOrderTransition`（`src/index.ts:1315`）落 5 新口之前**：5 新口注册行 = `:1343`（`GET /api/rating/summary`）· `:1372`（`GET /api/timeliness`）· `:1400`（`POST /api/rating`）· `:1452`（`POST .../ship`）· `:1475`（`POST .../receive`）—— helper 文本段（`:1315`）**位于全部 5 新口之前**，不落入任一新口块 ⇒ **无 helper 混入**。
- **`COALESCE` 内层残件**（缺陷形 `(SELECT COALESCE(<裸列>)`）仅见于**遗留** `scripts/p2qa-06-levels10-tail.ts:100/101` · `scripts/p2qa-14-replay-guard.ts:32` · `scripts/p2qa-00-baseline.ts:81` · `scripts/p2qa-04-idempotency-policy.ts:196` · `scripts/p2b-03-summary.ts:20`；这些文件**均不在被检变更集（27 文件）内** ⇒ **无同族残留**。`src/database.ts` 走**外层正解形** `COALESCE((SELECT <计数> …)`。
- **`p8-s8` 门为「仅路由锚」形**（未采用 `});` 早收），故未被 helper 切块影响；`p8-s2` 为旧形 `^app.`（列 0）。两者读数见 §5。

---

## 4. L4「无行 ⇒ 兜底值」负对照独立小节

> 目的：证「无行」不退化为 0 / NaN，且与「有行取真值」形成正负对照（承 `C-15`）。

| 面 | 无行读数 | 有行读数（对照） |
| --- | --- | --- |
| 评分策略 `resolveRatingPolicy` | `source=constant` · `defaultStars=3.0` | `source=config` · `defaultStars=4` |
| 评分聚合（分母 0 守卫） | 回落 `policy.defaultStars`（3.0） | 真均值（如 uid 7710002 ⇒ 4.0） |
| 时长 `numOf(...)` | **`null`**（不填 0 · §32.2(c)） | 真值（T1/T2=3 · T3/T4=3/4） |
| `C-15` 两形态 | 内层 `COALESCE(col,0)` 标量子查询 ⇒ **`null`** | 外层 `COALESCE((SELECT …),0)` ⇒ **`0`** |

- 独立读数（`.p9s3qa-artifacts/l2-realchain-20261003T042651Z.json`）：`L2-R8`（无行 ⇒ `constant` · 3.0 · 四角色 3）· `L2-R9`（有行 config ⇒ 4.0）· `L2-T3`（无数据 ⇒ 四时长 `null`）· `L2-C15`（`inner:null` ⇄ `outer:0`）—— **皆 PASS**。

---

## 5. L1 硬门（本单复跑 · 退出码管道外捕获）

| 门 | 读数 | 证据 |
| --- | --- | --- |
| 后端 `tsc` | **exit 0**（0 诊断） | `l1-tsc.out` 空（0 B） |
| 后端离线单测 | **126 / 126** | `l1-offline.out` `SUMMARY total=126 passed=126 failed=0` |
| `p8-s1` app-config | **24 / 24** | `l1-p8-s1-app-config-gate.out` |
| `p8-s2` fee-rebate | **41 / 41** | `l1-p8-s2-fee-rebate-gate.out` |
| `p8-s3` deposit | **45 / 45** | `l1-p8-s3-deposit-gate.out` |
| `p8-s3b` address | **38 / 38** | `l1-p8-s3b-address-gate.out` |
| `p8-s4` currency-review | **79 / 79** | `l1-p8-s4-currency-review-gate.out` |
| `p8-s5` compliance | **117 / 117** | `l1-p8-s5-compliance-gate.out` |
| `p8-s6` site-text | **64 / 64** | `l1-p8-s6-site-text-gate.out` |
| 前端 `build` | **exit 0**（✓ built in 1.66s） | `l1-frontend-build.out` |
| 前端 `test:unit` | **276**（31 files） | `l1-frontend-testunit.out` |
| **`p8-s7` 带实例** | **56 / 56**（`db=7 http=9`） | `l1-p8-s7-instance.out` |
| **`p8-s7` 离线** | **53 / 56**（3 failed = `G8`/`G9`/`G10` 真 HTTP leg 无实例 ⇒ `fetch failed`） | `l1-p8-s7-offline.out` |
| **`p8-s8` 带实例** | **92 / 92**（`http=11`） | `l1-p8-s8-instance.out` |
| **`p8-s8` 离线** | **92 / 89 / 3**（3 failed = `H5`/`H6`/`H7` 真 HTTP leg 无实例 ⇒ `fetch failed`） | `l1-p8-s8-offline.out` |
| **注册点** | **85**（`get=36 post=46 put=0 patch=1 delete=2`） | `l1-p8-s8-instance.out` `readings.registration_points_total` |

- 说明：`p8-s7`/`p8-s8` 的**离线 3 红均为「真 HTTP leg」**（`fetch failed`），与带实例读数成对，属无实例场景的**预期读数**，非缺陷；离线腿已由带实例读数（56/56 · 92/92）覆盖。

---

## 6. L5 库面（只读）：checksum 双对拍 + 零净写

> 手法：自写只读探针 `backend-ts/.p9s3qa-probe/l5-checksum.ts`。产物 `.p9s3qa-artifacts/l5-checksum-20261003T043250Z.json`。

- **`schema_migration` 行数 = 30 == `migrations/*.sql` 文件数 = 30 · `mismatch_count = 0`**（`mismatches: []`）。
- **两 checksum 双对拍（DB 存储值 == 文件 sha256）**：
  - `0030` `0030_listing_order_status_extend.sql` ⇒ `e49fb99b21a73be417dfb58ebd7052b9745d6d4925f57948e385a45ec747163f`（DB）== `e49fb99b21a73be417dfb58ebd7052b9745d6d4925f57948e385a45ec747163f`（file）✓
  - `0031` `0031_rating_and_order_event.sql` ⇒ `9ba5c35fc3bd99e7c6d5f198bcad8f527d670eb6363e64f195217d02b36360fd`（DB）== `9ba5c35fc3bd99e7c6d5f198bcad8f527d670eb6363e64f195217d02b36360fd`（file）✓
- **零净写**：`counts = { rating:0, event:0, listing_order:18, users:56, app_config:1 }`（主库零写入）。

---

## 7. L6 报告核 + 锚点

- **被检报告** `docs/audit/p9-s3-rating-timeliness.md` = **336 行 / 41,590 B / 占位符 0**（`report-selfcheck`：`lines=336 bytes=41590 double_underscore_lines=0 skeleton_placeholder_lines=0`）。
- **抽 5 条逐字复现**（被检报告 §10.2 表 ⇄ 本单探针读数 **逐字一致**）：
  1. `V5` 四周期 ⇒ `{30:5, 90:4, 360:3, 1000:3.25}` ✓
  2. `V7` 无行 ⇒ `{source:"constant", defaultStars:3, …四角色皆 3}` ✓
  3. `V10` T3/T4 ⇒ `{t3_vendor_ship:3, t4_customer_recv:4}` ✓
  4. `V12` 发货 ⇒ `{outcome:"shipped", from:"paid", to:"shipped", status:"shipped", events:1}` ✓
  5. `V13` 收货 ⇒ `{outcome:"received", from:"shipped", to:"received", status:"received", events:2}` ✓
- **★ 登记 `ratingId` 环境漂移**：被检报告 §10.2 报 `ratingId:65`；本单 **`p8-s8` 带实例 leg 现取 = 125**（`l1-p8-s8-instance.out` `V1`/`V3`），**`L2` 真链路 leg 现取 = 119**（`l2-realchain-…json` `L2-R1`/`L2-R3`）。**原因**：`rating.rating_id` 为 `GENERATED … AS IDENTITY`，identity 序列**不随事务 `ROLLBACK` 回退**（每次事务内 `INSERT` 均前推，回滚仅撤行不撤序列）⇒ 跨 run 单调递增、无法归零。**语义字段全同**（`outcome=inserted` · `rateeUid` 同 · `stars=4` · `replay`/`already_rated` 行为一致），属**非行级副作用**，非语义漂移。

---

## 8. L7 面核 + verdict

- **四语键集**：`zh/en/hk/vn` 各 `top=117 · flat=988`，**键集相等 PASS**（取值集合 `{988}` 单值）—— 产物 `l7-locales.out`。
- **`I18N-VIOL` 总判 = PASS**（`l7-i18nviol.out`）：作用域命中节点数 = **3952**（键 988 × 语 4）；**裸命中 = 0**；**源面（pages/components/shell 71 文件）裸命中 = 0**；**类级残余（活体）= 0**；显式豁免登记 9 条（语言自称 / 既有粵語口号 / 输入语法示例）。
- **错误码闭集 = 恰 33 条**（不动）；5 新口借**既有**码 + 稳定 `reason` 常量，**零新增码**。
- **登记（非本单）**：`pages/jobs/JobDetailPage.jsx:238` 命中工程口径 **1 处**（`[SQL/事务] "）SELECT 列集**不含** "`）—— 属**存量**源面硬编码文案，**非本单写集**，另单收口。

**★ 两条机制级教训（必写）**：

- **(a) 探针不得放进门的扫面根（`backend-ts/scripts/`）**：门以 `scripts/` 为扫面根枚举注册点/代码位时，落入根目录的探针会**命中山门判据**（如把探针里的 `app.get(...)` 计入注册点、或把探针文本喂进谓词）⇒ 离线**误红**。本单探针一律置 `backend-ts/.p9s3qa-probe/`（根外）。
- **(b) 门的块边界必须锚「本块自己的终止符」**：路由块 = **顶层 `});`**。仅锚「下一注册点」的旧切法，遇**新增顶层声明**（如本单插入 `sendOrderTransition`）会把它**并入上一块**，令块内扫描误判 ⇒ **新增顶层函数后，须复跑所有含切块的门**（`p8-s2` / `p8-s7` / `p8-s8`）。

---

## 9. 收尾（blob 对拍 + worktree 移除 + 端口 + 首尾 git status）

- **副本 blob 对拍 = 27 / 27 SAME**：被检变更集（`627032b`）**恰 27 个文件**，仓外副本 `p9s3-copy` 逐 blob 对被检面一致（`cmp` 无差）。
- **固定副本 worktree 已回收**（`git worktree list` 无 `qaP9s3`）；**端口 `5796–5799` 空**（无 `LISTEN`，实例已随进程组回收）。
- **尾 `git status --porcelain`**（本单自证）：`157 行`结构不变 —— 受检代码 / 迁移 / `docs/audit/**` **零改动**；新增仅 `?? docs/qa/p9-s3-rating-timeliness-qa.md`（本报告）。

**verdict = PASS**（实质面全绿：真链路 21/21 · 判负 4/4 必红后回绿 · 硬门全绿 · checksum 双对拍一致 · 库面零净写 · 面核 PASS）。

**未测项 3 条（逐项原因）**：

1. **5 新口「合法写」HTTP 端到端**：本单不启实例，离线基线 `httpLive` 三口（`H5`/`H6`/`H7`）⇒ `fetch failed`；带实例面仅覆盖「无 token 401 / 读口 200 / 写口非法入参 400·404 零写」，**未跑合法写入的完整 HTTP 往返**（合法写路径已由库面 leg 事务内覆盖）。
2. **前端浏览器实渲染与四语目视**：本单为无头 / 只读面，未起浏览器；仅以 `build`（exit 0）· `test:unit`（276）· 四语键集相等与 `I18N-VIOL` PASS 作静态与结构面覆盖，**未做像素级/交互级目视**。
3. **`p8-s8` 库面 leg 的 `rating` identity 序列推进归零**：属**非行级副作用**（序列不随 `ROLLBACK` 回退），**不可回滚 ⇒ 无法归零**；已按 §7 登记为环境漂移。
