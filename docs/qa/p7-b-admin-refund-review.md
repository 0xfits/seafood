# 批 7-B 独立质检报告（Neng）— 退款后端 + 护栏前端

> 被检对象 = 本地提交 `39d89b3`（未 push）。只读 + 只写本报告与 `backend-ts/.p7bqa-artifacts/`。
> 副本：`<scratch>/qa-p7b`（`git worktree add --detach … 39d89b3`）。
> 状态：**逐节回填完成**（L0–L8 + 残留登记 + 裁定登记 + 收尾）；占位归零（连续双下划线形态 **0** 行 / 中文占位词 **0** 行；命令与读数见收尾段 ④）。

## 0. 元信息与开工快照
- 主仓 HEAD（**本轮开工**）= `39d89b3`（`main`）；开工 `git status --porcelain`（主仓）= 空（唯我新写 `docs/qa/p7-b-admin-refund-review.md`，另 `backend-ts/.p7bqa-artifacts/` 为本轮产物目录）。
- 副本 HEAD = `39d89b395e65a6ca11bcd2445e4210280532718b`（`git worktree add --detach <scratch>/qa-p7b 39d89b3`）。
- 副本初始 `git status --porcelain` = `?? backend-ts/node_modules` / `?? frontend/node_modules`（仅我添加的两个符号链接；`.env.local` 亦为符号链接，未打印内容）。
- **副本逐文件 blob == `git rev-parse 39d89b3:<path>`**（全部 **SAME**）：`0024_admin_refund_audit.sql a419d71f…` / `src/index.ts f315b988…` / `src/database.ts 7b802def…` / `src/listing-funds-service.ts 9796deb…` / `frontend/src/auth.js 690e287b…` / `frontend/scripts/p7b-errfallback-gate.mjs ead91f9f…` / `frontend/src/test/unit/p7b-errfallback.test.js a46b1931…` / `scripts/p7b-03-offline-gates.ts f55231518…` / `scripts/p7b-07-ac11.ts 7ca506d6…` / `scripts/p7b-08-e2e-http.ts 6b030f1c…` / `frontend/src/ledger-api.js 02db8706…`。
- `39d89b3` 相对其父 `d5f54d1` 的改动面（`git diff --name-status`）= 21 件：`M src/listing-funds-service.ts` / `M scripts/p7b-03-offline-gates.ts` / `M docs/route-layer.spec.md` + 新增脚本 6 / 产物 9 / 报告与 delta 4。**`frontend/src/auth.js`、`frontend/src/ledger-api.js` 与 `frontend/src/locales/**` 均**不在其内（L6③ 佐证）。
- **★ 续跑轮 HEAD 漂移（并发事件，非本单）**：本轮开工 `39d89b3` → 我作业中途主仓前移至 `6d76e43`（交付方收口二 PASS 提交）→ 收尾时前移至 **`8a2b247`**（派单方「批 7-B 终审质检 + 裁定 F-1/O-1 + 派续跑∥7-C」提交）。三者**均不含我任何文件**；我的作业面（副本）钉死在 `39d89b3`。**另**：收尾时主工作区出现**一批**他人在制品 —— `M frontend/src/auth.js`（mtime `19:13:08`）、`M frontend/scripts/p7b-errfallback-gate.mjs`（`19:14:57`）、新增 `frontend/scripts/p7c-errmsg-machinecode-gate.mjs`（`19:14:32`）/ `frontend/src/test/unit/p7c-errmsg-machinecode.test.js`（`19:15:13`）/ `docs/audit/p7-c-errmsg-scope.md`（`19:16:26`），全部 = **批 7-C「F-1 错误文案面收口」**（`MACHINE_CODE_RE` / `containsMachineCode` 等机读码判据）—— 系派单方裁定里写明的「**已另派 Kong 并行修复**」，**非我触碰**（我全程未写主工作区任何被检文件；我只有 2 处写入面，见收尾段 ②）。

## L0 契约真源（§12 / §12.11 / §12.12 / §12.13）关键口径摘录
- **actor 面**：合法发起人 = 卖方 ∪ 管理员（`can_access_admin` ∧ `manage_points`）；**管理员兼买方 ⇒ 403 `AUTH_FORBIDDEN` + `ACTOR_NOT_ALLOWED`**（§12.1）。
- **准入唯一真源**：`REFUND_ACTOR_SCOPE` + `resolveRefundActorRoute`（`src/listing-funds-service.ts`）；`NOT_ADMIN` 不在本路由使用（§12.3 v1.9 / AC-13⑥）。
- **资金腿冻结**：`purchase_refund ×2`、不回滚库存（`REFUND_ROLLS_BACK_STOCK=false`）、金额/卖方/买方/cid 全服务端取数（F1–F6）。
- **幂等**：键 = `biz:listing:refund:<order_id>`（`0015:667`）；指纹 = `sha256('listing.refund'|<order_id>)`（`:300`）⇒ 与 actor 无关；同键重投 = `200 + idempotent_replay:true` + 零 delta + 审计不新增。
- **AC-11 判负 = 可复现三条**（v1.9）：① 源码级 `position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0`；② 竞争实测（受害者阻塞 > 0）；③ 正向并发 ⇒ 恰一次生效。
- **AC-11(iii) 期望（v2.0 / S-1 订正）**：并发两笔同订单 ⇒ 一笔 `applied`；**另一笔 `200 + idempotent_replay:true` 且 txid 与首笔逐字相同**（旧「另一笔 409」作废）。
- **AC-14**：白名单捕获、**禁 `WHEN OTHERS`**；注入 `53300`/`XX000` ⇒ 必须上抛 ⇒ 503，不得 `rejected_state`；静态判据 `position('WHEN OTHERS' …) = 0`。
- **AC-15③**：拒绝留痕 `INSERT` **必须落在 `EXCEPTION` 处理器内**（否则子事务回滚会把留痕撤销 ⇒ Δ=0 ⇒ 判负）。

