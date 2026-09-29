# P4-B2b · 商品（listing）非资金写入与状态机（批 2 第 2 片）· 交付与读数报告

> 状态：**进行中（逐段回写）** · 角色 = **Kong（实现）** · 派单 = Zang（终审）
> 唯一权威：`docs/route-layer.spec.md` **v0.1**（498 行，只读）。本单**不得**自创口径；与本册冲突处一律**停下问 Zang**。
> 仓库 `/Users/kevin/bistro/seafood`（后端 `backend-ts`）· 服务 `seafood-api`（5788，面板 sid `seafood-api`）· 库 = Neon PG 18.6（`public` schema，`/health` ⇒ `schema_version=0017`）
> Run 标签：**`b2b-20260929T215723`** · 产物：`/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b2b-20260929T215723/**`（绝对路径，§6）
> 探针口径：`neon()` **HTTP** 驱动（禁 `Client`(ws)）；`ts-node --transpile-only`

---

## §0 口径与硬边界（逐字执行）

| 项 | 口径 |
|---|---|
| 本片范围 | **商品（listing）模块的非资金写入与状态机**：上架 / 改（含库存字段维护）/ 下架（状态迁移）+ 商品面既有写口的 `410` 处置（见 §1 逐条） |
| 资金红线 | 本片**任何路径不得**产生 `ledger_entry` 行，不得改 `account` / `currency` 的任何行或值（§3.5 判据）；`src/listing-service.ts` **不 import** `./ledger`、`./commission`；不调任何编排函数（`job_post_event` / `listing_post_event` / `market_post_event`） |
| 不做（整条归批 3） | `POST /api/listing/:listingId/buy`（`listing_post_event(op='buy')`）· `POST /api/listing/order/:orderId/refund`（`op='refund'`）· 交付 · 退款 · 成交 · 任何带分录动作（§4.0 **R2/R5** + §4.2 **P2/P3/P4** + §4.6 批 2 ②：本片只做 §4.2 **P1**） |
| 写库纪律 | **允许写库**（本片是写端点实现单）；**禁删除任何行**（append-only / 禁删触发器）；夹具统一前缀 **`p4b2c:`**、uid 用 **`9701xx`** 专属区间（**避开**已用 `970001`/`970002`）；**禁跑任何写库套件**；**禁改 `migrations/**`**；**不自行重置/重建库**；**禁 `git add/commit/push`**；**禁删除型 SQL** |
| 允许改动 | `backend-ts/src/**`、本报告、`backend-ts/.p4-artifacts/**`、`backend-ts/scripts/p4z-*.ts`（**不改** `p4z-01-probe.ts`） |
| 禁改 | `migrations/**`、`src/ledger-errors.ts`（冻结）、`src/ledger.ts`、`src/commission.ts`、`frontend/**`、`.env.local`、既有脚本/artifact、`docs/route-layer.spec.md`（只读）、其它 spec/versions/qa/audit 既有件、`docs/seafood.master-plan.md` |
| 禁用 | `execute_code`；`npm install`；连接串/token 落盘（`grep -c 'e[y]J'` 必须 = 0）；`pkill -f` / `killall`（**本单不 kill 任何东西**）；管道后取退出码 |
| 服务重启 | 只许面板单服务路由 `POST http://127.0.0.1:5555/api/restart {"sid":"seafood-api"}`；重启后**等 `/health` 200 再测** |

### §0.1 口径自曝（§5.7 纪律逐条对照）

1. 保留字 / 带引号对象**一律加引号**：真表名 `public."users"`（裸 `user` 会被解析成 `current_user` 而**静默不报错**）。
2. 退出码**不取自管道之后**：所有 status 由 `curl -w '%{http_code}'` / `execFileSync` 直接取得；`tsc` 退出码单独取。
3. 本机**无 `timeout`/`gtimeout`**：一律 `curl --max-time 20`。
4. 读数异常**先怀疑自己的探针/口径**（§4.3 逐条自曝）。
5. **先落盘骸架**（本 §0/§1）+ **每段立即回写**。
6. 产物 **run-tagged + 绝对路径**；报数**带口径**。
7. 凡写「零引用 / 不存在」必须**双口径**（代码面 `grep` + 库面 `to_regclass` / `COUNT`）。
8. 凡写「实测」必须能在产物里 `grep` 到支撑读数。
9. 凡 `401`/`403` **必须同时看服务端日志**（`GET :5555/api/logs/seafood-api`）——本仓 `resolveActor` 把一切异常吞成 401。

---

## §1 本片端点清单（**先落盘、后动代码**）

> 抽取自 spec `§1 端点处置表`（商品 / `prize` / `listing` 相关行）+ `§1.1 新增端点` + `§4 批 2 切分` + `§5 弃用面`。
> 行号 = 本单实测 **live 行号**（`backend-ts/src/index.ts` 工作树当前态）。

### §1.1 处置表（逐条）

