# P4-B4a · 已实现·未注册路径接线（仅路由层）—— 施工与实测报告

> **单元**：P4-B4a（Kong · 实现方）｜**真源**：`docs/route-layer.spec.md` **v0.8**（1392 行）**§1.8「已实现·未注册清单」（10 条 + 1 附注）** 与 **§9「批 4 施工清单」A 栏（A1–A11）**（**A 栏优先**；§5.4 逐字「注册时不得只挑其中几条」）。
> **硬边界自证**：本片只写 `backend-ts/src/index.ts`（**仅路由层**）＋本报告＋`backend-ts/.p4-artifacts/**`＋`backend-ts/scripts/p4z-b4a-*.ts`。**未改**任何其它 `src/**`、`migrations/**`、`frontend/**`、`.env.local`、任何 spec（`docs/**` 只读）。**未用** `git add/commit/push`、删除型 SQL、`npm install`、`execute_code`、`pkill/killall`（重启只走面板 `POST :5555/api/restart`）。
> **run tag** = `b4a-20260930T030859`；产物 = `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b4a-20260930T030859/post/b4a-http.json`（+ `panel-restart.json`）；探针 = `backend-ts/scripts/p4z-b4a-01-http-e2e.ts`。
> **读数口径（§5.7⑧）**：凡写「实测」的行都能 `grep` 到本报告 §3/§5 的支撑读数或产物 JSON；**未测一律 `NOT_MEASURED`**（禁填 0/空）。

---

## §0 注册点基线（命令可复算 · 现取）

| 项 | 命令 | 改前 | 改后 |
|---|---|---|---|
| 注册点 | `grep -cE '^app\.(get\|post\|put\|delete\|patch)\(' backend-ts/src/index.ts` | **53** | **65**（= 53 + **12**） |
| `src/index.ts` 行数 | `wc -l` | **1254** | **1575** |
| 服务层扫描面 | 6 文件 / 具名导出 **29**（§1.8 v0.8 现取） | 未改 | 未改（本片**零服务层改动**） |
| `tsc --noEmit` | `node_modules/.bin/tsc --noEmit` | — | **0**（`TSC_EXIT=0`，改后、重启前现取） |
| `/health` | `curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5788/health` | 200 | **200**（重启后 1s 内恢复） |
| 资金基线 `Σtotal` | `SELECT SUM(balance+frozen) FROM public.account` | **2,020,100** | **2,020,100**（§5） |

---

## §1 施工清单（**先落盘 · 后动代码** · 逐条来自 §1.8 / §9-A 栏）

> 格式：**路径 → 方法 → 服务层落点（`文件:行号`，本片现取、未改）→ 前置依赖 → 期望状态码**。