## L1 硬门独立复跑（副本内）— 全绿
| # | 门 | 命令 | 退出码 | 读数 |
|--:|---|---|--:|---|
| 1 | `tsc --noEmit` | `npx tsc --noEmit` | **0** | 零输出 |
| 2 | 离线套件 | `npx ts-node scripts/p4z-tr1a-01-offline-tests.ts` | **0** | `SUMMARY total=126 passed=126 failed=0` |
| 3 | 脚本面 tsc | `npx tsc -p tsconfig.scripts.json --noEmit` | **2** | **77 错 / 22 文件**；`scripts/p7b*` 残留错 = **0**（`grep -cE '^scripts/p7b'`=0）⇒ 相对 `39d89b3` 文件面**无新增** |
| 4 | 构建 | `npm run build`（backend `tsc`） | **0** | 零输出 |
| 5 | 前端单测 | `npm run test:unit`（frontend `vitest run src/test/unit`） | **0** | `Test Files 29 passed / Tests 258 passed`（**≥258** ✓） |
| 6 | 六门 | `node frontend/scripts/<g>.mjs` | — | 见下 |
| 7 | p7b-03 | `npx ts-node scripts/p7b-03-offline-gates.ts` | **0** | `passed: 37`（**37/37**） |

六门逐门：`p4z-i18nviol-global` EXIT 0 PASS（locale 裸命中 0 / source 裸命中 0）· `p6-tr2-i18n-locales` EXIT 0 PASS · `p4z-miscfix-links` EXIT 0 PASS · `p4z-feperf-safelist` **初跑 EXIT 1 FAIL → 建 `dist/` 后 EXIT 0 PASS**（见下注）· `p7a-03-errmessage-gate` EXIT 0 PASS · `p7b-errfallback-gate` EXIT 0 PASS。
> **★ 环境注（非缺陷）**：`p4z-feperf-safelist` 依赖 `frontend/dist/assets/*.css`；**新建 worktree 无 `dist/`** ⇒ 首跑 `dist_css=null` ⇒ `VERDICT=FAIL`。我在副本内 `npm run build`（vite）后产物 CSS = `index-mRq3HT-x.css`（**与主工作区同哈希、bytes 124953**）⇒ 复跑 **EXIT 0 / PASS**。对照：主工作区（有 dist）本门亦 PASS。**结论 = 环境缺件，非被检代码回归。**

## L2 AC-④ 幂等（migrate 重跑）
- 命令：`npx ts-node --transpile-only scripts/migrate.ts` ⇒ **EXIT 0**。
- 读数：`ok = true`；`applied_now` = **23 行**（`0001`→`0024`，缺 `0018`＝该版本文件不存在）；`action` 计数 = **`{skipped: 23}`**；`reason` = **`{already applied, checksum match: 23}`**；非 skipped = **0**。
- `0024` 条目逐字：`{version:0024, name:0024_admin_refund_audit.sql, action:skipped, reason:"already applied, checksum match", applied_at:"Fri Oct 02 2026 16:01:41 GMT+0800"}`。
- `public_base_table_count = 25`，且 `admin_refund_audit_log ∈ public_base_tables`。**判定：AC-④ 通过。**

## L3 AC-11 三条（本轮独立复跑 · 自建夹具 `order 17`）
产物 `backend-ts/.p7bqa-artifacts/qa7b-02-ac11-ac11.json`（`run=ac11`，`order=17`，根键 `biz:listing:refund:17`，actor_a=910008 / actor_b=910005）。

| 条 | 判据 | 读数（逐字摘） | 判定 |
|--:|---|---|---|
| **(i)** | 源码级 `position('FOR UPDATE' IN pg_get_functiondef('public.listing_post_event'::regproc)) > 0` | `has_for_update_regproc = true`；`pos_regproc = 4183`；`for_update_count = 5` | **PASS** |
| **(ii)** | 竞争实测：受害者阻塞 > 0 | `victim_blocked_ms = 879`；`victim_error = null` | **PASS** |
| **(iii)** | 正向并发（S-1 口径）：恰一次生效 + 另一笔幂等重放且 **txid 逐字相同** | `a = {outcome:"ok", ok:true, result:"applied", idempotent_replay:false, txid:"353"}`；`b = {outcome:"ok", ok:true, result:"applied", idempotent_replay:true, txid:"353"}` | **PASS** |