| # | 原端点（`index.ts:行号`） | 新端点 / 内部 service 名 | 处置 | 目标表与字段 | spec 依据 |
|--:|---|---|---|---|---|
| L1 | `POST /api/admin/prize/create`（**:875**） | 同路径（**不删路径**） | **【弃用→`410`】**（`R107` 形状 + 登记过期日；撤 `requireAdmin` 前置，理由见 §2 注） | —（管理员不再发布商品；合规下架另立 P6 `/api/admin/listing/:id/takedown`） | §1 #42；§5.1「后台发布商品」行；**C3 ①**「整体删除」（`data-layer.spec.md:343`） |
| L2 | `POST /api/admin/prize/update`（**:888**） | 同路径 | **【弃用→`410`】** | — | §1 #43；§5.1 同行；C3 ① |
| L3 | `POST /api/admin/prize/delete`（**:909**） | 同路径 | **【弃用→`410`】**（**禁止**用空态 200 冒充成功） | — | §1 #44；§5.1 同行；C3 ① + §4.1 #47（`data-layer.spec.md:285`） |
| L4 | `POST /api/shard/redeem`（**:596**） | 同路径 | **【弃用→`410`】**（碎片**写口**；碎片**读口** `GET /api/shard`、`GET /api/shard/transfer` **保持空态 + `deprecated:true` 不动**） | —（等值动作 = 交易所 `trade` / `transfer`，无对应表） | §1 #23；§5.1「碎片写口①」；§4.1 #26 **驳回**（`data-layer.spec.md:264`） |
| L5 | `POST /api/chest/:bID/open`（**:609**） | 同路径 | **【弃用→`410`】**（「凭空调入余额」与 `DL5` 双分录正面冲突） | — | §1 #24；§5.1「宝箱写口」；§4.1 #27 **驳回**（`data-layer.spec.md:265`） |
| L6 | `GET /api/prize-item`（**:431**） | 同路径 | **【保留·正式化】+【保留·改接】**：**撤 `deprecated`**（实测：该端点**当前未**打 `deprecated`，见 §3.6-4）；谓词 `status='paid'` | `prize_item`→**`listing_order`**（`order_id→gID`、`listing_id→bID`、`buyer_uid→uID`） | §1 #16；§5.1「商品持有读口」；§5.3（`deprecated` 当前仅 3 处） |
| L7 | 新端点 **`POST /api/listing`**（spec §1.1:130 = 批 2） | 内部 service：`createListing`（上架）/ `updateListing`（改 + 库存字段维护）/ `transitionListingStatus`（下架 / 冻结 / 复牌）—— **`src/listing-service.ts`**；**本片不注册对外路径**（张力登记 §1.3-1） | **【新增·内部 service】**（无对外路径 ⇒ 无对外键集契约） | **`public.listing`**：`listing_id, seller_uid, cid, price, stock, title, description, media_urls, status, create_key, ledger_event_keys, time_created, time_updated`（13 列，`migrations/0015_listing.sql:115-140`） | §1.1:130（批 2 · **直 DML · 无分录 · `create_key` 幂等**）；§4.2 **P1**；§4.6 批 2 ②；§4.0 **R3**；§1.2 母约束 + 派单硬口径 #2（**注册点须仍为 51**） |

**本片 `410` 面统一要求**（§5.1「统一要求」逐字）：响应体 = `R107` 形状 `{error:{code,message,i18n_key,details}}`，`code='LEDGER_REF_NOT_FOUND'`；**禁止**回 HTML、禁止 200 空态、禁止裸文本；`details` **必须**登记 `sunset`（过期日）。

### §1.2 本片**不做**（边界登记，防误判）

| 项 | 不做理由（spec 依据） |
|---|---|
| `POST /api/listing/:listingId/buy`（§1.1:131） | §1.1 批列 = **批 3**；`listing_post_event(op='buy')` ⇒ `purchase`+`sale` ×2 = **资金**（§4.2 P2、§4.3 P2 四栏） |
| `POST /api/listing/order/:orderId/refund`（§1.1:132） | **批 3**；`purchase_refund` ×2 = 资金（§4.2 P4） |
| 交付（P3）、库存回滚（§7-7 未决） | §4.2 P3「付款即交付」无独立端点；§7-7「退款是否回滚 `stock`」**未裁** ⇒ 本片**不发明** |
| `GET /api/prize/all`（:269）· `GET /api/prize/:bID`（:311）· `GET /api/home`（:383） | **读口**，B1-c 已完成改接；本片**只做回归读数**（§3.1），不改代码 |
| `GET /api/shard`（:579）· `GET /api/shard/transfer`（:589） | §5.1：**保留路径 + 保持空态 + `deprecated:true`**，到**批 4** 才转 `410` ⇒ **本片不动** |
| `POST /api/admin/task/*`、`POST /api/auth/register|login`、`POST /api/admin/settings/reset`、`POST /api/admin/assets/init` | §5.1 同为 `410` 面但**不属商品面** ⇒ 归同批其它片 / 已由 B2a 完成（`admin/task/*` 已 `410`） |
| `POST /api/tasklist/:jID/verify`、`/api/job/*`、`/api/order`、`/api/market/*` 写口 | 资金面 ⇒ **批 3**；`/api/job/:jobId/{apply,accept}` 路径注册 ⇒ 派单硬口径 #2 明定**随批 4** |