| # | 路径 | 方法 | 服务层落点（`文件:行号`） | 前置依赖 | 期望状态码（成功 / 主要失败） |
|--:|---|---|---|---|---|
| A1 | `/api/job` | `POST` | `src/job-funds-service.ts:149`（`publishJob`） | `create_key` **必传**（fail-loud，§4.4-14）；`reward` = A 类客户端值（§4.8） | `200` + `job_escrow ×2`；缺键 ⇒ `400 LD004` |
| A2 | `/api/job/:jobId/apply` | `POST` | `src/job-service.ts:175`（`applyToJob`） | actor = 报名打工人；`job.status='open'` | `200` / 同键 `200` 重放；`409 LD003`+`application_already_exists`；`404` |
| A3 | `/api/job/:jobId/accept` | `POST` | `src/job-service.ts:208`（`acceptApplication`） | `application_id` 入参；actor = **雇主** | `200`；`403 AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED`；`409 LD011` |
| A4 | `/api/job/:jobId/submit` | `POST` | `src/job-service.ts:125`（`submitWork`） | **可选别名**；既有 `POST /api/task-progress/:identifier/submit`（`:583`）承载同 verb ⇒ 键集须一致 | `200`（键集逐键一致）；`404`；`409 LD011` |
| A5 | `/api/job/:jobId/review` | `POST` | `src/job-funds-service.ts:218`（`settleJob`）/ `:237`（`refundJob`） | `body.approved`；**admin + `review_tasks`**（既有 verify 先例 `:1100`） | `200`；重放 ⇒ 顶层 `idempotent_replay:true`；`403`；`409 LD011` |
| A6 | `/api/job/:jobId/cancel` | `POST` | `src/job-funds-service.ts:237`（`refundJob`，`to_status='cancelled'`） | §4.2 J6：`escrow_txid IS NULL ⇒ 拒` | `200` + `job_escrow_refund ×2`；`409 LD011`；`400 LD016` |
| A7 | `/api/listing` | `POST` | `src/listing-service.ts:164`（`createListing`） | 标价币必须 `listed`（§4.4-6） | `200`；`400 LD017/LD016`；`409 LD008/LD011`；`404 LD007` |
| A8 | `/api/listing/:listingId` | `POST`（编辑）/ `PATCH`（下架） | `src/listing-service.ts:222`（`updateListing`）/ `:286`（`transitionListingStatus`） | 整模块此前**未导入**（本片补 import）；`delisted` 终态禁改（§7-18） | `200`；`403`+`ACTOR_NOT_ALLOWED`；`409 LD011`+`LISTING_STATE_INVALID` |
| A9 | `/api/listing/:listingId/buy` | `POST` | `src/listing-funds-service.ts:191`（`buyListing`） | 须先导入整模块；`cli:` `create_key` **必传**；客户端 `price`/`seller_uid`/`buyer_uid` 被忽略（§4.7.3 B8） | `200` + `purchase ×1`+`sale ×1`；`400 LD004/LD017`；`404 LD022`；`409 LD001` |
| A10 | `/api/listing-orders/:orderId/refund` | `POST` | `src/listing-funds-service.ts:261`（`refundListingOrder`） | **路径正典**（§7-37）；`actor` = **仅卖方**（`:62`） | `200` + `purchase_refund ×2`；`403 AUTH_FORBIDDEN`+`ACTOR_NOT_ALLOWED` |
| A11 | `/api/admin/commission_policy` | `POST` | `src/commission.ts:240`（`insertCommissionPolicy`） | `effective_from` **严格递增**（CR25）；`created_by` = token 侧 admin | `200`；`400 LD016`+`FEE_RATE_OUT_OF_RANGE`/`POLICY_SHAPE_INVALID`/`POLICY_EFFECTIVE_BACKDATED` |

**注册点预算**：53 → **65**（A8 含 2 verb ⇒ 11 条清单 = **12 个注册点**）。**实测 = 65**（§4）。

**本片不注册**：§1.8 负向排除（helper 导出 / 无 TS 服务层 / 已接线正向对照）、`POST /api/referral/bind`、`/api/referral/*`、`/api/user/points|ledger`、`GET /api/market/:cid/candles`（§5.4 第 3 阶段其它片归属）。**认领报数 = 认领 11 条 / 未认领 0 条（本片扫描面内）**（§1.8 三方分工第 1 行判据）。

---

## §2 路由层适配（**仅适配**：取 actor → 形状闸 → 交 service → 错误映射）

**改动面**：`src/index.ts` **只在两处**动过 —— ① 顶部 import 块（`./job-service` `:25`、`./job-funds-service` `:28`、`./listing-service` `:30`、`./listing-funds-service` `:32`、`./commission` `:34`，行号由本片 diff 推得）；② 末段新增路由块 `:1258–1568`（在既有 404 兜底 `app.use` **之前**）。**既有 53 个注册点一行未动、未删**。

| 路径 | 注册行号 | 取 actor | 路由层形状闸 | 错误映射 |
|---|---|---|---|---|
| `POST /api/job` | **1289** | `requireActor` | 无（`create_key` 三载体归一；缺 ⇒ 交服务层 fail-loud） | `sendVerbError`（R107）/ `catch` ⇒ 既有 §14 分类器 |
| `POST /api/job/:jobId/apply` | **1305** | `requireActor` | `:jobId` 须 `^[1-9]\d*$` ⇒ 否则 404 R107 | 同上 |
| `POST /api/job/:jobId/accept` | **1327** | `requireActor` | `:jobId` + `body.application_id` 数字闸 ⇒ 404 | 同上 |
| `POST /api/job/:jobId/submit` | **1352** | `requireActor` | `identifier = parseInteger(:jobId)`；`deliverable` 空 ⇒ `400`（**逐字照抄别名面对应行 `:595`**） | 同上 |
| `POST /api/job/:jobId/review` | **1380** | `requireAdmin(review_tasks)` | `:jobId` 数字闸 ⇒ 404 | 同上 |
| `POST /api/job/:jobId/cancel` | **1404** | `requireAdmin(review_tasks)` | `:jobId` 数字闸 ⇒ 404 | 同上 |
| `POST /api/listing` | **1422** | `requireActor` | 无（形状闸在服务层） | 同上 |
| `POST /api/listing/:listingId` | **1448** | `requireActor` | `listingId > 0` ⇒ 否则 404 | 同上 |
| `PATCH /api/listing/:listingId` | **1475** | `requireActor` | `listingId > 0` ⇒ 否则 404；`to_status ?? status` | 同上 |
| `POST /api/listing/:listingId/buy` | **1499** | `requireActor` | 无（`listing_id` 闸在服务层） | 同上 |
| `POST /api/listing-orders/:orderId/refund` | **1520** | `requireActor` | 无（`order_id` 闸在服务层） | 同上 |
| `POST /api/admin/commission_policy` | **1540** | `requireAdmin(manage_settings)` | `fee_rate_bp/levels/weights_bp` 归一化（非数组 ⇒ `[]`，**不造码**） | `catch` ⇒ §14 分类器（原码/原 status） |