- **差分四项（`before → after`）**：`purchase_refund 12 → 14`（**Δ=+2**）；`rootkey_rows(biz:listing:refund:17) 0 → 2`（**Δ=+2**）；`audit_applied 0 → 1`（**Δ=+1**）；`audit_rejected 0 → 0`（**Δ=0**）；`Σ(cid=1) 1989693 → 1989693`（**shift = "0"**）；`order 17` = `{status:"paid", refund_txid:null}` → `{status:"refunded", refund_txid:"353"}`。
- **现取旁证（只读残留探针 `qa7b-06`）**：`public.admin_refund_audit_log.log_id = 4` ⇒ `{actor_uid:910008, order_id:17, result:"applied", txid:353, idempotency_key:"biz:listing:refund:17"}`（与 (iii) 逐字一致）。
- **判定：AC-11 通过（三条判据独立可复现，且与该单交付方产物 `p7b-07-ac11-collect1.json` 同构）。**
- **★ 不采信项**：产物内派生布尔 `verdict_iii.exactly_one_effective` **不作为判据**（定性见 L7）。判据 = 上表三条原始读数 + 差分四项。

## L4 HTTP E2E 十项（本轮独立复跑 · 自建夹具 910001–910010 / listing 24 / order 14–19 + 20）
产物 `backend-ts/.p7bqa-artifacts/qa7b-03-e2e-e2e.json`（`base = http://127.0.0.1:5796`，本轮**自起 5796** 实例；收尾已关停，见收尾段）。

| # | 项 | 读数（逐字摘） | 判定 |
|--:|---|---|---|
| ① | 无 token | `401` + `{error:{code:"AUTH_UNAUTHORIZED", message:"AUTH_UNAUTHORIZED", i18n_key:"auth.err.AUTH_UNAUTHORIZED", details:{}}}`；顶层键 = `["error"]` | PASS |
| ② | 第三方 910007 退 `order 14` | `403 AUTH_FORBIDDEN` / `message:"ACTOR_NOT_ALLOWED"` / `details.reason:"ACTOR_NOT_ALLOWED"`（`required_uid:"910001"`, `actor_uid:"910007"`, `ref_id:"14"`） | PASS |
| ③ | 卖方 910001 退 `order 14` | `200` + `message:"Listing order refunded"`；`txid:"355"`；`ledger_idempotency_key:"biz:listing:refund:14"`；`event_kinds:"purchase_refund"`；`entry_count:2`；`stock_rolled_back:false`；`amount:"1"` | PASS |
| ④ | 管理员 910005 退 `order 15` | `200 applied`；`txid:"357"`；`key:"biz:listing:refund:15"`；`actor_uid:"910005"`；`seller_uid:"910003"` | PASS |
| ⑤ | 管理员**兼买方** 910004 退 `order 16` | `403 AUTH_FORBIDDEN` / `reason:"ACTOR_NOT_ALLOWED"`（`actor_uid:"910004"`, `ref_id:"16"`） | PASS |
| ⑥ | admin 缺 `manage_points` 910006 退 `order 16` | `403 AUTH_FORBIDDEN` / `reason:"PERMISSION_NOT_GRANTED"`（`actor_uid:"910006"`） | PASS |
| ⑦ | 幂等重投（910001 重投 `order 14`） | `200` + `message:"Listing order refunded (idempotent replay)"`；`data.idempotent_replay:true`；`txid:"355"`（**同首投**） | PASS |
| ⑧ | 同键异内容 | **HTTP 面 `NOT_APPLICABLE`**（S-2：路由 `request_fingerprint` 恒由 `order_id` 派生 ⇒ 结构性不可达）；**DB 层实测** = `{sqlstate:"LD003", message:"LEDGER_IDEMPOTENCY_CONFLICT", detail:{actual:"qa7b:DIFFERENT-FP", expected:"5be26119…", idempotency_key:"biz:listing:refund:14"}}` | PASS（DB 层载体） |
| ⑨ | 审计 txid = 资金回执 txid（逐字） | `f1_response_txid "355" = f1_audit_txid "355"`；`f2_response_txid "357" = f2_audit_txid "357"` | PASS |
| ⑩ | 账本零位移（除本事件外） | `ledger_rows_delta 4`（= 2 事件 × 2 分录）、`purchase_refund_delta 4`、`sum_cid1_balance_shift "0"`、`sum_cid1_frozen_shift "0"`；`after.audit_rows_q` = 2 行、`after.refund_rootkey` = 2 组（`refund:14` / `refund:15` 各 2 行） | PASS |

- **★ AC-15③ 活体旁证（本轮新增，非交付方产物）**：`qa7b-04-http409.json` 用自建 `order 20`（`status='created'`）打退款 ⇒ `409`，真实体逐字 = `{"error":{"code":"LEDGER_CURRENCY_INVALID_TRANSITION","message":"LEDGER_CURRENCY_INVALID_TRANSITION","i18n_key":"ledger.err.LEDGER_CURRENCY_INVALID_TRANSITION","details":{"field":"listing_order.status","reason":"order_not_refundable","ref_type":"listing_order","ref_id":"20","status_code":409}}}`；且**只读现取**到 `admin_refund_audit_log.log_id = 7` = `{actor_uid:910001, order_id:20, result:"rejected_state", txid:null, idempotency_key:"biz:listing:refund:20", memo:"order_not_refundable"}` ⇒ **拒绝留痕在真库落盘存活（Δ=+1）**，正是 AC-15③ 所要保护的行为。**★ 该 409 真实体的 `message` 即 F-1 缺陷的实物证据**（见 L8 裁定登记）。
- **AC-14 形状面（`qa7b-05-shapes.json`）**：`53300 → {code:"LEDGER_TX_TIMEOUT", http:503, message:"系统繁忙，请稍后重试", source:"pg_infra_class", retryable:true}`；`XX000 → 同上（reason:"internal_error"）`；`58030` 同族。**绝无 409 / rejected_state**。
- **判定：HTTP E2E 十项 10/10 通过。**