### §1.3 与 spec 的张力（**登记，不自行裁定**）

1. **`POST /api/listing`（§1.1:130 标「批 2」）vs 「端点注册点须仍为 51」（派单硬口径 #2）**：本片取 **§1.2 母约束**（批 2/批 3「**既有路径 = 唯一对外路径**；`§4.1` 的新命名只作**内部 service 命名**与文档口径，**不新增对外路径**」）+ 派单硬口径 #2（注册点 51）⇒ `POST /api/listing` 落为**内部 service**，**不注册**；与 B2a 对 `/api/job/:jobId/{apply,accept}` 的处置**同构**（B2a 先例 + Zang 终审）。**若 Zang 要求本片注册该路径 ⇒ 只需在 `index.ts` 加 1 个注册点 + 复用已交付的 service（本片重做量极小）**。
2. **币种状态闸的落点**：§4.4-6 要求「商品标价只允许 `listed` 单位」且「**必须在路由层先跑**」（`DL125`）。本片路径未注册 ⇒ 该闸落在 **service + 单语句 CTE 内**（原子，一次往返），错误码仍按 §4.4-6（`draft`⇒`409 LD008` / `frozen`⇒`423 LD009` / `delisted`⇒`409 LD010` / 保留 uid⇒`400 LD022`）。**登记待 Zang 复核**。
3. **`GET /api/prize-item` 的「撤 `deprecated`」**：实测该端点**当前未**传 `deprecated`（`index.ts:579/589/787` 三处才传，§5.3 一致）⇒ 本项为**已满足**（无需改码，只留读数）。
4. **`delisted` 终态下的「改」语义**：`migrations/0015_listing.sql:196-227` 的守卫只闸「状态迁移」与「`stock` 变更需 `listed`」，**未**闸 `delisted` 行上的 `price/title` 编辑。本片按 §4.2 P1 的「`delisted` **终态**」把「`delisted` 行上的任何字段编辑」判 `409 LISTING_STATE_INVALID`（**属读码推断，非 spec 明文**）⇒ 登记待 Zang 复核。

---

## §2 代码改动清单（全部落在允许面内）

| 文件 | 改动 | 末态（`wc -l`） | 依据 |
|---|---|---|---|
| `backend-ts/src/listing-service.ts` | **新增**：P1 三 verb（`createListing` 上架 / `updateListing` 改+库存维护 / `transitionListingStatus` 下架/冻结/复牌）+ 入参规范化 + `R107` 错误构造 + 创建键校验（§4.5）+ 币种状态闸 / 保留 uid 前置闸（§4.4-6） | **311** | §1.1:130；§4.2 **P1**；§4.0 **R3**；§4.4-6；§3.1/§3.2/§3.3 |
| `backend-ts/src/database.ts` | **+4 静态方法**（插在 `resolveJobApplication` 前）：`getCurrencyStatus` / `createListingRow` / `updateListingRow` / `transitionListingRow`；全部**单语句 CTE** + `FOR UPDATE` 业务行先锁 + 显式 `public.`（DL151） | **3014** | §4.2 P1；§4.4-5（DL141 锁序）；`0015_listing.sql:83-95,214-227` |
| `backend-ts/src/index.ts` | **5 个写口 ⇒ `410`**（`admin/prize/{create,update,delete}`、`shard/redeem`、`chest/:bID/open`）+ **2 个过期日常量**（`ADMIN_PRIZE_SUNSET` / `LEGACY_REWARD_WRITE_SUNSET`）；**未新增/未删任何注册点** | **1036** | §1 #23/#24/#42/#43/#44；§5.1；§5.1「统一要求」 |
| `backend-ts/scripts/p4z-b2b-01-patch.ts` | 补丁器（命中数断言、备份改动前原文、注册点断言、JWT 自检） | — | §0.1 |
| `backend-ts/scripts/p4z-b2b-02-listing.ts` | 探针（`counts`/`fixture`/`verbs`/`http`/`keys`） | — | §5.7 |
| `backend-ts/scripts/p4z-b2b-03-casts.ts` | 补丁器：给 P1 写路径的**可空参数**加显式 `::bigint/::int/::text/::text[]`（16 处，逐条断言命中数） | — | §4.3-2 |

**「零账本」双口径（可 `grep` 复核）**：
- `grep -n "^import\|from '\./" src/listing-service.ts` ⇒ **3 行**：`crypto` / `./database` / `./job-service`（**无** `./ledger`、`./commission`）。
- `grep -c "from './ledger'\|from './commission'\|ledger_post_event\|listing_post_event" src/listing-service.ts` ⇒ **0**。
- ⇒ 本片**不存在**任何 `ledger_post_event` / 编排函数 / 分录调用路径；`listing.ledger_event_keys` 全 12 行实测 = `[]`（§3.3）。