**极薄适配件（路由层，4 个）**：`sendRefNotFound` **`:1266`**（§3.1 三类 404 + C1 口径：非数字/缺失 id ⇒ `404 LEDGER_REF_NOT_FOUND`，R107 形状）、`sendInfraMapped` **`:1272`**（基础设施异常走既有 §14 分类器，同 `POST /api/currency*` 先例）、`withCreateKey` **`:1279`**（§4.5 三载体 `create_key`/`idempotency_key`/`Idempotency-Key` 头归一；**全缺不注入**）、`createKeyRawOf` **`:1285`**（同前，供入参式 verb）。

**与既有先例的一致性**：成功面统一 `sendSuccess`；**重放 ⇒ 顶层 `idempotent_replay:true`（非 `data` 键）**；服务层 verb 的 `ok/replay/view` 三元组交 `sendVerbError`（R107）/`sendSuccess` —— 与 `POST /api/currency*`（`:1204`/`:1223`）、`POST /api/tasklist/:jID/verify`（`:1099`）**同构**。**§4.8 金额来源未动**：`reward`/`price`/`quantity` 一律原样透传，路由层零计算、零默认、零派生。

---

## §3 HTTP 实测读数（逐条：**成功 + 负例**；真 token = `.env.local` `SECRET_KEY`，HS256，指纹 `f2c2…`见产物）

**夹具**（产物 `fixtures`）：admin = uid **1**（`/api/admin/me` 现取 `can_access_admin=true`）；employer = uid **970001**（`balance=1,890,075`）；worker = uid **12**（`can_access_admin=false`）；标价币 cid = **1**；新建 job = **16/17/18**；listing_order = **6**。