## L5 ★ 判负自证（仓外副本内，两处变异）
**纪律**：变异**只在仓外副本内**做；主工作区被检文件一字未改（零污染凭据逐条给）。

### L5(a) 白名单捕获 ↔ `WHEN OTHERS` ⇒ AC-14 判据必红
载体 = 副本 `qa7b-neg`（`rsync` 复制、`node_modules` 符号链接）内的 `migrations/0024_admin_refund_audit.sql`，变异点 = `EXCEPTION WHEN SQLSTATE 'LD011' THEN` → `EXCEPTION WHEN OTHERS THEN`。

| 阶段 | 副本 0024 读数 | `p7b-03` 门 | 关键读数 |
|---|---|---|---|
| 基线 | sha256 `b2495845…0aa31b1d` | exit **0**，**37/37**，`red=[]` | `AC14-s1 pos=-1` / `AC14-s2 exc=1153 ld011=1178` / `AC15-s3 exc=1153 rejected_insert=2191` |
| 变异(a) | （副本内改） | exit **1**，**36/37**，**`red=["AC14-s1"]`** | `AC14-s1 pass=false reading=pos=**1163**`；`AC14-s2 exc=1153 ld011=2653`；`AC15-s3 pass=true` |
| 复原(a) | sha256 **`b2495845…0aa31b1d`**（== 基线，与主工作区 `SAME`） | exit **0**，**37/37**，`red=[]` | 三条读数回到基线逐字值 |

产物：`l5-baseline.txt` / `l5-mut-a.txt` / `l5-restore-a.txt`（含各自 run-tagged 子产物路径）。

### L5(b) 拒绝留痕 `INSERT` 移出 `EXCEPTION` 处理器 ⇒ AC-15③ 判据必红
载体 = 副本 `qa-p7b` 内的 `migrations/0024_admin_refund_audit.sql`。变异语义：**把「拒绝留痕 `INSERT` + 拒收回执」整体从白名单捕获处理器内移出**，改由**受保护子事务体**（`BEGIN` 与 `EXCEPTION` 之间）内的「状态位预检」写出 ⇒ `LD011` 抛出时该块回滚会**连同留痕一并撤销**（即 AC-15③ 要防的缺陷）。静态判据 `AC15-s3 = indexOf("'rejected_state', NULL") > indexOf('EXCEPTION')` 必红。

| 阶段 | 副本 0024 sha256 | `p7b-03` 门 | AC15-s3 读数 |
|---|---|---|---|
| 基线（未变异） | `b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d` | exit **0**，**37/37**，`red=[]` | `pass=true` `exc=1153 rejected_insert=2191` |
| 变异(b) 首版 | `70ad0949eb248785c21e53f0ed08a23743f8e04cc0f929eccdf82c865126ea57` | exit **0**，**37/37**（**假绿**） | `pass=true` `exc=1188 rejected_insert=1867` |
| 变异(b) 定稿 | `eb5008a591beaa646a10ad893ba4ff485971e86a59496fbe5cc5eae8af23e1ef` | exit **1**，**36/37**，**`red=["AC15-s3"]`** | `pass=**false**` `exc=**2324** rejected_insert=**1861**`（`1861 < 2324` ⇒ 留痕排在真关键字**之前** = 处理器外） |
| 复原(b) | **`b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d`**（== 基线） | exit **0**，**37/37**，`red=[]` | `pass=true` `exc=1153 rejected_insert=2191`（逐字回到基线） |

- **★ 判据注释敏感面（本轮新发现，登记为工具口径边界，非被检代码缺陷）**：**变异首版假绿**的根因 = 我的变异注释里写了字面 token `EXCEPTION`（“移出 EXCEPTION 处理器”）⇒ 判据的 `indexOf('EXCEPTION')` 命中**注释文本**（1188），排在留痕 `INSERT`（1867）之前 ⇒ `1867 > 1188` ⇒ 判据假过。去掉注释里的 `EXCEPTION` 字面量后（定稿版）即红。**含义**：`AC15-s3` 是**文本位置代理**，任何排在真关键字之前的同名词都会顶替位置。**未据此改被检代码**（我不得改），只登记。
- **sha 链**：`b2495845…`（基线）→ `70ad0949…`（假绿态）→ `eb5008a5…`（判定态）→ `b2495845…`（复原态 = 基线逐字）。
- **零污染凭据**：① 变异/复原**全程**，主工作区 `0024` sha256 恒为 `b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d`（与副本基线同一 sha，逐轮现取）；② 副本 `git hash-object` 复原态 = `a419d71f21e6d5124ae628cb58a0fcd7fe5dae71` == `git rev-parse 39d89b3:backend-ts/migrations/0024_admin_refund_audit.sql`；③ 副本 `git status --porcelain --untracked-files=no` = **空**（逐轮现取）；④ 未 `git add/commit/push`，未碰 `.env*`。
- **判定：两处判负（(a) AC-14 / (b) AC-15③）均达成「变异 → 红 → 复原 → 绿」闭环，判据可证伪。**

## L6 护栏腿独立验证