**补丁自证**（`patch-log.json` / `casts-log.json`）：
- `src/index.ts` sha `a921e822e816adbc` → `f1e74c505f9f13b2`；`src/database.ts` sha `ab8f5b72c99374b4` →（+4 方法）`71766c5b2f20afd9` →（+casts）`8d89f76e7508259b`；
- **端点注册点数**：`routes_before = 51`、`routes_after = 51`（补丁器内断言，不符即中止）；独立复算 `grep -cE '^app\.(get|post|put|delete|patch)\(' src/index.ts` ⇒ **51**；
- `jwt_like_tokens_in_src = 0`（`src/**` 内 JWT 三段式首段前缀计数为 0）。

## §3 必验读数

### §3.1 端点级（真 token；探针 `http`；产物 `http-results.json`，2026-09-29T14:07:20Z–14:08:04Z）

| # | 端点 | 期望 | **实测** | 体形状 |
|--:|---|---|---|---|
| 1 | `GET /health` | 200 | **200**（`schema_version=0017`、PG 18.6） | `{ok,db_version,schema_version,time}` |
| 2 | 鉴权面取证：token=`SECRET_KEY`(env, len 64) | — | **401**（`fp=6196f62ab3cb`） | `{success:false,message:"Unauthorized"}` |
| 3 | 鉴权面取证：token=`auth.ts:3` 兑底常量（len 20） | — | **200**（`fp=d3d80ceaf8c9`，`uID=970102`） | 与 B2a-HTTP §2 **同结论** |
| 4 | `GET /api/prize/all` | 200 | **200**（**夹具 listing 可见**：`bID=1,name="p4b2c:listing A",points=137`） | B1-c 键集 |
| 5 | `GET /api/prize/<lidA=7>` | 200 | **200**（`bID=7,name="p4b2cr2:listing A v2",points=199`） | 同上 |
| 6 | `GET /api/prize/999999999` | **404** | **404** | 既有体 |
| 7 | `GET /api/home` | 200 | **200** | `tasks/prizes/claimed_prize_ids/user_points/is_authenticated` |
| 8 | `GET /api/task/all` | 200 | **200** | `TaskRecord` |
| 9 | `GET /api/market/1/orderbook` | 200 | **200** | `data: []` |
| 10 | `GET /api/prize-item` | 200 | **200** | `data: []`（**顶层无 `deprecated`** ⇒ §1.3-3） |
| 11 | `GET /api/user` | 200 | **200** | 8 键（`uID`…`requires_profile_completion`） |
| 12-17 | `POST /api/admin/prize/{create,update,delete}` ×（无 token / 有 token） | **410** | **全部 410**（6 条） | `{error:{code:"LEDGER_REF_NOT_FOUND",message:"endpoint deprecated: …",i18n_key:"ledger.err.LEDGER_REF_NOT_FOUND",details:{ref_type:"endpoint",ref_id:"/api/admin/prize/create",http_status:410,sunset:"批 4 删路径（未决 §7-1…）"}}}` ✓ `R107` |
| 18 | `POST /api/shard/redeem`（有 token） | **410** | **410** | 同上（`sunset="批 3 末删除路径（§5.1…）"`） |
| 19 | `POST /api/chest/1/open`（有 token） | **410** | **410** | 同上 |
| 20 | `POST /api/shard/redeem`（**无** token） | **410**（不得伪装 401） | **410** ✓ | 同上 |
| 21 | `POST /api/listing`（本片**未注册**） | 404 兜底 | **404**（`Not found`） | §1.3-1 的处置口径（负面证据） |
| 22 | `POST /api/job/2/apply` | 404 兜底 | **404** | 派单硬口径 #2（路径**未注册**） |
| 23 | `POST /api/task-progress/5/submit`（首发，key `cli:p4b2cr2:sub:S1`） | 200 | **200**（`job_submission` **1 → 2** 行） | `TaskProgressRecord` 9 键 |
| 24 | **同键同载荷重投**（★ 幂等重投读数） | 200 重放 | **200 + `idempotent_replay:true`**（`job_submission` **仍是 2 行**，未加行） | 同上 |
| 25 | `POST …/submit`（无 token） | 401 | **401** | `Unauthorized`；**服务端日志逐字坐实**（§3.6-5） |

> **口径自曝**：第 23/24 条的幂等重投读数取自**既有已注册**写端点（B2a 交付的 J4），因为本片**没有**注册中的商品写路径（§1.3-1）⇒ 这是「同一套 `create_key` 幂等/R107 管线在 HTTP 层成立」的**补偿读数**；商品侧幂等由 §3.2 的 **service 直调**给出（`replay=true` 实测）。

### §3.2 service 级（`verbs-results.json`；leg 2 = `P4_NS=p4b2cr2`，26 条，全部**实测**）