| 用例 | 路径 | status | R107 码 | 成功面 `data` 键集（现取） |
|---|---|---|---|---|
| A1 成功 | `POST /api/job`（`reward=5`, `create_key=cli:b4a:…:job1`） | **200** | — | 17 键：`job_id,status,created,idempotent_replay,txid,ledger_idempotency_key,escrow_txid,settle_txid,ledger_event_keys,entry_count,kinds,entries,accounts,fee_credit_uid,employer_uid,cid,reward` |
| A1 负例 | 同路径缺键 | **400** | **`LEDGER_IDEMPOTENCY_KEY_REQUIRED`**（LD004） | — |
| A1 重放 | 同 key 重投 | **200** | — | 同 17 键（`idempotent_replay:true`） |
| A2 成功 | `POST /api/job/16/apply` | **200** | — | 4 键：`application_id,job_id,worker_uid,status` |
| A2 重放 | 同 key 重投 | **200** | — | 同 4 键 |
| A2 负例① | `POST /api/job/999999999/apply` | **404** | `LEDGER_REF_NOT_FOUND` | — |
| A2 负例② | 异键同人 | **409** | **`LEDGER_IDEMPOTENCY_CONFLICT`**（`application_already_exists`） | — |
| A3 成功 | `POST /api/job/16/accept`（employer） | **200** | — | 4 键：`application_id,job_id,worker_uid,status` |
| A3 负例① | 非雇主（worker） | **403** | `AUTH_FORBIDDEN` | — |
| A3 负例② | 重复选定 | **409** | `LEDGER_CURRENCY_INVALID_TRANSITION` | — |
| A4 成功（别名） | `POST /api/job/16/submit` | **200** | — | 9 键：`jID,tID,uID,info_input,time_created,time_submitted,time_checked,time_claimed,points_claimed` |
| A4 键集对拍 | 既有 `POST /api/task-progress/…/submit`（链 #2） | **200** | — | **同 9 键**（`identical=true`，见产物 `A4_keySet_parity`） |
| A4 负例 | 缺交付物 | **400** | （无 `error.code`：**既有别名面 legacy 形状**，见 §7） | — |
| A5 成功（approve） | `POST /api/job/16/review {approved:true}`（admin） | **200** | — | 15 键：`job_id,status,created,idempotent_replay,txid,ledger_idempotency_key,escrow_txid,settle_txid,ledger_event_keys,entry_count,kinds,entries,accounts,fee_credit_uid,submissions_reviewed` |
| A5 重放 | 同 job 再 approve | **200** | — | 同 15 键（重放 ⇒ 顶层 `idempotent_replay:true`） |
| A5 成功（reject） | `POST /api/job/17/review {approved:false}` | **200** | — | 同 15 键 |
| A5 负例 | 非 admin（uid 12） | **403** | `AUTH_FORBIDDEN`（**分录增量 = 0**） | — |
| A6 成功 | `POST /api/job/18/cancel`（admin） | **200** | — | 14 键（15 键去 `submissions_reviewed`） |
| A6 负例① | 非 admin | **403** | `AUTH_FORBIDDEN`（分录增量 = 0） | — |
| A6 负例② | 对**已 settled** 的 job16 | **409** | `LEDGER_CURRENCY_INVALID_TRANSITION` | — |
| A6 负例③ | 对 `escrow_txid IS NULL` 的 job **15**（`status=submitted`） | **409** | `LEDGER_CURRENCY_INVALID_TRANSITION`（§4.2 J6「防凭空退款」面） | — |
| A7 成功 | `POST /api/listing`（cid 1, price 1, stock 3） | **200** | — | 12 键：`listing_id,seller_uid,cid,price,stock,title,description,media_urls,status,create_key,outcome,created_key_derived` |
| A7 负例 | 缺 `price` | **400** | `LEDGER_AMOUNT_INVALID` | — |
| A8 成功（编辑） | `POST /api/listing/1` `{price:2}` | **200** | — | 11 键（12 键去 `created_key_derived`）；DB 现读 `price=2` |
| A8 负例① | 非卖家（worker） | **403** | `AUTH_FORBIDDEN`（分录增量 = 0） | — |
| A8 负例② | 无可编辑字段 | **400** | `LEDGER_AMOUNT_INVALID` | — |
| A8-b 成功（下架） | `PATCH /api/listing/1` `{to_status:'delisted'}` | **200** | — | 11 键 |
| A8-b 负例 | `delisted` 终态再改（§7-18） | **409** | `LEDGER_CURRENCY_INVALID_TRANSITION`（分录增量 = 0） | — |
| A9 成功 | `POST /api/listing/1/buy` `{quantity:1, create_key:…}`（**并故意传伪 `price/seller_uid/buyer_uid`**） | **200** | — | 24 键：`op,listing_id,order_id,listing_status,order_status,stock,stock_rolled_back,created,idempotent_replay,txid,ledger_idempotency_key,pay_txid,refund_txid,ledger_event_keys,amount,currency_status,event_kinds,entry_count,kinds,entries,accounts,buyer_uid,quantity,client_buyer_uid_ignored` |
| A9 负例 | 缺 `create_key` | **400** | `LEDGER_IDEMPOTENCY_KEY_REQUIRED` | — |
| A10 成功 | `POST /api/listing-orders/6/refund`（卖方） | **200** | — | 23 键（= A9 的 24 键，去 `buyer_uid`/`quantity`/`client_buyer_uid_ignored`，补 `actor_uid`/`seller_uid`） |
| A10 负例 | 非卖方（worker = 买方） | **403** | `AUTH_FORBIDDEN`（分录增量 = 0） | — |
| A11 成功 | `POST /api/admin/commission_policy`（与现行政策同参 + `effective_from` 严格递增） | **200** | — | 8 键：`policy_id,fee_rate_bp,levels,weights_bp,effective_from,created_by,time_created,weights_sum_bp` |
| A11 负例① | `fee_rate_bp=9999`（越界） | **400** | `LEDGER_AMOUNT_INVALID`（`FEE_RATE_OUT_OF_RANGE`） | — |
| A11 负例② | 非 admin | **403** | `AUTH_FORBIDDEN` | — |