### L6① 两处判负独立复跑（副本内，均「变异 → 红 → 复原 → 绿」）
**①-a 拆守卫**：把副本 `frontend/src/auth.js` **回退到 `89b899d` 版**（护栏之前）。
| 阶段 | `auth.js` git blob | 命令 | 读数 |
|---|---|---|---|
| 变异 | `690e287b…` → **`dc65fc03d288f4c92b39cc307fb76b0f585f8610`**（== `89b899d:frontend/src/auth.js`） | `npx vitest run src/test/unit/p7b-errfallback.test.js` | **exit 1**，`Test Files 1 failed (1)` / `Tests **8 failed (8)**`；例 `AssertionError: [zh]: expected 'LEDGER_AMOUNT_INVALID' to be '请求失败 (401)'`（用户可见串退化回英文机读码） |
| 复原 | **`690e287bc28c2ca8f9004574ecd614225f761fb0`**（== `39d89b3:frontend/src/auth.js`） | 同上 | **exit 0**，`Test Files 1 passed (1)` / `Tests **8 passed (8)**` |

**①-b 删某语兜底键**：把副本 `frontend/src/locales/zh.json` 的 `auth.err.REQUEST_FAILED`（原值 `请求失败 ({{status}})`）删除。
| 阶段 | `zh.json` git blob | 命令 | 读数 |
|---|---|---|---|
| 变异 | `cbb2fa03…` → **`65ac2a22c8e348e3da4fb5c1f691bcf0dd48e5b9`** | `node scripts/p7b-errfallback-gate.mjs` | **exit 1**；`C 四语通用兜底键齐备` 段 ⇒ `auth.err.REQUEST_FAILED ⇒ zh:**缺/非法**  hk:OK en:OK vn:OK`；`! C 通用兜底键 … 在 zh 缺失 / 为空 / 为裸键（值 = undefined）`；`总判：**FAIL**（判负 1 必须 = 0 …）` |
| 复原 | **`cbb2fa03b4dca48367d26c8581842c1d99abb2ea`**（== 基线） | 同上 | **exit 0**；`auth.err.REQUEST_FAILED ⇒ zh:OK hk:OK en:OK vn:OK`；`总判：**PASS**（判负 0 必须 = 0 …）` |

- 两处变异后副本 `git status --porcelain --untracked-files=no` 复原后为**空**（现取）。

### L6② 四语文案链（真 i18n + 真 `apiErrorMessage`）
`frontend/src/test/unit/qa7b-errfallback-4lang.test.js` ⇒ `npx vitest run`：`Test Files 1 passed (1)` / `Tests **4 passed (4)**`（zh / hk / en / vn 逐语；产物 `l6-4lang-test.txt`）。与交付方 C-1 单测（8 例）互为独立实现。

### L6③ 护栏腿的提交归属（本单不含它，故不重复判交付）
`git diff --name-only d5f54d1 39d89b3` 对 `auth\.js|locales/|ledger-api\.js` **零命中**；`git log -S'looksLikeBareI18nKey' -- frontend/src/auth.js` ⇒ 引入提交 = `9805876`（更早批）。⇒ **`39d89b3` 的改动面与护栏腿无交集**（副本 `auth.js` / 四语 `locales` 的 blob 终结检 == `39d89b3`，见收尾段 ③）。

### L6④ 四语兜底键齐备 + 行为节点面（`p7b-errfallback-gate.mjs`）
- **C 段**：`auth.err.REQUEST_FAILED ⇒ zh:OK hk:OK en:OK vn:OK`；`auth.err.NO_CREDENTIAL ⇒ zh:OK hk:OK en:OK vn:OK`。
- **D 段**：`33 码 × 4 语 = 132` 节点 ⇒ 「未命中 ⇒ 依赖护栏」= **132**、「已本地化 ⇒ 护栏让位」= **0**。
- **B 段**：四语叶子值各 704，含裸键 token = **0**；存量登记 0 条。
- **总判**：`PASS`（判负 0 必须 = 0）。**登记**：132/132 仍依赖通用兜底 ⇒ 属「132 键逐码本地化」工作项（P6/P7，见 L8）。
- **判定：护栏腿 PASS**；两处判负闭环、四语链真跑、归属清晰。

## L7 复核交付方报告关键读数 + `verdict_iii` 矛盾审
复核对象 = `docs/audit/p7-b-admin-refund.md`（238 行）。

| 报告处 | 报告读数（逐字摘） | 产物现取（我复算） | 结论 |
|---|---|---|---|
| §0 sha 锚 | `0024_admin_refund_audit.sql` sha256 = `b2495845c26f…0aa31b1d` | 主工作区与副本均 = `b2495845c26f0cc79b386714b63359db74e76f0cd6eadf5c95f1dd9e0aa31b1d` | **SAME** |
| §3 AC-④ | `applied_now 23`、`{skipped:23}`、`base_table_count 25`、`0024 ∈ tables` | `p7b-ac04-migrate-idempotent-ac04.json`：`ok true` / `schema_version 0024` / `applied_now 23` / `public_base_table_count 25` / 含 `admin_refund_audit_log` | **SAME** |
| §3.1 AC-11(i) | `pos_regproc 4183`、`for_update_count 5` | `p7b-07-ac11-collect1.json` 逐字 | **SAME** |
| §3.1 AC-11(ii) | `victim_blocked_ms 871`、`victim_error null` | 同上 | **SAME** |
| §3.1 AC-11(iii) | `a applied txid 341` / `b replay txid 341`；`+2/+2/+1/0`、`Σ shift "0"` | 同上（`deltas` 逐字） | **SAME** |
| §3.4 AC-15③ | `AC15-s3 exc=1153 rejected_insert=2191` | `p7b-03…r2sk.json`：`pass=true`（读数逐字同上） | **SAME** |
| §3.3 E2E collect1 | `base 5793`；③ `343`、④ `345`；⑨ `343=343 / 345=345`；⑩ `Δledger 4 / Δpurchase_refund 4 / Σ 位移 0` | `p7b-08-e2e-http-collect1.json` 逐字 | **SAME** |
| §3.2 干跑 | `41/41`、`dry_run.error null`、`mode ROLLBACK` | `p7b-01-migration-dry-run-…c5ud.json`：`summary 41/41`、`dry_run {error:null, rolled_back:true}` | **SAME** |
| §5.3/§5.1 collect2 | 「3 项一致 / 7 项差异，根因=默认参数未复现夹具前置」 | 我逐项复算：**口径 = 状态码/码面**时一致 **4** 项（①④⑤⑥）、差异 **6** 项（②③⑦⑧⑨⑩）；报告把 ④ 计入差异，系因其按**载荷语义**（`order 6` 历史退款重放 `txid 219`）判定 | **口径差异，非事实错误**（报告结论「根因 = 未复现夹具前置」我复算成立：`order 5` 不存在 ⇒ `LD022`、`LD003→LD022`、⑨ 不配对、⑩ Δ=0） |