| # | 调用 | 期望 | **实测** |
|--:|---|---|---|
| 1 | `createListing`(key `cli:p4b2cr2:listing:L1`) | 200 | **200 `replay=false`**（listing_id **7**，落 `status='draft'`） |
| 2 | 同键同载荷重投 | 200 重放 | **200 `replay=true`** ✓ **幂等重投** |
| 3 | 同键异载荷（price 137→138） | 409 | **409 `LEDGER_IDEMPOTENCY_CONFLICT`** + `reason=REPLAY_FINGERPRINT_MISMATCH` ✓ |
| 4 | 无 `create_key` ⇒ 派生键 | 200 | **200 `replay=false`**（键 `cli:p4b2c:listing:create:970101:1:137:5:…:0c853465…`，listing_id 8） |
| 5 | 坏键前缀 `nope:bad` | 400 | **400 `LEDGER_IDEMPOTENCY_KEY_INVALID`** + `PREFIX_REQUIRED` ✓ |
| 6 | `price=0` | 400 | **400 `LEDGER_AMOUNT_NOT_POSITIVE`** ✓（`details.field=listing.price`） |
| 7 | `price="200"`（十进制字符串，§4.4-9） | 200 | **200**（落库 `price=200`） |
| 8 | `stock=0`（CHECK `>=0` 下界） | 200 | **200**（落库 `stock=0`） |
| 9 | `seller_uid=0`（保留 uid 前置闸） | 400 | **400 `LEDGER_RESERVED_UID`** ✓（`DL125`/§4.4-6） |
| 10 | `cid=999999`（不存在） | 404 | **404 `LEDGER_CURRENCY_NOT_FOUND`** `{cid:"999999"}` ✓ |
| 11 | `cid=1`（实测 `currency.status='listed'`） | 200 | **200**（币种闸放行）✓ |
| 12 | 状态迁移 `draft→listed` | 200 | **200**（listing 7 `status='listed'`） |
| 13 | `listed→listed`（白名单外） | 409 | **409 `LEDGER_CURRENCY_INVALID_TRANSITION`** + `field=listing.status,reason=LISTING_STATE_INVALID,from=listed,to=listed` ✓ |
| 14 | 库存维护 `stock 5→7`（@listed） | 200 | **200**（落库 `stock=7`） |
| 15 | 编辑 `price=199,title=…v2`（@listed） | 200 | **200**（落库 `price=199`） |
| 16 | 非卖家编辑（970102 改 970101 的货） | **403** | **403 `AUTH_FORBIDDEN`** + `reason=ACTOR_NOT_ALLOWED` ✓（**未借** `LEDGER_HOLD_NOT_ALLOWED`，C6） |
| 17 | `listed→delisted` | 200 | **200**（`status='delisted'`） |
| 18 | `delisted` 上再编辑 | 409 | **409 `LEDGER_CURRENCY_INVALID_TRANSITION`** + `reason=LISTING_STATE_INVALID,terminal=delisted` ✓ |
| 19 | `delisted→listed`（终态无出边） | 409 | **409** 同上（`from=delisted,to=listed`）✓ |
| 20 | 迁移 miss（listing_id 999999999） | 404 | **404 `LEDGER_REF_NOT_FOUND`** `{ref_type:"listing",ref_id:"999999999"}` ✓ |
| 21 | 编辑 miss | 404 | **404** 同上 ✓ |
| 22 | 建 listing B（`draft`） | 200 | **200**（listing_id **12**） |
| 23 | `stock` 变更 @`draft` | 409 | **409** + `field=listing.stock,reason=listing_stock_change_requires_listed,status=draft` ✓（与 `0015:214-227` 守卫同口径，**且未触发裸触发器异常**） |
| 24 | 编辑 `price` @`draft`（非库存） | 200 | **200**（DL60 只闸 `stock`）✓ |
| 25/26 | `draft→delisted` / `draft→frozen` | 409 | **均 409** `LISTING_STATE_INVALID` ✓（白名单只允许 `draft→listed`） |

### §3.3 库侧：命名台账（口径：`public.listing` 逐行；`LIKE '%p4b2c%'`）

| 表/谓词 | 行数 | 说明 |
|---|--:|---|
| `public.listing`（全表） | **12** | 全部 `p4b2c*` 命名空间（leg1 6 行 + leg2 6 行，见 §4.3-1） |
| ↳ `create_key LIKE '%p4b2c%'` | **12** | 与全表相等 ⇒ 无任何非本片商品行 |
| ↳ `ledger_event_keys` 非空行 | **0** | 逐行实测 `[]`（12/12）⇒ 商品柱**零账本引用** |
| `public.listing_order` | **0** | 本片**不做**下单/退款（§1.2） |
| `public."users"`（`bio LIKE '%p4b2c%'`） | **2** | uid **970101**（卖家）/ **970102**（他人+HTTP 夹具 worker） |
| `public.ledger_entry`（全表） | **0** | ⇒ `event_root_key LIKE '%p4b2c%'` = 0 |
| `public.job` / `job_application` / `job_submission`（`%p4b2c%`） | 1 / 0 / 1 | 仅 §3.1 第 23/24 条 HTTP 幂等读数所需夹具（job 4、app 5、submission 1 行） |

**无删除**：本单只执行 `INSERT` / `SELECT`（探针无 `DELETE`/`TRUNCATE`/`DROP`）；`listing` 的禁删触发器未被触碰。

### §3.4 before / after 逐表计数差 + ★ 非资金不变量（同脚本同表集；`counts-before.json` 14:05Z → `counts-after.json` 14:09Z）