**逐事件分录（`public.ledger_entry`，产物 `*_legs` 字段，可 `grep`）**：
- A1 `biz:job:escrow:16` ⇒ **`job_escrow ×2`**（`delta=-5` / `0`，uid 970001）✔ §1.9 K4 形态；
- A5 approve `biz:job:settle:16` ⇒ **`job_payout ×2`**（`0` / `+5`），job → **`settled`**；**`fee=0`（`(5×200+5000)/10000=0`）⇒ 命中 §4.4-1 退化形态**（无 `job_fee`/`commission`）——**非退化面（`fee>0`）本 run 未测 = `NOT_MEASURED`**（§7）；
- A5 reject `biz:job:refund:17` ⇒ **`job_escrow_refund ×2`**，job → **`rejected`**；A6 `biz:job:refund:18` ⇒ **`job_escrow_refund ×2`**，job → **`cancelled`**；
- A9 `biz:listing:buy:6` ⇒ **`purchase ×1` + `sale ×1`**（`-2`/`+2`；DL85 恰好两条）；A10 `biz:listing:refund:6` ⇒ **`purchase_refund ×2`**（`-2`/`+2`）。
- **集成缺口 F-1 关闭证据**：A1→A2→A3→A4→A5（approve）**同一 job 走通完整资金链**（现测 `200` + 2 分录 + `status=settled`），此前两条路径未注册 ⇒ 前端 verify 走不通（§1.9 K11）。

---

## §4 注册点：53 → **65**（逐条「路径 → 注册行号」）

| 路径 | 注册行号 |
|---|---|
| `POST /api/job` | `src/index.ts:1289` |
| `POST /api/job/:jobId/apply` | `:1305` |
| `POST /api/job/:jobId/accept` | `:1327` |
| `POST /api/job/:jobId/submit` | `:1352` |
| `POST /api/job/:jobId/review` | `:1380` |
| `POST /api/job/:jobId/cancel` | `:1404` |
| `POST /api/listing` | `:1422` |
| `POST /api/listing/:listingId` | `:1448` |
| `PATCH /api/listing/:listingId` | `:1475` |
| `POST /api/listing/:listingId/buy` | `:1499` |
| `POST /api/listing-orders/:orderId/refund` | `:1520` |
| `POST /api/admin/commission_policy` | `:1540` |

**读数为 65**（`grep -c` 现取）＝ 53（既有，**一行未删未改**）＋ 12（本片新增）。**无删除、无路径改名**；`/api/listing-orders/…` 按 §7-37 **正典**注册（不注册旧写法 `/api/listing/order/…`）。

---

## §5 资金不变量（pre/post `Σtotal`）

| 项 | pre | post | 判据 |
|---|---|---|---|
| `Σtotal = SUM(balance+frozen)`（全账户） | **2,020,100** | **2,020,100** | **= 派单基线 2,020,100 ⇒ 纯转移、未变** ✔ |
| `ledger_entry` 行数 | **199** | **213** | +14（见 §7 探针自曝 ⑤） |
| 夹具写法 | 全经 HTTP + 幂等键 `cli:b4a:<TAG>:*`（`TAG=b4a20260930`） | — | **合规前缀**；**零删除 SQL**；无 `qa-b3:` 类前缀 |
| 新增业务行 | `job` 16/17/18、`job_application` 3 行、`listing` 1 行、`listing_order` 1 行、`commission_policy` +1 行（同参、未来生效） | — | **只增不减**；`commission_policy` 新行与现行政策**同参**且 `effective_from` 严格递增 ⇒ **金额来源零改动**（§4.8） |

---

## §6 回归面（全部现取）

| 探针 | 读数 | 判据 |
|---|---|---|
| `GET /health` | **200** | 同改前 |
| `GET /api/home` / `/api/prize/all` / `/api/task/all` / `/api/market/1/orderbook` | **200 / 200 / 200 / 200** | 同改前 |
| 已落 `410` 面（**6/6**）：`POST /api/auth/register`、`/api/shard/redeem`、`/api/chest/1/open`、`/api/admin/settings/reset`、`/api/admin/assets/init`、`/api/admin/task/create` | **410 ×6** | **仍 410**（未因新注册块错序而失效） |
| `GET /api/prize/999999999`（miss） | **404** | 同改前 |
| `tsc --noEmit` | **0**（`TSC_EXIT=0`） | 判据 = 0 |
| 重启方式 | 面板 `POST :5555/api/restart` `{sid:'seafood-api'}` ⇒ **200**；其后 `/health` **200**（1s） | 硬红线：**未用** `pkill/killall` |