### `verdict_iii` 独立定性
- 交付方产物 `p7b-07-ac11-collect1.json` 末段逐字：`"verdict_iii": {"exactly_one_effective": false}`（报告 §5.2 自曝为「**旧 R-B(iii) 口径**的派生值」）。
- 我复算：该布尔由「另一笔是否**非生效**」这一类**旧期望**（S-1 之前「另一笔 409」）派生；在 S-1 口径下两笔都为 `ok`（一笔 `applied` + 一笔 `idempotent_replay:true`，`txid` 同为 `341`）⇒ 该布尔**不表达** v2.0 的任何判据。
- **定性结论**：`verdict_iii.exactly_one_effective` = **旧口径残留派生布尔**，与 S-1/v2.0 判据**无对应关系**；**本报告不采信该布尔**，AC-11(iii) 判据一律取「原始读数 + 差分四项」（见 L3）。
- **裁定登记**：派单方已另派交付方**删除或修正**该布尔 ⇒ 属收口项，不阻塞本单。

## L8 未验证清单（逐项原因，禁填 0/空）+ 裁定登记 + 夹具残留 + verdict

### L8.1 未验证 / 未测（NOT_MEASURED，逐项给原因）
1. **HTTP 面「同键异内容 ⇒ 409」** —— **`NOT_APPLICABLE`（结构性不可达，非未测）**：路由 `request_fingerprint` 恒由 `order_id` 派生 ⇒ 同一订单的 HTTP 重投必同内容（S-2）。**正式载体 = DB 层 `LD003 LEDGER_IDEMPOTENCY_CONFLICT`**（我 L4⑧ 已实测）。
2. **AC-14 的 `53300`/`XX000` 注入到「真库已部署函数体」的运行态** —— **`NOT_MEASURED`**：需改真库已 apply 的 `public.listing_refund_post_event` 函数体，而 `migrations/**` 属禁改面（`0024` 已 apply 且 checksum 受 `migrate` 校验）。**已测替代面** = ①分类器（L1 `AC14-cls-*` 全 503）②白名单机制（副本变异 `WHEN OTHERS ⇒ AC14-s1 红`，L5(a)）③真库 409 形状（L4 活体旁证）。
3. **`ledger.err.*` 132 键的逐码本地化** —— **未交付（属 P6/P7 工作项）**：L6④ 实测 `132/132` 仍走通用兜底（「已本地化 ⇒ 让位」= 0）。**原因**：本单射程只到 C-1 回退护栏，键面本身在 `docs/data-layer.spec.md §11.3.1` 登记为「需新增键」。
4. **服务端拒收回执 `message` 面的收口（F-1 的另一半）** —— **未做且不在本单范围**：服务端 `message` 直接回机读码（L4 活体旁证逐字：`"message":"LEDGER_CURRENCY_INVALID_TRANSITION"`），派单方裁定**服务端面不改**、只登记为「错误文案面收口」工作项。**原因**：本单只登记 + 不得改代码。
5. **O-1 单语 `zh` 外溢面（hk/en/vn 落单语中文）** —— **未修（已裁定为已知边界）**：实例逐字 = `503` 真实体 `系统繁忙，请稍后重试 (too_many_connections)`；理由 = 保 `auth.test.js S6` 既有断言。**原因**：裁定「登记、不修、不阻塞」。
6. **`AC15-s3` / `AC14-s2` 位置代理判据的注释敏感面** —— **工具口径边界，未改被检代码**：见 L5(b) 首版假绿（注释含 `EXCEPTION` 字面量即顶替位置）。**原因**：我不得改被检脚本；只登记复现条件与最小复现（去注释字面量即红）。
7. **`tsc -p tsconfig.scripts.json` 的 77 错既有债逐条枚举** —— **未逐条枚举**：本单只给**计数 + 差集**（L1 门 3：77/22，且 `scripts/p7b*` 残留 0）；**原因**：既有债（非本单一字节引入）不在本单修，穷举行号无判定增量。
8. **`public.admin_refund_audit_log` 的 `ON CONFLICT … DO NOTHING` 在「同键同 result 第二次拒收」的并发重投面** —— **未单测**（仅静态可读 + L4 活体单次拒收）：**原因**：拒收回执面本轮只做到「单次拒收留痕存活」（`log_id 7`），并发拒收重投需专门夹具，属扩展面；**风险评级低**（`admin_refund_audit_log_idem_uniq` 唯一约束 + `DO NOTHING` 已在位）。