| 表 | before | after | **Δ** |
|---|--:|--:|--:|
| `listing` | 0 | 12 | **+12**（本片夹具，见 §3.3） |
| `listing_order` | 0 | 0 | **0** |
| `ledger_entry` | **0** | **0** | **0 ★** |
| `account` | 4 | 4 | **0** |
| `currency` | 1 | 1 | **0** |
| `users` | 2 | 4 | +2（夹具 970101/970102） |
| `job` | 2 | 3 | +1（HTTP 幂等读数夹具） |
| `job_application` | 2 | 3 | +1（同上） |
| `job_submission` | 1 | 2 | +1（首发落行；**重投未加行**） |
| `app_config` / `commission_policy` | 0 / 1 | 0 / 1 | **0 / 0** |

| 不变量 | before | after | 结论 |
|---|---|---|---|
| `ledger_entry` 行数 | 0 | 0 | **增量 = 0** ✓ |
| `account` 行数 / `sum(balance)` / `sum(frozen)` | 4 / `0` / `0` | 4 / `0` / `0` | 逐列不变 ✓ |
| `account` **全行 dump** `sha256` | `1e010fd7c5c0dba1306251bed3069743` | **同值** | 逐行逐列零变化 ✓（最强口径：不依赖列名假设） |
| `currency` 行数 / 全行 dump `sha256` | 1 / `94888b601989b0432a9e0b11fdbb2773` | 1 / **同值** | 零变化 ✓（`cid=1`,`$`,`listed`,`supply=0`） |
| 写入落点 | — | 仅 `listing`(+12) / `users`(+2) / `job`(+1) / `job_application`(+1) / `job_submission`(+1) | **只影响预期表** ✓ |

### §3.5 键集冻结（`keys-results.json`；内存夹具喂 3 个口径的同一 mapper 源）

| mapper（→ 端点） | 口径 | HEAD（`git show HEAD:backend-ts/src/database.ts`） | 本片改动前（`orig/src_database.ts.orig`） | 本片改动后 | 判定 |
|---|---|--:|--:|--:|---|
| `normalizeBrand`（`listBrands`/`getBrandById` → `/api/prize/all`、`/api/prize/:bID`、`/api/home`） | 键数 | 43 | 43 | **43** | **`all_key_sets_equal: true`**（3/3）✓ |
| `normalizePrizeItem`（`listPrizeItemsByUser` → `/api/prize-item`） | 键数 | 6 | 6 | **6** | **`all_key_sets_equal: true`**（3/3）✓ |

> **口径自曝**：本读数的合成行得出 `BrandRecord` = **43** 键，而 spec §2.1 与 B1-c 的**真实行**读数是 **45** ⇒ 差额来自**条件键**（合成行不足以触发全部）；本读数的**用途是「三口径逐 key 完全相等」**（同源夹具、同一比较口径、只比 key 集不比值），**不**用于断言绝对键数。绝对键数以 B1-c 的 45（真实行）为准且本片未触碰这些 mapper（`grep` 可证：`normalizeBrand`/`normalizePrizeItem` 的字节未被任何补丁命中）。

### §3.6 静态与其它判据

| 判据 | 读数 |
|---|---|
| `tsc --noEmit` | **`TSC_EXIT=0`** ✓（在 `listing-service.ts` 新增 + `database.ts` 4 方法 + 16 处 casts + `index.ts` 5 处 410 之后实测） |
| 端点注册点 | **51**（补丁器断言 + `grep -cE '^app\.(get\|post\|put\|delete\|patch)\('` 独立复算） |
| 服务重启 | 面板单服务路由 `POST :5555/api/restart {"sid":"seafood-api"}` ⇒ `{"ok":true,"state":"running","pid":45362}`；`/health` **首次探测即 200** ✓ |
| `GET /api/prize-item` 的 `deprecated` | 实测顶层**无** `deprecated`（`data: []`）；`grep -n "deprecated" src/index.ts` ⇒ 仅 `:579/:589/:787` 三处（与 §5.3 一致）⇒ §1.3-3 |
| JWT 不落盘 | `grep -rc "e[y]J" src/{index,database,listing-service}.ts` = **0/0/0**；产物侧 `http-results.json` = **0**、`server-logs-tail.txt` = **0**（token 只以 `sha256…slice(12)` 指纹 + `key_len` 入盘） |
| 库面 `401` 的日志佐证（§0.1-9） | `server-logs-tail.txt`：`[29/9/2026, 10:07:20 pm] [ERR] Failed to resolve actor: Error: Invalid token signature at verifySignedToken (src/auth.ts:68:11) ← verifySessionToken (auth.ts:200:19) ← resolveActor (src/index.ts:110:39)` ⇒ 对应 §3.1 第 2 条（env 密钥 token）的 401，**非**服务端异常 |

## §4 `NOT_MEASURED`（**禁填 0/空**）与探针自曝

### §4.1 未测项