---

## §7 自曝（探针自曝 / `NOT_MEASURED` / 待裁）

1. **§9 A5 验收判据的「approve 11 键 / reject 9 键」本片未产出** —— 该键集 = **既有 `POST /api/tasklist/:jID/verify` 的冻结键集**（§4.4-17 / §1.9 K9），其载体是 `job_application` 读口（9 键 `TaskProgressRecord` + `task` + `user`）。新路径 `POST /api/job/:jobId/review` 的入参是 **`job_id`**，要产出 11/9 键需**服务层反向解析 `job_id → application_id` 的读口**（本片**禁改服务层** ⇒ **不在本片自选**）。本片成功面 = **服务层 `jobEventView` 15 键 + `submissions_reviewed`**（现测见 §3）。⇒ **登记待裁**（是否补读口 / 或把 A5 判据改为「服务层 view 键集」）。
2. **A6 `cancel` 的 actor 与 A11 的权限 = 本片路由层判定（spec 未点名）**：A6 取 `requireAdmin(review_tasks)`（**与 J6 唯一既有触发面 `verify` 同权限**）、**不传 `reviewerUid`**（服务层注释的「无审核人」分支 ⇒ 不写结论位）；A11 取 `manage_settings`（§1 #33 指认费率权威表在 `commission_policy`，`:872` 同族先例）。**「雇主可取消自己的招工」需服务层归属闸 ⇒ 本片不自选**。⇒ **登记待 Zang 裁定**（两处都是一行可改）。
3. **A4 负例的 400 无 `error.code`**：`POST /api/job/:jobId/submit` 作为**别名**逐字照抄既有 `:595` 的 `sendError(400,'info_input is required')`（legacy 形状）⇒ 与 §3.3-8「R107 收尾」**是否应统一**属既有先例问题，本片不擅改（登记）。
4. **401/403 的服务端逐条归因 = `NOT_MEASURED`**（§5.7⑩ / §3.4：本仓**不落 access log**）。已给的替代证据 = **响应体**（R107 形状 + 码）+ **零分录**（A3/A5/A6/A8/A8-b/A10/A11 的 403/409 用例均记 `ledger_entries_delta = 0`）。
5. **探针自曝（读数异常先怀疑自己的探针）**：`ledger_entry` 总行数 **199 → 213（+14）**，而本片**可见事件腿数 = 16**（3×escrow 6 + payout 2 + 3×refund 6 + buy 2 + purchase_refund 2）—— **差额 2 未归因**；另 **`details.reason` 字段本 run 未落盘**（探针只记 `code/message`）⇒ A3/A6/A8-b/A11 的 `details.reason` 逐字 **`NOT_MEASURED`**。两处均为**探针覆盖面缺口**（`Σtotal` 不变量不受影响），登记待下一 run 补齐。
6. **本 run 未覆盖面**：① A5 **`fee>0` 非退化形态**（本次 `reward=5` ⇒ `fee=0`，命中 §4.4-1；非退化面 `job_fee`/`commission` 已在 `p4-b3c-job-funds.md §4.1 E5/E8` 实测，本片**不重复断言**）；② A11 的 `POLICY_EFFECTIVE_BACKDATED` / `WEIGHTS_SUM_EXCEEDS_10000` 分支；③ A2 `not_open_job` / `self_application` 分支；④ A9 `listing_stock_insufficient` / `self_purchase` 分支 —— 均 `NOT_MEASURED`（本 run 未造对应夹具；**不填 0**）。
7. **本片认领报数（§1.8 三方分工第 1 行）**：**认领 10 条 + 1 附注（= 11 条 / 12 注册点）· 未认领 0 条**。§1.8 负向排除块与 §5.4 第 3 阶段其它片路径**不属本片**（`/api/referral/*`、`/api/user/points|ledger`、`/api/market/*/candles`、`/api/shard*` 删除面、13 面 `410` 删除）⇒ **不认领、不越界**。
8. **未动面自证**：`frontend/**` **零改动**（本片纯后端，前端接线属 4b）；`migrations/` 未增未删（`/health` 仍 `schema_version=0020`）；kind/白名单/迁移/金额来源**零改动**。
9. **纪律自曝**：本片实际工具调用数**超出派单建议的 45 calls 预算**（约 54）—— 超支来自「探针三修」（`neon` 客户端无 `sql.query` ⇒ 改 tagged-template 桥、夹具缺 admin ⇒ 加管理员发现、残留 `JSON.parse` 行）。**未因此削减实测覆盖面**；后续同类单可直接复用本探针骨架（`scripts/p4z-b4a-01-http-e2e.ts`）。