### L8.2 派单方两条裁定的**登记**（逐字引用；本报告**只登记，不改代码**）
- **F-1（我发现的真缺陷）= 采纳，另派修复，不在本单范围**。逐字：「退款拒收回执的真实体 `message` 是**机读码**（`LEDGER_CURRENCY_INVALID_TRANSITION` + `order_not_refundable`），经 `apiErrorMessage` 后四语用户可见串均为英文机读码 —— **C-1 护栏只认「点分裸键 token」、不认「下划线机读码」⇒ 该面未被覆盖**。**我裁定**：**扩护栏 token 判据至「全大写下划线机读码」，并把服务端拒收回执的 message 同归「不可作为用户文案」⇒ 落③ 四语通用兜底**（已另派 Kong 并行修复）；**服务端 message 面本身不改**，登记为「错误文案面收口」工作项（与「132 键逐码本地化」同批 P6/P7）。⇒ **你的报告只登记该缺陷 + 我的裁定，不得去改代码**。」
  - 我的实物证据（本轮现取）：`qa7b-04-http409.json` 的 `body_raw` 逐字含 `"message":"LEDGER_CURRENCY_INVALID_TRANSITION"` 与 `"reason":"order_not_refundable"`。**核对**：收尾时主工作区 `frontend/src/auth.js` 已出现批 7-C 的 `MACHINE_CODE_RE` / `containsMachineCode`（mtime `19:13:08`）⇒ 裁定所指并行修复**已在落地中**（非我触碰）。
- **O-1 = 接受为已知边界**。逐字：「「服务端原文优先」（②）在**服务端文案为单语 zh** 时会外溢到 hk/en/vn（实例：503 真实体 `系统繁忙，请稍后重试 (too_many_connections)`）—— 理由 = 保 `auth.test.js S6` 既有断言；**一旦 `ledger.err.*` 键齐备（P6/P7），① 命中即用四语文案、该边界自动消失** ⇒ **登记、不修、不阻塞**。」
- **`verdict_iii`**。逐字：「`verdict_iii.exactly_one_effective` 派生布尔 —— 你已定性为旧口径残留 ✓（已另派交付方删除/修正）；报告回填时**不得采信该布尔**。」⇒ 本报告 L3 判据已按此执行。

### L8.3 夹具残留登记（我自建夹具 · 只读现取，未清理）
真源 = `qa7b-01-fixture-fix1.json` 的 `residue_manifest` + 本轮只读探针 `qa7b-06-residue`（`qa7b-06-residue-stdout.txt`，全部显式 `public.`，零破坏性语句）。

| 对象 | 残留读数（现取） |
|---|---|
| `public.users`（**10 行**，uid 910001–910010） | `bio = "qa7b fixture uid=910001…910010"`；`is_admin=false`；`time_reg` 2026-10-02T11:05:09…11 五连（与 `residue_manifest.users` 逐字一致） |
| `public.admin_role`（**2 行**） | `qa7b_admin`（`QA7B fixture admin (manage_points)`）、`qa7b_nopts`（`QA7B fixture admin without manage_points`） |
| `public.admin_user_role`（**3 行**） | `910004 → qa7b_admin`、`910005 → qa7b_admin`、`910006 → qa7b_nopts`（== `residue_manifest.role_assignments`） |
| `public.listing`（**1 行**） | `listing_id 24` / seller `910001` / cid `1` / price `1` / stock `100` / status `listed` / `create_key "cli:qa7b-fixture-listing-01"` |
| `public.listing_order`（**7 行**） | `14`(910001→910002, **refunded**/`355`) / `15`(910003→910002, **refunded**/`357`) / `16`(910001→910004, paid) / `17`(910008→910002, **refunded**/`353`) / `18`(910003→910002, paid) / `19`(910001→910002, paid) / `20`(910001→910002, **created**) |
| 账本供资 `transfer`（**3 事件 / 6 行**） | 根键 `ops:qa7b:fund:fix1:{910001,910003,910008}` 各 **2 行**（txid `347/349/351` 为 +10 腿；对家 uid `6`） |
| 账本退款分录 `purchase_refund`（根键 **9 组 × 2 行**） | `biz:listing:refund:{2,6,7,8,9,11}`（既有）+ `{14,15,17}`（本夹具）各 2 行 |
| `public.admin_refund_audit_log`（**7 行**） | `1`(900008/order 11/applied/`341`)、`2`(900001/order 8/applied/`343`)、`3`(900005/order 9/applied/`345`) 系**交付方夹具**；`4`(910008/order `17`/applied/`353`)、`5`(910001/order `14`/applied/`355`)、`6`(910005/order `15`/applied/`357`)、`7`(910001/order `20`/**rejected_state**/txid `null`) 系**我本轮** |
| 真库总量对照 | `public.ledger_entry` = **347** 行（`purchase_refund` = **18** 行）；`Σ(cid=1) balance = 1989693` / `frozen = 10507`（**零位移**）；`schema_migration.version max = 0024` |
| **★ 登记缺口（我补登）** | `order 20`（`create_key "cli:qa7b-fixture-order-q7"`，`status 'created'`，seller 910001 / buyer 910002）由 `qa7b-04-http409.ts` 自建，**未出现在 `residue_manifest.orders`（q1–q6 = 14–19）内** ⇒ 该 manifest 不完整；以本表为准。 |
| 清理口径 | **未清理**（登记而非清除，与交付方同口径）；全部对象 uid ≥ 900000 ⇒ 与业务数据天然隔离。 |