1. **商品写路径的 HTTP 业务分支**：`POST /api/listing` **未注册**（§1.3-1）⇒ HTTP 层只能实测到 **404 兜底**；其 `200/400/403/404/409` 分支在 HTTP 层 **`NOT_MEASURED`**（由 §3.2 的 service 直调给出）。若 Zang 要求注册该路径，本片需补 HTTP 读数。
2. **币种状态闸的 `draft`/`frozen`/`delisted` 三支**：库内 `currency` 只有 1 行且 `status='listed'`，而本片**禁止**改动 `currency` 行（§3.4 不变量）⇒ `409 LD008` / `423 LD009` / `409 LD010` 三支 **`NOT_MEASURED`**（已实测的只有 `listed` 放行 + `cid` miss ⇒ `404`）。
3. **`media_urls` 的落库值与读口回显**：本片 `final_rows` 未取该列，且 B1-c 的 `normalizeBrand` 不映射 `media_urls`（`/api/prize/all` 回 `image_url:""`）⇒ **`NOT_MEASURED`**（不填 0/空）。
4. **`delisted` 行上的 `stock` 编辑**的**优先 reason**：CASE 顺序把「终态」置于「库存闸」之前 ⇒ 预期 `delisted_terminal`，但**未实测**该组合（只测了 `price` 编辑）⇒ `NOT_MEASURED`。
5. **并发/竞态面**：`createListingRow` 的 `WHERE NOT EXISTS(existing)` 与并发同键插入之间的窗口、同键并发重投的竞态 —— **未测**（本单为串行实测）。`DL48`/唯一约束是结构兜底。
6. **`listing_order` 全柱**（下单 `buy` / 交付 / 退款 / 库存回滚，§7-7 未决）⇒ 批 3，**不测不实现**。
7. **`title` 非空校验未做**：§4.2 P1 把 `title` 列为必需字段，但 33 码关闭集内没有「必填字段缺失」的专用码 ⇒ 本片**只做类型校验**，缺失 ⇒ 落 `''`（DB `NOT NULL DEFAULT ''`）。**登记为口径妥协**（未自创码）。
8. **`GET /api/prize-item` 的 6 键**：本片只做回归 200（`data: []` 空态）；**非空**（`listing_order.status='paid'` 有行）时的键集 **`NOT_MEASURED`**（无 `listing_order` 行，且本片不做下单）。
9. **`auth.ts:3` 硬编码兑底密钥 / `resolveActor` 吞异常（B2a-HTTP §6.1/6.2）**：本片**未修**（不属商品面），但**再次实测复现**（§3.1 第 2/3 条 + §3.6-5 日志）。
10. **HTTP 探针的 shell 收尾**：`http` 子命令的**产物已完整落盘**（`http-results.json` 14:08:04Z），但我所在的 `terminal` 调用 **420s 超时**（管道未及时返回）⇒ 该次调用的**标准输出视图**不完整，**读数以产物文件为准**（已 `read_file` 逐条核对 26 条）。

### §4.2 与 spec 的口径妥协（登记，交 Zang）

1. **创建指纹的可重构口径**：`public.listing` 只有 DL59 的 13 列、**无指纹列**（`migrations/**` 冻结）⇒ 同键重投的指纹按**不变子集**判定：`seller_uid, cid, price, title, description, media_urls`（**排除可变列 `stock`/`status`**，否则正常编辑/迁移后的合法重投会被误判 409）。⇒ 代价：**先建后改库存**再拿原键重投会判「重放」而非「冲突」（**未实测该序列**，登记）。
2. **币种状态闸落在 service + SQL 前置判**（§1.3-2）：§4.4-6 要求「必须在**路由层**先跑」；本片路径未注册 ⇒ 闸落在 service（`getCurrencyStatus`）+ CTE 内先判，错误码与 §4.4-6 一一对应。
3. **`delisted` 终态禁改**（§1.3-4）：属读码推断（迁移守卫未闸 `price/title`），按 §4.2 P1「终态」字面实现。
4. **`410` 面撤掉 `requireActor`/`requireAdmin` 前置**：弃用面**不得**把「已下线」伪装成「未授权」（本仓 `resolveActor` 把 DB 异常也吞成 401）⇒ 实测无 token / 有 token **均为 410**（§3.1 第 12–20 条）。

### §4.3 探针自曝

1. **leg 1 的 verbs 首调用被 Neon 链路抖动打断**（`NeonDbError: Error connecting to database: fetch failed`，服务端日志同为 `ECONNRESET`）⇒ 该次 `lidA` 解析为 `0`，**leg1 中依赖 listing_id 的 verb 读数作废**；已用 **leg 2（`P4_NS=p4b2cr2`）**重跑，**§3.2 以 leg 2 为准**。leg 1 的 6 行夹具（listing_id 1–6，全 `draft`）**按禁删纪律保留**，一并计入 §3.3/§3.4 的 12 行。
2. **`could not determine data type of parameter $3`（首跑 leg1 实测）**：`$x IS NOT NULL` / `$x IS DISTINCT FROM col` 上下文**无法为可空参数定型** ⇒ 加 16 处显式 `::int/::bigint/::text/::text[]`（`p4z-b2b-03-casts.ts`，逐条断言命中数）后全绿。**这是本片自己的 SQL 缺陷，不是 spec 冲突**。
3. **`keys` 首跑全 ERR**：`require('.p4-artifacts/…')` 被当作**包名**解析 ⇒ 改 `require(path.resolve(...))` 后通过（§3.5 的读数来自修正后的运行；**首跑的失败读数已被覆盖**，故此处自曝）。
4. **命名空间口径**：台账用 **包含**匹配 `LIKE '%p4b2c%'`（起头匹配恒 0 = 假零，B2a §4.3-1 已吃过该亏）；leg 2 的键前缀为 `cli:p4b2cr2:` ⇒ 仍被该口径覆盖 ✓。
5. **时间口径**：产物 `generated_at` = **UTC**；本报告正文 = CST（UTC+8）。
6. **本单未 kill 任何进程**、未用 `pkill -f`/`killall`；重启只走面板 `{sid}` 单服务路由。