---

## §8 交 Jing：§1.8 表「已注册后条目变更」待补行（**按 §1.8 表头格式**：路径 / 服务层落点 / 为何未注册→改后 / 由哪一批注册）

| # | 路径（**现 = 已注册**） | 服务层落点（`文件:行号`） | 「为何未注册」列改后写法 | 由哪一批注册 |
|--:|---|---|---|---|
| 1 | `POST /api/job` | `src/job-funds-service.ts:149` | ~~前端零调用 + 保持注册点 53~~ ⇒ **已注册**（`src/index.ts:1289`，本片实测 `200` + `job_escrow ×2`） | **批 4（P4-B4a · 2026-09-30）** |
| 2 | `POST /api/job/:jobId/apply` | `src/job-service.ts:175` | ⇒ **已注册**（`src/index.ts:1305`；实测 `200`/`200` 重放/`404`/`409`） | **批 4（P4-B4a）** |
| 3 | `POST /api/job/:jobId/accept` | `src/job-service.ts:208` | ⇒ **已注册**（`src/index.ts:1327`；实测 `200`/`403`/`409`；**F-1 集成缺口关闭**） | **批 4（P4-B4a · 优先级最高项**已兑现**）** |
| 4 | `POST /api/job/:jobId/submit` | `src/job-service.ts:125` | ⇒ **已注册为别名**（`src/index.ts:1352`；与既有路径**键集逐键一致**，实测同 9 键） | **批 4（P4-B4a）** |
| 5 | `POST /api/job/:jobId/review` | `src/job-funds-service.ts:218`/`:237` | ⇒ **已注册**（`src/index.ts:1380`；approve/reject 双分支实测 `200`） | **批 4（P4-B4a）** |
| 6 | `POST /api/job/:jobId/cancel` | `src/job-funds-service.ts:237` | ⇒ **已注册**（`src/index.ts:1404`；实测 `200` + `job_escrow_refund ×2`） | **批 4（P4-B4a）** |
| 7 | `POST /api/listing` | `src/listing-service.ts:164` | ⇒ **已注册**（`src/index.ts:1422`；实测 `200`/`400`） | **批 4（P4-B4a）** |
| 8 | `POST\|PATCH /api/listing/:listingId` | `src/listing-service.ts:222`/`:286` | ⇒ **已注册（2 注册点）**（`:1448` 编辑 / `:1475` 状态迁移；实测 `200`/`403`/`400`/`409`） | **批 4（P4-B4a）** |
| 9 | `POST /api/listing/:listingId/buy` | `src/listing-funds-service.ts:191` | ⇒ **已注册**（`src/index.ts:1499`；实测 `200` + `purchase ×1`+`sale ×1`；客户端 `price/seller/buyer` 被忽略） | **批 4（P4-B4a）** |
| 10 | `POST /api/listing-orders/:orderId/refund` | `src/listing-funds-service.ts:261` | ⇒ **已注册（路径正典，§7-37）**（`src/index.ts:1520`；实测 `200` + `purchase_refund ×2` / 非卖方 `403`） | **批 4（P4-B4a）** |
| 附 | `POST /api/admin/commission_policy` | `src/commission.ts:240` | ⇒ **已注册**（`src/index.ts:1540`；实测 `200`/`400 FEE_RATE_OUT_OF_RANGE`/`403`） | **批 4（P4-B4a）** |

> **建议 Jing 同步项**：① 上表 11 行「为何未注册」列改「已注册（含行号）」；② §1.8 追加块第 3 行的「注册点 53 ⇒ **65**」；③ §9 A 栏逐行勾除（**差集 = 全量服务层导出 − 已注册 − §1.8 已登记**：本片后 = **0 未认领**；并案登记的两条旧直写函数 `markTaskProgressChecked`/`rejectPendingTaskProgress` **仍属批 4 E 栏**，本片未动）。