### L8.4 verdict
**PASS（原样通过）** —— 核心 legs（L1 七门、L2 AC-④、L3 AC-11 三条、L4 E2E 十项、L5(a)+(b) 两处判负、L6 ①/②/③/④）**均独立复现**；两处判负均达成「变异 → 红 → 复原 → 绿」；被检提交 `39d89b3` 零污染。**附登记项**：**1 条真缺陷（F-1，已另派并行修复，不在本单范围）** + **2 条已知边界（O-1 单语 zh 外溢；`AC15-s3` 位置代理判据的注释敏感面）** + **1 条工作项（132 键逐码本地化 P6/P7）** + **1 条 manifest 缺口（order 20）**。**无阻塞项。**

## 收尾（端口 / git status 对拍 / 副本终检）
- **① 端口终态**：`lsof -nP -iTCP:5796-5799 -sTCP:LISTEN` = **空读数**（exit **1**）⇒ 本轮回检期间自起的 **5796** 实例**已关停**（未用 `pkill -f` / `killall`）。同刻 `5788` LISTEN = PID **65096**（`node …/ts-node src/index.ts`，启动 10:02AM，属既有 `bistro/ctrl` dev 栈）⇒ **非本单、未触碰、未启停**（口径：不得启停 5787/5788）。
- **② 主工作区 `git status --porcelain` 开工/收尾对拍**：
  - 开工（存档 `backend-ts/.p7bqa-artifacts/neg-start-gitstatus.txt`，**2 行**）：`?? backend-ts/.p7bqa-artifacts/` / `?? docs/qa/p7-b-admin-refund-review.md`。
  - 收尾（现取，**7 行**，逐字，存档 `backend-ts/.p7bqa-artifacts/close-gitstatus.txt`）：` M frontend/scripts/p7b-errfallback-gate.mjs` / ` M frontend/src/auth.js` / `?? backend-ts/.p7bqa-artifacts/` / `?? docs/audit/p7-c-errmsg-scope.md` / `?? docs/qa/p7-b-admin-refund-review.md` / `?? frontend/scripts/p7c-errmsg-machinecode-gate.mjs` / `?? frontend/src/test/unit/p7c-errmsg-machinecode.test.js`。
  - **净差异 = +5 行，全部属「批 7-C」并行面（他人在制品），与我的足迹无关**。mtime 逐件现取：`frontend/src/auth.js 19:13:08` / `frontend/scripts/p7b-errfallback-gate.mjs 19:14:57`（该门已被接入机读码判据） / `frontend/scripts/p7c-errmsg-machinecode-gate.mjs 19:14:32` / `frontend/src/test/unit/p7c-errmsg-machinecode.test.js 19:15:13` / `docs/audit/p7-c-errmsg-scope.md 19:16:26` —— 即派单方裁定写明的「**已另派 Kong 并行修复**」。**我的写入面仅 2 处**：`docs/qa/p7-b-admin-refund-review.md`（mtime `19:17:17`）+ `backend-ts/.p7bqa-artifacts/**`（mtime `19:17:27`）；**我全程未写主工作区任何被检文件**。另：`?? docs/audit/p7-c-errmsg-scope.md` 落在禁改面 `docs/audit/**`，**非我产出**。同轮 HEAD 漂移 `39d89b3 → 6d76e43 → 8a2b247`（均为他人提交，不含我文件）。**★ 该 7 行系收尾时刻快照；7-C 仍在落地中，行数可能继续增长。**
- **③ 副本逐文件 blob == `git rev-parse 39d89b3:<path>` 终检（12 件全 SAME）**：`0024_admin_refund_audit.sql a419d71f…` · `src/listing-funds-service.ts 9796debd…` · `src/index.ts f315b988…` · `src/database.ts 7b802def…` · `frontend/src/auth.js 690e287b…` · `frontend/scripts/p7b-errfallback-gate.mjs ead91f9f…` · `frontend/src/test/unit/p7b-errfallback.test.js a46b1931…` · `frontend/src/locales/zh.json cbb2fa03…` · `hk.json 17ad439b…` · `en.json de2ebdbf…` · `vn.json 99a30144…` · `backend-ts/scripts/p7b-03-offline-gates.ts f5523151…`。副本 `git status --porcelain --untracked-files=no` = **空**。
- **④ 占位读数**：对「连续双下划线」形态计数 = **0** 行；对中文占位词形态计数 = **0** 行（命令 = 交互式 `grep -c`，分别以该两种形态为模式打在 `docs/qa/p7-b-admin-refund-review.md`；本行刻意不复写模式的字面量，以免自命中）。
- 纪律自检：身份表一律 `users`；SQL 显式 `public.`；**未** `pkill -f`/`killall`；自起实例只许 **5796/5797**（本轮只用 5796）；未改被检代码（变异只在副本内且已复原）；未改 `docs/seafood.master-plan.md` / 任何 `docs/*.spec.md` / `docs/audit/**`；只写 `docs/qa/**` 与本轮产物；**未** `git add/commit/push`；**未** `npm install`；未碰/未打印 `.env*`；原始输出不用 `.log` 后缀。