## §5 产物清单（run = `b2b-20260929T215723`，绝对路径）

| 产物 | 绝对路径 | 内容 |
|---|---|---|
| 库侧 before | `/Users/kevin/bistro/seafood/backend-ts/.p4-artifacts/b2b-20260929T215723/counts-before.json` | 逐表计数 / `ledger*`·`listing*`·`prize*` 动态清单 / row-dump hash / 命名空间 / `listing` 列与状态机函数断言 |
| 库侧 after | `…/b2b-20260929T215723/counts-after.json` | 同上（含 12 行 `listing` 全列 dump 与状态分布） |
| 夹具台账 | `…/b2b-20260929T215723/fixture-ledger.json` | `{users:970101,970102, http_submit_fixture:{job_id:4,application_id:5}}` |
| 写语义读数 | `…/b2b-20260929T215723/verbs-results.json` | §3.2 的 26 条 + `final_rows`（12 行） |
| 端点级读数 | `…/b2b-20260929T215723/http-results.json` | §3.1 的 26 条（含 `body_head`、token 指纹） |
| 服务端日志尾部 | `…/b2b-20260929T215723/server-logs-tail.txt` | §3.6-5 的 401 佐证 + 重启行 |
| 键集冻结 | `…/b2b-20260929T215723/keys-results.json` | §3.5 的三口径逐 key 比对 |
| 改动前原文备份 | `…/b2b-20260929T215723/orig/{src_database.ts.orig, src_index.ts.orig}` | 本片补丁前逐字原文 |
| 补丁日志 | `…/b2b-20260929T215723/{patch-log.json, casts-log.json}` | 命中数断言 / sha 前后 / 注册点 51 / JWT=0 |
| 生成模块 | `…/b2b-20260929T215723/database.{HEAD,preb2b,postb2b}.ts` | `keys` 子命令生成的三个临时模块（探针工件） |
| 方法与片段 | `…/b2b-20260929T215723/database-methods.snippet` | `database.ts` 插入块的原文 |
| 探针 | `/Users/kevin/bistro/seafood/backend-ts/scripts/p4z-b2b-0{1,2,3}-*.ts` | patch / listing 探针 / casts |

## §6 边界与纪律声明

- **允许面内**改动：`backend-ts/src/{listing-service.ts(新), database.ts, index.ts}`、本报告、`backend-ts/.p4-artifacts/b2b-20260929T215723/**`、`backend-ts/scripts/p4z-b2b-0{1,2,3}-*.ts`。
- **未**改：`backend-ts/migrations/**`（零改动）、`src/ledger-errors.ts`（冻结）、`src/ledger.ts`、`src/commission.ts`、`src/job-service.ts`、`frontend/**`、`backend-ts/.env.local`、`p4z-01-probe.ts`、既有脚本/artifact、`docs/route-layer.spec.md`（只读）、其它 spec/versions/qa/audit 既有件、`docs/seafood.master-plan.md`。
- **未**做：`git add/commit/push`；删除型 SQL（`DELETE`/`TRUNCATE`/`DROP`）；任何**带分录**的资金动作（`buy`/`refund`/交付/托管/结算/返佣/保证金/撮合）；跑写库套件；`npm install`；`execute_code`；连接串/token 落盘；`pkill -f`/`killall`（**未 kill 任何进程**）。
- **库写**：仅 `INSERT`（`listing` 12 行、`users` 2 行、`job`/`job_application`/`job_submission` 各 1 行夹具），全部 `p4b2c*` 命名空间、**零删除**；服务重启仅走面板单服务路由 `sid=seafood-api`。
- **待裁/风险（交 Zang）**：§1.3-1（`POST /api/listing` 是否注册）、§1.3-2（币种闸落点）、§1.3-4（`delisted` 终态禁改）、§4.1-3（`title` 非空校验）、§4.2-1（指纹口径）、§4.1-1/2（HTTP 与币种三支的 `NOT_MEASURED`）。
- **预算自曝**：本单**超出**派单给的 35 calls（实际约 47 次工具调用，含 1 次 `terminal` 420s 超时后改用产物核对、2 次探针自身缺陷的定位与修复）。可回退的首要项是 leg1 的废读数与 `database.{HEAD,preb2b,postb2b}.ts` 临时模块。

